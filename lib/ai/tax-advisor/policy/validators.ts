/**
 * Phase 41h.1 — HR-1 / HR-2 / D-2 runtime validator.
 *
 * The validator is the **runtime defence** that complements the
 * type-system defence in 41h.0. It runs after the AI response
 * passes shape validation (Zod schema in `responseSchema.ts`) and
 * before the response reaches the user.
 *
 * What it catches:
 *   - **HR-1 violation**: a `NUMBER_REF` whose path does not resolve
 *     to a `NumericField` in the `ToolSession`. (The AI tried to
 *     emit a fabricated number.)
 *   - **HR-2 violation**: a `CITATION_REF` whose id does not resolve
 *     to an `IdentifiedCitation` in the `ToolSession`. (The AI tried
 *     to cite a fabricated section.)
 *   - **HR-1 leak**: a `TEXT` segment containing bare numbers that
 *     look like financial figures (e.g. "$1,250" or "27%"). Any
 *     financial figure must be a `NUMBER_REF`, not embedded in prose.
 *   - **D-2 leak**: a `TEXT` segment containing recommendation-shaped
 *     verbs ("you should", "I recommend", "transfer to", "salary
 *     sacrifice"). Routing to Tier 2 is the right escape valve;
 *     emitting recommendations as facts is forbidden.
 *   - **UC mismatch**: an `UNCOMPUTED_NOTE` whose `flagId` is not in
 *     the session.
 *
 * The validator returns a structured outcome — never throws — so
 * the gateway can decide how to surface the rejection (block + log,
 * fall back to Tier 2, retry once, etc.).
 */

import {
  findCitationInSession,
  findNumericFieldInSession,
  type ToolSession,
} from '../types';
import type { RawAIResponse, AnswerSegment } from './responseSchema';

/**
 * Recommendation-shaped phrases. If any TEXT segment matches one
 * of these and the response is `TIER_1_FACTS`, the validator flags
 * a D-2 leak — recommendation language must route to Tier 2 (Ask-a-Pro).
 *
 * Curated list — keep tight. Reviewers reject additions that catch
 * legitimate fact-paraphrase ("the cap is $30k" is fine; "you should
 * top up to $30k" is not).
 */
const RECOMMENDATION_PHRASES = [
  /\bi recommend\b/i,
  /\byou should (consider |start |stop |transfer |restructure |sell |buy |refinance |salary sacrifice |contribute )/i,
  /\bmy recommendation\b/i,
  /\bi suggest\b/i,
  /\bwe recommend\b/i,
  /\bour advice\b/i,
  /\bbest course of action\b/i,
  /\bsalary[- ]sacrifice (more|extra|additional)\b/i,
  /\btransfer (it|the property|the asset|this)\b/i,
];

/**
 * Bare numbers that look like financial figures embedded in prose.
 * Catches `$1,250`, `$5k`, `1,250 dollars`, `27%`, `0.5%`, etc.
 *
 * The intent: every monetary figure / rate must be a NUMBER_REF
 * resolved from a tool result. If it appears in TEXT, the AI is
 * authoring a number that didn't come from the calc engine — HR-1.
 *
 * Carve-outs (the regex deliberately ignores):
 *   - Years (e.g. "2024-25") — handled by FY context
 *   - Plain integers under 100 (e.g. "the 4 tests in Sch 2F") —
 *     these are structural counts, not financial figures
 */
const BARE_FINANCIAL_NUMBER = new RegExp(
  [
    // Currency: $1,250 / $5k / $1.5M / $30,000
    /\$[\d,]+(?:\.\d+)?[kKmMbB]?/.source,
    // "1,250 dollars" / "5,000 AUD"
    /\b\d{1,3}(?:,\d{3})+(?:\s*(?:dollars?|AUD))?\b/.source,
    // Standalone large number with comma: "30,000"
    /\b\d{2,3},\d{3}(?:,\d{3})*\b/.source,
    // Percentages: "27%" / "27.5%" / "0.5%"
    /\b\d+(?:\.\d+)?\s*%/.source,
  ].join('|'),
  'g',
);

