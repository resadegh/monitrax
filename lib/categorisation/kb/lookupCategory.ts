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
 * Pure: is `pattern` a whole-token leading prefix of `query`?
 * "WOOLWORTHS" is a token-prefix of "WOOLWORTHS METRO" (brand + suffix) but NOT
 * of "WOOLWORTHSX" (same-token bleed) — the space boundary prevents false hits,
 * and "APPLE MUSIC" is not a prefix of "APPLE STORE" (different second token).
 */
export function isTokenPrefix(pattern: string, query: string): boolean {
  return query === pattern || query.startsWith(pattern + ' ');
}

/** Pure: pick the LONGEST (most specific) candidate that is a token-prefix of the query. */
export function pickPrefixMatch<T extends { pattern: string }>(query: string, candidates: T[]): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (isTokenPrefix(c.pattern, query) && (!best || c.pattern.length > best.pattern.length)) best = c;
  }
  return best;
}

/**
 * Look up the shared-KB category for a raw description (gated; graduated patterns only).
 * Two passes: (1) EXACT normalised-signature match, then (2) a deterministic fuzzy
 * fallback — the longest graduated pattern that is a whole-token leading prefix of the
 * signature (handles "BRAND + store/location suffix", the dominant AU feed shape).
 * Embeddings (52.5b) extend this to non-prefix variants ("WW METRO" → "WOOLWORTHS").
 */
export async function lookupSharedCategory(rawDescription: string, region = 'AU'): Promise<KbMatch | null> {
  if (!KB_READ_ENABLED) return null;

  const scrub = scrubToSignature(rawDescription);
  if (!scrub.ok) return null;

  // 1. Exact signature match.
  const exact = await prisma.transactionSignature.findUnique({
    where: { region_pattern_matchType: { region, pattern: scrub.pattern, matchType: SignatureMatchType.EXACT } },
    select: { pattern: true, topCategory: true, confidence: true, distinctUserCount: true, isGlobal: true },
  });
  const exactMatch = interpretSignature(exact);
  if (exactMatch) return exactMatch;

  // 2. Fuzzy fallback: longest graduated pattern that is a token-prefix of the signature.
  //    `$1 LIKE pattern || ' %'` finds patterns that are a strict leading-token prefix;
  //    patterns are alphanumeric (no LIKE wildcards), so this is injection/wildcard-safe.
  const rows = await prisma.$queryRaw<
    { pattern: string; topCategory: string | null; confidence: number; distinctUserCount: number; isGlobal: boolean }[]
  >`
    SELECT pattern, "topCategory", confidence, "distinctUserCount", "isGlobal"
    FROM transaction_signatures
    WHERE region = ${region}
      AND "matchType" = 'EXACT'
      AND "isGlobal" = true
      AND "topCategory" IS NOT NULL
      AND ${scrub.pattern} LIKE pattern || ' %'
    ORDER BY length(pattern) DESC
    LIMIT 1
  `;
  return interpretSignature(rows[0] ?? null);
}
