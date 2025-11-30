/**
 * Phase 20: Tax Position Calculator
 * Aggregates all income, deductions, and calculates complete tax position
 */

import {
  TaxYearConfig,
  TaxPositionResult,
  IncomeBreakdown,
  DeductionBreakdown,
  TaxCalculation,
  TaxOffsets,
  TaxRecommendation,
  getCurrentFinancialYear,
  parseFinancialYear,
} from '../types';
import { getCurrentTaxYearConfig, getTaxYearConfig } from '../config/taxYearConfig';
import { calculateIncomeTax, calculateMarginalTax } from '../core/incomeTaxCalculator';
import { calculateMedicareLevy } from '../core/medicareLevyCalculator';
import { calculateAllOffsets, applyOffsets } from '../core/taxOffsets';
import { determineTaxability } from '../income/taxabilityRules';

// =============================================================================
// Types
// =============================================================================

export interface IncomeItem {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  propertyId?: string;
  investmentAccountId?: string;
  grossAmount?: number;
  paygWithholding?: number;
  frankingPercentage?: number;
  frankingCredits?: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  propertyId?: string;
  loanId?: string;
  investmentAccountId?: string;
}

export interface DepreciationItem {
  id: string;
  propertyId: string;
  currentYearDeduction: number;
  type: string; // DIV_40 or DIV_43
}

