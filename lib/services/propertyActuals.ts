/**
 * Per-property ACTUALS enrichment — ONE source (CLAUDE.md §12.2.1, §19.4).
 *
 * Attaches reconciled-transaction actuals (`monthlyAverageActual`,
 * `hasTransactions`, …) to a property's income / expense / loan rows so the
 * canonical `computePropertyCashflow` engine can apply the §19.1 actuals-first
 * rule (actuals when transactions exist, declared otherwise).
 *
 * This existed inline ONLY in the property DETAIL route, which meant the
 * property LIST tiles rendered declared-only numbers that disagreed with the
 * detail page (§19.4 whack-a-mole). This module is the single producer both
 * routes call — detail passes one property, the list passes all of them, and
 * the transaction fetch is BATCHED (3 queries total, no N+1 — §12.10).
 *
 * The math (day-span monthly average, ADVANCE vs ARREARS handling) is preserved
 * verbatim from the detail route so no existing number regresses.
 *
 * NOTE: this is a data-access SERVICE (it fetches transactions), NOT a pure
 * calc engine (§6.4). The pure cashflow math lives in
 * `lib/calculations/propertyCashflow.ts`.
 */

import prisma from '@/lib/db';

export type ActualTx = { date: Date; amount: number };

/** Fields attached to each enriched income / expense / loan row. */
export interface ActualsFields {
  budgetAmount: number;
  actualFromTransactions: number | null;
  currentMonthActual: number | null;
  monthlyAverageActual: number | null;
  transactionCount: number;
  hasTransactions: boolean;
}

/**
 * Day-span monthly average from a cadence of transactions. Handles fortnightly
 * rent correctly (the §19.1 fix — declared MONTHLY on a fortnightly cadence was
 * under-counting). `isAdvance` (rent paid in advance) excludes the trailing
 * payment so a part-period doesn't drag the average down.
 */
export function calculateMonthlyAverage(transactions: ActualTx[], isAdvance = false): number | null {
  if (transactions.length < 2) {
    return transactions.length === 1 ? Math.abs(transactions[0].amount) : null;
  }

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const payments = isAdvance ? sortedTx.slice(0, -1) : sortedTx;
  if (payments.length < 1) return null;

  const sum = payments.reduce((s, tx) => s + Math.abs(tx.amount), 0);
  if (payments.length === 1) return sum;

  const firstDate = new Date(payments[0].date);
  const lastDate = new Date(payments[payments.length - 1].date);
  const daysSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const avgInterval = daysSpan / (payments.length - 1);
  const totalDays = daysSpan + avgInterval;
  return (sum / totalDays) * 30.44;
}

interface ActualsAgg {
  totalAmount: number;
  totalCount: number;
  currentMonthAmount: number;
  transactions: ActualTx[];
}

function group<T extends { date: Date; amount: number }>(
  txs: T[],
  keyOf: (t: T) => string | null | undefined,
  currentMonthStart: Date,
): Map<string, ActualsAgg> {
  const map = new Map<string, ActualsAgg>();
  for (const tx of txs) {
    const key = keyOf(tx);
    if (!key) continue;
    const existing =
      map.get(key) || { totalAmount: 0, totalCount: 0, currentMonthAmount: 0, transactions: [] };
    const amt = Math.abs(tx.amount);
    existing.totalAmount += amt;
    existing.totalCount += 1;
    existing.transactions.push({ date: new Date(tx.date), amount: amt });
    if (new Date(tx.date) >= currentMonthStart) existing.currentMonthAmount += amt;
    map.set(key, existing);
  }
  return map;
}

function attach<E extends { id: string }>(
  entity: E,
  agg: ActualsAgg | undefined,
  budget: number,
  isAdvance: boolean,
): E & ActualsFields {
  const monthlyAvg = agg ? calculateMonthlyAverage(agg.transactions, isAdvance) : null;
  return {
    ...entity,
    budgetAmount: budget,
    actualFromTransactions: agg?.totalAmount || null,
    currentMonthActual: agg?.currentMonthAmount || null,
    monthlyAverageActual: monthlyAvg ? Math.round(monthlyAvg * 100) / 100 : null,
    transactionCount: agg?.totalCount || 0,
    hasTransactions: (agg?.totalCount || 0) > 0,
  };
}

interface IncomeLike { id: string; type: string; amount: number }
interface ExpenseLike { id: string; amount: number }
interface LoanLike { id: string; minRepayment: number }

