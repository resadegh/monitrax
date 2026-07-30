/**
 * Phase 20: Australian Tax Year Configuration
 * Tax rates and thresholds for Australian financial years.
 *
 * **CANONICAL SSOT for AU tax thresholds** (CLAUDE.md §12.2). Every
 * consumer reads from `getTaxYearConfig(fy)`. New constants land
 * here with a primary-authority citation; consumers never hard-code.
 *
 * Per `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.1 + §10.2,
 * Phase 41e.−1 (this slice — PR A) extends the schema with new
 * canonical homes for previously-hard-coded values:
 *   - `label` — display string, replaces hard-coded "FY24-25"
 *   - `superContributionsTaxRate` — replaces 7× `0.15` / `0.85`
 *   - `coContributionIncomeThreshold` — replaces $60,400
 *   - `superGuaranteeQuarterlyCap` — replaces $62,500
 *   - `carryForwardTsbThreshold` — replaces $500,000 in capTracker
 *   - `bringForwardThresholds` — replaces capTracker hard-codes
 *   - `reviewSchedule` — forces explicit per-FY review checkpoint
 *
 * Consumer migration to these new fields lands in PR B.
 *
 * Sources:
 * - ATO Individual Tax Rates: https://www.ato.gov.au/rates/individual-income-tax-rates/
 * - Medicare Levy: https://www.ato.gov.au/individuals/medicare-and-private-health-insurance/medicare-levy/
 * - Super Guarantee: https://www.ato.gov.au/rates/key-superannuation-rates-and-thresholds/
 */

import { TaxYearConfig, PAYGScheduleConfig, HelpRepaymentConfig } from '../types';

// =============================================================================
// MON-131 T1 (MON-128 / D35) — PAYG Schedule 1 coefficient sets, per effective
// period. Moved here from `paygCalculator.ts` module-level constants so the
// coefficient home is CONFIG, not an engine file (payg-withholding contract
// precondition P1; X1 in MON-131_BUILD_SPECIFICATION §3).
//
// Formula (unchanged, audit MA.1-005): y = a·x − b, x = floor(weekly) + 0.99.
// Band bounds use the integer convention audited in MA.1-002 — the formula is
// continuous across boundaries and the final whole-dollar rounding absorbs the
// cents-level fraction. Do NOT "fix" bounds to $X.99.
// =============================================================================

/**
 * Schedule 1 in force 1 Jul 2024 – 30 Jun 2026 (the ATO did not reissue for
 * FY25-26 — its published effective range spans both FYs; the page URL itself
 * is "schedule-1-tax-table-01-july-2024-to-30-june-2026"). These are the
 * FY24-25 NAT 1004 coefficients previously hardcoded in `paygCalculator.ts`
 * (verified 2026-06-07, audit MA.1-005), now attached to BOTH FY24-25 and
 * FY25-26 configs.
 */
export const PAYG_SCHEDULE_2024_26: PAYGScheduleConfig = {
  source:
    'https://www.ato.gov.au/tax-rates-and-codes/schedule-1-tax-table-01-july-2024-to-30-june-2026',
  effectiveFrom: '2024-07-01',
  effectiveTo: '2026-06-30',
  scale2: [
    { weeklyEarningsMin: 0, weeklyEarningsMax: 361, coefficients: { a: 0, b: 0 } },
    { weeklyEarningsMin: 362, weeklyEarningsMax: 500, coefficients: { a: 0.16, b: 57.8462 } },
    { weeklyEarningsMin: 501, weeklyEarningsMax: 625, coefficients: { a: 0.26, b: 107.8462 } },
    { weeklyEarningsMin: 626, weeklyEarningsMax: 721, coefficients: { a: 0.18, b: 57.8462 } },
    { weeklyEarningsMin: 722, weeklyEarningsMax: 865, coefficients: { a: 0.189, b: 64.3365 } },
    { weeklyEarningsMin: 866, weeklyEarningsMax: 2596, coefficients: { a: 0.3227, b: 180.0385 } },
    { weeklyEarningsMin: 2597, weeklyEarningsMax: 3653, coefficients: { a: 0.37, b: 302.7885 } },
    { weeklyEarningsMin: 3654, weeklyEarningsMax: null, coefficients: { a: 0.45, b: 595.1058 } },
  ],
  scale1: [
    { weeklyEarningsMin: 0, weeklyEarningsMax: 88, coefficients: { a: 0.16, b: 0.16 } },
    { weeklyEarningsMin: 89, weeklyEarningsMax: 371, coefficients: { a: 0.2348, b: 6.5884 } },
    { weeklyEarningsMin: 372, weeklyEarningsMax: 500, coefficients: { a: 0.219, b: 0.719 } },
    { weeklyEarningsMin: 501, weeklyEarningsMax: 625, coefficients: { a: 0.3127, b: 47.6 } },
    { weeklyEarningsMin: 626, weeklyEarningsMax: 721, coefficients: { a: 0.2327, b: 2.6 } },
    { weeklyEarningsMin: 722, weeklyEarningsMax: 865, coefficients: { a: 0.2417, b: 9.0933 } },
    { weeklyEarningsMin: 866, weeklyEarningsMax: 2596, coefficients: { a: 0.3754, b: 124.7654 } },
    { weeklyEarningsMin: 2597, weeklyEarningsMax: 3653, coefficients: { a: 0.4227, b: 247.5154 } },
    { weeklyEarningsMin: 3654, weeklyEarningsMax: null, coefficients: { a: 0.5027, b: 539.8331 } },
  ],
};

