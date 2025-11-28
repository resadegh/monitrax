/**
 * CASHFLOW OPTIMISATION ENGINE TYPE DEFINITIONS
 * Phase 14 - Cashflow Forecasting & Optimisation
 *
 * Core TypeScript interfaces for the Cashflow Forecasting Engine (CFE),
 * Cashflow Optimisation Engine (COE), and Stress Testing Model.
 */

// =============================================================================
// ENUMS (Mirror Prisma enums)
// =============================================================================

export type CashflowInsightCategory =
  | 'RECURRING'
  | 'ANOMALY'
  | 'INEFFICIENCY'
  | 'LIQUIDITY_RISK'
  | 'SUBSCRIPTION'
  | 'SAVINGS_OPPORTUNITY';

export type CashflowStrategyType =
  | 'OPTIMISE'
  | 'PREVENT_SHORTFALL'
  | 'MAXIMISE_OFFSET'
  | 'REDUCE_WASTE'
  | 'REBALANCE'
  | 'REPAYMENT_OPTIMISE'
  | 'SCHEDULE_OPTIMISE';

export type CashflowInsightSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ForecastPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type StressScenarioType =
  | 'INCOME_DROP'
  | 'EXPENSE_SHOCK'
  | 'INTEREST_RATE_RISE'
  | 'INFLATION'
  | 'CUSTOM';

export type TrendDirection = 'INCREASING' | 'STABLE' | 'DECREASING';

// =============================================================================
// FORECASTING ENGINE TYPES (Section 14.2.1)
// =============================================================================

/**
 * Input data for the Cashflow Forecasting Engine
 */
export interface CFEInput {
  userId: string;

  // Account balances
  accounts: AccountBalance[];

  // Transaction history (from TIE)
  transactions: TransactionRecord[];

  // Recurring payments (from TIE)
  recurringPayments: RecurringPaymentData[];

  // Income patterns
  incomeStreams: IncomeStream[];

  // Loan schedules
  loanSchedules: LoanSchedule[];

  // User-defined future expenses (optional)
  plannedExpenses?: PlannedExpense[];

  // Forecast configuration
  config: ForecastConfig;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  currentBalance: number;
  lastUpdated: Date;
  linkedLoanId?: string;
}

export interface TransactionRecord {
  id: string;
  accountId: string;
  date: Date;
  amount: number;
  direction: 'IN' | 'OUT';
  categoryLevel1?: string;
  categoryLevel2?: string;
  merchantStandardised?: string;
  isRecurring: boolean;
}

export interface RecurringPaymentData {
  id: string;
  merchantStandardised: string;
  accountId: string;
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  expectedAmount: number;
  nextExpected?: Date;
  lastOccurrence: Date;
  isActive: boolean;
  // Price tracking (optional - from TIE)
  priceIncreaseAlert?: boolean;
  lastPriceChange?: number;
  lastPriceChangeDate?: Date;
}

export interface IncomeStream {
  id: string;
  name: string;
  type: 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
  monthlyAmount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
  nextExpected?: Date;
  volatility: number; // 0-1, how variable this income is
}

export interface LoanSchedule {
  loanId: string;
  loanName: string;
  principal: number;
  interestRate: number;
  monthlyRepayment: number;
  repaymentDate: number; // Day of month
  isInterestOnly: boolean;
  offsetAccountId?: string;
  offsetBalance?: number;
}

export interface PlannedExpense {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category?: string;
}

export interface ForecastConfig {
  forecastDays: number; // Default: 90
  granularity: ForecastPeriod; // DAILY, WEEKLY, MONTHLY
  includeConfidenceBands: boolean;
  scenarioType?: StressScenarioType;
}

/**
 * Daily forecast point output from CFE
 */
export interface ForecastPoint {
  date: Date;
  predictedBalance: number;
  predictedIncome: number;
  predictedExpenses: number;
  predictedRecurring: number;
  predictedNonRecurring: number;
  confidenceScore: number;
  volatilityFactor: number;
  upperBound?: number;
  lowerBound?: number;
  shortfallRisk: boolean;
  shortfallAmount?: number;
}

