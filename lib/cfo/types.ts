/**
 * Phase 17: Personal CFO Engine Types
 * Core type definitions for the CFO Intelligence System
 */
import type { HealthCategory } from '@/lib/health';

// ============================================================================
// CFO Score Types
// ============================================================================

export interface CFOScore {
  overall: number; // 0-100 — MON-030 B1: sourced from the canonical health engine
  components: CFOScoreComponents; // legacy 6 — feeds generateActions only; NOT rendered (removed stage 2b)
  // MON-030 B1: the 7 canonical health categories rendered as the My Guide bars
  // (so the bars explain the ring — one engine). Same data as the Home tile.
  // Optional because the legacy `calculateCFOScore` (transitional, feeds
  // generateActions only) doesn't populate it — only the canonical assembler does.
  healthCategories?: HealthCategory[];
  trend: 'improving' | 'stable' | 'declining';
  lastCalculated: Date;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface CFOScoreComponents {
  cashflowStrength: number; // 0-100
  debtCoverage: number; // 0-100
  emergencyBuffer: number; // 0-100
  investmentDiversification: number; // 0-100
  spendingControl: number; // 0-100
  savingsRate: number; // 0-100
}

export interface CFOScoreHistory {
  date: Date;
  score: number;
  components: CFOScoreComponents;
}

// ============================================================================
// Risk Types
// ============================================================================

export type RiskTimeframe = 'short' | 'medium' | 'long';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FinancialRisk {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  timeframe: RiskTimeframe;
  title: string;
  description: string;
  impact: number; // Dollar impact
  probability: number; // 0-1
  detectedAt: Date;
  expiresAt?: Date;
  relatedEntities: RiskEntity[];
  suggestedActions: string[];
}

export type RiskType =
  // Short-term risks
  | 'low_balance'
  | 'cashflow_shortfall'
  | 'expense_spike'
  | 'overdue_bill'
  | 'loan_stress'
  // Medium-term risks
  | 'debt_ratio_deterioration'
  | 'savings_trajectory'
  | 'property_underperformance'
  | 'subscription_creep'
  // Long-term risks
  | 'retirement_gap'
  | 'investment_misalignment'
  | 'mortgage_renewal'
  | 'concentration_risk'
  // Tax-related risks (Phase 17A)
  | 'cgt_exposure_high'
  | 'super_cap_approaching'
  | 'div293_threshold'
  | 'eofy_action_required'
  | 'depreciation_unclaimed'
  | 'franking_credits_unused'
  | 'negative_gearing_review'
  | 'tax_refund_opportunity'
  // Loan-related risks (Phase 17B)
  | 'refinance_opportunity'
  | 'fixed_rate_expiry'
  | 'interest_only_expiry'
  | 'high_dti_ratio'
  | 'high_lvr'
  | 'rate_shock_risk'
  | 'offset_underutilized'
  | 'debt_consolidation_opportunity'
  // Property-related risks (Phase 17C)
  | 'property_high_lvr'
  | 'property_low_yield'
  | 'property_negative_cashflow'
  | 'property_low_growth';

export interface RiskEntity {
  type: 'property' | 'loan' | 'account' | 'income' | 'expense' | 'investment';
  id: string;
  name: string;
}

export interface RiskRadarOutput {
  risks: FinancialRisk[];
  summary: RiskSummary;
  lastScanned: Date;
}

export interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalImpact: number;
  topRisk: FinancialRisk | null;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionPriority = 'do_now' | 'upcoming' | 'consider_soon' | 'background';
export type ActionCategory =
  | 'debt'
  | 'savings'
  | 'spending'
  | 'investment'
  | 'property'
  | 'tax'
  | 'cashflow'
  | 'risk';

export interface CFOAction {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  explanation: string; // Simple English
  severity: RiskSeverity;
  expectedImpact: ActionImpact;
  timeRequired: string; // e.g., "5 minutes", "1 hour"
  confidence: number; // 0-1
  supportingData: ActionEvidence[];
  relatedRisks: string[]; // Risk IDs
  createdAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'dismissed' | 'completed';
}

export interface ActionImpact {
  type: 'savings' | 'risk_reduction' | 'growth' | 'optimization';
  amount: number;
  timeframe: string; // e.g., "per month", "per year", "one-time"
  description: string;
}

export interface ActionEvidence {
  type: 'metric' | 'trend' | 'comparison' | 'forecast';
  label: string;
  value: string | number;
  context?: string;
}

export interface ActionPrioritisationOutput {
  doNow: CFOAction[];
  upcoming: CFOAction[];
  considerSoon: CFOAction[];
  background: CFOAction[];
  totalActions: number;
  highestPriorityAction: CFOAction | null;
}

// ============================================================================
// CFO Dashboard Types
// ============================================================================

export interface CFODashboardData {
  score: CFOScore;
  scoreHistory: CFOScoreHistory[];
  risks: RiskRadarOutput;
  actions: ActionPrioritisationOutput;
  monthlyProgress: MonthlyProgress;
  quickStats: CFOQuickStats;
  alerts: CFOAlert[];
  taxInsights?: CFOTaxInsights; // Phase 17A: Tax Integration
  loanInsights?: CFOLoanInsights; // Phase 17B: Loan Decision Support
  propertyInsights?: CFOPropertyInsights; // Phase 17C: Property Decision Support
  investmentInsights?: CFOInvestmentInsights; // Phase 17D: Investment Decision Support
}

// ============================================================================
// Tax Insights Types (Phase 17A)
// ============================================================================

export interface CFOTaxInsights {
  taxPositionSnapshot: {
    estimatedRefund: number;
    confidenceLevel: number;
    daysUntilEOFY: number;
    actionRequiredBeforeEOFY: boolean;
    financialYear: string;
  };
  deductionsSummary: {
    totalDeductions: number;
    propertyDeductions: number;
    investmentDeductions: number;
    workRelatedDeductions: number;
    depreciationDeductions: number;
    potentialMissedDeductions: string[];
  };
  keyTaxMetrics: {
    effectiveTaxRate: number;
    marginalRate: number;
    negativeGearingBenefit: number;
    frankingCreditsAvailable: number;
    unrealisedCGT: number;
    paygWithheld: number;
  };
  metadata: {
    calculatedAt: Date;
    incomeCount: number;
    expenseCount: number;
    depreciationCount: number;
  };
}

// ============================================================================
// Loan Insights Types (Phase 17B)
// ============================================================================

export interface CFOLoanInsights {
  loanPortfolio: {
    totalDebt: number;
    totalMonthlyRepayments: number;
    weightedAverageRate: number;
    loanCount: number;
    debtToIncomeRatio: number;
    debtServiceRatio: number;
  };
  refinanceOpportunities: CFORefinanceOpportunity[];
  totalRefinanceSavings: number;
  rateAlerts: CFORateAlert[];
  extraRepaymentImpact: CFOExtraRepaymentImpact | null;
  loanRisks: CFOLoanRisk[];
  metadata: {
    calculatedAt: Date;
    loanCount: number;
    hasOffsetAccounts: boolean;
  };
}

export interface CFORefinanceOpportunity {
  loanId: string;
  loanName: string;
  loanType: string;
  currentBalance: number;
  currentRate: number;
  marketRate: number;
  rateDifference: number;
  monthlySavings: number;
  annualSavings: number;
  breakEvenMonths: number;
  totalLifetimeSavings: number;
  remainingMonths: number;
  worthRefinancing: boolean;
}

export interface CFORateAlert {
  type: 'fixed_rate_expiring' | 'interest_only_ending' | 'rate_above_market' | 'lvr_high';
  severity: 'critical' | 'high' | 'medium' | 'low';
  loanId: string;
  loanName: string;
  title: string;
  description: string;
  daysUntil?: number;
  currentRate: number;
  impact: number;
  action: string;
}

// MON-019: kept structurally identical to the canonical `ExtraRepaymentImpact`
// in lib/cfo/decisionSupport/loanDecisionSupport.ts (the real return type of
// calculateCFOLoanInsights, which flows into CFODashboardData.loanInsights).
// interestSaved/timeReduced/payoff dates are null when the loan isn't amortising
// (interest-only) — never do arithmetic on the 999 sentinel. (§12.2.1 duplicate;
// a future PR should collapse the two.)
export interface CFOExtraRepaymentImpact {
  extraMonthly: number;
  interestSaved: number | null;
  timeReduced: number | null;
  amortisingNow: boolean;
  startsAmortising: boolean;
  newPayoffMonths: number | null;
  targetLoanId: string;
  targetLoanName: string;
  currentPayoffDate: Date | null;
  newPayoffDate: Date | null;
}

export interface CFOLoanRisk {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number;
  action: string;
  loanId?: string;
}

// ============================================================================
// Property Insights Types (Phase 17C)
// ============================================================================

export interface CFOPropertyInsights {
  portfolioSummary: {
    totalProperties: number;
    totalValue: number;
    totalEquity: number;
    averageLVR: number;
    totalMonthlyIncome: number;
    totalMonthlyCashflow: number;
  };
  propertyAlerts: CFOPropertyAlert[];
  topPerformer: CFOPropertyPerformance | null;
  underperformer: CFOPropertyPerformance | null;
  metadata: {
    calculatedAt: Date;
    propertyCount: number;
  };
}

export interface CFOPropertyAlert {
  type: 'high_lvr' | 'low_yield' | 'negative_cashflow' | 'low_growth';
  severity: 'critical' | 'high' | 'medium' | 'low';
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  value: number;
  action: string;
}

export interface CFOPropertyPerformance {
  propertyId: string;
  propertyName: string;
  metric: string;
  value: number;
  description: string;
}

// ============================================================================
// Investment Insights Types (Phase 17D)
// ============================================================================

export interface CFOInvestmentInsights {
  portfolioSummary: {
    totalValue: number;
    totalCostBase: number;
    unrealisedGain: number;
    unrealisedGainPercent: number;
    holdingsCount: number;
    dividendYieldPercent: number;
  };
  allocationAnalysis: CFOAllocationAnalysis;
  performanceMetrics: CFOPerformanceMetrics;
  investmentAlerts: CFOInvestmentAlert[];
  topPerformer: CFOInvestmentPerformance | null;
  underperformer: CFOInvestmentPerformance | null;
  metadata: {
    calculatedAt: Date;
    holdingsCount: number;
  };
}

export interface CFOAllocationAnalysis {
  currentAllocation: CFOAssetAllocation[];
  targetAllocation: CFOAssetAllocation[] | null;
  driftFromTarget: number; // Percentage drift
  rebalanceActions: CFORebalanceAction[];
  concentrationRisk: {
    hasRisk: boolean;
    topHolding: string | null;
    topHoldingPercent: number;
  };
}

export interface CFOAssetAllocation {
  assetType: string;
  value: number;
  percentage: number;
  targetPercentage?: number;
}

export interface CFORebalanceAction {
  assetType: string;
  action: 'buy' | 'sell' | 'hold';
  currentPercent: number;
  targetPercent: number;
  amountToAdjust: number;
  description: string;
}

export interface CFOPerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualisedReturn: number | null; // CAGR if > 1 year
  dividendIncome: number;
  frankingCredits: number;
  unrealisedCGT: number;
}

