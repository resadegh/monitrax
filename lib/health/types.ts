/**
 * FINANCIAL HEALTH ENGINE TYPE DEFINITIONS
 * Phase 12 - Financial Health Engine
 *
 * Core TypeScript interfaces and types for the Financial Health Engine.
 * Provides holistic financial assessment with a unified score (0-100).
 */

// =============================================================================
// ENUMS
// =============================================================================

export type RiskBand = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type HealthCategoryName =
  | 'LIQUIDITY'
  | 'CASHFLOW'
  | 'DEBT'
  | 'INVESTMENTS'
  | 'PROPERTY'
  | 'RISK_EXPOSURE'
  | 'LONG_TERM_OUTLOOK';

export type RiskSignalCategory =
  | 'SPENDING'
  | 'BORROWING'
  | 'LIQUIDITY'
  | 'CONCENTRATION'
  | 'MARKET'
  | 'LONGEVITY';

export type ImprovementDifficulty = 'EASY' | 'MODERATE' | 'HARD';

// =============================================================================
// METRIC TYPES (Layer 1)
// =============================================================================

/**
 * Base metric interface - all metrics follow this structure.
 */
export interface BaseMetric {
  value: number;
  benchmark: number;
  riskBand: RiskBand;
  confidence: number; // 0-100
}

/**
 * Liquidity metrics (Section 5.1.1)
 */
export interface LiquidityMetrics {
  emergencyBuffer: BaseMetric;        // Months of expenses in liquid assets
  savingsRate: BaseMetric;            // Percentage of income saved
  liquidNetWorthRatio: BaseMetric;    // Percentage of net worth in liquid assets
  shortTermDebtRatio: BaseMetric;     // Short-term debt / income
}

/**
 * Cashflow metrics (Section 5.1.2)
 */
export interface CashflowMetrics {
  surplus: BaseMetric;                // Monthly surplus/deficit
  volatility: BaseMetric;             // Cashflow volatility score
  fixedCostRatio: BaseMetric;         // Fixed costs as % of income
  discretionarySensitivity: BaseMetric; // Impact if discretionary cut
}

/**
 * Debt metrics (Section 5.1.3)
 */
export interface DebtMetrics {
  lvr: BaseMetric;                    // Loan-to-value ratio
  dti: BaseMetric;                    // Debt-to-income ratio
  repaymentLoad: BaseMetric;          // Repayments as % of income
  interestRiskExposure: BaseMetric;   // Exposure to rate changes
  interestOnlyRisk: BaseMetric;       // IO loan risk score
}

/**
 * Investment metrics (Section 5.1.4)
 */
export interface InvestmentMetrics {
  diversificationIndex: BaseMetric;   // Portfolio diversification score
  assetClassConcentration: BaseMetric; // Single asset class concentration
  performanceVsBenchmark: BaseMetric; // Returns vs benchmark
  costEfficiency: BaseMetric;         // Fee drag analysis
  riskAdjustedReturn: BaseMetric;     // Sharpe-like ratio
}

/**
 * Property metrics (Section 5.1.5)
 */
export interface PropertyMetrics {
  valuationHealth: BaseMetric;        // Portfolio valuation score
  lvrStability: BaseMetric;           // LVR trend stability
  rentalYieldPerformance: BaseMetric; // Yield vs market
  vacancyRiskAnalysis: BaseMetric;    // Vacancy risk score
}

/**
 * Risk metrics (Section 5.1.6)
 */
export interface RiskMetrics {
  insuranceGaps: BaseMetric;          // Coverage gap score
  buffering: BaseMetric;              // Financial buffer adequacy
  emergencyRunway: BaseMetric;        // Months of runway
  volatilityExposure: BaseMetric;     // Portfolio volatility
}

/**
 * Forecast metrics (Section 5.1.7)
 */
export interface ForecastMetrics {
  netWorth5Year: BaseMetric;          // 5-year net worth projection
  netWorth10Year: BaseMetric;         // 10-year net worth projection
  netWorth20Year: BaseMetric;         // 20-year net worth projection
  retirementRunway: BaseMetric;       // Years until retirement target
  sustainableWithdrawalRate: BaseMetric; // Safe withdrawal rate
}

