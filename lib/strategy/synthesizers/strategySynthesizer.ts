/**
 * STRATEGY SYNTHESIZER (Layer 3)
 * Phase 11 - Stage 4.1
 *
 * Main orchestrator that:
 * 1. Collects data (Layer 1)
 * 2. Runs all analyzers (Layer 2)
 * 3. Scores and ranks findings (SBS)
 * 4. Applies safeguards
 * 5. Generates evidence graphs
 * 6. Creates reasoning traces
 * 7. Saves to database
 */

import prisma from '@/lib/db';
import {
  collectStrategyData,
  validateDataCompleteness,
  isLimitedMode,
} from '../core/dataCollector';
import {
  calculateSBS,
  scoreAllFindings,
  getSBSRating,
  getPriority,
} from '../core/scoringEngine';
import { validateAgainstSafeguards } from '../core/safeguards';
import type {
  StrategyDataPacket,
  Finding,
  EvidenceGraph,
  ReasoningTrace,
} from '../core/types';

// Import all analyzers
import { analyzeDebt } from '../analyzers/debtAnalyzer';
import { analyzeCashflow } from '../analyzers/cashflowAnalyzer';
import { analyzeInvestments } from '../analyzers/investmentAnalyzer';
import { analyzeProperties } from '../analyzers/propertyAnalyzer';
import { analyzeRisk } from '../analyzers/riskAnalyzer';
import { analyzeLiquidity } from '../analyzers/liquidityAnalyzer';
import { analyzeTax } from '../analyzers/taxAnalyzer';
import { analyzeTimeHorizon } from '../analyzers/timeHorizonAnalyzer';

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateStrategiesOptions {
  userId: string;
  organizationId?: string;
  forceRefresh?: boolean;
  limitedMode?: boolean;
}

export interface StrategyGenerationResult {
  recommendations: any[]; // Will be StrategyRecommendation[] from Prisma
  dataQuality: {
    overallScore: number;
    limitedMode: boolean;
    missingCritical: string[];
  };
  executionTime: number;
  analyzersRun: string[];
  findingsCount: number;
  errors: string[];
}

// =============================================================================
// MAIN STRATEGY GENERATION
// =============================================================================

/**
 * Generate all strategy recommendations for a user
 * This is the main entry point for the Strategy Engine
 */
export async function generateStrategies(
  options: GenerateStrategiesOptions
): Promise<StrategyGenerationResult> {
  const startTime = Date.now();
  const { userId, organizationId, forceRefresh = false } = options;

  const errors: string[] = [];
  const analyzersRun: string[] = [];

  try {
    // STEP 1: Collect data from all sources (Layer 1)
    console.log('[StrategyEngine] Step 1: Collecting data...');
    const data = await collectStrategyData(userId);
    const qualityReport = validateDataCompleteness(data);
    const limitedModeActive = isLimitedMode(qualityReport);

    if (limitedModeActive) {
      console.warn('[StrategyEngine] LIMITED MODE: Data quality below 60%');
      console.warn('[StrategyEngine] Missing:', qualityReport.missingCritical);
    }

    // STEP 2: Run all analyzers (Layer 2)
    console.log('[StrategyEngine] Step 2: Running analyzers...');
    const analyzerResults = await runAllAnalyzers(data);
    analyzersRun.push(...analyzerResults.map((r) => r.analyzer));

    // Collect all errors
    analyzerResults.forEach((result) => {
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
    });

    // STEP 3: Score and rank findings (SBS)
    console.log('[StrategyEngine] Step 3: Scoring findings...');
    const scoredFindings = scoreAllFindings(analyzerResults);

    console.log(
      `[StrategyEngine] Generated ${scoredFindings.length} findings`
    );

    // STEP 4: Apply safeguards
    console.log('[StrategyEngine] Step 4: Applying safeguards...');
    const validatedFindings = scoredFindings.filter((finding) => {
      const validation = validateAgainstSafeguards(finding);
      if (!validation.valid) {
        console.warn(
          `[StrategyEngine] Filtered out: ${finding.title} - Safeguard violations:`,
          validation.violations
        );
        return false;
      }
      return true;
    });

    console.log(
      `[StrategyEngine] ${validatedFindings.length} findings passed safeguards`
    );

    // STEP 5: Filter by confidence if in limited mode
    let finalFindings = validatedFindings;
    if (limitedModeActive) {
      finalFindings = validatedFindings.filter(
        (f) => f.impactScore.confidence >= 80
      ); // Only HIGH confidence in limited mode
      console.log(
        `[StrategyEngine] Limited mode: ${finalFindings.length} high-confidence findings`
      );
    }

    // STEP 6: Expire old recommendations
    console.log('[StrategyEngine] Step 5: Expiring old recommendations...');
    await expireOldRecommendations(userId);

    // STEP 7: Save to database
    console.log('[StrategyEngine] Step 6: Saving recommendations...');
    const savedRecommendations = await saveRecommendations(
      userId,
      organizationId,
      finalFindings,
      data
    );

    console.log(
      `[StrategyEngine] Saved ${savedRecommendations.length} recommendations`
    );

    return {
      recommendations: savedRecommendations,
      dataQuality: {
        overallScore: qualityReport.overallScore,
        limitedMode: limitedModeActive,
        missingCritical: qualityReport.missingCritical,
      },
      executionTime: Date.now() - startTime,
      analyzersRun,
      findingsCount: scoredFindings.length,
      errors,
    };
  } catch (error) {
    console.error('[StrategyEngine] Fatal error:', error);
    errors.push(`Strategy generation failed: ${error}`);

    return {
      recommendations: [],
      dataQuality: {
        overallScore: 0,
        limitedMode: true,
        missingCritical: ['Strategy generation failed'],
      },
      executionTime: Date.now() - startTime,
      analyzersRun,
      findingsCount: 0,
      errors,
    };
  }
}

