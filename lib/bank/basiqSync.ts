/**
 * Basiq Transaction Sync Service
 * Handles syncing transactions from Basiq (Open Banking) and
 * managing priority over manually imported transactions.
 *
 * Priority Logic:
 * - BASIQ transactions are the source of truth when a connection is ACTIVE
 * - When Basiq is activated for an account, existing IMPORT/MANUAL transactions
 *   are marked as superseded (not deleted, for audit trail)
 * - Balance from Basiq always takes priority over imported balance
 *
 * Phase 29: AI Categorisation Integration
 * - Uses AI categorisation for new transactions
 * - High confidence transactions are auto-accepted
 * - Low confidence transactions are queued for review
 * - Learns from user confirmations
 */

import { PrismaClient, ImportStatus, ImportReviewStatus, TransactionSource } from '@prisma/client';
import { getTransactions, getAccount, mapBasiqTransactionDirection } from '@/lib/basiq';
import { cleanMerchantName } from '@/lib/tie';
import { categoriseTransactions } from './categorisation';
import { generateHash } from './normalisation';
import {
  categoriseWithLearning,
  classifyByConfidence,
  getCategorizationSettings,
  type AICategorizationResult,
} from './aiCategorisation';
import type { CategorisedTransaction, NormalisedTransaction } from './types';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface BasiqSyncResult {
  accountId: string;
  basiqAccountId: string;
  transactionsImported: number;
  transactionsSuperseded: number;
  balanceUpdated: boolean;
  newBalance?: number;
  errors: string[];
  // Phase 29: AI categorisation stats
  aiCategorisation: {
    total: number;
    fromLearning: number;
    fromAI: number;
    autoAccepted: number;
    needsReview: number;
  };
}

export interface BasiqSyncOptions {
  /** Whether to supersede existing non-Basiq transactions */
  supersedePrevious?: boolean;
  /** Date range for transaction sync */
  fromDate?: string;
  toDate?: string;
  /** Limit transactions to sync */
  limit?: number;
}

// =============================================================================
// SYNC FUNCTIONS
// =============================================================================

/**
 * Sync transactions from Basiq for a specific account
 * This is the main entry point for Basiq transaction sync
 */
export async function syncBasiqTransactions(
  userId: string,
  accountId: string,
  options: BasiqSyncOptions = {}
): Promise<BasiqSyncResult> {
  const result: BasiqSyncResult = {
    accountId,
    basiqAccountId: '',
    transactionsImported: 0,
    transactionsSuperseded: 0,
    balanceUpdated: false,
    errors: [],
    aiCategorisation: {
      total: 0,
      fromLearning: 0,
      fromAI: 0,
      autoAccepted: 0,
      needsReview: 0,
    },
  };

  try {
    // Get account with Basiq connection details
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        basiqConnection: true,
        user: {
          select: { basiqUserId: true },
        },
      },
    });

    if (!account) {
      result.errors.push('Account not found');
      return result;
    }

    if (account.userId !== userId) {
      result.errors.push('Unauthorized access to account');
      return result;
    }

    if (!account.basiqAccountId || !account.user.basiqUserId) {
      result.errors.push('Account is not connected to Basiq');
      return result;
    }

    if (!account.basiqConnection || account.basiqConnection.status !== 'ACTIVE') {
      result.errors.push('Basiq connection is not active');
      return result;
    }

    result.basiqAccountId = account.basiqAccountId;

    // Step 1: Supersede existing non-Basiq transactions if requested
    if (options.supersedePrevious !== false) {
      const supersededCount = await supersedeNonBasiqTransactions(userId, accountId);
      result.transactionsSuperseded = supersededCount;
    }

    // Step 2: Fetch transactions from Basiq
    const basiqTransactions = await getTransactions(account.user.basiqUserId, {
      accountId: account.basiqAccountId,
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: options.limit,
    });

    // Step 3: Process and import Basiq transactions with AI categorisation
    const importResult = await importBasiqTransactionsWithAI(
      userId,
      accountId,
      account.basiqAccountId,
      basiqTransactions
    );
    result.transactionsImported = importResult.imported;
    result.aiCategorisation = importResult.aiStats;

    // Step 4: Update account balance from Basiq
    try {
      const basiqAccount = await getAccount(account.user.basiqUserId, account.basiqAccountId);
      if (basiqAccount.balance !== undefined) {
        await prisma.account.update({
          where: { id: accountId },
          data: {
            currentBalance: basiqAccount.balance,
            balanceSource: 'BASIQ',
            balanceLastUpdatedAt: new Date(),
          },
        });
        result.balanceUpdated = true;
        result.newBalance = basiqAccount.balance;
      }
    } catch (balanceError) {
      result.errors.push(`Failed to update balance: ${balanceError instanceof Error ? balanceError.message : 'Unknown error'}`);
    }

    // Step 5: Update Basiq connection last synced timestamp
    await prisma.basiqConnection.update({
      where: { id: account.basiqConnectionId! },
      data: { lastSyncedAt: new Date() },
    });

    await prisma.account.update({
      where: { id: accountId },
      data: { basiqLastSynced: new Date() },
    });

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
  }

  return result;
}

