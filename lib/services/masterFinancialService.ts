/**
 * MASTER FINANCIAL SERVICE
 * =========================
 *
 * CRITICAL DESIGN PRINCIPLE: SINGLE SOURCE OF TRUTH
 *
 * This service is the CANONICAL source for ALL financial calculations in the app.
 * Every API endpoint MUST use this service for financial data to ensure consistency.
 *
 * DO NOT:
 * - Calculate expenses/income/cashflow directly in API routes
 * - Query database and aggregate data manually
 * - Create new calculation logic outside this service
 *
 * DO:
 * - Call getMasterFinancialSnapshot() for any financial data needs
 * - Use the specific getters for targeted data (e.g., getNetWorth())
 * - Extend this service if new calculations are needed
 *
 * ARCHITECTURE:
 * This service integrates all existing calculation engines:
 * - lib/calculations/netWorthCalculator.ts
 * - lib/calculations/cashflowOrchestrator.ts
 * - lib/calculations/expenseAggregator.ts
 * - lib/calculations/incomeAggregator.ts
 * - lib/calculations/loanAggregator.ts
 * - lib/utils/calculations.ts (property calculations)
 * - lib/tax-engine/core/*.ts (tax calculations)
 *
 * @module lib/services/masterFinancialService
 * @version 1.0.0
 * @since Phase 28
 */

import prisma from '@/lib/db';
import { Frequency, LIQUID_ACCOUNT_TYPES } from '@/lib/types/prisma-enums';
import { toMonthly, toAnnual } from '@/lib/utils/frequencies';

// Import existing calculation engines
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
  type NetWorthResult,
  type AssetSummary,
  type LiabilitySummary,
} from '@/lib/calculations/netWorthCalculator';

import {
  calculateCashflow,
  type CashflowResult,
} from '@/lib/calculations/cashflowOrchestrator';

import {
  aggregateExpenses,
  aggregateExpensesByCategory,
  type ExpenseAggregation,
  type CategoryBreakdown,
} from '@/lib/calculations/expenseAggregator';

import {
  aggregateIncome,
  type IncomeAggregation,
} from '@/lib/calculations/incomeAggregator';

import {
  aggregateLoanRepayments,
  calculateDebtMetrics,
  type LoanAggregation,
  type DebtMetrics,
} from '@/lib/calculations/loanAggregator';

import {
  calculateLVR,
  calculateEquity,
  calculateRentalYield,
} from '@/lib/utils/calculations';

// =============================================================================
// MASTER TYPES
// =============================================================================

/**
 * Budget vs Actual variance metrics
 * @see lib/utils/reconciliation.ts for calculation utilities
 */
export interface BudgetVariance {
  /** Total budgeted amount (monthly) */
  budgeted: number;
  /** Total actual amount (monthly) */
  actual: number;
  /** Variance (budgeted - actual, positive = under budget) */
  variance: number;
  /** Variance as percentage */
  variancePercent: number;
  /** Status indicator */
  status: 'under' | 'over' | 'on_track';
  /** Count of entries with budgets set */
  entriesWithBudget: number;
  /** Count of entries reconciled from transactions */
  entriesReconciled: number;
}

/**
 * Complete expense breakdown with all filtering options
 */
export interface MasterExpenseBreakdown {
  /** All expenses (no filter) */
  all: ExpenseAggregation;
  /** Recurring expenses only (isRecurring !== false) */
  recurring: ExpenseAggregation;
  /** Non-recurring/one-time expenses */
  nonRecurring: ExpenseAggregation;
  /** Essential expenses (isEssential === true) */
  essential: ExpenseAggregation;
  /** Discretionary expenses */
  discretionary: ExpenseAggregation;
  /** Tax-deductible expenses */
  taxDeductible: ExpenseAggregation;
  /** By category breakdown */
  byCategory: CategoryBreakdown[];
  /** Budget vs Actual variance (Phase 30) */
  budgetVariance: BudgetVariance;
}

/**
 * Complete income breakdown
 */
export interface MasterIncomeBreakdown {
  /** All income sources */
  all: IncomeAggregation;
  /** Primary income (salary, wages) */
  primary: IncomeAggregation;
  /** Secondary income (rental, dividends, etc.) */
  secondary: IncomeAggregation;
  /** Passive income only */
  passive: IncomeAggregation;
  /** Budget vs Actual variance (Phase 30) */
  budgetVariance: BudgetVariance;
}

