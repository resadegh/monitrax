/**
 * CASHFLOW ANALYZER
 * Phase 11 - Stage 3A.2
 *
 * Analyzes cashflow health:
 * - Emergency fund adequacy
 * - Spending risk detection
 * - Surplus allocation recommendations
 * - Income stability assessment
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';
import { SAFEGUARDS } from '../core/safeguards';

// =============================================================================
// TYPES
// =============================================================================

interface CashflowMetrics {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  emergencyFundMonths: number;
  expenseToIncomeRatio: number;
  incomeStability: number; // 0-100
}

// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Analyze cashflow health and opportunities
 */
export async function analyzeCashflow(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    if (!data.snapshot?.cashflowSummary) {
      return {
        analyzer: 'CashflowAnalyzer',
        findings: [],
        executionTime: Date.now() - startTime,
        errors: ['No cashflow data available'],
      };
    }

    const metrics = extractCashflowMetrics(data);

    // Analyze emergency fund
    const emergencyFindings = analyzeEmergencyFund(metrics, data);
    findings.push(...emergencyFindings);

    // Analyze spending risk
    const spendingFindings = analyzeSpendingRisk(metrics, data);
    findings.push(...spendingFindings);

    // Analyze surplus allocation
    const surplusFindings = analyzeSurplusAllocation(metrics, data);
    findings.push(...surplusFindings);

    // Analyze income stability
    const stabilityFindings = analyzeIncomeStability(metrics, data);
    findings.push(...stabilityFindings);
  } catch (error) {
    errors.push(`Cashflow analysis error: ${error}`);
  }

  return {
    analyzer: 'CashflowAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

// =============================================================================
// EMERGENCY FUND ANALYSIS
// =============================================================================

function analyzeEmergencyFund(
  metrics: CashflowMetrics,
  data: StrategyDataPacket
): Finding[] {
  const findings: Finding[] = [];

  const { emergencyFundMonths, monthlyExpenses } = metrics;
  const minRequired = SAFEGUARDS.minEmergencyFund;

  if (emergencyFundMonths < minRequired) {
    const shortfall = (minRequired - emergencyFundMonths) * monthlyExpenses;
    const severity: 'critical' | 'high' | 'medium' =
      emergencyFundMonths < 1 ? 'critical' :
      emergencyFundMonths < 2 ? 'high' : 'medium';

    findings.push({
      id: `emergency-fund-low-${Date.now()}`,
      type: 'CASHFLOW_EMERGENCY_LOW',
      severity,
      title: 'Insufficient Emergency Fund',
      description: `Your emergency fund covers only ${emergencyFundMonths.toFixed(1)} months of expenses. The recommended minimum is ${minRequired} months. You need $${shortfall.toFixed(0)} more.`,
      impactScore: {
        financial: 80,
        risk: 95,
        liquidity: 85,
        tax: 0,
        confidence: 95,
      },
      evidence: {
        currentMonths: emergencyFundMonths,
        recommendedMonths: minRequired,
        monthlyExpenses,
        shortfall,
        currentBuffer: emergencyFundMonths * monthlyExpenses,
      },
      suggestedAction: `Build emergency fund to ${minRequired} months (${(minRequired * monthlyExpenses).toFixed(0)}) by allocating surplus or reducing discretionary spending.`,
    });
  } else if (emergencyFundMonths >= 6) {
    // Opportunity to deploy excess cash
    const excess = (emergencyFundMonths - 6) * monthlyExpenses;

    if (excess > 10000) {
      findings.push({
        id: `emergency-fund-excess-${Date.now()}`,
        type: 'CASHFLOW_EMERGENCY_EXCESS',
        severity: 'low',
        title: 'Excess Emergency Fund',
        description: `Your emergency fund (${emergencyFundMonths.toFixed(1)} months) exceeds the recommended 6 months. Consider deploying $${excess.toFixed(0)} to investments or debt reduction.`,
        impactScore: {
          financial: 45,
          risk: -10,
          liquidity: -20,
          tax: 5,
          confidence: 85,
        },
        evidence: {
          currentMonths: emergencyFundMonths,
          recommendedMonths: 6,
          monthlyExpenses,
          excess,
        },
        suggestedAction: `Deploy excess emergency funds ($${excess.toFixed(0)}) to higher-returning investments while maintaining 6-month buffer.`,
      });
    }
  }

  return findings;
}

// =============================================================================
// SPENDING RISK ANALYSIS
// =============================================================================

function analyzeSpendingRisk(
  metrics: CashflowMetrics,
  data: StrategyDataPacket
): Finding[] {
  const findings: Finding[] = [];

  const { expenseToIncomeRatio, monthlyIncome, monthlyExpenses } = metrics;

  // Check if expenses are too high relative to income
  if (expenseToIncomeRatio > SAFEGUARDS.maxExpenseToIncome) {
    findings.push({
      id: `spending-risk-high-${Date.now()}`,
      type: 'CASHFLOW_SPENDING_HIGH',
      severity: 'critical',
      title: 'High Spending Risk',
      description: `Your expenses (${(expenseToIncomeRatio * 100).toFixed(1)}% of income) exceed the recommended maximum of ${(SAFEGUARDS.maxExpenseToIncome * 100).toFixed(0)}%. This leaves minimal buffer for emergencies.`,
      impactScore: {
        financial: 75,
        risk: 85,
        liquidity: 80,
        tax: 0,
        confidence: 90,
      },
      evidence: {
        monthlyIncome,
        monthlyExpenses,
        expenseToIncomeRatio,
        maxRecommended: SAFEGUARDS.maxExpenseToIncome,
        excessSpending: monthlyExpenses - (monthlyIncome * SAFEGUARDS.maxExpenseToIncome),
      },
      suggestedAction: `Reduce expenses by $${(monthlyExpenses - (monthlyIncome * SAFEGUARDS.maxExpenseToIncome)).toFixed(0)}/month to bring spending below ${(SAFEGUARDS.maxExpenseToIncome * 100).toFixed(0)}% of income.`,
    });
  } else if (expenseToIncomeRatio > 0.70) {
    // Warning at 70%
    findings.push({
      id: `spending-risk-moderate-${Date.now()}`,
      type: 'CASHFLOW_SPENDING_MODERATE',
      severity: 'medium',
      title: 'Moderate Spending Risk',
      description: `Your expenses are ${(expenseToIncomeRatio * 100).toFixed(1)}% of income. Consider reducing to improve financial flexibility.`,
      impactScore: {
        financial: 55,
        risk: 60,
        liquidity: 50,
        tax: 0,
        confidence: 85,
      },
      evidence: {
        monthlyIncome,
        monthlyExpenses,
        expenseToIncomeRatio,
      },
      suggestedAction: 'Review discretionary spending and identify areas to reduce monthly expenses.',
    });
  }

  return findings;
}

// =============================================================================
// SURPLUS ALLOCATION ANALYSIS
// =============================================================================

function analyzeSurplusAllocation(
  metrics: CashflowMetrics,
  data: StrategyDataPacket
): Finding[] {
  const findings: Finding[] = [];

  const { monthlySurplus, emergencyFundMonths, monthlyExpenses } = metrics;

  if (monthlySurplus > 0) {
    // Determine optimal allocation priority
    const priorities: Array<{
      name: string;
      amount: number;
      reason: string;
    }> = [];

    // Priority 1: Emergency fund (if below minimum)
    if (emergencyFundMonths < SAFEGUARDS.minEmergencyFund) {
      const shortfall = (SAFEGUARDS.minEmergencyFund - emergencyFundMonths) * monthlyExpenses;
      const monthsToFund = Math.ceil(shortfall / monthlySurplus);

      priorities.push({
        name: 'Emergency Fund',
        amount: Math.min(monthlySurplus, shortfall),
        reason: `Build to ${SAFEGUARDS.minEmergencyFund} months (${monthsToFund} months at current surplus)`,
      });
    }

    // Priority 2: High-interest debt (if DTI > 30% or loans > 8%)
    const highInterestDebt = data.snapshot?.loans?.some(
      (loan: any) => (loan.interestRate || 0) > 0.08
    );

    if (highInterestDebt) {
      priorities.push({
        name: 'High-Interest Debt',
        amount: monthlySurplus * 0.5,
        reason: 'Pay down loans with interest rates > 8%',
      });
    }

    // Priority 3: Investments (if emergency fund adequate)
    if (emergencyFundMonths >= SAFEGUARDS.minEmergencyFund) {
      priorities.push({
        name: 'Investments',
        amount: monthlySurplus * 0.7,
        reason: 'Build long-term wealth through diversified investments',
      });
    }

    if (priorities.length > 0) {
      findings.push({
        id: `surplus-allocation-${Date.now()}`,
        type: 'CASHFLOW_SURPLUS_ALLOCATION',
        severity: monthlySurplus > 1000 ? 'medium' : 'low',
        title: 'Surplus Allocation Opportunity',
        description: `You have a monthly surplus of $${monthlySurplus.toFixed(0)}. Optimize allocation across ${priorities.length} priorities for maximum financial benefit.`,
        impactScore: {
          financial: 70,
          risk: 40,
          liquidity: 30,
          tax: 10,
          confidence: 85,
        },
        evidence: {
          monthlySurplus,
          emergencyFundMonths,
          allocationPriorities: priorities,
        },
        suggestedAction: `Allocate surplus: ${priorities.map((p) => `${p.name} ($${p.amount.toFixed(0)})`).join(', ')}`,
      });
    }
  } else if (monthlySurplus < -500) {
    // Negative cashflow - deficit spending
    findings.push({
      id: `cashflow-deficit-${Date.now()}`,
      type: 'CASHFLOW_DEFICIT',
      severity: 'critical',
      title: 'Negative Cashflow',
      description: `You are spending $${Math.abs(monthlySurplus).toFixed(0)}/month more than you earn. This is unsustainable and will deplete savings.`,
      impactScore: {
        financial: 90,
        risk: 95,
        liquidity: 90,
        tax: 0,
        confidence: 95,
      },
      evidence: {
        monthlySurplus,
        monthlyIncome: metrics.monthlyIncome,
        monthlyExpenses: metrics.monthlyExpenses,
      },
      suggestedAction: `Urgent: Reduce expenses by $${Math.abs(monthlySurplus).toFixed(0)}/month or increase income to restore positive cashflow.`,
    });
  }

  return findings;
}

// =============================================================================
// INCOME STABILITY ANALYSIS
// =============================================================================

function analyzeIncomeStability(
  metrics: CashflowMetrics,
  data: StrategyDataPacket
): Finding[] {
  const findings: Finding[] = [];

  // Check if income stability score is available from snapshot
  const { incomeStability } = metrics;

  if (incomeStability < 60) {
    // Low stability
    const recommendedBuffer = Math.ceil(SAFEGUARDS.minEmergencyFund * 1.5); // 4.5 months

    findings.push({
      id: `income-unstable-${Date.now()}`,
      type: 'CASHFLOW_INCOME_UNSTABLE',
      severity: 'high',
      title: 'Unstable Income Detected',
      description: `Your income stability score is ${incomeStability.toFixed(0)}/100, indicating variability. Consider increasing emergency fund to ${recommendedBuffer} months.`,
      impactScore: {
        financial: 65,
        risk: 75,
        liquidity: 70,
        tax: 0,
        confidence: 75,
      },
      evidence: {
        incomeStability,
        currentEmergencyFund: metrics.emergencyFundMonths,
        recommendedEmergencyFund: recommendedBuffer,
      },
      suggestedAction: `Build a larger emergency fund (${recommendedBuffer} months) to buffer against income variability.`,
    });
  }

  return findings;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract cashflow metrics from data packet
 */
function extractCashflowMetrics(data: StrategyDataPacket): CashflowMetrics {
  const cashflow = data.snapshot?.cashflowSummary || {};

  const monthlyIncome = cashflow.monthlyIncome || 0;
  const monthlyExpenses = cashflow.monthlyExpenses || 0;
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const availableCash = cashflow.availableCash || 0;

  // Calculate emergency fund in months
  const emergencyFundMonths =
    monthlyExpenses > 0 ? availableCash / monthlyExpenses : 0;

  // Calculate expense to income ratio
  const expenseToIncomeRatio =
    monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 1;

  // Calculate income stability (simplified - would use historical variance in production)
  const incomeStability = cashflow.incomeStability || 75; // Default to moderate

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    emergencyFundMonths,
    expenseToIncomeRatio,
    incomeStability,
  };
}
