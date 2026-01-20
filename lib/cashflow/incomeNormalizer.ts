/**
 * Income Normalizer - Converts gross income to net (after-tax) amounts
 *
 * This utility integrates the Tax Engine with cashflow calculations to ensure
 * all financial projections use after-tax income amounts.
 */

import { TaxEngine, getCurrentFinancialYear } from '@/lib/tax-engine';
import type { IncomeStream } from './types';
import { toAnnual, periodsPerYear } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

export interface IncomeWithTax extends IncomeStream {
  grossMonthlyAmount: number;
  netMonthlyAmount: number;
  monthlyPaygWithholding: number;
  isAfterTax: boolean;
}

export interface NormalizedIncomeResult {
  incomeStreams: IncomeWithTax[];
  totalGrossMonthly: number;
  totalNetMonthly: number;
  totalMonthlyPayg: number;
}

/**
 * Annualize a monthly amount based on frequency
 */
function annualizeFromMonthly(monthlyAmount: number): number {
  return monthlyAmount * 12;
}

/**
 * Convert annual amount to monthly
 */
function monthlyFromAnnual(annualAmount: number): number {
  return annualAmount / 12;
}

/**
 * Calculate net income for a salary stream using the Tax Engine
 */
function calculateNetSalary(grossMonthlyAmount: number): {
  netMonthly: number;
  paygMonthly: number;
} {
  const config = TaxEngine.getCurrentConfig();
  const annualGross = annualizeFromMonthly(grossMonthlyAmount);

  // Calculate PAYG withholding
  const paygResult = TaxEngine.calculatePAYG({
    grossIncome: annualGross,
    frequency: 'ANNUALLY',
    hasTaxFreeThreshold: true,
  });

  // Calculate Medicare levy
  const medicareResult = TaxEngine.calculateMedicareLevy({
    taxableIncome: annualGross,
  }, config);

  // Total annual tax
  const annualTax = paygResult.annualWithholding + medicareResult.medicareLevy;
  const annualNet = annualGross - annualTax;

  return {
    netMonthly: monthlyFromAnnual(annualNet),
    paygMonthly: monthlyFromAnnual(annualTax),
  };
}

/**
 * Normalize a single income stream to include after-tax amounts
 *
 * For SALARY income:
 * - If salaryType is 'NET': Uses the entered amount as net (no tax deduction needed)
 * - If salaryType is 'GROSS': Uses pre-calculated netAmount or calculates PAYG
 * - For legacy data: Calculates PAYG from amount
 * For other income types: Returns the original amount (assumed to be gross/taxable)
 */
export function normalizeIncomeStream(income: IncomeStream): IncomeWithTax {
  // For salary income, handle based on how the amount was entered
  if (income.type === 'SALARY') {
    // If user entered NET income, the monthlyAmount is already net
    if (income.salaryType === 'NET') {
      // Use stored amounts if available
      const netMonthly = income.netAmount != null
        ? income.netAmount / 12
        : income.monthlyAmount;
      const grossMonthly = income.grossAmount != null
        ? income.grossAmount / 12
        : income.monthlyAmount; // If no gross stored, use the amount (will be recalculated if needed)
      const paygMonthly = income.paygWithholding != null
        ? income.paygWithholding / 12
        : grossMonthly - netMonthly;

      return {
        ...income,
        grossMonthlyAmount: grossMonthly,
        netMonthlyAmount: netMonthly,
        monthlyPaygWithholding: paygMonthly,
        // Use net amount for cashflow calculations (already net, no deduction needed)
        monthlyAmount: netMonthly,
        isAfterTax: true,
      };
    }

    // If user entered GROSS income, use pre-calculated net if available
    if (income.salaryType === 'GROSS' && income.netAmount != null) {
      const netMonthly = income.netAmount / 12;
      const grossMonthly = income.monthlyAmount;
      const paygMonthly = income.paygWithholding != null
        ? income.paygWithholding / 12
        : grossMonthly - netMonthly;

      return {
        ...income,
        grossMonthlyAmount: grossMonthly,
        netMonthlyAmount: netMonthly,
        monthlyPaygWithholding: paygMonthly,
        monthlyAmount: netMonthly,
        isAfterTax: true,
      };
    }

    // Fallback: Calculate PAYG from monthlyAmount (legacy behavior for backward compatibility)
    const { netMonthly, paygMonthly } = calculateNetSalary(income.monthlyAmount);

    return {
      ...income,
      grossMonthlyAmount: income.monthlyAmount,
      netMonthlyAmount: netMonthly,
      monthlyPaygWithholding: paygMonthly,
      // Use net amount for cashflow calculations
      monthlyAmount: netMonthly,
      isAfterTax: true,
    };
  }

  // For rental income - typically received gross but may have deductions
  // For now, treat as gross (future: integrate property expense deductions)
  if (income.type === 'RENT' || income.type === 'RENTAL') {
    return {
      ...income,
      grossMonthlyAmount: income.monthlyAmount,
      netMonthlyAmount: income.monthlyAmount, // Rental income received gross
      monthlyPaygWithholding: 0,
      isAfterTax: false, // Will be taxed at end of year
    };
  }

  // For investment income - dividends may have franking credits
  // For now, treat as gross (future: integrate dividend imputation)
  if (income.type === 'INVESTMENT') {
    return {
      ...income,
      grossMonthlyAmount: income.monthlyAmount,
      netMonthlyAmount: income.monthlyAmount, // Investment income received gross
      monthlyPaygWithholding: 0,
      isAfterTax: false,
    };
  }

  // For other income types
  return {
    ...income,
    grossMonthlyAmount: income.monthlyAmount,
    netMonthlyAmount: income.monthlyAmount,
    monthlyPaygWithholding: 0,
    isAfterTax: false,
  };
}

