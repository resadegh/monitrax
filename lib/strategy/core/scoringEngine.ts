/**
 * STRATEGIC BENEFIT SCORE (SBS) ENGINE
 * Phase 11 - Stage 3C
 *
 * Calculates and ranks recommendations using weighted scoring:
 * SBS = (FinancialBenefit × 0.40) +
 *       (RiskReduction × 0.25) +
 *       (CostAvoidance × 0.15) +
 *       (LiquidityImpact × 0.10) +
 *       (TaxImpact × 0.05) +
 *       (DataConfidence × 0.05)
 */

import type { Finding, ImpactScore } from './types';

// =============================================================================
// SCORING WEIGHTS
// =============================================================================

const SBS_WEIGHTS = {
  financial: 0.40,
  risk: 0.25,
  costAvoidance: 0.15,
  liquidity: 0.10,
  tax: 0.05,
  confidence: 0.05,
} as const;

// =============================================================================
// SCORE COMPONENTS
// =============================================================================

export interface ScoreComponents {
  financialBenefit: number;    // 0-100
  riskReduction: number;       // 0-100
  costAvoidance: number;       // 0-100
  liquidityImpact: number;     // 0-100 (negative if reduces liquidity)
  taxImpact: number;           // 0-100 (benefit score)
  dataConfidence: number;      // 0-100
}

// =============================================================================
// MAIN SBS CALCULATION
// =============================================================================

/**
 * Calculate Strategic Benefit Score (SBS) for a finding
 */
export function calculateSBS(
  finding: Finding,
  components?: ScoreComponents
): number {
  // Use provided components or extract from finding's impactScore
  const scoreComponents = components || extractComponentsFromFinding(finding);

  // Calculate weighted score
  const sbs =
    scoreComponents.financialBenefit * SBS_WEIGHTS.financial +
    scoreComponents.riskReduction * SBS_WEIGHTS.risk +
    scoreComponents.costAvoidance * SBS_WEIGHTS.costAvoidance +
    scoreComponents.liquidityImpact * SBS_WEIGHTS.liquidity +
    scoreComponents.taxImpact * SBS_WEIGHTS.tax +
    scoreComponents.dataConfidence * SBS_WEIGHTS.confidence;

  // Ensure result is 0-100
  return Math.max(0, Math.min(100, sbs));
}

/**
 * Extract score components from a Finding's impactScore
 */
function extractComponentsFromFinding(finding: Finding): ScoreComponents {
  const impact = finding.impactScore;

  return {
    financialBenefit: impact.financial || 0,
    riskReduction: impact.risk || 0,
    costAvoidance: calculateCostAvoidance(finding),
    liquidityImpact: impact.liquidity || 0,
    taxImpact: impact.tax || 0,
    dataConfidence: impact.confidence || 70, // Default to moderate
  };
}

/**
 * Calculate cost avoidance component
 * This is derived from the finding type and evidence
 */
function calculateCostAvoidance(finding: Finding): number {
  // Extract cost avoidance from evidence if available
  const evidence = finding.evidence as any;

  // Refinancing saves interest costs
  if (finding.type === 'DEBT_REFINANCE' && evidence?.totalSavings) {
    return Math.min(100, (evidence.totalSavings / 10000) * 50); // $10k savings = 50 points
  }

  // Debt consolidation saves interest
  if (finding.type === 'DEBT_CONSOLIDATE' && evidence?.monthlySavings) {
    return Math.min(100, (evidence.monthlySavings * 12 / 5000) * 50); // $5k annual = 50 points
  }

  // Tax strategies save tax
  if (finding.type.startsWith('TAX_') && evidence?.estimatedTaxSaving) {
    return Math.min(100, (evidence.estimatedTaxSaving / 5000) * 60);
  }

  // Emergency fund prevents costly emergency borrowing
  if (finding.type === 'CASHFLOW_EMERGENCY_LOW') {
    return 70; // High cost avoidance from preventing emergency debt
  }

  // Default based on severity
  const severityScores = {
    critical: 80,
    high: 60,
    medium: 40,
    low: 20,
  };

  return severityScores[finding.severity] || 30;
}

