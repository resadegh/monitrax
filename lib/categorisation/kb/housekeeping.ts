/**
 * Phase 52 — KB housekeeping (build increment 52.4-housekeeping).
 *
 * Keeps the shared categorisation KB lean + useful as it grows (Reza Q,
 * 2026-06-22). The shared `TransactionSignature` table is bounded by the count
 * of distinct merchants, but the long tail of low-value PROVISIONAL patterns
 * (sub-k, seen once, never reinforced — typos, odd refs that escaped
 * normalisation) is the bloat risk. This job prunes that tail and emits health
 * metrics. Run by GCP Cloud Scheduler via the cron endpoint.
 *
 * Graduated (`isGlobal`) patterns are NEVER pruned. See
 * docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §6b.
 */

import prisma from '@/lib/db';
import { KB_GRADUATION_K } from './recordContribution';

/** Provisional patterns not reinforced within this window are pruned. */
export const KB_STALE_PROVISIONAL_MONTHS = 12;

/**
 * Pure predicate: is this a stale, low-value provisional safe to prune?
 * Graduated or near-graduation patterns are always kept.
 */
export function isStaleProvisional(
  sig: { isGlobal: boolean; distinctUserCount: number; lastConfirmedAt: Date },
  now: Date,
  staleMonths: number = KB_STALE_PROVISIONAL_MONTHS,
  k: number = KB_GRADUATION_K
): boolean {
  if (sig.isGlobal) return false; // graduated → keep indefinitely
  if (sig.distinctUserCount >= k) return false; // already at/over threshold → keep
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - staleMonths);
  return sig.lastConfirmedAt < cutoff;
}

export interface KbHealthReport {
  totalSignatures: number;
  globalSignatures: number;
  provisionalSignatures: number;
  prunedStaleProvisionals: number;
  ranAt: string;
}

/**
 * Prune stale provisionals + return a KB-health snapshot. Idempotent.
 *
 * §12.11: the deleteMany is guarded to `isGlobal:false` (never a shared/graduated
 * pattern) AND `distinctUserCount < k` (low value) AND not reinforced within the
 * stale window. It removes only de-identified, low-value provisional aggregate
 * rows (no user-owned financial data; the few cascade-deleted contributions are
 * for a dead pattern). Intended, bounded cleanup.
 */
export async function runKbHousekeeping(now: Date = new Date()): Promise<KbHealthReport> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - KB_STALE_PROVISIONAL_MONTHS);

  const pruned = await prisma.transactionSignature.deleteMany({
    where: {
      isGlobal: false,
      distinctUserCount: { lt: KB_GRADUATION_K },
      lastConfirmedAt: { lt: cutoff },
    },
  });

  const [total, global] = await Promise.all([
    prisma.transactionSignature.count(),
    prisma.transactionSignature.count({ where: { isGlobal: true } }),
  ]);

  return {
    totalSignatures: total,
    globalSignatures: global,
    provisionalSignatures: total - global,
    prunedStaleProvisionals: pruned.count,
    ranAt: now.toISOString(),
  };
}
