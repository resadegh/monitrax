/**
 * Monitrax Intelligence Module
 * Exports portfolio analytics and insights engines
 */

// Portfolio Intelligence Engine (Phase 4)
export {
  generatePortfolioIntelligence,
  calculateNetWorth,
  calculateCashflow,
  calculateGearing,
  calculateRisk,
  toMonthly,
  toAnnual,
} from './portfolioEngine';

export type {
  PortfolioInput,
  PortfolioIntelligence,
  NetWorthAnalysis,
  CashflowAnalysis,
  GearingAnalysis,
  RiskAnalysis,
  PropertyAnalysis,
  InvestmentAnalysisResult,
} from './portfolioEngine';

// Insights Engine v2.0 (Phase 8 Task 10.6)
export {
  getInsightsForDashboard,
  getInsightsByCategory,
  getInsightsBySeverity,
  getCriticalInsights,
  getInsightsByBlueprintCategory,
  getBlueprintCategory,
  CATEGORY_TO_BLUEPRINT,
} from './insightsEngine';

export type {
  InsightItem,
  InsightSeverity,
  InsightCategory,
  BlueprintCategory,
  InsightsSummary,
  InsightsResult,
  SnapshotV2,
} from './insightsEngine';

// Linkage Health Service (Phase 8 Task 10.7)
export {
  calculateLinkageHealth,
  clearLinkageHealthCache,
  clearAllLinkageHealthCache,
} from './linkageHealthService';

export type {
  HealthMetrics,
  ModuleBreakdown,
  LinkageHealthResponse,
} from './linkageHealthService';

// Entity Insights Attachment (Phase 04 Gap Fix)
export {
  enhanceInsightsWithEntityAttachment,
  getEntityInsights,
  getModuleInsights,
  calculateSeverityScore,
  calculateEntitySeverityScore,
  getHealthStatus,
  getHealthStatusFromScore,
  createEntityHealthSummary,
  groupInsightsByEntity,
  attachInsightsToEntities,
  aggregateInsightsByModule,
  IMPACT_WEIGHTS,
  CONFIDENCE_WEIGHTS,
} from './entityInsights';

export type {
  EntityHealthStatus,
  EntityHealthSummary,
  EntityWithInsights,
  ModuleInsightsSummary,
  InsightsByModule,
  EnhancedInsightsResult,
} from './entityInsights';
