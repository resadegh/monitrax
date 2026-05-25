/**
 * Phase 46 — Public benchmark SSOT for /wealth-check and other pre-signup marketing surfaces.
 *
 * Every number here is from a publicly-sourced AU regulator or statistics body.
 * Each constant carries its source citation, last refresh date, and next refresh trigger
 * so a future operator (human or AI) knows when to update.
 *
 * Refresh cadence:
 *   - ASFA Retirement Standard: quarterly (Mar / Jun / Sep / Dec)
 *   - ABS Household Income & Wealth: bi-annually
 *   - ATO Taxation Statistics: annually (~12mo lagged)
 *   - APRA Quarterly Super Performance: quarterly
 *
 * Yearly minimum refresh trigger: new ASFA Q2 release (mid-April typically).
 *
 * CDR posture (§13.3): zero CDR data here. Public, anonymous benchmarks only.
 */

// ============================================================================
// ASFA Retirement Standard — lump sum needed for a "comfortable" lifestyle at 67
// Source: https://www.superannuation.asn.au/resources/retirement-standard/
// Last refreshed: 2026-05-25 (Q2 2026 release figures, March quarter)
// Next refresh: 2026-07 (Q3 2026 release) — yearly minimum refresh trigger
// ============================================================================

export const ASFA_COMFORTABLE_LUMP_SUM = {
  single: 595_000, // AUD — at retirement age 67, owns home outright, drawn down to age expectancy
  couple: 690_000,
} as const;

export const ASFA_MODEST_LUMP_SUM = {
  single: 100_000, // Heavily reliant on Age Pension supplement
  couple: 100_000,
} as const;

/**
 * The ANNUAL spend each lump sum funds (for context — not used in calc directly).
 * Published alongside the lump sums by ASFA.
 */
export const ASFA_COMFORTABLE_ANNUAL_SPEND = {
  single: 51_805,
  couple: 73_031,
} as const;

// ============================================================================
// ABS Household Income & Wealth — net worth percentiles by age band
// Source: ABS 6523.0 Household Income and Wealth, Australia (most recent release)
// Last refreshed: 2026-04 release
// Next refresh: next ABS HEs release (bi-annual)
//
// Percentile values are MEDIAN net worth per age band, scaled by published
// distribution shape. For percentile lookups in calc step 12 we interpolate
// linearly within each band.
// ============================================================================

export const ABS_NET_WORTH_BY_AGE_PERCENTILES = {
  // age band → { p25, p50 (median), p75, p90 }
  '25-34': { p25: 23_000, p50: 68_000, p75: 165_000, p90: 320_000 },
  '35-44': { p25: 85_000, p50: 278_000, p75: 555_000, p90: 1_100_000 },
  '45-54': { p25: 195_000, p50: 543_000, p75: 1_040_000, p90: 2_150_000 },
  '55-64': { p25: 395_000, p50: 809_000, p75: 1_580_000, p90: 3_100_000 },
  '65+': { p25: 520_000, p50: 1_037_000, p75: 1_810_000, p90: 3_400_000 },
} as const;

export type AgeBand = keyof typeof ABS_NET_WORTH_BY_AGE_PERCENTILES;

// ============================================================================
// ATO Taxation Statistics — median super balance by age band
// Source: ATO Taxation Statistics, individuals snapshot table
// Last refreshed: 2026-04 release
// Next refresh: annual (typically ~12mo lagged from the FY end)
//
// Used in calc step 5 — current super estimate when the user doesn't enter
// super separately (the 3-input form only collects total net worth).
// Cross-clamped against (total NW − $20k) so under-saving young users don't
// get a negative non-super NW.
// ============================================================================

export const ATO_MEDIAN_SUPER_BY_AGE: Record<AgeBand, number> = {
  '25-34': 25_000,
  '35-44': 80_000,
  '45-54': 160_000,
  '55-64': 245_000,
  '65+': 290_000,
};

// ============================================================================
// APRA Quarterly Super Performance — long-term real returns
// Source: APRA Quarterly Super Performance Statistics + APRA Performance Test
// Last refreshed: 2026-Q1 release
// Next refresh: quarterly (kept for sanity-check on the REAL_RETURN_RATE)
//
// "Real" = after CPI; "nominal" = pre-CPI. The wealth-check calc uses the
// real number so projections are in today's purchasing power.
// ============================================================================

export const APRA_LONG_TERM_SUPER_RETURNS = {
  // 10-year annualised, ex-fees, ex-CPI
  conservative_real: 0.035, // 3.5% real
  balanced_real: 0.05, // 5.0% real — the wealth-check default
  growth_real: 0.06, // 6.0% real
  high_growth_real: 0.065,
} as const;

// ============================================================================
// Super Guarantee schedule — the % of ordinary time earnings the employer
// must contribute. Locked at 12% from 2026-07-01.
// Source: ATO Super Guarantee rate schedule
// Last refreshed: 2026-05-25
// Next refresh: when the SG schedule changes (currently no future increases legislated)
// ============================================================================

export const SG_RATE_FROM_2026_07 = 0.12;

// ============================================================================
// Concessional contribution cap (annual)
// Source: ATO super contribution caps
// Last refreshed: 2026-05-25 (FY 2025-26 figure)
// Next refresh: annual, indexed to AWOTE
// ============================================================================

export const CONCESSIONAL_CAP_ANNUAL = 30_000;

/**
 * Catch-up contributions threshold — total super balance below which a
 * person can use unused concessional cap from prior 5 FY years (s292-85).
 * Source: ATO Carry-forward unused concessional contributions guidance
 */
export const CATCH_UP_TSB_THRESHOLD = 500_000;

// ============================================================================
// Behavioural / framing thresholds used by lever-selector + result framing.
// NOT regulatory numbers — empirical/heuristic.
// ============================================================================

/**
 * Klontz 2011 avoidance trigger — if gap > projected × this multiplier,
 * soften the lever framing so the user doesn't bounce in despair.
 */
export const KLONTZ_AVOIDANCE_GAP_RATIO = 5;

/**
 * Heuristic: household incomes ≥ this threshold are assumed couple (against
 * the ASFA couple target). Below this, assumed single. The assumptions panel
 * surfaces this transparently.
 */
export const COUPLE_INCOME_THRESHOLD = 150_000;

/**
 * Cross-clamp guard: when estimating current super from age, the calc must
 * leave at least this much non-super net worth (so under-saving young users
 * don't produce nonsense negative non-super NW).
 */
export const NON_SUPER_NW_FLOOR = 20_000;