/**
 * Schedule 1 effective from 1 Jul 2026 (published 17 Jun 2026) — reflects the
 * 15% first marginal rate (Treasury Laws Amendment (More Cost of Living
 * Relief) Act 2025), the updated Medicare levy low-income thresholds and the
 * indexed study-loan thresholds.
 *
 * Verified 2026-07-30 against the ATO coefficients page; cross-checked
 * byte-identical against an independent secondary
 * (https://pay-calculator.au/payg-withholding-tax-tables). Band bounds follow
 * the ATO's "less than $X" presentation → integer convention: max = X − 1,
 * next min = X (continuity per MA.1-002 holds — the coefficients meet at each
 * boundary by construction).
 */
export const PAYG_SCHEDULE_2026_27: PAYGScheduleConfig = {
  source:
    'https://www.ato.gov.au/tax-rates-and-codes/payg-withholding-schedule-1-statement-of-formulas-for-calculating-amounts-to-be-withheld/coefficients-to-use-in-formulas-for-withholding-from-weekly-payments',
  effectiveFrom: '2026-07-01',
  scale2: [
    { weeklyEarningsMin: 0, weeklyEarningsMax: 361, coefficients: { a: 0, b: 0 } },
    { weeklyEarningsMin: 362, weeklyEarningsMax: 537, coefficients: { a: 0.15, b: 54.3462 } },
    { weeklyEarningsMin: 538, weeklyEarningsMax: 672, coefficients: { a: 0.25, b: 108.2135 } },
    { weeklyEarningsMin: 673, weeklyEarningsMax: 720, coefficients: { a: 0.17, b: 54.3473 } },
    { weeklyEarningsMin: 721, weeklyEarningsMax: 864, coefficients: { a: 0.179, b: 60.8377 } },
    { weeklyEarningsMin: 865, weeklyEarningsMax: 1281, coefficients: { a: 0.3227, b: 185.1935 } },
    { weeklyEarningsMin: 1282, weeklyEarningsMax: 2595, coefficients: { a: 0.32, b: 181.7319 } },
    { weeklyEarningsMin: 2596, weeklyEarningsMax: 3652, coefficients: { a: 0.39, b: 363.4627 } },
    { weeklyEarningsMin: 3653, weeklyEarningsMax: null, coefficients: { a: 0.47, b: 655.7704 } },
  ],
  scale1: [
    { weeklyEarningsMin: 0, weeklyEarningsMax: 187, coefficients: { a: 0.15, b: 0.15 } },
    { weeklyEarningsMin: 188, weeklyEarningsMax: 370, coefficients: { a: 0.2084, b: 11.0185 } },
    { weeklyEarningsMin: 371, weeklyEarningsMax: 514, coefficients: { a: 0.179, b: 0.1066 } },
    { weeklyEarningsMin: 515, weeklyEarningsMax: 931, coefficients: { a: 0.3227, b: 74.1674 } },
    { weeklyEarningsMin: 932, weeklyEarningsMax: 2245, coefficients: { a: 0.32, b: 71.6508 } },
    { weeklyEarningsMin: 2246, weeklyEarningsMax: 3302, coefficients: { a: 0.39, b: 228.8816 } },
    { weeklyEarningsMin: 3303, weeklyEarningsMax: null, coefficients: { a: 0.47, b: 493.1893 } },
  ],
};

