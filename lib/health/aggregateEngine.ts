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
 * Calculate score trend (simplified - would need historical data in production)
 */
export function calculateTrend(currentScore: number): ScoreTrend {
  // In production, this would fetch historical scores from database
  // For now, return a stable trend

  const now = new Date();
  const history: TrendPoint[] = [];

  // Generate placeholder history (last 6 months)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    history.push({
      date,
      score: currentScore + (Math.random() - 0.5) * 5, // Small random variance
    });
  }

  // Calculate direction based on recent trend
  const recentScores = history.slice(-3);
  const avgRecent = recentScores.reduce((sum, p) => sum + p.score, 0) / recentScores.length;
  const olderScores = history.slice(0, 3);
  const avgOlder = olderScores.reduce((sum, p) => sum + p.score, 0) / olderScores.length;

  let direction: ScoreTrend['direction'];
  const change = avgRecent - avgOlder;
  if (change > 2) direction = 'IMPROVING';
  else if (change < -2) direction = 'DECLINING';
  else direction = 'STABLE';

  return {
    direction,
    changePercent: Math.round(change * 10) / 10,
    periodMonths: 6,
    history,
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
  const now = new Date();

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
  const trend = calculateTrend(score);

  return {
    score,
    confidence,
    breakdown: categories,
    trend,
    timestamp: new Date(),
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
    generatedAt: new Date(),
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