/**
 * Account-level forecast
 */
export interface AccountForecast {
  accountId: string;
  accountName: string;
  accountType: string;
  forecasts: ForecastPoint[];
  averageBalance: number;
  minBalance: number;
  maxBalance: number;
  shortfallDays: Date[];
}

/**
 * Complete CFE output
 */
export interface CFEOutput {
  userId: string;
  generatedAt: Date;

  // Global forecast (all accounts combined)
  globalForecast: ForecastPoint[];

  // Per-account forecasts
  accountForecasts: AccountForecast[];

  // Shortfall analysis
  shortfallAnalysis: ShortfallAnalysis;

  // Recurring payments timeline
  recurringTimeline: RecurringTimelineEntry[];

  // Cashflow volatility index
  volatilityIndex: number;

  // Summary metrics
  summary: ForecastSummary;

  // Metadata
  metadata: {
    inputTransactionCount: number;
    recurringPaymentCount: number;
    forecastDays: number;
    calculationTimeMs: number;
  };
}

export interface ShortfallAnalysis {
  hasShortfall: boolean;
  shortfallDates: Date[];
  maxShortfallAmount: number;
  totalShortfallDays: number;
  firstShortfallDate?: Date;
  accountsAtRisk: string[];
}

export interface RecurringTimelineEntry {
  date: Date;
  merchantStandardised: string;
  expectedAmount: number;
  accountId: string;
  category?: string;
}

export interface ForecastSummary {
  // 30-day metrics
  avgDailyBalance30: number;
  totalIncome30: number;
  totalExpenses30: number;
  netCashflow30: number;

  // 90-day metrics
  avgDailyBalance90: number;
  totalIncome90: number;
  totalExpenses90: number;
  netCashflow90: number;

  // Burn rate
  monthlyBurnRate: number;
  threeMonthBurnRate: number;

  // Withdrawable cash
  withdrawableCash: number;
  withdrawableDate: Date;
}

// =============================================================================
// OPTIMISATION ENGINE TYPES (Section 14.2.2)
// =============================================================================

/**
 * Input for Cashflow Optimisation Engine
 */
export interface COEInput {
  userId: string;

  // CFE forecast output
  forecast: CFEOutput;

  // Transaction intelligence data
  spendingProfile: SpendingProfileData;

  // Recurring payments
  recurringPayments: RecurringPaymentData[];

  // Loan data
  loans: LoanData[];

  // Offset accounts
  offsetAccounts: OffsetAccountData[];
}

export interface SpendingProfileData {
  categoryAverages: Record<string, CategoryAverage>;
  monthlyPatterns?: Record<string, MonthlyPattern>;
  overallVolatility: number;
  predictedMonthlySpend?: number;
}

export interface CategoryAverage {
  avgMonthly: number;
  trend: TrendDirection;
  volatility: number;
}

export interface MonthlyPattern {
  totalSpend: number;
  categories: Record<string, number>;
}

export interface LoanData {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  monthlyRepayment: number;
  isInterestOnly: boolean;
  offsetAccountId?: string;
}

export interface OffsetAccountData {
  id: string;
  name: string;
  balance: number;
  linkedLoanId: string;
  effectiveSavingsRate: number; // Interest rate of linked loan
}

/**
 * COE detected inefficiency
 */
export interface SpendingInefficiency {
  id: string;
  category: CashflowInsightCategory;
  merchantOrCategory: string;
  description: string;
  currentSpend: number;
  benchmarkSpend?: number;
  potentialSavings: number;
  confidenceScore: number;
  evidence: InefficiencyEvidence;
}

export interface InefficiencyEvidence {
  transactionIds?: string[];
  averageMonthlySpend: number;
  trendDirection: TrendDirection;
  comparableBenchmark?: number;
  priceChangePercent?: number;
}

/**
 * Subscription analysis
 */