/**
 * MON-131 T1 (D42 C2/C3) — HELP/STSL compulsory repayment, FY2026-27
 * marginal system. Verified 2026-07-30 against
 * https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds
 * — "$0–$69,528 Nil · $69,529–$129,717 15c for each $1 over $69,528 ·
 * $129,718–$186,050 $9,028 plus 17c for each $1 over $129,717 ·
 * $186,051 and over 10% of your total repayment income."
 * The top band is a CLIFF on the WHOLE repayment income (C2), coded as such.
 */
export const HELP_REPAYMENT_2026_27: HelpRepaymentConfig = {
  source:
    'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds',
  minThreshold: 69528,
  bands: [
    { over: 69528, upTo: 129717, base: 0, rate: 0.15 },
    { over: 129717, upTo: 186050, base: 9028, rate: 0.17 },
  ],
  topThreshold: 186050,
  topRateOfTotal: 0.10,
};

// =============================================================================
// 2024-25 Financial Year (Current)
// =============================================================================

export const TAX_YEAR_2024_25: TaxYearConfig = {
  financialYear: '2024-25',
  startDate: new Date(2024, 6, 1), // July 1, 2024
  endDate: new Date(2025, 5, 30), // June 30, 2025
  label: 'FY24-25',

  // Tax brackets (Stage 3 tax cuts applied)
  brackets: [
    { min: 0, max: 18200, baseAmount: 0, rate: 0 },
    { min: 18201, max: 45000, baseAmount: 0, rate: 0.16 }, // Reduced from 19%
    { min: 45001, max: 135000, baseAmount: 4288, rate: 0.30 },
    { min: 135001, max: 190000, baseAmount: 31288, rate: 0.37 },
    { min: 190001, max: null, baseAmount: 51638, rate: 0.45 },
  ],
  taxFreeThreshold: 18200,

  // Medicare Levy (2%)
  // MA.1-003 (2026-06-07): updated to FY24-25 indexed values. Pre-fix
  // values ($26,000 / $43,846 / $4,027) were FY23-24 numbers shipped
  // before ATO's FY24-25 indexation publication; FY24-25 single
  // threshold is $27,222 with weekly equivalent $523 (×52 = 27,222),
  // family $45,907, dependent child uplift $4,216.
  // Verified-via:
  //   - https://www.ato.gov.au/tax-rates-and-codes/tax-table-weekly-with-no-and-half-medicare-levy
  //     (NAT 1005 — quotes "$523 weekly = $27,222 annual")
  //   - https://www.ato.gov.au/individuals/medicare-and-private-health-insurance/medicare-levy/
  //   - Retrieved 2026-06-07.
  medicareRate: 0.02,
  medicareThresholds: {
    single: 27222, // FY24-25 (was $26,000 FY23-24)
    family: 45907, // FY24-25 (was $43,846 FY23-24)
    dependentChildIncrease: 4216, // FY24-25 (was $4,027 FY23-24)
    shadeOutMultiplier: 1.25, // Shade-in ends at 125% of threshold
  },

  // Medicare Levy Surcharge (no private health insurance)
  // Conformance fix (audit 2026-06-12, finding 3): FY24-25 singles
  // tiers are $97,000 / $113,000 / $151,000 (the previous values were
  // FY23-24's). Family tiers are double; single-only modelled — family
  // MLS is a documented gap, not a wrong number.
  medicareSurchargeThresholds: [
    { min: 0, max: 97000, rate: 0 },
    { min: 97001, max: 113000, rate: 0.01 },
    { min: 113001, max: 151000, rate: 0.0125 },
    { min: 151001, max: null, rate: 0.015 },
  ],
  // MON-088: family MLS = singles tiers doubled (+$1,500 per dependent child
  // after the first) — ato.gov.au "Medicare levy surcharge income, thresholds
  // and rates". FY24-25 family base = $194,000.
  medicareSurchargeFamily: { singleMultiplier: 2, dependentChildIncrease: 1500 },

  // Low Income Tax Offset (LITO) - ATO two-tier phase out
  // Full $700 for income up to $37,500
  // Reduces by 5c/$ from $37,500 to $45,000 (5% = $375 reduction, leaving $325)
  // Reduces by 1.5c/$ from $45,000 to $66,667 (1.5% = $325 reduction, leaving $0)
  lito: {
    maxOffset: 700,
    fullThreshold: 37500,
    tier1: {
      threshold: 45000,
      withdrawalRate: 0.05, // 5 cents per dollar
    },
    tier2: {
      threshold: 66667,
      withdrawalRate: 0.015, // 1.5 cents per dollar
    },
    cutoffThreshold: 66667, // LITO reduces to 0 at this income
  },

  // Senior Australians and Pensioners Tax Offset (SAPTO)
  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  // Superannuation
  superGuaranteeRate: 0.115, // 11.5% for 2024-25
  superGuaranteeQuarterlyCap: 65070, // ATO maximum super contribution base FY24-25 (audit fix 2026-06-12: was FY25-26's value)
  concessionalCap: 30000, // Increased from $27,500 to $30,000 for 2024-25
  nonConcessionalCap: 120000, // Increased for 2024-25
  division293Threshold: 250000,
  superContributionsTaxRate: 0.15, // ITAA 1997 s295-485 — taxed-in-fund rate
  coContributionIncomeThreshold: 60400, // Phase-out upper bound FY24-25
  carryForwardTsbThreshold: 500000, // ITAA 1997 s291-20(3)
  bringForwardThresholds: {
    full: 1660000, // < this → 3-year bring-forward
    reduced: 1780000, // < this (≥ full) → 2-year
    none: 1900000, // ≥ this → no bring-forward
  },

  // CGT
  cgtDiscount: 0.5, // 50% discount
  cgtDiscountMonths: 12, // Must hold for 12+ months

  reviewSchedule: {
    nextReviewBy: '2026-09-30', // extended from 2026-06-15 — FY26-27 config review deferred to Basiq prep (see CHANGELOG_2026_06_15)
    reviewers: ['Reza', 'tax-engine-owner'],
  },

  // Phase 41e.3 — high-balance super tax
  transferBalanceCap: 1900000, // ITAA 1997 s294-35 — FY24-25 $1.9M
  div296CommencementVerified: false, // pending Royal Assent
  div296TsbThreshold: 3000000, // proposed $3M
  div296Rate: 0.15, // additional 15% per the proposed Bill

  // Phase 41E reform 2026-27 — all flags false until each Bill assents.
  // See `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10 + CLAUDE.md §12.14.
  negativeGearingReformCommencementVerified: false,
  cgtIndexationCommencementVerified: false,
  cgtMinRateCommencementVerified: false,
  trustMinTaxCommencementVerified: false,
  foreignResidentCgtCommencementVerified: false,
  lossCarryBackCommencementVerified: false,
  evFbtPhase2CommencementVerified: false,
  dynamicPaygCommencementVerified: false,
  cpiQuarterlyIndex: {}, // populated in Stage 2 from ATO's CPI table

  // MON-131 T1 (D35): Schedule 1 in force for payments 1 Jul 2024 – 30 Jun 2026.
  paygSchedule: PAYG_SCHEDULE_2024_26,
  // helpRepayment intentionally absent — FY24-25 used the pre-marginal flat-rate
  // system, not verified here → calculateHelpRepayment returns UNDETERMINED.
};

