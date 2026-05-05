/**
 * TAX ANALYZER
 * Phase 11 - Stage 3B.5
 *
 * Analyzes tax optimization opportunities:
 * - Tax loss harvesting
 * - Capital gains tax planning
 * - Negative gearing benefits
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';
import {
  getCurrentTaxYearConfig,
  getMarginalRate,
} from '@/lib/tax-engine/config/taxYearConfig';

export async function analyzeTax(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    // Tax loss harvesting
    const lossHarvestFindings = analyzeTaxLossHarvesting(data);
    findings.push(...lossHarvestFindings);

    // Capital gains tax planning — pass the user's actual marginal rate
    // derived from cashflow data so high-bracket users see correct savings
    // (resolves H-5 in PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md §3 / §10.1).
    const config = getCurrentTaxYearConfig();
    const inferredAnnualIncome =
      (data.snapshot?.cashflowSummary as { totalAnnualIncome?: number } | undefined)
        ?.totalAnnualIncome ?? 0;
    const marginalRate =
      inferredAnnualIncome > 0
        ? getMarginalRate(inferredAnnualIncome, config)
        : 0.30; // documented fallback when income unknown
    const cgtFindings = analyzeCapitalGainsTax(data, marginalRate, config.cgtDiscount);
    findings.push(...cgtFindings);

  } catch (error) {
    errors.push(`Tax analysis error: ${error}`);
  }

  return {
    analyzer: 'TaxAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function analyzeTaxLossHarvesting(data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  const investments = data.snapshot?.investments || [];
  const lossInvestments = investments.filter((i: any) => {
    const purchasePrice = i.purchasePrice || 0;
    const currentValue = i.currentValue || 0;
    return currentValue < purchasePrice;
  });

  if (lossInvestments.length > 0) {
    const totalLoss = lossInvestments.reduce((sum: number, i: any) => {
      return sum + ((i.purchasePrice || 0) - (i.currentValue || 0));
    }, 0);

    if (totalLoss > 1000) {
      findings.push({
        id: `tax-loss-harvest-${Date.now()}`,
        type: 'TAX_LOSS_HARVEST',
        severity: 'low',
        title: 'Tax Loss Harvesting Opportunity',
        description: `You have unrealized losses of $${totalLoss.toFixed(0)} across ${lossInvestments.length} investments that could be harvested to offset capital gains.`,
        impactScore: {
          financial: 40,
          risk: 20,
          liquidity: 10,
          tax: 70,
          confidence: 75,
        },
        evidence: {
          lossInvestmentCount: lossInvestments.length,
          totalUnrealizedLoss: totalLoss,
          investments: lossInvestments.map((i: any) => ({
            id: i.id,
            name: i.name,
            loss: (i.purchasePrice || 0) - (i.currentValue || 0),
          })),
        },
        suggestedAction: 'Consider tax loss harvesting before end of financial year to offset capital gains. Consult tax advisor.',
      });
    }
  }

  return findings;
}

function analyzeCapitalGainsTax(
  data: StrategyDataPacket,
  marginalRate: number,
  cgtDiscountRate: number,
): Finding[] {
  const findings: Finding[] = [];

  const properties = data.snapshot?.properties || [];
  const investments = data.snapshot?.investments || [];

  // Find assets with significant unrealized gains held < 12 months
  const shortTermGains = [...properties, ...investments].filter((asset: any) => {
    const purchasePrice = asset.purchasePrice || 0;
    const currentValue = asset.currentValue || 0;
    const gain = currentValue - purchasePrice;
    const monthsHeld = asset.monthsHeld || 0;

    return gain > 10000 && monthsHeld >= 10 && monthsHeld < 12;
  });

  const discountPercent = Math.round(cgtDiscountRate * 100);

  for (const asset of shortTermGains) {
    const monthsUntil12 = 12 - (asset.monthsHeld || 0);
    const unrealizedGain = (asset.currentValue || 0) - (asset.purchasePrice || 0);
    const estimatedTaxSaving = unrealizedGain * cgtDiscountRate * marginalRate;

    findings.push({
      id: `cgt-discount-${asset.id}`,
      type: 'TAX_CGT_DISCOUNT',
      severity: 'low',
      title: `CGT Discount Opportunity: ${asset.name || asset.address || 'Asset'}`,
      description: `Hold for ${monthsUntil12} more months to qualify for ${discountPercent}% CGT discount on $${unrealizedGain.toFixed(0)} gain.`,
      impactScore: {
        financial: 35,
        risk: 10,
        liquidity: -10,
        tax: 60,
        confidence: 80,
      },
      evidence: {
        assetId: asset.id,
        assetType: asset.type || 'property',
        monthsHeld: asset.monthsHeld || 0,
        monthsUntilDiscount: monthsUntil12,
        unrealizedGain,
        estimatedTaxSaving,
        appliedMarginalRate: marginalRate,
      },
      suggestedAction: `Defer sale ${monthsUntil12} months to qualify for CGT discount and save approximately $${estimatedTaxSaving.toFixed(0)} in tax.`,
    });
  }

  return findings;
}
