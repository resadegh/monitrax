/**
 * Phase 20: Australian Tax Year Configuration
 * Tax rates and thresholds for Australian financial years
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

  // Low Income Tax Offset (LITO)
  lito: {
    maxOffset: 700,
    fullThreshold: 37500,
    withdrawalRate: 0.05, // 5 cents per dollar over threshold
    cutoffThreshold: 66667, // LITO reduces to 0 at this income
  },

  // Senior Australians and Pensioners Tax Offset (SAPTO)
  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  // Superannuation
  superGuaranteeRate: 0.115, // 11.5% for 2024-25
  concessionalCap: 30000, // Increased from $27,500 to $30,000 for 2024-25
  nonConcessionalCap: 120000, // Increased for 2024-25
  division293Threshold: 250000,

  // CGT
  cgtDiscount: 0.5, // 50% discount
  cgtDiscountMonths: 12, // Must hold for 12+ months
};

// =============================================================================
// 2023-24 Financial Year (Previous)
// =============================================================================

export const TAX_YEAR_2023_24: TaxYearConfig = {
  financialYear: '2023-24',
  startDate: new Date(2023, 6, 1),
  endDate: new Date(2024, 5, 30),

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

  lito: {
    maxOffset: 700,
    fullThreshold: 37500,
    withdrawalRate: 0.05,
    cutoffThreshold: 66667,
  },

  saptoSingle: 2230,
  saptoCoupleEach: 1602,

  superGuaranteeRate: 0.11, // 11% for 2023-24
  concessionalCap: 27500,
  nonConcessionalCap: 110000,
  division293Threshold: 250000,

  cgtDiscount: 0.5,
  cgtDiscountMonths: 12,
};

// =============================================================================
// Configuration Registry
// =============================================================================

const TAX_YEAR_CONFIGS: Record<string, TaxYearConfig> = {
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
