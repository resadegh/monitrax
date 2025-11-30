/**
 * Phase 20: PAYG Withholding Calculator
 * Calculates Pay As You Go withholding based on ATO Schedule 1
 *
 * Source: ATO NAT 1004 - Schedule 1 Statement of formulas for calculating
 * amounts to be withheld
 *
 * Note: This implements the formula method for regular payments.
 * The ATO provides coefficients that approximate the tax tables.
 */

import { TaxYearConfig, PAYGScale, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

// =============================================================================
// PAYG Coefficients for 2024-25 (Scale 2 - With Tax Free Threshold)
// These coefficients are used in the formula: tax = (a × earnings) - b
// =============================================================================

const PAYG_SCALE_2_2024_25: PAYGScale[] = [
  // Weekly earnings thresholds and coefficients
  { weeklyEarningsMin: 0, weeklyEarningsMax: 361, coefficients: { a: 0, b: 0 } },
  { weeklyEarningsMin: 362, weeklyEarningsMax: 500, coefficients: { a: 0.16, b: 57.8462 } },
  { weeklyEarningsMin: 501, weeklyEarningsMax: 625, coefficients: { a: 0.26, b: 107.8462 } },
  { weeklyEarningsMin: 626, weeklyEarningsMax: 721, coefficients: { a: 0.18, b: 57.8462 } },
  { weeklyEarningsMin: 722, weeklyEarningsMax: 865, coefficients: { a: 0.189, b: 64.3365 } },
  { weeklyEarningsMin: 866, weeklyEarningsMax: 2596, coefficients: { a: 0.3227, b: 180.0385 } },
  { weeklyEarningsMin: 2597, weeklyEarningsMax: 3653, coefficients: { a: 0.37, b: 302.7885 } },
  { weeklyEarningsMin: 3654, weeklyEarningsMax: null, coefficients: { a: 0.45, b: 595.1058 } },
];

// Scale 1 - No Tax Free Threshold
const PAYG_SCALE_1_2024_25: PAYGScale[] = [
  { weeklyEarningsMin: 0, weeklyEarningsMax: 88, coefficients: { a: 0.16, b: 0.16 } },
  { weeklyEarningsMin: 89, weeklyEarningsMax: 371, coefficients: { a: 0.2348, b: 6.5884 } },
  { weeklyEarningsMin: 372, weeklyEarningsMax: 500, coefficients: { a: 0.219, b: 0.719 } },
  { weeklyEarningsMin: 501, weeklyEarningsMax: 625, coefficients: { a: 0.3127, b: 47.6 } },
  { weeklyEarningsMin: 626, weeklyEarningsMax: 721, coefficients: { a: 0.2327, b: 2.6 } },
  { weeklyEarningsMin: 722, weeklyEarningsMax: 865, coefficients: { a: 0.2417, b: 9.0933 } },
  { weeklyEarningsMin: 866, weeklyEarningsMax: 2596, coefficients: { a: 0.3754, b: 124.7654 } },
  { weeklyEarningsMin: 2597, weeklyEarningsMax: 3653, coefficients: { a: 0.4227, b: 247.5154 } },
  { weeklyEarningsMin: 3654, weeklyEarningsMax: null, coefficients: { a: 0.5027, b: 539.8331 } },
];

export interface PAYGResult {
  weeklyWithholding: number;
  fortnightlyWithholding: number;
  monthlyWithholding: number;
  annualWithholding: number;
  calculations: CalculationStep[];
}

export interface PAYGInput {
  grossIncome: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  hasTaxFreeThreshold?: boolean;
  hasHECSDebt?: boolean;
}

/**
 * Convert any payment frequency to weekly equivalent
 */
function toWeeklyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount;
    case 'FORTNIGHTLY':
      return amount / 2;
    case 'MONTHLY':
      return (amount * 12) / 52;
    case 'QUARTERLY':
      return (amount * 4) / 52;
    case 'ANNUALLY':
      return amount / 52;
    default:
      return amount;
  }
}

/**
 * Convert weekly amount to specified frequency
 */
function fromWeeklyAmount(weeklyAmount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return weeklyAmount;
    case 'FORTNIGHTLY':
      return weeklyAmount * 2;
    case 'MONTHLY':
      return (weeklyAmount * 52) / 12;
    case 'QUARTERLY':
      return (weeklyAmount * 52) / 4;
    case 'ANNUALLY':
      return weeklyAmount * 52;
    default:
      return weeklyAmount;
  }
}

/**
 * Calculate PAYG withholding using ATO formula method
 */
