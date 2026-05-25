/**
 * Phase 46 — Lever selector for the /wealth-check result page.
 *
 * Given a WealthCheckResult, returns ONE named lever — branched by age band
 * per the architecture choice in PHASE_46 §7.
 *
 * AFSL discipline (load-bearing — see PHASE_46 §9):
 *   - Names a MECHANISM (salary-sacrifice, catch-up contributions, offset).
 *     NEVER names a product (a specific fund, a specific bank).
 *   - Frames as INFORMATION ("$X/month would close $Y of the gap").
 *     NEVER as advice ("you should do X").
 *   - The catch-up branch explicitly defers ("speak to your accountant").
 *
 * Behaviour-psychologist discipline (Klontz 2011 avoidance):
 *   - If gap > projected × KLONTZ_AVOIDANCE_GAP_RATIO, lever framing softens.
 *   - If gap is 0, lever switches to a consolidation frame.
 */

import {
  APRA_LONG_TERM_SUPER_RETURNS,
  CATCH_UP_TSB_THRESHOLD,
  CONCESSIONAL_CAP_ANNUAL,
  KLONTZ_AVOIDANCE_GAP_RATIO,
  SG_RATE_FROM_2026_07,
} from '@/lib/marketing/benchmarks';
import type { LeverRecommendation, WealthCheckResult } from './types';

/**
 * FV of monthly contributions compounded annually (simplified — treats the
 * monthly stream as a single annual contribution at year-end for the calc,
 * with a small headwind. Same shape as the calculator's annuity FV.)
 */
function futureValueMonthlyAnnuity(
  monthlyPmt: number,
  annualRate: number,
  years: number,
): number {
  if (years <= 0) return 0;
  const annual = monthlyPmt * 12;
  if (annualRate === 0) return annual * years;
  return annual * (Math.pow(1 + annualRate, years) - 1) / annualRate;
}

/**
 * Format an AUD amount to a friendly short string ($X / $Xk / $X.Xm).
 */
function formatShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

