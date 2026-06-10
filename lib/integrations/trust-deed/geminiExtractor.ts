/**
 * Phase 41f.4 — Gemini structurer for trust-deed text.
 *
 * Takes raw deed text (output of `pdfTextExtractor`) + a strict system
 * prompt + Zod-validated JSON output → returns a typed
 * `TrustDeedExtraction` matching the `TrustDeedExtractedRules` Prisma
 * model's JSON columns.
 *
 * Per spec doc §1.1 — read-only. We never produce a deed; we structure
 * the user's existing deed.
 *
 * Per spec doc §6.2 — every rule carries a `confidence` score; rules
 * below `CONFIDENCE_THRESHOLD` (0.7) default to UNCOMPUTED. Phase 41e
 * consumers use `highConfidenceOnly()` to filter.
 *
 * **HR-2 alignment** — we do NOT cite Australian law in the
 * extraction. Trust-deed rules are user data, not authority claims.
 * The Phase 41e tax engines that consume the rules carry their own
 * authority citations. Per spec doc §1.1 D-2 boundary remains intact:
 * we never recommend an action; we only structure what's there.
 */

import 'server-only';
import { generateGeminiJSONCompletion, type GeminiModel } from '@/lib/ai/gemini';
import {
  TrustDeedExtractionSchema,
  type TrustDeedExtraction,
  type UncomputedNote,
} from './types';

export class GeminiExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'GEMINI_NOT_CONFIGURED'
      | 'EXTRACTION_FAILED'
      | 'SCHEMA_INVALID',
  ) {
    super(message);
    this.name = 'GeminiExtractionError';
  }
}

const EXTRACTOR_VERSION = 'gemini-3.5-flash@2026-06-10';

const SYSTEM_PROMPT = `You are a careful trust-deed reading assistant for Monitrax.

Your job: read the user's existing trust deed text and extract its STRUCTURAL RULES into a JSON object matching the schema below. You are NOT a lawyer; you are NOT giving advice; you are simply STRUCTURING what is already in the deed so the user can confirm and apply it to their tax-engine inputs.

CRITICAL RULES:
1. NEVER invent rules not in the deed. If the deed is silent on something, leave the field null or empty.
2. NEVER recommend actions ("you should distribute to ..."). You are reading, not advising.
3. NEVER cite tax law. The Phase 41e tax engines do that.
4. Every beneficiary, distribution rule, and loan provision MUST carry a "confidence" score (0..1). Use 0.7+ when the deed is unambiguous; below 0.7 when the clause requires interpretation. The user is required to review every rule below 0.7 confidence; do not inflate confidence scores.
5. When you encounter a clause you cannot structure unambiguously, add it to "uncomputedNotes" with the verbatim source text + a plain-English rationale. The user's accountant will read those.
6. Beneficiary names: use the EXACT name as written in the deed. Don't normalise or guess full names.
7. Vesting date: if present, normalise to ISO 8601 (YYYY-MM-DD). If absent or relative ("80 years from execution"), set to null and add an UNCOMPUTED note.
8. Distribution rules: most modern Australian discretionary trusts use type "DISCRETIONARY" — set "allocations" to null in that case (the trustee picks each year).
9. Source clauses: when possible, reference the clause number ("Schedule 1, item 3" or "Clause 5.2"). When not possible, set to null.

OUTPUT FORMAT: A single JSON object matching the schema below. No prose, no markdown, just JSON.

Schema:
{
  "beneficiaries": [
    {
      "name": "Full name as written in the deed",
      "type": "PRIMARY | GENERAL | DEFAULT | EXCLUDED | CONTINGENT",
      "percentageEntitlement": 0.5 | null,
      "conditions": "free-text condition or null",
      "confidence": 0.0 to 1.0,
      "sourceClause": "clause reference or null"
    }
  ],
  "distributionRules": [
    {
      "type": "DISCRETIONARY | PROPORTIONATE | FIXED | STREAMED",
      "description": "plain-English description",
      "allocations": [{ "beneficiaryName": "...", "share": 0.5 }] | null,
      "incomeTypeStreaming": [{ "incomeType": "FRANKED_DIVIDENDS | CAPITAL_GAINS | INTEREST | RENTAL | OTHER", "beneficiaryName": "..." }] | null,
      "confidence": 0.0 to 1.0,
      "sourceClause": "clause reference or null"
    }
  ],
  "vestingDate": "YYYY-MM-DD" | null,
  "trusteePower": {
    "appointor": "name or null",
    "removalRights": "free-text or null",
    "amendmentClause": "free-text or null",
    "vestingPower": "free-text or null",
    "confidence": 0.0 to 1.0
  } | null,
  "loanProvisions": [
    {
      "type": "SUB_TRUST_UPE | PERMITTED_LOAN | PROHIBITED_LOAN",
      "description": "plain-English description",
      "termYears": 7 | null,
      "interestBenchmark": "free-text or null",
      "confidence": 0.0 to 1.0,
      "sourceClause": "clause reference or null"
    }
  ] | null,
  "uncomputedNotes": [
    {
      "id": "uc-1",
      "rationale": "plain-English why this clause was hard to structure",
      "sourceText": "verbatim deed text",
      "sourceClause": "clause reference or null"
    }
  ],
  "overallConfidence": 0.0 to 1.0
}`;

