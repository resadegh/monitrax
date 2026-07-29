/**
 * FINANCIAL HEALTH ENGINE - LAYER 3: AGGREGATE HEALTH ENGINE
 * Phase 12 - Section 5.3
 *
 * Aggregates category scores into the final health score.
 * Applies modifiers and generates the complete Financial Health Report.
 *
 * Formula: HealthScore = Σ(categoryScore * categoryWeight) - penalties
 */

import {
  FinancialHealthInput,
  FinancialHealthScore,
  FinancialHealthReport,
  HealthCategory,
  ScoreModifiers,
  ScoreTrend,
  EvidencePack,
  TrendPoint,
  RiskMapEntry,
  InputSource,
  AggregatedMetrics,
  HealthScoreHistoryPoint,
  scoreToRiskBand,
} from './types';

import { aggregateMetrics, calculateDataConfidence } from './metricAggregation';
import { scoreAllCategories, getConcerningCategories } from './categoryScoring';
import { analyzeAllRisks, generateImprovementActions } from './riskModelling';

// =============================================================================
// SCORE MODIFIER CALCULATION
// =============================================================================

/**
 * Calculate score modifiers based on data quality and system state
 */
export function calculateModifiers(
  input: FinancialHealthInput,
  categories: HealthCategory[]
): ScoreModifiers {
  // Data confidence penalty (max 10 points)
  const dataConfidenceScore = calculateDataConfidence(input);
  const dataConfidencePenalty = Math.max(0, (100 - dataConfidenceScore) * 0.1);

  // Insight severity penalty (max 15 points)
  let insightSeverityPenalty = 0;
  if (input.insights) {
    const criticalInsights = input.insights.filter(i => i.severity === 'critical').length;
    const highInsights = input.insights.filter(i => i.severity === 'high').length;
    insightSeverityPenalty = Math.min(15, criticalInsights * 5 + highInsights * 2);
  }

  // Long-term projection risk penalty (max 5 points)
  // Based on forecast confidence being low
  const longTermCategory = categories.find(c => c.name === 'LONG_TERM_OUTLOOK');
  const longTermProjectionRisk = longTermCategory && longTermCategory.score < 40
    ? 5
    : longTermCategory && longTermCategory.score < 60
    ? 2
    : 0;

  // Linkage issues penalty (max 10 points)
  let linkageIssuesPenalty = 0;
  if (input.linkageHealth) {
    const orphanCount = input.linkageHealth.orphans.length;
    const missingLinkCount = input.linkageHealth.missingLinks.length;
    const consistencyScore = input.linkageHealth.consistencyScore;

    linkageIssuesPenalty = Math.min(10,
      orphanCount * 1 +
      missingLinkCount * 0.5 +
      (100 - consistencyScore) * 0.05
    );
  }

  // Strategy conflicts penalty (max 5 points)
  let strategyConflictsPenalty = 0;
  if (input.strategyData && input.strategyData.conflicts) {
    strategyConflictsPenalty = Math.min(5, input.strategyData.conflicts.length * 2);
  }

  const totalPenalty =
    dataConfidencePenalty +
    insightSeverityPenalty +
    longTermProjectionRisk +
    linkageIssuesPenalty +
    strategyConflictsPenalty;

  return {
    dataConfidence: Math.round(dataConfidencePenalty * 10) / 10,
    insightSeverity: Math.round(insightSeverityPenalty * 10) / 10,
    longTermProjectionRisk: Math.round(longTermProjectionRisk * 10) / 10,
    linkageIssuesPenalty: Math.round(linkageIssuesPenalty * 10) / 10,
    strategyConflictsPenalty: Math.round(strategyConflictsPenalty * 10) / 10,
    totalPenalty: Math.round(totalPenalty * 10) / 10,
  };
}

// =============================================================================
// AGGREGATE SCORE CALCULATION
// =============================================================================

/**
 * Calculate the aggregate health score from category scores
 */
export function calculateAggregateScore(
  categories: HealthCategory[],
  modifiers: ScoreModifiers
): number {
  // Sum of (categoryScore * categoryWeight)
  const rawScore = categories.reduce(
    (sum, category) => sum + category.score * category.weight,
    0
  );

  // Apply penalties
  const adjustedScore = Math.max(0, Math.min(100, rawScore - modifiers.totalPenalty));

  return Math.round(adjustedScore);
}

/**
 * Calculate confidence level based on data quality and metric confidence
 */
