/**
 * Confidence-based bulk confirmation of AI categorisations.
 *
 * Canonical service for the Activity page "AI bookkeeper" card (Phase 49 —
 * Activity redesign, 2026-06-11).
 *
 * Where the bands actually live (this is the crux):
 *   - HIGH (≥0.9) predictions are auto-accepted at import time and already
 *     exist as UnifiedTransaction rows. Nothing to confirm — counted only
 *     for the celebratory "N auto-filed" chip.
 *   - MEDIUM (0.7–0.9) and LOW (<0.7) predictions are parked in
 *     TransactionReviewQueue (status PENDING) and are NOT yet real
 *     transactions. Confirming them is what promotes each into a
 *     UnifiedTransaction (via the shared confirmReviewItem service) and
 *     feeds the Phase 13 merchant-learning loop.
 *
 * This finally gives TransactionReviewQueue a user-facing surface (it was
 * backend-only staging with no UI — the §12.1 "🗑️ row 31" debt).
 *
 * Confirmation accepts the AI's prediction as-is. Corrections still go
 * through PATCH /api/unified-transactions/[id] or bulk-categorise.
 */

import prisma from '@/lib/db';
import { ImportReviewStatus } from '@prisma/client';
import { confirmReviewItem } from '@/lib/bank/reviewQueue';

export type ConfidenceBand = 'medium' | 'low';

export interface ConfidenceSummary {
  /** Auto-accepted at import (UnifiedTransaction, confidence ≥ 0.9). */
  high: number;
  /**
   * Phase 49.13 — the subset of `high` the user hasn't confirmed yet
   * (userCorrectedCategory != true). Auto-filed is not the same as
   * confirmed: these rows still count toward the Home "to categorise"
   * pile until the user signs them off. Powers "Confirm all N high".
   */
  highUnconfirmed: number;
  /** Review-queue PENDING, NEEDS_REVIEW band (0.7–0.9). Bulk-confirm sweet spot. */
  medium: number;
  /** Review-queue PENDING, MANUAL band (<0.7). */
  low: number;
}

const BAND_TO_LEVEL: Record<ConfidenceBand, string> = {
  medium: 'NEEDS_REVIEW',
  low: 'MANUAL',
};

/** Hard cap per call — sized for one import's worth of review items. */
const MAX_CONFIRM = 500;

export async function getConfidenceSummary(userId: string): Promise<ConfidenceSummary> {
  const [high, highUnconfirmed, medium, low] = await Promise.all([
    prisma.unifiedTransaction.count({
      where: { userId, categoryLevel1: { not: null }, confidenceScore: { gte: 0.9 } },
    }),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        categoryLevel1: { not: null },
        confidenceScore: { gte: 0.9 },
        userCorrectedCategory: { not: true },
      },
    }),
    prisma.transactionReviewQueue.count({
      where: { userId, status: ImportReviewStatus.PENDING, confidenceLevel: 'NEEDS_REVIEW' },
    }),
    prisma.transactionReviewQueue.count({
      where: { userId, status: ImportReviewStatus.PENDING, confidenceLevel: 'MANUAL' },
    }),
  ]);

  return { high, highUnconfirmed, medium, low };
}

/**
 * Phase 49.13 — bulk-confirm the HIGH band (Reza, live test 2026-06-11:
 * "there are 1284 high confidence auto filled, but I think they are not
 * confirmed yet, and I don't have an option to do a bulk catagorising for
 * high confidence").
 *
 * High-band rows are already real UnifiedTransactions (auto-accepted at
 * import) — confirming them is a flag promotion, not a queue promotion:
 * confidenceScore → 1.0 + userCorrectedCategory → true, the exact
 * convention the single-row PATCH path and bulk-categorise write. This
 * drops them out of the Home "to categorise" pending pile.
 *
 * Deliberately NO per-merchant learning pass here: the AI was already
 * ≥0.9 on these merchants, so a blanket confirm adds no signal worth the
 * N× write cost. Corrections (the strong signal) still flow through the
 * per-row PATCH path.
 *
 * CLAUDE.md §12.11 (updateMany on existing rows):
 *  1. `where` matches: the caller's OWN AI-categorised transactions at
 *     confidence ≥ 0.9 that the user has NOT already reviewed
 *     (userCorrectedCategory != true). This is exactly the set the
 *     "Confirm all N high" button displays — and the click IS the user's
 *     explicit confirmation of that set.
 *  2. Columns overwritten: `confidenceScore` (AI-derived diagnostic,
 *     0.9–1.0 → 1.0) and `userCorrectedCategory` (false → true). No
 *     user-entered column (category, amount, description, links) is
 *     touched.
 *  3. Guard: `userCorrectedCategory: { not: true }` ensures rows the user
 *     already reviewed/corrected are never re-written.
 */
