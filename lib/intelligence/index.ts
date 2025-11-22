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
} from './insightsEngine';

export type {
  InsightItem,
  InsightSeverity,
  InsightCategory,
  InsightsSummary,
  InsightsResult,
  SnapshotV2,
} from './insightsEngine';
