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
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import type { DataAccessScope } from '@prisma/client';

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

// Phase 41e.−1 cleanup PR C — `buildTaxSummary()` now delegates to the
// canonical Phase 20 tax engine instead of reimplementing brackets
// inline. Resolves audit C-1 in
// `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §3 / §10.1.
import {
  calculateTaxPosition,
  type IncomeItem as TaxEngineIncomeItem,
  type ExpenseItem as TaxEngineExpenseItem,
} from '@/lib/tax-engine/position/taxPositionCalculator';

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

  // Phase 32B PR3 — viewer context (only present when fetched through the
  // professional drill-in path). Allows the UI to render scope badges and
  // hide tiles that the consent didn't grant. The actual data filtering
  // happens at the service layer below; this echo is for UX only.
  viewer?: {
    seatId: string;
    organizationClientId: string;
    accessScopes: DataAccessScope[];
    appliedScopeFilter: boolean;
  };
}

/**
 * Phase 32B PR3 — viewer context for the professional drill-in.
 *
 * When `getMasterFinancialSnapshot()` is called with a `viewerContext`, it:
 *   1. Validates the context is well-formed (seatId + clientUserId +
 *      accessScopes are all required and non-empty when present).
 *   2. Verifies the calling seat has an ACTIVE OrganizationClient row for
 *      `clientUserId` and that the requested viewer userId matches it.
 *   3. Filters the response payload at the SERVICE layer (not the UI) to
 *      exclude data the client did not consent to share — `LOANS` missing
 *      → no loan / debt data; `INVESTMENTS` missing → no investment metrics;
 *      etc. `FULL` bypasses the filter.
 *   4. Writes a `PRO_DASHBOARD_VIEW` audit log entry (top-level) AND a
 *      `ClientAccessLog` row (per-view detail). 3-layer consent model:
 *      docs/architecture/03_DATA_MODEL.md §9.2.
 *
 * The 3 layers are NEVER collapsed — CDR consent, professional consent, and
 * per-view access event all log independently. Per CLAUDE.md §0 architect
 * lens + Phase 32B hard constraints.
 */
export interface ViewerContext {
  /** OrganizationMember.id — which professional seat is performing the read */
  seatId: string;
  /** User.id of the client whose data is being read */
  clientUserId: string;
  /** Scopes the client granted to this organisation */
  accessScopes: DataAccessScope[];
  /** Optional request context for the audit row */
  ipAddress?: string;
  userAgent?: string;
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

/**
 * Linked transaction for actual calculation
 */
interface RawLinkedTransaction {
  id: string;
  date: Date;
  amount: number;
  direction: string;
  incomeId: string | null;
  expenseId: string | null;
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
  linkedTransactions: RawLinkedTransaction[];
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
    linkedTransactions,
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
    // Phase 30: Fetch linked transactions for actual calculation
    // Get transactions from last 12 months that are linked to income/expense entries
    prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(new Date().setMonth(new Date().getMonth() - 12)),
        },
        OR: [
          { incomeId: { not: null } },
          { expenseId: { not: null } },
        ],
      },
      select: {
        id: true,
        date: true,
        amount: true,
        direction: true,
        incomeId: true,
        expenseId: true,
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
    linkedTransactions,
  };
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

/**
 * Calculate actual amount from linked transactions for a specific month
 * Groups transactions by entry and month, returns monthly sum
 * @param entryId - Income or Expense entry ID
 * @param entryType - 'income' or 'expense'
 * @param transactions - All linked transactions
 * @param targetMonth - Month to calculate (0-11), defaults to current month
 * @param targetYear - Year to calculate, defaults to current year
 * @returns Monthly actual amount from transactions, or null if no transactions
 */
function calculateActualFromTransactions(
  entryId: string,
  entryType: 'income' | 'expense',
  transactions: RawLinkedTransaction[],
  targetMonth: number = new Date().getMonth(),
  targetYear: number = new Date().getFullYear()
): number | null {
  // Filter transactions for this entry and month
  const entryTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const isCorrectEntry = entryType === 'income'
      ? t.incomeId === entryId
      : t.expenseId === entryId;
    const isCorrectMonth = txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear;
    return isCorrectEntry && isCorrectMonth;
  });

  if (entryTransactions.length === 0) {
    return null; // No transactions for this month
  }

  // Sum transactions (use absolute amount, direction is already in the amount sign)
  return entryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