export async function bulkConfirmHighBand(userId: string): Promise<BulkConfirmResult> {
  const res = await prisma.unifiedTransaction.updateMany({
    where: {
      userId,
      categoryLevel1: { not: null },
      confidenceScore: { gte: 0.9 },
      userCorrectedCategory: { not: true },
    },
    data: { confidenceScore: 1.0, userCorrectedCategory: true },
  });
  return { confirmedCount: res.count, failedCount: 0 };
}

export interface BulkConfirmResult {
  confirmedCount: number;
  /** Review-queue ids that failed to confirm (surfaced for diagnostics). */
  failedCount: number;
}

/**
 * Confirm AI categorisations in bulk — a whole confidence band, or an explicit
 * review-queue id list (the per-item "✓ Looks right" affordance sends a
 * single id). Each confirmation creates the UnifiedTransaction and runs the
 * Phase 13 learning via the shared confirmReviewItem service.
 *
 * CLAUDE.md §12.11: the where clause is scoped to the caller's own PENDING
 * queue rows in the named band — no user-entered transaction data is reachable
 * (these rows are not yet transactions). Each confirm is independent; one
 * failure does not abort the batch.
 */
export async function bulkConfirmCategorisations(
  userId: string,
  input: { band?: ConfidenceBand; reviewItemIds?: string[] }
): Promise<BulkConfirmResult> {
  const where = input.reviewItemIds?.length
    ? {
        userId,
        status: ImportReviewStatus.PENDING,
        id: { in: input.reviewItemIds.slice(0, MAX_CONFIRM) },
      }
    : {
        userId,
        status: ImportReviewStatus.PENDING,
        confidenceLevel: input.band ? BAND_TO_LEVEL[input.band] : undefined,
      };

  const items = await prisma.transactionReviewQueue.findMany({
    where,
    take: MAX_CONFIRM,
  });

  let confirmedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      // accountId/batchId resolved from the item's importBatch inside the service.
      await confirmReviewItem(userId, null, item.importBatchId, item, 'CONFIRM', null, false);
      confirmedCount++;
    } catch (err) {
      failedCount++;
      console.error(
        `[bulkConfirm] review item ${item.id} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Roll up batch counters for any batches we touched (keeps the import
  // batch's status/confirmed counts honest; mirrors the per-batch route).
  const touchedBatchIds = Array.from(
    new Set(items.map((i) => i.importBatchId).filter((b): b is string => !!b))
  );
  for (const batchId of touchedBatchIds) {
    const [confirmed, remainingPending] = await Promise.all([
      prisma.transactionReviewQueue.count({
        where: {
          importBatchId: batchId,
          userId,
          status: { in: [ImportReviewStatus.USER_CONFIRMED, ImportReviewStatus.USER_EDITED] },
        },
      }),
      prisma.transactionReviewQueue.count({
        where: { importBatchId: batchId, userId, status: ImportReviewStatus.PENDING },
      }),
    ]);
    await prisma.importBatch
      .update({
        where: { id: batchId },
        data: {
          userConfirmedCount: confirmed,
          ...(remainingPending === 0 ? { processingCompletedAt: new Date() } : {}),
        },
      })
      .catch(() => {});
  }

  return { confirmedCount, failedCount };
}
