/**
 * Loan Aggregator
 *
 * Single source of truth for loan aggregation and debt calculations.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered loan reduce() calls across API routes.
 */

import { toMonthly, toAnnual, toMonthlyDecimal, toAnnualDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// TYPES
// =============================================================================

export interface LoanInput {
  principal: number;
  minRepayment: number;
  repaymentFrequency: string;
  interestRateAnnual: number;
  type?: string;
  isInterestOnly?: boolean;
  propertyId?: string | null;
  /**
   * Phase 41a — `LegalEntity` ownership FK (Phase 41e.0 audit C-3).
   * See `incomeAggregator.IncomeInput.ownerEntityId` for full rationale.
   */
  ownerEntityId?: string | null;
}

export interface LoanAggregation {
  totalPrincipal: number;
  totalRepayments: number;
  totalInterest: number;
  weightedInterestRate: number;
  byType: Record<string, { principal: number; repayments: number }>;
}

export interface DebtMetrics {
  debtToIncomeRatio: number;
  debtServiceRatio: number;
  totalDebt: number;
  monthlyRepayments: number;
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Aggregate loan repayments to a target frequency (monthly or annual).
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only loans
 * whose `ownerEntityId` matches are aggregated. Default = no filter
 * for backward-compat. Per audit doc §6.3.
 */
/**
 * Aggregate loan repayments.
 *
 * **Contract** (verified by Phase 41i calc-audit fixture
 * `core.loanAggregator`):
 * - `loan.repaymentFrequency` MUST use the UPPERCASE
 *   `RepaymentFrequency` enum (`'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'`,
 *    etc.). Lowercase strings fall through `toAnnual`'s default
 *   branch and return raw amounts unchanged.
 */
export function aggregateLoanRepayments(
  loans: LoanInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly',
  ownerEntityId?: string,
): LoanAggregation {
  const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;

  let totalPrincipal = 0;
  let totalRepayments = 0;
  let totalInterest = 0;
  let weightedRateSum = 0;

  const byType: Record<string, { principal: number; repayments: number }> = {};

  const filtered = ownerEntityId
    ? loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : loans;

  for (const loan of filtered) {
    const principal = Number(loan.principal || 0);
    const repayment = converter(
      loan.minRepayment || 0,
      (loan.repaymentFrequency || 'MONTHLY') as Frequency
    );

    // Calculate interest portion (simplified)
    const interestRateMonthly = (loan.interestRateAnnual || 0) / 100 / 12;
    const monthlyInterest = principal * interestRateMonthly;
    const interest = targetFrequency === 'monthly' ? monthlyInterest : monthlyInterest * 12;

    totalPrincipal += principal;
    totalRepayments += repayment;
    totalInterest += interest;
    weightedRateSum += principal * (loan.interestRateAnnual || 0);

    const type = loan.type || 'Other';
    if (!byType[type]) {
      byType[type] = { principal: 0, repayments: 0 };
    }
    byType[type].principal += principal;
    byType[type].repayments += repayment;
  }

  const weightedInterestRate =
    totalPrincipal > 0 ? weightedRateSum / totalPrincipal : 0;

  return {
    totalPrincipal,
    totalRepayments,
    totalInterest,
    weightedInterestRate,
    byType,
  };
}

/**
 * Calculate debt metrics relative to income
 */
export function calculateDebtMetrics(
  loans: LoanInput[],
  monthlyNetIncome: number
): DebtMetrics {
  const aggregation = aggregateLoanRepayments(loans, 'monthly');

  const debtToIncomeRatio =
    monthlyNetIncome > 0
      ? (aggregation.totalPrincipal / (monthlyNetIncome * 12)) * 100
      : 0;

  const debtServiceRatio =
    monthlyNetIncome > 0
      ? (aggregation.totalRepayments / monthlyNetIncome) * 100
      : 0;

  return {
    debtToIncomeRatio,
    debtServiceRatio,
    totalDebt: aggregation.totalPrincipal,
    monthlyRepayments: aggregation.totalRepayments,
  };
}

/**
 * Filter and aggregate loans by property
 */
export function aggregateLoansByProperty(
  loans: LoanInput[],
  propertyId: string,
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): LoanAggregation {
  const filtered = loans.filter((l) => l.propertyId === propertyId);
  return aggregateLoanRepayments(filtered, targetFrequency);
}

/**
 * Calculate Loan-to-Value ratio for a property
 */
export function calculateLVR(
  propertyValue: number,
  loans: LoanInput[],
  propertyId: string
): number {
  if (propertyValue <= 0) return 0;

  const propertyLoans = loans.filter((l) => l.propertyId === propertyId);
  const totalDebt = propertyLoans.reduce(
    (sum, l) => sum + Number(l.principal || 0),
    0
  );

  return (totalDebt / propertyValue) * 100;
}

// =============================================================================
// Q-DEC PR 2.B — Decimal sibling path
// =============================================================================

export interface LoanAggregationDecimal {
  totalPrincipal: Decimal;
  totalRepayments: Decimal;
  totalInterest: Decimal;
  weightedInterestRate: Decimal;
  byType: Record<string, { principal: Decimal; repayments: Decimal }>;
}

export interface DebtMetricsDecimal {
  debtToIncomeRatio: Decimal;
  debtServiceRatio: Decimal;
  totalDebt: Decimal;
  monthlyRepayments: Decimal;
}

/**
 * Decimal sibling of `aggregateLoanRepayments`. Same contract.
 *
 * Interest portion is computed in Decimal end-to-end:
 *   monthlyInterest = principal × interestRateAnnual / 100 / 12
 *   annualInterest  = monthlyInterest × 12
 */
export function aggregateLoanRepaymentsDecimal(
  loans: LoanInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly',
  ownerEntityId?: string,
): LoanAggregationDecimal {
  const converter = targetFrequency === 'monthly' ? toMonthlyDecimal : toAnnualDecimal;

  let totalPrincipal = new Decimal(0);
  let totalRepayments = new Decimal(0);
  let totalInterest = new Decimal(0);
  let weightedRateSum = new Decimal(0);

  const byType: Record<string, { principal: Decimal; repayments: Decimal }> = {};

  const filtered = ownerEntityId
    ? loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : loans;

  for (const loan of filtered) {
    const principal = toDecimal(loan.principal) ?? new Decimal(0);
    const repayment = converter(
      loan.minRepayment ?? 0,
      (loan.repaymentFrequency || 'MONTHLY') as Frequency,
    );

    const interestRateAnnual = toDecimal(loan.interestRateAnnual) ?? new Decimal(0);
    const interestRateMonthly = interestRateAnnual.div(100).div(12);
    const monthlyInterest = principal.times(interestRateMonthly);
    const interest = targetFrequency === 'monthly' ? monthlyInterest : monthlyInterest.times(12);

    totalPrincipal = totalPrincipal.plus(principal);
    totalRepayments = totalRepayments.plus(repayment);
    totalInterest = totalInterest.plus(interest);
    weightedRateSum = weightedRateSum.plus(principal.times(interestRateAnnual));

    const type = loan.type || 'Other';
    if (!byType[type]) {
      byType[type] = { principal: new Decimal(0), repayments: new Decimal(0) };
    }
    byType[type].principal = byType[type].principal.plus(principal);
    byType[type].repayments = byType[type].repayments.plus(repayment);
  }

  // Guard against div-by-zero. Using `.gt(0)` (strict positive) rather
  // than `.gt(0)` because decimal.js treats `Decimal(0).gt(0)`
  // as truthy in some configurations.
  const weightedInterestRate = totalPrincipal.gt(0)
    ? weightedRateSum.div(totalPrincipal)
    : new Decimal(0);

  return {
    totalPrincipal,
    totalRepayments,
    totalInterest,
    weightedInterestRate,
    byType,
  };
}

/**
 * Decimal sibling of `calculateDebtMetrics`. `monthlyNetIncome` accepts
 * `number | Decimal` so callers in the transition can pass either path.
 */
export function calculateDebtMetricsDecimal(
  loans: LoanInput[],
  monthlyNetIncome: number | Decimal,
): DebtMetricsDecimal {
  const aggregation = aggregateLoanRepaymentsDecimal(loans, 'monthly');
  const incomeDec = monthlyNetIncome instanceof Decimal
    ? monthlyNetIncome
    : (toDecimal(monthlyNetIncome) ?? new Decimal(0));

  const debtToIncomeRatio = incomeDec.gt(0)
    ? aggregation.totalPrincipal.div(incomeDec.times(12)).times(100)
    : new Decimal(0);

  const debtServiceRatio = incomeDec.gt(0)
    ? aggregation.totalRepayments.div(incomeDec).times(100)
    : new Decimal(0);

  return {
    debtToIncomeRatio,
    debtServiceRatio,
    totalDebt: aggregation.totalPrincipal,
    monthlyRepayments: aggregation.totalRepayments,
  };
}

/**
 * Decimal sibling of `calculateLVR`.
 */
export function calculateLVRDecimal(
  propertyValue: number | Decimal,
  loans: LoanInput[],
  propertyId: string,
): Decimal {
  const propertyValueDec = propertyValue instanceof Decimal
    ? propertyValue
    : (toDecimal(propertyValue) ?? new Decimal(0));

  if (!propertyValueDec.gt(0)) return new Decimal(0);

  const propertyLoans = loans.filter((l) => l.propertyId === propertyId);
  let totalDebt = new Decimal(0);
  for (const l of propertyLoans) {
    totalDebt = totalDebt.plus(toDecimal(l.principal) ?? new Decimal(0));
  }

  return totalDebt.div(propertyValueDec).times(100);
}