/**
 * Get monthly actuals for all entries (income or expense)
 * Returns a map of entryId -> monthly actual amount
 */
function getMonthlyActualsMap(
  entries: { id: string }[],
  entryType: 'income' | 'expense',
  transactions: RawLinkedTransaction[],
  targetMonth: number = new Date().getMonth(),
  targetYear: number = new Date().getFullYear()
): Map<string, number | null> {
  const actualsMap = new Map<string, number | null>();

  for (const entry of entries) {
    const actual = calculateActualFromTransactions(
      entry.id,
      entryType,
      transactions,
      targetMonth,
      targetYear
    );
    actualsMap.set(entry.id, actual);
  }

  return actualsMap;
}

function buildExpenseBreakdown(
  expenses: RawExpense[],
  targetFrequency: 'monthly' | 'annual',
  linkedTransactions: RawLinkedTransaction[] = []
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

  // Phase 30: Calculate budget variance with transaction-based actuals
  const budgetVariance = calculateExpenseBudgetVariance(expenses, targetFrequency, linkedTransactions);

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
 * Budget = entry.amount (what user expects)
 * Actual = sum of linked transactions for current month (if available), otherwise entry.amount
 */
function calculateExpenseBudgetVariance(
  expenses: RawExpense[],
  targetFrequency: 'monthly' | 'annual',
  linkedTransactions: RawLinkedTransaction[] = []
): BudgetVariance {
  let totalActual = 0;
  let totalBudgeted = 0;
  let entriesWithBudget = 0;
  let entriesReconciled = 0;

  // Get current month actuals from transactions
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const actualsMap = getMonthlyActualsMap(expenses, 'expense', linkedTransactions, currentMonth, currentYear);

  for (const expense of expenses) {
    const freq = expense.frequency as Frequency;

    // Budget = entry.amount (what user entered/expects)
    const budgetConverted = targetFrequency === 'monthly'
      ? toMonthly(expense.amount, freq)
      : toAnnual(expense.amount, freq);
    totalBudgeted += budgetConverted;
    entriesWithBudget++; // All entries have budget (their amount)

    // Actual = from transactions if available, otherwise use budget
    const transactionActual = actualsMap.get(expense.id);
    if (transactionActual !== null && transactionActual !== undefined) {
      // Has transactions - use transaction sum as actual
      const actualAmount = targetFrequency === 'monthly'
        ? transactionActual
        : transactionActual * 12; // Annualize current month
      totalActual += actualAmount;
      entriesReconciled++;
    } else {
      // No transactions - use budget as actual (no variance for this entry)
      totalActual += budgetConverted;
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
  targetFrequency: 'monthly' | 'annual',
  linkedTransactions: RawLinkedTransaction[] = []
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

  // Phase 30: Calculate budget variance with transaction-based actuals
  const budgetVariance = calculateIncomeBudgetVariance(income, targetFrequency, linkedTransactions);

  return { all, primary, secondary, passive, budgetVariance };
}

/**
 * Calculate budget variance for income
 * Budget = entry.amount (what user expects)
 * Actual = sum of linked transactions for current month (if available), otherwise entry.amount
 */
function calculateIncomeBudgetVariance(
  income: RawIncome[],
  targetFrequency: 'monthly' | 'annual',
  linkedTransactions: RawLinkedTransaction[] = []
): BudgetVariance {
  let totalActual = 0;
  let totalBudgeted = 0;
  let entriesWithBudget = 0;
  let entriesReconciled = 0;

  // Get current month actuals from transactions
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const actualsMap = getMonthlyActualsMap(income, 'income', linkedTransactions, currentMonth, currentYear);

  for (const inc of income) {
    const freq = inc.frequency as Frequency;

    // Budget = entry.amount (what user entered/expects)
    const budgetConverted = targetFrequency === 'monthly'
      ? toMonthly(inc.amount, freq)
      : toAnnual(inc.amount, freq);
    totalBudgeted += budgetConverted;
    entriesWithBudget++; // All entries have budget (their amount)

    // Actual = from transactions if available, otherwise use budget
    const transactionActual = actualsMap.get(inc.id);
    if (transactionActual !== null && transactionActual !== undefined) {
      // Has transactions - use transaction sum as actual
      const actualAmount = targetFrequency === 'monthly'
        ? transactionActual
        : transactionActual * 12; // Annualize current month
      totalActual += actualAmount;
      entriesReconciled++;
    } else {
      // No transactions - use budget as actual (no variance for this entry)
      totalActual += budgetConverted;
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

/**
 * Build the master snapshot's tax summary.
 *
 * **Phase 41e.−1 cleanup PR C — REPLACED inline brackets with engine delegation.**
 * Previously this function reimplemented FY24-25 tax brackets inline (the
 * "regression trap" identified as audit C-1 in
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md`). It now calls
 * `calculateTaxPosition()` from the canonical Phase 20 tax engine and
 * adapts the result back into the legacy `TaxSummary` shape.
 *
 * **Behaviour change vs the old inline math:** the tax engine includes
 * Medicare Levy + LITO/SAPTO offsets, which the old code did not. So
 * `estimatedTaxPayable` and `estimatedRefundOrOwing` will move slightly
 * for users who previously consumed this surface; the new numbers
 * agree with `/api/tax/position` for the same user. This is the
 * "intentional diff" outcome of the snapshot-test parity protocol
 * (audit doc §9.2). `marginalTaxRate` is still rendered as a
 * percentage (e.g. 30) for backward-compat with the consumer shape.
 *
 * Future work (Phase 41e.0+): swap consumers off `TaxSummary` onto
 * the richer `TaxPositionResult` shape; delete this adapter.
 */
function buildTaxSummary(
  income: RawIncome[],
  expenses: RawExpense[]
): TaxSummary {
  const taxIncomes: TaxEngineIncomeItem[] = income.map((inc) => ({
    id: inc.id,
    name: inc.name,
    type: inc.type,
    amount: inc.amount,
    frequency: inc.frequency,
    propertyId: inc.propertyId ?? undefined,
    investmentAccountId: inc.investmentAccountId ?? undefined,
    grossAmount:
      inc.type === 'SALARY' && inc.salaryType === 'NET' && inc.grossAmount
        ? inc.grossAmount
        : undefined,
    paygWithholding: inc.paygWithholding ?? undefined,
  }));

  const taxExpenses: TaxEngineExpenseItem[] = expenses.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category ?? 'OTHER',
    amount: e.amount,
    frequency: e.frequency,
    isTaxDeductible: e.isTaxDeductible,
    propertyId: e.propertyId ?? undefined,
    loanId: e.loanId ?? undefined,
  }));

  // Filter out non-taxable income to match the legacy filter behaviour.
  const taxableIncomes = taxIncomes.filter((_, i) => income[i].isTaxable);

  const result = calculateTaxPosition({
    incomes: taxableIncomes,
    expenses: taxExpenses,
    depreciations: [],
  });

  // `effectiveRate` returned by the engine is already in percentage
  // scale (0–100, rounded to 2dp). `marginalRate` is the raw bracket
  // rate (decimal, e.g. 0.30) — convert to percentage to match the
  // legacy consumer shape.
  const effectiveRate = result.tax.effectiveRate ?? 0;
  const marginalRatePercent = (result.tax.marginalRate ?? 0) * 100;

  return {
    estimatedTaxableIncome: Math.round(result.tax.taxableIncome),
    estimatedTaxPayable: Math.round(result.tax.netTax),
    effectiveTaxRate: Math.round(effectiveRate * 100) / 100,
    marginalTaxRate: Math.round(marginalRatePercent),
    totalDeductions: Math.round(result.deductions.total),
    paygWithheld: Math.round(result.paygWithheld),
    estimatedRefundOrOwing: Math.round(result.estimatedRefund),
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
/**
 * Validate a viewer context. Throws if malformed — the service refuses to
 * read another user's data on a partial / unverifiable context. This is the
 * "service rejects malformed contexts" guarantee from Phase 32B PR3.
 */
function assertValidViewerContext(viewerContext: ViewerContext, userId: string): void {
  if (!viewerContext.seatId || typeof viewerContext.seatId !== 'string') {
    throw new Error('viewerContext.seatId is required');
  }
  if (!viewerContext.clientUserId || typeof viewerContext.clientUserId !== 'string') {
    throw new Error('viewerContext.clientUserId is required');
  }
  if (!Array.isArray(viewerContext.accessScopes) || viewerContext.accessScopes.length === 0) {
    throw new Error('viewerContext.accessScopes must be a non-empty array');
  }
  if (viewerContext.clientUserId !== userId) {
    // Defensive: the userId arg and the viewerContext.clientUserId MUST refer
    // to the same person. Otherwise the caller is fetching X's data while
    // claiming consent for Y.
    throw new Error('viewerContext.clientUserId does not match userId');
  }
}

/**
 * Look up the OrganizationClient row that proves the seat has consent to
 * read this user's data. Returns the row id (used for ClientAccessLog FK)
 * and the canonical accessScopes from the DB — we DO NOT trust the
 * accessScopes array on the viewerContext alone.
 */
async function loadOrganizationClient(
  viewerContext: ViewerContext
): Promise<{ id: string; accessScopes: DataAccessScope[] } | null> {
  const member = await prisma.organizationMember.findUnique({
    where: { id: viewerContext.seatId },
    select: { organizationId: true, isActive: true },
  });
  if (!member || !member.isActive) return null;

  const client = await prisma.organizationClient.findFirst({
    where: {
      organizationId: member.organizationId,
      userId: viewerContext.clientUserId,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
    },
    select: { id: true, accessScopes: true },
  });
  return client;
}

/**
 * Apply scope filtering at the service layer (NOT the UI). Per the 3-layer
 * consent model + Phase 32B hard constraint: if the consent did not grant
 * `LOANS`, no loan data is allowed to leave the service in the response
 * payload, even if the UI accidentally tries to render it.
 *
 * `FULL` bypasses the filter. Otherwise each scope unlocks a corresponding
 * slice of the snapshot.
 */
function applyScopeFilter(
  snapshot: MasterFinancialSnapshot,
  scopes: DataAccessScope[]
): MasterFinancialSnapshot {
  if (scopes.includes('FULL')) return snapshot;

  const has = (s: DataAccessScope) => scopes.includes(s);
  const filtered: MasterFinancialSnapshot = { ...snapshot };

  const blankExpenseAggregation = (): ExpenseAggregation => ({
    total: 0,
    essential: 0,
    discretionary: 0,
    taxDeductible: 0,
    byCategory: {},
  });
  const blankIncomeAggregation = (): IncomeAggregation => ({
    grossTotal: 0,
    netTotal: 0,
    paygWithholding: 0,
    byType: {},
    taxableIncome: 0,
    nonTaxableIncome: 0,
  });
  const blankBudgetVariance = (): BudgetVariance => ({
    budgeted: 0,
    actual: 0,
    variance: 0,
    variancePercent: 0,
    status: 'on_track',
    entriesWithBudget: 0,
    entriesReconciled: 0,
  });

  // LOANS — debt summary, debt metrics, mortgage/personal-loan/credit-card slices
  if (!has('LOANS')) {
    filtered.debt = {
      summary: {
        totalPrincipal: 0,
        totalRepayments: 0,
        totalInterest: 0,
        weightedInterestRate: 0,
        byType: {},
      },
      metrics: {
        debtToIncomeRatio: 0,
        debtServiceRatio: 0,
        totalDebt: 0,
        monthlyRepayments: 0,
      },
    };
    filtered.netWorth = {
      ...filtered.netWorth,
      liabilities: { mortgages: 0, personalLoans: 0, creditCards: 0, total: 0 },
      netWorth: filtered.netWorth.assets.total,
    };
    filtered.quickMetrics = {
      ...filtered.quickMetrics,
      monthlyLoanRepayments: 0,
      totalLiabilities: 0,
      netWorthValue: filtered.netWorth.netWorth,
    };
  }

  // PROPERTIES — property metrics + portfolio aggregates
  if (!has('PROPERTIES')) {
    filtered.properties = [];
    filtered.propertyPortfolioValue = 0;
    filtered.propertyPortfolioEquity = 0;
    filtered.netWorth = {
      ...filtered.netWorth,
      assets: { ...filtered.netWorth.assets, properties: 0 },
      breakdown: { ...filtered.netWorth.breakdown, propertyEquity: 0 },
    };
  }

  // INVESTMENTS — investment metrics + investment slice of net worth
  if (!has('INVESTMENTS')) {
    filtered.investments = {
      totalValue: 0,
      totalCostBase: 0,
      unrealisedGain: 0,
      unrealisedGainPercent: 0,
      holdingsCount: 0,
      byType: {},
    };
    filtered.netWorth = {
      ...filtered.netWorth,
      assets: { ...filtered.netWorth.assets, investments: 0 },
      breakdown: { ...filtered.netWorth.breakdown, investmentAssets: 0 },
    };
  }

  // TAX — tax summary
  if (!has('TAX')) {
    filtered.tax = {
      estimatedTaxableIncome: 0,
      estimatedTaxPayable: 0,
      effectiveTaxRate: 0,
      marginalTaxRate: 0,
      totalDeductions: 0,
      paygWithheld: 0,
      estimatedRefundOrOwing: 0,
    };
  }

  // FINANCIAL — bank accounts + cashflow + emergency fund + income/expenses.
  // This is the strictest scope; without it the snapshot is shape-only.
  if (!has('FINANCIAL')) {
    const blankExpenseBreakdown = (): MasterExpenseBreakdown => ({
      all: blankExpenseAggregation(),
      recurring: blankExpenseAggregation(),
      nonRecurring: blankExpenseAggregation(),
      essential: blankExpenseAggregation(),
      discretionary: blankExpenseAggregation(),
      taxDeductible: blankExpenseAggregation(),
      byCategory: [],
      budgetVariance: blankBudgetVariance(),
    });
    const blankIncomeBreakdown = (): MasterIncomeBreakdown => ({
      all: blankIncomeAggregation(),
      primary: blankIncomeAggregation(),
      secondary: blankIncomeAggregation(),
      passive: blankIncomeAggregation(),
      budgetVariance: blankBudgetVariance(),
    });

    filtered.expenses = { monthly: blankExpenseBreakdown(), annual: blankExpenseBreakdown() };
    filtered.income = { monthly: blankIncomeBreakdown(), annual: blankIncomeBreakdown() };
    filtered.cashflow = {
      monthlyGrossIncome: 0,
      monthlyNetIncome: 0,
      monthlyIncome: 0,
      monthlyPaygWithholding: 0,
      monthlyExpenses: 0,
      monthlyLoanRepayments: 0,
      monthlyCashflow: 0,
      monthlySurplus: 0,
      annualGrossIncome: 0,
      annualNetIncome: 0,
      annualIncome: 0,
      annualPaygWithholding: 0,
      annualExpenses: 0,
      annualLoanRepayments: 0,
      annualCashflow: 0,
      annualSurplus: 0,
      savingsRate: 0,
      expenseRatio: 0,
      debtServiceRatio: 0,
      essentialExpenses: 0,
      discretionaryExpenses: 0,
      taxableIncome: 0,
      taxDeductibleExpenses: 0,
      incomeByType: {},
      expensesByCategory: {},
    };
    filtered.emergencyFund = {
      liquidCash: 0,
      monthlyExpenses: 0,
      monthsCovered: 0,
      targetMonths: 6,
      gap: 0,
      status: 'danger',
    };
    filtered.netWorth = {
      ...filtered.netWorth,
      assets: { ...filtered.netWorth.assets, accounts: 0 },
      breakdown: { ...filtered.netWorth.breakdown, liquidAssets: 0 },
    };
    filtered.quickMetrics = {
      ...filtered.quickMetrics,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      monthlyCashflow: 0,
      liquidCash: 0,
      savingsRate: 0,
    };
  }

  return filtered;
}

/**
 * Write the per-view audit trail for a professional drill-in. Two rows:
 *   1. AuditLog (PRO_DASHBOARD_VIEW) — discoverable from the user's audit
 *      trail; honours CDR sanitisation rules in `sanitizeCdrMetadata()`.
 *   2. ClientAccessLog (PRO_DASHBOARD_VIEW) — per-view detail tied to the
 *      OrganizationClient row, used by the org's compliance reports.
 *
 * Fire-and-forget (.catch swallowed) per CLAUDE.md §12.10 — audit logging
 * MUST NEVER block a response.
 */
function logProDashboardView(
  viewerContext: ViewerContext,
  organizationClientId: string,
  appliedScopes: DataAccessScope[]
): void {
  const sanitizedMeta = sanitizeCdrMetadata({
    seatId: viewerContext.seatId,
    organizationClientId,
    accessScopes: appliedScopes,
  });

  createAuditLog({
    userId: viewerContext.clientUserId,
    action: 'PRO_DASHBOARD_VIEW',
    status: 'SUCCESS',
    entityType: 'OrganizationClient',
    entityId: organizationClientId,
    ipAddress: viewerContext.ipAddress,
    userAgent: viewerContext.userAgent,
    metadata: sanitizedMeta,
  }).catch(() => {});

  prisma.clientAccessLog
    .create({
      data: {
        organizationClientId,
        accessedByMemberId: viewerContext.seatId,
        action: 'PRO_DASHBOARD_VIEW',
        resourceType: 'master_financial_snapshot',
        ipAddress: viewerContext.ipAddress,
        userAgent: viewerContext.userAgent,
      },
    })
    .catch(() => {});

  prisma.organizationClient
    .update({
      where: { id: organizationClientId },
      data: { lastAccessedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Get the canonical financial snapshot for a user.
 *
 * Phase 32B PR3 — when called with a `viewerContext`, the function additionally:
 *   - validates the context is well-formed (rejects malformed contexts)
 *   - verifies the seat has an ACTIVE+GRANTED OrganizationClient row
 *   - applies a scope filter at the SERVICE layer (not the UI)
 *   - writes the per-view audit (AuditLog + ClientAccessLog)
 *
 * The viewerContext path is OPTIONAL — calling without it preserves the
 * original consumer-facing behaviour byte-for-byte. Per CLAUDE.md §0
 * architect lens: ONE canonical engine, viewerContext is a parameter, NOT
 * a fork.
 */
export async function getMasterFinancialSnapshot(
  userId: string,
  viewerContext?: ViewerContext
): Promise<MasterFinancialSnapshot> {
  let organizationClientId: string | null = null;
  let appliedScopes: DataAccessScope[] | null = null;

  if (viewerContext) {
    assertValidViewerContext(viewerContext, userId);
    const orgClient = await loadOrganizationClient(viewerContext);
    if (!orgClient) {
      throw new Error(
        'Professional access denied: no ACTIVE+GRANTED OrganizationClient row for this seat + clientUserId'
      );
    }
    organizationClientId = orgClient.id;
    // Trust the DB-stored scopes, NOT what the caller asserted on the
    // viewerContext object. The viewerContext.accessScopes is informational —
    // the actual filter applies the canonical OrganizationClient.accessScopes.
    appliedScopes = orgClient.accessScopes;
  }

  return computeAndPossiblyFilter(userId, viewerContext, organizationClientId, appliedScopes);
}

async function computeAndPossiblyFilter(
  userId: string,
  viewerContext: ViewerContext | undefined,
  organizationClientId: string | null,
  appliedScopes: DataAccessScope[] | null
): Promise<MasterFinancialSnapshot> {
  const snapshot = await computeMasterFinancialSnapshot(userId);

  if (viewerContext && organizationClientId && appliedScopes) {
    const filtered = applyScopeFilter(snapshot, appliedScopes);
    filtered.viewer = {
      seatId: viewerContext.seatId,
      organizationClientId,
      accessScopes: appliedScopes,
      appliedScopeFilter: !appliedScopes.includes('FULL'),
    };
    logProDashboardView(viewerContext, organizationClientId, appliedScopes);
    return filtered;
  }

  return snapshot;
}

async function computeMasterFinancialSnapshot(
  userId: string
): Promise<MasterFinancialSnapshot> {
  // Fetch all raw data
  const data = await fetchAllUserData(userId);

  // Build expense breakdowns (with transaction-based actuals)
  const monthlyExpenses = buildExpenseBreakdown(data.expenses, 'monthly', data.linkedTransactions);
  const annualExpenses = buildExpenseBreakdown(data.expenses, 'annual', data.linkedTransactions);

  // Build income breakdowns (with transaction-based actuals)
  const monthlyIncome = buildIncomeBreakdown(data.income, 'monthly', data.linkedTransactions);
  const annualIncome = buildIncomeBreakdown(data.income, 'annual', data.linkedTransactions);

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