export function calculateConfidence(
  input: FinancialHealthInput,
  metrics: AggregatedMetrics
): number {
  // Base confidence from data completeness
  const baseConfidence = calculateDataConfidence(input);

  // Adjust based on metric confidence (average across key metrics)
  const metricConfidences = [
    metrics.liquidity.emergencyBuffer.confidence,
    metrics.cashflow.surplus.confidence,
    metrics.debt.lvr.confidence,
    metrics.property.valuationHealth.confidence,
    metrics.risk.buffering.confidence,
  ];

  const avgMetricConfidence =
    metricConfidences.reduce((sum, c) => sum + c, 0) / metricConfidences.length;

  // Weighted average: 60% base, 40% metrics
  const finalConfidence = baseConfidence * 0.6 + avgMetricConfidence * 0.4;

  return Math.round(finalConfidence);
}

// =============================================================================
// TREND CALCULATION
// =============================================================================

/**
 * MON-134 / D15 — the version of the scoring formula. Bump when the score's
 * inputs/weights change (MON-131 tranches); `HealthScoreSnapshot.formulaVersion`
 * pins each stored row to the formula that produced it, and `calculateTrend`
 * marks a break where consecutive snapshots differ — a trend spanning two
 * formulas must show the break, never smooth over it.
 */
export const HEALTH_FORMULA_VERSION = 1;

/**
 * MON-134 fix: the trend is derived from STORED monthly snapshots of the real
 * score — never generated. The previous implementation invented 7 months of
 * history with random noise and derived the IMPROVING/DECLINING/STABLE
 * verdict + changePercent from the noise (found by the Matrix Relay's first
 * A3 self-diff: 15 leaves moved between two captures of an unchanged DB).
 * Deterministic for a fixed input — no clock, no randomness (brief §4.4).
 *
 * - < 2 snapshots  → INSUFFICIENT_HISTORY, empty history, NO changePercent
 *   (the absent case is representable — never 0, never a 'STABLE' fallback).
 * - ≥ 2 snapshots  → direction + changePercent from the real stored scores:
 *   change = newest.score − oldest.score; > 2 IMPROVING, < −2 DECLINING,
 *   else STABLE (the pre-existing ±2 thresholds, now over real data).
 * - Consecutive snapshots with different formulaVersion → the later snapshot's
 *   ISO date is recorded in `formulaBreaks` (D15: show the break).
 */
export function calculateTrend(history: HealthScoreHistoryPoint[]): ScoreTrend {
  const sorted = [...history].sort(
    (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime(),
  );

  if (sorted.length < 2) {
    return {
      direction: 'INSUFFICIENT_HISTORY',
      periodMonths: 0,
      history: [],
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const change = last.score - first.score;

  let direction: ScoreTrend['direction'];
  if (change > 2) direction = 'IMPROVING';
  else if (change < -2) direction = 'DECLINING';
  else direction = 'STABLE';

  const firstDate = new Date(first.snapshotDate);
  const lastDate = new Date(last.snapshotDate);
  const periodMonths =
    (lastDate.getUTCFullYear() - firstDate.getUTCFullYear()) * 12 +
    (lastDate.getUTCMonth() - firstDate.getUTCMonth());

  const formulaBreaks: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].formulaVersion !== sorted[i - 1].formulaVersion) {
      formulaBreaks.push(new Date(sorted[i].snapshotDate).toISOString());
    }
  }

  return {
    direction,
    changePercent: Math.round(change * 10) / 10,
    periodMonths,
    history: sorted.map((p) => ({ date: new Date(p.snapshotDate), score: p.score })),
    ...(formulaBreaks.length ? { formulaBreaks } : {}),
  };
}

// =============================================================================
// EVIDENCE PACK GENERATION
// =============================================================================

/**
 * Generate evidence pack for transparency
 */