const USER_PROMPT_TEMPLATE = (deedText: string) => `Trust deed text follows. Extract its structural rules per the schema in the system prompt.

---DEED START---
${deedText}
---DEED END---

Return the JSON object now.`;

/**
 * Maximum chars of deed text we send to Gemini per call. Most modern
 * trust deeds are 30-80 pages = 60k-150k chars. Gemini 2.0 Flash
 * supports 1M context which is plenty.
 *
 * For the rare deed > 250k chars, the extractor truncates and adds
 * a global UNCOMPUTED note. Improvement: chunk by clause + merge —
 * deferred to v2 if needed.
 */
const MAX_DEED_CHARS = 250_000;

export interface ExtractTrustDeedInput {
  deedText: string;
  /** Optional model override; defaults to gemini-3.5-flash. */
  model?: GeminiModel;
}

export interface ExtractTrustDeedResult {
  extraction: TrustDeedExtraction;
  extractorVersion: string;
  rawProviderPayload: unknown;
  truncated: boolean;
}

export async function extractTrustDeedRules(
  input: ExtractTrustDeedInput,
): Promise<ExtractTrustDeedResult> {
  let deedText = input.deedText;
  let truncated = false;
  if (deedText.length > MAX_DEED_CHARS) {
    deedText = deedText.slice(0, MAX_DEED_CHARS);
    truncated = true;
  }

  let result;
  try {
    result = await generateGeminiJSONCompletion<unknown>({
      model: input.model ?? 'gemini-3.5-flash',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT_TEMPLATE(deedText),
      // Low temperature — deterministic structural extraction
      temperature: 0.1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini extraction failed';
    if (/api[_ ]?key|GEMINI_API_KEY|not configured/i.test(message)) {
      throw new GeminiExtractionError(
        'Trust-deed parser is not configured (GEMINI_API_KEY unset).',
        'GEMINI_NOT_CONFIGURED',
      );
    }
    throw new GeminiExtractionError(message, 'EXTRACTION_FAILED');
  }

  // Zod-validate before persist. If Gemini returned a malformed shape,
  // reject hard — never let unstructured data into the JSON columns.
  const parsed = TrustDeedExtractionSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new GeminiExtractionError(
      `Gemini response did not match schema: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      'SCHEMA_INVALID',
    );
  }

  // If we truncated the deed, append a global UNCOMPUTED note so the
  // user knows the extraction is partial.
  let extraction = parsed.data;
  if (truncated) {
    const truncationNote: UncomputedNote = {
      id: 'uc-truncation',
      rationale: `Trust deed text exceeded ${MAX_DEED_CHARS} characters; only the first ${MAX_DEED_CHARS} characters were sent to the extractor. Review the full deed manually for any clauses past that boundary.`,
      sourceText: '(truncated)',
      sourceClause: null,
    };
    extraction = {
      ...extraction,
      uncomputedNotes: [...extraction.uncomputedNotes, truncationNote],
    };
  }

  return {
    extraction,
    extractorVersion: EXTRACTOR_VERSION,
    rawProviderPayload: result.data,
    truncated,
  };
}