// =============================================================================
// 2025-26 Financial Year (Upcoming — closes audit C-4)
// =============================================================================

/**
 * FY25-26 config. Resolves PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md C-4
 * (FY25-26 missing). Most thresholds carried forward from FY24-25.
 * Updates:
 *  - Super Guarantee rate rises to 12% per ATO schedule.
 *  - SG quarterly cap recalculated for the new SG rate (ATO publishes
 *    annually; using preliminary $65,250).
 *  - All other thresholds: review and update with confirmed ATO data
 *    by `reviewSchedule.nextReviewBy`.
 *
 * FY26-27 review checkpoint (2026-06-15) — DEFERRED to Basiq prep (Reza
 * decision 2026-06-15). FY2026-27 has at least one legislated change (lowest
 * resident bracket 16% → 15% from 1 Jul 2026, 2025 Budget) plus indexed items
 * (super caps via AWOTE, Medicare thresholds) that need confirmed ATO + a
 * registered-tax-agent pass before they can be trusted. Until a FY26-27 config
 * is added, `getCurrentTaxYearConfig()` resolves the post-1-Jul-2026 "current"
 * FY to the LATEST available config (FY25-26) — see `getTaxYearConfig` fallback.
 * Tracked: `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`.
 */
export const TAX_YEAR_2025_26: TaxYearConfig = {
  financialYear: '2025-26',
  startDate: new Date(2025, 6, 1), // July 1, 2025
  endDate: new Date(2026, 5, 30), // June 30, 2026
  label: 'FY25-26',

  // Brackets carried forward — Stage 3 cuts already in effect
  brackets: TAX_YEAR_2024_25.brackets,
  taxFreeThreshold: 18200,

  medicareRate: 0.02,
  medicareThresholds: TAX_YEAR_2024_25.medicareThresholds, // pending ATO update
  medicareSurchargeThresholds: TAX_YEAR_2024_25.medicareSurchargeThresholds,
  medicareSurchargeFamily: TAX_YEAR_2024_25.medicareSurchargeFamily, // MON-088 (pending ATO update with the rest)

  lito: TAX_YEAR_2024_25.lito,
  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  // Super — SG rises to 12%
  superGuaranteeRate: 0.12,
  superGuaranteeQuarterlyCap: 62500, // FY25-26 (cap falls as SG hits 12% — derived from the concessional cap; audit fix 2026-06-12)
  concessionalCap: 30000,
  nonConcessionalCap: 120000,
  division293Threshold: 250000,
  superContributionsTaxRate: 0.15,
  coContributionIncomeThreshold: 60400, // verify against ATO indexation May 2026
  carryForwardTsbThreshold: 500000,
  // Conformance fix (audit 2026-06-12, finding 4): the general
  // transfer balance cap indexed to $2.0M from 1 Jul 2025 (Dec-2024
  // CPI); the bring-forward TSB tiers move with it (s292-85(3)-(4):
  // none = general TBC; reduced = TBC − 1×NCC; full = TBC − 2×NCC).
  bringForwardThresholds: {
    full: 1760000,
    reduced: 1880000,
    none: 2000000,
  },

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,

  reviewSchedule: {
    nextReviewBy: '2026-09-30', // extended from 2026-06-15 — FY26-27 config review deferred to Basiq prep (see CHANGELOG_2026_06_15)
    reviewers: ['Reza', 'tax-engine-owner'],
  },

  // Phase 41e.3 — high-balance super tax
  // Conformance fix (audit 2026-06-12, finding 4): indexed to $2.0M
  // from 1 Jul 2025.
  transferBalanceCap: 2000000,
  div296CommencementVerified: false, // verify status before each FY
  div296TsbThreshold: 3000000,
  div296Rate: 0.15,

  // Phase 41E reform 2026-27 — all flags false until each Bill assents.
  // None of the reform measures commence in FY25-26 (M5 is FY26-27 onwards,
  // M1+M2+M7+M9 are FY27-28, M3 is FY28-29). These flags exist on every
  // FY config for type-system completeness + so the engine can dispatch
  // regime-aware logic uniformly. See PHASE_41E_REFORM_2026_27.md §10.
  negativeGearingReformCommencementVerified: false,
  cgtIndexationCommencementVerified: false,
  cgtMinRateCommencementVerified: false,
  trustMinTaxCommencementVerified: false,
  foreignResidentCgtCommencementVerified: false,
  lossCarryBackCommencementVerified: false,
  evFbtPhase2CommencementVerified: false,
  dynamicPaygCommencementVerified: false,
  cpiQuarterlyIndex: {},

  // MON-131 T1 (D35): the ATO did NOT reissue Schedule 1 for FY25-26 — the
  // 2024-published schedule's effective range runs to 30 Jun 2026.
  paygSchedule: PAYG_SCHEDULE_2024_26,
  // helpRepayment absent — FY25-26 marginal-system thresholds not verified
  // here (T1 needs only the current FY) → UNDETERMINED, never borrowed.
};

