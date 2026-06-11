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

export interface ReviewItemValues {
  categoryLevel1: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  isEssential?: boolean;
  isRecurring?: boolean;
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
