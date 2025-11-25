/**
 * PROPERTY ANALYZER
 * Phase 11 - Stage 3B.2
 *
 * Analyzes property holdings:
 * - Hold vs sell recommendations
 * - Rental yield assessment
 * - Property refinancing opportunities
 * - Capital growth analysis
 */

import type {
  StrategyDataPacket,
  Finding,
  AnalysisResult,
} from '../core/types';

export async function analyzeProperties(
  data: StrategyDataPacket
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];
  const errors: string[] = [];

  try {
    if (!data.snapshot?.properties || data.snapshot.properties.length === 0) {
      return {
        analyzer: 'PropertyAnalyzer',
        findings: [],
        executionTime: Date.now() - startTime,
        errors: ['No property data available'],
      };
    }

    const properties = data.snapshot.properties;

    for (const property of properties) {
      // Analyze rental yield
      if (property.isInvestment && property.rentalIncome) {
        const yieldFindings = analyzeRentalYield(property);
        findings.push(...yieldFindings);
      }

      // Analyze hold vs sell
      const holdSellFindings = analyzeHoldVsSell(property, data);
      findings.push(...holdSellFindings);
    }

  } catch (error) {
    errors.push(`Property analysis error: ${error}`);
  }

  return {
    analyzer: 'PropertyAnalyzer',
    findings,
    executionTime: Date.now() - startTime,
    errors,
  };
}

function analyzeRentalYield(property: any): Finding[] {
  const findings: Finding[] = [];
  const annualRent = (property.rentalIncome || 0) * 12;
  const propertyValue = property.currentValue || property.purchasePrice || 0;
  const yield_percent = propertyValue > 0 ? annualRent / propertyValue : 0;

  if (yield_percent < 0.03 && propertyValue > 0) {
    // Less than 3% yield
    findings.push({
      id: `property-low-yield-${property.id}`,
      type: 'PROPERTY_LOW_YIELD',
      severity: 'medium',
      title: `Low Rental Yield: ${property.address || 'Property'}`,
      description: `This property has a rental yield of only ${(yield_percent * 100).toFixed(2)}%, below the typical 3-4% benchmark.`,
      impactScore: {
        financial: 60,
        risk: 55,
        liquidity: 40,
        tax: 10,
        confidence: 85,
      },
      evidence: {
        propertyId: property.id,
        address: property.address,
        currentValue: propertyValue,
        annualRent,
        rentalYield: yield_percent,
        monthlyRent: property.rentalIncome,
      },
      suggestedAction: `Consider: (1) Increasing rent, (2) Selling and redeploying capital, or (3) Capital growth strategy if yield is temporary.`,
    });
  }

  return findings;
}

function analyzeHoldVsSell(property: any, data: StrategyDataPacket): Finding[] {
  const findings: Finding[] = [];

  const purchasePrice = property.purchasePrice || 0;
  const currentValue = property.currentValue || purchasePrice;
  const capitalGrowth = currentValue - purchasePrice;
  const growthPercent = purchasePrice > 0 ? capitalGrowth / purchasePrice : 0;

  // Check if property has negative or very low growth
  if (growthPercent < 0.02 && property.yearsHeld >= 5) {
    // Less than 2% growth after 5+ years
    findings.push({
      id: `property-low-growth-${property.id}`,
      type: 'PROPERTY_LOW_GROWTH',
      severity: 'medium',
      title: `Low Capital Growth: ${property.address || 'Property'}`,
      description: `After ${property.yearsHeld || 5} years, this property has grown only ${(growthPercent * 100).toFixed(1)}%, underperforming typical market returns.`,
      impactScore: {
        financial: 65,
        risk: 50,
        liquidity: 60,
        tax: -15, // Selling may trigger CGT
        confidence: 75,
      },
      evidence: {
        propertyId: property.id,
        address: property.address,
        purchasePrice,
        currentValue,
        capitalGrowth,
        growthPercent,
        yearsHeld: property.yearsHeld || 5,
      },
      suggestedAction: `Evaluate selling and redeploying capital to higher-performing assets. Consider tax implications and transaction costs.`,
    });
  }

  return findings;
}
