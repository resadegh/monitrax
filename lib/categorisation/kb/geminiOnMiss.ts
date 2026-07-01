/**
 * Phase 52 — Gemini-on-miss categorisation (build increment 52.3, RAG).
 *
 * The LAST resort in the precedence chain: only runs when the user's mapping,
 * the curated rules, AND the shared-KB prior all miss. Gemini is given the KB as
 * retrieval context (the valid AU taxonomy + a few graduated merchant→category
 * examples) and asked to classify the de-identified signature. Its answer, once
 * the user confirms it, writes back to the KB via the existing 52.1c hook — so
 * the tail shrinks over time and the LLM is hit less and less.
 *
 * GATED by `KB_GEMINI_ENABLED` (default OFF) for cost control — AI categorisation
 * was cut 2026-05-09 for cost; this brings it back only for the genuine unknown
 * tail. We send the SCRUBBED signature (never raw PII/transfers) to Gemini.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §2, §7 (52.3).
 */

import prisma from '@/lib/db';
import { CATEGORY_HIERARCHY } from '@/lib/tie/types';
import {
  generateGeminiJSONCompletion,
  generateGeminiGroundedText,
  isGeminiConfigured,
} from '@/lib/ai/google/geminiClient';
import { GEMINI_MODELS } from '@/lib/ai/google/modelConfig';
import { scrubToSignature } from './scrubSignature';

/** Cost-control gate — Gemini-on-miss only runs when explicitly enabled. */
export const KB_GEMINI_ENABLED = process.env.KB_GEMINI_ENABLED === 'true';

/**
 * Phase 54.2b — separate gate for the Google-Search-GROUNDED identify step
 * (the "compare online → this looks like Hungry Jacks" pass). Off by default:
 * grounding adds a web-search cost, and enabling it is a CDR-posture decision
 * (a de-identified merchant token egresses to Google Search — same class as the
 * ungrounded Gemini call, never raw PII). See PHASE_54_NEOBRAIN.md §18.
 */
export const KB_GEMINI_GROUNDING_ENABLED = process.env.KB_GEMINI_GROUNDING_ENABLED === 'true';

/** The grounded pass is a LAST resort — only run it when the free/cheap
 * ungrounded pass missed or was below this confidence (bounds web-search cost). */
const GROUNDING_TRIGGER_CONFIDENCE = 0.6;

/** How many graduated KB examples to seed into the prompt (few-shot RAG). */
const KB_EXAMPLE_LIMIT = 12;

export interface GeminiCategoryResult {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  confidence: number;
  source: 'AI';
  /**
   * Phase 54.2b — the merchant NAME a grounded (web-search) identify proposed
   * ("this looks like Hungry Jacks"), for the confirm UI. null/absent on the
   * ungrounded path. An AI result never auto-files (§54.2), so this is always a
   * suggestion the user confirms.
   */
  merchantGuess?: string | null;
  /** True when this result came from the grounded (Google-Search) path. */
  grounded?: boolean;
}

interface GeminiRaw {
  categoryLevel1?: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  confidence?: number;
}

/**
 * Pure prompt builder — the de-identified signature + the valid AU taxonomy +
 * a few graduated KB examples (RAG). Kept pure so it's unit-testable.
 */
