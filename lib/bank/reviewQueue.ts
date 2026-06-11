/**
 * Transaction review-queue confirmation — canonical service.
 *
 * Extracted from app/api/accounts/[id]/import/[batchId]/review/route.ts
 * (Phase 49, 2026-06-11) so BOTH the per-batch review route AND the
 * Activity-page "AI bookkeeper" bulk-confirm path share one implementation
 * (CLAUDE.md §12.3 — no competing copies of the create+learn logic).
 *
 * Background: the QIF/CSV import routes auto-accepted predictions (≥0.9)
 * straight to UnifiedTransaction, but medium (0.7–0.9) and low (<0.7)
 * predictions are parked in TransactionReviewQueue. Confirming a queue item
 * is what promotes it into a real UnifiedTransaction and feeds the Phase 13
 * merchant-learning loop.
 */

import prisma from '@/lib/db';
import { ImportReviewStatus, TransactionSource, type TransactionReviewQueue } from '@prisma/client';
import {
  processUserConfirmation,
  type LearningContext,
  type CategoryPrediction,
  type UserConfirmation,
} from '@/lib/bank/aiCategorisation';

// Confidence band → the queue's `confidenceLevel` tag (set at import time by
// classifyByConfidence). Kept here next to the queue logic so band semantics
// have one home (mirrors lib/bank/bulkConfirm.ts).
export type ReviewBand = 'medium' | 'low';
const BAND_TO_LEVEL: Record<ReviewBand, string> = {
  medium: 'NEEDS_REVIEW',
  low: 'MANUAL',
};

export interface ReviewQueueListItem {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  merchant: string | null;
  aiCategoryLevel1: string | null;
  aiCategoryLevel2: string | null;
  aiConfidence: number;
  band: ReviewBand;
}

/**
 * List PENDING review-queue items for a confidence band (cross-batch).
 * Powers the Activity-page "review before confirm" surfaces.
 */
export async function listReviewQueueByBand(
  userId: string,
  band: ReviewBand,
  limit = 200
): Promise<ReviewQueueListItem[]> {
  const rows = await prisma.transactionReviewQueue.findMany({
    where: { userId, status: ImportReviewStatus.PENDING, confidenceLevel: BAND_TO_LEVEL[band] },
    orderBy: { aiConfidence: 'desc' },
    take: limit,
  });

  return rows.map((r) => {
    const t = r.tempData as {
      date?: string;
      amount?: number;
      direction?: 'IN' | 'OUT';
      description?: string;
      merchantStandardised?: string;
      merchantRaw?: string;
    };
    return {
      id: r.id,
      date: t.date ?? '',
      amount: t.amount ?? 0,
      direction: t.direction ?? 'OUT',
      description: t.description ?? '',
      merchant: t.merchantStandardised ?? t.merchantRaw ?? null,
      aiCategoryLevel1: r.aiCategoryLevel1,
      aiCategoryLevel2: r.aiCategoryLevel2,
      aiConfidence: r.aiConfidence,
      band,
    };
  });
}

/**
 * Skip (dismiss) PENDING review-queue items by id. No transaction is created;
 * the row is marked SKIPPED so it leaves the band's pending count.
 * §12.11: scoped to the caller's own PENDING rows.
 */
export async function skipReviewItems(userId: string, ids: string[]): Promise<{ skippedCount: number }> {
  if (ids.length === 0) return { skippedCount: 0 };
  const res = await prisma.transactionReviewQueue.updateMany({
    where: { userId, status: ImportReviewStatus.PENDING, id: { in: ids.slice(0, 500) } },
    data: { status: ImportReviewStatus.SKIPPED, reviewedAt: new Date() },
  });
  return { skippedCount: res.count };
}

/**
 * Edit-and-file a single PENDING review-queue item with a user-corrected
 * category (Phase 49.5 — "the AI got it wrong"). Creates the transaction with
 * the corrected triple and feeds the stronger USER_CORRECTION learning signal
 * via the shared confirmReviewItem('EDIT') path.
 */
export async function editReviewItem(
  userId: string,
  id: string,
  values: ReviewItemValues
): Promise<{ transactionId: string | null }> {
  const item = await prisma.transactionReviewQueue.findFirst({
    where: { id, userId, status: ImportReviewStatus.PENDING },
  });
  if (!item) throw new Error('Review item not found or already actioned');
  const result = await confirmReviewItem(userId, null, item.importBatchId, item, 'EDIT', values, false);
  return { transactionId: result.transactionId };
}

export interface ReviewItemValues {
  categoryLevel1: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  isEssential?: boolean;
  isRecurring?: boolean;
  /** Phase 49.9 — file the item as a transfer between own accounts. */
  isTransfer?: boolean;
}

/**
 * Confirm / edit / skip a single review-queue item.
 *  - CONFIRM: accept the AI's prediction as-is → create UnifiedTransaction.
 *  - EDIT:    apply user-supplied values → create UnifiedTransaction
 *             (userCorrectedCategory=true).
 *  - SKIP:    mark the queue row SKIPPED; no transaction created.
 *
 * `accountId` may be null — when so it is resolved from the queue item's
 * importBatch (the bulk-confirm path doesn't carry an account in scope).
 */
