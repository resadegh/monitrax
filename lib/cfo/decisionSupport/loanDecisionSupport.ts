/**
 * Phase 17B: Loan Decision Support for CFO Dashboard
 * Provides loan insights including refinance opportunities, rate alerts, and repayment optimization
 *
 * All data is derived from REAL database records and deterministic calculations.
 * AI is only used for explanation/formatting, NEVER for inventing numbers.
 */

import { prisma } from '@/lib/db';
import { toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';
import {
  aggregateLoanRepayments,
  calculateDebtMetrics,
  type LoanInput,
} from '@/lib/calculations/loanAggregator';

// ============================================================================
// Types
// ============================================================================

export interface CFOLoanInsights {
  // Portfolio Summary
  loanPortfolio: {
    totalDebt: number;
    totalMonthlyRepayments: number;
    weightedAverageRate: number;
    loanCount: number;
    debtToIncomeRatio: number;
    debtServiceRatio: number;
  };

  // Refinance Opportunities
  refinanceOpportunities: RefinanceOpportunity[];
  totalRefinanceSavings: number;

  // Rate Alerts
  rateAlerts: RateAlert[];

  // Extra Repayment Impact
  extraRepaymentImpact: ExtraRepaymentImpact | null;

  // Loan Risks
  loanRisks: LoanRisk[];

  // Metadata
  metadata: {
    calculatedAt: Date;
    loanCount: number;
    hasOffsetAccounts: boolean;
  };
}

export interface RefinanceOpportunity {
  loanId: string;
  loanName: string;
  loanType: string;
  currentBalance: number;
  currentRate: number;
  marketRate: number;
  rateDifference: number;
  monthlySavings: number;
  annualSavings: number;
  breakEvenMonths: number;
  totalLifetimeSavings: number;
  remainingMonths: number;
  worthRefinancing: boolean;
}

export interface RateAlert {
  type: RateAlertType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  loanId: string;
  loanName: string;
  title: string;
  description: string;
  daysUntil?: number;
  currentRate: number;
  impact: number;
  action: string;
}

export type RateAlertType =
  | 'fixed_rate_expiring'
  | 'interest_only_ending'
  | 'rate_above_market'
  | 'lvr_high';

export interface ExtraRepaymentImpact {
  extraMonthly: number;
  interestSaved: number;
  timeReduced: number; // months
  targetLoanId: string;
  targetLoanName: string;
  currentPayoffDate: Date;
  newPayoffDate: Date;
}

export interface LoanRisk {
  type: LoanRiskType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number;
  action: string;
  loanId?: string;
}

export type LoanRiskType =
  | 'refinance_opportunity'
  | 'fixed_rate_expiry'
  | 'interest_only_expiry'
  | 'high_dti_ratio'
  | 'high_lvr'
  | 'rate_shock_risk'
  | 'offset_underutilized'
  | 'debt_consolidation_opportunity';

// ============================================================================
// Market Rates (would come from external API in production)
// These are indicative Australian rates as of 2026
// ============================================================================

const MARKET_RATES = {
  HOME: 0.058, // 5.8% variable home loan
  INVESTMENT: 0.062, // 6.2% investment loan
  CAR: 0.075, // 7.5% car loan
  PERSONAL: 0.095, // 9.5% personal loan
  LINE_OF_CREDIT: 0.085, // 8.5% line of credit
  STUDENT: 0.035, // 3.5% HECS indexation
  BUSINESS: 0.072, // 7.2% business loan
} as const;

// Refinance thresholds
const REFINANCE_MIN_RATE_GAP = 0.003; // 0.3% minimum rate difference
const REFINANCE_MIN_SAVINGS = 500; // $500/year minimum savings
const REFINANCE_MAX_BREAKEVEN = 24; // 24 months max break-even

// ============================================================================
// Loan Insights Calculator
// ============================================================================

export async function calculateCFOLoanInsights(userId: string): Promise<CFOLoanInsights> {
  // Fetch all user loans with related data
  const [loans, accounts, incomes, properties] = await Promise.all([
    prisma.loan.findMany({
      where: { userId },
      include: {
        property: { select: { id: true, name: true, currentValue: true } },
        offsetAccount: { select: { id: true, name: true, currentBalance: true } },
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, type: true, currentBalance: true },
    }),
    prisma.income.findMany({
      where: { userId },
      select: { amount: true, frequency: true },
    }),
    prisma.property.findMany({
      where: { userId },
      select: { id: true, currentValue: true },
    }),
  ]);

  // Calculate monthly income for DTI ratio
  const monthlyIncome = incomes.reduce(
    (sum, income) => sum + toMonthly(income.amount, income.frequency as Frequency),
    0
  );

  // Transform loans for aggregator
  const loanInputs: LoanInput[] = loans.map((loan) => ({
    principal: loan.principal,
    minRepayment: loan.minRepayment,
    repaymentFrequency: loan.repaymentFrequency,
    interestRateAnnual: loan.interestRateAnnual * 100, // Convert to percentage
    type: loan.type,
    isInterestOnly: loan.isInterestOnly,
    propertyId: loan.propertyId,
  }));

  // Get aggregated loan data
  const aggregation = aggregateLoanRepayments(loanInputs, 'monthly');
  const debtMetrics = calculateDebtMetrics(loanInputs, monthlyIncome);

  // Calculate refinance opportunities
  const refinanceOpportunities = calculateRefinanceOpportunities(loans);
  const totalRefinanceSavings = refinanceOpportunities.reduce(
    (sum, opp) => sum + (opp.worthRefinancing ? opp.annualSavings : 0),
    0
  );

  // Generate rate alerts
  const rateAlerts = generateRateAlerts(loans, properties);

  // Calculate extra repayment impact
  const extraRepaymentImpact = calculateExtraRepaymentImpact(loans, monthlyIncome);

  // Detect loan risks
  const loanRisks = detectLoanRisks({
    loans,
    debtMetrics,
    accounts,
    properties,
    refinanceOpportunities,
  });

  // Check for offset accounts
  const hasOffsetAccounts = loans.some((loan) => loan.offsetAccountId !== null);

  return {
    loanPortfolio: {
      totalDebt: aggregation.totalPrincipal,
      totalMonthlyRepayments: aggregation.totalRepayments,
      weightedAverageRate: aggregation.weightedInterestRate, // P0 fix 2026-06-23: weightedInterestRate is ALREADY a decimal; the prior /100 made the rate 100× too low
      loanCount: loans.length,
      debtToIncomeRatio: debtMetrics.debtToIncomeRatio / 100,
      debtServiceRatio: debtMetrics.debtServiceRatio / 100,
    },
    refinanceOpportunities,
    totalRefinanceSavings,
    rateAlerts,
    extraRepaymentImpact,
    loanRisks,
    metadata: {
      calculatedAt: new Date(),
      loanCount: loans.length,
      hasOffsetAccounts,
    },
  };
}

// ============================================================================
// Refinance Analysis
// ============================================================================

function calculateRefinanceOpportunities(loans: any[]): RefinanceOpportunity[] {
  const opportunities: RefinanceOpportunity[] = [];

  for (const loan of loans) {
    // Skip fixed rate loans that haven't expired
    if (loan.rateType === 'FIXED' && loan.fixedExpiry && new Date(loan.fixedExpiry) > new Date()) {
      continue;
    }

    const currentRate = loan.interestRateAnnual;
    const marketRate = MARKET_RATES[loan.type as keyof typeof MARKET_RATES] || 0.06;
    const rateDifference = currentRate - marketRate;

    // Only consider if current rate is above market
    if (rateDifference <= 0) {
      continue;
    }

    const balance = loan.principal;
    const remainingMonths = loan.termMonthsRemaining;

    // Calculate monthly savings
    const currentMonthlyInterest = (balance * currentRate) / 12;
    const newMonthlyInterest = (balance * marketRate) / 12;
    const monthlySavings = currentMonthlyInterest - newMonthlyInterest;
    const annualSavings = monthlySavings * 12;

    // Estimate refinance costs (typically $1,000 - $2,000 for home loans)
    const estimatedCosts = loan.type === 'HOME' || loan.type === 'INVESTMENT' ? 1500 : 500;

    // Calculate break-even
    const breakEvenMonths = monthlySavings > 0 ? Math.ceil(estimatedCosts / monthlySavings) : 999;

    // Total lifetime savings
    const totalLifetimeSavings = (monthlySavings * remainingMonths) - estimatedCosts;

    // Determine if worth refinancing
    const worthRefinancing =
      rateDifference >= REFINANCE_MIN_RATE_GAP &&
      annualSavings >= REFINANCE_MIN_SAVINGS &&
      breakEvenMonths <= REFINANCE_MAX_BREAKEVEN &&
      totalLifetimeSavings > 0;

    opportunities.push({
      loanId: loan.id,
      loanName: loan.name,
      loanType: loan.type,
      currentBalance: balance,
      currentRate,
      marketRate,
      rateDifference,
      monthlySavings: Math.round(monthlySavings),
      annualSavings: Math.round(annualSavings),
      breakEvenMonths,
      totalLifetimeSavings: Math.round(totalLifetimeSavings),
      remainingMonths,
      worthRefinancing,
    });
  }

  // Sort by annual savings (highest first)
  return opportunities.sort((a, b) => b.annualSavings - a.annualSavings);
}

// ============================================================================
// Rate Alerts
// ============================================================================

function generateRateAlerts(loans: any[], properties: any[]): RateAlert[] {
  const alerts: RateAlert[] = [];
  const now = new Date();

  for (const loan of loans) {
    // Fixed rate expiry alert
    if (loan.rateType === 'FIXED' && loan.fixedExpiry) {
      const expiryDate = new Date(loan.fixedExpiry);
      const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil > 0 && daysUntil <= 90) {
        const marketRate = MARKET_RATES[loan.type as keyof typeof MARKET_RATES] || 0.06;
        const potentialIncrease = marketRate - loan.interestRateAnnual;
        const monthlyImpact = (loan.principal * Math.max(0, potentialIncrease)) / 12;

        alerts.push({
          type: 'fixed_rate_expiring',
          severity: daysUntil <= 30 ? 'high' : 'medium',
          loanId: loan.id,
          loanName: loan.name,
          title: `Fixed rate expiring in ${daysUntil} days`,
          description: `Your fixed rate of ${(loan.interestRateAnnual * 100).toFixed(2)}% on ${loan.name} expires soon. Market rates are around ${(marketRate * 100).toFixed(2)}%.`,
          daysUntil,
          currentRate: loan.interestRateAnnual,
          impact: Math.round(monthlyImpact * 12),
          action: 'Contact your lender to negotiate a new fixed rate or review refinance options',
        });
      }
    }

    // Interest-only period ending
    if (loan.isInterestOnly && loan.termMonthsRemaining <= 12) {
      const monthsUntilPI = loan.termMonthsRemaining;
      // Estimate P&I payment (simplified)
      const estimatedPIPayment = calculateMonthlyPayment(
        loan.principal,
        loan.interestRateAnnual,
        240 // Assume 20 year P&I term
      );
      const currentPayment = toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency);
      const paymentIncrease = estimatedPIPayment - currentPayment;

      if (paymentIncrease > 0) {
        alerts.push({
          type: 'interest_only_ending',
          severity: monthsUntilPI <= 3 ? 'critical' : monthsUntilPI <= 6 ? 'high' : 'medium',
          loanId: loan.id,
          loanName: loan.name,
          title: `Interest-only period ending in ${monthsUntilPI} months`,
          description: `Your repayments on ${loan.name} will increase by approximately $${paymentIncrease.toFixed(0)}/month when switching to P&I.`,
          daysUntil: monthsUntilPI * 30,
          currentRate: loan.interestRateAnnual,
          impact: Math.round(paymentIncrease * 12),
          action: 'Plan for higher repayments or consider extending interest-only period',
        });
      }
    }

    // Rate above market
    const marketRate = MARKET_RATES[loan.type as keyof typeof MARKET_RATES] || 0.06;
    if (loan.interestRateAnnual > marketRate + 0.01) {
      // More than 1% above market
      const overPayment = ((loan.interestRateAnnual - marketRate) * loan.principal) / 12;

      alerts.push({
        type: 'rate_above_market',
        severity: loan.interestRateAnnual > marketRate + 0.02 ? 'high' : 'medium',
        loanId: loan.id,
        loanName: loan.name,
        title: 'Rate above market average',
        description: `Your rate of ${(loan.interestRateAnnual * 100).toFixed(2)}% is ${((loan.interestRateAnnual - marketRate) * 100).toFixed(2)}% above market rates.`,
        currentRate: loan.interestRateAnnual,
        impact: Math.round(overPayment * 12),
        action: 'Consider refinancing or negotiating a rate reduction',
      });
    }

    // High LVR alert for property loans
    if (loan.propertyId) {
      const property = properties.find((p) => p.id === loan.propertyId);
      if (property && property.currentValue > 0) {
        const lvr = loan.principal / property.currentValue;
        if (lvr > 0.8) {
          alerts.push({
            type: 'lvr_high',
            severity: lvr > 0.9 ? 'high' : 'medium',
            loanId: loan.id,
            loanName: loan.name,
            title: `High LVR: ${(lvr * 100).toFixed(0)}%`,
            description: `Your loan-to-value ratio is ${(lvr * 100).toFixed(1)}%. Consider paying down to below 80% to avoid LMI and get better rates.`,
            currentRate: loan.interestRateAnnual,
            impact: Math.round(loan.principal * 0.01), // Estimate 1% LMI cost
            action: 'Focus extra repayments to reduce LVR below 80%',
          });
        }
      }
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Extra Repayment Impact
// ============================================================================

function calculateExtraRepaymentImpact(
  loans: any[],
  monthlyIncome: number
): ExtraRepaymentImpact | null {
  if (loans.length === 0) return null;

  // Suggest 10% of monthly income as extra repayment
  const suggestedExtra = Math.round(monthlyIncome * 0.1);
  if (suggestedExtra < 100) return null;

  // Find highest interest rate loan that's not fixed
  const eligibleLoans = loans.filter(
    (loan) => loan.rateType !== 'FIXED' || !loan.fixedExpiry || new Date(loan.fixedExpiry) < new Date()
  );

  if (eligibleLoans.length === 0) return null;

  const targetLoan = eligibleLoans.reduce((highest, loan) =>
    loan.interestRateAnnual > highest.interestRateAnnual ? loan : highest
  );

  // Calculate impact of extra payments
  const currentMonthlyPayment = toMonthly(
    targetLoan.minRepayment,
    targetLoan.repaymentFrequency as Frequency
  );

  // Time to pay off with current payments
  const currentPayoffMonths = calculatePayoffMonths(
    targetLoan.principal,
    targetLoan.interestRateAnnual,
    currentMonthlyPayment
  );

  // Time to pay off with extra payments
  const newPayoffMonths = calculatePayoffMonths(
    targetLoan.principal,
    targetLoan.interestRateAnnual,
    currentMonthlyPayment + suggestedExtra
  );

  const timeReduced = currentPayoffMonths - newPayoffMonths;

  // Calculate interest saved
  const currentTotalInterest = calculateTotalInterest(
    targetLoan.principal,
    targetLoan.interestRateAnnual,
    currentMonthlyPayment,
    currentPayoffMonths
  );
  const newTotalInterest = calculateTotalInterest(
    targetLoan.principal,
    targetLoan.interestRateAnnual,
    currentMonthlyPayment + suggestedExtra,
    newPayoffMonths
  );
  const interestSaved = currentTotalInterest - newTotalInterest;

  const now = new Date();
  const currentPayoffDate = new Date(now);
  currentPayoffDate.setMonth(currentPayoffDate.getMonth() + currentPayoffMonths);

  const newPayoffDate = new Date(now);
  newPayoffDate.setMonth(newPayoffDate.getMonth() + newPayoffMonths);

  return {
    extraMonthly: suggestedExtra,
    interestSaved: Math.round(interestSaved),
    timeReduced,
    targetLoanId: targetLoan.id,
    targetLoanName: targetLoan.name,
    currentPayoffDate,
    newPayoffDate,
  };
}

// ============================================================================
// Loan Risk Detection
// ============================================================================

interface LoanRiskParams {
  loans: any[];
  debtMetrics: any;
  accounts: any[];
  properties: any[];
  refinanceOpportunities: RefinanceOpportunity[];
}

function detectLoanRisks(params: LoanRiskParams): LoanRisk[] {
  const { loans, debtMetrics, accounts, properties, refinanceOpportunities } = params;
  const risks: LoanRisk[] = [];

  // 1. High DTI ratio
  if (debtMetrics.debtToIncomeRatio > 50) {
    risks.push({
      type: 'high_dti_ratio',
      severity: debtMetrics.debtToIncomeRatio > 70 ? 'critical' : 'high',
      title: 'High Debt-to-Income Ratio',
      description: `Your DTI ratio is ${debtMetrics.debtToIncomeRatio.toFixed(0)}%, above the recommended 50% threshold.`,
      impact: Math.round(debtMetrics.monthlyRepayments * 0.2), // Estimate stress
      action: 'Focus on paying down debt or increasing income',
    });
  }

  // 2. Refinance opportunities
  const worthwhileRefinances = refinanceOpportunities.filter((r) => r.worthRefinancing);
  if (worthwhileRefinances.length > 0) {
    const totalSavings = worthwhileRefinances.reduce((sum, r) => sum + r.annualSavings, 0);
    risks.push({
      type: 'refinance_opportunity',
      severity: totalSavings > 5000 ? 'high' : totalSavings > 2000 ? 'medium' : 'low',
      title: `${worthwhileRefinances.length} refinance opportunity(ies)`,
      description: `You could save approximately $${totalSavings.toLocaleString()}/year by refinancing.`,
      impact: totalSavings,
      action: 'Review refinance opportunities to reduce interest costs',
    });
  }

  // 3. Rate shock risk (multiple loans with rates far above RBA cash rate)
  const variableLoans = loans.filter((l) => l.rateType === 'VARIABLE');
  const avgVariableRate =
    variableLoans.length > 0
      ? variableLoans.reduce((sum, l) => sum + l.interestRateAnnual, 0) / variableLoans.length
      : 0;

  if (variableLoans.length >= 2 && avgVariableRate > 0.07) {
    const totalVariableDebt = variableLoans.reduce((sum, l) => sum + l.principal, 0);
    const rateShockImpact = (totalVariableDebt * 0.01) / 12; // 1% rate rise monthly impact

    risks.push({
      type: 'rate_shock_risk',
      severity: 'medium',
      title: 'Variable rate exposure',
      description: `${variableLoans.length} variable loans totaling $${(totalVariableDebt / 1000).toFixed(0)}k. A 1% rate rise would cost $${rateShockImpact.toFixed(0)}/month extra.`,
      impact: Math.round(rateShockImpact * 12),
      action: 'Consider fixing some loans or building a buffer',
    });
  }

  // 4. Offset account underutilization
  const savingsAccounts = accounts.filter((a) => a.type === 'SAVINGS' || a.type === 'TRANSACTIONAL');
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const loansWithOffset = loans.filter((l) => l.offsetAccountId);
  const totalOffsetBalance = loansWithOffset.reduce(
    (sum, l) => sum + (l.offsetAccount?.currentBalance || 0),
    0
  );

  if (totalSavings > totalOffsetBalance + 10000 && loansWithOffset.length > 0) {
    const potentialSavings = ((totalSavings - totalOffsetBalance) * 0.06) / 12; // Assume 6% rate

    risks.push({
      type: 'offset_underutilized',
      severity: potentialSavings > 200 ? 'medium' : 'low',
      title: 'Offset account underutilized',
      description: `You have $${((totalSavings - totalOffsetBalance) / 1000).toFixed(0)}k in savings that could be in offset accounts to save interest.`,
      impact: Math.round(potentialSavings * 12),
      action: 'Move excess savings to offset accounts while maintaining liquidity',
    });
  }

  // 5. Debt consolidation opportunity
  const highInterestLoans = loans.filter((l) => l.interestRateAnnual > 0.08);
  if (highInterestLoans.length >= 2) {
    const totalHighInterestDebt = highInterestLoans.reduce((sum, l) => sum + l.principal, 0);
    const avgHighRate =
      highInterestLoans.reduce((sum, l) => sum + l.interestRateAnnual, 0) / highInterestLoans.length;
    const potentialRate = 0.065; // Consolidated rate estimate
    const potentialSavings = ((avgHighRate - potentialRate) * totalHighInterestDebt) / 12;

    if (potentialSavings > 100) {
      risks.push({
        type: 'debt_consolidation_opportunity',
        severity: potentialSavings > 300 ? 'medium' : 'low',
        title: 'Debt consolidation opportunity',
        description: `Consolidating ${highInterestLoans.length} high-interest loans could save approximately $${potentialSavings.toFixed(0)}/month.`,
        impact: Math.round(potentialSavings * 12),
        action: 'Consider consolidating high-interest debts into a lower-rate loan',
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate monthly payment using amortization formula
 */
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0 || months === 0) {
    return months > 0 ? principal / months : 0;
  }

  const monthlyRate = annualRate / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);

  return payment;
}

/**
 * Calculate months to pay off a loan
 */
function calculatePayoffMonths(
  principal: number,
  annualRate: number,
  monthlyPayment: number
): number {
  if (monthlyPayment <= 0) return 999;

  const monthlyRate = annualRate / 12;
  const monthlyInterest = principal * monthlyRate;

  // If payment doesn't cover interest, loan will never be paid off
  if (monthlyPayment <= monthlyInterest) {
    return 999;
  }

  // Use formula: n = -log(1 - (P*r)/M) / log(1 + r)
  const months = Math.ceil(
    -Math.log(1 - (principal * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
  );

  return Math.min(months, 600); // Cap at 50 years
}

/**
 * Calculate total interest paid over loan term
 */
function calculateTotalInterest(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  months: number
): number {
  const totalPayments = monthlyPayment * months;
  return Math.max(0, totalPayments - principal);
}

// ============================================================================
// Q-DEC PR 2.E.3 — Decimal sibling helpers
// ============================================================================

/**
 * Decimal sibling of the private `calculateMonthlyPayment` (amortising
 * annuity). Mirrors degenerate cases: rate 0 OR months 0 → straight-line
 * `principal / max(1, months)` (or 0 if months is 0).
 *
 * Note this is structurally identical to `calculatePIRepaymentDecimal`
 * in `lib/utils/calculations.ts` shipped in PR 2.E.1; the only difference
 * is the Float-side degenerate case here returns `principal / months`
 * (no `max(1, months)` floor when `months > 0`). Preserved bit-for-bit.
 */
export function calculateMonthlyPaymentDecimal(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  months: number,
): Decimal {
  const p = toDecimal(principal) ?? new Decimal(0);
  const r = toDecimal(annualRate) ?? new Decimal(0);

  if (r.isZero() || months === 0) {
    return months > 0 ? p.div(months) : new Decimal(0);
  }

  const monthlyRate = r.div(12);
  const onePlusRPow = new Decimal(1).plus(monthlyRate).pow(months);
  return p.times(monthlyRate).times(onePlusRPow).div(onePlusRPow.minus(1));
}

/**
 * Decimal sibling of the private `calculatePayoffMonths`. Mirrors:
 *   - monthlyPayment ≤ 0 → 999
 *   - monthlyPayment ≤ monthlyInterest → 999 (loan never paid off)
 *   - normal case: `ceil(-ln(1 - P×r/M) / ln(1 + r))`, capped at 600
 *
 * The logarithm function is not on `decimal.js`'s core API; we bridge
 * to Float via `.toNumber()` for the `Math.log` step. The drift is
 * negligible at sub-1-month precision (the output is `Math.ceil`'d to
 * an integer month count anyway).
 */
export function calculatePayoffMonthsDecimal(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal,
  monthlyPayment: number | string | Decimal,
): number {
  const p = toDecimal(principal) ?? new Decimal(0);
  const r = toDecimal(annualRate) ?? new Decimal(0);
  const m = toDecimal(monthlyPayment) ?? new Decimal(0);

  if (m.lte(0)) return 999;

  const monthlyRate = r.div(12);
  const monthlyInterest = p.times(monthlyRate);

  if (m.lte(monthlyInterest)) return 999;

  // Bridge to Float for the logarithm — see jsdoc.
  const factor = new Decimal(1).minus(p.times(monthlyRate).div(m));
  const num = -Math.log(factor.toNumber());
  const denom = Math.log(new Decimal(1).plus(monthlyRate).toNumber());
  const months = Math.ceil(num / denom);

  return Math.min(months, 600);
}

/**
 * Decimal sibling of the private `calculateTotalInterest`. Simple:
 * `max(0, monthlyPayment × months − principal)`.
 */
export function calculateTotalInterestDecimal(
  principal: number | string | Decimal,
  annualRate: number | string | Decimal, // unused — kept for signature parity
  monthlyPayment: number | string | Decimal,
  months: number,
): Decimal {
  const p = toDecimal(principal) ?? new Decimal(0);
  const m = toDecimal(monthlyPayment) ?? new Decimal(0);
  const totalPayments = m.times(months);
  return Decimal.max(new Decimal(0), totalPayments.minus(p));
}

// ============================================================================
// Exports
// ============================================================================

export { MARKET_RATES };