export interface SubscriptionAnalysis {
  merchantStandardised: string;
  currentAmount: number;
  previousAmount?: number;
  priceChangePercent?: number;
  hasPriceIncrease: boolean;
  firstSeen: Date;
  monthlyImpact: number;
  yearlyImpact: number;
  category: string;
}

/**
 * Payment schedule optimisation
 */
export interface PaymentScheduleOptimisation {
  description: string;
  currentSchedule: ScheduleEntry[];
  optimisedSchedule: ScheduleEntry[];
  benefitDescription: string;
  projectedBenefit: number;
}

export interface ScheduleEntry {
  date: Date;
  description: string;
  amount: number;
  accountId: string;
}

/**
 * Fund movement recommendation
 */
export interface FundMovementRecommendation {
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reason: string;
  projectedBenefit: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Loan repayment optimisation
 */
export interface RepaymentOptimisation {
  loanId: string;
  loanName: string;
  currentStrategy: string;
  recommendedStrategy: string;
  currentMonthlyPayment: number;
  recommendedMonthlyPayment: number;
  interestSavings: number;
  termReduction: number; // months
  rationale: string;
}

/**
 * Complete COE output
 */
export interface COEOutput {
  userId: string;
  generatedAt: Date;

  // Detected inefficiencies
  inefficiencies: SpendingInefficiency[];

  // Subscription analysis
  subscriptions: SubscriptionAnalysis[];
  subscriptionsWithPriceIncrease: SubscriptionAnalysis[];

  // Fund movement recommendations
  fundMovements: FundMovementRecommendation[];

  // Payment schedule optimisations
  scheduleOptimisations: PaymentScheduleOptimisation[];

  // Loan repayment optimisations
  repaymentOptimisations: RepaymentOptimisation[];

  // Break-even analysis
  breakEvenDay: number; // Day of month when income equals expenses

  // Generated strategies
  strategies: CashflowStrategy[];

  // Summary
  summary: COESummary;
}

export interface COESummary {
  totalPotentialSavings: number;
  inefficiencyCount: number;
  subscriptionCount: number;
  priceIncreaseCount: number;
  strategyCount: number;
  highPriorityActions: number;
}

// =============================================================================
// STRATEGY TYPES (Section 14.3.3)
// =============================================================================

/**
 * Cashflow strategy recommendation
 */
export interface CashflowStrategy {
  id: string;
  type: CashflowStrategyType;
  priority: number; // 1-100
  title: string;
  summary: string;
  detail?: string;
  confidence: number; // 0-1
  projectedBenefit: number;
  recommendedSteps: StrategyStep[];
  impactAnalysis?: StrategyImpact;
  affectedAccountIds: string[];
  affectedLoanIds: string[];
  affectedRecurringIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED';
  expiresAt?: Date;
}

export interface StrategyStep {
  order: number;
  action: string;
  description: string;
  optional: boolean;
}

export interface StrategyImpact {
  cashflowImpact: number; // Monthly impact
  riskReduction: number; // 0-1 scale
  timeToRealize: string; // e.g., "Immediate", "1 month", "3 months"
  liquidityEffect: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

// =============================================================================
// INSIGHT TYPES (Section 14.3.2)
// =============================================================================

/**
 * Cashflow insight
 */
export interface CashflowInsight {
  id: string;
  userId: string;
  severity: CashflowInsightSeverity;
  category: CashflowInsightCategory;
  title: string;
  description: string;
  recommendedAction: string;
  impactedAccountIds: string[];
  impactedCategories: string[];
  valueEstimate?: number;
  savingsPotential?: number;
  confidenceScore: number;
  linkedEntities?: LinkedEntities;
  isRead: boolean;
  isDismissed: boolean;
  isActioned: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface LinkedEntities {
  loans: string[];
  accounts: string[];
  recurring: string[];
}

// =============================================================================
// STRESS TESTING TYPES (Section 14.3)
// =============================================================================

/**
 * Stress test scenario configuration
 */
export interface StressScenario {
  id: string;
  name: string;
  type: StressScenarioType;
  description: string;
  parameters: StressParameters;
}

export interface StressParameters {
  // Income stress
  incomeDropPercent?: number; // 0-100
  incomeDropDuration?: number; // months

