/**
 * Phase 20: Superannuation Cap Tracker
 * Tracks contribution caps and carry-forward amounts
 */

import { TaxYearConfig, getCurrentFinancialYear } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

// =============================================================================
// Types
// =============================================================================

export interface CapTrackingInput {
  // Current year contributions
  concessionalYTD: number;
  nonConcessionalYTD: number;

  // Carry-forward from previous years (if available)
  carryForwardAmounts?: {
    financialYear: string;
    unusedAmount: number;
  }[];

  // Total super balance (affects bring-forward rules)
  totalSuperBalance?: number;
}

export interface CapTrackingResult {
  concessional: {
    cap: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    carryForwardAvailable: number;
    totalAvailable: number;
    isExceeded: boolean;
    excessAmount: number;
  };
  nonConcessional: {
    cap: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    bringForwardAvailable: boolean;
    bringForwardCap: number;
    totalAvailable: number;
    isExceeded: boolean;
    excessAmount: number;
  };
  excessContributionsTax: number;
  warnings: string[];
  financialYear: string;
}

// =============================================================================
// Historical caps for carry-forward calculations
// =============================================================================

const CONCESSIONAL_CAPS: Record<string, number> = {
  '2019-20': 25000,
  '2020-21': 25000,
  '2021-22': 27500,
  '2022-23': 27500,
  '2023-24': 27500,
  '2024-25': 30000,
  '2025-26': 30000, // Projected
};

const NON_CONCESSIONAL_CAPS: Record<string, number> = {
  '2019-20': 100000,
  '2020-21': 100000,
  '2021-22': 110000,
  '2022-23': 110000,
  '2023-24': 110000,
  '2024-25': 120000,
  '2025-26': 120000, // Projected
};

// Total super balance thresholds for bring-forward
const BRING_FORWARD_THRESHOLDS = {
  full: 1660000, // Below this: can bring forward 3 years
  reduced: 1780000, // Below this: can bring forward 2 years
  none: 1900000, // At or above: no bring-forward
};

// =============================================================================
// Cap Tracking Functions
// =============================================================================

/**
 * Calculate available carry-forward concessional contributions
 * Based on unused caps from up to 5 previous financial years
 * (Only available if total super balance < $500,000 at prior 30 June)
 */
export function calculateCarryForward(
  carryForwardAmounts: { financialYear: string; unusedAmount: number }[],
  totalSuperBalance: number
): {
  available: number;
  breakdown: { financialYear: string; amount: number }[];
  eligible: boolean;
  reason: string;
} {
  // Carry-forward only available if TSB was less than $500,000
  const TSB_THRESHOLD = 500000;

  if (totalSuperBalance >= TSB_THRESHOLD) {
    return {
      available: 0,
      breakdown: [],
      eligible: false,
      reason: `Total super balance ($${totalSuperBalance.toLocaleString()}) exceeds $500,000 threshold`,
    };
  }

  // Get up to 5 years of unused caps (excluding current year)
  const currentFY = getCurrentFinancialYear();
  const eligibleYears = carryForwardAmounts
    .filter((cf) => {
      // Check if within 5 years
      const [fyStart] = cf.financialYear.split('-');
      const [currentStart] = currentFY.year.split('-');
      const yearDiff = parseInt(currentStart) - parseInt(fyStart);
      return yearDiff > 0 && yearDiff <= 5;
    })
    .sort((a, b) => a.financialYear.localeCompare(b.financialYear)); // Oldest first (FIFO)

  const totalAvailable = eligibleYears.reduce((sum, cf) => sum + cf.unusedAmount, 0);

  return {
    available: totalAvailable,
    breakdown: eligibleYears.map((cf) => ({
      financialYear: cf.financialYear,
      amount: cf.unusedAmount,
    })),
    eligible: true,
    reason: totalAvailable > 0
      ? `$${totalAvailable.toLocaleString()} carry-forward available from previous years`
      : 'No unused caps from previous years',
  };
}

/**
 * Calculate bring-forward availability for non-concessional contributions
 * Allows using up to 3 years of caps in a single year
 */
