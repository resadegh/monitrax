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
import { generateGeminiJSONCompletion, isGeminiConfigured, GEMINI_MODELS } from '@/lib/ai/gemini';
import { scrubToSignature } from './scrubSignature';

/** Cost-control gate — Gemini-on-miss only runs when explicitly enabled. */
export const KB_GEMINI_ENABLED = process.env.KB_GEMINI_ENABLED === 'true';

/** How many graduated KB examples to seed into the prompt (few-shot RAG). */
const KB_EXAMPLE_LIMIT = 12;

export interface GeminiCategoryResult {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  confidence: number;
  source: 'AI';
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

  // Only send a de-identified signature to the LLM — never raw PII/transfers.
  const scrub = scrubToSignature(rawDescription);
  if (!scrub.ok) return null;

  const level1Options = Object.keys(CATEGORY_HIERARCHY);

  try {
    const examples = await prisma.transactionSignature.findMany({
      where: { isGlobal: true, topCategory: { not: null } },
      orderBy: { distinctUserCount: 'desc' },
      take: KB_EXAMPLE_LIMIT,
      select: { pattern: true, topCategory: true },
    });

    const { systemPrompt, userPrompt } = buildCategorisationPrompt(
      scrub.pattern,
      level1Options,
      examples.map((e) => ({ pattern: e.pattern, category: e.topCategory! }))
    );

    const { data } = await generateGeminiJSONCompletion<GeminiRaw>({
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
