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
 * Medicare Levy: 2% of taxable income (simplified - not including exemptions/reductions)
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

export const MEDICARE_LEVY_RATE = 0.02;

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
 * Calculate Medicare Levy
 */
export function calculateMedicareLevy(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  return taxableIncome * MEDICARE_LEVY_RATE;
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

  // Calculate tax
  const incomeTax = calculateIncomeTax(assessableIncome);
  const medicareLevy = calculateMedicareLevy(assessableIncome);
  const totalTax = incomeTax + medicareLevy;

  // Calculate effective tax rate
  const effectiveTaxRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

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
    totalTax,
    effectiveTaxRate,
    incomeSources,
  };
}