export function calculateBringForward(
  totalSuperBalance: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  yearsAvailable: number;
  totalCap: number;
  eligible: boolean;
  reason: string;
} {
  const baseCap = config.nonConcessionalCap;

  if (totalSuperBalance >= BRING_FORWARD_THRESHOLDS.none) {
    return {
      yearsAvailable: 1,
      totalCap: baseCap,
      eligible: false,
      reason: `Total super balance ($${totalSuperBalance.toLocaleString()}) exceeds $${BRING_FORWARD_THRESHOLDS.none.toLocaleString()}. No bring-forward available.`,
    };
  }

  if (totalSuperBalance >= BRING_FORWARD_THRESHOLDS.reduced) {
    return {
      yearsAvailable: 2,
      totalCap: baseCap * 2,
      eligible: true,
      reason: `Can bring forward 2 years: $${(baseCap * 2).toLocaleString()} total cap`,
    };
  }

  if (totalSuperBalance >= BRING_FORWARD_THRESHOLDS.full) {
    return {
      yearsAvailable: 2,
      totalCap: baseCap * 2,
      eligible: true,
      reason: `Can bring forward 2 years: $${(baseCap * 2).toLocaleString()} total cap`,
    };
  }

  return {
    yearsAvailable: 3,
    totalCap: baseCap * 3,
    eligible: true,
    reason: `Can bring forward 3 years: $${(baseCap * 3).toLocaleString()} total cap`,
  };
}

/**
 * Track contribution caps and calculate remaining availability
 */
export function trackContributionCaps(
  input: CapTrackingInput,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): CapTrackingResult {
  const warnings: string[] = [];
  const currentFY = getCurrentFinancialYear();

  // Calculate carry-forward for concessional
  const carryForward = input.carryForwardAmounts
    ? calculateCarryForward(input.carryForwardAmounts, input.totalSuperBalance || 0)
    : { available: 0, breakdown: [], eligible: true, reason: '' };

  // Calculate bring-forward for non-concessional
  const bringForward = calculateBringForward(input.totalSuperBalance || 0, config);

  // Concessional cap tracking
  const concessionalCap = config.concessionalCap;
  const concessionalTotalAvailable = concessionalCap + carryForward.available;
  const concessionalRemaining = concessionalTotalAvailable - input.concessionalYTD;
  const concessionalExcess = Math.max(0, input.concessionalYTD - concessionalTotalAvailable);

  // Non-concessional cap tracking
  const nonConcessionalCap = config.nonConcessionalCap;
  const nonConcessionalTotalAvailable = bringForward.eligible
    ? bringForward.totalCap
    : nonConcessionalCap;
  const nonConcessionalRemaining = nonConcessionalTotalAvailable - input.nonConcessionalYTD;
  const nonConcessionalExcess = Math.max(0, input.nonConcessionalYTD - nonConcessionalTotalAvailable);

  // Calculate excess contributions tax
  // Excess concessional: taxed at marginal rate (we'll estimate at 47% + 15% already paid = additional 32%)
  // Excess non-concessional: 47% tax
  let excessContributionsTax = 0;

  if (concessionalExcess > 0) {
    // Excess concessional is added to assessable income, but 15% already paid
    // Interest charge also applies (not calculated here)
    excessContributionsTax += concessionalExcess * 0.32; // Approximate additional tax
    warnings.push(
      `Excess concessional contributions of $${concessionalExcess.toLocaleString()} will be taxed at your marginal rate (plus interest charge).`
    );
  }

  if (nonConcessionalExcess > 0) {
    excessContributionsTax += nonConcessionalExcess * 0.47;
    warnings.push(
      `Excess non-concessional contributions of $${nonConcessionalExcess.toLocaleString()} will attract 47% tax unless you elect to withdraw.`
    );
  }

  // Additional warnings
  if (input.concessionalYTD > concessionalCap * 0.9 && input.concessionalYTD <= concessionalCap) {
    warnings.push(
      `Concessional contributions at ${Math.round((input.concessionalYTD / concessionalCap) * 100)}% of cap. Be careful not to exceed.`
    );
  }

  return {
    concessional: {
      cap: concessionalCap,
      used: input.concessionalYTD,
      remaining: Math.max(0, concessionalRemaining),
      percentageUsed: Math.min(100, (input.concessionalYTD / concessionalTotalAvailable) * 100),
      carryForwardAvailable: carryForward.available,
      totalAvailable: concessionalTotalAvailable,
      isExceeded: concessionalExcess > 0,
      excessAmount: concessionalExcess,
    },
    nonConcessional: {
      cap: nonConcessionalCap,
      used: input.nonConcessionalYTD,
      remaining: Math.max(0, nonConcessionalRemaining),
      percentageUsed: Math.min(100, (input.nonConcessionalYTD / nonConcessionalTotalAvailable) * 100),
      bringForwardAvailable: bringForward.eligible,
      bringForwardCap: bringForward.totalCap,
      totalAvailable: nonConcessionalTotalAvailable,
      isExceeded: nonConcessionalExcess > 0,
      excessAmount: nonConcessionalExcess,
    },
    excessContributionsTax: Math.round(excessContributionsTax),
    warnings,
    financialYear: currentFY.year,
  };
}