/**
 * Mark existing non-Basiq transactions as superseded
 * This preserves the audit trail while making Basiq the source of truth
 */
async function supersedeNonBasiqTransactions(
  userId: string,
  accountId: string
): Promise<number> {
  // We add an 'isSuperseded' tag to transactions instead of deleting them
  // This maintains audit trail while filtering them out of normal views
  const updateResult = await prisma.unifiedTransaction.updateMany({
    where: {
      userId,
      accountId,
      source: { in: ['CSV', 'OFX', 'QIF', 'MANUAL'] },
      // Don't supersede if already superseded
      NOT: {
        tags: { has: 'SUPERSEDED_BY_BASIQ' },
      },
    },
    data: {
      tags: {
        push: 'SUPERSEDED_BY_BASIQ',
      },
    },
  });

  return updateResult.count;
}

/**
 * Import transactions from Basiq into UnifiedTransaction
 */
async function importBasiqTransactions(
  userId: string,
  accountId: string,
  basiqAccountId: string,
  basiqTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    direction: 'credit' | 'debit';
    transactionDate: string;
    postDate: string;
    balance: number;
    enrich?: {
      merchant?: {
        businessName: string;
        category: string;
      };
      category?: {
        anzsic?: {
          code: string;
          title: string;
        };
      };
    };
  }>
): Promise<number> {
  if (basiqTransactions.length === 0) return 0;

  // Get existing Basiq transaction IDs to avoid duplicates
  const existingBasiqTxIds = new Set(
    (await prisma.unifiedTransaction.findMany({
      where: {
        userId,
        accountId,
        source: 'BANK',
        externalId: { not: null },
      },
      select: { externalId: true },
    })).map(tx => tx.externalId)
  );

  // Get category rules for categorisation
  const categoryRules = await prisma.categoryRule.findMany({
    where: {
      OR: [{ userId }, { userId: null }],
      isActive: true,
    },
    orderBy: { priority: 'desc' },
  });

  // Prepare transactions for import (skip existing)
  const newTransactions: NormalisedTransaction[] = [];

  for (const basiqTx of basiqTransactions) {
    // Skip if already imported
    if (existingBasiqTxIds.has(basiqTx.id)) continue;

    const direction = mapBasiqTransactionDirection(basiqTx.direction);
    const amount = Math.abs(basiqTx.amount);
    const date = new Date(basiqTx.transactionDate);
    const postDate = basiqTx.postDate ? new Date(basiqTx.postDate) : null;

    // Use Basiq merchant enrichment if available, otherwise clean the description
    const merchantRaw = basiqTx.enrich?.merchant?.businessName || basiqTx.description;
    const merchantCleaned = cleanMerchantName(merchantRaw);

    const normalised: NormalisedTransaction = {
      id: `basiq_${basiqTx.id}`,
      date,
      description: basiqTx.description,
      rawDescription: basiqTx.description,
      amount,
      direction,
      sourceFileId: `basiq_${basiqAccountId}`,
      hash: generateHash(date, amount, basiqTx.description),
      merchantRaw,
      merchantStandardised: merchantCleaned ?? undefined,
      balance: basiqTx.balance,
    };

    newTransactions.push(normalised);
  }

  if (newTransactions.length === 0) return 0;

  // Categorise transactions
  const categorised = categoriseTransactions(
    newTransactions,
    categoryRules.map(r => ({
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

  // Create unified transactions
  const transactionsToCreate = categorised.transactions.map((tx: CategorisedTransaction) => {
    // Extract Basiq ID from our temp ID format
    const basiqId = tx.id.replace('basiq_', '');

    return {
      id: tx.id,
      userId,
      accountId,
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
      source: 'BANK' as const,
      externalId: basiqId,
      processedAt: new Date(),
      // Link to property/loan/expense if rule matched
      propertyId: tx.linkedPropertyId || null,
      loanId: tx.linkedLoanId || null,
      expenseId: tx.linkedExpenseId || null,
    };
  });

  if (transactionsToCreate.length > 0) {
    await prisma.unifiedTransaction.createMany({
      data: transactionsToCreate,
      skipDuplicates: true,
    });
  }

  return transactionsToCreate.length;
}

/**
 * Import Basiq transactions with AI categorisation (Phase 29)
 * Uses AI to categorise transactions and queues low-confidence for review
 */
async function importBasiqTransactionsWithAI(
  userId: string,
  accountId: string,
  basiqAccountId: string,
  basiqTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    direction: 'credit' | 'debit';
    transactionDate: string;
    postDate: string;
    balance: number;
    enrich?: {
      merchant?: {
        businessName: string;
        category: string;
      };
      category?: {
        anzsic?: {
          code: string;
          title: string;
        };
      };
    };
  }>
): Promise<{
  imported: number;
  aiStats: {
    total: number;
    fromLearning: number;
    fromAI: number;
    autoAccepted: number;
    needsReview: number;
  };
}> {
  const aiStats = {
    total: 0,
    fromLearning: 0,
    fromAI: 0,
    autoAccepted: 0,
    needsReview: 0,
  };

  if (basiqTransactions.length === 0) {
    return { imported: 0, aiStats };
  }

  // Get existing Basiq transaction IDs to avoid duplicates
  const existingBasiqTxIds = new Set(
    (await prisma.unifiedTransaction.findMany({
      where: {
        userId,
        accountId,
        source: 'BASIQ',
        basiqTransactionId: { not: null },
      },
      select: { basiqTransactionId: true },
    })).map(tx => tx.basiqTransactionId)
  );

  // Prepare normalised transactions for AI categorisation
  const newTransactions: NormalisedTransaction[] = [];

  for (const basiqTx of basiqTransactions) {
    // Skip if already imported
    if (existingBasiqTxIds.has(basiqTx.id)) continue;

    const direction = mapBasiqTransactionDirection(basiqTx.direction);
    const amount = Math.abs(basiqTx.amount);
    const date = new Date(basiqTx.transactionDate);

    // Use Basiq merchant enrichment if available
    const merchantRaw = basiqTx.enrich?.merchant?.businessName || basiqTx.description;
    const merchantCleaned = cleanMerchantName(merchantRaw);

    const normalised: NormalisedTransaction = {
      id: `basiq_${basiqTx.id}`,
      date,
      description: basiqTx.description,
      rawDescription: basiqTx.description,
      amount,
      direction,
      sourceFileId: `basiq_${basiqAccountId}`,
      hash: generateHash(date, amount, basiqTx.description),
      merchantRaw,
      merchantStandardised: merchantCleaned ?? undefined,
      balance: basiqTx.balance,
    };

    newTransactions.push(normalised);
  }

  if (newTransactions.length === 0) {
    return { imported: 0, aiStats };
  }

  // Use AI categorisation with learning
  const settings = getCategorizationSettings();
  const categorisationResult = await categoriseWithLearning(
    userId,
    newTransactions,
    settings
  );

  aiStats.total = categorisationResult.results.length;
  aiStats.fromLearning = categorisationResult.fromLearning;
  aiStats.fromAI = categorisationResult.fromAI;

  // Classify by confidence
  const classified = classifyByConfidence(categorisationResult.results, settings);
  aiStats.autoAccepted = classified.autoAccept.length;
  aiStats.needsReview = classified.needsReview.length + classified.requiresManual.length;

  // Create import batch for tracking
  const dates = newTransactions.map(t => t.date.getTime());
  const importBatch = await prisma.importBatch.create({
    data: {
      userId,
      accountId,
      source: TransactionSource.BASIQ,
      dateRangeStart: new Date(Math.min(...dates)),
      dateRangeEnd: new Date(Math.max(...dates)),
      totalTransactions: newTransactions.length,
      aiCategorisedCount: aiStats.fromAI,
      autoAcceptedCount: aiStats.autoAccepted,
      needsReviewCount: aiStats.needsReview,
      status: aiStats.needsReview > 0 ? ImportStatus.AWAITING_REVIEW : ImportStatus.COMPLETED,
      processingStartedAt: new Date(),
      processingCompletedAt: new Date(),
    },
  });

  // Create transactions for auto-accepted items
  const createdIds: string[] = [];

  for (const result of classified.autoAccept) {
    const tx = result.transaction;
    const pred = result.prediction;
    const basiqId = tx.id.replace('basiq_', '');

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
        source: TransactionSource.BASIQ,
        basiqTransactionId: basiqId,
        importBatchId: importBatch.id,
        processedAt: new Date(),
      },
    });

    createdIds.push(created.id);
  }

  // Create review queue items for low confidence transactions
  const reviewItems = [...classified.needsReview, ...classified.requiresManual];

  for (const result of reviewItems) {
    const tx = result.transaction;
    const pred = result.prediction;
    const basiqId = tx.id.replace('basiq_', '');

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
          basiqTransactionId: basiqId,
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

  // Update import batch with final counts
  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      importedCount: createdIds.length,
    },
  });

  return { imported: createdIds.length, aiStats };
}

