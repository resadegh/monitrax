/**
 * UNIFIED TRANSACTIONS API
 * Phase 13 - Transactional Intelligence
 *
 * GET  - List unified transactions with filtering
 * POST - Create/import unified transactions
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.6
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  categoriseTransaction,
  cleanMerchantName,
  normaliseAmount,
  parseTransactionDate,
  generateDeduplicationHash,
  CATEGORY_HIERARCHY,
} from '@/lib/tie';
import { resolveOrCreateCategory } from '@/lib/bookkeeping/categoryRegistry';
import { replaceSplits } from '@/lib/bookkeeping/splits';
import {
  computeBalanceSanityCheck,
  computeDedupPreview,
} from '@/lib/bookkeeping/importSanity';
import { lookupMCC } from '@/lib/bank/mccCatalog';
import { getLearnedCategorySuggestions } from '@/lib/bookkeeping/applyToSimilarUnified';

// =============================================================================
// GET - List Unified Transactions
// =============================================================================

export const GET = withPermission('transaction.read', async (request, auth) => {
    try {
      const userId = auth.userId;
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
      const isTransfer = searchParams.get('isTransfer');
      const excludeTransfers = searchParams.get('excludeTransfers');
      const uncategorized = searchParams.get('uncategorized');
      const direction = searchParams.get('direction');
      // Phase 49.14 — confidence-band filter (Reza: band chips on the
      // bookkeeper card act as list filters). Bands mirror the import
      // thresholds: high ≥0.9, medium 0.7–0.9, low <0.7 (score 0 = AI
      // fallback rows included; NULL = no AI involvement, excluded).
      const confidence = searchParams.get('confidence');

      // Build where clause
      const where: Record<string, unknown> = {
        userId: auth.userId,
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
      if (isTransfer === 'true') where.isTransfer = true;
      if (isTransfer === 'false') where.isTransfer = false;
      if (excludeTransfers === 'true') where.isTransfer = { not: true };
      if (direction) where.direction = direction;
      if (confidence === 'high') where.confidenceScore = { gte: 0.9 };
      if (confidence === 'medium') where.confidenceScore = { gte: 0.7, lt: 0.9 };
      if (confidence === 'low') where.confidenceScore = { lt: 0.7, not: null };

      // Uncategorized filter: transactions available for categorization.
      // Per Reza directive 2026-05-08 — once a tx has a categoryLevel1
      // set (whether by AI auto-categorisation or by the user via the
      // swipe-to-categorise picker), it's no longer "uncategorised."
      // Previously this filter only checked link-status, so categorising
      // via the picker left the row visible — confusing UX. The filter
      // now requires BOTH unlinked AND no categoryLevel1.
      // SSOT note: lib/bookkeeping/engagement/pendingActions.ts MUST
      // mirror this filter so badge count == visible row count.
      if (uncategorized === 'true') {
        where.incomeId = null;
        where.expenseId = null;
        where.loanId = null;
        where.isTransfer = { not: true }; // false or null
        where.isInvestmentContribution = { not: true }; // false or null
        // 2026-05-08 v2 — final correct semantic. "Uncategorised" =
        // "user hasn't reviewed it yet" = `userCorrectedCategory !=
        // true`. When the user PATCHes a category via the swipe
        // picker, the [id] route sets `userCorrectedCategory = true`
        // (see unified-transactions/[id]/route.ts:~120). So:
        //   - AI auto-classified tx → userCorrectedCategory = false → shown
        //   - User-confirmed via picker → userCorrectedCategory = true → hidden
        //
        // Earlier iterations of this filter zigzagged between
        // (a) `userCorrectedCategory = false` (PR #714 — too few),
        // (b) link-status only (PR #715 — too many),
        // (c) `categoryLevel1 IS NULL OR ''` (PR #719 — too few again
        //     because AI sets categoryLevel1 on every imported tx).
        // (a) is correct; locking it here.
        where.userCorrectedCategory = { not: true };
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

      // Neobrain suggestion enrichment — for rows the user hasn't categorised,
      // attach a learned-category suggestion from the user's own merchantMapping
      // (§ getLearnedCategorySuggestions). The reconciliation UI shows this as a
      // one-tap "Suggested" pill. One extra query for the whole page.
      const uncategorisedRows = transactions.filter(
        (t) => !t.userCorrectedCategory && !t.incomeId && !t.expenseId && !t.loanId && !t.isTransfer,
      );
      const suggestions = await getLearnedCategorySuggestions(
        userId,
        uncategorisedRows.map((t) => t.merchantStandardised),
      );
      const data = transactions.map((t) => {
        const suggestedCategoryLevel1 =
          !t.userCorrectedCategory && !t.incomeId && !t.expenseId && !t.loanId && !t.isTransfer && t.merchantStandardised
            ? suggestions.get(t.merchantStandardised) ?? null
            : null;
        return { ...t, suggestedCategoryLevel1 };
      });

      return NextResponse.json({
        success: true,
        data,
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

// =============================================================================
// POST - Create Unified Transaction(s)
// =============================================================================

export const POST = withPermission('transaction.write', async (request, auth) => {
    try {
      const body = await request.json();
      const userId = auth.userId;

      // Check if batch import
      if (Array.isArray(body.transactions)) {
        return handleBatchImport(
          body.transactions,
          userId,
          body.accountId,
          {
            openingBalance: typeof body.openingBalance === 'number' ? body.openingBalance : null,
            closingBalance: typeof body.closingBalance === 'number' ? body.closingBalance : null,
            dryRun: body.dryRun === true,
            source: typeof body.source === 'string' ? body.source : 'CSV',
          }
        );
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

// =============================================================================
// BATCH IMPORT HANDLER
// =============================================================================

interface BatchImportOptions {
  openingBalance: number | null;
  closingBalance: number | null;
  /** Phase 42 PR4 — when true, returns dedup-preview + sanity-check WITHOUT writing rows. */
  dryRun: boolean;
  /** Source of the import (CSV / QIF / OFX). Defaults to CSV for backwards-compat. */
  source: string;
}

