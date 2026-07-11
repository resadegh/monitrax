/**
 * Canonical PER-PROPERTY cashflow (MON-002 + MON-009).
 *
 * ONE source (CLAUDE.md §12.2.1) for a single property's rent / expenses /
 * loan cost / cashflow. Every property surface reads THIS — the property list
 * tile, the detail page, and (server-side) the master snapshot's per-property
 * metrics.
 *
 * The universal rule (Reza 2026-07-03, §19.1, via `monthlyResolver`): each
 * money line is a TRUE MONTHLY figure read from its reconciled transaction
 * dates — correct for any cadence (fortnightly rent, two loan repayments in a
 * month, a quarterly water rate) — with the declared amount×frequency as the
 * fallback only when there aren't enough transactions to read the cadence.
 *
 *   • RENT is resolved at the PROPERTY-STREAM level: ALL of the property's
 *     rental transactions are pooled into one stream, so a rental fragmented
 *     across several Income records (the "4 monthly rows" bug) is counted once
 *     and correctly, regardless of tenancy count.
 *   • EXPENSES and LOANS resolve per record (genuinely distinct lines).
 *
 * Basis (Reza 2026-07-03): the headline "Cashflow / yr" is ACTUALS-FIRST P&I
 * (rent − expenses − repayment). The tax position uses INTEREST-ONLY (principal
 * × rate — the deductible figure). Both are returned. Loan cost is NEVER
 * silently $0: actual repayment → manual minRepayment → interest floor.
 *
 * PURE: no DB, no fetch, no mutation. Modelled in the Neomatrix
 * (engine.propertyCashflow.computePropertyCashflow).
 */

import { toMonthly } from '@/lib/utils/frequencies';
import { resolveMonthly, type ResolverTx, type DetectedFrequency } from '@/lib/calculations/monthlyResolver';

const RENT_TYPES = new Set(['RENT', 'RENTAL']);

export interface CashflowIncome {
  id?: string;
  type: string;
  amount: number;
  frequency: string;
}
export interface CashflowExpense {
  id?: string;
  amount: number;
  frequency: string;
}
export interface CashflowLoan {
  id?: string;
  principal: number;
  interestRateAnnual: number; // DECIMAL, e.g. 0.0649 = 6.49%
  minRepayment?: number | null;
  repaymentFrequency?: string | null;
}
/** A reconciled transaction linked to one of the property's income/expense/loan rows. */
export interface CashflowTransaction extends ResolverTx {
  incomeId?: string | null;
  expenseId?: string | null;
  loanId?: string | null;
}

export interface PropertyCashflowInput {
  income?: CashflowIncome[];
  expenses?: CashflowExpense[];
  loans?: CashflowLoan[];
  /** Reconciled transactions for THIS property (actuals win over declared). */
  transactions?: CashflowTransaction[];
}

/**
 * One resolved expense line — the per-record intermediate the expense loop
 * already computes. Exposed (MON-005) so a UI surface can render each expense
 * row AND the header total from the SAME engine call: Σ expenseLines[].annual
 * === annualExpenses BY CONSTRUCTION (same loop, same `resolveMonthly`). This
 * is what keeps the per-property Expenses card reconciled with the canonical
 * total — no second producer (§12.2.1), no row-sum-vs-total drift (§19.4).
 */
export interface CashflowExpenseLine {
  id?: string;
  /** Actuals-first monthly figure for this record (reconciled when txns exist). */
  monthly: number;
  /** monthly × 12. */
  annual: number;
  /** True when reconciled transactions drove this line (vs the declared amount). */
  usedActuals: boolean;
}

/**
 * One resolved loan line (MON-032) — the engine's actual per-loan monthly cost
 * (actuals → declared minRepayment → interest floor). UI rows render THIS, never
 * the raw `minRepayment` (which prints "-$0" when unset while the engine charges
 * interest). Σ loanLines[].monthly === monthlyLoanRepayment by construction.
 */
export interface CashflowLoanLine {
  id?: string;
  /** The monthly loan cost the engine actually used (never silently $0). */
  monthly: number;
  usedActuals: boolean;
  /** True when neither actuals nor a manual repayment existed → interest floor. */
  flooredToInterest: boolean;
}

export interface PropertyCashflow {
  annualRent: number;
  annualExpenses: number;
  /** Per-record expense breakdown (MON-005) — sums to annualExpenses. */
  expenseLines: CashflowExpenseLine[];
  /** Per-loan resolved cost (MON-032) — sums to monthlyLoanRepayment. */
  loanLines: CashflowLoanLine[];
  /** P&I cash outflow — actuals-first, never $0 when a loan exists. */
  annualLoanRepayment: number;
  /** Interest only (principal × rate) — the deductible figure for tax. */
  annualLoanInterest: number;
  /** Headline: rent − expenses − repayment (cash basis). */
  annualCashflow: number;
  /** Tax: rent − expenses − interest. */
  annualTaxCashflow: number;
  // Monthly mirrors (everything is shown monthly — Reza 2026-07-03).
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyLoanRepayment: number;
  monthlyCashflow: number;
  basis: 'actual' | 'declared' | 'mixed';
  usedActuals: { income: boolean; expenses: boolean; loans: boolean };
  /** Cadence detected from the rental transactions, for display ("fortnightly"). */
  detectedRentFrequency: DetectedFrequency | null;
}

