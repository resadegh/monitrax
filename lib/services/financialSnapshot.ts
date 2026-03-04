/**
 * Financial Snapshot Service
 *
 * SINGLE SOURCE OF TRUTH for all financial calculations.
 *
 * This service consolidates all expense/income/cashflow calculations
 * to ensure consistent numbers across all pages:
 * - Dashboard
 * - Budget Analysis
 * - Expenses Page
 * - Cash Flow Analysis
 * - Portfolio Snapshot
 *
 * Usage:
 *   const snapshot = await getFinancialSnapshot(userId);
 *   // All calculations are pre-computed and consistent
 */

import prisma from '@/lib/db';
import { Frequency, LIQUID_ACCOUNT_TYPES } from '@/lib/types/prisma-enums';
import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import {
  aggregateExpenses,
  aggregateIncome,
  calculateCashflow,
  type ExpenseAggregation,
  type IncomeAggregation,
  type CashflowResult,
} from '@/lib/calculations';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpenseBreakdown {
  /** All expenses (no filter) */
  all: ExpenseAggregation;
  /** Only recurring expenses (isRecurring !== false) */
  recurring: ExpenseAggregation;
  /** Only non-recurring expenses (isRecurring === false) */
  nonRecurring: ExpenseAggregation;
  /** Essential expenses only (isEssential === true) */
  essential: ExpenseAggregation;
  /** Discretionary expenses (isEssential === false or undefined) */
  discretionary: ExpenseAggregation;
}

export interface IncomeBreakdown {
  /** All income sources */
  all: IncomeAggregation;
  /** Primary income (salary, wages) */
  primary: IncomeAggregation;
  /** Secondary income (rentals, dividends, etc.) */
  secondary: IncomeAggregation;
}

export interface AccountSummary {
  /** Total across all accounts */
  total: number;
  /** Liquid cash (savings + checking + offset) */
  liquidCash: number;
  /** By account type */
  byType: Record<string, number>;
}

export interface LoanSummary {
  /** Total principal outstanding */
  totalPrincipal: number;
  /** Monthly repayments */
  monthlyRepayments: number;
  /** Annual repayments */
  annualRepayments: number;
}

export interface FinancialSnapshot {
  // Core Data Counts
  counts: {
    expenses: number;
    income: number;
    accounts: number;
    loans: number;
  };

  // Expense Calculations (Monthly)
  expenses: {
    monthly: ExpenseBreakdown;
    annual: ExpenseBreakdown;
  };

  // Income Calculations
  income: {
    monthly: IncomeBreakdown;
    annual: IncomeBreakdown;
  };

  // Account Balances
  accounts: AccountSummary;

  // Loan Summary
  loans: LoanSummary;

  // Cashflow Analysis (uses all expenses, not filtered)
  cashflow: CashflowResult;

  // Emergency Fund Metrics
  emergencyFund: {
    liquidCash: number;
    monthlyExpenses: number;
    monthsCovered: number;
    targetMonths: number;
    gap: number;
    status: 'danger' | 'warning' | 'good' | 'excellent';
  };

  // Financial Health Score
  healthScore: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    savingsRate: number;
    debtToIncome: number;
  };

  // Timestamp for cache validation
  calculatedAt: Date;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

interface RawUserData {
  expenses: Array<{
    id: string;
    name: string;
    amount: number;
    frequency: string;
    category: string | null;
    isEssential: boolean;
    isRecurring: boolean;
    isTaxDeductible: boolean;
    propertyId: string | null;
    loanId: string | null;
    assetId: string | null;
  }>;
  income: Array<{
    id: string;
    name: string;
    amount: number;
    frequency: string;
    type: string;
    salaryType: string | null;
    netAmount: number | null;
    grossAmount: number | null;
    paygWithholding: number | null;
    isTaxable: boolean;
    propertyId: string | null;
    investmentAccountId: string | null;
  }>;
  accounts: Array<{
    id: string;
    type: string;
    currentBalance: number;
  }>;
  loans: Array<{
    id: string;
    principal: number;
    minRepayment: number | null;
    repaymentFrequency: string | null;
  }>;
}

async function fetchUserData(userId: string): Promise<RawUserData> {
  const [expenses, income, accounts, loans] = await Promise.all([
    prisma.expense.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        amount: true,
        frequency: true,
        category: true,
        isEssential: true,
        isRecurring: true,
        isTaxDeductible: true,
        propertyId: true,
        loanId: true,
        assetId: true,
      },
    }),
    prisma.income.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        amount: true,
        frequency: true,
        type: true,
        salaryType: true,
        netAmount: true,
        grossAmount: true,
        paygWithholding: true,
        isTaxable: true,
        propertyId: true,
        investmentAccountId: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        currentBalance: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: {
        id: true,
        principal: true,
        minRepayment: true,
        repaymentFrequency: true,
      },
    }),
  ]);

  return { expenses, income, accounts, loans };
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

