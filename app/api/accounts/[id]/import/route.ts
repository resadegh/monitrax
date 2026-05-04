/**
 * Phase 29: Smart Transaction Import API
 * POST /api/accounts/[id]/import - Upload and process QIF/CSV file with AI categorisation
 * GET /api/accounts/[id]/import - Get import history for account
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
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
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';

// =============================================================================
// GET - Import History
// =============================================================================

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('account.read', async (request, auth, context) => {
    try {
      const { id: accountId } = await context!.params;

      // Verify account ownership
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: auth.userId },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Get import history
      const imports = await prisma.importBatch.findMany({
        where: {
          accountId,
          userId: auth.userId,
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
          userId: auth.userId,
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

// =============================================================================
// POST - Upload and Process Import
// =============================================================================

export const POST = withPermission<RouteContext>('account.write', async (request, auth, context) => {
    try {
      const { id: accountIdParam } = await context!.params;
      const userId = auth.userId;

      // Parse form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const createAccount = formData.get('createAccount') === 'true';
      const accountName = formData.get('accountName') as string | null;
      const accountType = formData.get('accountType') as string | null;
      const accountInstitution = formData.get('accountInstitution') as string | null;

      let accountId = accountIdParam;
      let account: { id: string; name: string; type: string; institution: string | null; currentBalance: number } | null = null;
      let accountCreated = false;

      // Handle account creation if requested
      if (accountIdParam === 'new' && createAccount) {
        if (!accountName?.trim()) {
          return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
        }

        // Create new account
        const ownerEntityId = await getDefaultLegalEntityId(userId);
        const newAccount = await prisma.account.create({
          data: {
            userId,
            ownerEntityId,
            name: accountName.trim(),
            type: (accountType as 'TRANSACTIONAL' | 'SAVINGS' | 'CREDIT_CARD' | 'OFFSET') || 'TRANSACTIONAL',
            institution: accountInstitution?.trim() || null,
            currentBalance: 0,
          },
        });

        accountId = newAccount.id;
        account = newAccount;
        accountCreated = true;
      } else {
        // Verify existing account ownership
        account = await prisma.account.findFirst({
          where: { id: accountId, userId },
        });

        if (!account) {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
      }

      // Continue with file processing...
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

      // Calculate balance information for verification
      // Get previous balance from account (before this import)
      const previousBalance = account?.currentBalance ?? 0;

      // Calculate net change from all processed transactions (including those in review)
      // We use all transactions that weren't duplicates
      let netChange = 0;
      for (const result of [...classified.autoAccept, ...classified.needsReview, ...classified.requiresManual]) {
        const tx = result.transaction;
        // Inflows are positive, outflows are negative
        netChange += tx.direction === 'IN' ? tx.amount : -tx.amount;
      }

      // Calculate expected new balance
      const calculatedBalance = previousBalance + netChange;

      // File may have closing balance - store for reference but don't auto-apply
      // User will verify the actual balance
      const fileClosingBalance = parsedFile.closingBalance;

      // Don't auto-update account balance - let user verify first
      // Store the file's closing balance in importBatch for reference
      if (fileClosingBalance !== undefined) {
        await prisma.importBatch.update({
          where: { id: importBatch.id },
          data: {
            closingBalance: fileClosingBalance,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          batchId: importBatch.id,
          accountId: accountId,
          accountName: account?.name,
          accountCreated,
          fileName: file.name,
          dateRange,
          statistics: {
            total: parsedFile.transactions.length,
            imported: createdTransactions.length,
            duplicatesSkipped: duplicateResult.statistics.exactDuplicates + duplicateResult.statistics.fuzzyDuplicates,
            autoAccepted: classified.autoAccept.length,
            needsReview: classified.needsReview.length,
            requiresManual: classified.requiresManual.length,
          },
          duplicateInfo: {
            count: duplicateResult.statistics.exactDuplicates + duplicateResult.statistics.fuzzyDuplicates,
            message: getDuplicateSummaryMessage(duplicateResult),
          },
          categorisation: {
            fromLearning: categorisationResult.fromLearning,
            fromAI: categorisationResult.fromAI,
            autoAccepted: classified.autoAccept.length,
          },
          // Balance verification data
          balanceInfo: {
            previousBalance,
            netChange,
            calculatedBalance,
            fileClosingBalance: fileClosingBalance ?? null,
            needsVerification: true,
          },
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
