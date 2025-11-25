/**
 * DEBT ANALYZER
 * Phase 11 - Stage 3A.1
 *
 * Analyzes loan/debt opportunities:
 * - Refinancing recommendations
 * - Debt consolidation
 * - Early repayment analysis
 * - Offset account optimization
 */

import type {
  StrategyDataPacket,
  Finding,
  ImpactScore,
  AnalysisResult,
} from '../core/types';
import { SAFEGUARDS } from '../core/safeguards';

// =============================================================================
// TYPES
// =============================================================================

interface LoanData {
  id: string;
  type: string;
  principal: number;
  balance: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  remainingMonths: number;
  offsetBalance?: number;
}

interface RefinanceOpportunity {
  loanId: string;
  currentRate: number;
  marketRate: number;
  rateDifference: number;
  monthlySavings: number;
  refinanceCosts: number;
  breakEvenMonths: number;
  totalSavings: number;
  worthwhile: boolean;
}

interface ConsolidationOpportunity {
  loanIds: string[];
  currentAverageRate: number;
  consolidatedRate: number;
  rateDifference: number;
  monthlySavings: number;
  consolidationCosts: number;
  worthwhile: boolean;
}

// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Analyze debt/loan opportunities
 */
export async function analyzeDebt(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    if (!data.snapshot?.loans || data.snapshot.loans.length === 0) {
      return {
        analyzer: 'DebtAnalyzer',
        findings: [],
        executionTime: Date.now() - startTime,
        errors: ['No loan data available'],
      };
    }

    const loans = extractLoanData(data.snapshot.loans);

    // Check debt-to-income ratio
    const dtiFindings = analyzeDTI(data, loans);
    findings.push(...dtiFindings);

    // Analyze refinancing opportunities
    const refinanceFindings = await analyzeRefinancing(data, loans);
    findings.push(...refinanceFindings);

    // Analyze debt consolidation
    const consolidationFindings = analyzeConsolidation(loans);
    findings.push(...consolidationFindings);

    // Analyze early repayment opportunities
    const repaymentFindings = analyzeEarlyRepayment(data, loans);
    findings.push(...repaymentFindings);

    // Analyze offset account optimization
    const offsetFindings = analyzeOffsetAccounts(data, loans);
    findings.push(...offsetFindings);
  } catch (error) {
    errors.push(`Debt analysis error: ${error}`);
  }

  return {
    analyzer: 'DebtAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

// =============================================================================
// DEBT-TO-INCOME RATIO ANALYSIS
// =============================================================================

function analyzeDTI(
  data: StrategyDataPacket,
  loans: LoanData[]
): Finding[] {
  const findings: Finding[] = [];

  // Calculate total monthly debt payments
  const totalMonthlyDebt = loans.reduce(
    (sum, loan) => sum + loan.monthlyPayment,
    0
  );

  // Get monthly income from cashflow
  const monthlyIncome =
    data.snapshot?.cashflowSummary?.monthlyIncome || 0;

  if (monthlyIncome === 0) {
    return findings; // Can't calculate DTI without income
  }

  const dtiRatio = totalMonthlyDebt / monthlyIncome;

  // Check against safeguard limit
  if (dtiRatio > SAFEGUARDS.maxDebtToIncome) {
    findings.push({
      id: `dti-high-${Date.now()}`,
      type: 'DEBT_HIGH_DTI',
      severity: 'critical',
      title: 'High Debt-to-Income Ratio',
      description: `Your debt-to-income ratio is ${(dtiRatio * 100).toFixed(1)}%, which exceeds the recommended maximum of ${(SAFEGUARDS.maxDebtToIncome * 100).toFixed(0)}%. This indicates high debt stress.`,
      impactScore: {
        financial: 85,
        risk: 90,
        liquidity: 75,
        tax: 0,
        confidence: 95,
      },
      evidence: {
        totalMonthlyDebt,
        monthlyIncome,
        dtiRatio,
        maxRecommended: SAFEGUARDS.maxDebtToIncome,
        loanCount: loans.length,
      },
      suggestedAction: `Reduce debt payments to bring DTI below ${(SAFEGUARDS.maxDebtToIncome * 100).toFixed(0)}%. Consider debt consolidation or income increase strategies.`,
    });
  } else if (dtiRatio > 0.35) {
    // Warning threshold at 35%
    findings.push({
      id: `dti-moderate-${Date.now()}`,
      type: 'DEBT_MODERATE_DTI',
      severity: 'medium',
      title: 'Moderate Debt-to-Income Ratio',
      description: `Your debt-to-income ratio is ${(dtiRatio * 100).toFixed(1)}%. While below the maximum, consider reducing debt to improve financial flexibility.`,
      impactScore: {
        financial: 60,
        risk: 65,
        liquidity: 55,
        tax: 0,
        confidence: 95,
      },
      evidence: {
        totalMonthlyDebt,
        monthlyIncome,
        dtiRatio,
        maxRecommended: SAFEGUARDS.maxDebtToIncome,
      },
      suggestedAction: 'Monitor debt levels and consider paying down high-interest loans.',
    });
  }

  return findings;
}

// =============================================================================
// REFINANCING ANALYSIS
// =============================================================================

async function analyzeRefinancing(
  data: StrategyDataPacket,
  loans: LoanData[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Get market rates (simplified - would fetch from external API in production)
  const marketRates = {
    'home-loan': 0.045, // 4.5%
    'investment-loan': 0.050, // 5.0%
    'personal-loan': 0.080, // 8.0%
  };

  for (const loan of loans) {
    const marketRate = marketRates[loan.type as keyof typeof marketRates] || 0.06;
    const opportunity = calculateRefinanceOpportunity(loan, marketRate);

    if (opportunity.worthwhile) {
      const severity =
        opportunity.monthlySavings > 500 ? 'high' :
        opportunity.monthlySavings > 200 ? 'medium' : 'low';

      findings.push({
        id: `refinance-${loan.id}`,
        type: 'DEBT_REFINANCE',
        severity,
        title: `Refinance Opportunity: ${loan.type}`,
        description: `You could save $${opportunity.monthlySavings.toFixed(2)}/month by refinancing from ${(opportunity.currentRate * 100).toFixed(2)}% to ${(opportunity.marketRate * 100).toFixed(2)}%. Break-even in ${opportunity.breakEvenMonths} months.`,
        impactScore: {
          financial: Math.min(100, (opportunity.totalSavings / 1000) * 10),
          risk: 30, // Lower risk from lower rate
          liquidity: -20, // Temporary reduction due to costs
          tax: 5,
          confidence: 85,
        },
        evidence: {
          loanId: loan.id,
          currentBalance: loan.balance,
          currentRate: opportunity.currentRate,
          marketRate: opportunity.marketRate,
          rateDifference: opportunity.rateDifference,
          monthlySavings: opportunity.monthlySavings,
          totalSavings: opportunity.totalSavings,
          refinanceCosts: opportunity.refinanceCosts,
          breakEvenMonths: opportunity.breakEvenMonths,
          remainingMonths: loan.remainingMonths,
        },
        suggestedAction: `Refinance this loan to save $${opportunity.totalSavings.toFixed(0)} over the remaining term. Contact lenders for quotes.`,
      });
    }
  }

  return findings;
}

/**
 * Calculate refinance opportunity details
 */
function calculateRefinanceOpportunity(
  loan: LoanData,
  marketRate: number
): RefinanceOpportunity {
  const currentRate = loan.interestRate;
  const rateDifference = currentRate - marketRate;

  // Calculate monthly payment at new rate
  const newMonthlyPayment = calculateMonthlyPayment(
    loan.balance,
    marketRate,
    loan.remainingMonths
  );

  const monthlySavings = loan.monthlyPayment - newMonthlyPayment;

  // Estimate refinance costs (2% of loan balance is typical)
  const refinanceCosts = loan.balance * 0.02;

  // Calculate break-even point
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(refinanceCosts / monthlySavings) : 999;

  // Total savings over remaining term
  const totalSavings = (monthlySavings * loan.remainingMonths) - refinanceCosts;

  // Check if worthwhile based on safeguards
  const worthwhile =
    rateDifference >= SAFEGUARDS.minRefinanceGap &&
    breakEvenMonths <= SAFEGUARDS.maxRefinanceBreakeven &&
    totalSavings >= SAFEGUARDS.minRefinanceSavings;

  return {
    loanId: loan.id,
    currentRate,
    marketRate,
    rateDifference,
    monthlySavings,
    refinanceCosts,
    breakEvenMonths,
    totalSavings,
    worthwhile,
  };
}

// =============================================================================
// DEBT CONSOLIDATION ANALYSIS
// =============================================================================

function analyzeConsolidation(loans: LoanData[]): Finding[] {
  const findings: Finding[] = [];

  // Only consider consolidation if multiple high-interest loans
  const highInterestLoans = loans.filter((loan) => loan.interestRate > 0.06);

  if (highInterestLoans.length < 2) {
    return findings; // Need at least 2 loans to consolidate
  }

  // Calculate average rate
  const totalBalance = highInterestLoans.reduce((sum, loan) => sum + loan.balance, 0);
  const weightedRate = highInterestLoans.reduce(
    (sum, loan) => sum + (loan.balance / totalBalance) * loan.interestRate,
    0
  );

  // Estimate consolidated rate (typically 0.5% lower than average)
  const consolidatedRate = Math.max(0.04, weightedRate - 0.005);

  const rateDifference = weightedRate - consolidatedRate;

  // Check if consolidation makes sense
  if (rateDifference >= 0.003) {
    // At least 0.3% difference
    const totalMonthlyPayment = highInterestLoans.reduce(
      (sum, loan) => sum + loan.monthlyPayment,
      0
    );

    // Calculate new payment
    const avgRemainingMonths = Math.round(
      highInterestLoans.reduce((sum, loan) => sum + loan.remainingMonths, 0) /
        highInterestLoans.length
    );

    const newMonthlyPayment = calculateMonthlyPayment(
      totalBalance,
      consolidatedRate,
      avgRemainingMonths
    );

    const monthlySavings = totalMonthlyPayment - newMonthlyPayment;
    const consolidationCosts = totalBalance * 0.015; // 1.5% typical cost

    findings.push({
      id: `consolidate-${Date.now()}`,
      type: 'DEBT_CONSOLIDATE',
      severity: monthlySavings > 300 ? 'high' : 'medium',
      title: 'Debt Consolidation Opportunity',
      description: `Consolidating ${highInterestLoans.length} loans could reduce your interest rate from ${(weightedRate * 100).toFixed(2)}% to ${(consolidatedRate * 100).toFixed(2)}%, saving $${monthlySavings.toFixed(2)}/month.`,
      impactScore: {
        financial: 70,
        risk: 35,
        liquidity: 40,
        tax: 0,
        confidence: 75,
      },
      evidence: {
        loanCount: highInterestLoans.length,
        totalBalance,
        currentAverageRate: weightedRate,
        consolidatedRate,
        rateDifference,
        monthlySavings,
        consolidationCosts,
        loanIds: highInterestLoans.map((l) => l.id),
      },
      suggestedAction: `Consolidate ${highInterestLoans.length} loans to simplify payments and reduce interest costs.`,
    });
  }

  return findings;
}

// =============================================================================
// EARLY REPAYMENT ANALYSIS
// =============================================================================

function analyzeEarlyRepayment(
  data: StrategyDataPacket,
  loans: LoanData[]
): Finding[] {
  const findings: Finding[] = [];

  // Get monthly surplus from cashflow
  const monthlySurplus = data.snapshot?.cashflowSummary?.monthlySurplus || 0;

  if (monthlySurplus <= 0) {
    return findings; // No surplus to allocate
  }

  // Get expected investment return (default 7%)
  const expectedInvestmentReturn = 0.07;

  // Find loans where rate > investment return + 2%
  const highInterestLoans = loans.filter(
    (loan) => loan.interestRate > expectedInvestmentReturn + 0.02
  );

  for (const loan of highInterestLoans) {
    // Calculate savings from extra payments
    const extraPayment = Math.min(monthlySurplus * 0.5, loan.monthlyPayment); // Max 50% of surplus
    const yearlySavings = loan.balance * (loan.interestRate - expectedInvestmentReturn);

    if (yearlySavings > 1000) {
      // At least $1k/year benefit
      findings.push({
        id: `early-repay-${loan.id}`,
        type: 'DEBT_EARLY_REPAY',
        severity: 'medium',
        title: `Early Repayment Opportunity: ${loan.type}`,
        description: `Paying an extra $${extraPayment.toFixed(2)}/month on this ${(loan.interestRate * 100).toFixed(2)}% loan would save more than investing at ${(expectedInvestmentReturn * 100).toFixed(0)}% returns.`,
        impactScore: {
          financial: 65,
          risk: 40,
          liquidity: -30,
          tax: 10,
          confidence: 80,
        },
        evidence: {
          loanId: loan.id,
          loanRate: loan.interestRate,
          investmentReturn: expectedInvestmentReturn,
          rateDifference: loan.interestRate - expectedInvestmentReturn,
          extraPayment,
          yearlySavings,
          currentBalance: loan.balance,
        },
        suggestedAction: `Allocate $${extraPayment.toFixed(2)}/month to extra loan repayments instead of investing.`,
      });
    }
  }

  return findings;
}

// =============================================================================
// OFFSET ACCOUNT OPTIMIZATION
// =============================================================================

function analyzeOffsetAccounts(
  data: StrategyDataPacket,
  loans: LoanData[]
): Finding[] {
  const findings: Finding[] = [];

  // Get available cash from snapshot
  const availableCash = data.snapshot?.cashflowSummary?.availableCash || 0;

  // Find loans with offset capability but low offset balance
  const loansWithOffset = loans.filter(
    (loan) => loan.offsetBalance !== undefined && loan.offsetBalance !== null
  );

  for (const loan of loansWithOffset) {
    const offsetBalance = loan.offsetBalance || 0;
    const potentialOffset = Math.min(availableCash, loan.balance * 0.5); // Max 50% of balance

    if (potentialOffset > offsetBalance + 5000) {
      // At least $5k opportunity
      const additionalOffset = potentialOffset - offsetBalance;
      const monthlySavings = (additionalOffset * loan.interestRate) / 12;
      const yearlySavings = monthlySavings * 12;

      findings.push({
        id: `offset-${loan.id}`,
        type: 'DEBT_OFFSET_OPTIMIZE',
        severity: yearlySavings > 500 ? 'medium' : 'low',
        title: `Offset Account Opportunity: ${loan.type}`,
        description: `Moving $${additionalOffset.toFixed(0)} to your offset account would save $${monthlySavings.toFixed(2)}/month in interest (${(loan.interestRate * 100).toFixed(2)}% rate).`,
        impactScore: {
          financial: Math.min(100, (yearlySavings / 100) * 10),
          risk: 10,
          liquidity: 0, // Money still accessible
          tax: 5,
          confidence: 90,
        },
        evidence: {
          loanId: loan.id,
          currentOffset: offsetBalance,
          potentialOffset,
          additionalOffset,
          loanRate: loan.interestRate,
          monthlySavings,
          yearlySavings,
          loanBalance: loan.balance,
        },
        suggestedAction: `Transfer $${additionalOffset.toFixed(0)} to offset account to reduce interest while maintaining liquidity.`,
      });
    }
  }

  return findings;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract loan data from snapshot
 */
function extractLoanData(loans: any[]): LoanData[] {
  return loans.map((loan) => ({
    id: loan.id,
    type: loan.type || 'unknown',
    principal: loan.principal || loan.originalAmount || 0,
    balance: loan.balance || loan.currentBalance || 0,
    interestRate: loan.interestRate || loan.rate || 0,
    termMonths: loan.termMonths || loan.term || 360,
    monthlyPayment: loan.monthlyPayment || loan.payment || 0,
    remainingMonths: loan.remainingMonths || loan.termMonths || 360,
    offsetBalance: loan.offsetBalance,
  }));
}

/**
 * Calculate monthly payment using amortization formula
 * P = L[r(1+r)^n] / [(1+r)^n - 1]
 */
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) {
    return principal / months;
  }

  const monthlyRate = annualRate / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);

  return payment;
}
