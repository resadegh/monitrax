/**
 * Entity-Level Insight Attachment - Phase 04
 *
 * Attaches insights directly to entities in the snapshot response.
 * Provides EntityHealthSummary for each entity.
 */

import type { InsightItem, InsightSeverity, SnapshotV2, InsightsResult } from './insightsEngine';

// =============================================================================
// TYPES
// =============================================================================

export type EntityHealthStatus = 'healthy' | 'warning' | 'high' | 'critical';

export interface EntityHealthSummary {
  status: EntityHealthStatus;
  issueCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topIssues: InsightItem[];
}

export interface EntityWithInsights {
  id: string;
  name: string;
  type: string;
  insights: InsightItem[];
  health: EntityHealthSummary;
}

export interface ModuleInsightsSummary {
  module: string;
  insightCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  topInsights: InsightItem[];
  entities: EntityWithInsights[];
}

export interface InsightsByModule {
  properties: ModuleInsightsSummary;
  loans: ModuleInsightsSummary;
  income: ModuleInsightsSummary;
  expenses: ModuleInsightsSummary;
  accounts: ModuleInsightsSummary;
  investments: ModuleInsightsSummary;
  holdings: ModuleInsightsSummary;
  transactions: ModuleInsightsSummary;
}

export interface EnhancedInsightsResult extends InsightsResult {
  byModule: InsightsByModule;
  entityInsights: Map<string, EntityWithInsights>;
}

// =============================================================================
// SEVERITY SCORING
// =============================================================================

/**
 * Severity scoring weights per blueprint Section 4
 */
export const IMPACT_WEIGHTS: Record<InsightSeverity, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

/**
 * Confidence weights based on insight category
 */
export const CONFIDENCE_WEIGHTS: Record<string, number> = {
  missing_link: 1.0,        // Definite issue
  orphaned_entity: 1.0,     // Definite issue
  cross_module_health: 0.9, // Very likely issue
  data_completeness: 0.9,   // Very likely issue
  structural_gap: 0.8,      // Likely issue
  duplicate_invalid: 1.0,   // Definite issue
  financial_metric: 0.85,   // Likely relevant
  risk_signal: 0.7,         // Possible concern
  opportunity: 0.6,         // Advisory only
};

/**
 * Calculate severity score using the blueprint formula:
 * severityScore = impactWeight * confidenceWeight * persistenceFactor
 *
 * @param insight The insight to score
 * @param persistenceFactor How long the issue has persisted (1.0 = new, increases with age)
 * @returns Computed severity score 0-1
 */
export function calculateSeverityScore(
  insight: InsightItem,
  persistenceFactor: number = 1.0
): number {
  const impactWeight = IMPACT_WEIGHTS[insight.severity];
  const confidenceWeight = CONFIDENCE_WEIGHTS[insight.category] ?? 0.7;

  // Clamp persistence factor between 1.0 and 2.0
  const clampedPersistence = Math.min(Math.max(persistenceFactor, 1.0), 2.0);

  return impactWeight * confidenceWeight * clampedPersistence;
}

/**
 * Calculate aggregate severity score for an entity
 */
export function calculateEntitySeverityScore(insights: InsightItem[]): number {
  if (insights.length === 0) return 0;

  // Sum of all severity scores, capped at 1.0
  const totalScore = insights.reduce((sum, insight) => {
    return sum + calculateSeverityScore(insight);
  }, 0);

  return Math.min(totalScore, 1.0);
}

/**
 * Determine health status from severity score
 */
export function getHealthStatusFromScore(score: number): EntityHealthStatus {
  if (score >= 0.8) return 'critical';
  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'warning';
  return 'healthy';
}

/**
 * Determine health status from insight list
 */
export function getHealthStatus(insights: InsightItem[]): EntityHealthStatus {
  if (insights.some(i => i.severity === 'critical')) return 'critical';
  if (insights.some(i => i.severity === 'high')) return 'high';
  if (insights.some(i => i.severity === 'medium')) return 'warning';
  if (insights.length > 0) return 'warning';
  return 'healthy';
}