/**
 * Check if an account can accept manual imports
 * Phase 29: Manual imports are now allowed as backup even when Basiq is active
 * Data will be merged intelligently with Basiq transactions
 */
export async function canAcceptManualImport(accountId: string): Promise<{
  canImport: boolean;
  isBackupMode: boolean;
  reason?: string;
  basiqStatus?: string;
  warning?: string;
}> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { basiqConnection: true },
  });

  if (!account) {
    return { canImport: false, isBackupMode: false, reason: 'Account not found' };
  }

  // If not connected to Basiq, allow normal manual imports
  if (!account.basiqAccountId || !account.basiqConnection) {
    return { canImport: true, isBackupMode: false };
  }

  // If Basiq connection is not active, allow manual imports
  if (account.basiqConnection.status !== 'ACTIVE') {
    return {
      canImport: true,
      isBackupMode: false,
      reason: 'Basiq connection is not active',
      basiqStatus: account.basiqConnection.status,
    };
  }

  // Phase 29: Allow manual imports as backup even when Basiq is active
  // Data will be merged and deduplicated with Basiq transactions
  return {
    canImport: true,
    isBackupMode: true,
    reason: 'Manual import allowed as backup to Open Banking',
    basiqStatus: 'ACTIVE',
    warning: 'This account is connected to Open Banking. Manual imports will be merged with bank data. Duplicates will be automatically detected and skipped.',
  };
}

