/**
 * Phase 20: Salary Processor
 * Handles gross/net salary conversions, PAYG, and superannuation calculations
 */

import { TaxYearConfig, SalaryInput, SalaryBreakdown, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { calculatePAYG, calculateGrossFromNet } from '../core/paygCalculator';
import { calculateMedicareLevy } from '../core/medicareLevyCalculator';

// =============================================================================
// Frequency Conversion Helpers
// =============================================================================

const PERIODS_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUALLY: 1,
};

function annualize(amount: number, frequency: string): number {
  return amount * (PERIODS_PER_YEAR[frequency] || 1);
}

function deannualize(annualAmount: number, frequency: string): number {
  return annualAmount / (PERIODS_PER_YEAR[frequency] || 1);
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    WEEKLY: 'per week',
    FORTNIGHTLY: 'per fortnight',
    MONTHLY: 'per month',
    QUARTERLY: 'per quarter',
    ANNUALLY: 'per year',
  };
  return labels[frequency] || frequency;
}

// =============================================================================
// Main Salary Processor
// =============================================================================

/**
 * Process salary input and calculate full breakdown
 * Handles both gross and net input scenarios
 */
export function processSalary(
  input: SalaryInput,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): SalaryBreakdown {
  const calculations: CalculationStep[] = [];
  const {
    amount,
    salaryType,
    payFrequency,
    salarySacrifice = 0,
    salarySacrificeFrequency = payFrequency,
    hasTaxFreeThreshold = true,
  } = input;

  // Step 1: Determine annual gross salary
  let annualGross: number;
  let annualNet: number;

  calculations.push({
    label: `Input Amount (${salaryType})`,
    value: amount,
    explanation: getFrequencyLabel(payFrequency),
  });

  if (salaryType === 'GROSS') {
    // Gross provided - calculate net
    annualGross = annualize(amount, payFrequency);

    calculations.push({
      label: 'Annual Gross Salary',
      value: annualGross,
      explanation: `$${amount.toLocaleString()} × ${PERIODS_PER_YEAR[payFrequency]} periods`,
    });
  } else {
    // Net provided - reverse calculate gross
    const annualNetInput = annualize(amount, payFrequency);
    const reverseCalc = calculateGrossFromNet(annualNetInput, 'ANNUALLY', hasTaxFreeThreshold, config);
    annualGross = reverseCalc.gross;

    calculations.push({
      label: 'Target Annual Net',
      value: annualNetInput,
    });

    calculations.push({
      label: 'Calculated Annual Gross',
      value: annualGross,
      explanation: `Reverse calculated from net (${reverseCalc.iterations} iterations)`,
    });
  }

  // Step 2: Calculate salary sacrifice (pre-tax)
  const annualSalarySacrifice = annualize(salarySacrifice, salarySacrificeFrequency);

  if (annualSalarySacrifice > 0) {
    calculations.push({
      label: 'Salary Sacrifice (Pre-tax)',
      value: annualSalarySacrifice,
      operation: '-',
      explanation: 'Reduces taxable income',
    });
  }

  // Step 3: Calculate taxable income (gross minus salary sacrifice)
  const taxableIncome = annualGross - annualSalarySacrifice;

  calculations.push({
    label: 'Taxable Income',
    value: taxableIncome,
    operation: '=',
    explanation: annualSalarySacrifice > 0 ? 'Gross minus salary sacrifice' : 'Same as gross salary',
  });

  // Step 4: Calculate PAYG withholding
  const paygResult = calculatePAYG({
    grossIncome: taxableIncome, // PAYG is on taxable income (after salary sacrifice)
    frequency: 'ANNUALLY',
    hasTaxFreeThreshold,
  });

  calculations.push({
    label: 'PAYG Withholding',
    value: paygResult.annualWithholding,
    operation: '-',
    explanation: 'Tax withheld by employer',
  });

  // Step 5: Calculate Medicare Levy
  const medicareResult = calculateMedicareLevy({ taxableIncome }, config);

  calculations.push({
    label: 'Medicare Levy',
    value: medicareResult.total,
    operation: '-',
    explanation: medicareResult.isShadeIn ? 'Shade-in rate applied' : '2% of taxable income',
  });

  // Step 6: Calculate net salary
  const totalTax = paygResult.annualWithholding + medicareResult.total;
  annualNet = annualGross - totalTax - annualSalarySacrifice;

  calculations.push({
    label: 'Total Tax (PAYG + Medicare)',
    value: totalTax,
    operation: '=',
  });

  calculations.push({
    label: 'Annual Net Salary (Take-home)',
    value: annualNet,
    operation: '=',
    explanation: 'What you receive after tax',
  });

  // Step 7: Calculate superannuation
  const superGuarantee = annualGross * config.superGuaranteeRate;
  const totalSuper = superGuarantee + annualSalarySacrifice;

  calculations.push({
    label: `Super Guarantee (${(config.superGuaranteeRate * 100).toFixed(1)}%)`,
    value: superGuarantee,
    explanation: 'Employer contribution on top of salary',
  });

  if (annualSalarySacrifice > 0) {
    calculations.push({
      label: 'Total Super (SG + Sacrifice)',
      value: totalSuper,
      explanation: 'Combined super contributions',
    });
  }

  // Step 8: Calculate per-period amounts
  const perPeriod = {
    gross: deannualize(annualGross, payFrequency),
    super: deannualize(totalSuper, payFrequency),
    tax: deannualize(totalTax, payFrequency),
    net: deannualize(annualNet, payFrequency),
    frequency: payFrequency,
  };

  calculations.push({
    label: `Net ${getFrequencyLabel(payFrequency)}`,
    value: perPeriod.net,
    operation: '=',
    explanation: 'Your take-home pay each pay period',
  });

  return {
    grossSalary: Math.round(annualGross * 100) / 100,
    netSalary: Math.round(annualNet * 100) / 100,
    superGuarantee: Math.round(superGuarantee * 100) / 100,
    salarySacrifice: Math.round(annualSalarySacrifice * 100) / 100,
    totalSuper: Math.round(totalSuper * 100) / 100,
    taxableIncome: Math.round(taxableIncome * 100) / 100,
    paygWithholding: Math.round(paygResult.annualWithholding * 100) / 100,
    medicareLevy: Math.round(medicareResult.total * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    perPeriod: {
      gross: Math.round(perPeriod.gross * 100) / 100,
      super: Math.round(perPeriod.super * 100) / 100,
      tax: Math.round(perPeriod.tax * 100) / 100,
      net: Math.round(perPeriod.net * 100) / 100,
      frequency: perPeriod.frequency,
    },
    calculations,
  };
}

/**
 * Quick salary summary for display
 */
export function getSalarySummary(
  annualGross: number,
  salarySacrifice: number = 0,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  gross: number;
  net: number;
  tax: number;
  super: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
} {
  const result = processSalary(
    {
      amount: annualGross,
      salaryType: 'GROSS',
      payFrequency: 'ANNUALLY',
      salarySacrifice,
      salarySacrificeFrequency: 'ANNUALLY',
    },
    config
  );

  // Determine marginal rate based on taxable income
  let marginalRate = 0;
  for (const bracket of config.brackets) {
    if (result.taxableIncome >= bracket.min) {
      marginalRate = bracket.rate;
    }
  }

  return {
    gross: result.grossSalary,
    net: result.netSalary,
    tax: result.totalTax,
    super: result.totalSuper,
    effectiveTaxRate: result.grossSalary > 0
      ? (result.totalTax / result.grossSalary) * 100
      : 0,
    marginalTaxRate: marginalRate * 100,
  };
}

/**
 * Calculate the optimal salary sacrifice amount
 * to maximize take-home + super while staying efficient on tax
 */
export function calculateOptimalSalarySacrifice(
  annualGross: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  optimalAmount: number;
  taxSavings: number;
  netImpact: number;
  reason: string;
} {
  // Calculate base position (no sacrifice)
  const baseResult = processSalary({
    amount: annualGross,
    salaryType: 'GROSS',
    payFrequency: 'ANNUALLY',
  }, config);

  // Calculate SG that will be made
  const superGuarantee = annualGross * config.superGuaranteeRate;

  // How much room in concessional cap?
  const remainingCap = config.concessionalCap - superGuarantee;

  if (remainingCap <= 0) {
    return {
      optimalAmount: 0,
      taxSavings: 0,
      netImpact: 0,
      reason: 'Super Guarantee already at or near concessional cap',
    };
  }

  // Calculate benefit of maxing out sacrifice
  const sacrificeAmount = Math.min(remainingCap, annualGross * 0.3); // Max 30% of salary

  const sacrificeResult = processSalary({
    amount: annualGross,
    salaryType: 'GROSS',
    payFrequency: 'ANNUALLY',
    salarySacrifice: sacrificeAmount,
    salarySacrificeFrequency: 'ANNUALLY',
  }, config);

  const taxSavings = baseResult.totalTax - sacrificeResult.totalTax;
  const netImpact = sacrificeResult.netSalary - baseResult.netSalary; // Will be negative

  // Super contribution tax is 15%, so effective saving is marginal rate - 15%
  // Only beneficial if marginal rate > 15%

  return {
    optimalAmount: Math.round(sacrificeAmount),
    taxSavings: Math.round(taxSavings),
    netImpact: Math.round(netImpact),
    reason: `Salary sacrifice of $${sacrificeAmount.toLocaleString()} would save $${taxSavings.toLocaleString()} in tax (taxed at 15% in super vs your marginal rate)`,
  };
}

/**
 * Compare two salary scenarios
 */
export function compareSalaryScenarios(
  scenario1: SalaryInput,
  scenario2: SalaryInput,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  scenario1: SalaryBreakdown;
  scenario2: SalaryBreakdown;
  differences: {
    gross: number;
    net: number;
    tax: number;
    super: number;
  };
} {
  const result1 = processSalary(scenario1, config);
  const result2 = processSalary(scenario2, config);

  return {
    scenario1: result1,
    scenario2: result2,
    differences: {
      gross: result2.grossSalary - result1.grossSalary,
      net: result2.netSalary - result1.netSalary,
      tax: result2.totalTax - result1.totalTax,
      super: result2.totalSuper - result1.totalSuper,
    },
  };
}