// =============================================================================
// ENTITY INSIGHT ATTACHMENT
// =============================================================================

/**
 * Create EntityHealthSummary from insights
 */
export function createEntityHealthSummary(insights: InsightItem[]): EntityHealthSummary {
  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const highCount = insights.filter(i => i.severity === 'high').length;
  const mediumCount = insights.filter(i => i.severity === 'medium').length;
  const lowCount = insights.filter(i => i.severity === 'low').length;

  // Top 3 most severe issues
  const topIssues = [...insights]
    .sort((a, b) => {
      const order: Record<InsightSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 3);

  return {
    status: getHealthStatus(insights),
    issueCount: insights.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    topIssues,
  };
}

/**
 * Group insights by entity ID
 */
export function groupInsightsByEntity(insights: InsightItem[]): Map<string, InsightItem[]> {
  const entityInsights = new Map<string, InsightItem[]>();

  for (const insight of insights) {
    for (const entity of insight.affectedEntities) {
      const existing = entityInsights.get(entity.id) || [];
      existing.push(insight);
      entityInsights.set(entity.id, existing);
    }
  }

  return entityInsights;
}

/**
 * Attach insights to entities in snapshot
 */
export function attachInsightsToEntities(
  snapshot: SnapshotV2,
  insightsResult: InsightsResult
): Map<string, EntityWithInsights> {
  const entityMap = new Map<string, EntityWithInsights>();
  const groupedInsights = groupInsightsByEntity(insightsResult.insights);

  // Process properties
  for (const property of snapshot.properties) {
    const insights = groupedInsights.get(property.id) || [];
    entityMap.set(property.id, {
      id: property.id,
      name: property.name,
      type: 'property',
      insights,
      health: createEntityHealthSummary(insights),
    });
  }

  // Process loans
  for (const loan of snapshot.loans) {
    const insights = groupedInsights.get(loan.id) || [];
    entityMap.set(loan.id, {
      id: loan.id,
      name: loan.name,
      type: 'loan',
      insights,
      health: createEntityHealthSummary(insights),
    });
  }

  // Process investment accounts
  for (const account of snapshot.investments.accounts) {
    const insights = groupedInsights.get(account.id) || [];
    entityMap.set(account.id, {
      id: account.id,
      name: account.name,
      type: 'investmentAccount',
      insights,
      health: createEntityHealthSummary(insights),
    });

    // Process holdings within account
    for (const holding of account.holdings) {
      const holdingInsights = groupedInsights.get(holding.id) || [];
      entityMap.set(holding.id, {
        id: holding.id,
        name: holding.ticker,
        type: 'holding',
        insights: holdingInsights,
        health: createEntityHealthSummary(holdingInsights),
      });
    }
  }

  return entityMap;
}

// =============================================================================
// MODULE AGGREGATION
// =============================================================================

/**
 * Create empty module summary
 */
function createEmptyModuleSummary(module: string): ModuleInsightsSummary {
  return {
    module,
    insightCount: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    topInsights: [],
    entities: [],
  };
}

/**
 * Aggregate insights by module
 */
export function aggregateInsightsByModule(
  snapshot: SnapshotV2,
  insightsResult: InsightsResult,
  entityMap: Map<string, EntityWithInsights>
): InsightsByModule {
  const byModule: InsightsByModule = {
    properties: createEmptyModuleSummary('properties'),
    loans: createEmptyModuleSummary('loans'),
    income: createEmptyModuleSummary('income'),
    expenses: createEmptyModuleSummary('expenses'),
    accounts: createEmptyModuleSummary('accounts'),
    investments: createEmptyModuleSummary('investments'),
    holdings: createEmptyModuleSummary('holdings'),
    transactions: createEmptyModuleSummary('transactions'),
  };

  // Group insights by module based on affected entities
  const moduleInsights: Record<string, InsightItem[]> = {
    properties: [],
    loans: [],
    income: [],
    expenses: [],
    accounts: [],
    investments: [],
    holdings: [],
    transactions: [],
  };

  for (const insight of insightsResult.insights) {
    for (const entity of insight.affectedEntities) {
      const moduleKey = getModuleFromEntityType(entity.type);
      if (moduleKey && moduleInsights[moduleKey]) {
        // Avoid duplicates
        if (!moduleInsights[moduleKey].includes(insight)) {
          moduleInsights[moduleKey].push(insight);
        }
      }
    }
  }

  // Build module summaries
  for (const [module, insights] of Object.entries(moduleInsights)) {
    const key = module as keyof InsightsByModule;
    byModule[key] = {
      module,
      insightCount: insights.length,
      critical: insights.filter(i => i.severity === 'critical').length,
      high: insights.filter(i => i.severity === 'high').length,
      medium: insights.filter(i => i.severity === 'medium').length,
      low: insights.filter(i => i.severity === 'low').length,
      topInsights: insights
        .sort((a, b) => {
          const order: Record<InsightSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return order[a.severity] - order[b.severity];
        })
        .slice(0, 3),
      entities: getEntitiesForModule(module, snapshot, entityMap),
    };
  }

  return byModule;
}

/**
 * Map entity type to module key
 */
function getModuleFromEntityType(entityType: string): string | null {
  const mapping: Record<string, string> = {
    property: 'properties',
    loan: 'loans',
    income: 'income',
    expense: 'expenses',
    account: 'accounts',
    investmentAccount: 'investments',
    holding: 'holdings',
    transaction: 'transactions',
  };
  return mapping[entityType] || null;
}

/**
 * Get entities for a specific module
 */
function getEntitiesForModule(
  module: string,
  snapshot: SnapshotV2,
  entityMap: Map<string, EntityWithInsights>
): EntityWithInsights[] {
  const entities: EntityWithInsights[] = [];

  switch (module) {
    case 'properties':
      for (const prop of snapshot.properties) {
        const entity = entityMap.get(prop.id);
        if (entity) entities.push(entity);
      }
      break;
    case 'loans':
      for (const loan of snapshot.loans) {
        const entity = entityMap.get(loan.id);
        if (entity) entities.push(entity);
      }
      break;
    case 'investments':
      for (const account of snapshot.investments.accounts) {
        const entity = entityMap.get(account.id);
        if (entity) entities.push(entity);
      }
      break;
    case 'holdings':
      for (const account of snapshot.investments.accounts) {
        for (const holding of account.holdings) {
          const entity = entityMap.get(holding.id);
          if (entity) entities.push(entity);
        }
      }
      break;
  }

  // Sort by health status (worst first)
  return entities.sort((a, b) => {
    const statusOrder: Record<EntityHealthStatus, number> = {
      critical: 0,
      high: 1,
      warning: 2,
      healthy: 3,
    };
    return statusOrder[a.health.status] - statusOrder[b.health.status];
  });
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Enhance insights result with entity-level attachment and module aggregation
 */
export function enhanceInsightsWithEntityAttachment(
  snapshot: SnapshotV2,
  insightsResult: InsightsResult
): EnhancedInsightsResult {
  const entityInsights = attachInsightsToEntities(snapshot, insightsResult);
  const byModule = aggregateInsightsByModule(snapshot, insightsResult, entityInsights);

  return {
    ...insightsResult,
    byModule,
    entityInsights,
  };
}

/**
 * Get insights for a specific entity
 */
export function getEntityInsights(
  entityId: string,
  enhancedResult: EnhancedInsightsResult
): EntityWithInsights | null {
  return enhancedResult.entityInsights.get(entityId) || null;
}

/**
 * Get insights for a specific module
 */
export function getModuleInsights(
  module: keyof InsightsByModule,
  enhancedResult: EnhancedInsightsResult
): ModuleInsightsSummary {
  return enhancedResult.byModule[module];
}