/**
 * Merge manual import with Basiq transactions
 * Deduplicates and combines data from both sources
 */
export async function mergeManualImportWithBasiq(
  userId: string,
  accountId: string,
  manualTransactions: NormalisedTransaction[]
): Promise<{
  imported: number;
  duplicatesSkipped: number;
  merged: number;
}> {
  // Get existing Basiq transactions in the same date range
  const dates = manualTransactions.map(t => t.date.getTime());
  const startDate = new Date(Math.min(...dates));
  const endDate = new Date(Math.max(...dates));

  // Expand date range slightly for fuzzy matching
  startDate.setDate(startDate.getDate() - 3);
  endDate.setDate(endDate.getDate() + 3);

  const existingTransactions = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      accountId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      direction: true,
      description: true,
      merchantStandardised: true,
      source: true,
    },
  });

  let imported = 0;
  let duplicatesSkipped = 0;
  let merged = 0;

  for (const manualTx of manualTransactions) {
    // Check for duplicate
    const duplicate = existingTransactions.find(existing => {
      // Same amount and direction
      if (Math.abs(existing.amount - manualTx.amount) > 0.01) return false;
      if (existing.direction !== manualTx.direction) return false;

      // Within 3 days
      const daysDiff = Math.abs(
        (existing.date.getTime() - manualTx.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 3) return false;

      // Similar description
      const descSimilarity = stringSimilarity(
        existing.description.toLowerCase(),
        manualTx.description.toLowerCase()
      );
      return descSimilarity > 0.7;
    });

    if (duplicate) {
      duplicatesSkipped++;

      // If Basiq transaction, we might want to merge enrichment data
      if (duplicate.source === 'BASIQ' && manualTx.merchantStandardised) {
        // Merge: prefer manual merchant name if Basiq doesn't have it
        if (!duplicate.merchantStandardised) {
          await prisma.unifiedTransaction.update({
            where: { id: duplicate.id },
            data: { merchantStandardised: manualTx.merchantStandardised },
          });
          merged++;
        }
      }
    } else {
      imported++;
    }
  }

  return { imported, duplicatesSkipped, merged };
}

/**
 * Calculate string similarity for deduplication
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  const s1Words = str1.split(/\s+/);
  const s2Words = str2.split(/\s+/);

  for (const w1 of s1Words) {
    if (s2Words.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matches++;
    }
  }

  return matches / Math.max(s1Words.length, s2Words.length);
}

/**
 * Get transaction count by source for an account
 */
export async function getTransactionSourceCounts(
  userId: string,
  accountId: string
): Promise<Record<string, number>> {
  const counts = await prisma.unifiedTransaction.groupBy({
    by: ['source'],
    where: {
      userId,
      accountId,
      NOT: {
        tags: { has: 'SUPERSEDED_BY_BASIQ' },
      },
    },
    _count: true,
  });

  return counts.reduce((acc, item) => {
    acc[item.source] = item._count;
    return acc;
  }, {} as Record<string, number>);
}
