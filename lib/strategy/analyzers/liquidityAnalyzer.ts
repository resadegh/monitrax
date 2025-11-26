/**
 * LIQUIDITY ANALYZER
 * Phase 11 - Stage 3B.4
 *
 * Analyzes liquidity position:
 * - Cash reserves adequacy
 * - Liquidity ratios
 * - Quick access to funds
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';
import { SAFEGUARDS } from '../core/safeguards';

export async function analyzeLiquidity(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    const liquidityFindings = assessLiquidity(data);
    findings.push(...liquidityFindings);

  } catch (error) {
    errors.push(`Liquidity analysis error: ${error}`);
  }

  return {
    analyzer: 'LiquidityAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function assessLiquidity(data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  // Calculate liquid assets
  const cashBalance = data.snapshot?.cashflowSummary?.availableCash || 0;
  const investments = data.snapshot?.investments || [];
  const liquidInvestments = investments.filter((i: any) => i.isLiquid !== false);
  const liquidInvestmentValue = liquidInvestments.reduce(
    (sum: number, i: any) => sum + (i.currentValue || 0),
    0
  );

  const totalLiquidAssets = cashBalance + liquidInvestmentValue;

  // Calculate total assets
  const properties = data.snapshot?.properties || [];
  const propertyValue = properties.reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0);
  const totalInvestments = investments.reduce((sum: number, i: any) => sum + (i.currentValue || 0), 0);
  const totalAssets = cashBalance + totalInvestments + propertyValue;

  // Calculate liquidity ratio
  const liquidityRatio = totalAssets > 0 ? totalLiquidAssets / totalAssets : 0;

  // Check against minimum
  if (liquidityRatio < SAFEGUARDS.minLiquidityRatio) {
    findings.push({
      id: `liquidity-low-${Date.now()}`,
      type: 'LIQUIDITY_LOW',
      severity: liquidityRatio < 0.05 ? 'high' : 'medium',
      title: 'Low Liquidity Ratio',
      description: `Only ${(liquidityRatio * 100).toFixed(1)}% of your assets are liquid, below the recommended ${(SAFEGUARDS.minLiquidityRatio * 100).toFixed(0)}% minimum.`,
      impactScore: {
        financial: 60,
        risk: 75,
        liquidity: 85,
        tax: 0,
        confidence: 90,
      },
      evidence: {
        liquidityRatio,
        minRecommended: SAFEGUARDS.minLiquidityRatio,
        totalLiquidAssets,
        totalAssets,
        cashBalance,
        liquidInvestmentValue,
      },
      suggestedAction: `Increase liquid assets to at least ${(SAFEGUARDS.minLiquidityRatio * 100).toFixed(0)}% of total portfolio ($${(totalAssets * SAFEGUARDS.minLiquidityRatio).toFixed(0)}).`,
    });
  }

  // Check minimum cash reserve
  if (cashBalance < SAFEGUARDS.minCashReserve) {
    findings.push({
      id: `cash-reserve-low-${Date.now()}`,
      type: 'LIQUIDITY_CASH_LOW',
      severity: cashBalance < 5000 ? 'high' : 'medium',
      title: 'Low Cash Reserve',
      description: `Cash balance ($${cashBalance.toFixed(0)}) is below the recommended minimum of $${SAFEGUARDS.minCashReserve.toFixed(0)}.`,
      impactScore: {
        financial: 70,
        risk: 80,
        liquidity: 90,
        tax: 0,
        confidence: 95,
      },
      evidence: {
        cashBalance,
        minRecommended: SAFEGUARDS.minCashReserve,
        shortfall: SAFEGUARDS.minCashReserve - cashBalance,
      },
      suggestedAction: `Build cash reserve to $${SAFEGUARDS.minCashReserve.toFixed(0)} for emergencies and opportunities.`,
    });
  }

  return findings;
}