// =============================================================================
// Optimization Functions
// =============================================================================

/**
 * Calculate optimal contribution strategy
 */
export function getOptimalContributionStrategy(
  grossSalary: number,
  currentConcessional: number,
  marginalRate: number,
  totalSuperBalance: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  recommendedSalarySacrifice: number;
  taxSavings: number;
  remainingCap: number;
  explanation: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Calculate current SG
  const estimatedSG = grossSalary * config.superGuaranteeRate;

  // Current concessional usage (if not provided, estimate from SG)
  const usedConcessional = currentConcessional || estimatedSG;

  // Available cap
  const remainingCap = config.concessionalCap - usedConcessional;

  if (remainingCap <= 0) {
    return {
      recommendedSalarySacrifice: 0,
      taxSavings: 0,
      remainingCap: 0,
      explanation: 'Concessional cap already reached. No additional salary sacrifice recommended.',
      warnings: [],
    };
  }

  // Only recommend salary sacrifice if marginal rate > 15% (super tax rate)
  if (marginalRate <= 0.15) {
    return {
      recommendedSalarySacrifice: 0,
      taxSavings: 0,
      remainingCap,
      explanation: 'Marginal tax rate is at or below 15%. Salary sacrifice not beneficial.',
      warnings: [],
    };
  }

  // Check Division 293
  const taxableIncomeAfterSacrifice = grossSalary - remainingCap;
  const combinedWithSuper = taxableIncomeAfterSacrifice + config.concessionalCap;

  if (combinedWithSuper > config.division293Threshold) {
    // Adjust recommendation to stay below Division 293
    const maxToAvoid293 = Math.max(0, config.division293Threshold - grossSalary);
    const adjustedSacrifice = Math.min(remainingCap, maxToAvoid293);

    if (adjustedSacrifice < remainingCap) {
      warnings.push(
        `Full salary sacrifice would trigger Division 293 tax. Consider sacrificing only $${adjustedSacrifice.toLocaleString()} to stay below threshold.`
      );
    }
  }

  // Calculate tax savings
  const taxSavings = remainingCap * (marginalRate - 0.15);

  return {
    recommendedSalarySacrifice: Math.round(remainingCap),
    taxSavings: Math.round(taxSavings),
    remainingCap: Math.round(remainingCap),
    explanation: `Salary sacrifice $${Math.round(remainingCap).toLocaleString()} to maximize super contributions and save $${Math.round(taxSavings).toLocaleString()} in tax.`,
    warnings,
  };
}

/**
 * Get concessional cap for a specific financial year
 */
export function getConcessionalCap(financialYear: string): number {
  return CONCESSIONAL_CAPS[financialYear] || 30000; // Default to latest known
}

/**
 * Get non-concessional cap for a specific financial year
 */
export function getNonConcessionalCap(financialYear: string): number {
  return NON_CONCESSIONAL_CAPS[financialYear] || 120000; // Default to latest known
}