const txFor = (txs: CashflowTransaction[], pick: (t: CashflowTransaction) => string | null | undefined, id?: string) =>
  id == null ? [] : txs.filter((t) => pick(t) === id);

export function computePropertyCashflow(input: PropertyCashflowInput): PropertyCashflow {
  const income = input.income ?? [];
  const expenses = input.expenses ?? [];
  const loans = input.loans ?? [];
  const txs = input.transactions ?? [];

  let contributing = 0;
  let actualContributing = 0;
  const bump = (usedActuals: boolean) => {
    contributing++;
    if (usedActuals) actualContributing++;
  };

  // ── RENT — resolved at the property-STREAM level (all rental tx pooled) ──
  const rentalRows = income.filter((i) => RENT_TYPES.has(i.type));
  const rentalIds = new Set(rentalRows.map((r) => r.id).filter(Boolean) as string[]);
  const rentalTx = txs.filter((t) => t.incomeId != null && rentalIds.has(t.incomeId));
  const declaredRentalMonthly = rentalRows.reduce((s, r) => s + toMonthly(r.amount, r.frequency as never), 0);
  const rent = resolveMonthly({
    declaredMonthly: declaredRentalMonthly,
    cadenceHintFrequency: rentalRows[0]?.frequency ?? 'MONTHLY',
    transactions: rentalTx,
    isAdvance: true, // rent is paid in advance
  });
  const monthlyRent = rent.monthly;
  const incomeUsedActuals = rent.usedActuals;
  if (rentalRows.length > 0) bump(rent.usedActuals);

  // ── EXPENSES — per record ──
  let monthlyExpenses = 0;
  let expensesUsedActuals = false;
  const expenseLines: CashflowExpenseLine[] = [];
  for (const e of expenses) {
    const r = resolveMonthly({
      declaredMonthly: toMonthly(e.amount, e.frequency as never),
      cadenceHintFrequency: e.frequency,
      transactions: txFor(txs, (t) => t.expenseId, e.id),
    });
    monthlyExpenses += r.monthly;
    // Same loop, same resolver → the per-record breakdown is the total,
    // decomposed. Σ expenseLines[].annual === annualExpenses by construction.
    expenseLines.push({ id: e.id, monthly: r.monthly, annual: r.monthly * 12, usedActuals: r.usedActuals });
    if (r.usedActuals) expensesUsedActuals = true;
    bump(r.usedActuals);
  }

  // ── LOANS — per record; repayment never silently $0 ──
  let monthlyLoanRepayment = 0;
  let annualLoanInterest = 0;
  let loansUsedActuals = false;
  const loanLines: CashflowLoanLine[] = [];
  for (const l of loans) {
    const monthlyInterest = Math.max(0, (l.principal ?? 0) * (l.interestRateAnnual ?? 0)) / 12;
    annualLoanInterest += monthlyInterest * 12;
    const loanTx = txFor(txs, (t) => t.loanId, l.id);
    const declaredRepayMonthly = (l.minRepayment ?? 0) > 0
      ? toMonthly(l.minRepayment as number, (l.repaymentFrequency ?? 'MONTHLY') as never)
      : 0;
    const r = resolveMonthly({
      declaredMonthly: declaredRepayMonthly,
      cadenceHintFrequency: l.repaymentFrequency ?? 'MONTHLY',
      transactions: loanTx,
    });
    // Never silently $0: if neither actuals nor a manual repayment exist, floor
    // to interest (the minimum true cost of carrying the loan).
    const flooredToInterest = !(r.monthly > 0);
    const resolvedMonthly = flooredToInterest ? monthlyInterest : r.monthly;
    monthlyLoanRepayment += resolvedMonthly;
    // MON-032: expose the resolved per-loan cost so UI rows mirror the engine
    // (never render raw minRepayment — it prints "-$0" while we charge interest).
    loanLines.push({ id: l.id, monthly: resolvedMonthly, usedActuals: r.usedActuals, flooredToInterest });
    if (r.usedActuals) loansUsedActuals = true;
    bump(r.usedActuals);
  }

  const monthlyCashflow = monthlyRent - monthlyExpenses - monthlyLoanRepayment;
  const annualRent = monthlyRent * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualLoanRepayment = monthlyLoanRepayment * 12;

  const basis: PropertyCashflow['basis'] =
    actualContributing === 0 ? 'declared' : actualContributing === contributing ? 'actual' : 'mixed';

  return {
    annualRent,
    annualExpenses,
    expenseLines,
    loanLines,
    annualLoanRepayment,
    annualLoanInterest,
    annualCashflow: annualRent - annualExpenses - annualLoanRepayment,
    annualTaxCashflow: annualRent - annualExpenses - annualLoanInterest,
    monthlyRent,
    monthlyExpenses,
    monthlyLoanRepayment,
    monthlyCashflow,
    basis,
    usedActuals: { income: incomeUsedActuals, expenses: expensesUsedActuals, loans: loansUsedActuals },
    detectedRentFrequency: rent.detectedFrequency,
  };
}
