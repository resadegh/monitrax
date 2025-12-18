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
 */

import { PrismaClient } from '@prisma/client';
import { getTransactions, getAccount, mapBasiqTransactionDirection } from '@/lib/basiq';
import { cleanMerchantName } from '@/lib/tie';
import { categoriseTransactions } from './categorisation';
import { generateHash } from './normalisation';
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

    // Step 3: Process and import Basiq transactions
    const imported = await importBasiqTransactions(
      userId,
      accountId,
      account.basiqAccountId,
      basiqTransactions
    );
    result.transactionsImported = imported;

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
      data: { lastSynced: new Date() },
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
      merchantStandardised: merchantCleaned,
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
 * Check if an account can accept manual imports
 * Returns false if account is Basiq-connected and active
 */
export async function canAcceptManualImport(accountId: string): Promise<{
  canImport: boolean;
  reason?: string;
  basiqStatus?: string;
}> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { basiqConnection: true },
  });

  if (!account) {
    return { canImport: false, reason: 'Account not found' };
  }

  // If not connected to Basiq, allow manual imports
  if (!account.basiqAccountId || !account.basiqConnection) {
    return { canImport: true };
  }

  // If Basiq connection is not active, allow manual imports
  if (account.basiqConnection.status !== 'ACTIVE') {
    return {
      canImport: true,
      reason: 'Basiq connection is not active',
      basiqStatus: account.basiqConnection.status,
    };
  }

  // Basiq is active - don't allow manual imports
  return {
    canImport: false,
    reason: 'This account is connected to Open Banking. Transactions are synced automatically from your bank.',
    basiqStatus: 'ACTIVE',
  };
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
