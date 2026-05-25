/**
 * Phase 46 — /wealth-check calculator.
 *
 * Pure function — no I/O, deterministic, fully testable from inputs.
 *
 * See `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md` §4 for the canonical
 * algorithm description. This file IS the implementation referenced there.
 *
 * Assumptions are surfaced in the returned result so the result page can show
 * them in the assumptions panel (CLAUDE.md §0 financial-adviser lens —
 * traceable, honest, no false-precision numbers).
 */

import {
  ABS_NET_WORTH_BY_AGE_PERCENTILES,
  APRA_LONG_TERM_SUPER_RETURNS,
  ASFA_COMFORTABLE_LUMP_SUM,
  ATO_MEDIAN_SUPER_BY_AGE,
  COUPLE_INCOME_THRESHOLD,
  NON_SUPER_NW_FLOOR,
  SG_RATE_FROM_2026_07,
} from '@/lib/marketing/benchmarks';
import type {
  AgeBand,
  HouseholdShape,
  NetWorthBand,
  WealthCheckInput,
  WealthCheckResult,
} from './types';

const RETIREMENT_AGE = 67;

// Midpoints used for the net-worth bands. Open-ended bands ($2m+) use a
// conservative midpoint rather than infinity.
const NET_WORTH_BAND_MIDPOINTS: Record<NetWorthBand, number> = {
  'under-50k': 25_000,
  '50k-200k': 125_000,
  '200k-500k': 350_000,
  '500k-1m': 750_000,
  '1m-2m': 1_500_000,
  '2m-plus': 3_000_000,
};

