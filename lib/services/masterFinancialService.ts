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
import { buildEntityBreakdown, type EntityPosition } from '@/lib/calculations/entityBreakdown';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import { Frequency, LIQUID_ACCOUNT_TYPES } from '@/lib/types/prisma-enums';
import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { isOrgLicenseSuspended } from '@/lib/portal/licenseGuard';
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

// Phase 1 (cashflow-actuals) — ACTUAL-transaction cashflow alongside the
// DECLARED-record cashflow above. See actualCashflow.ts header for the why
// (declared-only headlines silently drop uncategorised OUT transactions).
import {
  computeActualCashflow,
  type ActualCashflowTransaction,
} from '@/lib/calculations/actualCashflow';

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
  /** HOME | INVESTMENT | RENTAL — rentalYield is only meaningful for INVESTMENT (MON-033). */
  type: string;
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
/**
 * Phase 12 PR 3c.2e — Staleness metadata for derived metrics.
 *
 * Every metric in this snapshot that depends on `Account.currentBalance`
 * (net worth, liquid cash, emergency fund, cashflow forecast — almost
 * everything in `quickMetrics`) inherits the freshness of the underlying
 * balances. This block exposes the aggregate freshness signal so
 * consumer surfaces can render a `<ConfidenceIndicator>` tooltip when
 * the underlying balances are stale.
 *
 * The staleness rule is the SSOT from PR F (`isBalanceStale` in
 * `components/accounts/DataSourceChip.tsx`): a MANUAL account whose
 * `balanceLastUpdatedAt` is null OR ≥ `MANUAL_STALE_THRESHOLD_DAYS`
 * (14d) old. BASIQ / IMPORT / USER_VERIFIED accounts are never stale
 * by this definition because they're either live-fed or recently
 * re-affirmed.
 *
 * Per CLAUDE.md §12.2 SSOT — this block is derived from the same
 * accounts array the rest of the snapshot reads; never re-fetched.
 */
export interface StalenessMetadata {
  /** Number of accounts with a MANUAL balance that hasn't been refreshed in ≥14 days. */
  staleManualCount: number;
  /** Total MANUAL accounts (stale + fresh). */
  totalManualCount: number;
  /** Oldest `balanceLastUpdatedAt` age (in days) across MANUAL accounts; null if no MANUAL accounts. */
  oldestManualAgeDays: number | null;
  /**
   * `true` when at least 1 MANUAL account is stale. Derived metrics
   * should render a confidence indicator when this is `true`.
   */
  anyStale: boolean;
  /**
   * Human-readable summary, e.g. "3 manual balances last updated 47 days ago".
   * Null when nothing is stale. Surface this verbatim in tooltip copy.
   */
  summary: string | null;
}

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

  /**
   * Phase 47 Stage C1 — ADDITIVE per-entity breakdown (Entity Ownership
   * Fabric). Flat household fields above are untouched; this view
   * partitions the same rows by ownerEntityId via the canonical
   * engines. Additivity invariant pinned by
   * tests/ownership/entityBreakdown.test.ts.
   */
  byEntity: EntityPosition[];

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
  //
  // Phase 43 (Money Story) added the four `*` fields below. They are NOT a
  // new calc engine — every value is read from the already-computed
  // `cashflow`, `expenses`, and `liquidCash` blocks above. Exposing them on
  // quickMetrics is the SSOT contract: any surface that wants the 3-line
  // personal-P&L scoreboard reads from here, never re-derives.
  quickMetrics: {
    monthlyIncome: number;            // monthly NET income (after PAYG)
    monthlyGrossIncome: number;       // *Phase 43 — monthly GROSS income (pre-tax) for the "Earned" line
    monthlyExpenses: number;
    monthlyCashflow: number;
    monthlyLoanRepayments: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorthValue: number;
    savingsRate: number;
    liquidCash: number;
    keptAfterEssentials: number;      // *Phase 43 — monthlyNetIncome − essential-monthly-expenses ("Kept" line)
    keptMargin: number;               // *Phase 43 — keptAfterEssentials / monthlyGrossIncome × 100 (%, 0 when no income)
    freeCashDays: number;             // *Phase 43 — liquidCash ÷ daily expense burn ("Free today" expressed in days; 0 when expenses are 0)

    // ── Phase 1 (cashflow-actuals) — ACTUAL transaction-based cashflow ──────
    // The DECLARED fields above (monthlyExpenses/monthlyCashflow/savingsRate/
    // keptMargin) are computed from Expense/Income/Loan records × frequency and
    // silently DROP uncategorised/unlinked OUT transactions — making surplus,
    // margin, and runway falsely optimistic. The fields below are computed from
    // ALL non-transfer UnifiedTransaction rows (incl. the 'Uncategorised'
    // bucket) via `computeActualCashflow()`. Headline surfaces should read
    // these; declared fields remain for back-compat (the "plan" side of
    // plan-vs-actual). All zero + hasActualData=false when no txns in window.
    actualMonthlyOutflow: number;       // current calendar-month OUT (abs, ex-transfers)
    actualMonthlyInflow: number;        // current calendar-month IN (abs, ex-transfers)
    actualNetCashflow: number;          // actualMonthlyInflow − actualMonthlyOutflow (can be negative)
    actualAvgMonthlyOutflow: number;    // trailing-3-full-month avg OUT (for rate/runway tiles)
    actualOutflowByCategory: Record<string, number>; // current-month OUT by category, null → 'Uncategorised'
    hasActualData: boolean;             // true if any non-transfer txn in the trailing window
  };

  /**
   * Phase 12 PR 3c.2e — Confidence signal for derived metrics.
   * Always present (even when zero MANUAL accounts; `anyStale = false`,
   * `summary = null`). Consumer UI gates the confidence indicator on
   * `anyStale === true`.
   */
  staleness: StalenessMetadata;

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
  ownerEntityId: string;
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
  ownerEntityId: string;
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
  ownerEntityId: string;
  name: string;
  type: string;
  currentBalance: number;
  // Phase 12 PR 3c.2e — staleness inputs for derived-metric confidence.
  // The select clause in `gatherUserData` includes these; consumers
  // outside the staleness path can ignore them.
  balanceSource?: string | null;
  balanceLastUpdatedAt?: Date | null;
}

