/**
 * MON-168 — THE property-attribution rule for transaction links (SSOT §12.2.1).
 *
 * A UnifiedTransaction's `propertyId` is DERIVED STATE: it mirrors the
 * `propertyId` of whichever Income / Expense / Loan row the transaction is
 * linked to, and is `null` when the transaction has no link or its target is
 * not property-scoped (e.g. a GENERAL expense). The D-12 accountant pack's
 * per-property P&L keys solely on this field (taxPack/summary.ts), so every
 * write path that sets `incomeId`/`expenseId`/`loanId` MUST stamp it via this
 * module — never with a local re-derivation, and never left unset (the
 * 2026-08-19 Ring-3 FAIL on #1595: a fully-linked 387-transaction year
 * exported `perProperty: []` because 16 link sites wrote target ids and none
 * wrote `propertyId`).
 *
 * Rules encoded here (both functions implement the SAME rule):
 *   - link target's `propertyId` ?? null — nothing is ever guessed;
 *   - precedence income > expense > loan (a transaction only ever carries one
 *     target id in practice; precedence just makes the helper total);
 *   - clearing a link clears the stamp (callers write `propertyId: null` on
 *     unlink/transfer/investment — derived state never outlives its source).
 *
 * Used by: app/api/transactions/[id]/link/route.ts (all actions),
 * app/api/bank/import (auto-link), lib/bookkeeping/loanLedger/matchRepayments,
 * lib/bookkeeping/receiptMatcher, app/api/documents/analyze/confirm,
 * app/api/unified-transactions/[id] (PATCH derive), and the MON-168 admin
 * backfill (app/api/admin/maintenance/backfill-transaction-property).
 * Guarded by tests/bookkeeping/mon168PropertyStampGuard.test.ts.
 */
import { prisma } from '@/lib/db';

/** Pure half of the rule — for call-sites that already hold the target row. */
export function propertyIdOf(
  target: { propertyId?: string | null } | null | undefined
): string | null {
  return target?.propertyId ?? null;
}

export interface LinkTargetIds {
  incomeId?: string | null;
  expenseId?: string | null;
  loanId?: string | null;
}

/**
 * DB half of the rule — resolves the link target's propertyId, scoped to the
 * owning user (§12.11: never trust a bare id). Returns null when no target id
 * is given, the target row is missing, or the target is not property-scoped.
 */
export async function resolveLinkPropertyId(
  userId: string,
  link: LinkTargetIds
): Promise<string | null> {
  if (link.incomeId) {
    const row = await prisma.income.findFirst({
      where: { id: link.incomeId, userId },
      select: { propertyId: true },
    });
    return propertyIdOf(row);
  }
  if (link.expenseId) {
    const row = await prisma.expense.findFirst({
      where: { id: link.expenseId, userId },
      select: { propertyId: true },
    });
    return propertyIdOf(row);
  }
  if (link.loanId) {
    const row = await prisma.loan.findFirst({
      where: { id: link.loanId, userId },
      select: { propertyId: true },
    });
    return propertyIdOf(row);
  }
  return null;
}

/**
 * Batch variant for import-time auto-linking: one query per target table,
 * returns lookup maps so a createMany over hundreds of rows costs three
 * queries, not 3N (§12.10 no N+1).
 */
export async function resolveLinkPropertyIdMaps(
  userId: string,
  ids: { incomeIds: string[]; expenseIds: string[]; loanIds: string[] }
): Promise<{
  byIncomeId: Map<string, string | null>;
  byExpenseId: Map<string, string | null>;
  byLoanId: Map<string, string | null>;
}> {
  const [incomes, expenses, loans] = await Promise.all([
    ids.incomeIds.length
      ? prisma.income.findMany({
          where: { id: { in: ids.incomeIds }, userId },
          select: { id: true, propertyId: true },
        })
      : [],
    ids.expenseIds.length
      ? prisma.expense.findMany({
          where: { id: { in: ids.expenseIds }, userId },
          select: { id: true, propertyId: true },
        })
      : [],
    ids.loanIds.length
      ? prisma.loan.findMany({
          where: { id: { in: ids.loanIds }, userId },
          select: { id: true, propertyId: true },
        })
      : [],
  ]);
  return {
    byIncomeId: new Map(incomes.map((r) => [r.id, r.propertyId ?? null])),
    byExpenseId: new Map(expenses.map((r) => [r.id, r.propertyId ?? null])),
    byLoanId: new Map(loans.map((r) => [r.id, r.propertyId ?? null])),
  };
}