function bucketAge(age: number): AgeBand {
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

/**
 * HILDA/ABS HES-pattern savings rates by income band. Approximations —
 * not used for in-app calc (which reads real cashflow); only for the
 * anonymous 3-input estimator.
 */
function estimatedSavingsRate(householdIncome: number): number {
  if (householdIncome < 80_000) return 0.04;
  if (householdIncome < 150_000) return 0.08;
  if (householdIncome < 250_000) return 0.12;
  return 0.15;
}

/**
 * Compound a stream of equal annual contributions over `years` at `rate`.
 * Future value of an annuity: FV = pmt × ((1+r)^n − 1) / r
 */
function futureValueOfAnnuity(pmt: number, rate: number, years: number): number {
  if (years <= 0) return 0;
  if (rate === 0) return pmt * years;
  return pmt * (Math.pow(1 + rate, years) - 1) / rate;
}

/**
 * Linear-interpolate a percentile rank given the band's p25/p50/p75/p90 anchors.
 * Falls back to clamping at 5 / 95 for values outside the p25–p90 range.
 */
function estimatePercentile(
  netWorth: number,
  band: typeof ABS_NET_WORTH_BY_AGE_PERCENTILES[AgeBand],
): number {
  const { p25, p50, p75, p90 } = band;
  if (netWorth <= p25) {
    // Linear interpolate between p5 estimate (half of p25) and p25
    const p5 = p25 * 0.4;
    if (netWorth <= p5) return 5;
    return 5 + 20 * (netWorth - p5) / (p25 - p5);
  }
  if (netWorth <= p50) return 25 + 25 * (netWorth - p25) / (p50 - p25);
  if (netWorth <= p75) return 50 + 25 * (netWorth - p50) / (p75 - p50);
  if (netWorth <= p90) return 75 + 15 * (netWorth - p75) / (p90 - p75);
  // Above p90 — extrapolate to 95+ cap
  const p99Estimate = p90 * 3;
  if (netWorth >= p99Estimate) return 95;
  return 90 + 5 * (netWorth - p90) / (p99Estimate - p90);
}

export function calculateWealthCheckResult(
  input: WealthCheckInput,
): WealthCheckResult {
  const { age, householdIncome, netWorthBand } = input;

  // Step 1: years to retirement
  const yearsToRetirement = Math.max(0, RETIREMENT_AGE - age);

  // Step 2: age band
  const ageBand = bucketAge(age);

  // Step 3: household shape heuristic (see PHASE_46 §3)
  const householdShape: HouseholdShape =
    householdIncome >= COUPLE_INCOME_THRESHOLD ? 'couple' : 'single';

  // Step 4: current net worth midpoint
  const currentNetWorth = NET_WORTH_BAND_MIDPOINTS[netWorthBand];

  // Step 5: current super estimate — ATO median by age, clamped to leave at
  // least NON_SUPER_NW_FLOOR of non-super NW so the calc doesn't return
  // nonsense negative non-super for under-saving young users.
  const superCeiling = Math.max(0, currentNetWorth - NON_SUPER_NW_FLOOR);
  const currentSuperEstimate = Math.min(
    ATO_MEDIAN_SUPER_BY_AGE[ageBand],
    superCeiling,
  );

  // Step 6: non-super NW today
  const nonSuperCurrentNW = currentNetWorth - currentSuperEstimate;

  // Step 7: project super to 67
  const realReturnRate = APRA_LONG_TERM_SUPER_RETURNS.balanced_real;
  const sgRate = SG_RATE_FROM_2026_07;
  // Couple: assume 60/40 income split so only ~60% of household income
  // generates the SG; single uses 100%.
  const earnerSplit = householdShape === 'couple' ? 0.6 : 1.0;
  const annualEmployerSG = householdIncome * sgRate * earnerSplit;

  const projectedSuperAt67 =
    currentSuperEstimate * Math.pow(1 + realReturnRate, yearsToRetirement)
    + futureValueOfAnnuity(annualEmployerSG, realReturnRate, yearsToRetirement);

  // Step 8: project non-super to 67
  const savingsRate = estimatedSavingsRate(householdIncome);
  const annualVoluntarySavings = householdIncome * savingsRate * earnerSplit;

  const projectedNonSuperAt67 =
    nonSuperCurrentNW * Math.pow(1 + realReturnRate, yearsToRetirement)
    + futureValueOfAnnuity(annualVoluntarySavings, realReturnRate, yearsToRetirement);

  // Step 9: total projection
  const projectedTotalAt67 = projectedSuperAt67 + projectedNonSuperAt67;

  // Step 10: targets — ASFA comfortable (baseline) + lifestyle-maintenance (real target)
  const asfaTarget = ASFA_COMFORTABLE_LUMP_SUM[householdShape];
  // 70% income-replacement × 25 (4% safe withdrawal rate). The wealth-builder
  // anchor — what it actually takes to maintain something close to current
  // lifestyle through retirement. Meaningfully higher than ASFA for most users.
  const lifestyleTarget = Math.round(householdIncome * 0.7 * 25 / 1000) * 1000;

  // Step 11: gap against the LIFESTYLE target (the meaningful one for the
  // wealth-builder ICP). ASFA is shown as context, not as the gap anchor.
  const gap = Math.max(0, lifestyleTarget - projectedTotalAt67);
  const beatsAsfaTarget = projectedTotalAt67 >= asfaTarget;

  // Step 12: percentile lookup
  const percentile = Math.round(
    estimatePercentile(currentNetWorth, ABS_NET_WORTH_BY_AGE_PERCENTILES[ageBand]),
  );

  return {
    input,
    ageBand,
    householdShape,
    yearsToRetirement,
    currentNetWorthMidpoint: currentNetWorth,
    currentSuperEstimate,
    projectedSuperAt67,
    projectedNonSuperAt67,
    projectedTotalAt67,
    asfaTarget,
    lifestyleTarget,
    gap,
    beatsAsfaTarget,
    percentile,
    assumptions: {
      realReturnRate,
      sgRate,
      estimatedSavingsRate: savingsRate,
      asfaTargetSource: 'ASFA Retirement Standard',
      asfaTargetDate: '2026 Q2',
    },
  };
}
