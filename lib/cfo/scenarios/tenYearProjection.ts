/**
 * Phase 45 PR 1 — 10-year trajectory composer.
 *
 * Pure function. Composes per-year cashflow + super growth + asset growth
 * into a deterministic 10-year (default) projection alongside a scenario's
 * year-1 impact. Inputs come from the scenario's Decimal result; outputs
 * feed the UI chart in PR 2.
 *
 * Per PHASE_45_WHAT_IF_SCENARIOS.md §4 + §7 + §8 — ZERO new calc engines.
 * The arithmetic is simple compounding by year. AFSL discipline (Q-HOOK-AFSL):
 * the projection is NEVER a forecast — copy MUST say "if your assumptions
 * hold, this trajectory would land at" not "you will have $X." The
 * `assumptions` array surfaces every constant the projection used so the
 * UI can render the assumptions panel collapsed-by-default.
 *
 * The model is intentionally simple for PR 1: a per-year scalar compound.
 * Calling the full `cashflowOrchestrator` + `masterTaxPosition` per year
 * (as §7's call graph nominally suggests) re-runs the entire tax engine
 * 10 times — gold-plating for v1. PR 2 may revisit if user feedback
 * requires more sophisticated mid-horizon tax modelling (e.g. crossing the
 * Stage 3 bracket boundary, or commencement of Phase 41E reform measures).
 *
 * Defaults:
 *   - assetGrowthRate = 0.04 (4% real return on non-super assets, conservative)
 *   - superGrowthRate = 0.06 (6% real net-of-fees; aligned with industry default
 *     used by ASIC MoneySmart super calculator FY24-25)
 *   - cashflowGrowthRate = 0.025 (2.5% wage indexation, mid of recent CPI)
 *   - years = 10
 */

import { Decimal, toDecimal } from '@/lib/decimal';
import type {
  TenYearProjectionParams,
  TenYearProjectionPoint,
  TenYearProjectionResult,
} from './types';

const DEFAULT_ASSET_GROWTH = 0.04;
const DEFAULT_SUPER_GROWTH = 0.06;
const DEFAULT_CASHFLOW_GROWTH = 0.025;
const DEFAULT_YEARS = 10;

