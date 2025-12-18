/**
 * CASHFLOW HEALTH SCORE AGGREGATOR
 * Phase 29 - Cashflow Intelligence Center
 *
 * Combines metrics from existing engines (CFE, COE, Health, Budget) into
 * a unified cashflow health score. Uses ONLY real calculated numbers.
 *
 * Weight Distribution:
 * - Liquidity (25%): Emergency buffer, accessible cash
 * - Cashflow Stability (25%): Income vs expenses, surplus
 * - Forecast Risk (20%): Shortfall risk, break-even timing
 * - Budget Adherence (15%): Budget vs actual spending
 * - Debt Health (15%): Repayment load, DTI ratio
 */

import {
  CashflowHealthScore,
  CashflowHealthBreakdown,
  scoreToTier,
} from './types';

// =============================================================================
// CATEGORY WEIGHTS
// =============================================================================

const CATEGORY_WEIGHTS = {
  liquidity: 0.25,
  cashflowStability: 0.25,
  forecastRisk: 0.20,
  budgetAdherence: 0.15,
  debtHealth: 0.15,
};

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface HealthScoreInput {
  // From CFE/COE
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  availableCash: number; // Total liquid balance
  withdrawableCash: number; // After emergency buffer
  burnRate: number;
  volatilityIndex: number;
  breakEvenDay: number; // Day of month
  hasShortfall: boolean;
  shortfallDays: number;

  // From Health Engine (if available)
  emergencyBuffer?: number; // Months of runway
  dti?: number; // Debt-to-income ratio
  savingsRate?: number; // % of income saved

  // From Budget Analysis (if available)
  hasBudget: boolean;
  budgetedTotal?: number;
  actualTotal?: number;

  // Historical comparison (if available)
  previousPeriod?: {
    surplus: number;
    savingsRate: number;
    volatilityIndex: number;
  };
}

// =============================================================================
// SCORE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate liquidity score (0-100)
 * Based on emergency buffer and accessible cash
 */