export function generateEvidencePack(
  input: FinancialHealthInput,
  categories: HealthCategory[],
  trend: ScoreTrend
): EvidencePack {
  // MON-134 §4.4 determinism: injectable clock.
  const now = input.asOf ?? new Date();

  // Input sources used
  const inputsUsed: InputSource[] = [
    {
      type: 'SNAPSHOT',
      value: {
        netWorth: input.portfolioSnapshot.netWorth,
        totalAssets: input.portfolioSnapshot.totalAssets,
        totalLiabilities: input.portfolioSnapshot.totalLiabilities,
      },
      timestamp: now,
    },
  ];

  if (input.insights && input.insights.length > 0) {
    inputsUsed.push({
      type: 'INSIGHT',
      value: { count: input.insights.length },
      timestamp: now,
    });
  }

  if (input.strategyData) {
    inputsUsed.push({
      type: 'STRATEGY',
      value: {
        recommendationCount: input.strategyData.recommendations?.length || 0,
      },
      timestamp: now,
    });
  }

  if (input.linkageHealth) {
    inputsUsed.push({
      type: 'GRDCS',
      value: {
        consistencyScore: input.linkageHealth.consistencyScore,
        orphans: input.linkageHealth.orphans.length,
      },
      timestamp: now,
    });
  }

  if (input.userGoals) {
    inputsUsed.push({
      type: 'USER_GOAL',
      value: input.userGoals,
      timestamp: now,
    });
  }

  // Insights linked
  const insightsLinked = input.insights?.map(i => i.id) || [];

  // Risk map from categories
  const concerningCategories = getConcerningCategories(categories, 50);
  const riskMap: RiskMapEntry[] = concerningCategories.map(c => ({
    category: mapCategoryToRiskCategory(c.name),
    level: c.score < 20 ? 'CRITICAL' : c.score < 40 ? 'HIGH' : 'MEDIUM',
    factors: c.contributingMetrics
      .filter(m => m.score < 50)
      .map(m => m.name),
  }));

  return {
    inputsUsed,
    confidenceLevel: calculateDataConfidence(input),
    insightsLinked,
    historicalTrend: trend.history,
    riskMap,
    lastUpdated: now,
  };
}

/**
 * Map health category to risk signal category
 */
function mapCategoryToRiskCategory(
  categoryName: string
): 'SPENDING' | 'BORROWING' | 'LIQUIDITY' | 'CONCENTRATION' | 'MARKET' | 'LONGEVITY' {
  switch (categoryName) {
    case 'LIQUIDITY':
      return 'LIQUIDITY';
    case 'CASHFLOW':
      return 'SPENDING';
    case 'DEBT':
      return 'BORROWING';
    case 'INVESTMENTS':
      return 'CONCENTRATION';
    case 'PROPERTY':
      return 'MARKET';
    case 'RISK_EXPOSURE':
      return 'MARKET';
    case 'LONG_TERM_OUTLOOK':
      return 'LONGEVITY';
    default:
      return 'SPENDING';
  }
}

// =============================================================================
// MAIN ENGINE FUNCTION
// =============================================================================

/**
 * Generate the Financial Health Score.
 * This is the primary output interface for the health score.
 */
export function generateHealthScore(
  input: FinancialHealthInput,
  categories: HealthCategory[],
  modifiers: ScoreModifiers,
  metrics: AggregatedMetrics
): FinancialHealthScore {
  const score = calculateAggregateScore(categories, modifiers);
  const confidence = calculateConfidence(input, metrics);
  // MON-134: the trend reads STORED monthly snapshots only (never the live
  // score, never generated history). Absent/empty → INSUFFICIENT_HISTORY.
  const trend = calculateTrend(input.healthScoreHistory ?? []);

  return {
    score,
    confidence,
    breakdown: categories,
    trend,
    // MON-134 §4.4 determinism: injectable clock — byte-identical output for
    // identical input when `asOf` is supplied.
    timestamp: input.asOf ?? new Date(),
  };
}

/**
 * Generate the complete Financial Health Report.
 * This is the main entry point for the Financial Health Engine.
 */
export function generateHealthReport(input: FinancialHealthInput): FinancialHealthReport {
  // Layer 1: Aggregate metrics
  const metrics = aggregateMetrics(input);

  // Layer 2: Score categories
  const categories = scoreAllCategories(metrics);

  // Layer 3: Calculate modifiers and aggregate
  const modifiers = calculateModifiers(input, categories);
  const healthScore = generateHealthScore(input, categories, modifiers, metrics);
  const evidence = generateEvidencePack(input, categories, healthScore.trend);

  // Risk analysis and improvement actions
  const riskSignals = analyzeAllRisks(metrics, input);
  const improvementActions = generateImprovementActions(riskSignals, categories);

  return {
    healthScore,
    categories,
    riskSignals,
    improvementActions,
    evidence,
    metrics,
    modifiers,
    generatedAt: input.asOf ?? new Date(),
    userId: input.userId,
  };
}

/**
 * Quick health check - returns just the score without full report
 */
export function quickHealthCheck(input: FinancialHealthInput): {
  score: number;
  riskBand: string;
  confidence: number;
} {
  const metrics = aggregateMetrics(input);
  const categories = scoreAllCategories(metrics);
  const modifiers = calculateModifiers(input, categories);
  const score = calculateAggregateScore(categories, modifiers);
  const confidence = calculateConfidence(input, metrics);

  return {
    score,
    riskBand: scoreToRiskBand(score),
    confidence,
  };
}