  // Expense stress
  expenseShockAmount?: number;
  expenseShockDate?: Date;
  expenseInflationPercent?: number;

  // Interest rate stress
  interestRateIncrease?: number; // basis points

  // Custom parameters
  customParameters?: Record<string, number>;
}

/**
 * Stress test result
 */
export interface StressTestResult {
  scenarioId: string;
  scenarioName: string;

  // Original vs stressed forecast
  originalForecast: ForecastPoint[];
  stressedForecast: ForecastPoint[];

  // Survival analysis
  survivalTime: number; // months before shortfall
  maxShortfallAmount: number;

  // Impact metrics
  balanceImpact: number;
  shortfallDaysAdded: number;

  // Mitigation recommendations
  mitigationStrategies: CashflowStrategy[];

  // Break-even analysis
  requiredSavings: number; // to survive scenario
  requiredIncomeIncrease: number;
}

/**
 * Complete stress test output
 */
export interface StressTestOutput {
  userId: string;
  generatedAt: Date;

  // Baseline (no stress)
  baselineResult: StressTestResult;

  // Scenario results
  scenarioResults: StressTestResult[];

  // Overall resilience score
  resilienceScore: number; // 0-100

  // Summary
  summary: StressTestSummary;
}

export interface StressTestSummary {
  mostVulnerableScenario: string;
  shortestSurvivalTime: number;
  averageSurvivalTime: number;
  recommendedEmergencyFund: number;
  criticalRisks: string[];
}

// =============================================================================
// DASHBOARD TYPES (Section 14.6)
// =============================================================================

/**
 * Cashflow dashboard data
 */
export interface CashflowDashboardData {
  userId: string;
  generatedAt: Date;

  // Forecast summary
  forecast: {
    dailyForecasts: ForecastPoint[];
    shortfallDays: Date[];
    volatilityIndex: number;
  };

  // Key metrics
  metrics: {
    currentBalance: number;
    predictedBalance30: number;
    predictedBalance90: number;
    monthlyBurnRate: number;
    withdrawableCash: number;
    surplusDeficit: number;
  };

  // Recurring payments
  upcomingRecurring: RecurringTimelineEntry[];

  // Strategies
  activeStrategies: CashflowStrategy[];

  // Insights
  insights: CashflowInsight[];

  // Category impact
  categoryImpact: CategoryImpactData[];
}

export interface CategoryImpactData {
  category: string;
  monthlySpend: number;
  percentOfTotal: number;
  trend: TrendDirection;
  impactScore: number; // 0-100, how much this affects cashflow
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface CashflowForecastResponse {
  success: boolean;
  data?: CFEOutput;
  error?: string;
}

export interface CashflowOptimisationResponse {
  success: boolean;
  data?: COEOutput;
  error?: string;
}

export interface StressTestResponse {
  success: boolean;
  data?: StressTestOutput;
  error?: string;
}

export interface CashflowDashboardResponse {
  success: boolean;
  data?: CashflowDashboardData;
  error?: string;
}

export interface CashflowInsightResponse {
  success: boolean;
  data?: CashflowInsight[];
  error?: string;
}

export interface CashflowStrategyResponse {
  success: boolean;
  data?: CashflowStrategy[];
  error?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert severity to priority score
 */
export function severityToPriority(severity: CashflowInsightSeverity): number {
  switch (severity) {
    case 'CRITICAL': return 100;
    case 'HIGH': return 75;
    case 'MEDIUM': return 50;
    case 'LOW': return 25;
  }
}

/**
 * Get severity from value estimate
 */
export function valueToSeverity(value: number): CashflowInsightSeverity {
  if (value >= 1000) return 'CRITICAL';
  if (value >= 500) return 'HIGH';
  if (value >= 100) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * Get next occurrence date based on pattern
 */
export function getNextOccurrence(
  lastDate: Date,
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
): Date {
  const next = new Date(lastDate);
  switch (pattern) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'FORTNIGHTLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'ANNUALLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
