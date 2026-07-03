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

export interface PropertyCashflow {
  annualRent: number;
  annualExpenses: number;
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
  for (const e of expenses) {
    const r = resolveMonthly({
      declaredMonthly: toMonthly(e.amount, e.frequency as never),
      cadenceHintFrequency: e.frequency,
      transactions: txFor(txs, (t) => t.expenseId, e.id),
    });
    monthlyExpenses += r.monthly;
    if (r.usedActuals) expensesUsedActuals = true;
    bump(r.usedActuals);
  }

  // ── LOANS — per record; repayment never silently $0 ──
  let monthlyLoanRepayment = 0;
  let annualLoanInterest = 0;
  let loansUsedActuals = false;
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
    monthlyLoanRepayment += r.monthly > 0 ? r.monthly : monthlyInterest;
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
