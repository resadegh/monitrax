/**
 * UNIFIED TRANSACTIONS API
 * Phase 13 - Transactional Intelligence
 *
 * GET  - List unified transactions with filtering
 * POST - Create/import unified transactions
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.6
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  categoriseTransaction,
  cleanMerchantName,
  normaliseAmount,
  parseTransactionDate,
  generateDeduplicationHash,
  CATEGORY_HIERARCHY,
} from '@/lib/tie';

// =============================================================================
// GET - List Unified Transactions
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);

      // Pagination
      const page = parseInt(searchParams.get('page') || '1');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const skip = (page - 1) * limit;

      // Filters
      const accountId = searchParams.get('accountId');
      const categoryLevel1 = searchParams.get('category');
      const merchantStandardised = searchParams.get('merchant');
      const isRecurring = searchParams.get('recurring');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const search = searchParams.get('search');
      const source = searchParams.get('source');
      const hasAnomalies = searchParams.get('hasAnomalies');

      // Build where clause
      const where: Record<string, unknown> = {
        userId: authReq.user!.userId,
      };

      if (accountId) where.accountId = accountId;
      if (categoryLevel1) where.categoryLevel1 = categoryLevel1;
      if (merchantStandardised) {
        where.merchantStandardised = {
          contains: merchantStandardised,
          mode: 'insensitive',
        };
      }
      if (isRecurring === 'true') where.isRecurring = true;
      if (isRecurring === 'false') where.isRecurring = false;
      if (source) where.source = source;
      if (hasAnomalies === 'true') {
        where.anomalyFlags = { isEmpty: false };
      }

      if (startDate || endDate) {
        where.date = {};
        if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
        if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
      }

      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { merchantStandardised: { contains: search, mode: 'insensitive' } },
          { merchantRaw: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Fetch transactions
      const [transactions, total] = await Promise.all([
        prisma.unifiedTransaction.findMany({
          where,
          include: { account: true },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.unifiedTransaction.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Get unified transactions error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Create Unified Transaction(s)
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const userId = authReq.user!.userId;

      // Check if batch import
      if (Array.isArray(body.transactions)) {
        return handleBatchImport(body.transactions, userId, body.accountId);
      }

      // Single transaction creation
      const {
        accountId,
        date,
        amount,
        description,
        direction,
        merchantRaw,
        categoryLevel1,
        categoryLevel2,
        tags,
        source = 'MANUAL',
      } = body;

      // Validate required fields
      if (!accountId || !date || amount === undefined || !description) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: accountId, date, amount, description' },
          { status: 400 }
        );
      }

      // Validate account ownership
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account || account.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Account not found or unauthorized' },
          { status: 403 }
        );
      }

      // Parse and normalise
      const parsedDate = parseTransactionDate(date);
      const { amount: normalisedAmount, direction: normalisedDirection } = normaliseAmount(
        parseFloat(amount),
        direction
      );
      const merchantCleaned = cleanMerchantName(merchantRaw || description);

      // Auto-categorise if not provided
      let finalCategory1 = categoryLevel1;
      let finalCategory2 = categoryLevel2;
      let confidenceScore = 1.0;

      if (!categoryLevel1) {
        const tempTx = {
          id: 'temp',
          userId,
          accountId,
          date: parsedDate,
          postDate: null,
          amount: normalisedAmount,
          currency: 'AUD',
          direction: normalisedDirection,
          merchantRaw: merchantRaw || description,
          merchantStandardised: merchantCleaned,
          merchantCategoryCode: null,
          description,
          categoryLevel1: null,
          categoryLevel2: null,
          subcategory: null,
          tags: [],
          userCorrectedCategory: false,
          confidenceScore: null,
          isRecurring: false,
          recurrencePattern: null,
          recurrenceGroupId: null,
          anomalyFlags: [],
          source: source as 'MANUAL' | 'CSV' | 'BANK' | 'OFX',
          externalId: null,
          importBatchId: null,
          propertyId: null,
          loanId: null,
          incomeId: null,
          expenseId: null,
          investmentAccountId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          processedAt: null,
        };

        const categorisation = await categoriseTransaction(tempTx);
        finalCategory1 = categorisation.categoryLevel1;
        finalCategory2 = categorisation.categoryLevel2;
        confidenceScore = categorisation.confidence;
      }

      // Create transaction
      const transaction = await prisma.unifiedTransaction.create({
        data: {
          userId,
          accountId,
          date: parsedDate,
          amount: normalisedAmount,
          currency: 'AUD',
          direction: normalisedDirection,
          merchantRaw: merchantRaw || description,
          merchantStandardised: merchantCleaned,
          description,
          categoryLevel1: finalCategory1,
          categoryLevel2: finalCategory2,
          tags: tags || [],
          userCorrectedCategory: !!categoryLevel1,
          confidenceScore,
          source,
          processedAt: new Date(),
        },
        include: { account: true },
      });

      return NextResponse.json(
        { success: true, data: transaction },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create unified transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// BATCH IMPORT HANDLER
// =============================================================================

async function handleBatchImport(
  transactions: Array<{
    date: string;
    amount: number;
    description: string;
    direction?: 'IN' | 'OUT';
    merchantRaw?: string;
  }>,
  userId: string,
  accountId: string
): Promise<NextResponse> {
  if (!accountId) {
    return NextResponse.json(
      { success: false, error: 'accountId is required for batch import' },
      { status: 400 }
    );
  }

  // Validate account ownership
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account || account.userId !== userId) {
    return NextResponse.json(
      { success: false, error: 'Account not found or unauthorized' },
      { status: 403 }
    );
  }

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const results = {
    imported: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [] as { row: number; message: string }[],
  };

  // Get existing hashes for deduplication
  const existingTransactions = await prisma.unifiedTransaction.findMany({
    where: { userId, accountId },
    select: { date: true, amount: true, description: true },
  });

  const existingHashes = new Set(
    existingTransactions.map((tx: typeof existingTransactions[number]) =>
      generateDeduplicationHash(accountId, tx.date, tx.amount, tx.description)
    )
  );

  // Process each transaction
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    try {
      const parsedDate = parseTransactionDate(tx.date);
      const { amount, direction } = normaliseAmount(tx.amount, tx.direction);

      // Check for duplicates
      const hash = generateDeduplicationHash(accountId, parsedDate, amount, tx.description);
      if (existingHashes.has(hash)) {
        results.duplicates++;
        continue;
      }
      existingHashes.add(hash);

      const merchantCleaned = cleanMerchantName(tx.merchantRaw || tx.description);

      // Auto-categorise
      const tempTx = {
        id: 'temp',
        userId,
        accountId,
        date: parsedDate,
        postDate: null,
        amount,
        currency: 'AUD',
        direction,
        merchantRaw: tx.merchantRaw || tx.description,
        merchantStandardised: merchantCleaned,
        merchantCategoryCode: null,
        description: tx.description,
        categoryLevel1: null,
        categoryLevel2: null,
        subcategory: null,
        tags: [],
        userCorrectedCategory: false,
        confidenceScore: null,
        isRecurring: false,
        recurrencePattern: null,
        recurrenceGroupId: null,
        anomalyFlags: [],
        source: 'CSV' as const,
        externalId: null,
        importBatchId: batchId,
        propertyId: null,
        loanId: null,
        incomeId: null,
        expenseId: null,
        investmentAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        processedAt: null,
      };

      const categorisation = await categoriseTransaction(tempTx);

      // Create transaction
      await prisma.unifiedTransaction.create({
        data: {
          userId,
          accountId,
          date: parsedDate,
          amount,
          currency: 'AUD',
          direction,
          merchantRaw: tx.merchantRaw || tx.description,
          merchantStandardised: merchantCleaned,
          description: tx.description,
          categoryLevel1: categorisation.categoryLevel1,
          categoryLevel2: categorisation.categoryLevel2,
          confidenceScore: categorisation.confidence,
          source: 'CSV',
          importBatchId: batchId,
          processedAt: new Date(),
        },
      });

      results.imported++;
    } catch (error) {
      results.errors++;
      results.errorDetails.push({
        row: i + 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      batchId,
      ...results,
      total: transactions.length,
    },
  });
}