async function handleBatchImport(
  transactions: Array<{
    date: string;
    amount: number;
    description: string;
    direction?: 'IN' | 'OUT';
    merchantRaw?: string;
    /**
     * Phase 42 PR2 — per-line splits propagated from the parser
     * (QIF supports `S`/`$` fields). If present, sum(splits[].amount)
     * MUST equal `amount` (validated at write time by
     * `lib/bookkeeping/splits.ts:assertSplitsBalance`).
     */
    splits?: Array<{ amount: number; category?: string; memo?: string }>;
    /** Phase 42 PR4 — QIF `L` field, MCC seed via the catalog. */
    bankSuppliedCategory?: string;
  }>,
  userId: string,
  accountId: string,
  options: BatchImportOptions = {
    openingBalance: null,
    closingBalance: null,
    dryRun: false,
    source: 'CSV',
  }
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

  // Phase 42 PR4 — dry-run preview path. Returns the dedup-preview +
  // balance sanity-check WITHOUT writing any rows. The Import Wizard
  // calls this before the real commit so the user sees "12 of 50
  // would be duplicates — merge / overwrite / skip?" up front.
  if (options.dryRun) {
    return buildDryRunPreview(transactions, userId, accountId, options);
  }

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const results = {
    imported: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [] as { row: number; message: string }[],
    /** Phase 42 PR4 — running signed sum used by the sanity-check banner. */
    importedSignedSum: 0,
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

      // Phase 42 PR4 — MCC seed at write time. BASIQ ships MCC
      // natively; QIF / CSV / OFX rows get it from
      // `lib/bank/mccCatalog.ts`. Per CLAUDE.md §12.2 SSOT — one
      // place, one lookup. When BASIQ later supersedes the row
      // (Phase 13.10), BASIQ-supplied MCC overrides automatically.
      const mccEntry = lookupMCC(merchantCleaned);

      // Create transaction
      const created = await prisma.unifiedTransaction.create({
        data: {
          userId,
          accountId,
          date: parsedDate,
          amount,
          currency: 'AUD',
          direction,
          merchantRaw: tx.merchantRaw || tx.description,
          merchantStandardised: merchantCleaned,
          merchantCategoryCode: mccEntry?.mcc ?? null,
          description: tx.description,
          categoryLevel1: categorisation.categoryLevel1,
          categoryLevel2: categorisation.categoryLevel2,
          confidenceScore: categorisation.confidence,
          source: options.source as any,
          importBatchId: batchId,
          processedAt: new Date(),
        },
      });

      // Phase 42 PR2 — propagate parser-extracted splits (QIF `S`/`$`).
      // SSOT path: every split's category resolves through
      // `resolveOrCreateCategory` (no parallel category writes); sum
      // validation runs in `replaceSplits` (no inline calc duplication).
      // If validation fails the import logs an error for the row and
      // continues — the parent transaction stays without splits, and
      // the user can fix it manually from the UI later.
      if (tx.splits && tx.splits.length > 0) {
        try {
          const resolvedSplits = await Promise.all(
            tx.splits.map(async (s) => {
              const rawCategory = s.category?.trim() || categorisation.categoryLevel1 || 'Uncategorised';
              const registryRow = await resolveOrCreateCategory({
                userId,
                level1: rawCategory,
                level2: null,
                subcategory: null,
              });
              return {
                amount: s.amount,
                categoryId: registryRow.id,
                note: s.memo ?? null,
              };
            })
          );
          await replaceSplits({
            transactionId: created.id,
            userId,
            splits: resolvedSplits,
            source: 'IMPORT',
          });
        } catch (splitErr) {
          results.errors++;
          results.errorDetails.push({
            row: i + 1,
            message: `Split validation failed: ${
              splitErr instanceof Error ? splitErr.message : String(splitErr)
            }`,
          });
        }
      }

      // Track signed sum for the Phase 42 PR4 sanity check.
      results.importedSignedSum += direction === 'OUT' ? -Math.abs(amount) : Math.abs(amount);

      results.imported++;
    } catch (error) {
      results.errors++;
      results.errorDetails.push({
        row: i + 1,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Phase 42 PR4 — sanity-check banner data. Pure helper; surfaces a
  // "$X gap between imported transactions and closing balance" message
  // when the source file's stated opening + closing don't reconcile.
  const sanity = computeBalanceSanityCheck({
    openingBalance: options.openingBalance,
    closingBalance: options.closingBalance,
    importedSum: results.importedSignedSum,
  });

  return NextResponse.json({
    success: true,
    data: {
      batchId,
      ...results,
      total: transactions.length,
      sanity,
    },
  });
}

/**
 * Phase 42 PR4 — Dry-run preview of a batch import.
 *
 * Runs the cross-batch dedup check + balance sanity-check against the
 * candidates WITHOUT writing any rows. Returns counts + a small
 * sample of duplicate matches so the Import Wizard can render a
 * merge / overwrite / skip picker before the user commits.
 *
 * Per CLAUDE.md §12.3 — composes existing helpers; no parallel
 * dedup or sanity logic.
 */
async function buildDryRunPreview(
  transactions: Array<{
    date: string;
    amount: number;
    description: string;
    direction?: 'IN' | 'OUT';
    merchantRaw?: string;
  }>,
  userId: string,
  accountId: string,
  options: BatchImportOptions
): Promise<NextResponse> {
  const existing = await prisma.unifiedTransaction.findMany({
    where: { userId, accountId },
    select: {
      id: true,
      accountId: true,
      date: true,
      amount: true,
      description: true,
      merchantStandardised: true,
      source: true,
    },
  });

  // Build the candidate list (parsing dates + signing amounts).
  const candidates: import('@/lib/bookkeeping/importSanity').DedupPreviewCandidate[] = [];
  let candidateSignedSum = 0;
  for (const tx of transactions) {
    try {
      const date = parseTransactionDate(tx.date);
      const { amount, direction } = normaliseAmount(tx.amount, tx.direction);
      const signed = direction === 'OUT' ? -Math.abs(amount) : Math.abs(amount);
      candidateSignedSum += signed;
      candidates.push({
        date,
        amount: signed,
        description: tx.description,
        merchantStandardised: cleanMerchantName(tx.merchantRaw || tx.description),
        source: options.source,
      });
    } catch {
      // Skip invalid rows for preview purposes
    }
  }

  const dedup = computeDedupPreview(
    candidates,
    existing.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      date: row.date,
      amount: row.amount,
      description: row.description,
      merchantStandardised: row.merchantStandardised,
      source: row.source,
    })),
    accountId
  );

  const sanity = computeBalanceSanityCheck({
    openingBalance: options.openingBalance,
    closingBalance: options.closingBalance,
    importedSum: candidateSignedSum,
  });

  return NextResponse.json({
    success: true,
    data: {
      dryRun: true,
      total: transactions.length,
      ...dedup,
      sanity,
    },
  });
}