function calculateLiquidityScore(input: HealthScoreInput): number {
  let score = 50; // Base score

  // Emergency buffer assessment (6 months is ideal)
  if (input.emergencyBuffer !== undefined) {
    if (input.emergencyBuffer >= 6) score = 100;
    else if (input.emergencyBuffer >= 3) score = 75;
    else if (input.emergencyBuffer >= 1) score = 50;
    else score = 25;
  } else {
    // Calculate from available data
    const monthsOfRunway = input.burnRate > 0
      ? input.availableCash / input.burnRate
      : 0;

    if (monthsOfRunway >= 6) score = 100;
    else if (monthsOfRunway >= 3) score = 75;
    else if (monthsOfRunway >= 1) score = 50;
    else if (monthsOfRunway > 0) score = 25;
    else score = 0;
  }

  // Adjust based on withdrawable cash ratio
  if (input.availableCash > 0) {
    const withdrawableRatio = input.withdrawableCash / input.availableCash;
    score = score * (0.7 + withdrawableRatio * 0.3); // Up to 30% adjustment
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate cashflow stability score (0-100)
 * Based on surplus, volatility, and savings rate
 */
function calculateCashflowStabilityScore(input: HealthScoreInput): number {
  let score = 50; // Base score

  // Surplus ratio (income vs expenses)
  const surplus = input.monthlyIncome - input.monthlyExpenses - input.monthlyLoanRepayments;
  const surplusRatio = input.monthlyIncome > 0
    ? surplus / input.monthlyIncome
    : 0;

  // Ideal surplus is 20%+ of income
  if (surplusRatio >= 0.20) score = 100;
  else if (surplusRatio >= 0.10) score = 80;
  else if (surplusRatio >= 0.05) score = 60;
  else if (surplusRatio >= 0) score = 40;
  else score = Math.max(0, 40 + surplusRatio * 200); // Negative surplus reduces score

  // Volatility penalty (high volatility = unpredictable)
  const volatilityPenalty = Math.min(20, input.volatilityIndex * 0.2);
  score = score - volatilityPenalty;

  // Savings rate bonus
  if (input.savingsRate !== undefined && input.savingsRate > 0) {
    score = score + Math.min(10, input.savingsRate * 0.5);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate forecast risk score (0-100)
 * Based on shortfall prediction and break-even timing
 */
function calculateForecastRiskScore(input: HealthScoreInput): number {
  let score = 80; // Start optimistic

  // Shortfall is a major red flag
  if (input.hasShortfall) {
    score = score - 30;
    // Further penalty based on how many days
    score = score - Math.min(20, input.shortfallDays * 2);
  }

  // Break-even timing (earlier is better)
  // Ideal: income covers expenses by day 15
  if (input.breakEvenDay >= 0) {
    if (input.breakEvenDay <= 10) score = Math.min(score + 10, 100);
    else if (input.breakEvenDay <= 15) score = score + 5;
    else if (input.breakEvenDay <= 20) score = score - 5;
    else if (input.breakEvenDay <= 25) score = score - 10;
    else score = score - 15;
  } else if (input.breakEvenDay === -1) {
    // No break-even possible (expenses exceed income)
    score = score - 20;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate budget adherence score (0-100)
 * Based on actual vs budgeted spending
 */
function calculateBudgetAdherenceScore(input: HealthScoreInput): number {
  if (!input.hasBudget || !input.budgetedTotal || !input.actualTotal) {
    // No budget set up - return neutral score
    return 50;
  }

  const variance = input.actualTotal - input.budgetedTotal;
  const variancePercent = input.budgetedTotal > 0
    ? (variance / input.budgetedTotal) * 100
    : 0;

  // Under budget is good, over budget is bad
  if (variancePercent <= -10) return 100; // More than 10% under budget
  if (variancePercent <= -5) return 90;
  if (variancePercent <= 0) return 80;
  if (variancePercent <= 5) return 70;
  if (variancePercent <= 10) return 50;
  if (variancePercent <= 20) return 30;
  return 10; // More than 20% over budget
}

/**
 * Calculate debt health score (0-100)
 * Based on DTI ratio and repayment load
 */
function calculateDebtHealthScore(input: HealthScoreInput): number {
  let score = 70; // Base score

  // DTI ratio assessment
  if (input.dti !== undefined) {
    // DTI < 28% is excellent, > 43% is concerning
    if (input.dti <= 0.20) score = 100;
    else if (input.dti <= 0.28) score = 85;
    else if (input.dti <= 0.36) score = 70;
    else if (input.dti <= 0.43) score = 50;
    else score = 30;
  } else {
    // Calculate from repayment load
    const repaymentRatio = input.monthlyIncome > 0
      ? input.monthlyLoanRepayments / input.monthlyIncome
      : 0;

    if (repaymentRatio <= 0.20) score = 100;
    else if (repaymentRatio <= 0.30) score = 80;
    else if (repaymentRatio <= 0.40) score = 60;
    else if (repaymentRatio <= 0.50) score = 40;
    else score = 20;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate trend direction by comparing to previous period
 */
function calculateTrend(
  current: number,
  previous?: number
): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (previous === undefined) return 'STABLE';

  const change = current - previous;
  if (change > 5) return 'IMPROVING';
  if (change < -5) return 'DECLINING';
  return 'STABLE';
}

// =============================================================================
// MAIN AGGREGATOR FUNCTION
// =============================================================================

/**
 * Calculate the comprehensive cashflow health score
 */
export function calculateCashflowHealthScore(input: HealthScoreInput): CashflowHealthScore {
  // Calculate individual category scores
  const liquidityScore = calculateLiquidityScore(input);
  const cashflowScore = calculateCashflowStabilityScore(input);
  const forecastScore = calculateForecastRiskScore(input);
  const budgetScore = calculateBudgetAdherenceScore(input);
  const debtScore = calculateDebtHealthScore(input);

  // Calculate weighted average
  const overallScore = Math.round(
    liquidityScore * CATEGORY_WEIGHTS.liquidity +
    cashflowScore * CATEGORY_WEIGHTS.cashflowStability +
    forecastScore * CATEGORY_WEIGHTS.forecastRisk +
    budgetScore * CATEGORY_WEIGHTS.budgetAdherence +
    debtScore * CATEGORY_WEIGHTS.debtHealth
  );

  // Build breakdown
  const breakdown: CashflowHealthBreakdown[] = [
    {
      category: 'Liquidity',
      score: liquidityScore,
      weight: CATEGORY_WEIGHTS.liquidity,
      description: getScoreDescription(liquidityScore, 'liquidity'),
      trend: 'STABLE', // Would calculate from historical data
    },
    {
      category: 'Cashflow Stability',
      score: cashflowScore,
      weight: CATEGORY_WEIGHTS.cashflowStability,
      description: getScoreDescription(cashflowScore, 'cashflow'),
      trend: input.previousPeriod
        ? calculateTrend(
            input.monthlyIncome - input.monthlyExpenses,
            input.previousPeriod.surplus
          )
        : 'STABLE',
    },
    {
      category: 'Forecast Risk',
      score: forecastScore,
      weight: CATEGORY_WEIGHTS.forecastRisk,
      description: getScoreDescription(forecastScore, 'forecast'),
      trend: 'STABLE',
    },
    {
      category: 'Budget Adherence',
      score: budgetScore,
      weight: CATEGORY_WEIGHTS.budgetAdherence,
      description: input.hasBudget
        ? getScoreDescription(budgetScore, 'budget')
        : 'No budget configured',
      trend: 'STABLE',
    },
    {
      category: 'Debt Health',
      score: debtScore,
      weight: CATEGORY_WEIGHTS.debtHealth,
      description: getScoreDescription(debtScore, 'debt'),
      trend: 'STABLE',
    },
  ];

  // Calculate confidence based on data availability
  let confidence = 100;
  if (input.emergencyBuffer === undefined) confidence -= 10;
  if (input.dti === undefined) confidence -= 10;
  if (!input.hasBudget) confidence -= 15;
  if (input.previousPeriod === undefined) confidence -= 10;
  if (input.monthlyIncome === 0) confidence -= 20;

  return {
    overallScore,
    tier: scoreToTier(overallScore),
    breakdown,
    confidence: Math.max(50, confidence),
    lastCalculated: new Date(),
  };
}

/**
 * Get human-readable description for a score
 */
function getScoreDescription(score: number, category: string): string {
  const tier = scoreToTier(score);

  const descriptions: Record<string, Record<typeof tier, string>> = {
    liquidity: {
      EXCELLENT: 'Strong emergency buffer, well-prepared for unexpected expenses',
      GOOD: 'Adequate cash reserves for short-term needs',
      MODERATE: 'Limited buffer, consider building emergency fund',
      CONCERNING: 'Low liquidity, vulnerable to unexpected expenses',
      CRITICAL: 'Insufficient cash reserves, high risk of shortfall',
    },
    cashflow: {
      EXCELLENT: 'Healthy surplus with consistent income patterns',
      GOOD: 'Positive cashflow with room for improvement',
      MODERATE: 'Breaking even, limited savings capacity',
      CONCERNING: 'Tight cashflow, expenses close to income',
      CRITICAL: 'Negative cashflow, spending exceeds income',
    },
    forecast: {
      EXCELLENT: 'No shortfall risk, healthy trajectory',
      GOOD: 'Low risk outlook with manageable timing',
      MODERATE: 'Some timing pressure, monitor closely',
      CONCERNING: 'Shortfall risk detected in forecast period',
      CRITICAL: 'High shortfall risk, immediate action needed',
    },
    budget: {
      EXCELLENT: 'Under budget with room to spare',
      GOOD: 'On track with minor variances',
      MODERATE: 'Some categories over budget',
      CONCERNING: 'Significantly over budget in key areas',
      CRITICAL: 'Budget significantly exceeded',
    },
    debt: {
      EXCELLENT: 'Low debt load, sustainable repayments',
      GOOD: 'Manageable debt with healthy income coverage',
      MODERATE: 'Moderate debt load, within acceptable range',
      CONCERNING: 'High debt-to-income ratio, may limit flexibility',
      CRITICAL: 'Debt load is unsustainable at current income',
    },
  };

  return descriptions[category]?.[tier] || 'Score calculated from available data';
}
