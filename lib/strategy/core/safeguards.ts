/**
 * FINANCIAL SAFEGUARDS
 * Phase 11 - Stage 1
 *
 * Financial safety limits and validation rules.
 * These safeguards prevent the engine from recommending risky or imprudent actions.
 */

// =============================================================================
// FINANCIAL SAFETY LIMITS
// =============================================================================

export const SAFEGUARDS = {
  // Debt Management
  maxDebtToIncome: 0.43,        // Never recommend if DTI > 43%
  minEmergencyFund: 3,          // Require 3 months expenses minimum
  maxLeverageRatio: 0.80,       // Maximum 80% LVR for property

  // Investment & Liquidity
  maxSingleInvestment: 0.20,    // No investment > 20% of portfolio
  minLiquidityRatio: 0.10,      // Keep 10% in liquid assets
  minCashReserve: 10000,        // Minimum $10k cash reserve

  // Refinancing
  minRefinanceGap: 0.005,       // 0.5% minimum rate difference
  maxRefinanceBreakeven: 24,    // 24 months maximum break-even
  minRefinanceSavings: 5000,    // Minimum $5k total savings

  // Spending & Cashflow
  maxExpenseToIncome: 0.80,     // Maximum 80% of income on expenses
  minSurplusRatio: 0.10,        // Minimum 10% surplus

  // Risk Management
  maxPortfolioVolatility: 0.25,  // Maximum 25% portfolio volatility
  minDiversification: 5,         // Minimum 5 holdings

  // Data Quality
  minDataQuality: 60,           // Minimum 60% data quality score for HIGH confidence
  maxDataAge: 90,               // Data older than 90 days = MEDIUM confidence
} as const;

// =============================================================================
// CONFIDENCE SCORING RULES
// =============================================================================

export interface ConfidenceRules {
  minDataQuality: number;
  maxDataAge: number;
  requiredSources: string[];
}

export const CONFIDENCE_THRESHOLDS = {
  HIGH: {
    minDataQuality: 80,
    maxDataAge: 30,
    requiredSources: ['snapshot', 'insights', 'health'],
  },
  MEDIUM: {
    minDataQuality: 60,
    maxDataAge: 90,
    requiredSources: ['snapshot'],
  },
  LOW: {
    minDataQuality: 0,
    maxDataAge: 365,
    requiredSources: [],
  },
} as const;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a recommendation violates any safeguards
 */
export function validateAgainstSafeguards(
  recommendation: any
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // TODO: Implement safeguard checks
  // - Check DTI ratio
  // - Check emergency fund
  // - Check liquidity
  // - Check concentration risk
  // etc.

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Calculate confidence level based on data quality
 */
export function calculateConfidenceLevel(
  dataQuality: number,
  dataAge: number,
  availableSources: string[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  // Check HIGH threshold
  if (
    dataQuality >= CONFIDENCE_THRESHOLDS.HIGH.minDataQuality &&
    dataAge <= CONFIDENCE_THRESHOLDS.HIGH.maxDataAge &&
    CONFIDENCE_THRESHOLDS.HIGH.requiredSources.every((s) => availableSources.includes(s))
  ) {
    return 'HIGH';
  }

  // Check MEDIUM threshold
  if (
    dataQuality >= CONFIDENCE_THRESHOLDS.MEDIUM.minDataQuality &&
    dataAge <= CONFIDENCE_THRESHOLDS.MEDIUM.maxDataAge
  ) {
    return 'MEDIUM';
  }

  // Otherwise LOW
  return 'LOW';
}

/**
 * Get human-readable safeguard message
 */
export function getSafeguardMessage(violation: string): string {
  const messages: Record<string, string> = {
    maxDebtToIncome: 'This action would exceed the prudent debt-to-income ratio of 43%',
    minEmergencyFund: 'You need at least 3 months of expenses in emergency fund first',
    maxSingleInvestment: 'This would create excessive concentration risk (>20% in single investment)',
    minLiquidityRatio: 'This would reduce your liquid assets below the recommended 10% minimum',
    minRefinanceGap: 'Interest rate difference too small to justify refinancing costs',
    maxRefinanceBreakeven: 'Break-even period exceeds the recommended 24-month maximum',
  };

  return messages[violation] || 'This action violates financial safety guidelines';
}
