/**
 * Financial Independence — the Monitrax "Freedom" hero number.
 *
 * The one truth that only exists because the WHOLE portfolio is on one page:
 * what fraction of the life you actually live is already funded by your assets?
 *
 *   coverageNow = net accessible passive income ÷ real (trailing) lifestyle spend
 *
 * "Net" and "accessible" are load-bearing (CLAUDE.md §0 financial-adviser +
 * §19.1 honesty):
 *   - NET: rental income counts only AFTER property expenses and loan interest.
 *     Feeding gross rent would be a lie — a heavily-geared portfolio can have
 *     large gross rent and near-zero (or negative) NET passive income.
 *   - ACCESSIBLE: preserved superannuation is excluded from the "now" number —
 *     you cannot draw it until preservation age, so counting it toward
 *     "work-optional today" would mislead. Super is surfaced separately as the
 *     "at 60" layer via a labelled safe-withdrawal assumption.
 *
 * Pure engine (CLAUDE.md §6.4): accepts raw numbers, returns a structured
 * result, never fetches or mutates. The caller maps canonical snapshot fields
 * → this input contract (and is responsible for passing NET, ACCESSIBLE income).
 *
 * Authority:
 *   - FI ratio = passive income ÷ living expenses (standard financial-independence
 *     definition; Barefoot "Fire Extinguisher" / FIRE literature).
 *   - superDrawdownRate default 0.04 = the "4% rule" (Bengen 1994 / Trinity study)
 *     — a labelled ASSUMPTION for the at-60 layer, never presented as a promise.
 *
 * SSOT (§12.2.1): this is the ONLY producer of the FI coverage numbers. Every
 * surface that shows "% of lifestyle covered" reads this engine's output.
 */

/** The safe-withdrawal assumption for turning a preserved super balance into an
 *  indicative annual income at preservation age. The "4% rule". A labelled
 *  assumption, surfaced to the user — never a guaranteed projection. */
export const DEFAULT_SUPER_DRAWDOWN_RATE = 0.04;

export interface FinancialIndependenceInput {
  /**
   * NET, ACCESSIBLE passive income — ANNUAL AUD. The sum of: per-property net
   * cashflow (rent − property expenses − loan interest, floored contribution),
   * + dividends + distributions + interest earned. EXCLUDES preserved super.
   * The caller MUST pass net (not gross) — see the file header.
   */
  netAccessiblePassiveAnnual: number;
  /** Total preserved super balance (AUD). Used only for the at-60 layer. */
  preservedSuperBalance: number;
  /** Real lifestyle spend — ANNUAL AUD, the honest trailing basis (Phase 57). */
  lifestyleAnnual: number;
  /**
   * Per-property NET monthly cashflow (rent − expenses − loan interest). Sign
   * only is used, to split "income-producing" (>0) from "growth-building" (≤0)
   * so a negatively-geared property reads as a deliberate equity strategy, not
   * a failure (§0 behaviour lens). Empty array → both counts 0.
   */
  propertyNetMonthly: number[];
  /** Safe-withdrawal rate for the at-60 super→income layer. Default 4%. */
  superDrawdownRate?: number;
  /**
   * Momentum (optional): net-worth change over the last period and the amount
   * attributable to saving (trailing net cashflow) — the rest is "your money
   * working" (portfolio growth + paydown). Pass null/undefined when net-worth
   * history is insufficient; the consumer then hides the momentum line.
   */
  netWorthDeltaLastPeriod?: number | null;
  savingsLastPeriod?: number | null;
}

export interface FinancialIndependenceResult {
  /** % of lifestyle covered by net accessible passive income NOW. 0 when no spend. */
  coverageNowPct: number;
  /** % covered once preserved super unlocks (accessible + super × drawdown). */
  coverageAt60Pct: number;
  netAccessiblePassiveMonthly: number;
  lifestyleMonthly: number;
  /** Indicative monthly income from preserved super at the drawdown rate (at-60 layer). */
  superIncomeAt60Monthly: number;
  /** The drawdown assumption used (echoed so the UI can label it honestly). */
  superDrawdownRate: number;
  /** Properties producing positive net income now. */
  incomeProducingCount: number;
  /** Properties building equity (net cashflow ≤ 0) — the deliberate growth play. */
  growthBuildingCount: number;
  /** Net-worth momentum last period, split. null when history is insufficient. */
  momentum: { total: number; fromPortfolio: number; fromSavings: number } | null;
  /** False when there's no lifestyle spend to divide by (coverage undefined). */
  hasData: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Compute the Financial Independence coverage numbers. Pure.
 */
export function computeFinancialIndependence(
  input: FinancialIndependenceInput
): FinancialIndependenceResult {
  const {
    netAccessiblePassiveAnnual,
    preservedSuperBalance,
    lifestyleAnnual,
    propertyNetMonthly,
    superDrawdownRate = DEFAULT_SUPER_DRAWDOWN_RATE,
    netWorthDeltaLastPeriod = null,
    savingsLastPeriod = null,
  } = input;

  const hasData = lifestyleAnnual > 0;

  const superIncomeAnnual = Math.max(0, preservedSuperBalance) * superDrawdownRate;

  const coverageNowPct = hasData
    ? round1((netAccessiblePassiveAnnual / lifestyleAnnual) * 100)
    : 0;
  const coverageAt60Pct = hasData
    ? round1(((netAccessiblePassiveAnnual + superIncomeAnnual) / lifestyleAnnual) * 100)
    : 0;

  const incomeProducingCount = propertyNetMonthly.filter((v) => v > 0).length;
  const growthBuildingCount = propertyNetMonthly.filter((v) => v <= 0).length;

  let momentum: FinancialIndependenceResult['momentum'] = null;
  if (netWorthDeltaLastPeriod != null && savingsLastPeriod != null) {
    const fromSavings = savingsLastPeriod;
    momentum = {
      total: Math.round(netWorthDeltaLastPeriod),
      fromSavings: Math.round(fromSavings),
      fromPortfolio: Math.round(netWorthDeltaLastPeriod - fromSavings),
    };
  }

  return {
    coverageNowPct,
    coverageAt60Pct,
    netAccessiblePassiveMonthly: Math.round(netAccessiblePassiveAnnual / 12),
    lifestyleMonthly: Math.round(lifestyleAnnual / 12),
    superIncomeAt60Monthly: Math.round(superIncomeAnnual / 12),
    superDrawdownRate,
    incomeProducingCount,
    growthBuildingCount,
    momentum,
    hasData,
  };
}