export function selectLever(result: WealthCheckResult): LeverRecommendation {
  const {
    input: { age, householdIncome },
    gap,
    projectedTotalAt67,
    yearsToRetirement,
    currentSuperEstimate,
    householdShape,
  } = result;

  const realReturn = APRA_LONG_TERM_SUPER_RETURNS.balanced_real;
  const softFraming = gap > projectedTotalAt67 * KLONTZ_AVOIDANCE_GAP_RATIO;

  // ────────────────────────────────────────────────────────────────────
  // Branch 0: gap is already zero or negative — switch to consolidation frame
  // ────────────────────────────────────────────────────────────────────
  if (gap <= 0) {
    return {
      kind: 'already-on-track',
      title: 'The standard targets are in the bag — set your own',
      monthlyAmount: 0,
      gapCloseEstimate: 0,
      body:
        'When you\'re past both ASFA comfortable AND 70%-income-replacement, the standard benchmarks stop being useful. The interesting questions get specific: retire 10 years early? leave $2m to each kid? buy the holiday house outright? scale property to 5 doors? Monitrax tracks your progress toward whichever number YOU pick — and shows you the levers (super top-ups, debt recycling, structure changes, tax-efficient withdrawal sequencing) that move it fastest from where you are.',
      softFraming: false,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Branch 1: 25–39 → salary-sacrifice to super (long compounding runway)
  // ────────────────────────────────────────────────────────────────────
  if (age < 40) {
    // Calculate available concessional headroom: cap minus employer SG
    const earnerSplit = householdShape === 'couple' ? 0.6 : 1.0;
    const annualEmployerSG = householdIncome * SG_RATE_FROM_2026_07 * earnerSplit;
    const headroomAnnual = Math.max(0, CONCESSIONAL_CAP_ANNUAL - annualEmployerSG);

    // Cap the lever at 1/3 of headroom OR ~$500/mo, whichever is lower
    // (don't suggest a sacrifice level so high it would be unrealistic)
    const maxMonthly = Math.min(headroomAnnual / 3 / 12, 500);
    const monthlyAmount = Math.max(100, Math.round(maxMonthly / 50) * 50);

    const gapCloseEstimate = Math.min(
      gap,
      futureValueMonthlyAnnuity(monthlyAmount, realReturn, yearsToRetirement),
    );

    // Frame the "$X/month is about Y" anchor
    const anchor =
      monthlyAmount <= 200
        ? 'about a coffee a day'
        : monthlyAmount <= 350
          ? 'about a dinner-out a week'
          : 'a daily flat-white-and-a-half';

    return {
      kind: 'salary-sacrifice-young',
      title: `Salary-sacrifice ${formatShort(monthlyAmount)}/month into super`,
      monthlyAmount,
      gapCloseEstimate,
      body:
        `Salary-sacrificing an extra ${formatShort(monthlyAmount)}/month — ${anchor} — between now and 67 closes around ${formatShort(gapCloseEstimate)} of the gap. With ${yearsToRetirement} years of compounding ahead of you, time does the heavy lifting; the concessional tax rate inside super makes it more efficient than the same amount saved post-tax. Most employers can set this up in payroll — your accountant can walk you through it.`,
      softFraming,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Branch 2: 40–54 → super top-up + debt paydown
  // ────────────────────────────────────────────────────────────────────
  if (age < 55) {
    // Slightly higher monthly amount given middle-age earnings power
    const superMonthly = 400;
    const debtMonthly = 1_000;
    const totalMonthly = superMonthly + debtMonthly;

    const superGapClose = futureValueMonthlyAnnuity(
      superMonthly,
      realReturn,
      yearsToRetirement,
    );
    // Debt paydown effect — modelled as freed-up cashflow that compounds at the real return
    // (this is an approximation — real offset/debt math depends on the user's loan rate).
    const debtEffect = futureValueMonthlyAnnuity(
      debtMonthly * 0.4, // assume only ~40% of debt paydown is net new (rest replaces interest)
      realReturn,
      yearsToRetirement,
    );
    const gapCloseEstimate = Math.min(gap, superGapClose + debtEffect);

    return {
      kind: 'super-and-debt-mid',
      title: `Top up super by ${formatShort(superMonthly)}/mo + add ${formatShort(debtMonthly)}/mo to debt`,
      monthlyAmount: totalMonthly,
      gapCloseEstimate,
      body:
        `Two levers compound here: topping up super by ${formatShort(superMonthly)}/month builds the lump sum at the concessional rate, while putting an extra ${formatShort(debtMonthly)}/month against your highest-rate debt (offset, mortgage, or credit) cuts interest now and frees future cashflow. Together over ${yearsToRetirement} years they close roughly ${formatShort(gapCloseEstimate)} of the gap. The split depends on your specific debt rates — Monitrax shows you which side wins per dollar.`,
      softFraming,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Branch 3: 55+ → catch-up contributions (5y unused-cap rule) + TTR
  // ────────────────────────────────────────────────────────────────────

  // The s292-85 catch-up rule applies only if the user's Total Super Balance
  // is below $500k as at 30 June of the prior FY. Most users at this age
  // band with sub-$500k super (per the calc's current super estimate) can use it.
  const eligibleForCatchUp = currentSuperEstimate < CATCH_UP_TSB_THRESHOLD;

  if (eligibleForCatchUp) {
    // Conservative: assume 2 years of unused cap available (most people who
    // qualify haven't been maxing out; some will have 5 years available)
    const catchUpThisYear = CONCESSIONAL_CAP_ANNUAL; // ~$30k contribution
    const gapCloseEstimate = Math.min(
      gap,
      catchUpThisYear * Math.pow(1 + realReturn, Math.max(1, yearsToRetirement)),
    );

    return {
      kind: 'catch-up-late',
      title: `Catch-up super contribution — up to ${formatShort(catchUpThisYear)} this FY`,
      monthlyAmount: 0, // it's a one-off, not a monthly drip
      gapCloseEstimate,
      body:
        `If you have unused concessional cap from the past 5 years (most people under ${formatShort(CATCH_UP_TSB_THRESHOLD)} of super do), you can catch up — adding up to ${formatShort(catchUpThisYear)} in a single financial year at the concessional tax rate. Even with ${yearsToRetirement} years of compounding left, that single contribution alone closes around ${formatShort(gapCloseEstimate)} of the gap. The carry-forward rule (Section 292-85) is the most underused lever for this stage of life — speak to your accountant about activating it.`,
      softFraming,
    };
  }

  // 55+ with super already above the catch-up threshold — different framing
  return {
    kind: 'catch-up-late',
    title: 'Maximise concessional contributions + consider TTR',
    monthlyAmount: 0,
    gapCloseEstimate: 0,
    body:
      `At your stage with super above ${formatShort(CATCH_UP_TSB_THRESHOLD)}, the catch-up rule doesn't apply — but maxing the standard ${formatShort(CONCESSIONAL_CAP_ANNUAL)}/year concessional cap, considering a Transition To Retirement strategy, and reviewing your investment-option mix are the highest-leverage moves. The specifics depend on your structure — speak to your accountant or financial adviser. Monitrax shows you the maths per option.`,
    softFraming,
  };
}
