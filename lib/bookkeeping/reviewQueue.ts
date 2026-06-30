/**
 * SSOT for the "needs your review" transaction set (Phase 56.3, 2026-06-30).
 *
 * Reza directive 2026-06-30: "anything the user has not confirmed" counts as
 * needing review — high-confidence rows are auto-categorised but STILL need a
 * user confirm — and the count is **all-time** (no rolling window). One number,
 * everywhere: Home hero, the Activity bands, and the card-deck all read THIS.
 *
 * Root cause it fixes (the SSOT violation Reza reported): the same concept was
 * computed three different ways —
 *   - Home "78"   : `pendingActions.ts`, 60-day window + this filter
 *   - Activity 365: `bulkConfirm.getConfidenceSummary`, ALL-TIME confidence
 *                   bands mixing booked txns + the import-review queue
 *   - the deck    : `!categoryLevel1` on the current paginated page
 * → three different populations, three different numbers. This module is the
 * single canonical definition; the surfaces import it instead of re-deriving.
 *
 * The canonical "needs you" predicate (identical to the Activity list route's
 * `uncategorized=true` filter — `app/api/unified-transactions/route.ts` ~§101,
 * the SSOT for "what the user sees as uncategorised"):
 *   - not linked to an Income / Expense / Loan entity
 *   - not a transfer (matches `false` OR legacy `null`)
 *   - not an investment contribution (same nullable handling)
 *   - `userCorrectedCategory != true` — the user hasn't confirmed it yet
 *     (AI-auto-classified rows are included until the user confirms them).
 *
 * The deck itself fetches its transactions via that same list route (so it
 * reuses the merchant-suggestion enrichment + account include — no duplicate
 * query); this module owns the COUNT + the confidence BANDS so every headline
 * agrees. Bands partition the SAME set, so high + medium + low === total.
 */

import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * The canonical "needs your review" filter FIELDS — compose under a `userId`.
 * Kept field-only so callers that build a `where` incrementally can spread it.
 * Mirrors `app/api/unified-transactions/route.ts` `uncategorized=true`.
 */
export const REVIEW_QUEUE_FIELDS = {
  incomeId: null,
  expenseId: null,
  loanId: null,
  isTransfer: { not: true },
  isInvestmentContribution: { not: true },
  userCorrectedCategory: { not: true },
} satisfies Prisma.UnifiedTransactionWhereInput;

/** The canonical `where` for one user's review queue (all-time). */
export function reviewQueueWhere(userId: string): Prisma.UnifiedTransactionWhereInput {
  return { userId, ...REVIEW_QUEUE_FIELDS };
}

/** The one canonical count of transactions needing the user's review. */
export async function getReviewQueueCount(userId: string): Promise<number> {
  return prisma.unifiedTransaction.count({ where: reviewQueueWhere(userId) });
}

export interface ReviewQueueBands {
  /** AI is confident (≥0.9) but the user hasn't confirmed → one-tap Confirm. */
  high: number;
  /** Medium confidence (0.7–0.9). */
  medium: number;
  /** Low confidence (<0.7) or no score yet → needs a real look. */
  low: number;
  /** high + medium + low — every row lands in exactly one band. */
  total: number;
}

/**
 * The review queue partitioned by AI confidence. Because every row in the
 * canonical set has a score in exactly one band (null → low), the three bands
 * sum to the total — so the chips can never disagree with the headline again.
 */
export async function getReviewQueueBands(userId: string): Promise<ReviewQueueBands> {
  const base = reviewQueueWhere(userId);
  const [total, high, medium, low] = await Promise.all([
    prisma.unifiedTransaction.count({ where: base }),
    prisma.unifiedTransaction.count({ where: { ...base, confidenceScore: { gte: 0.9 } } }),
    prisma.unifiedTransaction.count({ where: { ...base, confidenceScore: { gte: 0.7, lt: 0.9 } } }),
    prisma.unifiedTransaction.count({
      where: { ...base, OR: [{ confidenceScore: { lt: 0.7 } }, { confidenceScore: null }] },
    }),
  ]);
  return { high, medium, low, total };
}
