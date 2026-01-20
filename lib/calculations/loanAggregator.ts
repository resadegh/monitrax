/**
 * Loan Aggregator
 *
 * Single source of truth for loan aggregation and debt calculations.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered loan reduce() calls across API routes.
 */

import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

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
 * Aggregate loan repayments to a target frequency (monthly or annual)
 */
export function aggregateLoanRepayments(
  loans: LoanInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): LoanAggregation {
  const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;

  let totalPrincipal = 0;
  let totalRepayments = 0;
  let totalInterest = 0;
  let weightedRateSum = 0;

  const byType: Record<string, { principal: number; repayments: number }> = {};

  for (const loan of loans) {
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