// =============================================================================
// 2026-27 Financial Year (Current from 1 Jul 2026 — MON-106)
// =============================================================================

/**
 * FY26-27 config (MON-106, VR-037 finding 3). Before this entry existed the
 * engine silently fell back to FY25-26 brackets — taxing the $18,201–$45,000
 * band at 16% instead of the legislated 15% (≈$268 overstatement on a
 * $145,426 taxable income; Ring-0 walk locked in
 * tests/tax/mon106Fy2026_27Config.test.ts).
 *
 * THE legislated change this entry applies:
 *   - Lowest resident bracket 16% → **15%** from 1 Jul 2026 — Treasury Laws
 *     Amendment (More Cost of Living in Every Pocket) Act 2025 (2025-26
 *     Federal Budget measure; the same Act steps it to 14% from 1 Jul 2027 —
 *     see reviewSchedule). Base amounts re-derived from the new rate:
 *     $4,020 at $45,001 / $31,020 at $135,001 / $51,370 at $190,001.
 *
 * Everything else is CARRIED FORWARD from FY25-26 pending confirmed ATO
 * indexation (AWOTE super caps, Medicare thresholds/MLS tiers, co-contribution,
 * TBC CPI step) — each carried value is commented. Reza's merge review of this
 * config is the sign-off gate the 2026-06-15 deferral decision required
 * (docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md item 34); the
 * 2027-06-15 review checkpoint picks up the indexed figures + the 14% step.
 */
