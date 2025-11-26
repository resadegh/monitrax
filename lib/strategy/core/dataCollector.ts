/**
 * DATA COLLECTION LAYER (Layer 1)
 * Phase 11 - Stage 2
 *
 * Collects and validates data from all system sources:
 * 1. Portfolio Snapshot (Phase 5)
 * 2. Insights Engine (Phase 4)
 * 3. Global Health (Phase 9)
 * 4. GRDCS (Phase 8)
 * 5. User Preferences (StrategySession)
 */

import { prisma } from '@/lib/prisma';
import type {
  StrategyDataPacket,
  SnapshotData,
  Insight,
  HealthMetrics,
  RelationalGraph,
  UserPreferences,
  DataQualityReport,
} from './types';

// =============================================================================
// MAIN DATA COLLECTION
// =============================================================================

/**
 * Collect all data required for strategy generation
 */
export async function collectStrategyData(
  userId: string
): Promise<StrategyDataPacket> {
  const timestamp = new Date();

  // Fetch all data sources in parallel for performance
  const [snapshot, insights, health, relationships, preferences] =
    await Promise.all([
      fetchSnapshotData(userId),
      fetchInsights(userId),
      fetchGlobalHealth(userId),
      fetchGRDCSData(userId),
      fetchUserPreferences(userId),
    ]);

  return {
    userId,
    snapshot,
    insights,
    health,
    relationships,
    preferences,
    timestamp,
  };
}

// =============================================================================
// DATA SOURCE FETCHERS
// =============================================================================

/**
 * Fetch portfolio snapshot from Phase 5 Portfolio Engine
 */
async function fetchSnapshotData(
  userId: string
): Promise<SnapshotData | null> {
  try {
    // Import dynamically to avoid circular dependencies
    const { generatePortfolioSnapshot } = await import(
      '@/lib/intelligence/portfolioEngine'
    );

    const snapshot = await generatePortfolioSnapshot(userId);

    if (!snapshot) {
      return null;
    }

    return {
      netWorth: snapshot.summary.totalNetWorth,
      properties: snapshot.properties || [],
      loans: snapshot.loans || [],
      investments: snapshot.investments || [],
      cashflowSummary: snapshot.cashflow || {},
      historicalTrends: snapshot.trends || {},
    };
  } catch (error) {
    console.error('[DataCollector] Failed to fetch snapshot:', error);
    return null;
  }
}

/**
 * Fetch insights from Phase 4 Insights Engine
 */
async function fetchInsights(userId: string): Promise<Insight[]> {
  try {
    // Import dynamically to avoid circular dependencies
    const { generateInsights } = await import(
      '@/lib/intelligence/insightsEngine'
    );

    const insights = await generateInsights(userId);

    return (
      insights?.map((insight) => ({
        id: insight.id,
        severity: insight.severity as 'critical' | 'high' | 'medium' | 'low',
        category: insight.category,
        title: insight.title,
        description: insight.description,
      })) || []
    );
  } catch (error) {
    console.error('[DataCollector] Failed to fetch insights:', error);
    return [];
  }
}

/**
 * Fetch global health metrics from Phase 9
 */
async function fetchGlobalHealth(
  userId: string
): Promise<HealthMetrics | null> {
  try {
    const healthData = await prisma.globalHealthReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        orphans: true,
        missingLinks: true,
        consistencyScore: true,
        moduleHealth: true,
      },
    });

    if (!healthData) {
      return null;
    }

    return {
      orphans: Array.isArray(healthData.orphans)
        ? (healthData.orphans as string[])
        : [],
      missingLinks: Array.isArray(healthData.missingLinks)
        ? (healthData.missingLinks as string[])
        : [],
      consistencyScore: healthData.consistencyScore,
      moduleHealth: (healthData.moduleHealth as Record<string, number>) || {},
    };
  } catch (error) {
    console.error('[DataCollector] Failed to fetch health metrics:', error);
    return null;
  }
}

/**
 * Fetch relational graph from Phase 8 GRDCS
 */