/**
 * Normalize all income streams and calculate totals
 */
export function normalizeAllIncome(incomeStreams: IncomeStream[]): NormalizedIncomeResult {
  const normalized = incomeStreams.map(normalizeIncomeStream);

  const totalGrossMonthly = normalized.reduce(
    (sum, inc) => sum + inc.grossMonthlyAmount,
    0
  );

  const totalNetMonthly = normalized.reduce(
    (sum, inc) => sum + inc.netMonthlyAmount,
    0
  );

  const totalMonthlyPayg = normalized.reduce(
    (sum, inc) => sum + inc.monthlyPaygWithholding,
    0
  );

  return {
    incomeStreams: normalized,
    totalGrossMonthly,
    totalNetMonthly,
    totalMonthlyPayg,
  };
}

/**
 * Get the effective monthly income amount for cashflow calculations
 * This should be used everywhere income is factored into available cash
 */
export function getEffectiveMonthlyIncome(income: IncomeStream): number {
  const normalized = normalizeIncomeStream(income);
  return normalized.netMonthlyAmount;
}

/**
 * Calculate take-home pay from a gross salary amount
 */
export function calculateTakeHomePay(
  grossAmount: number,
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
): {
  grossAmount: number;
  netAmount: number;
  paygWithholding: number;
  medicareLevy: number;
  effectiveTaxRate: number;
} {
  // Convert to annual using centralized utility
  const annualGross = toAnnual(grossAmount, frequency as Frequency);

  const config = TaxEngine.getCurrentConfig();

  // Calculate PAYG
  const paygResult = TaxEngine.calculatePAYG({
    grossIncome: annualGross,
    frequency: 'ANNUALLY',
    hasTaxFreeThreshold: true,
  });

  // Calculate Medicare
  const medicareResult = TaxEngine.calculateMedicareLevy({
    taxableIncome: annualGross,
  }, config);

  // Calculate LITO offset
  const offsetsResult = TaxEngine.calculateAllOffsets({
    taxableIncome: annualGross,
    frankingCredits: 0,
  }, config);

  // Net tax after offsets
  const grossTax = paygResult.annualWithholding + medicareResult.medicareLevy;
  const netTax = Math.max(0, grossTax - offsetsResult.offsets.lito);
  const annualNet = annualGross - netTax;

  // Convert back to original frequency using centralized utility
  const divisor = periodsPerYear(frequency as Frequency);

  return {
    grossAmount: grossAmount,
    netAmount: annualNet / divisor,
    paygWithholding: paygResult.annualWithholding / divisor,
    medicareLevy: medicareResult.medicareLevy / divisor,
    effectiveTaxRate: annualGross > 0 ? (netTax / annualGross) * 100 : 0,
  };
}
