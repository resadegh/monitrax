/**
 * Phase 29: Transaction Review Queue API
 * GET /api/accounts/[id]/import/[batchId]/review - Get transactions pending review
 * POST /api/accounts/[id]/import/[batchId]/review - Confirm/edit reviewed transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  processUserConfirmation,
  type LearningContext,
  type CategoryPrediction,
  type UserConfirmation,
} from '@/lib/bank/aiCategorisation';
import { ImportStatus, ImportReviewStatus, TransactionSource } from '@prisma/client';

// =============================================================================
// GET - Get Review Queue
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId, batchId } = await params;
      const userId = authReq.user!.userId;

      // Verify ownership
      const batch = await prisma.importBatch.findFirst({
        where: {
          id: batchId,
          accountId,
          userId,
        },
        include: {
          account: {
            select: { name: true, type: true, institution: true },
          },
        },
      });

      if (!batch) {
        return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
      }

      // Get review items
      const reviewItems = await prisma.transactionReviewQueue.findMany({
        where: {
          importBatchId: batchId,
          userId,
        },
        orderBy: [
          { status: 'asc' }, // Pending first
          { aiConfidence: 'desc' }, // Higher confidence first
        ],
      });

      // Group by confidence level
      const grouped = {
        needsReview: reviewItems.filter(r =>
          r.status === ImportReviewStatus.PENDING &&
          r.confidenceLevel === 'NEEDS_REVIEW'
        ),
        manual: reviewItems.filter(r =>
          r.status === ImportReviewStatus.PENDING &&
          r.confidenceLevel === 'MANUAL'
        ),
        confirmed: reviewItems.filter(r =>
          r.status === ImportReviewStatus.USER_CONFIRMED ||
          r.status === ImportReviewStatus.USER_EDITED
        ),
        skipped: reviewItems.filter(r =>
          r.status === ImportReviewStatus.SKIPPED
        ),
      };

      // Calculate statistics
      const stats = {
        total: reviewItems.length,
        pending: grouped.needsReview.length + grouped.manual.length,
        needsReview: grouped.needsReview.length,
        requiresManual: grouped.manual.length,
        confirmed: grouped.confirmed.length,
        skipped: grouped.skipped.length,
      };

      return NextResponse.json({
        success: true,
        data: {
          batch: {
            id: batch.id,
            fileName: batch.fileName,
            dateRange: {
              start: batch.dateRangeStart,
              end: batch.dateRangeEnd,
            },
            status: batch.status,
            account: batch.account,
          },
          statistics: stats,
          items: reviewItems.map(item => ({
            id: item.id,
            transaction: item.tempData,
            aiPrediction: {
              categoryLevel1: item.aiCategoryLevel1,
              categoryLevel2: item.aiCategoryLevel2,
              subcategory: item.aiSubcategory,
              isEssential: item.aiIsEssential,
              isRecurring: item.aiIsRecurring,
              confidence: item.aiConfidence,
              reasoning: item.aiReasoning,
            },
            userValues: item.userCategoryLevel1 ? {
              categoryLevel1: item.userCategoryLevel1,
              categoryLevel2: item.userCategoryLevel2,
              subcategory: item.userSubcategory,
              isEssential: item.userIsEssential,
              isRecurring: item.userIsRecurring,
            } : null,
            confidenceLevel: item.confidenceLevel,
            status: item.status,
            isDuplicate: item.isDuplicate,
            duplicateOf: item.duplicateOf,
            applyToSimilar: item.applyToSimilar,
            reviewedAt: item.reviewedAt,
          })),
        },
      });
    } catch (error) {
      console.error('Error fetching review queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch review queue' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Confirm/Edit Reviews
// =============================================================================

interface ReviewConfirmation {
  itemId: string;
  action: 'CONFIRM' | 'EDIT' | 'SKIP';
  values?: {
    categoryLevel1: string;
    categoryLevel2?: string | null;
    subcategory?: string | null;
    isEssential?: boolean;
    isRecurring?: boolean;
  };
  applyToSimilar?: boolean;
}

interface BulkReviewRequest {
  confirmations: ReviewConfirmation[];
  confirmAllPending?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId, batchId } = await params;
      const userId = authReq.user!.userId;

      // Verify ownership
      const batch = await prisma.importBatch.findFirst({
        where: {
          id: batchId,
          accountId,
          userId,
        },
      });

      if (!batch) {
        return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
      }

      const body: BulkReviewRequest = await request.json();
      const { confirmations, confirmAllPending } = body;

      const results = {
        confirmed: 0,
        edited: 0,
        skipped: 0,
        transactionsCreated: 0,
        similarUpdated: 0,
        errors: [] as string[],
      };

      // Handle bulk confirm all pending
      if (confirmAllPending) {
        const pendingItems = await prisma.transactionReviewQueue.findMany({
          where: {
            importBatchId: batchId,
            userId,
            status: ImportReviewStatus.PENDING,
          },
        });

        for (const item of pendingItems) {
          try {
            await confirmReviewItem(
              userId,
              accountId,
              batchId,
              item,
              'CONFIRM',
              null,
              false
            );
            results.confirmed++;
            results.transactionsCreated++;
          } catch (err) {
            results.errors.push(`Failed to confirm item ${item.id}`);
          }
        }
      } else if (confirmations && confirmations.length > 0) {
        // Process individual confirmations
        for (const confirmation of confirmations) {
          const item = await prisma.transactionReviewQueue.findFirst({
            where: {
              id: confirmation.itemId,
              importBatchId: batchId,
              userId,
            },
          });

          if (!item) {
            results.errors.push(`Item ${confirmation.itemId} not found`);
            continue;
          }

          try {
            const result = await confirmReviewItem(
              userId,
              accountId,
              batchId,
              item,
              confirmation.action,
              confirmation.values || null,
              confirmation.applyToSimilar || false
            );

            if (confirmation.action === 'CONFIRM') {
              results.confirmed++;
              results.transactionsCreated++;
            } else if (confirmation.action === 'EDIT') {
              results.edited++;
              results.transactionsCreated++;
            } else if (confirmation.action === 'SKIP') {
              results.skipped++;
            }

            results.similarUpdated += result.similarUpdated;
          } catch (err) {
            results.errors.push(`Failed to process item ${confirmation.itemId}`);
          }
        }
      }

      // Update batch statistics
      const remainingPending = await prisma.transactionReviewQueue.count({
        where: {
          importBatchId: batchId,
          userId,
          status: ImportReviewStatus.PENDING,
        },
      });

      const confirmedCount = await prisma.transactionReviewQueue.count({
        where: {
          importBatchId: batchId,
          userId,
          status: {
            in: [ImportReviewStatus.USER_CONFIRMED, ImportReviewStatus.USER_EDITED],
          },
        },
      });

      await prisma.importBatch.update({
        where: { id: batchId },
        data: {
          userConfirmedCount: confirmedCount,
          importedCount: { increment: results.transactionsCreated },
          status: remainingPending === 0 ? ImportStatus.COMPLETED : ImportStatus.AWAITING_REVIEW,
          ...(remainingPending === 0 ? { processingCompletedAt: new Date() } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          results,
          remainingPending,
          batchStatus: remainingPending === 0 ? 'COMPLETED' : 'AWAITING_REVIEW',
        },
      });
    } catch (error) {
      console.error('Error processing reviews:', error);
      return NextResponse.json(
        { error: 'Failed to process reviews' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function confirmReviewItem(
  userId: string,
  accountId: string,
  batchId: string,
  item: Awaited<ReturnType<typeof prisma.transactionReviewQueue.findFirst>>,
  action: 'CONFIRM' | 'EDIT' | 'SKIP',
  values: ReviewConfirmation['values'] | null,
  applyToSimilar: boolean
): Promise<{ similarUpdated: number }> {
  if (!item) throw new Error('Item is null');

  if (action === 'SKIP') {
    await prisma.transactionReviewQueue.update({
      where: { id: item.id },
      data: {
        status: ImportReviewStatus.SKIPPED,
        reviewedAt: new Date(),
      },
    });
    return { similarUpdated: 0 };
  }

  // Get transaction data
  const txData = item.tempData as {
    date: string;
    amount: number;
    direction: 'IN' | 'OUT';
    description: string;
    merchantRaw?: string;
    merchantStandardised?: string;
    hash: string;
  };

  // Determine final values
  const wasEdited = action === 'EDIT';
  const finalValues = wasEdited && values ? values : {
    categoryLevel1: item.aiCategoryLevel1 || 'Other',
    categoryLevel2: item.aiCategoryLevel2,
    subcategory: item.aiSubcategory,
    isEssential: item.aiIsEssential,
    isRecurring: item.aiIsRecurring,
  };

  // Create the transaction
  const transaction = await prisma.unifiedTransaction.create({
    data: {
      userId,
      accountId,
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
      confidenceScore: item.aiConfidence,
      source: TransactionSource.QIF,
      importBatchId: batchId,
    },
  });

  // Update review queue item
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

  // Process learning
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

  return { similarUpdated: learningResult.similarUpdated };
}