function calculateExpenseBreakdown(
  expenses: RawUserData['expenses'],
  targetFrequency: 'monthly' | 'annual'
): ExpenseBreakdown {
  // All expenses
  const allExpenses = expenses.map(e => ({
    amount: e.amount,
    frequency: e.frequency,
    category: e.category || undefined,
    isEssential: e.isEssential,
    isTaxDeductible: e.isTaxDeductible,
    propertyId: e.propertyId,
    loanId: e.loanId,
    assetId: e.assetId,
  }));

  // Recurring expenses (isRecurring !== false, which includes null/undefined)
  const recurringExpenses = expenses
    .filter(e => e.isRecurring !== false)
    .map(e => ({
      amount: e.amount,
      frequency: e.frequency,
      category: e.category || undefined,
      isEssential: e.isEssential,
      isTaxDeductible: e.isTaxDeductible,
    }));

  // Non-recurring expenses (isRecurring === false)
  const nonRecurringExpenses = expenses
    .filter(e => e.isRecurring === false)
    .map(e => ({
      amount: e.amount,
      frequency: e.frequency,
      category: e.category || undefined,
      isEssential: e.isEssential,
      isTaxDeductible: e.isTaxDeductible,
    }));

  // Essential expenses
  const essentialExpenses = expenses
    .filter(e => e.isEssential === true)
    .map(e => ({
      amount: e.amount,
      frequency: e.frequency,
      category: e.category || undefined,
      isEssential: true,
      isTaxDeductible: e.isTaxDeductible,
    }));

  // Discretionary expenses (isEssential === false or not set)
  const discretionaryExpenses = expenses
    .filter(e => e.isEssential !== true)
    .map(e => ({
      amount: e.amount,
      frequency: e.frequency,
      category: e.category || undefined,
      isEssential: false,
      isTaxDeductible: e.isTaxDeductible,
    }));

  return {
    all: aggregateExpenses(allExpenses, targetFrequency),
    recurring: aggregateExpenses(recurringExpenses, targetFrequency),
    nonRecurring: aggregateExpenses(nonRecurringExpenses, targetFrequency),
    essential: aggregateExpenses(essentialExpenses, targetFrequency),
    discretionary: aggregateExpenses(discretionaryExpenses, targetFrequency),
  };
}

function calculateIncomeBreakdown(
  income: RawUserData['income'],
  targetFrequency: 'monthly' | 'annual'
): IncomeBreakdown {
  const allIncome = income.map(i => ({
    amount: i.amount,
    frequency: i.frequency,
    type: i.type,
    salaryType: i.salaryType,
    netAmount: i.netAmount,
    grossAmount: i.grossAmount,
    paygWithholding: i.paygWithholding,
    isTaxable: i.isTaxable,
  }));

  // Primary income (salary types)
  const primaryIncome = income
    .filter(i => i.type === 'SALARY' || i.type === 'WAGES')
    .map(i => ({
      amount: i.amount,
      frequency: i.frequency,
      type: i.type,
      salaryType: i.salaryType,
      netAmount: i.netAmount,
      grossAmount: i.grossAmount,
      paygWithholding: i.paygWithholding,
      isTaxable: i.isTaxable,
    }));

  // Secondary income (everything else)
  const secondaryIncome = income
    .filter(i => i.type !== 'SALARY' && i.type !== 'WAGES')
    .map(i => ({
      amount: i.amount,
      frequency: i.frequency,
      type: i.type,
      salaryType: i.salaryType,
      netAmount: i.netAmount,
      grossAmount: i.grossAmount,
      paygWithholding: i.paygWithholding,
      isTaxable: i.isTaxable,
    }));

  return {
    all: aggregateIncome(allIncome, targetFrequency),
    primary: aggregateIncome(primaryIncome, targetFrequency),
    secondary: aggregateIncome(secondaryIncome, targetFrequency),
  };
}

function calculateAccountSummary(accounts: RawUserData['accounts']): AccountSummary {
  // Use centralized LIQUID_ACCOUNT_TYPES from prisma-enums (single source of truth)

  let total = 0;
  let liquidCash = 0;
  const byType: Record<string, number> = {};

  for (const account of accounts) {
    total += account.currentBalance;

    if (LIQUID_ACCOUNT_TYPES.includes(account.type as any)) {
      liquidCash += account.currentBalance;
    }

    byType[account.type] = (byType[account.type] || 0) + account.currentBalance;
  }

  return { total, liquidCash, byType };
}

function calculateLoanSummary(loans: RawUserData['loans']): LoanSummary {
  let totalPrincipal = 0;
  let monthlyRepayments = 0;

  for (const loan of loans) {
    totalPrincipal += loan.principal;

    if (loan.minRepayment && loan.repaymentFrequency) {
      monthlyRepayments += toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency);
    }
  }

  return {
    totalPrincipal,
    monthlyRepayments,
    annualRepayments: monthlyRepayments * 12,
  };
}

