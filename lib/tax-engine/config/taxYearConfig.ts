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

import { TaxYearConfig } from '../types';

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
  medicareRate: 0.02,
  medicareThresholds: {
    single: 26000,
    family: 43846,
    dependentChildIncrease: 4027,
    shadeOutMultiplier: 1.25, // Shade-in ends at 125% of threshold
  },

  // Medicare Levy Surcharge (no private health insurance)
  medicareSurchargeThresholds: [
    { min: 0, max: 93000, rate: 0 },
    { min: 93001, max: 108000, rate: 0.01 },
    { min: 108001, max: 144000, rate: 0.0125 },
    { min: 144001, max: null, rate: 0.015 },
  ],

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
  superGuaranteeQuarterlyCap: 62500, // ATO maximum super contribution base FY24-25
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
    nextReviewBy: '2026-06-15', // before FY26-27 commences
    reviewers: ['Reza', 'tax-engine-owner'],
  },
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
 *    by `reviewSchedule.nextReviewBy` (2026-06-15) before FY commences.
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

  lito: TAX_YEAR_2024_25.lito,
  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  // Super — SG rises to 12%
  superGuaranteeRate: 0.12,
  superGuaranteeQuarterlyCap: 65250, // preliminary; verify against ATO May 2026
  concessionalCap: 30000,
  nonConcessionalCap: 120000,
  division293Threshold: 250000,
  superContributionsTaxRate: 0.15,
  coContributionIncomeThreshold: 60400, // verify against ATO indexation May 2026
  carryForwardTsbThreshold: 500000,
  bringForwardThresholds: {
    full: 1660000,
    reduced: 1780000,
    none: 1900000,
  },

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,

  reviewSchedule: {
    nextReviewBy: '2026-06-15', // before FY26-27 commences
    reviewers: ['Reza', 'tax-engine-owner'],
  },
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

  medicareSurchargeThresholds: [
    { min: 0, max: 90000, rate: 0 },
    { min: 90001, max: 105000, rate: 0.01 },
    { min: 105001, max: 140000, rate: 0.0125 },
    { min: 140001, max: null, rate: 0.015 },
  ],

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
  bringForwardThresholds: {
    full: 1480000, // FY23-24 tier
    reduced: 1590000,
    none: 1900000,
  },

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,

  reviewSchedule: {
    nextReviewBy: '2026-06-15',
    reviewers: ['Reza', 'tax-engine-owner'],
  },
};

// =============================================================================
// Configuration Registry
// =============================================================================

const TAX_YEAR_CONFIGS: Record<string, TaxYearConfig> = {
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
    // Default to current year if not found
    console.warn(`Tax config not found for ${financialYear}, using 2024-25`);
    return TAX_YEAR_2024_25;
  }
  return config;
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