async function fetchGRDCSData(
  userId: string
): Promise<RelationalGraph | null> {
  try {
    // Import dynamically to avoid circular dependencies
    const { getRelationalGraph } = await import('@/lib/grdcs');

    const graph = await getRelationalGraph(userId);

    if (!graph) {
      return null;
    }

    return {
      entities: graph.entities || [],
      relationships: graph.relationships || [],
    };
  } catch (error) {
    console.error('[DataCollector] Failed to fetch GRDCS data:', error);
    return null;
  }
}

/**
 * Fetch user preferences from StrategySession
 */
async function fetchUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  try {
    const session = await prisma.strategySession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        riskAppetite: true,
        timeHorizon: true,
        debtComfort: true,
        investmentStyle: true,
        retirementAge: true,
      },
    });

    if (!session) {
      return null;
    }

    return {
      riskAppetite: session.riskAppetite as UserPreferences['riskAppetite'],
      timeHorizon: session.timeHorizon || undefined,
      debtComfort: session.debtComfort as UserPreferences['debtComfort'],
      investmentStyle:
        session.investmentStyle as UserPreferences['investmentStyle'],
      retirementAge: session.retirementAge || undefined,
    };
  } catch (error) {
    console.error('[DataCollector] Failed to fetch user preferences:', error);
    return null;
  }
}

// =============================================================================
// DATA QUALITY VALIDATION
// =============================================================================

/**
 * Validate data completeness and calculate quality scores
 */
export function validateDataCompleteness(
  data: StrategyDataPacket
): DataQualityReport {
  const completeness = {
    snapshot: calculateSnapshotCompleteness(data.snapshot),
    insights: calculateInsightsCompleteness(data.insights),
    health: calculateHealthCompleteness(data.health),
    relationships: calculateRelationshipsCompleteness(data.relationships),
    preferences: calculatePreferencesCompleteness(data.preferences),
  };

  // Overall score is weighted average
  const overallScore = Math.round(
    completeness.snapshot * 0.35 + // Snapshot is most critical
      completeness.insights * 0.20 +
      completeness.health * 0.15 +
      completeness.relationships * 0.15 +
      completeness.preferences * 0.15
  );

  // Determine data age
  const dataAge = calculateDataAge(data);

  // Find critical missing data
  const missingCritical = findMissingCriticalData(data);

  // Generate recommendations for improvement
  const recommendations = generateDataRecommendations(
    completeness,
    missingCritical
  );

  return {
    overallScore,
    completeness,
    dataAge,
    missingCritical,
    recommendations,
  };
}

/**
 * Calculate snapshot completeness (0-100)
 */
