/**
 * Phase 29: Transaction Review Queue API
 * GET /api/accounts/[id]/import/[batchId]/review - Get transactions pending review
 * POST /api/accounts/[id]/import/[batchId]/review - Confirm/edit reviewed transactions
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { confirmReviewItem } from '@/lib/bank/reviewQueue';
import { ImportStatus, ImportReviewStatus, TransactionReviewQueue } from '@prisma/client';

// =============================================================================
// GET - Get Review Queue
// =============================================================================

type RouteContext = { params: Promise<{ id: string; batchId: string }> };

export const GET = withPermission<RouteContext>('account.read', async (request, auth, context) => {
    try {
      const { id: accountId, batchId } = await context!.params;
      const userId = auth.userId;

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
        needsReview: reviewItems.filter((r: TransactionReviewQueue) =>
          r.status === ImportReviewStatus.PENDING &&
          r.confidenceLevel === 'NEEDS_REVIEW'
        ),
        manual: reviewItems.filter((r: TransactionReviewQueue) =>
          r.status === ImportReviewStatus.PENDING &&
          r.confidenceLevel === 'MANUAL'
        ),
        confirmed: reviewItems.filter((r: TransactionReviewQueue) =>
          r.status === ImportReviewStatus.USER_CONFIRMED ||
          r.status === ImportReviewStatus.USER_EDITED
        ),
        skipped: reviewItems.filter((r: TransactionReviewQueue) =>
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
          items: reviewItems.map((item: TransactionReviewQueue) => ({
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

export const POST = withPermission<RouteContext>('account.write', async (request, auth, context) => {
    try {
      const { id: accountId, batchId } = await context!.params;
      const userId = auth.userId;

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

