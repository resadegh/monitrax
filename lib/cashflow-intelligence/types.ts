/**
 * CASHFLOW INTELLIGENCE CENTER - TYPE DEFINITIONS
 * Phase 29 - Cashflow Intelligence Center
 *
 * Comprehensive types for the intelligence center that aggregates
 * all existing engines (CFE, COE, Health, Tax, Budget) into one view.
 */

// =============================================================================
// HEALTH SCORE TYPES
// =============================================================================

export type CashflowHealthTier = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';

export interface CashflowHealthBreakdown {
  category: string;
  score: number;
  weight: number;
  description: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface CashflowHealthScore {
  overallScore: number; // 0-100
  tier: CashflowHealthTier;
  breakdown: CashflowHealthBreakdown[];
  confidence: number;
  lastCalculated: Date;
}

// =============================================================================
// MONEY LEAK TYPES
// =============================================================================

export interface MoneyLeak {
  id: string;
  category: string;
  description: string;
  monthlyAmount: number;
  percentOfIncome: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  transactionIds: string[]; // IDs for drill-down
  recommendation: string;
}

export interface LeakDetectionResult {
  totalLeakage: number;
  leaks: MoneyLeak[];
  topCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  analyzedFrom: Date;
  analyzedTo: Date;
  transactionCount: number;
}

// =============================================================================
// WATERFALL CHART TYPES
// =============================================================================

export interface WaterfallDataPoint {
  name: string;
  value: number;
  type: 'income' | 'expense' | 'net';
  isSubtotal?: boolean;
  category?: string;
}

export interface WaterfallData {
  items: WaterfallDataPoint[];
  netIncome: number;
  totalExpenses: number;
  surplus: number;
}

// =============================================================================
// BUDGET VS ACTUAL TYPES
// =============================================================================

export interface BudgetCategory {
  name: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'UNDER' | 'ON_TRACK' | 'OVER';
}

export interface BudgetComparison {
  categories: BudgetCategory[];
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  overallStatus: 'UNDER' | 'ON_TRACK' | 'OVER';
  period: {
    start: Date;
    end: Date;
  };
}

// =============================================================================
// FORECAST TYPES
// =============================================================================

export interface ForecastSummary {
  current: {
    balance: number;
    income: number;
    expenses: number;
    net: number;
  };
  forecast30Day: {
    predictedBalance: number;
    confidence: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  forecast90Day: {
    predictedBalance: number;
    confidence: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  breakEvenDay: number; // Day of month when expenses are covered
  shortfallRisk: boolean;
  shortfallDate?: Date;
  shortfallAmount?: number;
}

// =============================================================================
// TAX OPTIMIZATION TYPES
// =============================================================================

export interface TaxOptimization {
  estimatedAnnualTax: number;
  deductibleExpenses: number;
  potentialSavings: number;
  recommendations: {
    id: string;
    title: string;
    description: string;
    potentialSaving: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    actionUrl?: string;
  }[];
  effectiveTaxRate: number;
  paygWithheld: number;
}

// =============================================================================
// SMART ACTION TYPES
// =============================================================================

export interface SmartAction {
  id: string;
  rank: number;
  title: string;
  description: string;
  impact: number; // $ value
  impactDescription: string;
  category: 'SAVE' | 'TRANSFER' | 'CANCEL' | 'OPTIMIZE' | 'REVIEW';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'COE' | 'HEALTH' | 'TAX' | 'BUDGET' | 'FORECAST';
  actionUrl?: string;
  learnMoreUrl?: string;
}

// =============================================================================
// GEMINI SUMMARY TYPES
// =============================================================================

export interface GeminiSummary {
  id: string;
  userId: string;
  content: string;
  generatedAt: Date;
  dataHash: string; // Hash of input data to detect significant changes
  isStale: boolean;
  keyInsights: string[];
}

// =============================================================================
// COMPLETE INTELLIGENCE RESPONSE
// =============================================================================

export interface CashflowIntelligence {
  // Core metrics
  healthScore: CashflowHealthScore;
  forecast: ForecastSummary;

  // Detailed analysis
  leaks: LeakDetectionResult;
  waterfall: WaterfallData;
  budgetComparison?: BudgetComparison; // Only if budget is set up

  // Optimizations
  taxOptimization?: TaxOptimization;
  smartActions: SmartAction[];

  // Summary
  geminiSummary?: GeminiSummary;

  // Metadata
  generatedAt: Date;
  dataQuality: {
    transactionCoverage: number; // % of transactions categorized
    incomeCoverage: number; // % of income tracked
    expenseCoverage: number; // % of expenses tracked
    confidence: number;
  };
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface CashflowIntelligenceResponse {
  success: boolean;
  data?: CashflowIntelligence;
  error?: string;
}

export interface GeminiSummaryResponse {
  success: boolean;
  data?: GeminiSummary;
  error?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function scoreToTier(score: number): CashflowHealthTier {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'CONCERNING';
  return 'CRITICAL';
}

export function tierToColor(tier: CashflowHealthTier): string {
  switch (tier) {
    case 'EXCELLENT': return '#22c55e'; // green-500
    case 'GOOD': return '#84cc16'; // lime-500
    case 'MODERATE': return '#eab308'; // yellow-500
    case 'CONCERNING': return '#f97316'; // orange-500
    case 'CRITICAL': return '#ef4444'; // red-500
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