interface RawLoan {
  id: string;
  ownerEntityId: string;
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
  ownerEntityId: string;
  name: string;
  /** HOME | INVESTMENT | RENTAL — consumers gate investment-only metrics (MON-033). */
  type: string;
  address: string | null;
  currentValue: number;
  purchasePrice: number;
  purchaseDate: Date | null;
}

interface RawInvestmentHolding {
  id: string;
  /** Derived ownership (§4B D3) — via the owning account. */
  investmentAccount: { ownerEntityId: string };
  ticker: string;
  units: number;
  averagePrice: number;
  currentPrice: number | null;
  type: string;
}

interface RawSuperannuation {
  id: string;
  ownerEntityId: string | null;
  currentBalance: number;
  // Phase 39.5: SMSF accounts are excluded from the net-worth super sum
  // (their value flows through the SMSF entity's owned assets).
  fundType: 'INDUSTRY' | 'RETAIL' | 'SMSF';
}

interface RawAsset {
  id: string;
  ownerEntityId: string;
  currentValue: number;
  /** MON-013 — SOLD / WRITTEN_OFF assets must NOT count in net worth. */
  status: string;
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
  // MON-009: loan-linked rows so per-property loan repayments can be
  // resolved actuals-first from the reconciled transaction dates.
  loanId: string | null;
}

/**
 * Phase 1 (cashflow-actuals) — ALL transactions in the trailing window (linked
 * or not, categorised or not), used to compute ACTUAL outflow/inflow. This is
 * intentionally SEPARATE from `RawLinkedTransaction` (which stays scoped to
 * income/expense-linked rows for `budgetVariance`). `categoryLevel1` +
 * `isTransfer` are the two columns the declared path doesn't carry.
 */
interface RawActualTransaction {
  date: Date;
  amount: number;
  direction: string;
  categoryLevel1: string | null;
  isTransfer: boolean | null;
}

/**
 * MON-013 — an investment ACCOUNT's cash balance is a real asset not captured
 * by its holdings (`units × price`). Fetched so the canonical net-worth engine
 * counts it (previously omitted from master net worth / total assets).
 */
interface RawInvestmentAccount {
  id: string;
  ownerEntityId: string | null;
  cashBalance: number;
}

