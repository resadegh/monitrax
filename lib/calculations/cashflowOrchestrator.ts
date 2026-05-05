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
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Phase 41a — `LegalEntity` ownership FK propagated through the cashflow
 * inputs (Phase 41e.0 audit C-3). Optional + nullable on every input row;
 * the `ownerEntityId` filter param on `calculateCashflow()` defaults to
 * "no filter" so omitting it preserves pre-41e behaviour exactly.
 */
export interface IncomeItem {
  amount: number;
  frequency: string;
  type?: string;
  salaryType?: string | null;
  netAmount?: number | null;
  grossAmount?: number | null;
  isTaxable?: boolean;
  name?: string;
  ownerEntityId?: string | null;
}

export interface ExpenseItem {
  amount: number;
  frequency: string;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  category?: string;
  name?: string;
  ownerEntityId?: string | null;
}

export interface LoanItem {
  minRepayment: number;
  repaymentFrequency: string;
  name?: string;
  principal?: number;
  interestRate?: number;
  offsetBalance?: number;
  ownerEntityId?: string | null;
}

export interface CashflowInput {
  income: IncomeItem[];
  expenses: ExpenseItem[];
  loans: LoanItem[];
}

export interface CashflowResult {
  // Monthly figures (gross/net separation)
  monthlyGrossIncome: number;
  monthlyNetIncome: number;
  monthlyIncome: number; // Alias for monthlyNetIncome
  monthlyPaygWithholding: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyCashflow: number;
  monthlySurplus: number; // Alias for monthlyCashflow

  // Annual figures
  annualGrossIncome: number;
  annualNetIncome: number;
  annualIncome: number; // Alias for annualNetIncome
  annualPaygWithholding: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualCashflow: number;
  annualSurplus: number; // Alias for annualCashflow

  // Metrics
  savingsRate: number; // Percentage of income saved
  expenseRatio: number; // Expenses as % of income
  debtServiceRatio: number; // Loan repayments as % of income

  // Breakdown
  essentialExpenses: number;
  discretionaryExpenses: number;
  incomeByType: Record<string, number>;
  expensesByCategory: Record<string, number>;

  // Tax-related
  taxableIncome: number;
  taxDeductibleExpenses: number;
}

// Simple result for basic use cases
export interface SimpleCashflowResult {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyCashflow: number;
  annualIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualCashflow: number;
  savingsRate: number;
  expenseRatio: number;
  debtServiceRatio: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate gross and net amounts for an income item
 * Handles SALARY income with GROSS/NET types appropriately
 */
function calculateIncomeAmounts(item: IncomeItem): {
  monthlyGross: number;
  monthlyNet: number;
  monthlyPayg: number;
} {
  const monthlyAmount = toMonthly(item.amount, item.frequency as Frequency);

  // Default: amount is both gross and net (no PAYG)
  let monthlyGross = monthlyAmount;
  let monthlyNet = monthlyAmount;
  let monthlyPayg = 0;

  if (item.type === 'SALARY') {
    if (item.salaryType === 'NET') {
      // User entered NET income - don't re-calculate PAYG
      if (item.grossAmount != null) {
        monthlyGross = toMonthly(item.grossAmount, item.frequency as Frequency);
        monthlyNet = monthlyAmount; // The entered amount is already net
        monthlyPayg = monthlyGross - monthlyNet;
      } else {
        // No grossAmount stored, the entered amount IS the net income
        monthlyGross = monthlyAmount;
        monthlyNet = monthlyAmount;
        monthlyPayg = 0;
      }
    } else {
      // User entered GROSS income - calculate take-home pay
      const takeHome = calculateTakeHomePay(
        item.amount,
        item.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL'
      );
      monthlyGross = monthlyAmount;
      monthlyNet = toMonthly(takeHome.netAmount, item.frequency as Frequency);
      monthlyPayg = toMonthly(takeHome.paygWithholding + takeHome.medicareLevy, item.frequency as Frequency);
    }
  }

  return { monthlyGross, monthlyNet, monthlyPayg };
}

/**
 * Get net income amount for an income item (simple version)
 * For backward compatibility with existing code
 */
export function getNetMonthlyAmount(item: IncomeItem): number {
  return calculateIncomeAmounts(item).monthlyNet;
}

// =============================================================================
// MAIN CALCULATIONS
// =============================================================================

/**
 * Calculate monthly cashflow components (simple version)
 * For backward compatibility
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
 * Calculate annual cashflow components (simple version)
 * For backward compatibility
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
 * Calculate simple cashflow result (for backward compatibility)
 */
export function calculateSimpleCashflow(input: CashflowInput): SimpleCashflowResult {
  const monthly = calculateMonthlyCashflow(input);
  const annual = calculateAnnualCashflow(input);

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
    monthlyIncome: monthly.income,
    monthlyExpenses: monthly.expenses,
    monthlyLoanRepayments: monthly.loanRepayments,
    monthlyCashflow: monthly.cashflow,
    annualIncome: annual.income,
    annualExpenses: annual.expenses,
    annualLoanRepayments: annual.loanRepayments,
    annualCashflow: annual.cashflow,
    savingsRate,
    expenseRatio,
    debtServiceRatio,
    essentialExpenses: monthly.essentialExpenses,
    discretionaryExpenses: monthly.discretionaryExpenses,
  };
}