export const TAX_YEAR_2026_27: TaxYearConfig = {
  financialYear: '2026-27',
  startDate: new Date(2026, 6, 1), // July 1, 2026
  endDate: new Date(2027, 5, 30), // June 30, 2027
  label: 'FY26-27',

  // Lowest bracket 16% → 15% from 1 Jul 2026 (More Cost of Living in Every
  // Pocket Act 2025). Higher-bracket rates/thresholds unchanged by the Act;
  // base amounts re-derived from the 15% band.
  brackets: [
    { min: 0, max: 18200, baseAmount: 0, rate: 0 },
    { min: 18201, max: 45000, baseAmount: 0, rate: 0.15 }, // was 0.16 (FY24-25/FY25-26)
    { min: 45001, max: 135000, baseAmount: 4020, rate: 0.30 }, // 26,800 × 15% (was 4,288)
    { min: 135001, max: 190000, baseAmount: 31020, rate: 0.37 }, // 4,020 + 90,000 × 30%
    { min: 190001, max: null, baseAmount: 51370, rate: 0.45 }, // 31,020 + 55,000 × 37%
  ],
  taxFreeThreshold: 18200,

  medicareRate: 0.02,
  medicareThresholds: TAX_YEAR_2025_26.medicareThresholds, // carried — pending ATO FY26-27 indexation
  medicareSurchargeThresholds: TAX_YEAR_2025_26.medicareSurchargeThresholds, // carried — pending ATO
  medicareSurchargeFamily: TAX_YEAR_2025_26.medicareSurchargeFamily, // MON-088 rule; multipliers not indexed

  lito: TAX_YEAR_2025_26.lito, // unchanged by the Act; not indexed
  saptoSingle: 2230, // carried — pending ATO
  saptoCoupleEach: 1602, // carried — pending ATO

  // Super — SG rate reached its legislated 12% maximum on 1 Jul 2025; no
  // further step is legislated.
  superGuaranteeRate: 0.12,
  superGuaranteeQuarterlyCap: TAX_YEAR_2025_26.superGuaranteeQuarterlyCap, // carried — ATO publishes the FY26-27 max contribution base annually
  concessionalCap: 30000, // carried — AWOTE-indexed in $2,500 steps; confirm at the 2027-06-15 review
  nonConcessionalCap: 120000, // carried — 4 × concessional cap; moves only if the concessional cap moves
  division293Threshold: 250000, // not indexed (ITAA 1997 s293-20)
  superContributionsTaxRate: 0.15, // ITAA 1997 s295-485 — structural rate
  coContributionIncomeThreshold: 60400, // carried — pending ATO indexation
  carryForwardTsbThreshold: 500000, // ITAA 1997 s291-20(3) — not indexed
  // Carried from FY25-26 ($2.0M TBC-derived tiers, s292-85(3)-(4)); the TBC
  // moves only on a CPI step — confirm at the 2027-06-15 review.
  bringForwardThresholds: TAX_YEAR_2025_26.bringForwardThresholds,

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,

  reviewSchedule: {
    // Before FY27-28 commences: (a) the SAME Act steps the lowest bracket
    // 15% → 14% on 1 Jul 2027 — a FY27-28 config is REQUIRED by then (the
    // mon106 clock-derived CI guard goes red on 1 Jul 2027 without it);
    // (b) confirm the ATO-indexed items carried forward above.
    nextReviewBy: '2027-06-15',
    reviewers: ['Reza', 'tax-engine-owner'],
  },

  // Phase 41e.3 — high-balance super tax
  transferBalanceCap: 2000000, // carried — pending any CPI-triggered step
  div296CommencementVerified: false, // verify status before applying (§12.14 FW-2)
  div296TsbThreshold: 3000000,
  div296Rate: 0.15,

  // Phase 41E reform 2026-27 — ALL flags stay false until each Bill's Royal
  // Assent is verified (§12.14 FW-2: never apply post-reform math before
  // commencement is verified). Measure 5 (loss carry-back) nominally starts
  // FY26-27 but remains gated behind lossCarryBackCommencementVerified.
  negativeGearingReformCommencementVerified: false,
  cgtIndexationCommencementVerified: false,
  cgtMinRateCommencementVerified: false,
  trustMinTaxCommencementVerified: false,
  foreignResidentCgtCommencementVerified: false,
  lossCarryBackCommencementVerified: false,
  evFbtPhase2CommencementVerified: false,
  dynamicPaygCommencementVerified: false,
  cpiQuarterlyIndex: {},

  // MON-131 T1 (D35 / X1): FY26-27 Schedule 1 — the 15% first-rate reform
  // coefficients, effective for payments from 1 Jul 2026.
  paygSchedule: PAYG_SCHEDULE_2026_27,
  // MON-131 T1 (D42 C2/C3): FY26-27 HELP/STSL marginal repayment structure
  // with the top-band cliff (10% of TOTAL repayment income above $186,050).
  helpRepayment: HELP_REPAYMENT_2026_27,
};