export interface EnrichableProperty {
  income: IncomeLike[];
  expenses: ExpenseLike[];
  loans: LoanLike[];
}

/** A reconciled transaction linked to one of the property's income/expense/loan rows. */
export interface LinkedTransaction {
  date: Date;
  amount: number;
  incomeId: string | null;
  expenseId: string | null;
  loanId: string | null;
}

export type EnrichedProperty<P extends EnrichableProperty> = Omit<P, 'income' | 'expenses' | 'loans'> & {
  income: Array<P['income'][number] & ActualsFields>;
  expenses: Array<P['expenses'][number] & ActualsFields>;
  loans: Array<P['loans'][number] & ActualsFields>;
  /** This property's reconciled transactions — feeds the canonical cashflow engine. */
  linkedTransactions: LinkedTransaction[];
};

/**
 * Enrich one-or-many properties' income / expense / loan rows with reconciled
 * actuals. BATCHED: all entity ids across all properties are collected and the
 * transactions fetched in 3 queries total (§12.10 — no N+1).
 */
export async function enrichPropertiesWithActuals<P extends EnrichableProperty>(
  userId: string,
  properties: P[],
): Promise<EnrichedProperty<P>[]> {
  const incomeIds = properties.flatMap((p) => p.income.map((i) => i.id));
  const expenseIds = properties.flatMap((p) => p.expenses.map((e) => e.id));
  const loanIds = properties.flatMap((p) => p.loans.map((l) => l.id));

  const [incomeTx, expenseTx, loanTx] = await Promise.all([
    incomeIds.length > 0
      ? prisma.unifiedTransaction.findMany({
          where: { userId, incomeId: { in: incomeIds } },
          select: { date: true, amount: true, incomeId: true },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
    expenseIds.length > 0
      ? prisma.unifiedTransaction.findMany({
          where: { userId, expenseId: { in: expenseIds } },
          select: { date: true, amount: true, expenseId: true },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
    loanIds.length > 0
      ? prisma.unifiedTransaction.findMany({
          where: { userId, loanId: { in: loanIds } },
          select: { date: true, amount: true, loanId: true },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const incomeMap = group(incomeTx, (t) => t.incomeId, currentMonthStart);
  const expenseMap = group(expenseTx, (t) => t.expenseId, currentMonthStart);
  const loanMap = group(loanTx, (t) => t.loanId, currentMonthStart);

  // Index the fetched transactions by their linking id so each property can
  // collect its own reconciled transactions (fed to the cashflow engine).
  const byIncome = new Map<string, LinkedTransaction[]>();
  const byExpense = new Map<string, LinkedTransaction[]>();
  const byLoan = new Map<string, LinkedTransaction[]>();
  const push = (m: Map<string, LinkedTransaction[]>, key: string | null, tx: LinkedTransaction) => {
    if (!key) return;
    const arr = m.get(key) ?? [];
    arr.push(tx);
    m.set(key, arr);
  };
  for (const t of incomeTx) push(byIncome, t.incomeId, { date: t.date, amount: t.amount, incomeId: t.incomeId, expenseId: null, loanId: null });
  for (const t of expenseTx) push(byExpense, t.expenseId, { date: t.date, amount: t.amount, incomeId: null, expenseId: t.expenseId, loanId: null });
  for (const t of loanTx) push(byLoan, t.loanId, { date: t.date, amount: t.amount, incomeId: null, expenseId: null, loanId: t.loanId });

  return properties.map((p) => {
    const linkedTransactions: LinkedTransaction[] = [
      ...p.income.flatMap((i) => byIncome.get(i.id) ?? []),
      ...p.expenses.flatMap((e) => byExpense.get(e.id) ?? []),
      ...p.loans.flatMap((l) => byLoan.get(l.id) ?? []),
    ];
    return {
      ...p,
      income: p.income.map((inc) =>
        attach(inc, incomeMap.get(inc.id), inc.amount, inc.type === 'RENTAL' || inc.type === 'RENT'),
      ),
      expenses: p.expenses.map((exp) => attach(exp, expenseMap.get(exp.id), exp.amount, false)),
      loans: p.loans.map((loan) => attach(loan, loanMap.get(loan.id), loan.minRepayment, false)),
      linkedTransactions,
    };
  }) as EnrichedProperty<P>[];
}