/**
 * All metrics aggregated (Layer 1 output)
 */
export interface AggregatedMetrics {
  liquidity: LiquidityMetrics;
  cashflow: CashflowMetrics;
  debt: DebtMetrics;
  investments: InvestmentMetrics;
  property: PropertyMetrics;
  risk: RiskMetrics;
  forecast: ForecastMetrics;
}

// =============================================================================
// CATEGORY SCORING TYPES (Layer 2)
// =============================================================================

/**
 * Category weights as defined in blueprint Section 5.2
 */
export const CATEGORY_WEIGHTS: Record<HealthCategoryName, number> = {
  LIQUIDITY: 0.20,
  CASHFLOW: 0.20,
  DEBT: 0.15,
  INVESTMENTS: 0.15,
  PROPERTY: 0.10,
  RISK_EXPOSURE: 0.10,
  LONG_TERM_OUTLOOK: 0.10,
};

/**
 * Health category result (Section 9.2)
 */
export interface HealthCategory {
  name: HealthCategoryName;
  score: number;                       // 0-100
  weight: number;                      // Category weight (e.g., 0.20)
  contributingMetrics: ContributingMetric[];
  riskBand: RiskBand;
}

export interface ContributingMetric {
  name: string;
  value: number;
  weight: number;
  score: number;
  benchmark: number;
}

// =============================================================================
// RISK SIGNAL TYPES (Section 6)
// =============================================================================

/**
 * Risk signal (Section 9.3)
 */
export interface RiskSignal {
  id: string;
  category: RiskSignalCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  evidence: RiskEvidence;
  tier: number;                        // Risk tier (1-5)
}

export interface RiskEvidence {
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  dataPoints?: number[];
}

// =============================================================================
// IMPROVEMENT ACTION TYPES (Section 4.4)
// =============================================================================

/**
 * Improvement action (Section 9.4)
 */
export interface ImprovementAction {
  id: string;
  title: string;
  description: string;
  impact: ImpactEstimate;
  category: HealthCategoryName;
  difficulty: ImprovementDifficulty;
  sbsLink?: string;                    // Link to strategy recommendation
  alternativeOptions?: string[];
  priority: number;                    // 1 = highest
}

export interface ImpactEstimate {
  scoreImprovement: number;            // Expected score improvement
  financialImpact: number;             // Dollar impact
  timeframe: string;                   // e.g., "3 months"
}

// =============================================================================
// EVIDENCE PACK TYPES (Section 4.5)
// =============================================================================

/**
 * Evidence pack for transparency
 */
export interface EvidencePack {
  inputsUsed: InputSource[];
  confidenceLevel: number;             // 0-100
  insightsLinked: string[];            // Insight IDs
  historicalTrend: TrendPoint[];
  riskMap: RiskMapEntry[];
  lastUpdated: Date;
}

export interface InputSource {
  type: 'SNAPSHOT' | 'INSIGHT' | 'STRATEGY' | 'GRDCS' | 'USER_GOAL';
  entityId?: string;
  value: any;
  timestamp: Date;
}

export interface TrendPoint {
  date: Date;
  score: number;
}

export interface RiskMapEntry {
  category: RiskSignalCategory;
  level: RiskSeverity;
  factors: string[];
}

// =============================================================================
// MAIN OUTPUT TYPES (Section 4 & 9.1)
// =============================================================================

/**
 * Financial Health Score (Section 9.1)
 * Main output of the Financial Health Engine
 */
export interface FinancialHealthScore {
  score: number;                       // 0-100
  confidence: number;                  // 0-100
  breakdown: HealthCategory[];
  trend: ScoreTrend;
  timestamp: Date;
}

export interface ScoreTrend {
  direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
  changePercent: number;
  periodMonths: number;
  history: TrendPoint[];
}

/**
 * Complete Financial Health Report
 * Full output of the engine
 */
export interface FinancialHealthReport {
  // Core score
  healthScore: FinancialHealthScore;

  // Category breakdown
  categories: HealthCategory[];

  // Risk signals
  riskSignals: RiskSignal[];

  // Improvement actions
  improvementActions: ImprovementAction[];

  // Evidence & explainability
  evidence: EvidencePack;