export interface CFOInvestmentAlert {
  type: 'concentration_high' | 'underperforming' | 'dividend_cut' | 'rebalance_needed' | 'cgt_opportunity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  holdingId?: string;
  holdingName?: string;
  title: string;
  description: string;
  value: number;
  action: string;
}

export interface CFOInvestmentPerformance {
  holdingId: string;
  holdingName: string;
  metric: string;
  value: number;
  description: string;
}

export interface MonthlyProgress {
  netWorthChange: number;
  netWorthChangePercent: number;
  savingsRate: number;
  /** MON-018 — null when there is no stored history to compare against
   *  (was a fabricated constant 0.5). The UI hides the sub-line when null. */
  savingsRateChange: number | null;
  debtReduction: number;
  topImprovements: string[];
  emergingRisks: string[];
}

export interface CFOQuickStats {
  daysUntilNextBill: number;
  projectedMonthEndBalance: number;
  unusedSubscriptions: number;
  savingsOpportunities: number;
  pendingActions: number;
}

export interface CFOAlert {
  id: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: Date;
  read: boolean;
}

// ============================================================================
// Financial Plan Types
// ============================================================================

export type PlanType =
  | 'cashflow_30day'
  | 'annual_savings'
  | 'debt_reduction'
  | 'property_portfolio'
  | 'investment_allocation';