// =============================================================================
// 2023-24 Financial Year (Previous)
// =============================================================================

export const TAX_YEAR_2023_24: TaxYearConfig = {
  financialYear: '2023-24',
  startDate: new Date(2023, 6, 1),
  endDate: new Date(2024, 5, 30),
  label: 'FY23-24',

  brackets: [
    { min: 0, max: 18200, baseAmount: 0, rate: 0 },
    { min: 18201, max: 45000, baseAmount: 0, rate: 0.19 },
    { min: 45001, max: 120000, baseAmount: 5092, rate: 0.325 },
    { min: 120001, max: 180000, baseAmount: 29467, rate: 0.37 },
    { min: 180001, max: null, baseAmount: 51667, rate: 0.45 },
  ],
  taxFreeThreshold: 18200,

  medicareRate: 0.02,
  medicareThresholds: {
    single: 24276,
    family: 40939,
    dependentChildIncrease: 3760,
    shadeOutMultiplier: 1.25,
  },

  // Conformance fix (audit 2026-06-12, finding 3): FY23-24 singles
  // tiers are $93,000 / $108,000 / $144,000 (the first indexed year;
  // the previous values were FY22-23's frozen tiers).
  medicareSurchargeThresholds: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: null, rate: 0.015 },
  ],
  // MON-088: family MLS = singles tiers doubled (+$1,500/child after first).
  medicareSurchargeFamily: { singleMultiplier: 2, dependentChildIncrease: 1500 },

  // Low Income Tax Offset (LITO) - ATO two-tier phase out
  lito: {
    maxOffset: 700,
    fullThreshold: 37500,
    tier1: {
      threshold: 45000,
      withdrawalRate: 0.05, // 5 cents per dollar
    },
    tier2: {
      threshold: 66667,
      withdrawalRate: 0.015, // 1.5 cents per dollar
    },
    cutoffThreshold: 66667,
  },

  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  superGuaranteeRate: 0.11, // 11% for 2023-24
  superGuaranteeQuarterlyCap: 62270, // ATO maximum super contribution base FY23-24
  concessionalCap: 27500,
  nonConcessionalCap: 110000,
  division293Threshold: 250000,
  superContributionsTaxRate: 0.15,
  coContributionIncomeThreshold: 58445, // FY23-24 phase-out upper
  carryForwardTsbThreshold: 500000,
  // Conformance fix (audit 2026-06-12, finding 12): FY23-24 tiers
  // derive from the $1.9M TBC and $110k NCC (none = 1.9M; reduced =
  // 1.79M; full = 1.68M). The previous values were $1.7M-TBC-era.
  bringForwardThresholds: {
    full: 1680000,
    reduced: 1790000,
    none: 1900000,
  },

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,

  reviewSchedule: {
    nextReviewBy: '2026-09-30', // extended from 2026-06-15 — FY26-27 config review deferred to Basiq prep (see CHANGELOG_2026_06_15)
    reviewers: ['Reza', 'tax-engine-owner'],
  },

  // Phase 41e.3 — high-balance super tax (historical FY23-24 thresholds)
  transferBalanceCap: 1900000, // FY23-24 $1.9M
  div296CommencementVerified: false, // not yet enacted in FY23-24
  div296TsbThreshold: 3000000,
  div296Rate: 0.15,

  // Phase 41E reform 2026-27 — historical FY, all flags false (the
  // reform measures were announced 12 May 2026, well after FY23-24
  // closed). Fields exist for type-system uniformity across FY configs.
  negativeGearingReformCommencementVerified: false,
  cgtIndexationCommencementVerified: false,
  cgtMinRateCommencementVerified: false,
  trustMinTaxCommencementVerified: false,
  foreignResidentCgtCommencementVerified: false,
  lossCarryBackCommencementVerified: false,
  evFbtPhase2CommencementVerified: false,
  dynamicPaygCommencementVerified: false,
  cpiQuarterlyIndex: {},
};

