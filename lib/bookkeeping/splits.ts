/**
 * Phase 42 PR2 — Transaction split service.
 *
 * Single source of truth for "what does it mean for a set of splits to
 * be valid?". Per Phase 42 spec §3 D-42-2 hard rule:
 *
 *   sum(splits[].amount) == transaction.amount   (± $0.01 rounding)
 *
 * Validation lives at the service layer — Postgres CHECK constraints
 * can't reference aggregates across rows in another table. Every
 * mutation path (the API, the QIF importer, the future bulk-paste UI)
 * MUST go through `replaceSplits()` here. Per CLAUDE.md §12.3 (single
 * calculation engine — no competing implementations).
 *
 * The parent transaction's `categoryLevel*` fields stay populated for
 * backwards-compat with `getMasterFinancialSnapshot`, the expense /
 * income aggregators, and `lib/utils/reconciliation`. After every
 * `replaceSplits()` call, the dominant split's category is propagated
 * up to the parent so downstream engines never need to know about
 * splits at v1.
 *
 * Audit: every split mutation writes a `TransactionEdit` row with
 * editType=SPLIT (fire-and-forget; pairs with the read-side
 * PRO_DASHBOARD_VIEW audit from Phase 32B PR3).
 */

import prisma from '@/lib/db';
import type { TransactionSplit, UnifiedTransaction } from '@prisma/client';
import { recordTransactionEdit } from './transactionEditAudit';
import { resolveOrCreateCategory } from './categoryRegistry';

/** Tolerance for sum-of-splits === transaction.amount (cents-level rounding). */
export const SPLIT_SUM_EPSILON = 0.01;

export interface SplitInput {
  amount: number;
  /** Resolved registry ID. Use `resolveOrCreateCategoryForSplit()` to obtain. */
  categoryId: string;
  propertyId?: string | null;
  loanId?: string | null;
  expenseId?: string | null;
  isTaxDeductible?: boolean;
  note?: string | null;
}

export interface ReplaceSplitsOptions {
  transactionId: string;
  userId: string;
  splits: SplitInput[];
  /** Audit-trail attribution. Defaults to USER. */
  source?: 'USER' | 'AI' | 'RULE' | 'IMPORT' | 'SYSTEM';
}

export class SplitValidationError extends Error {
  constructor(
    message: string,
    public code:
      | 'EMPTY_SPLITS'
      | 'NEGATIVE_AMOUNT'
      | 'SUM_MISMATCH'
      | 'CATEGORY_NOT_FOUND'
      | 'TX_NOT_FOUND'
      | 'NOT_OWNER'
      | 'PERIOD_LOCKED'
  ) {
    super(message);
    this.name = 'SplitValidationError';
  }
}

/**
 * Throws `SplitValidationError` if the proposed splits don't balance
 * the parent transaction's amount within `SPLIT_SUM_EPSILON`. Empty
 * splits arrays are also rejected — the caller is asking for "no
 * splits" which means deleting the row(s), use `clearSplits()` for that.
 *
 * Sign rule: split amounts must match the parent's sign convention.
 * For an OUT transaction (-$300), splits sum to -$300 (-$240 + -$60).
 * For an IN transaction ($1200), splits sum to $1200. We don't enforce
 * the sign per-split; we enforce the SUM matches the parent.
 */
export function assertSplitsBalance(
  parentAmount: number,
  splits: Pick<SplitInput, 'amount'>[]
): void {
  if (splits.length === 0) {
    throw new SplitValidationError(
      'splits[] is empty — use clearSplits() to remove all splits from a transaction',
      'EMPTY_SPLITS'
    );
  }
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  const diff = Math.abs(sum - parentAmount);
  if (diff > SPLIT_SUM_EPSILON) {
    throw new SplitValidationError(
      `Sum of splits (${sum.toFixed(2)}) does not match transaction.amount (${parentAmount.toFixed(2)}). Difference: ${diff.toFixed(2)}.`,
      'SUM_MISMATCH'
    );
  }
}

/**
 * Resolve a (level1, level2, subcategory) triple into a registry ID
 * the split rows can FK to. Convenience wrapper around
 * `resolveOrCreateCategory()` from `categoryRegistry.ts`.
 */
export async function resolveOrCreateCategoryForSplit(input: {
  userId: string;
  level1: string;
  level2?: string | null;
  subcategory?: string | null;
}): Promise<string> {
  const row = await resolveOrCreateCategory(input);
  return row.id;
}

/**
 * Pick the *dominant* split — largest absolute amount, ties broken by
 * earliest createdAt. Used to back-fill the parent transaction's
 * `categoryLevel*` fields so downstream engines (which don't know
 * about splits) keep working.
 */
function pickDominant<T extends { amount: number; createdAt?: Date }>(splits: T[]): T {
  return [...splits].sort((a, b) => {
    const byAmt = Math.abs(b.amount) - Math.abs(a.amount);
    if (byAmt !== 0) return byAmt;
    const aCreated = a.createdAt?.getTime() ?? 0;
    const bCreated = b.createdAt?.getTime() ?? 0;
    return aCreated - bCreated;
  })[0];
}

/**
 * Replace ALL splits on a transaction with the given list. This is the
 * canonical mutation entry point — every API + importer goes through here.
 *
 * Steps:
 *   1. Verify the transaction exists and the caller owns it
 *   2. Validate the new splits balance to the transaction amount
 *   3. Verify every categoryId resolves to a CanonicalCategoryRegistry
 *      row owned by the same user (defence against cross-user FK abuse)
 *   4. Inside a single Prisma transaction:
 *        a. Read existing splits (for audit `before`)
 *        b. Delete existing splits
 *        c. Create the new ones
 *        d. Propagate the dominant split's category up to the parent
 *           transaction's `categoryLevel*` fields
 *   5. Fire-and-forget audit log (editType=SPLIT)
 */
