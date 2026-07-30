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

import { TaxYearConfig, PAYGScale, PAYGScheduleConfig, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// MON-131 T1 (D35 / payg-withholding contract P1): the coefficient tables now
// live IN CONFIG — `TaxYearConfig.paygSchedule` (see `taxYearConfig.ts`,
// PAYG_SCHEDULE_2024_26 + PAYG_SCHEDULE_2026_27). This engine keeps the
// formula mechanics only; it never owns a rate.
//
// Bracket-boundary note (audit MA.1-002, 2026-06-07): the ATO publishes
// the bands as `0 – $361.99`, `$362 – $499.99`, etc. The integer upper
// bounds in config appear narrower than the ATO spec, but the formula is
// continuous across boundaries by construction (a × earnings − b produces
// ≈$0 at each boundary), and the final whole-dollar rounding absorbs the
// cents-level fraction. Do NOT "fix" the boundaries to $X.99.
// =============================================================================

/**
 * Thrown when a caller asks for withholding under a config whose FY has no
 * verified Schedule 1 coefficients. NEVER silently borrow another FY's
 * table (§19.2 — a wrong-FY withholding is a wrong number, not a fallback).
 */
export class PaygScheduleUnavailableError extends Error {
  constructor(financialYear: string) {
    super(
      `PAYG Schedule 1 coefficients are not configured for FY ${financialYear}. ` +
        `Add a verified PAYGScheduleConfig to taxYearConfig.ts (D35) — never borrow another FY's table.`,
    );
    this.name = 'PaygScheduleUnavailableError';
  }
}

/**
 * Resolve the coefficient set for a call.
 *
 * T1-B: the T1-A legacy pin (FY24-26 when no config) is DEAD. No config →
 * the CURRENT FY's schedule (`getCurrentTaxYearConfig()`), matching every
 * other engine's default. A config whose FY has no verified schedule
 * throws — never borrow another FY (D35).
 */
function resolveSchedule(config?: TaxYearConfig): PAYGScheduleConfig {
  const resolved = config ?? getCurrentTaxYearConfig();
  if (!resolved.paygSchedule) throw new PaygScheduleUnavailableError(resolved.financialYear);
  return resolved.paygSchedule;
}

export interface PAYGResult {
  weeklyWithholding: number;
  fortnightlyWithholding: number;
  monthlyWithholding: number;
  annualWithholding: number;
  calculations: CalculationStep[];
}

export interface PAYGInput {
  grossIncome: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY';
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
    case 'HALF_YEARLY':
      return (amount * 2) / 52;
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
    case 'HALF_YEARLY':
      return (weeklyAmount * 52) / 2;
    case 'ANNUALLY':
      return weeklyAmount * 52;
    default:
      return weeklyAmount;
  }
}

/**
 * Calculate PAYG withholding using ATO formula method.
 *
 * `config` (MON-131 T1 / D35): selects the FY's Schedule 1 coefficients from
 * `config.paygSchedule`. Omitted → LEGACY 2024-26 schedule (pre-T1 behaviour,
 * preserved for baseline stability; removed at the T1-B flip). A config
 * without a schedule throws `PaygScheduleUnavailableError`.
 */
export function calculatePAYG(input: PAYGInput, config?: TaxYearConfig): PAYGResult {
  const { grossIncome, frequency, hasTaxFreeThreshold = true, hasHECSDebt = false } = input;
  const schedule = resolveSchedule(config);
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

  // Select the appropriate scale from the FY's configured schedule (D35).
  const scale = hasTaxFreeThreshold ? schedule.scale2 : schedule.scale1;

  // ATO Schedule 1 §4: x = (whole dollars of weekly earnings) + 0.99.
  // Audit MA.1-005 (2026-06-07): see file header for the literal ATO formula.
  // MON-138 (T1-B, declared): band selection uses floor(weeklyEarnings) —
  // the ATO's whole-dollar x-semantics. The old raw-earnings test against
  // integer bounds left every fractional value in a 1-dollar gap (e.g.
  // weekly $500.50 between max 500 and min 501) matching NO band → $0
  // withheld vs the ATO's $22. Floor-based selection is gap-free.
  const wholeDollars = Math.floor(weeklyEarnings);
  const xWhole = wholeDollars + 0.99;

  // Find the applicable coefficient range
  let weeklyWithholding = 0;
  for (const range of scale) {
    const max = range.weeklyEarningsMax ?? Infinity;
    if (wholeDollars >= range.weeklyEarningsMin && wholeDollars <= max) {
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
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY',
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
    // T1-B: the dead `config` param is LIVE — safe now because every leg of
    // every composer resolves to the SAME config (the T1-A mixed-FY hazard
    // is gone with the legacy pin).
    const payg = calculatePAYG({
      grossIncome: mid,
      frequency,
      hasTaxFreeThreshold,
    }, config);

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
  }, config);

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
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY';
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
    case 'HALF_YEARLY':
      return amount.times(2).div(52);
    case 'ANNUALLY':
      return amount.div(52);
    default:
      return amount;
  }
}

export function calculatePAYGDecimal(input: PAYGInputDecimal, config?: TaxYearConfig): PAYGResultDecimal {
  const { grossIncome, frequency, hasTaxFreeThreshold = true } = input;
  const grossDec = toDecimal(grossIncome) ?? new Decimal(0);

  const weeklyEarnings = toWeeklyAmountDecimal(grossDec, frequency);
  const weeklyEarningsNumber = weeklyEarnings.toNumber();

  // Same schedule resolution as the Float path (D35; legacy default dies at T1-B).
  const schedule = resolveSchedule(config);
  const scale = hasTaxFreeThreshold ? schedule.scale2 : schedule.scale1;

  // ATO Schedule 1 §4: x = (whole dollars of weekly earnings) + 0.99.
  // MON-138 (T1-B): floor-based band selection — see the Float path comment.
  const wholeDollars = Math.floor(weeklyEarningsNumber);
  const xWholeDec = weeklyEarnings.floor().plus('0.99');

  let weeklyWithholding = new Decimal(0);
  for (const range of scale) {
    const max = range.weeklyEarningsMax ?? Infinity;
    if (wholeDollars >= range.weeklyEarningsMin && wholeDollars <= max) {
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
  hasTaxFreeThreshold: boolean = true,
  config?: TaxYearConfig
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
  }, config);

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
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY',
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
      case 'HALF_YEARLY':
        return weekly.times(52).div(2);
      case 'ANNUALLY':
        return weekly.times(52);
    }
  };

  while (iterations < maxIterations) {
    const mid = low.plus(high).div(2);
    const payg = calculatePAYGDecimal({ grossIncome: mid, frequency, hasTaxFreeThreshold }, config);
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
  const finalPayg = calculatePAYGDecimal({ grossIncome: finalGross, frequency, hasTaxFreeThreshold }, config);
  return {
    gross: finalGross.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN),
    tax: fromWeeklyDecimal(finalPayg.weeklyWithholding),
    iterations,
  };
}
