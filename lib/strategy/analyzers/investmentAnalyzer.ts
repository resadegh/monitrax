/**
 * INVESTMENT ANALYZER
 * Phase 11 - Stage 3B.1
 *
 * Analyzes investment portfolio:
 * - Portfolio rebalancing needs
 * - Asset allocation drift
 * - Diversification assessment
 * - Concentration risk
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';
import { SAFEGUARDS } from '../core/safeguards';

export async function analyzeInvestments(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    if (!data.snapshot?.investments || data.snapshot.investments.length === 0) {
      return {
        analyzer: 'InvestmentAnalyzer',
        findings: [],
        executionTime: Date.now() - startTime,
        errors: ['No investment data available'],
      };
    }

    const investments = data.snapshot.investments;
    const totalValue = investments.reduce((sum: number, inv: any) => sum + (inv.currentValue || 0), 0);

    // Check concentration risk
    const concentrationFindings = analyzeConcentrationRisk(investments, totalValue);
    findings.push(...concentrationFindings);

    // Check diversification
    const diversificationFindings = analyzeDiversification(investments);
    findings.push(...diversificationFindings);

    // Check rebalancing needs
    const rebalanceFindings = analyzeRebalancing(investments, totalValue, data);
    findings.push(...rebalanceFindings);

  } catch (error) {
    errors.push(`Investment analysis error: ${error}`);
  }

  return {
    analyzer: 'InvestmentAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function analyzeConcentrationRisk(investments: any[], totalValue: number): Finding[] {
  const findings: Finding[] = [];

  for (const investment of investments) {
    const value = investment.currentValue || 0;
    const percentage = totalValue > 0 ? value / totalValue : 0;

    if (percentage > SAFEGUARDS.maxSingleInvestment) {
      findings.push({
        id: `concentration-${investment.id}`,
        type: 'INVESTMENT_CONCENTRATION',
        severity: 'high',
        title: `Concentration Risk: ${investment.name || 'Investment'}`,
        description: `This investment represents ${(percentage * 100).toFixed(1)}% of your portfolio, exceeding the recommended maximum of ${(SAFEGUARDS.maxSingleInvestment * 100).toFixed(0)}%.`,
        impactScore: {
          financial: 60,
          risk: 85,
          liquidity: 40,
          tax: 0,
          confidence: 90,
        },
        evidence: {
          investmentId: investment.id,
          investmentName: investment.name,
          value,
          percentage,
          maxRecommended: SAFEGUARDS.maxSingleInvestment,
          totalPortfolio: totalValue,
        },
        suggestedAction: `Reduce position to below ${(SAFEGUARDS.maxSingleInvestment * 100).toFixed(0)}% by diversifying into other assets.`,
      });
    }
  }

  return findings;
}

function analyzeDiversification(investments: any[]): Finding[] {
  const findings: Finding[] = [];

  if (investments.length < SAFEGUARDS.minDiversification) {
    findings.push({
      id: `diversification-low-${Date.now()}`,
      type: 'INVESTMENT_DIVERSIFICATION_LOW',
      severity: 'medium',
      title: 'Low Portfolio Diversification',
      description: `You have only ${investments.length} investments. The recommended minimum is ${SAFEGUARDS.minDiversification} to reduce risk.`,
      impactScore: {
        financial: 50,
        risk: 75,
        liquidity: 30,
        tax: 0,
        confidence: 85,
      },
      evidence: {
        currentHoldings: investments.length,
        recommendedMin: SAFEGUARDS.minDiversification,
        investmentNames: investments.map((i: any) => i.name || i.id),
      },
      suggestedAction: `Increase diversification by adding ${SAFEGUARDS.minDiversification - investments.length} more holdings across different asset classes.`,
    });
  }

  return findings;
}

function analyzeRebalancing(investments: any[], totalValue: number, data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  // Get user's target allocation from preferences (simplified)
  const riskAppetite = data.preferences?.riskAppetite || 'MODERATE';

  // Define target allocations based on risk appetite
  const targetAllocations: Record<string, Record<string, number>> = {
    CONSERVATIVE: { stocks: 0.40, bonds: 0.50, cash: 0.10 },
    MODERATE: { stocks: 0.60, bonds: 0.30, cash: 0.10 },
    AGGRESSIVE: { stocks: 0.80, bonds: 0.15, cash: 0.05 },
  };

  const target = targetAllocations[riskAppetite] || targetAllocations.MODERATE;

  // Calculate current allocation
  const currentAllocation: Record<string, number> = {};
  for (const inv of investments) {
    const type = inv.assetClass || inv.type || 'other';
    currentAllocation[type] = (currentAllocation[type] || 0) + (inv.currentValue || 0);
  }

  // Check for drift
  for (const [assetClass, targetPercent] of Object.entries(target)) {
    const currentValue = currentAllocation[assetClass] || 0;
    const currentPercent = totalValue > 0 ? currentValue / totalValue : 0;
    const drift = Math.abs(currentPercent - targetPercent);

    if (drift > 0.10) {
      // 10% drift threshold
      findings.push({
        id: `rebalance-${assetClass}-${Date.now()}`,
        type: 'INVESTMENT_REBALANCE',
        severity: drift > 0.15 ? 'medium' : 'low',
        title: `Rebalancing Needed: ${assetClass}`,
        description: `Your ${assetClass} allocation (${(currentPercent * 100).toFixed(1)}%) has drifted ${(drift * 100).toFixed(1)}% from target (${(targetPercent * 100).toFixed(0)}%).`,
        impactScore: {
          financial: 55,
          risk: 65,
          liquidity: 20,
          tax: -10, // Potential tax cost
          confidence: 80,
        },
        evidence: {
          assetClass,
          currentPercent,
          targetPercent,
          drift,
          currentValue,
          targetValue: totalValue * targetPercent,
          adjustmentNeeded: (totalValue * targetPercent) - currentValue,
        },
        suggestedAction: `Rebalance ${assetClass} to ${(targetPercent * 100).toFixed(0)}% of portfolio ($${(totalValue * targetPercent).toFixed(0)}).`,
      });
    }
  }

  return findings;
}
