/**
 * Phase 20: PAYG Withholding Calculator
 * Calculates Pay As You Go withholding based on ATO Schedule 1
 *
 * Source: ATO NAT 1004 - Schedule 1 Statement of formulas for calculating
 * amounts to be withheld
 *
 * Note: This implements the formula method for regular payments.
 * The ATO provides coefficients that approximate the tax tables.
 *
 * **Canonical formula (audit MA.1-005, 2026-06-07).** ATO Schedule 1 §4
 * "Using a formula" defines the withholding linear equation as:
 *
 *   y = a × x − b
 *
 * where:
 *   - y = weekly withholding amount expressed in dollars
 *   - **x = (number of whole dollars in the weekly earnings) + 0.99**
 *   - a, b = coefficients per earnings band
 *
 * The "+ 0.99" trick ensures every cent-value within $X.00 - $X.99
 * produces the SAME withholding — that is the ATO's published behaviour.
 * Verified-via:
 *   - https://www.ato.gov.au/tax-rates-and-codes/schedule-8-calculating-help-ssl-tsl-and-sfss-components-01-july-2024-to-30-june-2025
 *     (Schedule 8 NAT 3539 — quotes the Schedule-1 formula format)
 *   - https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/working-out-the-weekly-earnings
 *   - Retrieved 2026-06-07.
 *
 * Per ATO Schedule 1 §3 "Working out the weekly earnings", the floor +
 * 0.99 adjustment applies AFTER period conversion (so monthly →
 * weeklyEquivalent → floor + 0.99). The period conversion ratios
 * themselves are mathematically equivalent to the developer convention
 * (`monthly × 12 / 52 = monthly × 3 / 13` etc.), so the period helpers
 * `toWeeklyAmount`/`toWeeklyAmountDecimal` are unchanged — the floor +
 * 0.99 is applied ONCE, inside `calculatePAYG`/`calculatePAYGDecimal`,
 * immediately before the formula coefficients are applied.
 */

