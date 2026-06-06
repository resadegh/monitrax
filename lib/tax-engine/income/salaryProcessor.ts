/**
 * Phase 20: Salary Processor
 * Handles gross/net salary conversions, PAYG, and superannuation calculations
 */

import { TaxYearConfig, SalaryInput, SalaryBreakdown, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { calculatePAYG, calculateGrossFromNet, calculatePAYGDecimal, calculateGrossFromNetDecimal } from '../core/paygCalculator';
import { calculateMedicareLevy, calculateMedicareLevyDecimal } from '../core/medicareLevyCalculator';
import { toAnnual, periodsPerYear, toAnnualDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// Frequency Conversion Helpers - Use centralized utilities from lib/utils/frequencies.ts
// =============================================================================

function annualize(amount: number, frequency: string): number {
  return toAnnual(amount, frequency as Frequency);
}

function deannualize(annualAmount: number, frequency: string): number {
  return annualAmount / periodsPerYear(frequency as Frequency);
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
  let annualNet: number = 0; // Initialize to satisfy TypeScript, will be set below
  let userProvidedNet = false; // Track if user provided NET input

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
      explanation: `$${amount.toLocaleString()} × ${periodsPerYear(payFrequency as Frequency)} periods`,
    });
  } else {
    // Net provided - reverse calculate gross, but PRESERVE the user's net input
    const annualNetInput = annualize(amount, payFrequency);
    annualNet = annualNetInput; // Use user's NET input directly - this is the source of truth
    userProvidedNet = true;

    const reverseCalc = calculateGrossFromNet(annualNetInput, 'ANNUALLY', hasTaxFreeThreshold, config);
    annualGross = reverseCalc.gross;

    calculations.push({
      label: 'Annual Net (User Input)',
      value: annualNetInput,
      explanation: 'Your take-home pay - this is the source of truth',
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

  // Only calculate net if user provided GROSS - if they provided NET, we already have it
  if (!userProvidedNet) {
    annualNet = annualGross - totalTax - annualSalarySacrifice;
  }
  // Note: if userProvidedNet is true, annualNet was already set to the user's input

  calculations.push({
    label: 'Total Tax (PAYG + Medicare)',
    value: totalTax,
    operation: '=',
  });

  calculations.push({
    label: 'Annual Net Salary (Take-home)',
    value: annualNet,
    operation: '=',
    explanation: userProvidedNet ? 'Your specified take-home pay' : 'What you receive after tax',
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

// =============================================================================
// Q-DEC PR 2.D.3d — Decimal sibling path
// =============================================================================

export interface SalaryBreakdownDecimal {
  grossSalary: Decimal;
  netSalary: Decimal;
  superGuarantee: Decimal;
  salarySacrifice: Decimal;
  totalSuper: Decimal;
  taxableIncome: Decimal;
  paygWithholding: Decimal;
  medicareLevy: Decimal;
  totalTax: Decimal;
  perPeriod: {
    gross: Decimal;
    super: Decimal;
    tax: Decimal;
    net: Decimal;
    frequency: SalaryInput['payFrequency'];
  };
}

/**
 * Decimal sibling of `processSalary`. Composes:
 *   - `toAnnualDecimal` for frequency annualisation
 *   - `calculateGrossFromNetDecimal` (binary search) for NET → GROSS
 *   - `calculatePAYGDecimal` (NAT 1004 with whole-dollar rounding preserved)
 *   - `calculateMedicareLevyDecimal` (shade-in + surcharge)
 *
 * Final outputs rounded to 2 dp HALF_EVEN to match Float's
 * `Math.round(x * 100) / 100`.
 */
export function processSalaryDecimal(
  input: SalaryInput,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): SalaryBreakdownDecimal {
  const {
    amount,
    salaryType,
    payFrequency,
    salarySacrifice = 0,
    salarySacrificeFrequency = payFrequency,
    hasTaxFreeThreshold = true,
  } = input;

  const amountDec = toDecimal(amount) ?? new Decimal(0);
  const annualizeDecimal = (val: number | string | Decimal, freq: string): Decimal =>
    toAnnualDecimal(val, freq as Frequency);

  let annualGross: Decimal;
  let annualNet: Decimal = new Decimal(0);
  let userProvidedNet = false;

  if (salaryType === 'GROSS') {
    annualGross = annualizeDecimal(amountDec, payFrequency);
  } else {
    const annualNetInput = annualizeDecimal(amountDec, payFrequency);
    annualNet = annualNetInput;
    userProvidedNet = true;
    const reverseCalc = calculateGrossFromNetDecimal(annualNetInput, 'ANNUALLY', hasTaxFreeThreshold, config);
    annualGross = reverseCalc.gross;
  }

  const annualSalarySacrifice = annualizeDecimal(salarySacrifice, salarySacrificeFrequency);
  const taxableIncome = annualGross.minus(annualSalarySacrifice);

  const paygResult = calculatePAYGDecimal({
    grossIncome: taxableIncome,
    frequency: 'ANNUALLY',
    hasTaxFreeThreshold,
  });
  const medicareResult = calculateMedicareLevyDecimal({ taxableIncome }, config);
  const totalTax = paygResult.annualWithholding.plus(medicareResult.total);

  if (!userProvidedNet) {
    annualNet = annualGross.minus(totalTax).minus(annualSalarySacrifice);
  }

  const superGuarantee = annualGross.times(config.superGuaranteeRate);
  const totalSuper = superGuarantee.plus(annualSalarySacrifice);

  const periodsPerYearDec = new Decimal(periodsPerYear(payFrequency as Frequency));
  const deannualizeDec = (annual: Decimal): Decimal => annual.div(periodsPerYearDec);

  const perPeriod = {
    gross: deannualizeDec(annualGross),
    super: deannualizeDec(totalSuper),
    tax: deannualizeDec(totalTax),
    net: deannualizeDec(annualNet),
    frequency: payFrequency,
  };

  const round2 = (v: Decimal): Decimal => v.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  return {
    grossSalary: round2(annualGross),
    netSalary: round2(annualNet),
    superGuarantee: round2(superGuarantee),
    salarySacrifice: round2(annualSalarySacrifice),
    totalSuper: round2(totalSuper),
    taxableIncome: round2(taxableIncome),
    paygWithholding: round2(paygResult.annualWithholding),
    medicareLevy: round2(medicareResult.total),
    totalTax: round2(totalTax),
    perPeriod: {
      gross: round2(perPeriod.gross),
      super: round2(perPeriod.super),
      tax: round2(perPeriod.tax),
      net: round2(perPeriod.net),
      frequency: perPeriod.frequency,
    },
  };
}
