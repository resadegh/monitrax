/**
 * Australian Tax Calculation Engine
 * Tax year 2024-2025 (current as of implementation)
 *
 * Resident tax rates:
 * $0 – $18,200: Nil
 * $18,201 – $45,000: 19c for each $1 over $18,200
 * $45,001 – $135,000: $5,092 plus 30c for each $1 over $45,000
 * $135,001 – $190,000: $32,092 plus 37c for each $1 over $135,000
 * $190,001 and above: $52,442 plus 45c for each $1 over $190,000
 *
 * Medicare Levy: 2% of taxable income with thresholds
 * - Below threshold: $0
 * - Shaded-in range: 10% of excess over threshold
 * - Full levy: 2% of taxable income
 */

export interface TaxBracket {
  min: number;
  max: number | null; // null for the highest bracket
  baseAmount: number;
  rate: number; // marginal rate as decimal (e.g., 0.19 for 19%)
}

export const AU_TAX_BRACKETS_2024_25: TaxBracket[] = [
  { min: 0, max: 18200, baseAmount: 0, rate: 0 },
  { min: 18201, max: 45000, baseAmount: 0, rate: 0.19 },
  { min: 45001, max: 135000, baseAmount: 5092, rate: 0.30 },
  { min: 135001, max: 190000, baseAmount: 32092, rate: 0.37 },
  { min: 190001, max: null, baseAmount: 52442, rate: 0.45 },
];

// Medicare Levy constants for 2024-25 (single, no dependents)
export const MEDICARE_LEVY_RATE = 0.02;
export const MEDICARE_LEVY_SHADE_IN_RATE = 0.10; // 10% of excess over threshold
export const MEDICARE_LEVY_THRESHOLD_SINGLE = 26000; // Below this: no levy
export const MEDICARE_LEVY_SHADE_OUT_SINGLE = 32500; // Above this: full 2% levy

// Medicare Levy Surcharge thresholds (placeholder - not activated)
export const MLS_TIER_1_THRESHOLD = 93000; // Base tier for MLS
export const MLS_TIER_2_THRESHOLD = 108000;
export const MLS_TIER_3_THRESHOLD = 144000;
export const MLS_RATES = {
  tier0: 0, // Below threshold or with PHI
  tier1: 0.01, // 1%
  tier2: 0.0125, // 1.25%
  tier3: 0.015, // 1.5%
};

export interface IncomeSource {
  name: string;
  amount: number;
  isTaxable: boolean;
}

export interface ExpenseSource {
  name: string;
  amount: number;
  isTaxDeductible: boolean;
}

export interface TaxCalculationResult {
  // Income breakdown
  totalIncome: number;
  taxableIncome: number;
  nonTaxableIncome: number;

  // Expense breakdown
  totalExpenses: number;
  taxDeductibleExpenses: number;
  nonDeductibleExpenses: number;

  // Tax calculation
  assessableIncome: number; // taxableIncome - deductions
  incomeTax: number;
  medicareLevy: number;
  medicareLevySurcharge: number; // Placeholder - currently always 0
  totalTax: number;
  effectiveTaxRate: number; // as percentage

  // Breakdown by source
  incomeSources: {
    salary: number;
    rent: number;
    other: number;
  };
}

/**
 * Calculate income tax for a given taxable income
 */
export function calculateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  for (const bracket of AU_TAX_BRACKETS_2024_25) {
    if (taxableIncome <= bracket.min) {
      break;
    }

    const bracketMax = bracket.max ?? Infinity;
    const amountInBracket = Math.min(taxableIncome, bracketMax) - bracket.min + 1;

    if (amountInBracket > 0) {
      tax = bracket.baseAmount + amountInBracket * bracket.rate;
    }

    if (bracket.max === null || taxableIncome <= bracket.max) {
      break;
    }
  }

  return Math.max(0, tax);
}

/**
 * Calculate Medicare Levy with proper thresholds
 *
 * For 2024-25 (single, no dependents):
 * - Below $26,000: No levy
 * - $26,000 to $32,500: Shaded-in at 10% of excess over $26,000
 * - Above $32,500: Full 2% of taxable income
 *
 * The shade-in ensures a gradual increase rather than a cliff.
 */
