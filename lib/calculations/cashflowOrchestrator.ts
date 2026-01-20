/**
 * Cashflow Orchestrator
 *
 * Single source of truth for cashflow calculations.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered cashflow calculations in:
 * - app/api/calculate/cashflow/route.ts
 * - app/api/financial-health/route.ts
 * - app/api/cashflow/route.ts
 * - app/api/portfolio/snapshot/route.ts
 *
 * Formula: Cashflow = Net Income - Expenses - Loan Repayments
 */

import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// =============================================================================
// TYPES
// =============================================================================

export interface IncomeItem {
  amount: number;
  frequency: string;
  type?: string;
  salaryType?: string | null;
  netAmount?: number | null;
}

export interface ExpenseItem {
  amount: number;
  frequency: string;
  isEssential?: boolean;
}

export interface LoanItem {
  minRepayment: number;
  repaymentFrequency: string;
}

export interface CashflowInput {
  income: IncomeItem[];
  expenses: ExpenseItem[];
  loans: LoanItem[];
}

export interface CashflowResult {
  // Monthly figures
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyCashflow: number;

  // Annual figures
  annualIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualCashflow: number;

  // Metrics
  savingsRate: number; // Percentage of income saved
  expenseRatio: number; // Expenses as % of income
  debtServiceRatio: number; // Loan repayments as % of income

  // Breakdown
  essentialExpenses: number;
  discretionaryExpenses: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get net income amount for an income item
 * For GROSS salary with stored netAmount, uses that
 * Otherwise normalizes the amount to monthly
 */
function getNetMonthlyAmount(item: IncomeItem): number {
  // If salary with pre-calculated net amount, use it
  if (
    item.type === 'SALARY' &&
    item.salaryType === 'GROSS' &&
    item.netAmount != null
  ) {
    return item.netAmount / 12;
  }

  // Otherwise, convert to monthly
  return toMonthly(item.amount, item.frequency as Frequency);
}

// =============================================================================
// MAIN CALCULATIONS
// =============================================================================

/**
 * Calculate monthly cashflow components
 */
export function calculateMonthlyCashflow(input: CashflowInput): {
  income: number;
  expenses: number;
  loanRepayments: number;
  cashflow: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
} {
  // Calculate monthly income (net for salary types)
  const income = input.income.reduce(
    (sum, item) => sum + getNetMonthlyAmount(item),
    0
  );

  // Calculate monthly expenses
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;

  for (const expense of input.expenses) {
    const monthlyAmount = toMonthly(expense.amount, expense.frequency as Frequency);
    if (expense.isEssential) {
      essentialExpenses += monthlyAmount;
    } else {
      discretionaryExpenses += monthlyAmount;
    }
  }

  const expenses = essentialExpenses + discretionaryExpenses;

  // Calculate monthly loan repayments
  const loanRepayments = input.loans.reduce(
    (sum, loan) =>
      sum + toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency),
    0
  );

  return {
    income,
    expenses,
    loanRepayments,
    cashflow: income - expenses - loanRepayments,
    essentialExpenses,
    discretionaryExpenses,
  };
}

/**
 * Calculate annual cashflow components
 */
export function calculateAnnualCashflow(input: CashflowInput): {
  income: number;
  expenses: number;
  loanRepayments: number;
  cashflow: number;
} {
  const monthly = calculateMonthlyCashflow(input);

  return {
    income: monthly.income * 12,
    expenses: monthly.expenses * 12,
    loanRepayments: monthly.loanRepayments * 12,
    cashflow: monthly.cashflow * 12,
  };
}

/**
 * Calculate complete cashflow analysis
 *
 * This is the canonical cashflow calculation used throughout the app.
 */
export function calculateCashflow(input: CashflowInput): CashflowResult {
  const monthly = calculateMonthlyCashflow(input);
  const annual = calculateAnnualCashflow(input);

  // Calculate ratios (avoid division by zero)
  const savingsRate =
    monthly.income > 0
      ? ((monthly.income - monthly.expenses - monthly.loanRepayments) /
          monthly.income) *
        100
      : 0;

  const expenseRatio =
    monthly.income > 0 ? (monthly.expenses / monthly.income) * 100 : 0;

  const debtServiceRatio =
    monthly.income > 0 ? (monthly.loanRepayments / monthly.income) * 100 : 0;

  return {
    // Monthly
    monthlyIncome: monthly.income,
    monthlyExpenses: monthly.expenses,
    monthlyLoanRepayments: monthly.loanRepayments,
    monthlyCashflow: monthly.cashflow,

    // Annual
    annualIncome: annual.income,
    annualExpenses: annual.expenses,
    annualLoanRepayments: annual.loanRepayments,
    annualCashflow: annual.cashflow,

    // Metrics
    savingsRate,
    expenseRatio,
    debtServiceRatio,

    // Breakdown
    essentialExpenses: monthly.essentialExpenses,
    discretionaryExpenses: monthly.discretionaryExpenses,
  };
}