/**
 * Calculate complete cashflow analysis with all breakdowns.
 *
 * This is the canonical cashflow calculation used throughout the app.
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only items
 * whose `ownerEntityId` matches are included in the result. Default =
 * no filter for backward-compat — every existing caller continues to
 * receive household-wide totals exactly as before.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.3.
 */
export function calculateCashflow(
  input: CashflowInput,
  ownerEntityId?: string,
): CashflowResult {
  // Apply optional entity filter once at the top so every downstream
  // loop sees the scoped set. `ownerEntityId === undefined` ⇒ no filter.
  const incomeFiltered = ownerEntityId
    ? input.income.filter((i) => i.ownerEntityId === ownerEntityId)
    : input.income;
  const expensesFiltered = ownerEntityId
    ? input.expenses.filter((e) => e.ownerEntityId === ownerEntityId)
    : input.expenses;
  const loansFiltered = ownerEntityId
    ? input.loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : input.loans;

  // Calculate income with gross/net separation
  let monthlyGrossIncome = 0;
  let monthlyNetIncome = 0;
  let monthlyPaygWithholding = 0;
  let taxableIncome = 0;
  const incomeByType: Record<string, number> = {};

  for (const item of incomeFiltered) {
    const { monthlyGross, monthlyNet, monthlyPayg } = calculateIncomeAmounts(item);

    monthlyGrossIncome += monthlyGross;
    monthlyNetIncome += monthlyNet;
    monthlyPaygWithholding += monthlyPayg;

    if (item.isTaxable !== false) {
      taxableIncome += monthlyGross * 12;
    }

    const type = item.type || 'OTHER';
    incomeByType[type] = (incomeByType[type] || 0) + monthlyNet;
  }

  // Calculate expenses with breakdowns
  let monthlyExpenses = 0;
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;
  let taxDeductibleExpenses = 0;
  const expensesByCategory: Record<string, number> = {};

  for (const expense of expensesFiltered) {
    const monthly = toMonthly(expense.amount, expense.frequency as Frequency);
    monthlyExpenses += monthly;

    if (expense.isEssential) {
      essentialExpenses += monthly;
    } else {
      discretionaryExpenses += monthly;
    }

    if (expense.isTaxDeductible) {
      taxDeductibleExpenses += monthly * 12;
    }

    const category = expense.category || 'OTHER';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + monthly;
  }

  // Calculate loan repayments
  let monthlyLoanRepayments = 0;
  for (const loan of loansFiltered) {
    const monthly = toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency);
    monthlyLoanRepayments += monthly;
  }

  // Calculate cashflow (using NET income)
  const monthlyCashflow = monthlyNetIncome - monthlyExpenses - monthlyLoanRepayments;

  // Calculate ratios (avoid division by zero)
  const savingsRate =
    monthlyNetIncome > 0 ? (monthlyCashflow / monthlyNetIncome) * 100 : 0;

  const expenseRatio =
    monthlyNetIncome > 0 ? (monthlyExpenses / monthlyNetIncome) * 100 : 0;

  const debtServiceRatio =
    monthlyNetIncome > 0 ? (monthlyLoanRepayments / monthlyNetIncome) * 100 : 0;

  // Round all values to 2 decimal places
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    // Monthly (gross/net separation)
    monthlyGrossIncome: round(monthlyGrossIncome),
    monthlyNetIncome: round(monthlyNetIncome),
    monthlyIncome: round(monthlyNetIncome), // Alias
    monthlyPaygWithholding: round(monthlyPaygWithholding),
    monthlyExpenses: round(monthlyExpenses),
    monthlyLoanRepayments: round(monthlyLoanRepayments),
    monthlyCashflow: round(monthlyCashflow),
    monthlySurplus: round(monthlyCashflow), // Alias

    // Annual
    annualGrossIncome: round(monthlyGrossIncome * 12),
    annualNetIncome: round(monthlyNetIncome * 12),
    annualIncome: round(monthlyNetIncome * 12), // Alias
    annualPaygWithholding: round(monthlyPaygWithholding * 12),
    annualExpenses: round(monthlyExpenses * 12),
    annualLoanRepayments: round(monthlyLoanRepayments * 12),
    annualCashflow: round(monthlyCashflow * 12),
    annualSurplus: round(monthlyCashflow * 12), // Alias

    // Metrics
    savingsRate: round(savingsRate),
    expenseRatio: round(expenseRatio),
    debtServiceRatio: round(debtServiceRatio),

    // Breakdown
    essentialExpenses: round(essentialExpenses),
    discretionaryExpenses: round(discretionaryExpenses),
    incomeByType,
    expensesByCategory,

    // Tax-related
    taxableIncome: round(taxableIncome),
    taxDeductibleExpenses: round(taxDeductibleExpenses),
  };
}
