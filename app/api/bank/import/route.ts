/**
 * Phase 18: Bank Import API
 * POST /api/bank/import - Upload and process bank statement files
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import {
  parseCSV,
  normaliseTransactions,
  categoriseTransactions,
  detectDuplicates,
  applyDuplicatePolicy,
} from '@/lib/bank';
import { batchFindMatches } from '@/lib/bank/recurringMatcher';
import type {
  ImportFileFormat,
  DuplicatePolicy,
  ParseOptions,
} from '@/lib/bank/types';

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const accountId = formData.get('accountId') as string | null;
      const duplicatePolicyStr = formData.get('duplicatePolicy') as string | null;
      const mappingsStr = formData.get('mappings') as string | null;
      const updateAccountBalance = formData.get('updateAccountBalance') === 'true';
      const transactionLinksStr = formData.get('transactionLinks') as string | null;
      const autoLinkRecurring = formData.get('autoLinkRecurring') === 'true';

      // Parse transaction links: { [transactionIndex]: { type: 'income'|'expense', id: string } }
      interface TransactionLink {
        type: 'income' | 'expense';
        id: string;
      }
      const transactionLinks: Record<number, TransactionLink> = transactionLinksStr
        ? JSON.parse(transactionLinksStr)
        : {};

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Determine format from file extension
      const filename = file.name;
      const extension = filename.split('.').pop()?.toLowerCase();
      let format: ImportFileFormat;

      switch (extension) {
        case 'csv':
          format = 'CSV';
          break;
        case 'ofx':
        case 'qfx':
          format = 'OFX';
          break;
        case 'qif':
          format = 'QIF';
          break;
        default:
          return NextResponse.json(
            { error: `Unsupported file format: ${extension}` },
            { status: 400 }
          );
      }

      // Read file content
      const content = await file.text();
      const fileHash = createHash('sha256').update(content).digest('hex');

      // Check for duplicate file upload
      const existingFile = await prisma.bankImportFile.findFirst({
        where: {
          userId,
          fileHash,
          status: 'COMPLETED',
          importedCount: { gt: 0 }, // Only block if actually imported transactions
        },
      });

      if (existingFile) {
        // Allow re-import if user explicitly chooses to (via duplicatePolicy)
        const duplicatePolicy = formData.get('duplicatePolicy') as string | null;
        if (duplicatePolicy !== 'MARK_DUPLICATE') {
          return NextResponse.json(
            { error: 'This file has already been imported', existingFileId: existingFile.id },
            { status: 409 }
          );
        }
      }

      // Delete any failed/incomplete previous imports of this file
      await prisma.bankImportFile.deleteMany({
        where: {
          userId,
          fileHash,
          OR: [
            { status: 'FAILED' },
            { status: 'PROCESSING' },
            { importedCount: 0 },
          ],
        },
      });

      // Parse mappings if provided
      const mappings: ParseOptions | undefined = mappingsStr
        ? JSON.parse(mappingsStr)
        : undefined;

      // Parse duplicate policy
      const duplicatePolicy: DuplicatePolicy = (duplicatePolicyStr as DuplicatePolicy) || 'REJECT';

      // Create import file record
      const importFile = await prisma.bankImportFile.create({
        data: {
          id: randomUUID(),
          userId,
          filename,
          format,
          fileSize: file.size,
          fileHash,
          status: 'PROCESSING',
          accountId,
          duplicatePolicy,
          dateFormat: mappings?.dateFormat,
        },
      });

      try {
        // Parse the file based on format
        let parsedFile;
        if (format === 'CSV') {
          parsedFile = parseCSV(content, mappings);
        } else {
          // TODO: Implement OFX and QIF parsers
          return NextResponse.json(
            { error: `${format} format not yet implemented` },
            { status: 501 }
          );
        }

        // Store raw transactions
        const rawTransactionData = parsedFile.transactions.map((tx, index) => ({
          id: randomUUID(),
          importFileId: importFile.id,
          rowNumber: tx.rowNumber,
          rawData: JSON.parse(JSON.stringify(tx.rawData)),
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          direction: tx.direction,
          balance: tx.balance,
          reference: tx.reference,
          transactionHash: tx.date && tx.amount && tx.description
            ? createHash('sha256')
                .update(`${tx.date.toISOString().split('T')[0]}|${tx.amount.toFixed(2)}|${tx.description.substring(0, 50).toLowerCase().replace(/\s+/g, '')}`)
                .digest('hex')
            : `invalid-${index}`,
        }));

        await prisma.bankTransactionRaw.createMany({
          data: rawTransactionData,
        });

        // Normalise transactions
        const normalisationResult = normaliseTransactions(
          parsedFile.transactions,
          importFile.id,
          accountId ?? undefined
        );

        // Get existing transactions for duplicate detection
        const existingTransactions = await prisma.unifiedTransaction.findMany({
          where: { userId },
          select: {
            id: true,
            date: true,
            amount: true,
            description: true,
            direction: true,
            merchantStandardised: true,
          },
        });

        // Map to NormalisedTransaction format for duplicate detection
        type ExistingTxType = (typeof existingTransactions)[number];
        const existingNormalised = existingTransactions.map((tx: ExistingTxType) => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          rawDescription: tx.description,
          direction: tx.direction as 'IN' | 'OUT',
          sourceFileId: '',
          hash: createHash('sha256')
            .update(`${tx.date.toISOString().split('T')[0]}|${tx.amount.toFixed(2)}|${tx.description.substring(0, 50).toLowerCase().replace(/\s+/g, '')}`)
            .digest('hex'),
          merchantStandardised: tx.merchantStandardised ?? undefined,
        }));

        // Detect duplicates
        const duplicateResult = detectDuplicates(
          normalisationResult.transactions,
          existingNormalised
        );

        // Apply duplicate policy
        const transactionsToImport = applyDuplicatePolicy(duplicateResult, duplicatePolicy);

        // Get user's category rules
        const userRules = await prisma.categoryRule.findMany({
          where: {
            OR: [{ userId }, { userId: null }],
            isActive: true,
          },
          orderBy: { priority: 'desc' },
        });

        // Categorise transactions
        type RuleType = (typeof userRules)[number];
        const categorisationResult = categoriseTransactions(
          transactionsToImport,
          userRules.map((r: RuleType) => ({
            id: r.id,
            userId: r.userId,
            ruleType: r.ruleType as 'MERCHANT' | 'KEYWORD' | 'MCC' | 'BPAY' | 'AMOUNT_RANGE',
            pattern: r.pattern,
            isRegex: r.isRegex,
            caseSensitive: r.caseSensitive,
            categoryLevel1: r.categoryLevel1,
            categoryLevel2: r.categoryLevel2,
            subcategory: r.subcategory,
            linkToPropertyId: r.linkToPropertyId,
            linkToLoanId: r.linkToLoanId,
            linkToExpenseId: r.linkToExpenseId,
            priority: r.priority,
            isActive: r.isActive,
          }))
        );

        // Build auto-links if enabled
        let effectiveLinks = { ...transactionLinks };
        let linkedCount = 0;

        if (autoLinkRecurring && Object.keys(transactionLinks).length === 0) {
          // Fetch income and expense entries for auto-linking
          const [incomeEntries, expenseEntries] = await Promise.all([
            prisma.income.findMany({
              where: { userId },
              select: {
                id: true,
                name: true,
                type: true,
                amount: true,
                frequency: true,
                netAmount: true,
              },
            }),
            prisma.expense.findMany({
              where: { userId },
              select: {
                id: true,
                name: true,
                vendorName: true,
                category: true,
                amount: true,
                frequency: true,
              },
            }),
          ]);

          // Get recurring matches for transactions
          const transactionsToMatch = categorisationResult.transactions.map(t => ({
            description: t.description,
            merchantStandardised: t.merchantStandardised,
            amount: t.amount,
            direction: t.direction,
          }));

          const recurringMatches = batchFindMatches(
            transactionsToMatch,
            incomeEntries,
            expenseEntries
          );

          // Auto-link high-confidence matches
          recurringMatches.forEach((match, index) => {
            if (match.confidence >= 0.7 && match.amountMatch) {
              effectiveLinks[index] = {
                type: match.type,
                id: match.id,
              };
            }
          });
        }

        // Create unified transactions with links
        if (categorisationResult.transactions.length > 0) {
          await prisma.unifiedTransaction.createMany({
            data: categorisationResult.transactions.map((tx, index) => {
              const link = effectiveLinks[index];
              if (link) linkedCount++;

              return {
                id: tx.id,
                userId,
                accountId: tx.bankAccountId ?? accountId ?? '',
                date: tx.date,
                amount: tx.amount,
                direction: tx.direction,
                description: tx.description,
                merchantRaw: tx.merchantRaw,
                merchantStandardised: tx.merchantStandardised,
                categoryLevel1: tx.categoryLevel1,
                categoryLevel2: tx.categoryLevel2,
                subcategory: tx.subcategory,
                confidenceScore: tx.confidenceScore,
                source: 'CSV' as const,
                importBatchId: importFile.id,
                processedAt: new Date(),
                // Apply income/expense links
                incomeId: link?.type === 'income' ? link.id : null,
                expenseId: link?.type === 'expense' ? link.id : null,
              };
            }),
          });
        }

        // Update import file status
        await prisma.bankImportFile.update({
          where: { id: importFile.id },
          data: {
            status: 'COMPLETED',
            totalRows: parsedFile.totalRows,
            importedCount: categorisationResult.transactions.length,
            duplicateCount: duplicateResult.statistics.duplicates,
            errorCount: normalisationResult.errors.length,
            processedAt: new Date(),
          },
        });

        // Mark raw transactions as processed
        await prisma.bankTransactionRaw.updateMany({
          where: { importFileId: importFile.id },
          data: { isProcessed: true },
        });

        // Update account balance if requested and an account was linked
        if (accountId && updateAccountBalance && parsedFile.closingBalance !== undefined) {
          // Use the closing balance from the CSV file
          await prisma.account.update({
            where: { id: accountId },
            data: { currentBalance: parsedFile.closingBalance },
          });
        }

        return NextResponse.json({
          success: true,
          fileId: importFile.id,
          statistics: {
            total: parsedFile.totalRows,
            imported: categorisationResult.transactions.length,
            duplicates: duplicateResult.statistics.duplicates,
            errors: normalisationResult.errors.length,
            categorised: categorisationResult.statistics.categorised,
            uncategorised: categorisationResult.statistics.uncategorised,
            linkedToRecurring: linkedCount,
          },
          errors: normalisationResult.errors.slice(0, 10), // First 10 errors
        });
      } catch (error) {
        // Update file status to failed
        await prisma.bankImportFile.update({
          where: { id: importFile.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        throw error;
      }
    } catch (error) {
      console.error('Bank import error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Import failed' },
        { status: 500 }
      );
    }
  });
}

// GET - List import history
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const imports = await prisma.bankImportFile.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({ imports });
    } catch (error) {
      console.error('Get imports error:', error);
      return NextResponse.json(
        { error: 'Failed to get import history' },
        { status: 500 }
      );
    }
  });
}
