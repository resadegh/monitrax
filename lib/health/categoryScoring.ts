/**
 * FINANCIAL HEALTH ENGINE - LAYER 2: CATEGORY SCORING
 * Phase 12 - Section 5.2
 *
 * Converts raw metrics from Layer 1 into weighted category scores (0-100).
 * Each category has specific metrics with defined weights per the blueprint.
 */

import {
  AggregatedMetrics,
  HealthCategory,
  HealthCategoryName,
  ContributingMetric,
  BaseMetric,
  CATEGORY_WEIGHTS,
  scoreToRiskBand,
} from './types';

// =============================================================================
// METRIC WEIGHTS BY CATEGORY (from Blueprint Section 5.2)
// =============================================================================

/**
 * Liquidity category weights (total: 100%)
 * - Emergency buffer: 40%
 * - Liquid net worth ratio: 40%
 * - Savings rate: 20%
 */
const LIQUIDITY_WEIGHTS = {
  emergencyBuffer: 0.40,
  liquidNetWorthRatio: 0.40,
  savingsRate: 0.20,
};

/**
 * Cashflow category weights (total: 100%)
 * - Cashflow surplus: 35%
 * - Cashflow volatility: 35%
 * - Fixed cost load: 30%
 */
const CASHFLOW_WEIGHTS = {
  surplus: 0.35,
  volatility: 0.35,
  fixedCostRatio: 0.30,
};

/**
 * Debt category weights (total: 100%)
 * - DTI: 40%
 * - LVR: 40%
 * - Repayment load: 20%
 */
const DEBT_WEIGHTS = {
  dti: 0.40,
  lvr: 0.40,
  repaymentLoad: 0.20,
};

/**
 * Investment category weights (total: 100%)
 * - Diversification: 30%
 * - Return consistency (performance): 40%
 * - Cost efficiency: 30%
 */
const INVESTMENT_WEIGHTS = {
  diversificationIndex: 0.30,
  performanceVsBenchmark: 0.40,
  costEfficiency: 0.30,
};

/**
 * Property category weights (total: 100%)
 * - Equity strength (valuation health): 40%
 * - Yield: 30%
 * - Market risk (LVR stability): 30%
 */
const PROPERTY_WEIGHTS = {
  valuationHealth: 0.40,
  rentalYieldPerformance: 0.30,
  lvrStability: 0.30,
};

/**
 * Risk Exposure category weights (total: 100%)
 * - Buffering: 40%
 * - Policy coverage gaps (insurance): 30%
 * - Spending sensitivity (discretionary): 30%
 */
const RISK_EXPOSURE_WEIGHTS = {
  buffering: 0.40,
  insuranceGaps: 0.30,
  volatilityExposure: 0.30,
};

/**
 * Long-Term Outlook category weights (total: 100%)
 * - Forecast runway: 50%
 * - Retirement gap: 50%
 */
