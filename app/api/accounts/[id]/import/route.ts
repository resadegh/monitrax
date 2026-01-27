/**
 * Phase 29: Smart Transaction Import API
 * POST /api/accounts/[id]/import - Upload and process QIF/CSV file with AI categorisation
 * GET /api/accounts/[id]/import - Get import history for account
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { parseQIF, isValidQIF } from '@/lib/bank/parsers/qif';
import { normaliseTransactions } from '@/lib/bank/normalisation';
import { detectDuplicates, detectOverlap, getDuplicateSummaryMessage } from '@/lib/bank/smartDuplicateDetection';
import {
  categoriseWithLearning,
  classifyByConfidence,
  getCategorizationSettings,
} from '@/lib/bank/aiCategorisation';
import { ImportStatus, TransactionSource, ImportReviewStatus } from '@prisma/client';
import crypto from 'crypto';

// =============================================================================
// GET - Import History
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId } = await params;

      // Verify account ownership
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: authReq.user!.userId },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Get import history
      const imports = await prisma.importBatch.findMany({
        where: {
          accountId,
          userId: authReq.user!.userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          source: true,
          fileName: true,
          dateRangeStart: true,
          dateRangeEnd: true,
          totalTransactions: true,
          importedCount: true,
          duplicatesSkipped: true,
          aiCategorisedCount: true,
          autoAcceptedCount: true,
          needsReviewCount: true,
          userConfirmedCount: true,
          status: true,
          createdAt: true,
        },
      });

      // Get pending review count
      const pendingReviewCount = await prisma.transactionReviewQueue.count({
        where: {
          userId: authReq.user!.userId,
          status: ImportReviewStatus.PENDING,
          importBatch: {
            accountId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          imports,
          pendingReviewCount,
        },
      });
    } catch (error) {
      console.error('Error fetching import history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import history' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Upload and Process Import
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId } = await params;
      const userId = authReq.user!.userId;

      // Verify account ownership
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Parse form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const previewOnly = formData.get('preview') === 'true';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Read file content
      const content = await file.text();
      const fileHash = crypto.createHash('sha256').update(content).digest('hex');

      // Check if this exact file was already imported
      const existingImport = await prisma.importBatch.findFirst({
        where: {
          userId,
          accountId,
          fileHash,
          status: ImportStatus.COMPLETED,
        },
      });

      if (existingImport) {
        return NextResponse.json({
          success: false,
          error: 'This file has already been imported',
          existingImport: {
            id: existingImport.id,
            createdAt: existingImport.createdAt,
            importedCount: existingImport.importedCount,
          },
        }, { status: 409 });
      }

      // Validate and parse file
      let parsedFile;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.qif') || isValidQIF(content)) {
        parsedFile = parseQIF(content);
      } else {
        return NextResponse.json(
          { error: 'Unsupported file format. Please upload a QIF file.' },
          { status: 400 }
        );
      }

      if (parsedFile.transactions.length === 0) {
        return NextResponse.json(
          { error: 'No transactions found in file' },
          { status: 400 }
        );
      }

      // Normalise transactions
      const normalisationResult = normaliseTransactions(
        parsedFile.transactions,
        accountId
      );

      const transactions = normalisationResult.transactions;

      // Calculate date range
      const dates = transactions.map(t => t.date.getTime());
      const dateRange = {
        start: new Date(Math.min(...dates)),
        end: new Date(Math.max(...dates)),
      };

      // Check for overlap with existing imports
      const overlapResult = await detectOverlap(
        userId,
        accountId,
        dateRange
      );

      // Detect duplicates
      const duplicateResult = await detectDuplicates(
        userId,
        accountId,
        transactions
      );

      // Get transactions to process (excluding duplicates)
      const transactionsToProcess = duplicateResult.newTransactions.map(r => r.transaction);

      // AI Categorisation
      const settings = getCategorizationSettings();
      const categorisationResult = await categoriseWithLearning(
        userId,
        transactionsToProcess,
        settings
      );

      // Classify by confidence
      const classified = classifyByConfidence(categorisationResult.results, settings);

      // If preview only, return results without saving
      if (previewOnly) {
        return NextResponse.json({
          success: true,
          data: {
            preview: true,
            fileName: file.name,
            fileSize: file.size,
            dateRange,
            overlap: overlapResult,
            duplicates: {
              summary: getDuplicateSummaryMessage(duplicateResult),
              statistics: duplicateResult.statistics,
              skipped: duplicateResult.skippedInfo,
            },
            categorisation: {
              total: categorisationResult.results.length,
              fromLearning: categorisationResult.fromLearning,
              fromAI: categorisationResult.fromAI,
              autoAccept: classified.autoAccept.length,
              needsReview: classified.needsReview.length,
              requiresManual: classified.requiresManual.length,
            },
            transactions: {
              sample: transactionsToProcess.slice(0, 10).map(tx => ({
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                direction: tx.direction,
              })),
              categorisationSample: categorisationResult.results.slice(0, 10).map(r => ({
                description: r.transaction.description,
                amount: r.transaction.amount,
                prediction: r.prediction,
                confidence: r.adjustedConfidence,
              })),
            },
            aiUsage: categorisationResult.usage,
          },
        });
      }

      // Create import batch
      const importBatch = await prisma.importBatch.create({
        data: {
          userId,
          accountId,
          source: TransactionSource.QIF,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          dateRangeStart: dateRange.start,
          dateRangeEnd: dateRange.end,
          totalTransactions: parsedFile.transactions.length,
          duplicatesSkipped: duplicateResult.statistics.exactDuplicates + duplicateResult.statistics.fuzzyDuplicates,
          aiCategorisedCount: categorisationResult.fromAI,
          autoAcceptedCount: classified.autoAccept.length,
          needsReviewCount: classified.needsReview.length + classified.requiresManual.length,
          status: ImportStatus.PROCESSING,
          processingStartedAt: new Date(),
          openingBalance: parsedFile.openingBalance,
          closingBalance: parsedFile.closingBalance,
        },
      });

      // Create transactions for auto-accepted items
      const createdTransactions: string[] = [];

      for (const result of classified.autoAccept) {
        const tx = result.transaction;
        const pred = result.prediction;

        const created = await prisma.unifiedTransaction.create({
          data: {
            userId,
            accountId,
            date: tx.date,
            amount: tx.amount,
            direction: tx.direction,
            description: tx.description,
            merchantRaw: tx.merchantRaw,
            merchantStandardised: tx.merchantStandardised,
            categoryLevel1: pred.categoryLevel1,
            categoryLevel2: pred.categoryLevel2,
            subcategory: pred.subcategory,
            isEssential: pred.isEssential,
            isRecurring: pred.isRecurring,
            confidenceScore: result.adjustedConfidence,
            source: TransactionSource.QIF,
            importBatchId: importBatch.id,
          },
        });

        createdTransactions.push(created.id);
      }

      // Create review queue items for items needing review
      const reviewItems = [...classified.needsReview, ...classified.requiresManual];

      for (const result of reviewItems) {
        const tx = result.transaction;
        const pred = result.prediction;

        await prisma.transactionReviewQueue.create({
          data: {
            userId,
            importBatchId: importBatch.id,
            tempData: {
              date: tx.date.toISOString(),
              amount: tx.amount,
              direction: tx.direction,
              description: tx.description,
              merchantRaw: tx.merchantRaw,
              merchantStandardised: tx.merchantStandardised,
              hash: tx.hash,
            },
            aiCategoryLevel1: pred.categoryLevel1,
            aiCategoryLevel2: pred.categoryLevel2,
            aiSubcategory: pred.subcategory,
            aiConfidence: result.adjustedConfidence,
            aiIsEssential: pred.isEssential,
            aiIsRecurring: pred.isRecurring,
            aiReasoning: pred.reasoning,
            confidenceLevel: result.adjustedConfidence >= settings.showForReviewThreshold
              ? 'NEEDS_REVIEW'
              : 'MANUAL',
            status: ImportReviewStatus.PENDING,
          },
        });
      }

      // Update import batch status
      await prisma.importBatch.update({
        where: { id: importBatch.id },
        data: {
          importedCount: createdTransactions.length,
          userConfirmedCount: 0,
          status: reviewItems.length > 0 ? ImportStatus.AWAITING_REVIEW : ImportStatus.COMPLETED,
          processingCompletedAt: new Date(),
        },
      });

      // Update account balance if closing balance provided
      if (parsedFile.closingBalance !== undefined) {
        await prisma.account.update({
          where: { id: accountId },
          data: {
            currentBalance: parsedFile.closingBalance,
            balanceSource: 'IMPORT',
            balanceLastUpdatedAt: new Date(),
            lastImportedBalance: parsedFile.closingBalance,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          importBatchId: importBatch.id,
          fileName: file.name,
          dateRange,
          statistics: {
            total: parsedFile.transactions.length,
            imported: createdTransactions.length,
            duplicatesSkipped: duplicateResult.statistics.exactDuplicates + duplicateResult.statistics.fuzzyDuplicates,
            pendingReview: reviewItems.length,
          },
          duplicates: {
            summary: getDuplicateSummaryMessage(duplicateResult),
            skipped: duplicateResult.skippedInfo,
          },
          categorisation: {
            fromLearning: categorisationResult.fromLearning,
            fromAI: categorisationResult.fromAI,
            autoAccepted: classified.autoAccept.length,
          },
          balanceUpdated: parsedFile.closingBalance !== undefined,
          newBalance: parsedFile.closingBalance,
          aiUsage: categorisationResult.usage,
          requiresReview: reviewItems.length > 0,
          reviewUrl: reviewItems.length > 0
            ? `/accounts/${accountId}/import/${importBatch.id}/review`
            : null,
        },
      });
    } catch (error) {
      console.error('Error processing import:', error);
      return NextResponse.json(
        { error: 'Failed to process import' },
        { status: 500 }
      );
    }
  });
}