/**
 * Property-specific metrics
 */
export interface PropertyMetrics {
  id: string;
  name: string;
  currentValue: number;
  purchasePrice: number;
  loanBalance: number;
  equity: number;
  lvr: number;
  annualRentalIncome: number;
  rentalYield: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
  capitalGrowth: number;
  capitalGrowthPercent: number;
}

/**
 * Investment portfolio metrics
 */
export interface InvestmentMetrics {
  totalValue: number;
  totalCostBase: number;
  unrealisedGain: number;
  unrealisedGainPercent: number;
  holdingsCount: number;
  byType: Record<string, { value: number; percentage: number }>;
}

/**
 * Tax summary
 */
export interface TaxSummary {
  estimatedTaxableIncome: number;
  estimatedTaxPayable: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  totalDeductions: number;
  paygWithheld: number;
  estimatedRefundOrOwing: number;
}

/**
 * Emergency fund metrics
 */
export interface EmergencyFundMetrics {
  liquidCash: number;
  monthlyExpenses: number;
  monthsCovered: number;
  targetMonths: number;
  gap: number;
  status: 'danger' | 'warning' | 'good' | 'excellent';
}

/**
 * Financial health score
 */
export interface HealthScoreMetrics {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    savingsRate: { score: number; value: number; weight: number };
    emergencyFund: { score: number; value: number; weight: number };
    debtToIncome: { score: number; value: number; weight: number };
    netWorthGrowth: { score: number; value: number; weight: number };
  };
}

/**
 * Complete Master Financial Snapshot
 * This is the canonical data structure for all financial data
 */
export interface MasterFinancialSnapshot {
  // Metadata
  userId: string;
  calculatedAt: Date;
  dataVersion: string;

  // Record counts
  counts: {
    expenses: number;
    income: number;
    accounts: number;
    loans: number;
    properties: number;
    investments: number;
  };

  // Net Worth
  netWorth: NetWorthResult;

  // Expenses (monthly & annual)
  expenses: {
    monthly: MasterExpenseBreakdown;
    annual: MasterExpenseBreakdown;
  };

  // Income (monthly & annual)
  income: {
    monthly: MasterIncomeBreakdown;
    annual: MasterIncomeBreakdown;
  };

  // Cashflow
  cashflow: CashflowResult;

  // Debt
  debt: {
    summary: LoanAggregation;
    metrics: DebtMetrics;
  };

  // Properties
  properties: PropertyMetrics[];
  propertyPortfolioValue: number;
  propertyPortfolioEquity: number;

  // Investments
  investments: InvestmentMetrics;

  // Tax
  tax: TaxSummary;

  // Emergency Fund
  emergencyFund: EmergencyFundMetrics;

  // Health Score
  healthScore: HealthScoreMetrics;

  // Quick access metrics (commonly used)
  quickMetrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyCashflow: number;
    monthlyLoanRepayments: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorthValue: number;
    savingsRate: number;
    liquidCash: number;
  };
}

// =============================================================================
// RAW DATA TYPES (from database)
// =============================================================================

interface RawExpense {
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
  // Phase 30: Budget tracking
  budgetedAmount: number | null;
  lastReconciled: Date | null;
}

interface RawIncome {
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
  // Phase 30: Budget tracking
  budgetedAmount: number | null;
  lastReconciled: Date | null;
}