  // Raw metrics (for debugging/explainability)
  metrics: AggregatedMetrics;

  // Modifiers applied
  modifiers: ScoreModifiers;

  // Metadata
  generatedAt: Date;
  userId: string;
}

/**
 * Score modifiers (Section 5.3)
 */
export interface ScoreModifiers {
  dataConfidence: number;              // Penalty for low data quality
  insightSeverity: number;             // Penalty for critical insights
  longTermProjectionRisk: number;      // Penalty for uncertain projections
  linkageIssuesPenalty: number;        // Penalty for GRDCS issues
  strategyConflictsPenalty: number;    // Penalty for unresolved conflicts
  totalPenalty: number;                // Sum of penalties
}

// =============================================================================
// FORECAST-INTEGRATED HEALTH (Section 7)
// =============================================================================

export type ForecastPeriod = 'PRESENT' | '1_YEAR' | '5_YEAR' | '10_YEAR' | '20_YEAR';

/**
 * Forecasted health score
 */
export interface ForecastedHealthScore {
  period: ForecastPeriod;
  score: number;
  confidence: number;
  assumptions: ForecastAssumptions;
}

export interface ForecastAssumptions {
  incomeGrowthRate: number;
  expenseInflation: number;
  investmentReturn: number;
  propertyGrowthRate: number;
}

/**
 * Health trajectory for charting
 */
export interface HealthTrajectory {
  current: FinancialHealthScore;
  projections: ForecastedHealthScore[];
  worstCase: ForecastedHealthScore[];
  bestCase: ForecastedHealthScore[];
  retirementRunway: number;            // Years
  goalAchievementProbability: number;  // 0-1
}

// =============================================================================
// INPUT TYPES (for the engine)
// =============================================================================

/**
 * Input data structure for the Financial Health Engine
 */
export interface FinancialHealthInput {
  userId: string;

  // From Portfolio Snapshot
  portfolioSnapshot: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    properties: PropertyData[];
    loans: LoanData[];
    accounts: AccountData[];
    investments: InvestmentData[];
    income: IncomeData[];
    expenses: ExpenseData[];
  };

  // From Insights Engine
  insights: InsightData[];

  // From Strategy Engine (Phase 11)
  strategyData?: {
    recommendations: any[];
    conflicts: any[];
    sbsScores: number[];
  };

  // From GRDCS / Linkage Health
  linkageHealth?: {
    orphans: string[];
    missingLinks: string[];
    consistencyScore: number;
  };

  // User goals
  userGoals?: {
    retirementTarget: number;
    savingsGoal: number;
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    investmentStyle: 'PASSIVE' | 'BALANCED' | 'ACTIVE';
  };
}

export interface PropertyData {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  currentValue: number;
  purchasePrice: number;
  debt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

export interface LoanData {
  id: string;
  name: string;
  type: 'HOME' | 'INVESTMENT';
  principal: number;
  interestRate: number;
  isInterestOnly: boolean;
  monthlyRepayment: number;
  propertyId?: string;
}

export interface AccountData {
  id: string;
  name: string;
  type: 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
  balance: number;
}

export interface InvestmentData {
  id: string;
  ticker: string;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  value: number;
  costBase: number;
}

export interface IncomeData {
  id: string;
  name: string;
  type: string;
  monthlyAmount: number;
  isTaxable: boolean;
}

export interface ExpenseData {
  id: string;
  name: string;
  category: string;
  monthlyAmount: number;
  isEssential: boolean;
}

export interface InsightData {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
}

// =============================================================================
// UTILITY FUNCTIONS FOR RISK BAND CALCULATION
// =============================================================================

/**
 * Convert a 0-100 score to a risk band
 */
export function scoreToRiskBand(score: number): RiskBand {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'CONCERNING';
  return 'CRITICAL';
}

/**
 * Convert a risk band to a numeric severity
 */
export function riskBandToSeverity(band: RiskBand): RiskSeverity {
  switch (band) {
    case 'EXCELLENT':
    case 'GOOD':
      return 'LOW';
    case 'MODERATE':
      return 'MEDIUM';
    case 'CONCERNING':
      return 'HIGH';
    case 'CRITICAL':
      return 'CRITICAL';
  }
}
