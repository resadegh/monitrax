/**
 * RISK ANALYZER
 * Phase 11 - Stage 3B.3
 *
 * Analyzes portfolio risk:
 * - Overall risk concentration
 * - Asset correlation
 * - Risk-adjusted returns
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';
import { SAFEGUARDS } from '../core/safeguards';

export async function analyzeRisk(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    // Calculate overall portfolio risk
    const riskFindings = calculatePortfolioRisk(data);
    findings.push(...riskFindings);

    // Check geographic concentration
    const geoFindings = analyzeGeographicRisk(data);
    findings.push(...geoFindings);

  } catch (error) {
    errors.push(`Risk analysis error: ${error}`);
  }

  return {
    analyzer: 'RiskAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function calculatePortfolioRisk(data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  // Calculate risk score based on asset mix
  const properties = data.snapshot?.properties || [];
  const investments = data.snapshot?.investments || [];
  const loans = data.snapshot?.loans || [];

  const propertyValue = properties.reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0);
  const investmentValue = investments.reduce((sum: number, i: any) => sum + (i.currentValue || 0), 0);
  const totalDebt = loans.reduce((sum: number, l: any) => sum + (l.balance || 0), 0);
  const totalAssets = propertyValue + investmentValue;

  const leverageRatio = totalAssets > 0 ? totalDebt / totalAssets : 0;

  if (leverageRatio > SAFEGUARDS.maxLeverageRatio) {
    findings.push({
      id: `risk-high-leverage-${Date.now()}`,
      type: 'RISK_HIGH_LEVERAGE',
      severity: 'high',
      title: 'High Leverage Risk',
      description: `Your leverage ratio (${(leverageRatio * 100).toFixed(1)}%) exceeds the recommended maximum of ${(SAFEGUARDS.maxLeverageRatio * 100).toFixed(0)}%, increasing financial risk.`,
      impactScore: {
        financial: 70,
        risk: 90,
        liquidity: 75,
        tax: 0,
        confidence: 90,
      },
      evidence: {
        leverageRatio,
        maxRecommended: SAFEGUARDS.maxLeverageRatio,
        totalAssets,
        totalDebt,
      },
      suggestedAction: `Reduce debt or increase assets to bring leverage below ${(SAFEGUARDS.maxLeverageRatio * 100).toFixed(0)}%.`,
    });
  }

  return findings;
}

function analyzeGeographicRisk(data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  const properties = data.snapshot?.properties || [];

  if (properties.length >= 2) {
    // Check if all properties in same location
    const locations = new Set(properties.map((p: any) => p.state || p.suburb));

    if (locations.size === 1) {
      findings.push({
        id: `risk-geographic-${Date.now()}`,
        type: 'RISK_GEOGRAPHIC',
        severity: 'medium',
        title: 'Geographic Concentration Risk',
        description: `All ${properties.length} properties are in the same location, creating geographic concentration risk.`,
        impactScore: {
          financial: 55,
          risk: 70,
          liquidity: 40,
          tax: 0,
          confidence: 85,
        },
        evidence: {
          propertyCount: properties.length,
          locations: Array.from(locations),
        },
        suggestedAction: 'Consider diversifying property holdings across different geographic areas.',
      });
    }
  }

  return findings;
}
