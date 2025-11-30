/**
 * Phase 20: Income Tax Calculator
 * Calculates Australian income tax based on ATO brackets
 */

import { TaxYearConfig, TaxBracket, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

export interface IncomeTaxResult {
  taxableIncome: number;
  taxPayable: number;
  effectiveRate: number;
  marginalRate: number;
  calculations: CalculationStep[];
}

/**
 * Calculate income tax for a given taxable income
 */
export function calculateIncomeTax(
  taxableIncome: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): IncomeTaxResult {
  const calculations: CalculationStep[] = [];

  if (taxableIncome <= 0) {
    return {
      taxableIncome: 0,
      taxPayable: 0,
      effectiveRate: 0,
      marginalRate: 0,
      calculations: [{ label: 'No taxable income', value: 0 }],
    };
  }

  calculations.push({
    label: 'Taxable Income',
    value: taxableIncome,
    explanation: 'Your total assessable income minus allowable deductions',
  });

  // Find the applicable bracket
  let tax = 0;
  let marginalRate = 0;
  let appliedBracket: TaxBracket | null = null;

  for (const bracket of config.brackets) {
    const bracketMax = bracket.max ?? Infinity;

    if (taxableIncome <= bracket.min) {
      break;
    }

    if (taxableIncome <= bracketMax) {
      // This is the bracket where the income falls
      const incomeInBracket = taxableIncome - bracket.min + 1;
      tax = bracket.baseAmount + incomeInBracket * bracket.rate;
      marginalRate = bracket.rate;
      appliedBracket = bracket;

      calculations.push({
        label: `Base tax (up to $${bracket.min.toLocaleString()})`,
        value: bracket.baseAmount,
        operation: '+',
      });

      calculations.push({
        label: `Tax on income in bracket ($${incomeInBracket.toLocaleString()} × ${(bracket.rate * 100).toFixed(0)}%)`,
        value: incomeInBracket * bracket.rate,
        operation: '+',
        explanation: `Income above $${bracket.min.toLocaleString()} taxed at ${(bracket.rate * 100).toFixed(0)}%`,
      });

      break;
    }
  }

  // Handle income above highest bracket
  if (!appliedBracket && config.brackets.length > 0) {
    const lastBracket = config.brackets[config.brackets.length - 1];
    const incomeInBracket = taxableIncome - lastBracket.min + 1;
    tax = lastBracket.baseAmount + incomeInBracket * lastBracket.rate;
    marginalRate = lastBracket.rate;

    calculations.push({
      label: `Base tax`,
      value: lastBracket.baseAmount,
      operation: '+',
    });

    calculations.push({
      label: `Tax on highest bracket income`,
      value: incomeInBracket * lastBracket.rate,
      operation: '+',
    });
  }

  const taxPayable = Math.max(0, Math.round(tax * 100) / 100);
  const effectiveRate = taxableIncome > 0 ? (taxPayable / taxableIncome) * 100 : 0;

  calculations.push({
    label: 'Total Income Tax',
    value: taxPayable,
    operation: '=',
    explanation: `Effective tax rate: ${effectiveRate.toFixed(1)}%`,
  });

  return {
    taxableIncome,
    taxPayable,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    marginalRate: marginalRate * 100,
    calculations,
  };
}

/**
 * Calculate tax on a specific amount at a given marginal rate
 * Useful for "what if" calculations
 */
export function calculateMarginalTax(
  additionalIncome: number,
  currentTaxableIncome: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { tax: number; marginalRate: number } {
  const currentTax = calculateIncomeTax(currentTaxableIncome, config).taxPayable;
  const newTax = calculateIncomeTax(currentTaxableIncome + additionalIncome, config).taxPayable;

  return {
    tax: newTax - currentTax,
    marginalRate: additionalIncome > 0 ? ((newTax - currentTax) / additionalIncome) * 100 : 0,
  };
}

/**
 * Calculate tax savings from a deduction
 */
export function calculateDeductionSavings(
  deductionAmount: number,
  currentTaxableIncome: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { savings: number; effectiveRate: number } {
  const currentTax = calculateIncomeTax(currentTaxableIncome, config).taxPayable;
  const newTax = calculateIncomeTax(Math.max(0, currentTaxableIncome - deductionAmount), config).taxPayable;

  const savings = currentTax - newTax;

  return {
    savings,
    effectiveRate: deductionAmount > 0 ? (savings / deductionAmount) * 100 : 0,
  };
}

/**
 * Get a human-readable tax bracket description
 */
export function getTaxBracketDescription(
  taxableIncome: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): string {
  for (const bracket of config.brackets) {
    const max = bracket.max ?? Infinity;
    if (taxableIncome <= max) {
      if (bracket.rate === 0) {
        return 'Tax-free threshold';
      }
      const maxStr = bracket.max ? `$${bracket.max.toLocaleString()}` : 'and above';
      return `$${bracket.min.toLocaleString()} – ${maxStr} (${(bracket.rate * 100).toFixed(0)}% marginal rate)`;
    }
  }
  return 'Highest tax bracket';
}