export function calculatePAYG(input: PAYGInput): PAYGResult {
  const { grossIncome, frequency, hasTaxFreeThreshold = true, hasHECSDebt = false } = input;
  const calculations: CalculationStep[] = [];

  // Convert to weekly earnings
  const weeklyEarnings = toWeeklyAmount(grossIncome, frequency);

  calculations.push({
    label: `Gross Income (${frequency.toLowerCase()})`,
    value: grossIncome,
  });

  calculations.push({
    label: 'Weekly Equivalent',
    value: Math.round(weeklyEarnings * 100) / 100,
    explanation: frequency !== 'WEEKLY' ? `Converted from ${frequency.toLowerCase()}` : undefined,
  });

  // Select the appropriate scale
  const scale = hasTaxFreeThreshold ? PAYG_SCALE_2_2024_25 : PAYG_SCALE_1_2024_25;

  // Find the applicable coefficient range
  let weeklyWithholding = 0;
  for (const range of scale) {
    const max = range.weeklyEarningsMax ?? Infinity;
    if (weeklyEarnings >= range.weeklyEarningsMin && weeklyEarnings <= max) {
      // Apply formula: tax = (a × earnings) - b
      weeklyWithholding = Math.max(0, range.coefficients.a * weeklyEarnings - range.coefficients.b);

      calculations.push({
        label: 'PAYG Formula',
        value: weeklyWithholding,
        explanation: `(${range.coefficients.a} × $${weeklyEarnings.toFixed(2)}) - $${range.coefficients.b}`,
      });

      break;
    }
  }

  // Round to nearest dollar (as per ATO requirements)
  weeklyWithholding = Math.round(weeklyWithholding);

  // TODO: Add HECS-HELP component if applicable
  if (hasHECSDebt) {
    // HECS rates would be added here
    calculations.push({
      label: 'HECS-HELP',
      value: 0,
      explanation: 'HECS-HELP withholding not yet implemented',
    });
  }

  // Calculate for other frequencies
  const fortnightlyWithholding = Math.round(weeklyWithholding * 2);
  const monthlyWithholding = Math.round((weeklyWithholding * 52) / 12);
  const annualWithholding = weeklyWithholding * 52;

  calculations.push({
    label: 'Weekly PAYG Withholding',
    value: weeklyWithholding,
    operation: '=',
  });

  calculations.push({
    label: 'Annual PAYG Withholding',
    value: annualWithholding,
    explanation: 'Weekly × 52 weeks',
  });

  return {
    weeklyWithholding,
    fortnightlyWithholding,
    monthlyWithholding,
    annualWithholding,
    calculations,
  };
}

/**
 * Reverse calculate gross from net (iterative approach)
 * Given net income, find the gross income that would result in that net
 */
export function calculateGrossFromNet(
  netIncome: number,
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY',
  hasTaxFreeThreshold: boolean = true,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { gross: number; tax: number; iterations: number } {
  // Use binary search / iterative refinement
  let low = netIncome;
  let high = netIncome * 2; // Tax is at most ~45%, so gross is at most ~2x net
  let iterations = 0;
  const maxIterations = 50;
  const tolerance = 0.01;

  while (iterations < maxIterations) {
    const mid = (low + high) / 2;
    const payg = calculatePAYG({
      grossIncome: mid,
      frequency,
      hasTaxFreeThreshold,
    });

    // Calculate what net would be at this gross
    const calculatedNet = mid - fromWeeklyAmount(payg.weeklyWithholding, frequency);

    if (Math.abs(calculatedNet - netIncome) < tolerance) {
      return {
        gross: Math.round(mid * 100) / 100,
        tax: fromWeeklyAmount(payg.weeklyWithholding, frequency),
        iterations,
      };
    }

    if (calculatedNet < netIncome) {
      low = mid;
    } else {
      high = mid;
    }

    iterations++;
  }

  // Return best estimate after max iterations
  const finalGross = (low + high) / 2;
  const finalPayg = calculatePAYG({
    grossIncome: finalGross,
    frequency,
    hasTaxFreeThreshold,
  });

  return {
    gross: Math.round(finalGross * 100) / 100,
    tax: fromWeeklyAmount(finalPayg.weeklyWithholding, frequency),
    iterations,
  };
}

/**
 * Get PAYG withholding for display purposes
 */
export function getPAYGSummary(
  annualGross: number,
  hasTaxFreeThreshold: boolean = true
): {
  annual: number;
  monthly: number;
  fortnightly: number;
  weekly: number;
  effectiveRate: number;
} {
  const payg = calculatePAYG({
    grossIncome: annualGross,
    frequency: 'ANNUALLY',
    hasTaxFreeThreshold,
  });

  return {
    annual: payg.annualWithholding,
    monthly: payg.monthlyWithholding,
    fortnightly: payg.fortnightlyWithholding,
    weekly: payg.weeklyWithholding,
    effectiveRate: annualGross > 0 ? (payg.annualWithholding / annualGross) * 100 : 0,
  };
}