export async function replaceSplits(
  options: ReplaceSplitsOptions
): Promise<{ transaction: UnifiedTransaction; splits: TransactionSplit[] }> {
  const { transactionId, userId, splits } = options;
  const source = options.source ?? 'USER';

  if (splits.some((s) => !Number.isFinite(s.amount))) {
    throw new SplitValidationError('Split amounts must be finite numbers', 'NEGATIVE_AMOUNT');
  }

  const tx = await prisma.unifiedTransaction.findUnique({
    where: { id: transactionId },
    select: { id: true, userId: true, amount: true, date: true },
  });
  if (!tx) {
    throw new SplitValidationError(`Transaction ${transactionId} not found`, 'TX_NOT_FOUND');
  }
  if (tx.userId !== userId) {
    throw new SplitValidationError('Caller does not own this transaction', 'NOT_OWNER');
  }

  // Validate sum FIRST — fast-fail before any DB writes.
  assertSplitsBalance(tx.amount, splits);

  // Validate every category belongs to the calling user. Single query
  // covers all distinct categoryIds. Per CLAUDE.md §12.5 (least privilege):
  // a malicious caller cannot link a split to another user's category.
  const distinctCategoryIds = Array.from(new Set(splits.map((s) => s.categoryId)));
  const categoryRows = await prisma.canonicalCategoryRegistry.findMany({
    where: { id: { in: distinctCategoryIds }, userId },
    select: { id: true, level1: true, level2: true, subcategory: true },
  });
  if (categoryRows.length !== distinctCategoryIds.length) {
    throw new SplitValidationError(
      'One or more categoryId values do not exist or belong to another user',
      'CATEGORY_NOT_FOUND'
    );
  }
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  // Read-then-delete-then-create inside a single transaction. Prisma
  // doesn't have a real "replace" primitive; this is the canonical
  // Phase 42 pattern and is mirrored in the audit before/after below.
  const result = await prisma.$transaction(async (txnCtx) => {
    const existingSplits = await txnCtx.transactionSplit.findMany({
      where: { transactionId },
    });

    await txnCtx.transactionSplit.deleteMany({ where: { transactionId } });

    const created = await Promise.all(
      splits.map((s) =>
        txnCtx.transactionSplit.create({
          data: {
            transactionId,
            categoryId: s.categoryId,
            amount: s.amount,
            propertyId: s.propertyId ?? null,
            loanId: s.loanId ?? null,
            expenseId: s.expenseId ?? null,
            isTaxDeductible: s.isTaxDeductible ?? false,
            note: s.note ?? null,
          },
        })
      )
    );

    // Propagate dominant split's category up to the parent. Backwards-
    // compat: every canonical engine reads the parent's categoryLevel*
    // — they don't traverse splits at v1.
    const dominant = pickDominant(created);
    const dominantCategory = categoryById.get(dominant.categoryId);
    const parent = await txnCtx.unifiedTransaction.update({
      where: { id: transactionId },
      data: {
        categoryLevel1: dominantCategory?.level1 ?? null,
        categoryLevel2: dominantCategory?.level2 ?? null,
        subcategory: dominantCategory?.subcategory ?? null,
        userCorrectedCategory: true,
        confidenceScore: 1.0,
      },
    });

    return { transaction: parent, splits: created, existingSplits };
  });

  // Fire-and-forget audit. Snapshot before/after of the splits array.
  recordTransactionEdit({
    transactionId,
    userId,
    editType: 'SPLIT',
    before: { splits: serialiseSplits(result.existingSplits) },
    after: { splits: serialiseSplits(result.splits) },
    source,
  });

  return { transaction: result.transaction, splits: result.splits };
}

/**
 * Remove all splits from a transaction. Idempotent.
 */
export async function clearSplits(
  transactionId: string,
  userId: string
): Promise<{ deleted: number }> {
  const tx = await prisma.unifiedTransaction.findUnique({
    where: { id: transactionId },
    select: { userId: true },
  });
  if (!tx || tx.userId !== userId) {
    throw new SplitValidationError('Transaction not found or not owned by caller', 'NOT_OWNER');
  }
  const existingSplits = await prisma.transactionSplit.findMany({
    where: { transactionId },
  });
  if (existingSplits.length === 0) return { deleted: 0 };

  const deleted = await prisma.transactionSplit.deleteMany({
    where: { transactionId },
  });

  recordTransactionEdit({
    transactionId,
    userId,
    editType: 'SPLIT',
    before: { splits: serialiseSplits(existingSplits) },
    after: { splits: [] },
    source: 'USER',
  });

  return { deleted: deleted.count };
}

/**
 * Convenience listing — used by the GET /splits endpoint and by the
 * UI's split editor.
 */
export async function listSplits(
  transactionId: string,
  userId: string
): Promise<TransactionSplit[]> {
  const tx = await prisma.unifiedTransaction.findUnique({
    where: { id: transactionId },
    select: { userId: true },
  });
  if (!tx || tx.userId !== userId) return [];
  return prisma.transactionSplit.findMany({
    where: { transactionId },
    orderBy: { createdAt: 'asc' },
  });
}

function serialiseSplits(splits: TransactionSplit[]): unknown[] {
  return splits.map((s) => ({
    amount: s.amount,
    categoryId: s.categoryId,
    propertyId: s.propertyId,
    loanId: s.loanId,
    expenseId: s.expenseId,
    isTaxDeductible: s.isTaxDeductible,
    note: s.note,
  }));
}

export type { TransactionSplit };