interface RawAccount {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface RawLoan {
  id: string;
  name: string;
  principal: number;
  minRepayment: number | null;
  repaymentFrequency: string | null;
  interestRateAnnual: number;
  type: string;
  isInterestOnly: boolean;
  propertyId: string | null;
  offsetAccountId: string | null;
}

interface RawProperty {
  id: string;
  name: string;
  address: string | null;
  currentValue: number;
  purchasePrice: number;
  purchaseDate: Date | null;
}

interface RawInvestmentHolding {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
  currentPrice: number | null;
  type: string;
}

interface RawSuperannuation {
  id: string;
  currentBalance: number;
}

interface RawAsset {
  id: string;
  currentValue: number;
}

interface RawUserData {
  expenses: RawExpense[];
  income: RawIncome[];
  accounts: RawAccount[];
  loans: RawLoan[];
  properties: RawProperty[];
  investmentHoldings: RawInvestmentHolding[];
  superannuation: RawSuperannuation[];
  assets: RawAsset[];
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch all user financial data from database
 * This is the ONLY place where raw data is fetched
 */
async function fetchAllUserData(userId: string): Promise<RawUserData> {
  const [
    expenses,
    income,
    accounts,
    loans,
    properties,
    investmentHoldings,
    superannuation,
    assets,
  ] = await Promise.all([
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
        budgetedAmount: true,
        lastReconciled: true,
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
        budgetedAmount: true,
        lastReconciled: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        currentBalance: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        principal: true,
        minRepayment: true,
        repaymentFrequency: true,
        interestRateAnnual: true,
        type: true,
        isInterestOnly: true,
        propertyId: true,
        offsetAccountId: true,
      },
    }),
    prisma.property.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        address: true,
        currentValue: true,
        purchasePrice: true,
        purchaseDate: true,
      },
    }),
    prisma.investmentHolding.findMany({
      where: { investmentAccount: { userId } },
      select: {
        id: true,
        ticker: true,
        units: true,
        averagePrice: true,
        currentPrice: true,
        type: true,
      },
    }),
    prisma.superannuationAccount.findMany({
      where: { userId },
      select: {
        id: true,
        currentBalance: true,
      },
    }),
    prisma.asset.findMany({
      where: { userId },
      select: {
        id: true,
        currentValue: true,
      },
    }),
  ]);

  return {
    expenses,
    income,
    accounts,
    loans,
    properties,
    investmentHoldings,
    superannuation,
    assets,
  };
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

function buildExpenseBreakdown(
  expenses: RawExpense[],
  targetFrequency: 'monthly' | 'annual'
): MasterExpenseBreakdown {
  const mapExpense = (e: RawExpense) => ({
    amount: e.amount,
    frequency: e.frequency,
    category: e.category || undefined,
    isEssential: e.isEssential,
    isTaxDeductible: e.isTaxDeductible,
    propertyId: e.propertyId,
    loanId: e.loanId,
    assetId: e.assetId,
  });

  const all = aggregateExpenses(expenses.map(mapExpense), targetFrequency);

  const recurring = aggregateExpenses(
    expenses.filter(e => e.isRecurring !== false).map(mapExpense),
    targetFrequency
  );

  const nonRecurring = aggregateExpenses(
    expenses.filter(e => e.isRecurring === false).map(mapExpense),
    targetFrequency
  );

  const essential = aggregateExpenses(
    expenses.filter(e => e.isEssential === true).map(mapExpense),
    targetFrequency
  );

  const discretionary = aggregateExpenses(
    expenses.filter(e => e.isEssential !== true).map(mapExpense),
    targetFrequency
  );

  const taxDeductible = aggregateExpenses(
    expenses.filter(e => e.isTaxDeductible === true).map(mapExpense),
    targetFrequency
  );

  const byCategory = aggregateExpensesByCategory(
    expenses.map(mapExpense),
    targetFrequency
  );

  // Phase 30: Calculate budget variance
  const budgetVariance = calculateExpenseBudgetVariance(expenses, targetFrequency);

  return {
    all,
    recurring,
    nonRecurring,
    essential,
    discretionary,
    taxDeductible,
    byCategory,
    budgetVariance,
  };
}

/**
 * Calculate budget variance for expenses
 * Uses actual amounts vs budgeted amounts, converted to target frequency
 */
function calculateExpenseBudgetVariance(
  expenses: RawExpense[],
  targetFrequency: 'monthly' | 'annual'
): BudgetVariance {
  let totalActual = 0;
  let totalBudgeted = 0;
  let entriesWithBudget = 0;
  let entriesReconciled = 0;

  for (const expense of expenses) {
    const freq = expense.frequency as Frequency;
    const actualConverted = targetFrequency === 'monthly'
      ? toMonthly(expense.amount, freq)
      : toAnnual(expense.amount, freq);

    totalActual += actualConverted;

    if (expense.budgetedAmount !== null && expense.budgetedAmount !== undefined) {
      const budgetedConverted = targetFrequency === 'monthly'
        ? toMonthly(expense.budgetedAmount, freq)
        : toAnnual(expense.budgetedAmount, freq);
      totalBudgeted += budgetedConverted;
      entriesWithBudget++;
    } else {
      // No budget set, use actual as budget (no variance)
      totalBudgeted += actualConverted;
    }

    if (expense.lastReconciled !== null) {
      entriesReconciled++;
    }
  }

  const variance = totalBudgeted - totalActual;
  const variancePercent = totalBudgeted > 0 ? (variance / totalBudgeted) * 100 : 0;

  let status: 'under' | 'over' | 'on_track';
  if (variancePercent > 5) {
    status = 'under'; // Under budget (good for expenses)
  } else if (variancePercent < -5) {
    status = 'over'; // Over budget (bad for expenses)
  } else {
    status = 'on_track';
  }

  return {
    budgeted: totalBudgeted,
    actual: totalActual,
    variance,
    variancePercent,
    status,
    entriesWithBudget,
    entriesReconciled,
  };
}