// =============================================================================
// Configuration Registry
// =============================================================================

const TAX_YEAR_CONFIGS: Record<string, TaxYearConfig> = {
  '2026-27': TAX_YEAR_2026_27,
  '2025-26': TAX_YEAR_2025_26,
  '2024-25': TAX_YEAR_2024_25,
  '2023-24': TAX_YEAR_2023_24,
};

/**
 * Get tax configuration for a specific financial year
 */
export function getTaxYearConfig(financialYear: string): TaxYearConfig {
  const config = TAX_YEAR_CONFIGS[financialYear];
  if (!config) {
    // Fall back to the LATEST available config (not a hard-coded year) so a
    // not-yet-configured FY — e.g. FY26-27 from 1 Jul 2026 until its config is
    // added (deferred to Basiq prep, Reza 2026-06-15) — resolves to the most
    // recent known year rather than a two-years-stale one. Honest-stale, not
    // wrong-stale.
    const latest = getAvailableTaxYears()[0];
    const fallback = latest ? TAX_YEAR_CONFIGS[latest] : TAX_YEAR_2024_25;
    console.warn(`Tax config not found for ${financialYear}, using latest available (${fallback.financialYear})`);
    return fallback;
  }
  return config;
}

/**
 * MON-104 — is this FY string a configured tax year (an exact registry key)?
 * The write boundary uses this to REJECT an unconfigured FY instead of
 * persisting a row under a key the read path (which normalises through
 * `getTaxYearConfig` / `getCurrentTaxYearConfig`) will never ask for.
 */
export function isTaxYearConfigured(financialYear: string): boolean {
  return Object.prototype.hasOwnProperty.call(TAX_YEAR_CONFIGS, financialYear);
}

/**
 * MON-104 — THE canonical FY resolver for capture/assessment routes
 * (psi-assessment, div152-assessment, smsf-return). One producer for the
 * derived "which FY does this request mean" value, used by BOTH the write
 * and the read side of every capture route so a persisted row's key is
 * always a key the reader resolves to.
 *
 *   - absent/empty `?fy=` → the current FY config (which itself normalises
 *     an unconfigured current year to the latest available config — so the
 *     default write key always equals the default read key);
 *   - a configured FY → that config;
 *   - anything else → null. The caller MUST fail loud (4xx), never persist:
 *     an orphaned capture saves silently and stays inert forever (VR-037
 *     finding 1 — the worst failure mode for a capture feature).
 */
export function resolveRequestedTaxYear(requestedFy: string | null): TaxYearConfig | null {
  if (requestedFy === null || requestedFy === '') return getCurrentTaxYearConfig();
  return TAX_YEAR_CONFIGS[requestedFy] ?? null;
}

/**
 * Get the current financial year configuration
 */
export function getCurrentTaxYearConfig(): TaxYearConfig {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Australian FY runs July 1 to June 30
  const financialYear =
    month >= 6
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`;

  return getTaxYearConfig(financialYear);
}

/**
 * Get all available tax year configurations
 */
export function getAvailableTaxYears(): string[] {
  return Object.keys(TAX_YEAR_CONFIGS).sort().reverse();
}

/**
 * Calculate the marginal tax rate for a given taxable income
 */
export function getMarginalRate(taxableIncome: number, config: TaxYearConfig = TAX_YEAR_2024_25): number {
  for (const bracket of config.brackets) {
    const max = bracket.max ?? Infinity;
    if (taxableIncome <= max) {
      return bracket.rate;
    }
  }
  // Highest bracket rate
  return config.brackets[config.brackets.length - 1].rate;
}

/**
 * Get the tax bracket a given income falls into
 */
export function getTaxBracket(
  taxableIncome: number,
  config: TaxYearConfig = TAX_YEAR_2024_25
): { bracketIndex: number; bracket: typeof config.brackets[0]; incomeInBracket: number } {
  for (let i = 0; i < config.brackets.length; i++) {
    const bracket = config.brackets[i];
    const max = bracket.max ?? Infinity;
    if (taxableIncome <= max) {
      return {
        bracketIndex: i,
        bracket,
        incomeInBracket: taxableIncome - bracket.min + 1,
      };
    }
  }
  // Shouldn't reach here, but return highest bracket
  const lastIndex = config.brackets.length - 1;
  return {
    bracketIndex: lastIndex,
    bracket: config.brackets[lastIndex],
    incomeInBracket: taxableIncome - config.brackets[lastIndex].min + 1,
  };
}
