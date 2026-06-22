/**
 * Phase 52 — shared-KB category lookup (build increment 52.2, read path).
 *
 * The lookup-first primitive: de-identify the description to a signature, look it
 * up in the shared knowledge base, and return the community category ONLY if the
 * pattern has **graduated** (`isGlobal`, i.e. ≥k distinct users) AND is confident
 * enough. A miss returns null → the caller falls through to rules / (later)
 * Gemini-on-miss.
 *
 * GATED by `KB_READ_ENABLED` (default OFF) for controlled rollout — and harmless
 * even when on, since nothing has graduated until writes are enabled. Wiring this
 * into `categoriseTransaction` (with canonical-category → level resolution) is
 * increment 52.2b.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §2, §6.
 */

import prisma from '@/lib/db';
import { SignatureMatchType } from '@prisma/client';
import { scrubToSignature } from './scrubSignature';

/** Read-path rollout gate. */
export const KB_READ_ENABLED = process.env.KB_READ_ENABLED === 'true';

/** Minimum dominant-share confidence before the shared prior is used. */
export const KB_MIN_CONFIDENCE = 0.6;

export interface KbMatch {
  pattern: string;
  category: string; // the community's dominant category for this pattern
  confidence: number;
  distinctUserCount: number;
}

/**
 * Pure gating: turn a fetched signature into a usable match, or null. Only
 * graduated (`isGlobal`) patterns above the confidence floor are usable.
 */
export function interpretSignature(
  sig: { pattern: string; topCategory: string | null; confidence: number; distinctUserCount: number; isGlobal: boolean } | null,
  minConfidence: number = KB_MIN_CONFIDENCE
): KbMatch | null {
  if (!sig || !sig.isGlobal || !sig.topCategory) return null;
  if (sig.confidence < minConfidence) return null;
  return { pattern: sig.pattern, category: sig.topCategory, confidence: sig.confidence, distinctUserCount: sig.distinctUserCount };
}

/**
 * Look up the shared-KB category for a raw description (gated; graduated patterns only).
 */
export async function lookupSharedCategory(rawDescription: string, region = 'AU'): Promise<KbMatch | null> {
  if (!KB_READ_ENABLED) return null;

  const scrub = scrubToSignature(rawDescription);
  if (!scrub.ok) return null;

  const sig = await prisma.transactionSignature.findUnique({
    where: { region_pattern_matchType: { region, pattern: scrub.pattern, matchType: SignatureMatchType.EXACT } },
    select: { pattern: true, topCategory: true, confidence: true, distinctUserCount: true, isGlobal: true },
  });

  return interpretSignature(sig);
}