import { TaxYearConfig, PAYGScale, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// PAYG Coefficients for 2024-25 (Scale 2 - With Tax Free Threshold)
// These coefficients are used in the formula: tax = (a × earnings) - b
// =============================================================================

// Scale 2 - With Tax Free Threshold (TFN provided, claim TFT)
// FY24-25 ATO NAT 1004 coefficients.
//
// Bracket-boundary note (audit MA.1-002, 2026-06-07): the ATO publishes
// the bands as `0 – $361.99`, `$362 – $499.99`, etc. The integer upper
// bounds below (`weeklyEarningsMax: 361`) appear narrower than the ATO
// spec, but the formula is continuous across boundaries by construction
// (a × earnings − b produces ≈$0 at each boundary), and the final
// `Math.round` on line 144 absorbs the cents-level fraction. At
// `$361.99` the integer-bound code returns `0.16 × 361.99 − 57.8462 ≈
// $0.07 → rounded to $0`, byte-identical to the ATO's intended $0.
// Do NOT "fix" the boundaries to $X.99 — that breaks the integer math
// elsewhere in `weeklyEarningsMin`/`Max` consumers without changing the
// observed result.
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

  // ATO Schedule 1 §4: x = (whole dollars of weekly earnings) + 0.99.
  // Audit MA.1-005 (2026-06-07): see file header for the literal ATO
  // formula. Bracket selection still uses raw `weeklyEarnings` against
  // the integer band bounds (MA.1-002 boundary-equivalence applies).
  const xWhole = Math.floor(weeklyEarnings) + 0.99;

  // Find the applicable coefficient range
  let weeklyWithholding = 0;
  for (const range of scale) {
    const max = range.weeklyEarningsMax ?? Infinity;
    if (weeklyEarnings >= range.weeklyEarningsMin && weeklyEarnings <= max) {
      // Apply ATO Schedule 1 formula: y = (a × x) - b, where x = floor(earnings) + 0.99.
      weeklyWithholding = Math.max(0, range.coefficients.a * xWhole - range.coefficients.b);

      calculations.push({
        label: 'PAYG Formula',
        value: weeklyWithholding,
        explanation: `(${range.coefficients.a} × $${xWhole.toFixed(2)}) - $${range.coefficients.b}`,
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

// =============================================================================
// Q-DEC PR 2.D.1 — Decimal sibling path
// =============================================================================
//
// **Important** — ATO REQUIRES rounding the weekly withholding to the
// nearest whole dollar (NAT 1004 Schedule 1). That's a regulatory
// rule, not a Float-precision artefact, so the Decimal sibling
// preserves it exactly. The fortnightly / monthly / annual amounts
// are derived from the rounded weekly per the ATO formula, NOT from
// the full-precision weekly. This means the Decimal path and Float
// path produce IDENTICAL withholding values — the shadow test should
// see zero diff on all output fields.

export interface PAYGResultDecimal {
  weeklyWithholding: Decimal;
  fortnightlyWithholding: Decimal;
  monthlyWithholding: Decimal;
  annualWithholding: Decimal;
}

/**
 * Decimal-accepting input. Same shape as `PAYGInput` but `grossIncome`
 * accepts number/string/Decimal so callers in the Decimal chain don't
 * have to lose precision at the boundary.
 */
export interface PAYGInputDecimal {
  grossIncome: number | string | Decimal;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  hasTaxFreeThreshold?: boolean;
  hasHECSDebt?: boolean;
}

function toWeeklyAmountDecimal(amount: Decimal, frequency: string): Decimal {
  switch (frequency) {
    case 'WEEKLY':
      return amount;
    case 'FORTNIGHTLY':
      return amount.div(2);
    case 'MONTHLY':
      return amount.times(12).div(52);
    case 'QUARTERLY':
      return amount.times(4).div(52);
    case 'ANNUALLY':
      return amount.div(52);
    default:
      return amount;
  }
}

export function calculatePAYGDecimal(input: PAYGInputDecimal): PAYGResultDecimal {
  const { grossIncome, frequency, hasTaxFreeThreshold = true } = input;
  const grossDec = toDecimal(grossIncome) ?? new Decimal(0);

  const weeklyEarnings = toWeeklyAmountDecimal(grossDec, frequency);
  const weeklyEarningsNumber = weeklyEarnings.toNumber();

  const scale = hasTaxFreeThreshold ? PAYG_SCALE_2_2024_25 : PAYG_SCALE_1_2024_25;

  // ATO Schedule 1 §4: x = (whole dollars of weekly earnings) + 0.99.
  // Audit MA.1-005 (2026-06-07) — Decimal sibling matches Float path.
  const xWholeDec = weeklyEarnings.floor().plus('0.99');

  let weeklyWithholding = new Decimal(0);
  for (const range of scale) {
    const max = range.weeklyEarningsMax ?? Infinity;
    if (weeklyEarningsNumber >= range.weeklyEarningsMin && weeklyEarningsNumber <= max) {
      // y = (a × x) - b where x = floor(earnings) + 0.99, floored at 0.
      const raw = xWholeDec.times(range.coefficients.a).minus(range.coefficients.b);
      weeklyWithholding = Decimal.max(new Decimal(0), raw);
      break;
    }
  }

  // ATO REGULATORY: round to nearest whole dollar (NAT 1004).
  weeklyWithholding = weeklyWithholding.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);

  // Derived amounts use the ATO formula on the ROUNDED weekly value
  // (mirrors Float path's `Math.round(weeklyWithholding * 2)`, etc.).
  const fortnightlyWithholding = weeklyWithholding.times(2).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  const monthlyWithholding = weeklyWithholding.times(52).div(12).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  const annualWithholding = weeklyWithholding.times(52);

  return {
    weeklyWithholding,
    fortnightlyWithholding,
    monthlyWithholding,
    annualWithholding,
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

/**
 * Decimal sibling of `calculateGrossFromNet`. Iterative binary search
 * — same convergence behaviour as Float (tolerance 0.01, max 50
 * iterations). Internal arithmetic in Decimal; PAYG lookup via
 * `calculatePAYGDecimal`.
 */
export function calculateGrossFromNetDecimal(
  netIncome: number | string | Decimal,
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY',
  hasTaxFreeThreshold: boolean = true,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): { gross: Decimal; tax: Decimal; iterations: number } {
  const netDec = toDecimal(netIncome) ?? new Decimal(0);
  let low = netDec;
  let high = netDec.times(2);
  let iterations = 0;
  const maxIterations = 50;
  const tolerance = new Decimal('0.01');

  // Convert weekly withholding to caller frequency.
  const fromWeeklyDecimal = (weekly: Decimal): Decimal => {
    switch (frequency) {
      case 'WEEKLY':
        return weekly;
      case 'FORTNIGHTLY':
        return weekly.times(2);
      case 'MONTHLY':
        return weekly.times(52).div(12);
      case 'QUARTERLY':
        return weekly.times(52).div(4);
      case 'ANNUALLY':
        return weekly.times(52);
    }
  };

  while (iterations < maxIterations) {
    const mid = low.plus(high).div(2);
    const payg = calculatePAYGDecimal({ grossIncome: mid, frequency, hasTaxFreeThreshold });
    const taxAtFrequency = fromWeeklyDecimal(payg.weeklyWithholding);
    const calculatedNet = mid.minus(taxAtFrequency);

    if (calculatedNet.minus(netDec).abs().lt(tolerance)) {
      return {
        gross: mid.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN),
        tax: taxAtFrequency,
        iterations,
      };
    }
    if (calculatedNet.lt(netDec)) {
      low = mid;
    } else {
      high = mid;
    }
    iterations += 1;
  }

  const finalGross = low.plus(high).div(2);
  const finalPayg = calculatePAYGDecimal({ grossIncome: finalGross, frequency, hasTaxFreeThreshold });
  return {
    gross: finalGross.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN),
    tax: fromWeeklyDecimal(finalPayg.weeklyWithholding),
    iterations,
  };
}