// =============================================================================
// RANKING FUNCTIONS
// =============================================================================

/**
 * Rank recommendations by SBS score (highest first)
 */
export function rankRecommendations<T extends { sbsScore?: number }>(
  recommendations: T[]
): T[] {
  return [...recommendations].sort((a, b) => {
    const scoreA = a.sbsScore || 0;
    const scoreB = b.sbsScore || 0;
    return scoreB - scoreA; // Descending order
  });
}

/**
 * Calculate SBS for multiple findings and return sorted
 */
export function scoreAndRankFindings(findings: Finding[]): Array<Finding & { sbsScore: number }> {
  const scored = findings.map((finding) => ({
    ...finding,
    sbsScore: calculateSBS(finding),
  }));

  return rankRecommendations(scored);
}

// =============================================================================
// EXPLAINABILITY
// =============================================================================

/**
 * Generate human-readable explanation of SBS score
 */
export function explainScore(
  sbs: number,
  components: ScoreComponents
): string {
  const parts: string[] = [];

  parts.push(`Strategic Benefit Score: ${sbs.toFixed(1)}/100`);
  parts.push('');
  parts.push('Breakdown:');
  parts.push(
    `  • Financial Benefit: ${components.financialBenefit.toFixed(1)} × ${(SBS_WEIGHTS.financial * 100).toFixed(0)}% = ${(components.financialBenefit * SBS_WEIGHTS.financial).toFixed(1)}`
  );
  parts.push(
    `  • Risk Reduction: ${components.riskReduction.toFixed(1)} × ${(SBS_WEIGHTS.risk * 100).toFixed(0)}% = ${(components.riskReduction * SBS_WEIGHTS.risk).toFixed(1)}`
  );
  parts.push(
    `  • Cost Avoidance: ${components.costAvoidance.toFixed(1)} × ${(SBS_WEIGHTS.costAvoidance * 100).toFixed(0)}% = ${(components.costAvoidance * SBS_WEIGHTS.costAvoidance).toFixed(1)}`
  );
  parts.push(
    `  • Liquidity Impact: ${components.liquidityImpact.toFixed(1)} × ${(SBS_WEIGHTS.liquidity * 100).toFixed(0)}% = ${(components.liquidityImpact * SBS_WEIGHTS.liquidity).toFixed(1)}`
  );
  parts.push(
    `  • Tax Benefit: ${components.taxImpact.toFixed(1)} × ${(SBS_WEIGHTS.tax * 100).toFixed(0)}% = ${(components.taxImpact * SBS_WEIGHTS.tax).toFixed(1)}`
  );
  parts.push(
    `  • Data Confidence: ${components.dataConfidence.toFixed(1)} × ${(SBS_WEIGHTS.confidence * 100).toFixed(0)}% = ${(components.dataConfidence * SBS_WEIGHTS.confidence).toFixed(1)}`
  );

  return parts.join('\n');
}

/**
 * Get categorical rating for SBS score
 */
export function getSBSRating(sbs: number): string {
  if (sbs >= 80) return 'Excellent';
  if (sbs >= 65) return 'High';
  if (sbs >= 50) return 'Moderate';
  if (sbs >= 35) return 'Low';
  return 'Minimal';
}

/**
 * Get priority level based on SBS
 */
export function getPriority(sbs: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (sbs >= 75) return 'CRITICAL';
  if (sbs >= 60) return 'HIGH';
  if (sbs >= 40) return 'MEDIUM';
  return 'LOW';
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Calculate SBS for all findings from all analyzers
 */
export function scoreAllFindings(
  analyzerResults: Array<{ findings: Finding[] }>
): Array<Finding & { sbsScore: number }> {
  // Flatten all findings
  const allFindings = analyzerResults.flatMap((result) => result.findings);

  // Score and rank
  return scoreAndRankFindings(allFindings);
}
