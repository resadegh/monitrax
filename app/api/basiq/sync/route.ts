/**
 * Basiq Sync API
 * Syncs accounts and transactions from Basiq to local database
 *
 * POST /api/basiq/sync
 * Body: { connectionId?: string } - Optional: sync specific connection, or all if omitted
 * Returns: { accountsSynced: number, transactionsSynced: number }
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  getAccounts,
  getTransactions,
  refreshConnection,
  mapBasiqAccountType,
  type BasiqAccount,
  type BasiqTransaction,
} from '@/lib/basiq';

export const POST = withPermission('account.write', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body = await request.json().catch(() => ({}));
    const { connectionId } = body;

    // Get user's Basiq user ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { basiqUserId: true },
    });

    if (!user?.basiqUserId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'No Basiq connection found. Please connect a bank first.' },
        },
        { status: 404 }
      );
    }

    // Get connections to sync
    const connectionsQuery = connectionId
      ? { userId, id: connectionId }
      : { userId, status: 'ACTIVE' as const };

    const connections = await prisma.basiqConnection.findMany({
      where: connectionsQuery,
    });

    if (connections.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'No active connections to sync' },
        },
        { status: 404 }
      );
    }

    let accountsSynced = 0;
    let transactionsSynced = 0;
    const errors: string[] = [];

    // Refresh connections first
    for (const connection of connections) {
      try {
        await refreshConnection(user.basiqUserId, connection.basiqConnectionId);
      } catch (refreshError) {
        console.warn(`Failed to refresh connection ${connection.id}:`, refreshError);
      }
    }

    // Wait a moment for Basiq to process the refresh
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Fetch and sync accounts
    const basiqAccounts = await getAccounts(user.basiqUserId);

    for (const basiqAccount of basiqAccounts) {
      try {
        const synced = await syncAccount(userId, basiqAccount, connections);
        if (synced) accountsSynced++;
      } catch (accountError) {
        console.error(`Failed to sync account ${basiqAccount.id}:`, accountError);
        errors.push(`Account ${basiqAccount.name}: ${accountError}`);
      }
    }

    // Fetch and sync transactions
    const basiqTransactions = await getTransactions(user.basiqUserId, { limit: 500 });

    for (const basiqTransaction of basiqTransactions) {
      try {
        const synced = await syncTransaction(userId, basiqTransaction);
        if (synced) transactionsSynced++;
      } catch (txError) {
        console.error(`Failed to sync transaction ${basiqTransaction.id}:`, txError);
        errors.push(`Transaction: ${txError}`);
      }
    }

    // Update connection sync timestamps
    await prisma.basiqConnection.updateMany({
      where: { id: { in: connections.map((c: typeof connections[number]) => c.id) } },
      data: { lastSyncedAt: new Date(), lastSyncError: errors.length > 0 ? errors.join('; ') : null },
    });

    return NextResponse.json({
      success: true,
      data: {
        accountsSynced,
        transactionsSynced,
        errors: errors.length > 0 ? errors : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error syncing Basiq data:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync bank data',
        },
      },
      { status: 500 }
    );
  }
});

async function syncAccount(
  userId: string,
  basiqAccount: BasiqAccount,
  connections: { id: string; basiqConnectionId: string }[]
): Promise<boolean> {
  // Find the connection this account belongs to
  const connection = connections.find((c) => c.basiqConnectionId === basiqAccount.connection);

  // Check if account already exists
  const existingAccount = await prisma.account.findUnique({
    where: { basiqAccountId: basiqAccount.id },
  });

  const accountData = {
    name: basiqAccount.name,
    type: mapBasiqAccountType(basiqAccount.class?.type || 'transaction'),
    institution: basiqAccount.institution,
    currentBalance: basiqAccount.balance,
    accountNumber: basiqAccount.accountNo,
    basiqConnectionId: connection?.id,
    basiqLastSynced: new Date(),
  };

  if (existingAccount) {
    // Update existing account
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: accountData,
    });
  } else {
    // Create new account
    await prisma.account.create({
      data: {
        userId,
        basiqAccountId: basiqAccount.id,
        ...accountData,
      },
    });
  }

  return true;
}

async function syncTransaction(userId: string, basiqTx: BasiqTransaction): Promise<boolean> {
  // Check if transaction already exists
  const existingTransaction = await prisma.unifiedTransaction.findUnique({
    where: { basiqTransactionId: basiqTx.id },
  });

  if (existingTransaction) {
    // Transaction already synced
    return false;
  }

  // Find the local account for this transaction
  const account = await prisma.account.findFirst({
    where: {
      userId,
      OR: [
        { basiqAccountId: basiqTx.account },
        { name: { contains: basiqTx.account } },
      ],
    },
  });

  if (!account) {
    // Skip transactions for accounts we don't have
    return false;
  }

  // Map Basiq transaction to UnifiedTransaction
  const direction = basiqTx.direction === 'credit' ? 'IN' : 'OUT';

  // Extract category from Basiq enrichment if available
  const categoryLevel1 = basiqTx.enrich?.category?.anzsic?.title || null;
  const merchantStandardised = basiqTx.enrich?.merchant?.businessName || null;

  await prisma.unifiedTransaction.create({
    data: {
      userId,
      accountId: account.id,
      date: new Date(basiqTx.transactionDate),
      postDate: basiqTx.postDate ? new Date(basiqTx.postDate) : null,
      amount: Math.abs(basiqTx.amount),
      currency: 'AUD',
      direction,
      merchantRaw: basiqTx.description,
      merchantStandardised,
      description: basiqTx.description,
      categoryLevel1,
      categoryLevel2: basiqTx.subClass?.title || null,
      source: 'BANK',
      basiqTransactionId: basiqTx.id,
      externalId: basiqTx.id,
    },
  });

  return true;
}
