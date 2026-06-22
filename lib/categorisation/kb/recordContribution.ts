/**
 * Phase 52 — knowledge-base write-back (build increment 52.1b).
 *
 * `recordContribution()` is called when a user confirms/corrects a category. It:
 *   1. de-identifies the description via `scrubToSignature()` (rejects PII/transfers),
 *   2. upserts the shared `TransactionSignature` (dedup on `(region,pattern,matchType)`),
 *   3. upserts the user's PRIVATE `SignatureContribution` (one revisable vote),
 *   4. updates the aggregate vote tally + `distinctUserCount` + graduation (`isGlobal` at k),
 *      INCREMENTALLY (O(1) — no full ledger scan, so it scales).
 *
 * GATED OFF by default (`KB_WRITE_ENABLED`) until the written de-identification
 * procedure is signed off (the Phase 52 build gate). Consumption of the shared
 * prior in categorisation is a later increment (52.2).
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §4.1, §5, §6b.
 */

import prisma from '@/lib/db';
import { SignatureMatchType, SignatureSource } from '@prisma/client';
import { scrubToSignature } from './scrubSignature';

/** Cross-user graduation threshold (k-anonymity). */
export const KB_GRADUATION_K = 5;

/** Build gate — no cross-user write happens unless explicitly enabled. */
export const KB_WRITE_ENABLED = process.env.KB_WRITE_ENABLED === 'true';

/** Cap the stored vote distribution to the top-N categories + drop the tail (anti-bloat). */
const TOP_N = 6;

export type VoteMap = Record<string, number>;

/** Pure: apply a single user's vote change to the tally, capped to top-N. */
export function applyVoteDelta(votes: VoteMap, oldCategory: string | null, newCategory: string): VoteMap {
  const v: VoteMap = { ...votes };
  if (oldCategory && v[oldCategory]) {
    v[oldCategory] -= 1;
    if (v[oldCategory] <= 0) delete v[oldCategory];
  }
  v[newCategory] = (v[newCategory] ?? 0) + 1;
  const top = Object.entries(v)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N);
  return Object.fromEntries(top);
}

/** Pure: derive the denormalised summary fields from a tally + distinct-user count. */
export function summariseVotes(votes: VoteMap, distinctUserCount: number, k: number = KB_GRADUATION_K) {
  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const top = entries[0];
  return {
    topCategory: top ? top[0] : null,
    confidence: top && total > 0 ? top[1] / total : 0,
    isGlobal: distinctUserCount >= k,
  };
}

export type RecordResult =
  | { ok: false; skipped: 'disabled' | 'scrubbed'; reason?: string }
  | { ok: true; signatureId: string; isGlobal: boolean; distinctUserCount: number; changed: boolean };

/**
 * Record a user's categorisation into the knowledge base (gated OFF by default).
 */
export async function recordContribution(args: {
  userId: string;
  rawDescription: string;
  category: string;
  mcc?: string | null;
  region?: string;
}): Promise<RecordResult> {
  if (!KB_WRITE_ENABLED) return { ok: false, skipped: 'disabled' };

  const scrub = scrubToSignature(args.rawDescription);
  if (!scrub.ok) return { ok: false, skipped: 'scrubbed', reason: scrub.reason };

  const region = args.region ?? 'AU';
  const matchType = SignatureMatchType.EXACT;

  return prisma.$transaction(async (tx) => {
    const sig = await tx.transactionSignature.upsert({
      where: { region_pattern_matchType: { region, pattern: scrub.pattern, matchType } },
      create: {
        region,
        pattern: scrub.pattern,
        matchType,
        mcc: args.mcc ?? null,
        source: SignatureSource.USER_CONFIRMED,
      },
      update: { lastConfirmedAt: new Date(), ...(args.mcc ? { mcc: args.mcc } : {}) },
    });

    const existing = await tx.signatureContribution.findUnique({
      where: { signatureId_userId: { signatureId: sig.id, userId: args.userId } },
      select: { category: true },
    });
    const oldCategory = existing?.category ?? null;

    // No change → nothing to re-tally.
    if (oldCategory === args.category) {
      return { ok: true as const, signatureId: sig.id, isGlobal: sig.isGlobal, distinctUserCount: sig.distinctUserCount, changed: false };
    }

    const newVotes = applyVoteDelta((sig.categoryVotes as VoteMap) ?? {}, oldCategory, args.category);
    const newDistinct = sig.distinctUserCount + (existing ? 0 : 1);
    const summary = summariseVotes(newVotes, newDistinct);

    await tx.signatureContribution.upsert({
      where: { signatureId_userId: { signatureId: sig.id, userId: args.userId } },
      create: { signatureId: sig.id, userId: args.userId, category: args.category },
      update: { category: args.category },
    });

    await tx.transactionSignature.update({
      where: { id: sig.id },
      data: {
        categoryVotes: newVotes,
        distinctUserCount: newDistinct,
        topCategory: summary.topCategory,
        confidence: summary.confidence,
        isGlobal: summary.isGlobal,
      },
    });

    return { ok: true as const, signatureId: sig.id, isGlobal: summary.isGlobal, distinctUserCount: newDistinct, changed: true };
  });
}