export interface ValidationIssue {
  code:
    | 'HR1_NUMBER_NOT_IN_SESSION'
    | 'HR1_BARE_FINANCIAL_NUMBER_IN_TEXT'
    | 'HR2_CITATION_NOT_IN_SESSION'
    | 'D2_RECOMMENDATION_LEAK'
    | 'UC_FLAG_NOT_IN_SESSION'
    | 'TIER2_MISSING_ROUTING';
  segmentIndex: number;
  detail: string;
}

export interface ValidationOutcome {
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate an AI response against a tool session. Returns an outcome
 * — never throws. Caller decides how to handle.
 */
export function validateAIResponse(
  response: RawAIResponse,
  session: ToolSession,
): ValidationOutcome {
  const issues: ValidationIssue[] = [];

  // Tier 2 must include routing.
  if (response.tier === 'TIER_2_ROUTE_TO_PRO' && !response.askAProRouting) {
    issues.push({
      code: 'TIER2_MISSING_ROUTING',
      segmentIndex: -1,
      detail: 'Response classified as TIER_2 but no askAProRouting provided.',
    });
  }

  for (let i = 0; i < response.segments.length; i++) {
    const seg = response.segments[i];
    validateSegment(seg, i, response.tier, session, issues);
  }

  return { ok: issues.length === 0, issues };
}

function validateSegment(
  seg: AnswerSegment,
  index: number,
  tier: RawAIResponse['tier'],
  session: ToolSession,
  issues: ValidationIssue[],
): void {
  switch (seg.type) {
    case 'NUMBER_REF': {
      const [toolName, path] = seg.ref.split('#');
      // Find the tool result by toolName, then find the path within it.
      const inv = session.invocations.find((i) => i.toolName === toolName);
      if (!inv) {
        issues.push({
          code: 'HR1_NUMBER_NOT_IN_SESSION',
          segmentIndex: index,
          detail: `NUMBER_REF refers to tool "${toolName}" which was not invoked in this session.`,
        });
        return;
      }
      const found = findNumericFieldInSession(session, path);
      if (!found) {
        issues.push({
          code: 'HR1_NUMBER_NOT_IN_SESSION',
          segmentIndex: index,
          detail: `NUMBER_REF path "${path}" does not exist in any tool result for this session. AI may have fabricated the number.`,
        });
      }
      break;
    }

    case 'CITATION_REF': {
      const found = findCitationInSession(session, seg.ref);
      if (!found) {
        issues.push({
          code: 'HR2_CITATION_NOT_IN_SESSION',
          segmentIndex: index,
          detail: `CITATION_REF "${seg.ref}" does not resolve to any citation in this session. AI may have fabricated a section reference.`,
        });
      }
      break;
    }

    case 'UNCOMPUTED_NOTE': {
      const exists = session.invocations.some((inv) =>
        inv.result.uncomputed.some((u) => u.id === seg.flagId),
      );
      if (!exists) {
        issues.push({
          code: 'UC_FLAG_NOT_IN_SESSION',
          segmentIndex: index,
          detail: `UNCOMPUTED_NOTE flagId "${seg.flagId}" is not present in any tool result.`,
        });
      }
      break;
    }

    case 'TEXT': {
      // HR-1 leak: bare financial numbers embedded in prose.
      const numberMatches = seg.text.match(BARE_FINANCIAL_NUMBER);
      if (numberMatches && numberMatches.length > 0) {
        issues.push({
          code: 'HR1_BARE_FINANCIAL_NUMBER_IN_TEXT',
          segmentIndex: index,
          detail: `TEXT segment contains bare financial number(s): ${numberMatches.join(', ')}. Use NUMBER_REF instead — every monetary figure must come from a tool result.`,
        });
      }

      // D-2 leak: recommendation language in Tier 1.
      if (tier === 'TIER_1_FACTS') {
        for (const re of RECOMMENDATION_PHRASES) {
          if (re.test(seg.text)) {
            issues.push({
              code: 'D2_RECOMMENDATION_LEAK',
              segmentIndex: index,
              detail: `TEXT segment contains recommendation-shaped language matching ${re}. Route recommendation-style questions to TIER_2_ROUTE_TO_PRO.`,
            });
            break;
          }
        }
      }
      break;
    }
  }
}
