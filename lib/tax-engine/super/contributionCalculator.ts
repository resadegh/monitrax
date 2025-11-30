/**
 * Phase 20: Superannuation Contribution Calculator
 * Calculates SG, salary sacrifice, and personal contributions
 */

import { TaxYearConfig, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

// =============================================================================
// Types
// =============================================================================

export interface SuperContributionInput {
  grossSalary: number;
  salarySacrifice?: number;
  personalDeductible?: number;
  personalNonDeductible?: number;
  spouseContribution?: number;
}

export interface SuperContributionResult {
  // Super Guarantee
  superGuarantee: number;
  superGuaranteeRate: number;

  // Concessional (pre-tax) contributions
  salarySacrifice: number;
  personalDeductible: number;
  totalConcessional: number;

  // Non-concessional (after-tax) contributions
  personalNonDeductible: number;
  spouseContribution: number;
  totalNonConcessional: number;

  // Totals
  totalContributions: number;
  employerTotal: number;
  employeeTotal: number;

  // Tax impact
  taxSavingsFromSalarySacrifice: number;
  contributionsTax: number; // 15% on concessional
  division293Tax: number;

  // Calculations breakdown
  calculations: CalculationStep[];
}

// Maximum super contribution base (quarterly) for SG
const MAX_SUPER_CONTRIBUTION_BASE_2024_25 = 62500; // Quarterly

// =============================================================================
// Super Guarantee Calculator
// =============================================================================

/**
 * Calculate Super Guarantee (SG) contribution
 * SG is calculated on ordinary time earnings (OTE)
 */
export function calculateSuperGuarantee(
  grossSalary: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { amount: number; rate: number; calculations: CalculationStep[] } {
  const calculations: CalculationStep[] = [];

  // Apply maximum super contribution base (annualized)
  const annualMaxBase = MAX_SUPER_CONTRIBUTION_BASE_2024_25 * 4;
  const eligibleEarnings = Math.min(grossSalary, annualMaxBase);

  calculations.push({
    label: 'Gross salary',
    value: grossSalary,
    operation: '=',
    explanation: 'Annual gross salary before tax',
  });

  if (grossSalary > annualMaxBase) {
    calculations.push({
      label: 'Maximum super contribution base',
      value: annualMaxBase,
      operation: '=',
      explanation: `SG is only calculated on first $${annualMaxBase.toLocaleString()} (quarterly max $${MAX_SUPER_CONTRIBUTION_BASE_2024_25.toLocaleString()})`,
    });
  }

  const sgAmount = eligibleEarnings * config.superGuaranteeRate;

  calculations.push({
    label: `Super Guarantee (${(config.superGuaranteeRate * 100).toFixed(1)}%)`,
    value: sgAmount,
    operation: '*',
    explanation: `$${eligibleEarnings.toLocaleString()} × ${(config.superGuaranteeRate * 100).toFixed(1)}%`,
  });

  return {
    amount: Math.round(sgAmount * 100) / 100,
    rate: config.superGuaranteeRate,
    calculations,
  };
}

// =============================================================================
// Full Contribution Calculator
// =============================================================================

/**
 * Calculate all superannuation contributions and their tax implications
 */
export function calculateSuperContributions(
  input: SuperContributionInput,
  marginalRate: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): SuperContributionResult {
  const calculations: CalculationStep[] = [];

  // Calculate SG
  const sgResult = calculateSuperGuarantee(input.grossSalary, config);
  calculations.push(...sgResult.calculations);

  // Concessional contributions
  const salarySacrifice = input.salarySacrifice || 0;
  const personalDeductible = input.personalDeductible || 0;
  const totalConcessional = sgResult.amount + salarySacrifice + personalDeductible;

  if (salarySacrifice > 0) {
    calculations.push({
      label: 'Salary sacrifice',
      value: salarySacrifice,
      operation: '+',
      explanation: 'Pre-tax contributions from salary',
    });
  }

  if (personalDeductible > 0) {
    calculations.push({
      label: 'Personal deductible contributions',
      value: personalDeductible,
      operation: '+',
      explanation: 'Personal contributions with tax deduction claimed',
    });
  }

  calculations.push({
    label: 'Total concessional contributions',
    value: totalConcessional,
    operation: '=',
    explanation: 'SG + Salary Sacrifice + Personal Deductible',
  });

  // Non-concessional contributions
  const personalNonDeductible = input.personalNonDeductible || 0;
  const spouseContribution = input.spouseContribution || 0;
  const totalNonConcessional = personalNonDeductible + spouseContribution;

  if (totalNonConcessional > 0) {
    calculations.push({
      label: 'Total non-concessional contributions',
      value: totalNonConcessional,
      operation: '=',
      explanation: 'After-tax contributions (no tax deduction)',
    });
  }

  // Calculate tax savings from salary sacrifice
  // Tax saved = (salary sacrifice × marginal rate) - (salary sacrifice × 15% super tax)
  const taxSavingsFromSalarySacrifice = salarySacrifice > 0
    ? salarySacrifice * (marginalRate - 0.15)
    : 0;

  if (salarySacrifice > 0 && taxSavingsFromSalarySacrifice > 0) {
    calculations.push({
      label: 'Tax savings from salary sacrifice',
      value: taxSavingsFromSalarySacrifice,
      operation: '=',
      explanation: `$${salarySacrifice.toLocaleString()} × (${(marginalRate * 100).toFixed(0)}% - 15%) = $${Math.round(taxSavingsFromSalarySacrifice).toLocaleString()}`,
    });
  }

  // Contributions tax (15% on concessional)
  const contributionsTax = totalConcessional * 0.15;

  calculations.push({
    label: 'Contributions tax (15%)',
    value: contributionsTax,
    operation: '=',
    explanation: 'Tax paid by super fund on concessional contributions',
  });

  // Division 293 tax calculation
  const division293Tax = calculateDivision293Tax(
    input.grossSalary - salarySacrifice, // Taxable income
    totalConcessional,
    config
  );

  if (division293Tax > 0) {
    calculations.push({
      label: 'Division 293 tax',
      value: division293Tax,
      operation: '+',
      explanation: `Additional 15% tax on super as income + super exceeds $${config.division293Threshold.toLocaleString()}`,
    });
  }

  // Totals
  const totalContributions = totalConcessional + totalNonConcessional;
  const employerTotal = sgResult.amount;
  const employeeTotal = salarySacrifice + personalDeductible + totalNonConcessional;

  return {
    superGuarantee: sgResult.amount,
    superGuaranteeRate: sgResult.rate,
    salarySacrifice,
    personalDeductible,
    totalConcessional,
    personalNonDeductible,
    spouseContribution,
    totalNonConcessional,
    totalContributions,
    employerTotal,
    employeeTotal,
    taxSavingsFromSalarySacrifice: Math.max(0, Math.round(taxSavingsFromSalarySacrifice)),
    contributionsTax: Math.round(contributionsTax),
    division293Tax,
    calculations,
  };
}

// =============================================================================
// Division 293 Tax
// =============================================================================

/**
 * Calculate Division 293 tax for high income earners
 * Applies additional 15% tax when income + super contributions > $250,000
 */
export function calculateDivision293Tax(
  taxableIncome: number,
  concessionalContributions: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): number {
  const combinedIncome = taxableIncome + concessionalContributions;
  const threshold = config.division293Threshold;

  if (combinedIncome <= threshold) {
    return 0;
  }

  // Division 293 tax is 15% on the lesser of:
  // 1. Concessional contributions
  // 2. Amount by which combined income exceeds threshold
  const excessAmount = combinedIncome - threshold;
  const taxableAmount = Math.min(concessionalContributions, excessAmount);

  return Math.round(taxableAmount * 0.15);
}

// =============================================================================
// Co-contribution Calculator
// =============================================================================

/**
 * Calculate government co-contribution eligibility
 * For low income earners making non-concessional contributions
 */
export function calculateCoContribution(
  taxableIncome: number,
  personalNonDeductibleContribution: number
): {
  eligible: boolean;
  amount: number;
  explanation: string;
} {
  // 2024-25 thresholds
  const lowerThreshold = 45400;
  const upperThreshold = 60400;
  const maxCoContribution = 500;
  const matchingRate = 0.5; // 50 cents per dollar

  if (taxableIncome > upperThreshold) {
    return {
      eligible: false,
      amount: 0,
      explanation: `Income exceeds upper threshold of $${upperThreshold.toLocaleString()}`,
    };
  }

  if (personalNonDeductibleContribution === 0) {
    return {
      eligible: false,
      amount: 0,
      explanation: 'No eligible non-concessional contributions made',
    };
  }

  // Calculate base co-contribution
  const baseCoContribution = Math.min(
    personalNonDeductibleContribution * matchingRate,
    maxCoContribution
  );

  if (taxableIncome <= lowerThreshold) {
    return {
      eligible: true,
      amount: baseCoContribution,
      explanation: `Full co-contribution: $${baseCoContribution.toLocaleString()} (50c per $1 up to $${maxCoContribution})`,
    };
  }

  // Phase-out calculation
  const reductionRate = maxCoContribution / (upperThreshold - lowerThreshold);
  const reduction = (taxableIncome - lowerThreshold) * reductionRate;
  const adjustedCoContribution = Math.max(0, baseCoContribution - reduction);

  return {
    eligible: adjustedCoContribution > 0,
    amount: Math.round(adjustedCoContribution),
    explanation: adjustedCoContribution > 0
      ? `Reduced co-contribution: $${Math.round(adjustedCoContribution)} due to income phase-out`
      : 'Co-contribution fully phased out due to income level',
  };
}

// =============================================================================
// Spouse Contribution Tax Offset
// =============================================================================

/**
 * Calculate spouse contribution tax offset
 * For contributions made to a low-income spouse's super
 */
export function calculateSpouseContributionOffset(
  spouseIncome: number,
  contributionAmount: number
): {
  eligible: boolean;
  offset: number;
  explanation: string;
} {
  // 2024-25 thresholds
  const lowerThreshold = 37000;
  const upperThreshold = 40000;
  const maxOffset = 540;
  const maxEligibleContribution = 3000;
  const offsetRate = 0.18; // 18%

  if (spouseIncome >= upperThreshold) {
    return {
      eligible: false,
      offset: 0,
      explanation: `Spouse income ($${spouseIncome.toLocaleString()}) exceeds threshold of $${upperThreshold.toLocaleString()}`,
    };
  }

  const eligibleContribution = Math.min(contributionAmount, maxEligibleContribution);

  if (spouseIncome <= lowerThreshold) {
    const offset = Math.min(eligibleContribution * offsetRate, maxOffset);
    return {
      eligible: true,
      offset: Math.round(offset),
      explanation: `Full offset: $${Math.round(offset)} (18% of up to $${maxEligibleContribution.toLocaleString()})`,
    };
  }

  // Phase-out calculation
  const reductionPerDollar = maxOffset / (upperThreshold - lowerThreshold);
  const reduction = (spouseIncome - lowerThreshold) * reductionPerDollar;
  const baseOffset = eligibleContribution * offsetRate;
  const adjustedOffset = Math.max(0, baseOffset - reduction);

  return {
    eligible: adjustedOffset > 0,
    offset: Math.round(adjustedOffset),
    explanation: adjustedOffset > 0
      ? `Reduced offset: $${Math.round(adjustedOffset)} due to spouse income phase-out`
      : 'Offset fully phased out due to spouse income level',
  };
}

// =============================================================================
// Summary Functions
// =============================================================================

/**
 * Get a summary of super contribution position
 */
export function getSuperContributionSummary(
  input: SuperContributionInput,
  marginalRate: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  contributions: SuperContributionResult;
  capUtilization: {
    concessional: { used: number; cap: number; remaining: number; percentage: number };
    nonConcessional: { used: number; cap: number; remaining: number; percentage: number };
  };
  warnings: string[];
  recommendations: string[];
} {
  const contributions = calculateSuperContributions(input, marginalRate, config);
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check cap utilization
  const concessionalRemaining = config.concessionalCap - contributions.totalConcessional;
  const nonConcessionalRemaining = config.nonConcessionalCap - contributions.totalNonConcessional;

  // Warnings
  if (concessionalRemaining < 0) {
    warnings.push(
      `Concessional contributions exceed cap by $${Math.abs(Math.round(concessionalRemaining)).toLocaleString()}. Excess will be taxed at your marginal rate.`
    );
  }

  if (nonConcessionalRemaining < 0) {
    warnings.push(
      `Non-concessional contributions exceed cap by $${Math.abs(Math.round(nonConcessionalRemaining)).toLocaleString()}. Excess contributions tax may apply.`
    );
  }

  if (contributions.division293Tax > 0) {
    warnings.push(
      `Division 293 tax of $${contributions.division293Tax.toLocaleString()} applies as combined income exceeds $${config.division293Threshold.toLocaleString()}.`
    );
  }

  // Recommendations
  if (concessionalRemaining > 5000 && marginalRate >= 0.30) {
    recommendations.push(
      `You have $${Math.round(concessionalRemaining).toLocaleString()} unused concessional cap. Consider salary sacrifice to save ${Math.round((marginalRate - 0.15) * 100)}% tax.`
    );
  }

  if (contributions.salarySacrifice === 0 && marginalRate >= 0.32) {
    const potentialSavings = Math.min(10000, concessionalRemaining) * (marginalRate - 0.15);
    recommendations.push(
      `Salary sacrificing $10,000 would save approximately $${Math.round(potentialSavings).toLocaleString()} in tax.`
    );
  }

  return {
    contributions,
    capUtilization: {
      concessional: {
        used: contributions.totalConcessional,
        cap: config.concessionalCap,
        remaining: Math.max(0, concessionalRemaining),
        percentage: Math.min(100, (contributions.totalConcessional / config.concessionalCap) * 100),
      },
      nonConcessional: {
        used: contributions.totalNonConcessional,
        cap: config.nonConcessionalCap,
        remaining: Math.max(0, nonConcessionalRemaining),
        percentage: Math.min(100, (contributions.totalNonConcessional / config.nonConcessionalCap) * 100),
      },
    },
    warnings,
    recommendations,
  };
}