function buildIncomeBreakdown(
  income: RawIncome[],
  targetFrequency: 'monthly' | 'annual'
): MasterIncomeBreakdown {
  const mapIncome = (i: RawIncome) => ({
    amount: i.amount,
    frequency: i.frequency,
    type: i.type,
    salaryType: i.salaryType,
    netAmount: i.netAmount,
    grossAmount: i.grossAmount,
    paygWithholding: i.paygWithholding,
    isTaxable: i.isTaxable,
  });

  const all = aggregateIncome(income.map(mapIncome), targetFrequency);

  const primaryTypes = ['SALARY', 'WAGES'];
  const primary = aggregateIncome(
    income.filter(i => primaryTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  const secondary = aggregateIncome(
    income.filter(i => !primaryTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  const passiveTypes = ['RENTAL', 'DIVIDEND', 'INTEREST', 'ROYALTY'];
  const passive = aggregateIncome(
    income.filter(i => passiveTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  // Phase 30: Calculate budget variance
  const budgetVariance = calculateIncomeBudgetVariance(income, targetFrequency);

  return { all, primary, secondary, passive, budgetVariance };
}

/**
 * Calculate budget variance for income
 * Uses actual amounts vs budgeted amounts, converted to target frequency
 */
function calculateIncomeBudgetVariance(
  income: RawIncome[],
  targetFrequency: 'monthly' | 'annual'
): BudgetVariance {
  let totalActual = 0;
  let totalBudgeted = 0;
  let entriesWithBudget = 0;
  let entriesReconciled = 0;

  for (const inc of income) {
    const freq = inc.frequency as Frequency;
    const actualConverted = targetFrequency === 'monthly'
      ? toMonthly(inc.amount, freq)
      : toAnnual(inc.amount, freq);

    totalActual += actualConverted;

    if (inc.budgetedAmount !== null && inc.budgetedAmount !== undefined) {
      const budgetedConverted = targetFrequency === 'monthly'
        ? toMonthly(inc.budgetedAmount, freq)
        : toAnnual(inc.budgetedAmount, freq);
      totalBudgeted += budgetedConverted;
      entriesWithBudget++;
    } else {
      // No budget set, use actual as budget (no variance)
      totalBudgeted += actualConverted;
    }

    if (inc.lastReconciled !== null) {
      entriesReconciled++;
    }
  }

  const variance = totalActual - totalBudgeted; // For income, positive = above expectation (good)
  const variancePercent = totalBudgeted > 0 ? (variance / totalBudgeted) * 100 : 0;

  let status: 'under' | 'over' | 'on_track';
  if (variancePercent > 5) {
    status = 'over'; // Above budget (good for income)
  } else if (variancePercent < -5) {
    status = 'under'; // Below budget (bad for income)
  } else {
    status = 'on_track';
  }

  return {
    budgeted: totalBudgeted,
    actual: totalActual,
    variance,
    variancePercent,
    status,
    entriesWithBudget,
    entriesReconciled,
  };
}

function buildPropertyMetrics(
  properties: RawProperty[],
  loans: RawLoan[],
  income: RawIncome[],
  expenses: RawExpense[]
): PropertyMetrics[] {
  return properties.map(property => {
    // Get loans for this property
    const propertyLoans = loans.filter(l => l.propertyId === property.id);
    const loanBalance = propertyLoans.reduce((sum, l) => sum + l.principal, 0);

    // Calculate equity and LVR
    const equity = calculateEquity(property.currentValue, loanBalance);
    const lvr = calculateLVR(loanBalance, property.currentValue);

    // Get rental income for this property
    const rentalIncome = income.filter(i => i.propertyId === property.id);
    const annualRentalIncome = rentalIncome.reduce((sum, i) => {
      return sum + toAnnual(i.amount, i.frequency as Frequency);
    }, 0);

    // Calculate rental yield
    const rentalYield = calculateRentalYield(annualRentalIncome, property.currentValue);

    // Get expenses for this property
    const propertyExpenses = expenses.filter(e => e.propertyId === property.id);
    const monthlyExpenses = propertyExpenses.reduce((sum, e) => {
      return sum + toMonthly(e.amount, e.frequency as Frequency);
    }, 0);

    // Monthly loan repayments
    const monthlyLoanRepayments = propertyLoans.reduce((sum, l) => {
      if (l.minRepayment && l.repaymentFrequency) {
        return sum + toMonthly(l.minRepayment, l.repaymentFrequency as Frequency);
      }
      return sum;
    }, 0);

    // Monthly cashflow
    const monthlyRentalIncome = annualRentalIncome / 12;
    const monthlyCashflow = monthlyRentalIncome - monthlyExpenses - monthlyLoanRepayments;

    // Capital growth
    const capitalGrowth = property.currentValue - property.purchasePrice;
    const capitalGrowthPercent = property.purchasePrice > 0
      ? (capitalGrowth / property.purchasePrice) * 100
      : 0;

    return {
      id: property.id,
      name: property.name,
      currentValue: property.currentValue,
      purchasePrice: property.purchasePrice,
      loanBalance,
      equity,
      lvr,
      annualRentalIncome,
      rentalYield,
      monthlyExpenses,
      monthlyCashflow,
      capitalGrowth,
      capitalGrowthPercent,
    };
  });
}

function buildInvestmentMetrics(holdings: RawInvestmentHolding[]): InvestmentMetrics {
  let totalValue = 0;
  let totalCostBase = 0;
  const byType: Record<string, { value: number; percentage: number }> = {};

  for (const holding of holdings) {
    const price = holding.currentPrice || holding.averagePrice || 0;
    const value = holding.units * price;
    const costBase = holding.units * holding.averagePrice;

    totalValue += value;
    totalCostBase += costBase;

    const type = holding.type || 'Other';
    if (!byType[type]) {
      byType[type] = { value: 0, percentage: 0 };
    }
    byType[type].value += value;
  }

  // Calculate percentages
  Object.keys(byType).forEach(type => {
    byType[type].percentage = totalValue > 0
      ? (byType[type].value / totalValue) * 100
      : 0;
  });

  const unrealisedGain = totalValue - totalCostBase;
  const unrealisedGainPercent = totalCostBase > 0
    ? (unrealisedGain / totalCostBase) * 100
    : 0;

  return {
    totalValue,
    totalCostBase,
    unrealisedGain,
    unrealisedGainPercent,
    holdingsCount: holdings.length,
    byType,
  };
}

function buildTaxSummary(
  income: RawIncome[],
  expenses: RawExpense[]
): TaxSummary {
  // Calculate gross taxable income
  let estimatedTaxableIncome = 0;
  let totalPaygWithheld = 0;

  for (const inc of income) {
    if (inc.isTaxable) {
      const grossAmount = inc.type === 'SALARY' && inc.salaryType === 'NET' && inc.grossAmount
        ? inc.grossAmount
        : toAnnual(inc.amount, inc.frequency as Frequency);
      estimatedTaxableIncome += grossAmount;
    }
    if (inc.paygWithholding) {
      totalPaygWithheld += inc.paygWithholding;
    }
  }

  // Calculate deductions
  const totalDeductions = expenses
    .filter(e => e.isTaxDeductible)
    .reduce((sum, e) => sum + toAnnual(e.amount, e.frequency as Frequency), 0);

  // Adjust taxable income for deductions
  estimatedTaxableIncome = Math.max(0, estimatedTaxableIncome - totalDeductions);

  // Simplified tax calculation (would use tax engine in production)
  let estimatedTaxPayable = 0;
  let marginalTaxRate = 0;

  // 2024-25 Australian tax brackets (simplified)
  if (estimatedTaxableIncome <= 18200) {
    estimatedTaxPayable = 0;
    marginalTaxRate = 0;
  } else if (estimatedTaxableIncome <= 45000) {
    estimatedTaxPayable = (estimatedTaxableIncome - 18200) * 0.16;
    marginalTaxRate = 16;
  } else if (estimatedTaxableIncome <= 135000) {
    estimatedTaxPayable = 4288 + (estimatedTaxableIncome - 45000) * 0.30;
    marginalTaxRate = 30;
  } else if (estimatedTaxableIncome <= 190000) {
    estimatedTaxPayable = 31288 + (estimatedTaxableIncome - 135000) * 0.37;
    marginalTaxRate = 37;
  } else {
    estimatedTaxPayable = 51638 + (estimatedTaxableIncome - 190000) * 0.45;
    marginalTaxRate = 45;
  }

  const effectiveTaxRate = estimatedTaxableIncome > 0
    ? (estimatedTaxPayable / estimatedTaxableIncome) * 100
    : 0;

  const estimatedRefundOrOwing = totalPaygWithheld - estimatedTaxPayable;

  return {
    estimatedTaxableIncome,
    estimatedTaxPayable: Math.round(estimatedTaxPayable),
    effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
    marginalTaxRate,
    totalDeductions,
    paygWithheld: totalPaygWithheld,
    estimatedRefundOrOwing: Math.round(estimatedRefundOrOwing),
  };
}

function buildEmergencyFundMetrics(
  liquidCash: number,
  monthlyExpenses: number
): EmergencyFundMetrics {
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

function buildHealthScore(
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlyLoanRepayments: number,
  totalDebt: number,
  monthsCovered: number,
  netWorth: number
): HealthScoreMetrics {
  // Savings rate (30% weight)
  const savingsRate = monthlyIncome > 0
    ? ((monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome) * 100
    : 0;
  const savingsRateScore = Math.min(Math.max(savingsRate * 5, 0), 100);

  // Emergency fund (30% weight)
  const emergencyFundScore = Math.min((monthsCovered / 6) * 100, 100);

  // Debt to income (25% weight)
  const debtToIncome = monthlyIncome > 0
    ? (totalDebt / (monthlyIncome * 12)) * 100
    : 0;
  const debtToIncomeScore = Math.max(100 - debtToIncome, 0);

  // Net worth growth approximation (15% weight)
  const netWorthScore = netWorth > 0 ? Math.min(50 + (netWorth / 10000), 100) : 25;

  // Weighted total
  const score = Math.round(
    savingsRateScore * 0.30 +
    emergencyFundScore * 0.30 +
    debtToIncomeScore * 0.25 +
    netWorthScore * 0.15
  );

  // Grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 35) grade = 'D';
  else grade = 'F';

  return {
    score,
    grade,
    components: {
      savingsRate: { score: savingsRateScore, value: savingsRate, weight: 30 },
      emergencyFund: { score: emergencyFundScore, value: monthsCovered, weight: 30 },
      debtToIncome: { score: debtToIncomeScore, value: debtToIncome, weight: 25 },
      netWorthGrowth: { score: netWorthScore, value: netWorth, weight: 15 },
    },
  };
}

// =============================================================================
// MAIN SERVICE FUNCTION
// =============================================================================

/**
 * Get a complete Master Financial Snapshot for a user.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL FINANCIAL CALCULATIONS.
 *
 * All API endpoints should use this function to ensure consistent data
 * across the entire application.
 *
 * @param userId - The user's ID
 * @returns Complete financial snapshot with all calculations
 */
export async function getMasterFinancialSnapshot(
  userId: string
): Promise<MasterFinancialSnapshot> {
  // Fetch all raw data
  const data = await fetchAllUserData(userId);

  // Build expense breakdowns
  const monthlyExpenses = buildExpenseBreakdown(data.expenses, 'monthly');
  const annualExpenses = buildExpenseBreakdown(data.expenses, 'annual');

  // Build income breakdowns
  const monthlyIncome = buildIncomeBreakdown(data.income, 'monthly');
  const annualIncome = buildIncomeBreakdown(data.income, 'annual');

  // Calculate net worth using existing calculator
  const netWorth = calculateNetWorth(
    data.properties.map(p => ({ currentValue: p.currentValue })),
    data.accounts.map(a => ({ currentBalance: a.currentBalance, type: a.type })),
    data.investmentHoldings.map(h => ({
      units: h.units,
      currentPrice: h.currentPrice || undefined,
      averagePrice: h.averagePrice,
    })),
    data.loans.map(l => ({
      principal: l.principal,
      type: l.type,
      propertyId: l.propertyId,
    })),
    data.superannuation.map(s => ({ balance: s.currentBalance })),
    data.assets.map(a => ({ currentValue: a.currentValue }))
  );

  // Calculate cashflow using existing orchestrator
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

  // Calculate debt metrics
  const loanInputs = data.loans.map(l => ({
    principal: l.principal,
    minRepayment: l.minRepayment || 0,
    repaymentFrequency: l.repaymentFrequency || 'MONTHLY',
    interestRateAnnual: l.interestRateAnnual,
    type: l.type,
    isInterestOnly: l.isInterestOnly,
    propertyId: l.propertyId,
  }));
  const debtSummary = aggregateLoanRepayments(loanInputs, 'monthly');
  const debtMetrics = calculateDebtMetrics(loanInputs, monthlyIncome.all.netTotal);

  // Build property metrics
  const propertyMetrics = buildPropertyMetrics(
    data.properties,
    data.loans,
    data.income,
    data.expenses
  );
  const propertyPortfolioValue = propertyMetrics.reduce((sum, p) => sum + p.currentValue, 0);
  const propertyPortfolioEquity = propertyMetrics.reduce((sum, p) => sum + p.equity, 0);

  // Build investment metrics
  const investmentMetrics = buildInvestmentMetrics(data.investmentHoldings);

  // Build tax summary
  const taxSummary = buildTaxSummary(data.income, data.expenses);

  // Calculate liquid cash using centralized LIQUID_ACCOUNT_TYPES (single source of truth)
  const liquidCash = data.accounts
    .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type as any))
    .reduce((sum, a) => sum + a.currentBalance, 0);

  // Build emergency fund metrics
  const emergencyFund = buildEmergencyFundMetrics(
    liquidCash,
    monthlyExpenses.all.total
  );

  // Build health score
  const healthScore = buildHealthScore(
    monthlyIncome.all.netTotal,
    monthlyExpenses.all.total,
    debtSummary.totalRepayments,
    debtSummary.totalPrincipal,
    emergencyFund.monthsCovered,
    netWorth.netWorth
  );

  return {
    userId,
    calculatedAt: new Date(),
    dataVersion: '1.0.0',

    counts: {
      expenses: data.expenses.length,
      income: data.income.length,
      accounts: data.accounts.length,
      loans: data.loans.length,
      properties: data.properties.length,
      investments: data.investmentHoldings.length,
    },

    netWorth,

    expenses: {
      monthly: monthlyExpenses,
      annual: annualExpenses,
    },

    income: {
      monthly: monthlyIncome,
      annual: annualIncome,
    },

    cashflow,

    debt: {
      summary: debtSummary,
      metrics: debtMetrics,
    },

    properties: propertyMetrics,
    propertyPortfolioValue,
    propertyPortfolioEquity,

    investments: investmentMetrics,

    tax: taxSummary,

    emergencyFund,

    healthScore,

    quickMetrics: {
      monthlyIncome: monthlyIncome.all.netTotal,
      monthlyExpenses: monthlyExpenses.all.total,
      monthlyCashflow: cashflow.monthlyCashflow,
      monthlyLoanRepayments: debtSummary.totalRepayments,
      totalAssets: netWorth.assets.total,
      totalLiabilities: netWorth.liabilities.total,
      netWorthValue: netWorth.netWorth,
      savingsRate: cashflow.savingsRate,
      liquidCash,
    },
  };
}

// =============================================================================
// CONVENIENCE GETTERS
// =============================================================================

/**
 * Get just net worth (lighter weight than full snapshot)
 */
export async function getNetWorth(userId: string): Promise<NetWorthResult> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.netWorth;
}

/**
 * Get monthly cashflow summary
 */
export async function getMonthlyCashflow(userId: string): Promise<CashflowResult> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.cashflow;
}

/**
 * Get quick metrics (most commonly used values)
 */
export async function getQuickMetrics(userId: string): Promise<MasterFinancialSnapshot['quickMetrics']> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.quickMetrics;
}

/**
 * Get health score
 */
export async function getHealthScore(userId: string): Promise<HealthScoreMetrics> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.healthScore;
}

/**
 * Get tax summary
 */
export async function getTaxSummary(userId: string): Promise<TaxSummary> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.tax;
}

/**
 * Get property portfolio metrics
 */
export async function getPropertyMetrics(userId: string): Promise<PropertyMetrics[]> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.properties;
}

/**
 * Get investment portfolio metrics
 */
export async function getInvestmentMetrics(userId: string): Promise<InvestmentMetrics> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  return snapshot.investments;
}