export function tenYearProjection(
  params: TenYearProjectionParams,
): TenYearProjectionResult {
  const years = Math.max(1, params.years ?? DEFAULT_YEARS);
  const assetGrowthRate = params.assetGrowthRate ?? DEFAULT_ASSET_GROWTH;
  const superGrowthRate = params.superGrowthRate ?? DEFAULT_SUPER_GROWTH;
  const cashflowGrowthRate = params.cashflowGrowthRate ?? DEFAULT_CASHFLOW_GROWTH;

  const baseNetWorth = params.baseNetWorth;
  const yearOneCashflowDelta = params.yearOneCashflowDelta;
  const yearOneTaxDelta = params.yearOneTaxDelta;
  const baseSuperBalance = params.baseSuperBalance ?? new Decimal(0);
  const annualSuperContribution = params.annualSuperContribution ?? new Decimal(0);

  const assetGrowthFactor = new Decimal(1).plus(assetGrowthRate);
  const superGrowthFactor = new Decimal(1).plus(superGrowthRate);
  const cashflowGrowthFactor = new Decimal(1).plus(cashflowGrowthRate);

  // Non-super assets baseline = baseNetWorth − baseSuperBalance. We grow
  // these at the asset growth rate; the super piece grows separately.
  let nonSuperAssets = baseNetWorth.minus(baseSuperBalance);
  let superBalance = baseSuperBalance;
  let cumulativeCashflowDelta = new Decimal(0);
  let cumulativeTaxDelta = new Decimal(0);
  let currentCashflowDelta = yearOneCashflowDelta;
  const currentTaxDelta = yearOneTaxDelta; // held constant — FY moves but tax brackets are stable in real terms

  const trajectory: TenYearProjectionPoint[] = [
    {
      year: 0,
      netWorth: nonSuperAssets.plus(superBalance),
      cumulativeCashflowDelta: new Decimal(0),
      cumulativeTaxDelta: new Decimal(0),
      superBalance,
    },
  ];

  for (let y = 1; y <= years; y++) {
    // Grow non-super assets by the asset growth rate (real return).
    nonSuperAssets = nonSuperAssets.times(assetGrowthFactor);
    // Grow super by the super growth rate + this year's contribution.
    superBalance = superBalance.times(superGrowthFactor).plus(annualSuperContribution);

    // Apply this year's cashflow delta as a contribution to non-super assets
    // (positive cashflow = added savings; negative = drawn down). Tax delta is
    // already netted into the cashflow delta for scenarios that touch tax;
    // for scenarios where they're separate (e.g. a CGT event in year N), the
    // taxDelta represents an extra non-cashflow cost.
    nonSuperAssets = nonSuperAssets.plus(currentCashflowDelta).minus(currentTaxDelta);

    cumulativeCashflowDelta = cumulativeCashflowDelta.plus(currentCashflowDelta);
    cumulativeTaxDelta = cumulativeTaxDelta.plus(currentTaxDelta);

    trajectory.push({
      year: y,
      netWorth: nonSuperAssets.plus(superBalance),
      cumulativeCashflowDelta,
      cumulativeTaxDelta,
      superBalance,
    });

    // Wage-index next year's cashflow delta (assumes the user's
    // sacrifice/extra-repayment scales with their pay).
    currentCashflowDelta = currentCashflowDelta.times(cashflowGrowthFactor);
  }

  const finalNetWorth = trajectory[trajectory.length - 1].netWorth;
  const totalDelta = finalNetWorth.minus(baseNetWorth);

  const assumptions: string[] = [
    `Projection over ${years} years. Numbers are in today's dollars (real terms).`,
    `Non-super assets grow at ${(assetGrowthRate * 100).toFixed(1)}% real / year (conservative; ASIC MoneySmart-style assumption).`,
    `Super grows at ${(superGrowthRate * 100).toFixed(1)}% real net-of-fees / year (FY24-25 industry default).`,
    `Cashflow delta wage-indexes at ${(cashflowGrowthRate * 100).toFixed(1)}% / year (mid of recent CPI).`,
    `Year-1 cashflow delta applied annually with wage indexation; tax delta held constant in real terms.`,
    `This is a projection, not a forecast. It does NOT model rate changes, bracket changes, market drawdowns, or job loss. Use it as a directional guide, not a target.`,
  ];

  return {
    baseNetWorth,
    trajectory,
    finalNetWorth,
    totalDelta,
    assumptions,
  };
}

/**
 * Convenience helper: convert a `ScenarioResultDecimal` + snapshot into the
 * inputs `tenYearProjection` needs. PR 2's UI calls this to chain the
 * scenario → projection pipeline cleanly.
 */
export function projectScenarioForward(
  baseNetWorth: number | Decimal,
  yearOneCashflowDelta: number | Decimal,
  yearOneTaxDelta: number | Decimal,
  opts: {
    baseSuperBalance?: number | Decimal;
    annualSuperContribution?: number | Decimal;
    years?: number;
  } = {},
): TenYearProjectionResult {
  return tenYearProjection({
    baseNetWorth: toDecimal(baseNetWorth) ?? new Decimal(0),
    yearOneCashflowDelta: toDecimal(yearOneCashflowDelta) ?? new Decimal(0),
    yearOneTaxDelta: toDecimal(yearOneTaxDelta) ?? new Decimal(0),
    baseSuperBalance: opts.baseSuperBalance !== undefined
      ? (toDecimal(opts.baseSuperBalance) ?? new Decimal(0))
      : undefined,
    annualSuperContribution: opts.annualSuperContribution !== undefined
      ? (toDecimal(opts.annualSuperContribution) ?? new Decimal(0))
      : undefined,
    years: opts.years,
  });
}