export interface TaxPositionCalculationInput {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  depreciations: DepreciationItem[];
  superContributions?: {
    concessional: number;
    nonConcessional: number;
  };
  financialYear?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert frequency to annual multiplier
 */
function getFrequencyMultiplier(frequency: string): number {
  const multipliers: Record<string, number> = {
    WEEKLY: 52,
    FORTNIGHTLY: 26,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUAL: 1,
    ANNUALLY: 1,
  };
  return multipliers[frequency?.toUpperCase()] || 1;
}

/**
 * Annualize an amount based on frequency
 */
function annualize(amount: number, frequency: string): number {
  return amount * getFrequencyMultiplier(frequency);
}

// =============================================================================
// Main Calculator
// =============================================================================

/**
 * Calculate complete tax position for a user
 */
export function calculateTaxPosition(
  input: TaxPositionCalculationInput,
  config?: TaxYearConfig
): TaxPositionResult {
  const fyConfig = config || getCurrentTaxYearConfig();
  const currentFY = getCurrentFinancialYear();
  const financialYear = input.financialYear || currentFY.year;

  // Initialize income breakdown
  const incomeBreakdown: IncomeBreakdown = {
    salary: 0,
    rental: 0,
    dividends: 0,
    interest: 0,
    capitalGains: 0,
    other: 0,
    total: 0,
    frankingCredits: 0,
  };

  // Track PAYG withheld
  let totalPaygWithheld = 0;

  // Process each income
  for (const income of input.incomes) {
    const annualAmount = income.grossAmount
      ? income.grossAmount
      : annualize(income.amount, income.frequency);

    // Determine taxability
    const taxResult = determineTaxability({
      incomeType: income.type,
      amount: annualAmount,
      frequency: income.frequency,
      propertyId: income.propertyId,
      investmentAccountId: income.investmentAccountId,
      frankingPercentage: income.frankingPercentage,
    });

    // Add to appropriate category
    const incomeType = income.type?.toUpperCase();
    switch (incomeType) {
      case 'SALARY':
        incomeBreakdown.salary += taxResult.taxableAmount;
        // Track PAYG withholding
        if (income.paygWithholding) {
          totalPaygWithheld += income.paygWithholding;
        }
        break;
      case 'RENT':
      case 'RENTAL':
        incomeBreakdown.rental += taxResult.taxableAmount;
        break;
      case 'DIVIDEND':
      case 'INVESTMENT':
        incomeBreakdown.dividends += taxResult.taxableAmount;
        incomeBreakdown.frankingCredits += taxResult.frankingCredits;
        break;
      case 'INTEREST':
        incomeBreakdown.interest += taxResult.taxableAmount;
        break;
      case 'CAPITAL_GAIN':
        incomeBreakdown.capitalGains += taxResult.taxableAmount;
        break;
      default:
        incomeBreakdown.other += taxResult.taxableAmount;
    }
  }

  // Calculate total assessable income (including franking credits gross-up)
  incomeBreakdown.total =
    incomeBreakdown.salary +
    incomeBreakdown.rental +
    incomeBreakdown.dividends +
    incomeBreakdown.interest +
    incomeBreakdown.capitalGains +
    incomeBreakdown.other;

  // Initialize deduction breakdown
  const deductionBreakdown: DeductionBreakdown = {
    workRelated: 0,
    property: 0,
    investment: 0,
    depreciation: 0,
    other: 0,
    total: 0,
  };

  // Process deductible expenses
  for (const expense of input.expenses) {
    if (!expense.isTaxDeductible) continue;

    const annualAmount = annualize(expense.amount, expense.frequency);

    if (expense.propertyId) {
      deductionBreakdown.property += annualAmount;
    } else if (expense.investmentAccountId) {
      deductionBreakdown.investment += annualAmount;
    } else {
      // Categorize by expense category
      const category = expense.category?.toUpperCase();
      if (category === 'LOAN_INTEREST') {
        deductionBreakdown.investment += annualAmount;
      } else {
        deductionBreakdown.other += annualAmount;
      }
    }
  }

  // Add depreciation deductions
  for (const depreciation of input.depreciations) {
    deductionBreakdown.depreciation += depreciation.currentYearDeduction;
    deductionBreakdown.property += depreciation.currentYearDeduction;
  }

  // Calculate total deductions
  deductionBreakdown.total =
    deductionBreakdown.workRelated +
    deductionBreakdown.property +
    deductionBreakdown.investment +
    deductionBreakdown.other;

  // Calculate taxable income
  const assessableIncome = incomeBreakdown.total;
  const taxableIncome = Math.max(0, assessableIncome - deductionBreakdown.total);

  // Calculate tax on taxable income
  const incomeTaxResult = calculateIncomeTax(taxableIncome, fyConfig);

  // Calculate Medicare levy
  const medicareResult = calculateMedicareLevy({ taxableIncome }, fyConfig);

  // Calculate offsets
  const offsetsResult = calculateAllOffsets({
    taxableIncome,
    frankingCredits: incomeBreakdown.frankingCredits,
  }, fyConfig);

  // Build tax offsets
  const offsets: TaxOffsets = {
    lito: offsetsResult.offsets.lito,
    sapto: 0, // Requires age information
    frankingCredits: offsetsResult.offsets.frankingCredits,
    foreignTax: 0,
    other: 0,
    total: offsetsResult.offsets.total,
  };

  // Calculate gross tax and apply offsets
  const grossTax = incomeTaxResult.taxPayable + medicareResult.total;
  const offsetApplication = applyOffsets(grossTax, offsetsResult.offsets);
  const netTax = offsetApplication.netTax;

  // Calculate effective rate
  const effectiveRate = taxableIncome > 0
    ? (netTax / taxableIncome) * 100
    : 0;

  // Build tax calculation
  const taxCalculation: TaxCalculation = {
    assessableIncome,
    taxableIncome,
    taxOnIncome: incomeTaxResult.taxPayable,
    medicareLevy: medicareResult.medicareLevy,
    medicareSurcharge: medicareResult.medicareSurcharge,
    grossTax,
    offsets,
    netTax,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    marginalRate: incomeTaxResult.marginalRate,
  };

  // Calculate estimated refund/owing
  const estimatedRefund = totalPaygWithheld - netTax;

  // Build recommendations
  const recommendations = generateRecommendations(
    incomeBreakdown,
    deductionBreakdown,
    taxCalculation,
    input.superContributions,
    fyConfig
  );

  // Build warnings
  const warnings: string[] = [];

  // Check if property deductions exceed rental income (negative gearing)
  if (deductionBreakdown.property > incomeBreakdown.rental && incomeBreakdown.rental > 0) {
    const negativeGearing = deductionBreakdown.property - incomeBreakdown.rental;
    warnings.push(
      `Negative gearing: Property deductions exceed rental income by $${Math.round(negativeGearing).toLocaleString()}`
    );
  }

  return {
    financialYear,
    income: incomeBreakdown,
    deductions: deductionBreakdown,
    tax: taxCalculation,
    paygWithheld: Math.round(totalPaygWithheld),
    estimatedRefund: Math.round(estimatedRefund),
    superContributions: {
      concessional: input.superContributions?.concessional || 0,
      nonConcessional: input.superContributions?.nonConcessional || 0,
      total: (input.superContributions?.concessional || 0) + (input.superContributions?.nonConcessional || 0),
      division293Tax: calculateDivision293TaxAmount(
        taxableIncome,
        input.superContributions?.concessional || 0,
        fyConfig
      ),
    },
    warnings,
    recommendations,
  };
}

/**
 * Calculate Division 293 tax amount
 */
function calculateDivision293TaxAmount(
  taxableIncome: number,
  concessionalContributions: number,
  config: TaxYearConfig
): number {
  const combinedIncome = taxableIncome + concessionalContributions;
  const threshold = config.division293Threshold;

  if (combinedIncome <= threshold) {
    return 0;
  }

  const excessAmount = combinedIncome - threshold;
  const taxableAmount = Math.min(concessionalContributions, excessAmount);

  return Math.round(taxableAmount * 0.15);
}

/**
 * Generate tax optimization recommendations
 */
function generateRecommendations(
  income: IncomeBreakdown,
  deductions: DeductionBreakdown,
  tax: TaxCalculation,
  superContributions: { concessional: number; nonConcessional: number } | undefined,
  config: TaxYearConfig
): TaxRecommendation[] {
  const recommendations: TaxRecommendation[] = [];

  // Check salary sacrifice opportunity
  if (income.salary > 100000 && tax.marginalRate >= 0.32) {
    const currentConcessional = superContributions?.concessional || 0;
    const remainingCap = config.concessionalCap - currentConcessional;

    if (remainingCap > 5000) {
      const potentialSavings = remainingCap * (tax.marginalRate - 0.15);
      recommendations.push({
        id: 'salary-sacrifice',
        type: 'SAVINGS',
        title: 'Salary Sacrifice Opportunity',
        description: `You have $${Math.round(remainingCap).toLocaleString()} unused concessional cap. Salary sacrifice could save ${Math.round((tax.marginalRate - 0.15) * 100)}% compared to income tax.`,
        potentialSavings: Math.round(potentialSavings),
        action: 'Consider increasing salary sacrifice contributions',
        priority: 'HIGH',
      });
    }
  }

  // Check negative gearing
  if (deductions.property > income.rental && income.rental > 0) {
    const taxBenefit = (deductions.property - income.rental) * tax.marginalRate;
    recommendations.push({
      id: 'negative-gearing',
      type: 'INFO',
      title: 'Negative Gearing Active',
      description: `Your investment property deductions exceed rental income, providing tax benefits.`,
      potentialSavings: Math.round(taxBenefit),
      priority: 'LOW',
    });
  }

  // Check franking credits
  if (income.frankingCredits > 0) {
    recommendations.push({
      id: 'franking-credits',
      type: 'INFO',
      title: 'Franking Credits Utilized',
      description: `You have $${Math.round(income.frankingCredits).toLocaleString()} in franking credits reducing your tax liability.`,
      priority: 'LOW',
    });
  }

  // Check if LITO applies
  if (tax.offsets.lito > 0) {
    recommendations.push({
      id: 'lito-applied',
      type: 'INFO',
      title: 'Low Income Tax Offset Applied',
      description: `LITO of $${Math.round(tax.offsets.lito).toLocaleString()} has been applied to reduce your tax.`,
      priority: 'LOW',
    });
  }

  // Check for high effective rate
  if (tax.effectiveRate > 30) {
    recommendations.push({
      id: 'high-effective-rate',
      type: 'OPTIMIZATION',
      title: 'High Effective Tax Rate',
      description: `Your effective tax rate is ${tax.effectiveRate.toFixed(1)}%. Consider tax planning strategies.`,
      action: 'Review deduction opportunities and salary sacrifice',
      priority: 'MEDIUM',
    });
  }

  // Check for missing depreciation
  if (income.rental > 0 && deductions.depreciation === 0) {
    recommendations.push({
      id: 'missing-depreciation',
      type: 'WARNING',
      title: 'No Depreciation Claimed',
      description: 'You have rental income but no depreciation deductions. A depreciation schedule could provide significant deductions.',
      action: 'Consider obtaining a quantity surveyor depreciation report',
      priority: 'HIGH',
    });
  }

  return recommendations;
}

/**
 * Compare tax position between two scenarios or years
 */
export function compareTaxPositions(
  current: TaxPositionResult,
  comparison: TaxPositionResult
): {
  taxDifference: number;
  percentageChange: number;
  improvements: string[];
  deteriorations: string[];
} {
  const taxDifference = comparison.tax.netTax - current.tax.netTax;
  const percentageChange = current.tax.netTax > 0
    ? ((taxDifference / current.tax.netTax) * 100)
    : 0;

  const improvements: string[] = [];
  const deteriorations: string[] = [];

  // Compare key metrics
  if (comparison.tax.effectiveRate < current.tax.effectiveRate) {
    improvements.push(`Effective rate decreased from ${current.tax.effectiveRate.toFixed(1)}% to ${comparison.tax.effectiveRate.toFixed(1)}%`);
  } else if (comparison.tax.effectiveRate > current.tax.effectiveRate) {
    deteriorations.push(`Effective rate increased from ${current.tax.effectiveRate.toFixed(1)}% to ${comparison.tax.effectiveRate.toFixed(1)}%`);
  }

  if (comparison.estimatedRefund > current.estimatedRefund) {
    improvements.push(`Estimated refund increased by $${Math.round(comparison.estimatedRefund - current.estimatedRefund).toLocaleString()}`);
  } else if (comparison.estimatedRefund < current.estimatedRefund) {
    deteriorations.push(`Estimated refund decreased by $${Math.round(current.estimatedRefund - comparison.estimatedRefund).toLocaleString()}`);
  }

  return {
    taxDifference: Math.round(taxDifference),
    percentageChange: Math.round(percentageChange * 100) / 100,
    improvements,
    deteriorations,
  };
}

/**
 * Calculate tax for a quick scenario without full user data
 */
export function calculateQuickTaxPosition(
  taxableIncome: number,
  deductions: number = 0,
  frankingCredits: number = 0,
  financialYear?: string
): {
  taxableIncome: number;
  taxPayable: number;
  medicareLevy: number;
  netTax: number;
  effectiveRate: number;
  marginalRate: number;
} {
  const config = financialYear ? getTaxYearConfig(financialYear) : getCurrentTaxYearConfig();

  const netTaxableIncome = Math.max(0, taxableIncome - deductions);
  const incomeTax = calculateIncomeTax(netTaxableIncome, config);
  const medicare = calculateMedicareLevy({ taxableIncome: netTaxableIncome }, config);
  const offsets = calculateAllOffsets({ taxableIncome: netTaxableIncome, frankingCredits }, config);

  const grossTax = incomeTax.taxPayable + medicare.total;
  const offsetApplication = applyOffsets(grossTax, offsets.offsets);

  return {
    taxableIncome: netTaxableIncome,
    taxPayable: Math.round(incomeTax.taxPayable),
    medicareLevy: Math.round(medicare.total),
    netTax: Math.round(offsetApplication.netTax),
    effectiveRate: netTaxableIncome > 0
      ? Math.round((offsetApplication.netTax / netTaxableIncome) * 10000) / 100
      : 0,
    marginalRate: incomeTax.marginalRate,
  };
}