interface RawUserData {
  /** Phase 47 C1 — entity refs for the byEntity breakdown. */
  entities: Array<{ id: string; name: string; type: string }>;
  expenses: RawExpense[];
  income: RawIncome[];
  accounts: RawAccount[];
  loans: RawLoan[];
  properties: RawProperty[];
  investmentHoldings: RawInvestmentHolding[];
  /** MON-013 — investment-account cash (holdings-independent). */
  investmentAccounts: RawInvestmentAccount[];
  superannuation: RawSuperannuation[];
  assets: RawAsset[];
  linkedTransactions: RawLinkedTransaction[];
  /** Phase 1 (cashflow-actuals) — ALL non-transfer-aware txns, trailing window. */
  actualTransactions: RawActualTransaction[];
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
    entities,
    expenses,
    income,
    accounts,
    loans,
    properties,
    investmentHoldings,
    investmentAccounts,
    superannuation,
    assets,
    linkedTransactions,
    actualTransactions,
  ] = await Promise.all([
    // Phase 47 C1 — entity refs (id/name/type only) for the byEntity view.
    prisma.legalEntity.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    }),
    prisma.expense.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
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
        ownerEntityId: true,
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
        ownerEntityId: true,
        name: true,
        type: true,
        currentBalance: true,
        // Phase 12 PR 3c.2e (confidence indicators on derived metrics)
        // — every metric that reads from `currentBalance` (net worth,
        // liquid cash, emergency fund, cashflow forecast — almost
        // everything) inherits the freshness of these inputs. Exposed
        // as a `staleness` block on the snapshot output so consumer
        // surfaces (`<ConfidenceIndicator>`) can render a small
        // tooltip when underlying balances are stale.
        balanceSource: true,
        balanceLastUpdatedAt: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
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
        ownerEntityId: true,
        name: true,
        type: true,
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
        // Derived ownership (§4B D3): holdings inherit their account's entity.
        investmentAccount: { select: { ownerEntityId: true } },
        ticker: true,
        units: true,
        averagePrice: true,
        currentPrice: true,
        type: true,
      },
    }),
    // MON-013 — investment-account cash (holdings-independent asset).
    prisma.investmentAccount.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        cashBalance: true,
      },
    }),
    prisma.superannuationAccount.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        currentBalance: true,
        fundType: true,
      },
    }),
    prisma.asset.findMany({
      where: { userId },
      select: {
        id: true,
        ownerEntityId: true,
        currentValue: true,
        status: true,
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
          { loanId: { not: null } },
        ],
      },
      select: {
        id: true,
        date: true,
        amount: true,
        direction: true,
        incomeId: true,
        expenseId: true,
        loanId: true,
      },
    }),
    // Phase 1 (cashflow-actuals) — ALL transactions in the trailing ~4 months,
    // linked or not. Drives `computeActualCashflow()` so headline tiles reflect
    // what actually left the account (incl. uncategorised OUT). Separate from
    // the linked-only fetch above (which powers budgetVariance) — do NOT merge,
    // the two serve different SSOT concerns (§12.2). 4-month window = current
    // month + the 3 trailing full months the average needs.
    prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1),
        },
      },
      select: {
        date: true,
        amount: true,
        direction: true,
        categoryLevel1: true,
        isTransfer: true,
      },
    }),
  ]);

  return {
    entities,
    expenses,
    income,
    accounts,
    loans,
    properties,
    investmentHoldings,
    investmentAccounts,
    superannuation,
    assets,
    linkedTransactions,
    actualTransactions: actualTransactions.map((t) => ({
      date: t.date,
      // amount is a Prisma Decimal — normalise to number at the boundary.
      amount: Number(t.amount),
      direction: t.direction,
      categoryLevel1: t.categoryLevel1,
      isTransfer: t.isTransfer,
    })),
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

  // MON-023: essential + discretionary are ONGOING monthly slices, so they
  // exclude one-offs (same basis as `recurring`). This keeps essential +
  // discretionary == recurring total, so a one-off discretionary purchase can
  // never read as ">100% of expenses". One-offs live in `nonRecurring`.
  const essential = aggregateExpenses(
    expenses.filter(e => e.isEssential === true && e.isRecurring !== false).map(mapExpense),
    targetFrequency
  );

  const discretionary = aggregateExpenses(
    expenses.filter(e => e.isEssential !== true && e.isRecurring !== false).map(mapExpense),
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

/**
 * MON-009: dedup a property's rental income that reconciliation fragmented
 * across several Income records. Each property's rental rows are replaced by ONE
 * synthetic MONTHLY row carrying the resolved (actuals-first, stream-level) rent
 * — so aggregate income totals (and savings rate / health that read them) are
 * not inflated by the "4 monthly rows" bug. Non-rental and non-property income
 * passes through unchanged. Raw records are still used for budget variance.
 */
/**
 * Pool a property's rental income at the STREAM level so a rental fragmented
 * across several Income records (e.g. reconciliation split one lease into 4
 * "monthly" rows) is counted ONCE, at the true monthly rent resolved from the
 * actual transaction dates (declared fallback). Non-property-rental income
 * passes through unchanged.
 *
 * The ONE rental-dedup source: both the aggregate income breakdown AND the tax
 * summary read the array it returns, so the passive-rental total and the taxable-
 * rental basis converge by construction (§12.2.1). The pooling itself is the pure
 * canonical `computePropertyCashflow` — see tests/tax/rentalTaxDedup.test.ts.
 */
function adjustPropertyRentalIncome(
  properties: RawProperty[],
  income: RawIncome[],
  linkedTransactions: RawLinkedTransaction[]
): RawIncome[] {
  const RENT = new Set(['RENT', 'RENTAL']);
  const propertyIds = new Set(properties.map(p => p.id));
  const isPropertyRental = (i: RawIncome) => !!i.propertyId && propertyIds.has(i.propertyId) && RENT.has(i.type);
  const passthrough = income.filter(i => !isPropertyRental(i));

  const synthetic: RawIncome[] = [];
  for (const property of properties) {
    const rentalRows = income.filter(i => i.propertyId === property.id && RENT.has(i.type));
    if (rentalRows.length === 0) continue;
    const incomeIds = new Set(rentalRows.map(r => r.id));
    const rentalTx = linkedTransactions.filter(t => t.incomeId && incomeIds.has(t.incomeId));
    const cf = computePropertyCashflow({
      income: rentalRows.map(r => ({ id: r.id, type: r.type, amount: r.amount, frequency: r.frequency })),
      transactions: rentalTx.map(t => ({ incomeId: t.incomeId, expenseId: t.expenseId, loanId: t.loanId, date: t.date, amount: t.amount })),
    });
    synthetic.push({
      ...rentalRows[0],
      id: `synthetic-rent-${property.id}`,
      type: 'RENTAL',
      amount: cf.monthlyRent,
      frequency: 'MONTHLY',
      netAmount: null,
      grossAmount: null,
      paygWithholding: null,
      salaryType: null,
      budgetedAmount: null,
      lastReconciled: null,
    });
  }
  return [...passthrough, ...synthetic];
}

function buildIncomeBreakdown(
  income: RawIncome[],
  targetFrequency: 'monthly' | 'annual',
  linkedTransactions: RawLinkedTransaction[] = [],
  /** MON-009: source for the AGGREGATE totals (rental deduped). Budget variance
   *  still uses the raw `income` so per-record actual matching is preserved. */
  aggregateSource: RawIncome[] = income
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

  const all = aggregateIncome(aggregateSource.map(mapIncome), targetFrequency);

  const primaryTypes = ['SALARY', 'WAGES'];
  const primary = aggregateIncome(
    aggregateSource.filter(i => primaryTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  const secondary = aggregateIncome(
    aggregateSource.filter(i => !primaryTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  const passiveTypes = ['RENTAL', 'DIVIDEND', 'INTEREST', 'ROYALTY'];
  const passive = aggregateIncome(
    aggregateSource.filter(i => passiveTypes.includes(i.type)).map(mapIncome),
    targetFrequency
  );

  // Phase 30: Calculate budget variance with transaction-based actuals (raw records)
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
  expenses: RawExpense[],
  linkedTransactions: RawLinkedTransaction[] = []
): PropertyMetrics[] {
  return properties.map(property => {
    // Get loans for this property
    const propertyLoans = loans.filter(l => l.propertyId === property.id);
    const loanBalance = propertyLoans.reduce((sum, l) => sum + l.principal, 0);

    // Calculate equity and LVR
    const equity = calculateEquity(property.currentValue, loanBalance);
    const lvr = calculateLVR(loanBalance, property.currentValue);

    // MON-002 + MON-009: rent / expenses / loan repayment / cashflow come from
    // the ONE canonical per-property engine — actuals-first (resolved from the
    // reconciled transaction dates), rent pooled at the property-stream level so
    // a rental fragmented across several Income records is counted once, and the
    // loan cost never silently $0. This is the SAME engine the property page
    // reads (§19.4 same number everywhere).
    const propertyIncome = income.filter(i => i.propertyId === property.id);
    const propertyExpenses = expenses.filter(e => e.propertyId === property.id);
    const incomeIds = new Set(propertyIncome.map(i => i.id));
    const expenseIds = new Set(propertyExpenses.map(e => e.id));
    const loanIds = new Set(propertyLoans.map(l => l.id));
    const propertyTx = linkedTransactions.filter(
      t =>
        (t.incomeId && incomeIds.has(t.incomeId)) ||
        (t.expenseId && expenseIds.has(t.expenseId)) ||
        (t.loanId && loanIds.has(t.loanId)),
    );
    const cf = computePropertyCashflow({
      income: propertyIncome.map(i => ({ id: i.id, type: i.type, amount: i.amount, frequency: i.frequency })),
      expenses: propertyExpenses.map(e => ({ id: e.id, amount: e.amount, frequency: e.frequency, isRecurring: e.isRecurring })),
      loans: propertyLoans.map(l => ({
        id: l.id,
        principal: l.principal,
        interestRateAnnual: l.interestRateAnnual,
        minRepayment: l.minRepayment,
        repaymentFrequency: l.repaymentFrequency,
      })),
      transactions: propertyTx.map(t => ({
        incomeId: t.incomeId,
        expenseId: t.expenseId,
        loanId: t.loanId,
        date: t.date,
        amount: t.amount,
      })),
    });
    const annualRentalIncome = cf.annualRent;
    const rentalYield = calculateRentalYield(annualRentalIncome, property.currentValue);
    const monthlyExpenses = cf.monthlyExpenses;
    const monthlyLoanRepayments = cf.monthlyLoanRepayment;
    const monthlyCashflow = cf.monthlyCashflow;

    // Capital growth
    const capitalGrowth = property.currentValue - property.purchasePrice;
    const capitalGrowthPercent = property.purchasePrice > 0
      ? (capitalGrowth / property.purchasePrice) * 100
      : 0;

    return {
      id: property.id,
      name: property.name,
      type: property.type,
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
    isRecurring: e.isRecurring, // MON-037: count one-offs once, not ×frequency
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
  // scale (0–100, rounded to 2dp). `marginalRate` is also percentage
  // scale (0–100) — see `incomeTaxCalculator.ts:112` which multiplies
  // by 100 before returning. The legacy `TaxSummary.marginalTaxRate`
  // consumer also expects percentage (e.g. 30, not 0.30), so pass
  // through unchanged.
  const effectiveRate = result.tax.effectiveRate ?? 0;
  const marginalRatePercent = result.tax.marginalRate ?? 0;

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

  // A suspended org loses client-data access (2026-06-12 — see
  // lib/portal/licenseGuard.ts for the suspension-semantics rationale).
  if (await isOrgLicenseSuspended(member.organizationId)) return null;

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
      monthlyGrossIncome: 0,
      monthlyExpenses: 0,
      monthlyCashflow: 0,
      liquidCash: 0,
      savingsRate: 0,
      keptAfterEssentials: 0,
      keptMargin: 0,
      freeCashDays: 0,
      // Phase 1 (cashflow-actuals) — actuals are transaction/account-derived;
      // zero them when the ACCOUNTS scope is not granted to this viewer.
      actualMonthlyOutflow: 0,
      actualMonthlyInflow: 0,
      actualNetCashflow: 0,
      actualAvgMonthlyOutflow: 0,
      actualOutflowByCategory: {},
      hasActualData: false,
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

  // MON-009 + MON-010: dedup property rental fragmented across Income records so
  // BOTH the aggregate income totals (savings rate / health) AND the tax summary
  // (taxable rental) count a fragmented rental ONCE, at the true monthly rent. The
  // one deduped array feeds buildIncomeBreakdown AND buildTaxSummary, so the
  // passive-rental total and the taxable-rental basis converge by construction
  // (§12.2.1). No new tax math — buildTaxSummary still delegates to the reform-aware
  // calculateTaxPosition (§12.14); this only changes WHICH income rows it sums.
  const adjustedIncome = adjustPropertyRentalIncome(data.properties, data.income, data.linkedTransactions);

  // Build expense breakdowns (with transaction-based actuals)
  const monthlyExpenses = buildExpenseBreakdown(data.expenses, 'monthly', data.linkedTransactions);
  const annualExpenses = buildExpenseBreakdown(data.expenses, 'annual', data.linkedTransactions);

  // Build income breakdowns (raw records for budget variance, deduped rental for totals)
  const monthlyIncome = buildIncomeBreakdown(data.income, 'monthly', data.linkedTransactions, adjustedIncome);
  const annualIncome = buildIncomeBreakdown(data.income, 'annual', data.linkedTransactions, adjustedIncome);

  // MON-013 — exclude SOLD / WRITTEN_OFF personal assets from net worth (the
  // portfolio/snapshot route already did; master previously counted them).
  const activePersonalAssets = data.assets.filter(a => a.status === 'ACTIVE');

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
    data.superannuation.map(s => ({ balance: s.currentBalance, fundType: s.fundType })),
    activePersonalAssets.map(a => ({ currentValue: a.currentValue })),
    // MON-013 — investment-account cash now counted in net worth / total assets.
    data.investmentAccounts.map(a => ({ cashBalance: a.cashBalance, ownerEntityId: a.ownerEntityId }))
  );

  // Phase 47 C1 — additive per-entity breakdown (same rows, same
  // canonical engines, partitioned by ownerEntityId).
  const byEntity = buildEntityBreakdown({
    entities: data.entities,
    properties: data.properties,
    accounts: data.accounts,
    investmentHoldings: data.investmentHoldings,
    investmentAccounts: data.investmentAccounts,
    loans: data.loans,
    superannuation: data.superannuation,
    assets: activePersonalAssets,
    income: adjustedIncome,
    expenses: data.expenses,
  });

  // Calculate cashflow using existing orchestrator
  const cashflowInput = {
    income: adjustedIncome.map(i => ({
      amount: i.amount,
      frequency: i.frequency,
      type: i.type,
      salaryType: i.salaryType,
      netAmount: i.netAmount,
    })),
    // MON-011: savings rate reflects ongoing recurring spend — one-off
    // purchases don't count against the monthly surplus (they show as actual
    // spend in the month they happened).
    expenses: data.expenses
      .filter(e => e.isRecurring !== false)
      .map(e => ({
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
    data.expenses,
    data.linkedTransactions
  );
  const propertyPortfolioValue = propertyMetrics.reduce((sum, p) => sum + p.currentValue, 0);
  const propertyPortfolioEquity = propertyMetrics.reduce((sum, p) => sum + p.equity, 0);

  // Build investment metrics
  const investmentMetrics = buildInvestmentMetrics(data.investmentHoldings);

  // Build tax summary — MON-010: read the rental-deduped income (adjustedIncome),
  // NOT raw data.income, so a rental fragmented across several records is counted
  // ONCE in taxable rental (same source the income breakdown uses → they converge).
  const taxSummary = buildTaxSummary(adjustedIncome, data.expenses);

  // Calculate liquid cash using centralized LIQUID_ACCOUNT_TYPES (single source of truth)
  const liquidCash = data.accounts
    .filter(a => LIQUID_ACCOUNT_TYPES.includes(a.type as any))
    .reduce((sum, a) => sum + a.currentBalance, 0);

  // Phase 1 (cashflow-actuals) — ACTUAL transaction-based cashflow. Canonical
  // engine; route handlers must read these off quickMetrics, never re-reduce.
  const actualCashflow = computeActualCashflow(
    data.actualTransactions as ActualCashflowTransaction[]
  );

  // Phase 12 PR 3c.2e — derive the staleness metadata from the same
  // accounts array. SSOT: the rule lives in
  // `components/accounts/DataSourceChip.tsx` (`isBalanceStale` +
  // `MANUAL_STALE_THRESHOLD_DAYS = 14`) — kept in lockstep here.
  // Service-side replication is intentional: this file must not import
  // from `components/*` (would bundle React into the service layer).
  const STALENESS_THRESHOLD_DAYS = 14;
  const NOW = Date.now();
  const DAY_MS = 86_400_000;
  const manualAccounts = data.accounts.filter((a) => a.balanceSource === 'MANUAL');
  let staleManualCount = 0;
  let oldestStaleAgeDays: number | null = null;
  for (const a of manualAccounts) {
    let ageDays: number;
    if (!a.balanceLastUpdatedAt) {
      // No timestamp at all → treat as stale by definition (same as `isBalanceStale`).
      ageDays = Number.POSITIVE_INFINITY;
    } else {
      ageDays = Math.floor((NOW - new Date(a.balanceLastUpdatedAt).getTime()) / DAY_MS);
    }
    if (ageDays >= STALENESS_THRESHOLD_DAYS) {
      staleManualCount++;
      if (oldestStaleAgeDays === null || ageDays > oldestStaleAgeDays) {
        oldestStaleAgeDays = Number.isFinite(ageDays) ? ageDays : null;
      }
    }
  }
  const anyStale = staleManualCount > 0;
  const staleness: StalenessMetadata = {
    staleManualCount,
    totalManualCount: manualAccounts.length,
    oldestManualAgeDays: oldestStaleAgeDays,
    anyStale,
    summary: !anyStale
      ? null
      : oldestStaleAgeDays === null
        ? `${staleManualCount} manual ${staleManualCount === 1 ? 'balance has' : 'balances have'} no last-updated date.`
        : `${staleManualCount} manual ${staleManualCount === 1 ? 'balance' : 'balances'} last updated ${oldestStaleAgeDays === 1 ? '1 day' : `${oldestStaleAgeDays} days`} ago.`,
  };

  // Build emergency fund metrics.
  // P0 fix (2026-06-23, audit domain B): months-of-cover must reflect REAL
  // burn. Previously used `monthlyExpenses.all.total` (DECLARED expenses,
  // excludes loans) → overstated runway when actual spend > declared. Use the
  // trailing actual avg outflow (all OUT txns incl. loans + uncategorised) when
  // transactions exist; fall back to declared only when there are none.
  const emergencyFundMonthlyOutflow = actualCashflow.hasActualData
    ? actualCashflow.avgMonthlyOutflow
    : monthlyExpenses.recurring.total; // MON-011: one-offs aren't an ongoing burn
  const emergencyFund = buildEmergencyFundMetrics(
    liquidCash,
    emergencyFundMonthlyOutflow
  );

  // Build health score
  const healthScore = buildHealthScore(
    monthlyIncome.all.netTotal,
    monthlyExpenses.recurring.total, // MON-011: recurring monthly spend only
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
    byEntity,

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
      monthlyGrossIncome: cashflow.monthlyGrossIncome,
      // MON-011: "monthly expenses" = ongoing recurring spend; one-off purchases
      // (a battery, an ATO tax payment) are $0/mo here and show as actual spend
      // in the month they occurred (the actuals/activity view).
      monthlyExpenses: monthlyExpenses.recurring.total,
      monthlyCashflow: cashflow.monthlyCashflow,
      monthlyLoanRepayments: debtSummary.totalRepayments,
      totalAssets: netWorth.assets.total,
      totalLiabilities: netWorth.liabilities.total,
      netWorthValue: netWorth.netWorth,
      savingsRate: cashflow.savingsRate,
      liquidCash,
      // Phase 43 — Money Story. All three values derived from numbers already
      // computed above. No new engine, no duplicate aggregation.
      keptAfterEssentials:
        monthlyIncome.all.netTotal - monthlyExpenses.essential.total,
      keptMargin:
        cashflow.monthlyGrossIncome > 0
          ? ((monthlyIncome.all.netTotal - monthlyExpenses.essential.total) /
              cashflow.monthlyGrossIncome) *
            100
          : 0,
      freeCashDays:
        monthlyExpenses.recurring.total > 0
          ? liquidCash / (monthlyExpenses.recurring.total / 30)
          : 0,

      // Phase 1 (cashflow-actuals) — ACTUAL transaction-based fields. Read
      // straight off the canonical `computeActualCashflow()` result; no
      // arithmetic here.
      actualMonthlyOutflow: actualCashflow.currentMonthOutflow,
      actualMonthlyInflow: actualCashflow.currentMonthInflow,
      actualNetCashflow: actualCashflow.currentMonthNet,
      actualAvgMonthlyOutflow: actualCashflow.avgMonthlyOutflow,
      actualOutflowByCategory: actualCashflow.outflowByCategory,
      hasActualData: actualCashflow.hasActualData,
    },

    // Phase 12 PR 3c.2e — confidence signal for every derived metric
    // above that reads from `Account.currentBalance`. UI surfaces gate
    // `<ConfidenceIndicator>` rendering on `staleness.anyStale`.
    staleness,
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
