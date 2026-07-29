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
import { calculateIncomeTax, calculateMarginalTax, calculateIncomeTaxDecimal } from '../core/incomeTaxCalculator';
import { calculateMedicareLevy, calculateMedicareLevyDecimal } from '../core/medicareLevyCalculator';
import { calculateAllOffsets, applyOffsets, calculateAllOffsetsDecimal, applyOffsetsDecimal } from '../core/taxOffsets';
import { toAnnual, toAnnualDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { determineTaxability, determineTaxabilityDecimal } from '../income/taxabilityRules';
import { deductiblePropertyLoanInterest } from '../deductions/propertyLoanInterest';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// Types
// =============================================================================

export interface IncomeItem {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  /** MON-053: false = a one-off receipt (single ATO deposit) — counted ONCE,
   *  never ×frequency. Mirrors ExpenseItem.isRecurring (MON-037). */
  isRecurring?: boolean;
  propertyId?: string;
  investmentAccountId?: string;
  grossAmount?: number;
  paygWithholding?: number;
  frankingPercentage?: number;
  frankingCredits?: number;
  /** MON-094: the row's stored Income.taxCategory — a non-assessable value
   *  (TAX_EXEMPT, GOVERNMENT_EXEMPT, …) makes the taxability engine return
   *  taxableAmount 0 for this row (an ATO refund is not assessable income). */
  taxCategory?: string | null;
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
  /**
   * MON-037: a one-off deductible cost (`isRecurring === false`) is a real
   * deduction in the year it's incurred, but it must be counted ONCE — not
   * annualised ×frequency. A $11,385 battery stored MONTHLY is an $11,385
   * deduction, not $136,620. Undefined/true = recurring (annualised as before).
   * (The capital-vs-immediate treatment of a one-off — §12.14 — is a separate
   * question this does not resolve; this only removes the ×frequency inflation.)
   */
  isRecurring?: boolean;
}

export interface DepreciationItem {
  id: string;
  propertyId: string;
  currentYearDeduction: number;
  type: string; // DIV_40 or DIV_43
}

/** MON-045 stage 2 — a property loan whose DEDUCTIBLE interest the engine
 *  auto-derives (via lib/tax-engine/deductions/propertyLoanInterest.ts, the ONE
 *  interest source). The engine applies the ONE deductibility rule itself
 *  (§12.2.1 — never in the callers, or they drift): interest is deductible only
 *  when the property is rental-assessable, i.e. `propertyType !== 'HOME'`
 *  (a primary residence's loan interest is NOT deductible — e.g. Guildford —
 *  even if the home is partially let; use Loan.deductibleFraction for a manual
 *  apportionment override). */
export interface PropertyLoanItem {
  id: string;
  /** Property.type of the owning property — the deductibility gate. */
  propertyType: 'HOME' | 'INVESTMENT' | 'RENTAL' | string;
  principal: number;
  /** DECIMAL, e.g. 0.0649 (Loan.interestRateAnnual convention). */
  interestRateAnnual: number;
  /** Linked offset Account.currentBalance (reduces the interest-bearing base). */
  offsetBalance?: number | null;
  /** ATO TR 2000/2 apportionment (Loan.deductibleFraction, default 1.0). */
  deductibleFraction?: number | null;
  /** Σ INTEREST_CHARGED ledger rows this FY — the actuals-first source. */
  actualInterestCharged?: number | null;
}

export interface TaxPositionCalculationInput {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  depreciations: DepreciationItem[];
  /** MON-045: property loans for auto-derived deductible interest. Optional —
   *  callers that don't pass them get the pre-MON-045 behaviour (logged
   *  expense rows only). */
  propertyLoans?: PropertyLoanItem[];
  superContributions?: {
    concessional: number;
    nonConcessional: number;
  };
  financialYear?: string;
  /**
   * MON-088: household context for the Medicare legs (levy family threshold
   * + MLS combined-income tier + cover). Optional — absent preserves the
   * pre-MON-088 SINGLE/covered behaviour for estimate callers. Sourced from
   * HouseholdProfile/members by getUserTaxPosition; never re-derived per
   * surface (§12.2.1). AU has no joint return: this NEVER touches income-tax
   * marginal rates — Medicare only.
   */
  medicareContext?: {
    familyStatus: 'SINGLE' | 'FAMILY';
    dependentChildren: number;
    /** The OTHER adult's taxable income (for the combined MLS tier test). */
    spouseIncome: number;
    /** ATO all-or-nothing: true only when the WHOLE family holds hospital
     *  cover. null/undefined = not entered → conservatively uncovered. */
    familyCovered: boolean | null;
  };
}

// =============================================================================
// Helper Functions - Use centralized frequency utilities from lib/utils/frequencies.ts
// =============================================================================

/**
 * Annualize an amount based on frequency
 */
function annualize(amount: number, frequency: string): number {
  return toAnnual(amount, frequency as Frequency);
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
    // MON-053: count a one-off ONCE (its actual amount), never ×frequency —
    // the income-side twin of the MON-037 expense guard below.
    const annualAmount = income.grossAmount
      ? income.grossAmount
      : income.isRecurring === false
        ? income.amount
        : annualize(income.amount, income.frequency);

    // Determine taxability
    const taxResult = determineTaxability({
      incomeType: income.type,
      amount: annualAmount,
      frequency: income.frequency,
      propertyId: income.propertyId,
      investmentAccountId: income.investmentAccountId,
      frankingPercentage: income.frankingPercentage,
      frankingCredits: income.frankingCredits,
      taxCategory: income.taxCategory, // MON-094: non-assessable rows → $0 taxable
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

  // MON-045: auto-derive DEDUCTIBLE property loan interest from the loans
  // themselves (the ONE canonical source — actuals-first INTEREST_CHARGED →
  // (principal − offset) × rate × deductibleFraction). Only rental-assessable
  // properties (type !== 'HOME'); a primary residence's interest is never
  // auto-deducted. Loan-linked expense rows for THESE loans are skipped below
  // (§12.2.1 de-dup — the loan-derived figure supersedes; interest is never
  // double-counted). Loss-offset gating vs the Phase 41E reform is a SEPARATE
  // step (applyNegativeGearing, stage 3) — grandfathered/always-offset today.
  const autoDerivedLoanIds = new Set<string>();
  for (const loan of input.propertyLoans ?? []) {
    if (loan.propertyType === 'HOME') continue; // primary residence — not deductible
    const { deductibleInterest } = deductiblePropertyLoanInterest({
      principal: loan.principal,
      interestRateAnnual: loan.interestRateAnnual,
      offsetBalance: loan.offsetBalance,
      deductibleFraction: loan.deductibleFraction,
      actualInterestCharged: loan.actualInterestCharged,
    });
    deductionBreakdown.property += deductibleInterest;
    autoDerivedLoanIds.add(loan.id);
  }

  // Process deductible expenses
  for (const expense of input.expenses) {
    if (!expense.isTaxDeductible) continue;

    // MON-045 de-dup: this loan's interest is already auto-derived above.
    if (expense.loanId && autoDerivedLoanIds.has(expense.loanId)) continue;

    // MON-037: count a one-off ONCE (its actual amount), never ×frequency.
    const annualAmount = expense.isRecurring === false
      ? expense.amount
      : annualize(expense.amount, expense.frequency);

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

  // Calculate Medicare levy (MON-088: family + cover context when provided;
  // absent context = pre-MON-088 SINGLE/covered behaviour for estimators).
  const mc = input.medicareContext;
  const medicareResult = calculateMedicareLevy(
    mc
      ? {
          taxableIncome,
          familyStatus: mc.familyStatus,
          dependentChildren: mc.dependentChildren,
          spouseIncome: mc.spouseIncome,
          hasPrivateHealthInsurance: mc.familyCovered === true,
        }
      : { taxableIncome },
    fyConfig,
  );

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
    // MON-106: announce, never silently substitute — when the requested FY
    // has no config the engine computed on the normalised fallback, and the
    // surface renders that fact.
    configFinancialYear: fyConfig.financialYear,
    configStale: financialYear !== fyConfig.financialYear,
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

  // MON-040: `tax.marginalRate` is a PERCENT (e.g. 37 for the 37% bracket — set
  // as `marginalRate * 100` in incomeTaxCalculator, and the tax page renders it
  // as a percent). `mr` is the decimal form (0.37) for rate arithmetic. The 15%
  // is the concessional-contributions tax rate; salary-sacrifice saves the
  // difference. (Was reading marginalRate as a decimal → "save 3685%" / $6.27M.)
  const mr = tax.marginalRate / 100;

  // Check salary sacrifice opportunity
  if (income.salary > 100000 && tax.marginalRate >= 32) {
    const currentConcessional = superContributions?.concessional || 0;
    const remainingCap = config.concessionalCap - currentConcessional;

    if (remainingCap > 5000) {
      const potentialSavings = remainingCap * (mr - 0.15);
      recommendations.push({
        id: 'salary-sacrifice',
        type: 'SAVINGS',
        title: 'Salary Sacrifice Opportunity',
        description: `You have $${Math.round(remainingCap).toLocaleString()} unused concessional cap. Salary sacrifice could save ${Math.round(tax.marginalRate - 15)}% compared to income tax.`,
        potentialSavings: Math.round(potentialSavings),
        action: 'Consider increasing salary sacrifice contributions',
        priority: 'HIGH',
      });
    }
  }

  // Check negative gearing
  if (deductions.property > income.rental && income.rental > 0) {
    const taxBenefit = (deductions.property - income.rental) * mr; // MON-040: decimal rate
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

// =============================================================================
// Q-DEC PR 2.D.2b — Decimal sibling path
// =============================================================================
//
// `calculateTaxPositionDecimal` composes the Decimal core (PR 2.D.1) +
// Decimal taxability rules (this PR) end-to-end. Salary-sacrifice's
// "after-sacrifice" tax position is one of the consumers — PR 1's
// scenario engine calls this with the modified income breakdown.

export interface IncomeBreakdownDecimal {
  salary: Decimal;
  rental: Decimal;
  dividends: Decimal;
  interest: Decimal;
  capitalGains: Decimal;
  other: Decimal;
  total: Decimal;
  frankingCredits: Decimal;
}

export interface DeductionBreakdownDecimal {
  workRelated: Decimal;
  property: Decimal;
  investment: Decimal;
  depreciation: Decimal;
  other: Decimal;
  total: Decimal;
}

export interface TaxOffsetsDecimalShape {
  lito: Decimal;
  sapto: Decimal;
  frankingCredits: Decimal;
  foreignTax: Decimal;
  other: Decimal;
  total: Decimal;
}

export interface TaxCalculationDecimal {
  assessableIncome: Decimal;
  taxableIncome: Decimal;
  taxOnIncome: Decimal;
  medicareLevy: Decimal;
  medicareSurcharge: Decimal;
  grossTax: Decimal;
  offsets: TaxOffsetsDecimalShape;
  netTax: Decimal;
  effectiveRate: Decimal;
  marginalRate: Decimal;
}

export interface TaxPositionResultDecimal {
  financialYear: string;
  /** MON-106 — see TaxPositionResult.configFinancialYear / configStale. */
  configFinancialYear: string;
  configStale: boolean;
  income: IncomeBreakdownDecimal;
  deductions: DeductionBreakdownDecimal;
  tax: TaxCalculationDecimal;
  paygWithheld: Decimal;
  estimatedRefund: Decimal;
  superContributions: {
    concessional: Decimal;
    nonConcessional: Decimal;
    total: Decimal;
    division293Tax: Decimal;
  };
}

function annualizeDecimal(amount: Decimal | number, frequency: string): Decimal {
  return toAnnualDecimal(amount, frequency as Frequency);
}

function calculateDivision293TaxAmountDecimal(
  taxableIncome: Decimal,
  concessionalContributions: Decimal,
  config: TaxYearConfig,
): Decimal {
  const combined = taxableIncome.plus(concessionalContributions);
  const threshold = new Decimal(config.division293Threshold);
  if (combined.lte(threshold)) return new Decimal(0);
  const excess = combined.minus(threshold);
  const taxable = Decimal.min(concessionalContributions, excess);
  return taxable.times('0.15').toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
}

/**
 * Decimal sibling of `calculateTaxPosition`. End-to-end Decimal:
 * annualisation, taxability classification, bracket walk, Medicare,
 * offsets, refund estimate — all in Decimal. The recommendations and
 * warnings stay Float-string-typed (presentational, not numeric).
 */
export function calculateTaxPositionDecimal(
  input: TaxPositionCalculationInput,
  config?: TaxYearConfig,
): TaxPositionResultDecimal {
  const fyConfig = config || getCurrentTaxYearConfig();
  const currentFY = getCurrentFinancialYear();
  const financialYear = input.financialYear || currentFY.year;
  const zero = new Decimal(0);

  const incomeBreakdown: IncomeBreakdownDecimal = {
    salary: new Decimal(0),
    rental: new Decimal(0),
    dividends: new Decimal(0),
    interest: new Decimal(0),
    capitalGains: new Decimal(0),
    other: new Decimal(0),
    total: new Decimal(0),
    frankingCredits: new Decimal(0),
  };

  let totalPaygWithheld = new Decimal(0);

  for (const income of input.incomes) {
    // MON-053: count a one-off ONCE — Decimal twin of the Float guard above
    // (§12.2.1: the two paths must never disagree on this semantics).
    const annualAmount = income.grossAmount != null
      ? (toDecimal(income.grossAmount) ?? new Decimal(0))
      : income.isRecurring === false
        ? (toDecimal(income.amount) ?? new Decimal(0))
        : annualizeDecimal(income.amount, income.frequency);

    const taxResult = determineTaxabilityDecimal({
      incomeType: income.type,
      amount: annualAmount,
      frequency: income.frequency,
      propertyId: income.propertyId,
      investmentAccountId: income.investmentAccountId,
      frankingPercentage: income.frankingPercentage,
      frankingCredits: income.frankingCredits,
      taxCategory: income.taxCategory, // MON-094: non-assessable rows → $0 taxable (twin)
    });

    const incomeType = income.type?.toUpperCase();
    switch (incomeType) {
      case 'SALARY':
        incomeBreakdown.salary = incomeBreakdown.salary.plus(taxResult.taxableAmount);
        if (income.paygWithholding != null) {
          totalPaygWithheld = totalPaygWithheld.plus(toDecimal(income.paygWithholding) ?? new Decimal(0));
        }
        break;
      case 'RENT':
      case 'RENTAL':
        incomeBreakdown.rental = incomeBreakdown.rental.plus(taxResult.taxableAmount);
        break;
      case 'DIVIDEND':
      case 'INVESTMENT':
        incomeBreakdown.dividends = incomeBreakdown.dividends.plus(taxResult.taxableAmount);
        incomeBreakdown.frankingCredits = incomeBreakdown.frankingCredits.plus(taxResult.frankingCredits);
        break;
      case 'INTEREST':
        incomeBreakdown.interest = incomeBreakdown.interest.plus(taxResult.taxableAmount);
        break;
      case 'CAPITAL_GAIN':
        incomeBreakdown.capitalGains = incomeBreakdown.capitalGains.plus(taxResult.taxableAmount);
        break;
      default:
        incomeBreakdown.other = incomeBreakdown.other.plus(taxResult.taxableAmount);
    }
  }

  incomeBreakdown.total = incomeBreakdown.salary
    .plus(incomeBreakdown.rental)
    .plus(incomeBreakdown.dividends)
    .plus(incomeBreakdown.interest)
    .plus(incomeBreakdown.capitalGains)
    .plus(incomeBreakdown.other);

  const deductionBreakdown: DeductionBreakdownDecimal = {
    workRelated: new Decimal(0),
    property: new Decimal(0),
    investment: new Decimal(0),
    depreciation: new Decimal(0),
    other: new Decimal(0),
    total: new Decimal(0),
  };

  // MON-045: auto-derived deductible property loan interest — Decimal twin of
  // the Float block (§12.2.1: the two paths must never disagree). Same ONE
  // rule: type !== 'HOME'; loan-linked expense rows for these loans are
  // de-duped below. The Float helper's output is exact for our precision needs
  // (a product of stored Floats); it is converted once here.
  const autoDerivedLoanIdsDec = new Set<string>();
  for (const loan of input.propertyLoans ?? []) {
    if (loan.propertyType === 'HOME') continue;
    const { deductibleInterest } = deductiblePropertyLoanInterest({
      principal: loan.principal,
      interestRateAnnual: loan.interestRateAnnual,
      offsetBalance: loan.offsetBalance,
      deductibleFraction: loan.deductibleFraction,
      actualInterestCharged: loan.actualInterestCharged,
    });
    deductionBreakdown.property = deductionBreakdown.property.plus(
      toDecimal(deductibleInterest) ?? new Decimal(0),
    );
    autoDerivedLoanIdsDec.add(loan.id);
  }

  for (const expense of input.expenses) {
    if (!expense.isTaxDeductible) continue;
    // MON-045 de-dup: this loan's interest is already auto-derived above.
    if (expense.loanId && autoDerivedLoanIdsDec.has(expense.loanId)) continue;
    // MON-037: count a one-off ONCE (its actual amount), never ×frequency.
    const annualAmount = expense.isRecurring === false
      ? (toDecimal(expense.amount) ?? new Decimal(0))
      : annualizeDecimal(expense.amount, expense.frequency);

    if (expense.propertyId) {
      deductionBreakdown.property = deductionBreakdown.property.plus(annualAmount);
    } else if (expense.investmentAccountId) {
      deductionBreakdown.investment = deductionBreakdown.investment.plus(annualAmount);
    } else {
      const category = expense.category?.toUpperCase();
      if (category === 'LOAN_INTEREST') {
        deductionBreakdown.investment = deductionBreakdown.investment.plus(annualAmount);
      } else {
        deductionBreakdown.other = deductionBreakdown.other.plus(annualAmount);
      }
    }
  }

  for (const depreciation of input.depreciations) {
    const dep = toDecimal(depreciation.currentYearDeduction) ?? new Decimal(0);
    deductionBreakdown.depreciation = deductionBreakdown.depreciation.plus(dep);
    deductionBreakdown.property = deductionBreakdown.property.plus(dep);
  }

  deductionBreakdown.total = deductionBreakdown.workRelated
    .plus(deductionBreakdown.property)
    .plus(deductionBreakdown.investment)
    .plus(deductionBreakdown.other);

  const assessableIncome = incomeBreakdown.total;
  const taxableIncome = Decimal.max(zero, assessableIncome.minus(deductionBreakdown.total));

  const incomeTaxResult = calculateIncomeTaxDecimal(taxableIncome, fyConfig);
  // MON-088: same context as the Float path — Float === Decimal by twin rule.
  const mcD = input.medicareContext;
  const medicareResult = calculateMedicareLevyDecimal(
    mcD
      ? {
          taxableIncome,
          familyStatus: mcD.familyStatus,
          dependentChildren: mcD.dependentChildren,
          spouseIncome: mcD.spouseIncome,
          hasPrivateHealthInsurance: mcD.familyCovered === true,
        }
      : { taxableIncome },
    fyConfig,
  );
  const offsetsResult = calculateAllOffsetsDecimal(
    { taxableIncome, frankingCredits: incomeBreakdown.frankingCredits },
    fyConfig,
  );

  const offsets: TaxOffsetsDecimalShape = {
    lito: offsetsResult.offsets.lito,
    sapto: new Decimal(0),
    frankingCredits: offsetsResult.offsets.frankingCredits,
    foreignTax: new Decimal(0),
    other: new Decimal(0),
    total: offsetsResult.offsets.total,
  };

  const grossTax = incomeTaxResult.taxPayable.plus(medicareResult.total);
  const offsetApplication = applyOffsetsDecimal(grossTax, offsetsResult.offsets);
  const netTax = offsetApplication.netTax;

  // Mirror Float's `Math.round(effectiveRate * 100) / 100`.
  const effectiveRate = taxableIncome.gt(0)
    ? netTax.div(taxableIncome).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
    : new Decimal(0);

  const taxCalculation: TaxCalculationDecimal = {
    assessableIncome,
    taxableIncome,
    taxOnIncome: incomeTaxResult.taxPayable,
    medicareLevy: medicareResult.medicareLevy,
    medicareSurcharge: medicareResult.medicareSurcharge,
    grossTax,
    offsets,
    netTax,
    effectiveRate,
    marginalRate: incomeTaxResult.marginalRate,
  };

  const estimatedRefund = totalPaygWithheld.minus(netTax);

  const sccConcessional = toDecimal(input.superContributions?.concessional ?? 0) ?? new Decimal(0);
  const sccNonConcessional = toDecimal(input.superContributions?.nonConcessional ?? 0) ?? new Decimal(0);

  return {
    financialYear,
    // MON-106 — mirror of the Float twin's stale-config surfacing.
    configFinancialYear: fyConfig.financialYear,
    configStale: financialYear !== fyConfig.financialYear,
    income: incomeBreakdown,
    deductions: deductionBreakdown,
    tax: taxCalculation,
    // Float rounds paygWithheld + estimatedRefund to dollar via Math.round; mirror.
    paygWithheld: totalPaygWithheld.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
    estimatedRefund: estimatedRefund.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
    superContributions: {
      concessional: sccConcessional,
      nonConcessional: sccNonConcessional,
      total: sccConcessional.plus(sccNonConcessional),
      division293Tax: calculateDivision293TaxAmountDecimal(taxableIncome, sccConcessional, fyConfig),
    },
  };
}

/**
 * Decimal sibling of `calculateQuickTaxPosition` — the lightweight
 * scenario calc the AI advisor uses.
 */
export function calculateQuickTaxPositionDecimal(
  taxableIncome: number | string | Decimal,
  deductions: number | string | Decimal = 0,
  frankingCredits: number | string | Decimal = 0,
  financialYear?: string,
): {
  taxableIncome: Decimal;
  taxPayable: Decimal;
  medicareLevy: Decimal;
  netTax: Decimal;
  effectiveRate: Decimal;
  marginalRate: Decimal;
} {
  const config = financialYear ? getTaxYearConfig(financialYear) : getCurrentTaxYearConfig();
  const inputTaxable = toDecimal(taxableIncome) ?? new Decimal(0);
  const inputDeductions = toDecimal(deductions) ?? new Decimal(0);
  const inputFranking = toDecimal(frankingCredits) ?? new Decimal(0);

  const netTaxableIncome = Decimal.max(new Decimal(0), inputTaxable.minus(inputDeductions));
  const incomeTax = calculateIncomeTaxDecimal(netTaxableIncome, config);
  const medicare = calculateMedicareLevyDecimal({ taxableIncome: netTaxableIncome }, config);
  const offsets = calculateAllOffsetsDecimal(
    { taxableIncome: netTaxableIncome, frankingCredits: inputFranking },
    config,
  );

  const grossTax = incomeTax.taxPayable.plus(medicare.total);
  const offsetApplication = applyOffsetsDecimal(grossTax, offsets.offsets);

  return {
    taxableIncome: netTaxableIncome,
    // Float rounds taxPayable + medicare + netTax to dollar; mirror.
    taxPayable: incomeTax.taxPayable.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
    medicareLevy: medicare.total.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
    netTax: offsetApplication.netTax.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN),
    // Float: Math.round((netTax / taxable) * 10000) / 100 — 2 dp percentage.
    effectiveRate: netTaxableIncome.gt(0)
      ? offsetApplication.netTax.div(netTaxableIncome).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
      : new Decimal(0),
    marginalRate: incomeTax.marginalRate,
  };
}