function calculateSnapshotCompleteness(snapshot: SnapshotData | null): number {
  if (!snapshot) return 0;

  let score = 0;
  let maxScore = 0;

  // Net worth (critical)
  maxScore += 30;
  if (snapshot.netWorth !== undefined && snapshot.netWorth !== null) {
    score += 30;
  }

  // Properties
  maxScore += 20;
  if (snapshot.properties && snapshot.properties.length > 0) {
    score += 20;
  }

  // Loans
  maxScore += 20;
  if (snapshot.loans && snapshot.loans.length > 0) {
    score += 20;
  }

  // Cashflow summary
  maxScore += 15;
  if (snapshot.cashflowSummary && Object.keys(snapshot.cashflowSummary).length > 0) {
    score += 15;
  }

  // Historical trends
  maxScore += 15;
  if (snapshot.historicalTrends && Object.keys(snapshot.historicalTrends).length > 0) {
    score += 15;
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Calculate insights completeness (0-100)
 */
function calculateInsightsCompleteness(insights: Insight[]): number {
  if (!insights || insights.length === 0) return 0;

  // Having any insights is good
  // Having insights across multiple categories is better
  const categories = new Set(insights.map((i) => i.category));

  if (insights.length >= 5 && categories.size >= 3) return 100;
  if (insights.length >= 3 && categories.size >= 2) return 75;
  if (insights.length >= 1) return 50;

  return 0;
}

/**
 * Calculate health completeness (0-100)
 */
function calculateHealthCompleteness(health: HealthMetrics | null): number {
  if (!health) return 0;

  let score = 0;

  // Consistency score exists
  if (health.consistencyScore !== undefined && health.consistencyScore !== null) {
    score += 40;
  }

  // Module health exists
  if (health.moduleHealth && Object.keys(health.moduleHealth).length > 0) {
    score += 30;
  }

  // Orphans checked
  if (health.orphans !== undefined) {
    score += 15;
  }

  // Missing links checked
  if (health.missingLinks !== undefined) {
    score += 15;
  }

  return score;
}

/**
 * Calculate relationships completeness (0-100)
 */
function calculateRelationshipsCompleteness(
  relationships: RelationalGraph | null
): number {
  if (!relationships) return 0;

  let score = 0;

  // Has entities
  if (relationships.entities && relationships.entities.length > 0) {
    score += 50;
  }

  // Has relationships
  if (
    relationships.relationships &&
    relationships.relationships.length > 0
  ) {
    score += 50;
  }

  return score;
}

/**
 * Calculate preferences completeness (0-100)
 */
function calculatePreferencesCompleteness(
  preferences: UserPreferences | null
): number {
  if (!preferences) return 0;

  let score = 0;
  let maxScore = 0;

  // Risk appetite (critical)
  maxScore += 30;
  if (preferences.riskAppetite) score += 30;

  // Time horizon
  maxScore += 20;
  if (preferences.timeHorizon) score += 20;

  // Debt comfort
  maxScore += 20;
  if (preferences.debtComfort) score += 20;

  // Investment style
  maxScore += 15;
  if (preferences.investmentStyle) score += 15;

  // Retirement age
  maxScore += 15;
  if (preferences.retirementAge) score += 15;

  return Math.round((score / maxScore) * 100);
}

/**
 * Calculate data age metrics
 */
function calculateDataAge(data: StrategyDataPacket): {
  oldestTransaction: Date | null;
  lastSync: Date | null;
} {
  // TODO: Implement actual data age calculation
  // This would require checking transaction dates from snapshot
  return {
    oldestTransaction: null,
    lastSync: data.timestamp,
  };
}

/**
 * Find critical missing data
 */
function findMissingCriticalData(data: StrategyDataPacket): string[] {
  const missing: string[] = [];

  if (!data.snapshot) {
    missing.push('Portfolio Snapshot (critical)');
  } else {
    if (!data.snapshot.netWorth) {
      missing.push('Net Worth calculation');
    }
    if (!data.snapshot.cashflowSummary || Object.keys(data.snapshot.cashflowSummary).length === 0) {
      missing.push('Cashflow data');
    }
  }

  if (!data.insights || data.insights.length === 0) {
    missing.push('Insights Engine data');
  }

  if (!data.preferences || !data.preferences.riskAppetite) {
    missing.push('User risk preferences (critical)');
  }

  return missing;
}

/**
 * Generate recommendations for data improvement
 */
function generateDataRecommendations(
  completeness: DataQualityReport['completeness'],
  missingCritical: string[]
): string[] {
  const recommendations: string[] = [];

  if (completeness.snapshot < 60) {
    recommendations.push(
      'Connect more financial accounts to improve portfolio snapshot'
    );
  }

  if (completeness.insights < 60) {
    recommendations.push(
      'Add more transactions and account data to generate insights'
    );
  }

  if (completeness.preferences < 60) {
    recommendations.push(
      'Complete your financial preferences questionnaire'
    );
  }

  if (completeness.relationships < 50) {
    recommendations.push(
      'Link related entities (e.g., properties to loans) for better analysis'
    );
  }

  if (missingCritical.length > 0) {
    recommendations.push(
      `Critical missing data: ${missingCritical.join(', ')}`
    );
  }

  return recommendations;
}

/**
 * Check if system should operate in "limited mode"
 * Limited mode = data quality < 60%
 */
export function isLimitedMode(qualityReport: DataQualityReport): boolean {
  return qualityReport.overallScore < 60;
}

/**
 * Get human-readable quality status
 */
export function getQualityStatus(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Limited';
}