export interface FinancialPlan {
  id: string;
  type: PlanType;
  title: string;
  description: string;
  steps: PlanStep[];
  milestones: PlanMilestone[];
  projections: PlanProjection[];
  createdAt: Date;
  status: 'active' | 'paused' | 'completed';
  progress: number; // 0-100
}

export interface PlanStep {
  order: number;
  title: string;
  description: string;
  action: string;
  completed: boolean;
  dueDate?: Date;
}

export interface PlanMilestone {
  id: string;
  title: string;
  targetDate: Date;
  targetValue: number;
  currentValue: number;
  achieved: boolean;
}

export interface PlanProjection {
  date: Date;
  projectedValue: number;
  actualValue?: number;
  variance?: number;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowType =
  | 'reduce_expenses'
  | 'tax_preparation'
  | 'stabilise_cashflow'
  | 'optimise_property'
  | 'debt_restructure'
  | 'emergency_fund';

export interface CFOWorkflow {
  id: string;
  type: WorkflowType;
  title: string;
  description: string;
  targetOutcome: string;
  steps: WorkflowStep[];
  currentStep: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}

export interface WorkflowStep {
  order: number;
  title: string;
  instructions: string;
  checkItems: string[];
  completed: boolean;
  completedAt?: Date;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationCategory =
  | 'cashflow'
  | 'deposit'
  | 'withdrawal'
  | 'income'
  | 'bill'
  | 'subscription'
  | 'overspend'
  | 'goal'
  | 'risk';

export interface CFONotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  actionUrl?: string;
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface CFOEngineConfig {
  userId: string;
  preferences: CFOPreferences;
}

export interface CFOPreferences {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  notificationFrequency: 'realtime' | 'daily' | 'weekly';
  focusAreas: ActionCategory[];
  enabledWorkflows: WorkflowType[];
}