function calculateEmergencyFund(
  liquidCash: number,
  monthlyExpenses: number
): FinancialSnapshot['emergencyFund'] {
  const targetMonths = 6;
  const monthsCovered = monthlyExpenses > 0 ? liquidCash / monthlyExpenses : 0;
  const gap = Math.max(0, (targetMonths * monthlyExpenses) - liquidCash);

  let status: 'danger' | 'warning' | 'good' | 'excellent';
  if (monthsCovered < 1) status = 'danger';
  else if (monthsCovered < 3) status = 'warning';
  else if (monthsCovered < 6) status = 'good';
  else status = 'excellent';

  return {
    liquidCash,
    monthlyExpenses,
    monthsCovered,
    targetMonths,
    gap,
    status,
  };
}

function calculateHealthScore(
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlyLoanRepayments: number,
  totalDebt: number,
  monthsCovered: number
): FinancialSnapshot['healthScore'] {
  // Savings rate
  const savingsRate = monthlyIncome > 0
    ? ((monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome) * 100
    : 0;

  // Debt to income ratio
  const debtToIncome = monthlyIncome > 0
    ? (totalDebt / (monthlyIncome * 12)) * 100
    : 0;

  // Component scores (0-100)
  const savingsRateScore = Math.min(Math.max(savingsRate * 5, 0), 100);
  const emergencyFundScore = Math.min((monthsCovered / 6) * 100, 100);
  const debtToIncomeScore = Math.max(100 - debtToIncome, 0);
  const diversificationScore = 25; // Simplified

  // Weighted average
  const score = Math.round(
    savingsRateScore * 0.30 +
    emergencyFundScore * 0.30 +
    debtToIncomeScore * 0.25 +
    diversificationScore * 0.15
  );

  // Grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 35) grade = 'D';
  else grade = 'F';

  return { score, grade, savingsRate, debtToIncome };
}

// =============================================================================
// MAIN SERVICE FUNCTION
// =============================================================================

/**
 * Get a complete financial snapshot for a user.
 *
 * This is the SINGLE SOURCE OF TRUTH for all financial calculations.
 * All pages should use this to ensure consistent numbers.
 */
export async function getFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
  // Fetch all data in parallel
  const data = await fetchUserData(userId);

  // Calculate expense breakdowns
  const monthlyExpenses = calculateExpenseBreakdown(data.expenses, 'monthly');
  const annualExpenses = calculateExpenseBreakdown(data.expenses, 'annual');

  // Calculate income breakdowns
  const monthlyIncome = calculateIncomeBreakdown(data.income, 'monthly');
  const annualIncome = calculateIncomeBreakdown(data.income, 'annual');

  // Calculate account summary
  const accounts = calculateAccountSummary(data.accounts);

  // Calculate loan summary
  const loans = calculateLoanSummary(data.loans);

  // Calculate cashflow using ALL expenses (not filtered)
  const cashflowInput = {
    income: data.income.map(i => ({
      amount: i.amount,
      frequency: i.frequency,
      type: i.type,
      salaryType: i.salaryType,
      netAmount: i.netAmount,
    })),
    expenses: data.expenses.map(e => ({
      amount: e.amount,
      frequency: e.frequency,
      isEssential: e.isEssential,
    })),
    loans: data.loans
      .filter(l => l.minRepayment && l.repaymentFrequency)
      .map(l => ({
        minRepayment: l.minRepayment!,
        repaymentFrequency: l.repaymentFrequency!,
      })),
  };
  const cashflow = calculateCashflow(cashflowInput);

  // Calculate emergency fund metrics
  const emergencyFund = calculateEmergencyFund(
    accounts.liquidCash,
    monthlyExpenses.all.total
  );

  // Calculate health score
  const healthScore = calculateHealthScore(
    monthlyIncome.all.netTotal,
    monthlyExpenses.all.total,
    loans.monthlyRepayments,
    loans.totalPrincipal,
    emergencyFund.monthsCovered
  );

  return {
    counts: {
      expenses: data.expenses.length,
      income: data.income.length,
      accounts: data.accounts.length,
      loans: data.loans.length,
    },
    expenses: {
      monthly: monthlyExpenses,
      annual: annualExpenses,
    },
    income: {
      monthly: monthlyIncome,
      annual: annualIncome,
    },
    accounts,
    loans,
    cashflow,
    emergencyFund,
    healthScore,
    calculatedAt: new Date(),
  };
}

// =============================================================================
// CONVENIENCE GETTERS
// =============================================================================

/**
 * Get just the monthly expense total (all expenses).
 * Use this when you need a quick total without the full snapshot.
 */
export async function getMonthlyExpenseTotal(userId: string): Promise<number> {
  const snapshot = await getFinancialSnapshot(userId);
  return snapshot.expenses.monthly.all.total;
}

/**
 * Get just the monthly income total (net).
 */
export async function getMonthlyIncomeTotal(userId: string): Promise<number> {
  const snapshot = await getFinancialSnapshot(userId);
  return snapshot.income.monthly.all.netTotal;
}

/**
 * Get the monthly cashflow (income - expenses - loan payments).
 */
export async function getMonthlyCashflow(userId: string): Promise<number> {
  const snapshot = await getFinancialSnapshot(userId);
  return snapshot.cashflow.monthlyCashflow;
}