// =============================================================================
// ANALYZER ORCHESTRATION
// =============================================================================

/**
 * Run all 8 analyzers in parallel
 */
async function runAllAnalyzers(data: StrategyDataPacket) {
  const results = await Promise.all([
    analyzeDebt(data),
    analyzeCashflow(data),
    analyzeInvestments(data),
    analyzeProperties(data),
    analyzeRisk(data),
    analyzeLiquidity(data),
    analyzeTax(data),
    analyzeTimeHorizon(data),
  ]);

  return results;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Expire old recommendations (mark as EXPIRED)
 */
async function expireOldRecommendations(userId: string): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await prisma.strategyRecommendation.updateMany({
    where: {
      userId,
      status: 'PENDING',
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });
}

/**
 * Save recommendations to database
 */
async function saveRecommendations(
  userId: string,
  organizationId: string | undefined,
  findings: Array<Finding & { sbsScore: number }>,
  data: StrategyDataPacket
): Promise<any[]> {
  const recommendations = [];

  for (const finding of findings) {
    try {
      // Map finding to database model
      const recommendation = await prisma.strategyRecommendation.create({
        data: {
          userId,
          organizationId,

          // Classification
          category: mapTypeToCategory(finding.type),
          type: mapSeverityToType(finding.severity),
          severity: finding.severity,

          // Content
          title: finding.title,
          summary: finding.description,
          detail: finding.suggestedAction,

          // Scoring
          sbsScore: finding.sbsScore,
          confidence: mapConfidenceLevel(finding.impactScore.confidence),

          // Impact Analysis
          financialImpact: buildFinancialImpact(finding),
          riskImpact: buildRiskImpact(finding),
          liquidityImpact: buildLiquidityImpact(finding),
          taxImpact: buildTaxImpact(finding),

          // Evidence & Explainability
          reasoning: buildReasoningTrace(finding, data),
          evidenceGraph: buildEvidenceGraph(finding, data),
          alternativeIds: [], // Will be populated by Alternative Generator

          // Affected Entities (from evidence)
          affectedEntities: extractAffectedEntities(finding),

          // Expiry (30 days from now)
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      recommendations.push(recommendation);
    } catch (error) {
      console.error('[StrategyEngine] Failed to save recommendation:', error);
      console.error('[StrategyEngine] Finding:', finding);
    }
  }

  return recommendations;
}

// =============================================================================
// MAPPING FUNCTIONS
// =============================================================================

/**
 * Map finding type to StrategyCategory
 */
function mapTypeToCategory(
  type: string
): 'GROWTH' | 'DEBT' | 'CASHFLOW' | 'INVESTMENT' | 'PROPERTY' | 'RISK_RESILIENCE' {
  if (type.startsWith('DEBT_')) return 'DEBT';
  if (type.startsWith('CASHFLOW_')) return 'CASHFLOW';
  if (type.startsWith('INVESTMENT_')) return 'INVESTMENT';
  if (type.startsWith('PROPERTY_')) return 'PROPERTY';
  if (type.startsWith('RISK_')) return 'RISK_RESILIENCE';
  if (type.startsWith('LIQUIDITY_')) return 'RISK_RESILIENCE';
  if (type.startsWith('TAX_')) return 'GROWTH';
  if (type.startsWith('RETIREMENT_')) return 'GROWTH';
  return 'GROWTH';
}

/**
 * Map severity to StrategyType
 */
function mapSeverityToType(
  severity: string
): 'TACTICAL' | 'OPERATIONAL' | 'STRATEGIC' | 'LONG_TERM' {
  if (severity === 'critical') return 'TACTICAL'; // Immediate action
  if (severity === 'high') return 'OPERATIONAL'; // 3-12 months
  if (severity === 'medium') return 'STRATEGIC'; // 1-5 years
  return 'LONG_TERM'; // 5-30 years
}

/**
 * Map confidence score to ConfidenceLevel
 */
function mapConfidenceLevel(
  confidence: number
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 60) return 'MEDIUM';
  return 'LOW';
}

// =============================================================================
// IMPACT BUILDERS
// =============================================================================

/**
 * Build financial impact object
 */
function buildFinancialImpact(finding: Finding & { sbsScore: number }): any {
  const evidence = finding.evidence as any;

  return {
    sbsScore: finding.sbsScore,
    monthlySavings: evidence?.monthlySavings || evidence?.monthlyImpact || 0,
    totalSavings: evidence?.totalSavings || evidence?.yearlySavings || 0,
    breakEven: evidence?.breakEvenMonths || null,
    timeframe: evidence?.timeframe || 'ongoing',
  };
}

/**
 * Build risk impact object
 */
function buildRiskImpact(finding: Finding): any {
  const evidence = finding.evidence as any;

  return {
    currentRisk: evidence?.currentRisk || finding.impactScore.risk,
    projectedRisk: Math.max(
      0,
      (evidence?.currentRisk || finding.impactScore.risk) -
        finding.impactScore.risk * 0.5
    ),
    factors: evidence?.riskFactors || [],
  };
}

/**
 * Build liquidity impact object
 */
function buildLiquidityImpact(finding: Finding): any {
  const evidence = finding.evidence as any;

  return {
    currentLiquidity: evidence?.currentLiquidity || evidence?.liquidityRatio || 0,
    projectedLiquidity: evidence?.projectedLiquidity || 0,
    impact: finding.impactScore.liquidity,
  };
}

/**
 * Build tax impact object
 */
function buildTaxImpact(finding: Finding): any {
  const evidence = finding.evidence as any;

  return {
    estimatedSaving: evidence?.estimatedTaxSaving || evidence?.taxSavings || 0,
    strategy: evidence?.taxStrategy || finding.type,
  };
}

// =============================================================================
// EVIDENCE & REASONING
// =============================================================================

/**
 * Build evidence graph for traceability
 */
function buildEvidenceGraph(
  finding: Finding,
  data: StrategyDataPacket
): EvidenceGraph {
  const evidence = finding.evidence as any;

  return {
    dataPoints: [
      {
        source: 'snapshot',
        value: data.snapshot,
        timestamp: data.timestamp,
      },
    ],
    historicalTrend: [],
    snapshotValues: evidence || {},
    insightFlags: data.insights.map((i) => i.title),
    healthIssues: data.health?.orphans || [],
    calculations: extractCalculations(evidence),
  };
}

/**
 * Build reasoning trace for explainability
 */
function buildReasoningTrace(
  finding: Finding,
  data: StrategyDataPacket
): string {
  const steps: string[] = [];

  steps.push(`### ${finding.title}`);
  steps.push('');
  steps.push('**Analysis:**');
  steps.push(finding.description);
  steps.push('');
  steps.push('**Recommendation:**');
  steps.push(finding.suggestedAction);
  steps.push('');
  steps.push('**Evidence:**');

  const evidence = finding.evidence as any;
  for (const [key, value] of Object.entries(evidence)) {
    if (typeof value === 'number') {
      steps.push(`  • ${key}: ${value.toFixed(2)}`);
    } else if (typeof value === 'string') {
      steps.push(`  • ${key}: ${value}`);
    }
  }

  steps.push('');
  steps.push('**Impact Score:**');
  steps.push(`  • Financial: ${finding.impactScore.financial}/100`);
  steps.push(`  • Risk: ${finding.impactScore.risk}/100`);
  steps.push(`  • Liquidity: ${finding.impactScore.liquidity}/100`);
  steps.push(`  • Tax: ${finding.impactScore.tax}/100`);
  steps.push(`  • Confidence: ${finding.impactScore.confidence}/100`);

  return steps.join('\n');
}

/**
 * Extract calculations from evidence
 */
function extractCalculations(evidence: any): Record<string, number> {
  const calculations: Record<string, number> = {};

  for (const [key, value] of Object.entries(evidence)) {
    if (typeof value === 'number') {
      calculations[key] = value;
    }
  }

  return calculations;
}

/**
 * Extract affected entities from finding evidence
 */
function extractAffectedEntities(finding: Finding): any {
  const evidence = finding.evidence as any;

  const entities = [];

  if (evidence.loanId) {
    entities.push({
      entityType: 'LOAN',
      entityId: evidence.loanId,
    });
  }

  if (evidence.propertyId) {
    entities.push({
      entityType: 'PROPERTY',
      entityId: evidence.propertyId,
    });
  }

  if (evidence.investmentId) {
    entities.push({
      entityType: 'INVESTMENT',
      entityId: evidence.investmentId,
    });
  }

  return entities;
}