export async function confirmReviewItem(
  userId: string,
  accountId: string | null,
  batchId: string | null,
  item: TransactionReviewQueue,
  action: 'CONFIRM' | 'EDIT' | 'SKIP',
  values: ReviewItemValues | null,
  applyToSimilar: boolean
): Promise<{ similarUpdated: number; transactionId: string | null }> {
  if (!item) throw new Error('Review item is null');

  if (action === 'SKIP') {
    await prisma.transactionReviewQueue.update({
      where: { id: item.id },
      data: { status: ImportReviewStatus.SKIPPED, reviewedAt: new Date() },
    });
    return { similarUpdated: 0, transactionId: null };
  }

  const txData = item.tempData as {
    date: string;
    amount: number;
    direction: 'IN' | 'OUT';
    description: string;
    merchantRaw?: string;
    merchantStandardised?: string;
    hash: string;
  };

  // Resolve the account: prefer the explicit arg, else the batch's account.
  let resolvedAccountId = accountId;
  const resolvedBatchId = batchId ?? item.importBatchId;
  if (!resolvedAccountId && resolvedBatchId) {
    const batch = await prisma.importBatch.findUnique({
      where: { id: resolvedBatchId },
      select: { accountId: true },
    });
    resolvedAccountId = batch?.accountId ?? null;
  }
  if (!resolvedAccountId) {
    throw new Error(`Cannot resolve account for review item ${item.id}`);
  }

  const wasEdited = action === 'EDIT';
  const finalValues: ReviewItemValues = wasEdited && values
    ? values
    : {
        categoryLevel1: item.aiCategoryLevel1 || 'Other',
        categoryLevel2: item.aiCategoryLevel2,
        subcategory: item.aiSubcategory,
        isEssential: item.aiIsEssential,
        isRecurring: item.aiIsRecurring,
      };

  const transaction = await prisma.unifiedTransaction.create({
    data: {
      userId,
      accountId: resolvedAccountId,
      date: new Date(txData.date),
      amount: txData.amount,
      direction: txData.direction,
      description: txData.description,
      merchantRaw: txData.merchantRaw,
      merchantStandardised: txData.merchantStandardised,
      categoryLevel1: finalValues.categoryLevel1,
      categoryLevel2: finalValues.categoryLevel2,
      subcategory: finalValues.subcategory,
      isEssential: finalValues.isEssential || false,
      isRecurring: finalValues.isRecurring || false,
      userCorrectedCategory: wasEdited,
      isTransfer: finalValues.isTransfer ?? false,
      // Confirming = user validated → promote to 1.0 (same convention the
      // bulk-categorise route writes; keeps confirmed rows out of the
      // "uncertain" surfaces).
      confidenceScore: 1.0,
      source: TransactionSource.QIF,
      importBatchId: resolvedBatchId,
    },
  });

  await prisma.transactionReviewQueue.update({
    where: { id: item.id },
    data: {
      transactionId: transaction.id,
      status: wasEdited ? ImportReviewStatus.USER_EDITED : ImportReviewStatus.USER_CONFIRMED,
      userCategoryLevel1: finalValues.categoryLevel1,
      userCategoryLevel2: finalValues.categoryLevel2,
      userSubcategory: finalValues.subcategory,
      userIsEssential: finalValues.isEssential,
      userIsRecurring: finalValues.isRecurring,
      applyToSimilar,
      reviewedAt: new Date(),
    },
  });

  const context: LearningContext = {
    merchantRaw: txData.merchantRaw,
    merchantStandardised: txData.merchantStandardised,
    description: txData.description,
    amount: txData.amount,
    direction: txData.direction,
  };

  const aiPrediction: CategoryPrediction = {
    categoryLevel1: item.aiCategoryLevel1 || 'Other',
    categoryLevel2: item.aiCategoryLevel2,
    subcategory: item.aiSubcategory,
    isEssential: item.aiIsEssential,
    isRecurring: item.aiIsRecurring,
    suggestedFrequency: null,
    confidence: item.aiConfidence,
  };

  const userConfirmation: UserConfirmation = {
    categoryLevel1: finalValues.categoryLevel1,
    categoryLevel2: finalValues.categoryLevel2 || null,
    subcategory: finalValues.subcategory || null,
    isEssential: finalValues.isEssential || false,
    isRecurring: finalValues.isRecurring || false,
    suggestedFrequency: null,
    confidence: wasEdited ? 1.0 : item.aiConfidence,
    wasEdited,
    applyToSimilar,
  };

  const learningResult = await processUserConfirmation(
    userId,
    transaction.id,
    context,
    aiPrediction,
    userConfirmation
  );

  return { similarUpdated: learningResult.similarUpdated, transactionId: transaction.id };
}
