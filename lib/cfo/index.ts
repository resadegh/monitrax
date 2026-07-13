/**
 * Phase 17: Personal CFO Engine
 * Public API for the CFO Intelligence System
 */

// Core types
export * from './types';

// Score calculation
export { computeCFOComponents, getCFOScoreHistory, saveCFOScore } from './scoreCalculator';

// Risk detection
export { scanForRisks } from './riskRadar';

// Action generation
export { generateActions } from './actionEngine';

// Main intelligence engine
export {
  getCFODashboardData,
  getCFOScore,
  getRisks,
  getActions,
} from './intelligenceEngine';

// Decision Support (Phase 17A-D)
export { calculateCFOTaxInsights } from './decisionSupport/taxIntegration';
export { calculateCFOLoanInsights } from './decisionSupport/loanDecisionSupport';
export { calculateCFOPropertyInsights } from './decisionSupport/propertyDecisionSupport';
export { calculateCFOInvestmentInsights } from './decisionSupport/investmentDecisionSupport';

// Phase 40 — AI Financial Advisor + scenario engine
export { generateOrFetchAdvice } from './aiAdvisor';
export type {
  AIAdviceDocument,
  AIAdviceRecommendation,
  AIAdviceEvidence,
  AIAdviceSuggestedScenario,
  AIAdviceHeadline,
} from './aiAdvisor';
export { runScenario, runScenarioDecimal, SCENARIO_TYPES } from './scenarios';
export type {
  ScenarioContext,
  ScenarioResult,
  ScenarioResultDecimal,
  ScenarioType,
  ScenarioImpact,
  ScenarioImpactDecimal,
  ScenarioWarning,
  AnyScenarioParams,
  LoanView,
  SuperAccountView,
} from './scenarios';

// TRAIL stage detection (Phase 17 spec — wired up in Phase 40).
export {
  determineTrailStage,
  getTrailStageInfo,
  actionCategoryToTrailStage,
  isActionRelevantToStage,
} from './trailStage';
export type { TrailStage, TrailStageInfo, TrailStageInput } from './trailStage';
