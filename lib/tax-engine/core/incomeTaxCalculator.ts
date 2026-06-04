/**
 * Phase 20: Income Tax Calculator
 * Calculates Australian income tax based on ATO brackets
 */

import { TaxYearConfig, TaxBracket, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { Decimal, toDecimal } from '@/lib/decimal';

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

// =============================================================================
// Q-DEC PR 2.D.1 — Decimal sibling path
// =============================================================================
//
// Composes ATO progressive brackets in Decimal end-to-end. Mirrors the
// Float `calculateIncomeTax` exactly: same `incomeInBracket = taxableIncome -
// min + 1` formula, same `Math.max(0, ...)` floor, same bracket-walk.
//
// **Intentional rounding preserved.** Float's final step is
// `Math.max(0, Math.round(tax * 100) / 100)` — round to the cent. The
// Decimal sibling preserves this AT THE OUTPUT BOUNDARY only (we round
// `taxPayable` to 2 dp HALF_EVEN), but keeps full precision through
// the bracket walk. Effective rate and marginal rate stay in Decimal.

export interface IncomeTaxResultDecimal {
  taxableIncome: Decimal;
  taxPayable: Decimal;
  effectiveRate: Decimal;
  marginalRate: Decimal;
}

export function calculateIncomeTaxDecimal(
  taxableIncome: number | string | Decimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): IncomeTaxResultDecimal {
  const taxableDec = toDecimal(taxableIncome) ?? new Decimal(0);

  if (taxableDec.lte(0)) {
    return {
      taxableIncome: new Decimal(0),
      taxPayable: new Decimal(0),
      effectiveRate: new Decimal(0),
      marginalRate: new Decimal(0),
    };
  }

  let tax = new Decimal(0);
  let marginalRate = new Decimal(0);
  let appliedBracket: TaxBracket | null = null;

  for (const bracket of config.brackets) {
    const bracketMin = new Decimal(bracket.min);
    const bracketMax = bracket.max == null ? null : new Decimal(bracket.max);

    if (taxableDec.lte(bracketMin)) break;

    if (bracketMax == null || taxableDec.lte(bracketMax)) {
      // Matches Float's `taxableIncome - bracket.min + 1`.
      const incomeInBracket = taxableDec.minus(bracketMin).plus(1);
      tax = new Decimal(bracket.baseAmount).plus(incomeInBracket.times(bracket.rate));
      marginalRate = new Decimal(bracket.rate);
      appliedBracket = bracket;
      break;
    }
  }

  if (!appliedBracket && config.brackets.length > 0) {
    const lastBracket = config.brackets[config.brackets.length - 1];
    const incomeInBracket = taxableDec.minus(lastBracket.min).plus(1);
    tax = new Decimal(lastBracket.baseAmount).plus(incomeInBracket.times(lastBracket.rate));
    marginalRate = new Decimal(lastBracket.rate);
  }

  // Mirror Float's `Math.max(0, Math.round(tax * 100) / 100)`.
  const taxPayable = Decimal.max(
    new Decimal(0),
    tax.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN),
  );
  const effectiveRate = taxableDec.gt(0)
    ? taxPayable.div(taxableDec).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
    : new Decimal(0);

  return {
    taxableIncome: taxableDec,
    taxPayable,
    effectiveRate,
    marginalRate: marginalRate.times(100),
  };
}

/**
 * Decimal sibling of `calculateMarginalTax`.
 */
export function calculateMarginalTaxDecimal(
  additionalIncome: number | string | Decimal,
  currentTaxableIncome: number | string | Decimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): { tax: Decimal; marginalRate: Decimal } {
  const additionalDec = toDecimal(additionalIncome) ?? new Decimal(0);
  const currentDec = toDecimal(currentTaxableIncome) ?? new Decimal(0);

  const currentTax = calculateIncomeTaxDecimal(currentDec, config).taxPayable;
  const newTax = calculateIncomeTaxDecimal(currentDec.plus(additionalDec), config).taxPayable;
  const tax = newTax.minus(currentTax);

  return {
    tax,
    marginalRate: additionalDec.gt(0) ? tax.div(additionalDec).times(100) : new Decimal(0),
  };
}

/**
 * Decimal sibling of `calculateDeductionSavings`.
 */
export function calculateDeductionSavingsDecimal(
  deductionAmount: number | string | Decimal,
  currentTaxableIncome: number | string | Decimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): { savings: Decimal; effectiveRate: Decimal } {
  const deductionDec = toDecimal(deductionAmount) ?? new Decimal(0);
  const currentDec = toDecimal(currentTaxableIncome) ?? new Decimal(0);

  const currentTax = calculateIncomeTaxDecimal(currentDec, config).taxPayable;
  const reducedTaxable = Decimal.max(new Decimal(0), currentDec.minus(deductionDec));
  const newTax = calculateIncomeTaxDecimal(reducedTaxable, config).taxPayable;
  const savings = currentTax.minus(newTax);

  return {
    savings,
    effectiveRate: deductionDec.gt(0) ? savings.div(deductionDec).times(100) : new Decimal(0),
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
