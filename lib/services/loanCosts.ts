/**
 * Per-loan resolved-cost enrichment — ONE source (CLAUDE.md §12.2.1, §19.4;
 * VR-013 / MON-081 fix).
 *
 * The canonical per-loan monthly cost is `resolveLoanMonthlyCost()`
 * (lib/calculations/propertyCashflow.ts) — actuals-first: reconciled linked
 * repayments → declared `minRepayment` → interest floor. But a resolver is
 * only as canonical as its FEED: VR-013 caught the expenses page + API routes
 * calling it with NO transactions (declared/floor only, $1,271) while the
 * property engine fed linked repayments ($1,191 actuals) — same producer,
 * different inputs, five different numbers on screen (the MON-028 lesson,
 * FIX_PROTOCOL §1 F2).
 *
 * This service is the ONE transaction feed for loan costs outside the
 * property engine: it batch-fetches each loan's linked repayments over the
 * ONE canonical window (`propertyActualsWindowStart()` — trailing 12 months,
 * MON-035 DECISION 2, shared with every property surface) and resolves each
 * loan through the canonical producer. Every server-side surface that needs a
 * loan's monthly cost calls THIS; client surfaces read the `resolvedCost`
 * field `/api/loans` attaches from it. A loan with linked repayments can
 * therefore never read $0 / "no repayment set" anywhere (VR-013 F2) — the
 * window is not FY-scoped, so repayments made late in a prior FY still drive
 * the current run-rate.
 *
 * NOTE: data-access SERVICE (fetches transactions), not a calc engine (§6.4)
 * — all math stays in `resolveLoanMonthlyCost`.
 */

import prisma from '@/lib/db';
import { propertyActualsWindowStart } from '@/lib/calculations/propertyActualsWindow';
import {
  resolveLoanMonthlyCost,
  type CashflowLoan,
  type CashflowTransaction,
  type ResolvedLoanCost,
} from '@/lib/calculations/propertyCashflow';

export type { ResolvedLoanCost } from '@/lib/calculations/propertyCashflow';

/**
 * Resolve the canonical monthly cost for each loan, fed with that loan's
 * reconciled repayments over the canonical trailing-12-month window.
 * Returns a map keyed by loan id (loans without an id resolve declared-only).
 */
export async function resolveLoanCostsForUser(
  userId: string,
  loans: CashflowLoan[],
): Promise<Map<string, ResolvedLoanCost>> {
  const ids = loans.map((l) => l.id).filter((id): id is string => !!id);

  let txs: Array<{ date: Date; amount: number; loanId: string | null }> = [];
  if (ids.length > 0) {
    try {
      txs = await prisma.unifiedTransaction.findMany({
        where: { userId, loanId: { in: ids }, date: { gte: propertyActualsWindowStart() } },
        select: { date: true, amount: true, loanId: true },
        orderBy: { date: 'asc' },
      });
    } catch (e) {
      // Best-effort (mirrors /api/loans): a transaction-fetch failure degrades
      // to the declared→floor path rather than blanking the surface.
      console.warn(
        'loanCosts: skipping linked-repayment enrichment:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  const byLoan = new Map<string, CashflowTransaction[]>();
  for (const t of txs) {
    if (!t.loanId) continue;
    const arr = byLoan.get(t.loanId) ?? [];
    arr.push({ date: t.date, amount: t.amount, loanId: t.loanId });
    byLoan.set(t.loanId, arr);
  }

  return new Map(
    loans.map((l) => [
      l.id ?? '',
      resolveLoanMonthlyCost(l, l.id ? (byLoan.get(l.id) ?? []) : []),
    ]),
  );
}

/**
 * Convenience: the summed canonical monthly cost of a set of loans,
 * actuals-first per loan. The one-liner most routes need.
 */
export async function totalLoanMonthlyCost(
  userId: string,
  loans: CashflowLoan[],
): Promise<number> {
  const costs = await resolveLoanCostsForUser(userId, loans);
  return loans.reduce((sum, l) => sum + (costs.get(l.id ?? '')?.monthly ?? 0), 0);
}