const LONG_TERM_OUTLOOK_WEIGHTS = {
  retirementRunway: 0.50,
  sustainableWithdrawalRate: 0.50,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert a metric to a 0-100 score based on its risk band
 */
function metricToScore(metric: BaseMetric): number {
  switch (metric.riskBand) {
    case 'EXCELLENT':
      return 90;
    case 'GOOD':
      return 75;
    case 'MODERATE':
      return 55;
    case 'CONCERNING':
      return 35;
    case 'CRITICAL':
      return 15;
    default:
      return 50;
  }
}

/**
 * Create a ContributingMetric from a BaseMetric
 */
function createContributingMetric(
  name: string,
  metric: BaseMetric,
  weight: number
): ContributingMetric {
  const score = metricToScore(metric);
  return {
    name,
    value: metric.value,
    weight,
    score,
    benchmark: metric.benchmark,
  };
}

/**
 * Calculate weighted average score from contributing metrics
 */
function calculateWeightedScore(metrics: ContributingMetric[]): number {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return 50; // Default moderate score

  const weightedSum = metrics.reduce((sum, m) => sum + m.score * m.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

// =============================================================================
// CATEGORY SCORING FUNCTIONS
// =============================================================================

/**
 * Score Liquidity category (20% of total)
 */
export function scoreLiquidityCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Emergency Buffer',
      metrics.liquidity.emergencyBuffer,
      LIQUIDITY_WEIGHTS.emergencyBuffer
    ),
    createContributingMetric(
      'Liquid Net Worth Ratio',
      metrics.liquidity.liquidNetWorthRatio,
      LIQUIDITY_WEIGHTS.liquidNetWorthRatio
    ),
    createContributingMetric(
      'Savings Rate',
      metrics.liquidity.savingsRate,
      LIQUIDITY_WEIGHTS.savingsRate
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'LIQUIDITY',
    score,
    weight: CATEGORY_WEIGHTS.LIQUIDITY,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Cashflow category (20% of total)
 */
export function scoreCashflowCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Monthly Surplus',
      metrics.cashflow.surplus,
      CASHFLOW_WEIGHTS.surplus
    ),
    createContributingMetric(
      'Cashflow Volatility',
      metrics.cashflow.volatility,
      CASHFLOW_WEIGHTS.volatility
    ),
    createContributingMetric(
      'Fixed Cost Ratio',
      metrics.cashflow.fixedCostRatio,
      CASHFLOW_WEIGHTS.fixedCostRatio
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'CASHFLOW',
    score,
    weight: CATEGORY_WEIGHTS.CASHFLOW,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Debt category (15% of total)
 */
export function scoreDebtCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Debt-to-Income Ratio',
      metrics.debt.dti,
      DEBT_WEIGHTS.dti
    ),
    createContributingMetric(
      'Loan-to-Value Ratio',
      metrics.debt.lvr,
      DEBT_WEIGHTS.lvr
    ),
    createContributingMetric(
      'Repayment Load',
      metrics.debt.repaymentLoad,
      DEBT_WEIGHTS.repaymentLoad
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'DEBT',
    score,
    weight: CATEGORY_WEIGHTS.DEBT,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Investments category (15% of total)
 */
export function scoreInvestmentsCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Diversification',
      metrics.investments.diversificationIndex,
      INVESTMENT_WEIGHTS.diversificationIndex
    ),
    createContributingMetric(
      'Performance vs Benchmark',
      metrics.investments.performanceVsBenchmark,
      INVESTMENT_WEIGHTS.performanceVsBenchmark
    ),
    createContributingMetric(
      'Cost Efficiency',
      metrics.investments.costEfficiency,
      INVESTMENT_WEIGHTS.costEfficiency
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'INVESTMENTS',
    score,
    weight: CATEGORY_WEIGHTS.INVESTMENTS,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Property category (10% of total)
 */
export function scorePropertyCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Equity Strength',
      metrics.property.valuationHealth,
      PROPERTY_WEIGHTS.valuationHealth
    ),
    createContributingMetric(
      'Rental Yield',
      metrics.property.rentalYieldPerformance,
      PROPERTY_WEIGHTS.rentalYieldPerformance
    ),
    createContributingMetric(
      'LVR Stability',
      metrics.property.lvrStability,
      PROPERTY_WEIGHTS.lvrStability
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'PROPERTY',
    score,
    weight: CATEGORY_WEIGHTS.PROPERTY,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Risk Exposure category (10% of total)
 */
export function scoreRiskExposureCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Financial Buffering',
      metrics.risk.buffering,
      RISK_EXPOSURE_WEIGHTS.buffering
    ),
    createContributingMetric(
      'Insurance Coverage',
      metrics.risk.insuranceGaps,
      RISK_EXPOSURE_WEIGHTS.insuranceGaps
    ),
    createContributingMetric(
      'Volatility Exposure',
      metrics.risk.volatilityExposure,
      RISK_EXPOSURE_WEIGHTS.volatilityExposure
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'RISK_EXPOSURE',
    score,
    weight: CATEGORY_WEIGHTS.RISK_EXPOSURE,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

/**
 * Score Long-Term Outlook category (10% of total)
 */
export function scoreLongTermOutlookCategory(metrics: AggregatedMetrics): HealthCategory {
  const contributingMetrics: ContributingMetric[] = [
    createContributingMetric(
      'Retirement Runway',
      metrics.forecast.retirementRunway,
      LONG_TERM_OUTLOOK_WEIGHTS.retirementRunway
    ),
    createContributingMetric(
      'Sustainable Withdrawal',
      metrics.forecast.sustainableWithdrawalRate,
      LONG_TERM_OUTLOOK_WEIGHTS.sustainableWithdrawalRate
    ),
  ];

  const score = calculateWeightedScore(contributingMetrics);

  return {
    name: 'LONG_TERM_OUTLOOK',
    score,
    weight: CATEGORY_WEIGHTS.LONG_TERM_OUTLOOK,
    contributingMetrics,
    riskBand: scoreToRiskBand(score),
  };
}

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

/**
 * Score all categories from aggregated metrics.
 * This is the main entry point for Layer 2.
 */
export function scoreAllCategories(metrics: AggregatedMetrics): HealthCategory[] {
  return [
    scoreLiquidityCategory(metrics),
    scoreCashflowCategory(metrics),
    scoreDebtCategory(metrics),
    scoreInvestmentsCategory(metrics),
    scorePropertyCategory(metrics),
    scoreRiskExposureCategory(metrics),
    scoreLongTermOutlookCategory(metrics),
  ];
}

/**
 * Get the weakest category (lowest score)
 */
export function getWeakestCategory(categories: HealthCategory[]): HealthCategory | null {
  if (categories.length === 0) return null;
  return categories.reduce((weakest, current) =>
    current.score < weakest.score ? current : weakest
  );
}

/**
 * Get the strongest category (highest score)
 */
export function getStrongestCategory(categories: HealthCategory[]): HealthCategory | null {
  if (categories.length === 0) return null;
  return categories.reduce((strongest, current) =>
    current.score > strongest.score ? current : strongest
  );
}

/**
 * Get categories below a threshold (concerning/critical)
 */
export function getConcerningCategories(
  categories: HealthCategory[],
  threshold: number = 40
): HealthCategory[] {
  return categories.filter(c => c.score < threshold);
}

/**
 * Calculate the weighted contribution of each category to the total score
 */
export function calculateCategoryContributions(
  categories: HealthCategory[]
): { name: HealthCategoryName; contribution: number; score: number; weight: number }[] {
  return categories.map(c => ({
    name: c.name,
    contribution: c.score * c.weight,
    score: c.score,
    weight: c.weight,
  }));
}