export function buildCategorisationPrompt(
  signature: string,
  level1Options: string[],
  examples: { pattern: string; category: string }[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'You categorise Australian bank-transaction merchants into a fixed taxonomy.',
    'Return ONLY JSON: {"categoryLevel1": string, "categoryLevel2": string|null, "subcategory": string|null, "confidence": number}.',
    'categoryLevel1 MUST be one of the allowed values. confidence is 0-1.',
    'If unsure, use a sensible categoryLevel1 with a low confidence — never invent a level1 outside the list.',
  ].join('\n');

  const exampleLines = examples.length
    ? examples.map((e) => `  "${e.pattern}" → ${e.category}`).join('\n')
    : '  (no examples yet)';

  const userPrompt = [
    `Merchant signature: "${signature}"`,
    '',
    `Allowed categoryLevel1 values: ${level1Options.join(', ')}`,
    '',
    'Known merchant → category examples (from the community knowledge base):',
    exampleLines,
    '',
    'Classify the merchant signature.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Classify an unknown description via Gemini (gated). Returns null when disabled,
 * unconfigured, the description scrubs to nothing (PII/transfer), or on any error
 * (caller falls through to the FALLBACK category — never throws into the hot path).
 */
export async function geminiCategoriseOnMiss(rawDescription: string): Promise<GeminiCategoryResult | null> {
  if (!KB_GEMINI_ENABLED || !isGeminiConfigured()) return null;

  // De-identify ONCE at the top — only a scrubbed signature ever reaches the LLM
  // or the web search (never raw PII/transfers). CDR §13.3.
  const scrub = scrubToSignature(rawDescription);
  if (!scrub.ok) return null;

  const ungrounded = await categoriseSignatureUngrounded(scrub.pattern);

  // Phase 54.2b — grounded LAST resort: when the free/cheap ungrounded pass
  // missed or was low-confidence, and grounding is enabled, look the merchant up
  // on the web (de-identified signature only) to propose a merchant NAME +
  // category ("this looks like Hungry Jacks — confirm?"). Never auto-files
  // (source 'AI', §54.2). Any grounding error → keep the ungrounded result.
  if (
    KB_GEMINI_GROUNDING_ENABLED &&
    (!ungrounded || ungrounded.confidence < GROUNDING_TRIGGER_CONFIDENCE)
  ) {
    const grounded = await geminiIdentifyMerchantGrounded(scrub.pattern);
    if (grounded) return grounded;
  }

  return ungrounded;
}

/**
 * The ungrounded pass — RAG over the shared KB, no web search (the original
 * Gemini-on-miss). Takes an ALREADY-de-identified signature. Returns null on any
 * miss/error (caller falls through).
 */
async function categoriseSignatureUngrounded(
  signature: string
): Promise<GeminiCategoryResult | null> {
  const level1Options = Object.keys(CATEGORY_HIERARCHY);
  try {
    const examples = await prisma.transactionSignature.findMany({
      where: { isGlobal: true, topCategory: { not: null } },
      orderBy: { distinctUserCount: 'desc' },
      take: KB_EXAMPLE_LIMIT,
      select: { pattern: true, topCategory: true },
    });

    const { systemPrompt, userPrompt } = buildCategorisationPrompt(
      signature,
      level1Options,
      examples.map((e) => ({ pattern: e.pattern, category: e.topCategory! }))
    );

    const { data } = await generateGeminiJSONCompletion<GeminiRaw>({
      surface: 'categorisation',
      systemPrompt,
      userPrompt,
      model: GEMINI_MODELS.FLASH,
      temperature: 0.1,
    });

    if (!data?.categoryLevel1 || !level1Options.includes(data.categoryLevel1)) return null;

    return {
      categoryLevel1: data.categoryLevel1,
      categoryLevel2: data.categoryLevel2 ?? null,
      subcategory: data.subcategory ?? null,
      confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
      source: 'AI',
    };
  } catch {
    return null; // never break categorisation on an LLM hiccup
  }
}

/**
 * Phase 54.2b — parse the grounded model's answer (TEXT, not JSON mode — grounding
 * is incompatible with `responseMimeType: application/json`). Defensive: strips
 * markdown fences, isolates the first JSON object, validates level1 against the
 * taxonomy. Pure + exported for unit testing. Returns null on any unparseable /
 * invalid output.
 */
export function parseGroundedMerchantResult(
  text: string,
  level1Options: string[]
): GeminiCategoryResult | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let data: GeminiRaw & { merchantName?: string | null };
  try {
    data = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }

  if (!data?.categoryLevel1 || !level1Options.includes(data.categoryLevel1)) return null;

  const merchantGuess =
    typeof data.merchantName === 'string' && data.merchantName.trim().length > 0
      ? data.merchantName.trim()
      : null;

  return {
    categoryLevel1: data.categoryLevel1,
    categoryLevel2: data.categoryLevel2 ?? null,
    subcategory: data.subcategory ?? null,
    confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
    source: 'AI',
    merchantGuess,
    grounded: true,
  };
}

/**
 * Phase 54.2b — grounded merchant identify via the Gemini 2.x `google_search`
 * tool. Sends ONLY the de-identified signature. Gated by
 * KB_GEMINI_GROUNDING_ENABLED. Returns null when disabled/unconfigured or on any
 * error (incl. the pinned SDK not supporting the tool — the caller keeps the
 * ungrounded result, so categorisation never breaks).
 */
export async function geminiIdentifyMerchantGrounded(
  signature: string
): Promise<GeminiCategoryResult | null> {
  if (!KB_GEMINI_GROUNDING_ENABLED || !isGeminiConfigured()) return null;

  const level1Options = Object.keys(CATEGORY_HIERARCHY);
  const systemPrompt = [
    'You identify an Australian merchant from a de-identified bank-statement signature, using web search.',
    'Search the web for the merchant, then return ONLY a JSON object (no markdown, no prose):',
    '{"merchantName": string|null, "categoryLevel1": string, "categoryLevel2": string|null, "subcategory": string|null, "confidence": number}.',
    'categoryLevel1 MUST be exactly one of the allowed values. confidence is 0-1.',
    'If you cannot confidently identify the merchant, set merchantName to null and use a low confidence — never invent a level1 outside the list.',
  ].join('\n');
  const userPrompt = [
    `Merchant signature: "${signature}"`,
    `Allowed categoryLevel1 values: ${level1Options.join(', ')}`,
    'Identify the real-world merchant and classify it.',
  ].join('\n');

  try {
    const { text } = await generateGeminiGroundedText({
      surface: 'categorisation-grounded',
      systemPrompt,
      userPrompt,
      model: GEMINI_MODELS.FLASH,
      temperature: 0.1,
    });
    return parseGroundedMerchantResult(text, level1Options);
  } catch {
    return null; // grounding unsupported / LLM hiccup → fall back to ungrounded
  }
}
