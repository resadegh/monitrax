/**
 * Canonical PER-PROPERTY cashflow (MON-002).
 *
 * ONE source (CLAUDE.md §12.2.1) for a single property's rent / expenses /
 * loan cost / cashflow — replacing the inline computeCashflow helpers that
 * lived in both the property detail page and the property list page (which
 * disagreed and ignored actuals). Every property surface reads THIS.
 *
 * The rule (Reza directive 2026-07-03, §19.1): for each linked income / expense
 * / loan, use the ACTUAL reconciled figure when transactions exist, else the
 * user's declared/manual value. Sourced from the entity→property relationship;
 * the user enters each value once, and reconciled actuals override.
 *
 * Basis decision (Reza 2026-07-03): the headline "Cashflow / yr" is ACTUALS-FIRST
 * P&I (rent − expenses − repayment). The tax position uses INTEREST-ONLY
 * (principal × rate — the deductible figure). Both are returned.
 *
 * Loan cost is NEVER silently $0: actual repayment when captured, else the
 * manual minRepayment, else the interest (principal × rate) as a floor.
 *
 * Actuals annualisation: the API supplies `monthlyAverageActual` — a true
 * monthly average derived from the transaction cadence (so fortnightly rent is
 * handled correctly). Annual actual = monthlyAverageActual × 12.
 *
 * PURE: no DB, no fetch, no mutation. Modelled in the Neomatrix
 * (engine.propertyCashflow.computePropertyCashflow).
 */

import { toAnnual } from '@/lib/utils/frequencies';

type Freq = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

/** Per-entity actuals the API attaches (see lib/services/propertyActuals.ts). */
export interface EntityActuals {
  monthlyAverageActual?: number | null;
  hasTransactions?: boolean;
}
export interface CashflowIncome extends EntityActuals {
  type: string;
  amount: number;
  frequency: string;
}
export interface CashflowExpense extends EntityActuals {
  amount: number;
  frequency: string;
}
export interface CashflowLoan extends EntityActuals {
  principal: number;
  interestRateAnnual: number; // DECIMAL, e.g. 0.0649 = 6.49%
  minRepayment?: number | null;
  repaymentFrequency?: string | null;
}
export interface PropertyCashflowInput {
  income?: CashflowIncome[];
  expenses?: CashflowExpense[];
  loans?: CashflowLoan[];
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
  basis: 'actual' | 'declared' | 'mixed';
  usedActuals: { income: boolean; expenses: boolean; loans: boolean };
}

const isActual = (a: EntityActuals): boolean => Boolean(a?.hasTransactions) && a?.monthlyAverageActual != null;
/** Annual value for one entity: actual (monthly avg × 12) when present, else declared × frequency. */
function annualValue(declaredAmount: number, frequency: string, a: EntityActuals): number {
  if (isActual(a)) return (a.monthlyAverageActual as number) * 12;
  return toAnnual(declaredAmount ?? 0, (frequency ?? 'MONTHLY') as Freq);
}

export function computePropertyCashflow(input: PropertyCashflowInput): PropertyCashflow {
  const income = input.income ?? [];
  const expenses = input.expenses ?? [];
  const loans = input.loans ?? [];

  // basis is over CONTRIBUTING entities only (an absent category doesn't make it 'mixed').
  let contributing = 0;
  let actualContributing = 0;

  let annualRent = 0;
  let incomeUsedActuals = false;
  for (const i of income) {
    if (i.type !== 'RENT' && i.type !== 'RENTAL') continue;
    annualRent += annualValue(i.amount, i.frequency, i);
    contributing++;
    if (isActual(i)) { incomeUsedActuals = true; actualContributing++; }
  }

  let annualExpenses = 0;
  let expensesUsedActuals = false;
  for (const e of expenses) {
    annualExpenses += annualValue(e.amount, e.frequency, e);
    contributing++;
    if (isActual(e)) { expensesUsedActuals = true; actualContributing++; }
  }

  let annualLoanRepayment = 0;
  let annualLoanInterest = 0;
  let loansUsedActuals = false;
  for (const l of loans) {
    const interest = Math.max(0, (l.principal ?? 0) * (l.interestRateAnnual ?? 0));
    annualLoanInterest += interest;
    contributing++;
    if (isActual(l)) {
      annualLoanRepayment += (l.monthlyAverageActual as number) * 12;
      loansUsedActuals = true;
      actualContributing++;
    } else if ((l.minRepayment ?? 0) > 0) {
      annualLoanRepayment += toAnnual(l.minRepayment as number, (l.repaymentFrequency ?? 'MONTHLY') as Freq);
    } else {
      // Never silently $0: fall back to interest as the minimum true cost.
      annualLoanRepayment += interest;
    }
  }

  const usedActuals = { income: incomeUsedActuals, expenses: expensesUsedActuals, loans: loansUsedActuals };
  const basis: PropertyCashflow['basis'] =
    actualContributing === 0 ? 'declared' : actualContributing === contributing ? 'actual' : 'mixed';

  return {
    annualRent,
    annualExpenses,
    annualLoanRepayment,
    annualLoanInterest,
    annualCashflow: annualRent - annualExpenses - annualLoanRepayment,
    annualTaxCashflow: annualRent - annualExpenses - annualLoanInterest,
    basis,
    usedActuals,
  };
}