export function calculateMedicareLevy(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  // Below threshold: no levy
  if (taxableIncome <= MEDICARE_LEVY_THRESHOLD_SINGLE) {
    return 0;
  }

  // Above shade-out threshold: full 2% levy
  if (taxableIncome >= MEDICARE_LEVY_SHADE_OUT_SINGLE) {
    return taxableIncome * MEDICARE_LEVY_RATE;
  }

  // Shaded-in range: 10% of (income - threshold)
  // This formula ensures the levy phases in gradually
  const excessOverThreshold = taxableIncome - MEDICARE_LEVY_THRESHOLD_SINGLE;
  const shadedLevy = excessOverThreshold * MEDICARE_LEVY_SHADE_IN_RATE;

  // Cap at what the full 2% would be (shouldn't happen in shade range, but safety check)
  const fullLevy = taxableIncome * MEDICARE_LEVY_RATE;
  return Math.min(shadedLevy, fullLevy);
}

/**
 * Calculate Medicare Levy Surcharge (placeholder)
 *
 * MLS applies to taxpayers without adequate private health insurance
 * who earn above the threshold. This is a placeholder for future implementation.
 *
 * @param taxableIncome - The taxable income
 * @param hasPrivateHealthInsurance - Whether the taxpayer has PHI (defaults to true to disable MLS)
 * @returns MLS amount (currently always 0 as placeholder)
 */
export function calculateMedicareLevySurcharge(
  taxableIncome: number,
  hasPrivateHealthInsurance: boolean = true // Default to true to disable MLS
): number {
  // Placeholder: MLS is disabled until PHI tracking is implemented
  // When enabled, this would return:
  // - 0% if income <= $93,000 or has PHI
  // - 1% if income $93,001-$108,000
  // - 1.25% if income $108,001-$144,000
  // - 1.5% if income > $144,000

  if (hasPrivateHealthInsurance) {
    return 0;
  }

  // MLS calculation (disabled - returns 0)
  // Uncomment when PHI tracking is available:
  /*
  if (taxableIncome <= MLS_TIER_1_THRESHOLD) {
    return 0;
  } else if (taxableIncome <= MLS_TIER_2_THRESHOLD) {
    return taxableIncome * MLS_RATES.tier1;
  } else if (taxableIncome <= MLS_TIER_3_THRESHOLD) {
    return taxableIncome * MLS_RATES.tier2;
  } else {
    return taxableIncome * MLS_RATES.tier3;
  }
  */

  return 0;
}

/**
 * Calculate total tax position for a user
 */
export function calculateTaxPosition(
  income: IncomeSource[],
  expenses: ExpenseSource[]
): TaxCalculationResult {
  // Calculate income totals
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const taxableIncome = income.filter((i) => i.isTaxable).reduce((sum, i) => sum + i.amount, 0);
  const nonTaxableIncome = totalIncome - taxableIncome;

  // Calculate expense totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const taxDeductibleExpenses = expenses
    .filter((e) => e.isTaxDeductible)
    .reduce((sum, e) => sum + e.amount, 0);
  const nonDeductibleExpenses = totalExpenses - taxDeductibleExpenses;

  // Calculate assessable income (after deductions)
  const assessableIncome = Math.max(0, taxableIncome - taxDeductibleExpenses);

  // Calculate tax components
  const incomeTax = calculateIncomeTax(assessableIncome);
  const medicareLevy = calculateMedicareLevy(assessableIncome);
  const medicareLevySurcharge = calculateMedicareLevySurcharge(assessableIncome);
  const totalTax = incomeTax + medicareLevy + medicareLevySurcharge;

  // Calculate effective tax rate (based on assessable income for accuracy)
  const effectiveTaxRate = assessableIncome > 0 ? (totalTax / assessableIncome) * 100 : 0;

  // Breakdown by source (simplified categorization)
  const incomeSources = {
    salary: income
      .filter((i) => i.name.toLowerCase().includes('salary') || i.name.toLowerCase().includes('wage'))
      .reduce((sum, i) => sum + i.amount, 0),
    rent: income
      .filter((i) => i.name.toLowerCase().includes('rent'))
      .reduce((sum, i) => sum + i.amount, 0),
    other: 0,
  };
  incomeSources.other = totalIncome - incomeSources.salary - incomeSources.rent;

  return {
    totalIncome,
    taxableIncome,
    nonTaxableIncome,
    totalExpenses,
    taxDeductibleExpenses,
    nonDeductibleExpenses,
    assessableIncome,
    incomeTax,
    medicareLevy,
    medicareLevySurcharge,
    totalTax,
    effectiveTaxRate,
    incomeSources,
  };
}
