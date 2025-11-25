/**
 * MONITRAX AI STRATEGY ENGINE
 * Phase 11 - Algorithmic Financial Analysis
 *
 * This is the main entry point for the Strategy Engine.
 * The engine uses deterministic business rules (not LLM AI) to generate
 * financial recommendations based on user data.
 *
 * Architecture:
 * - Layer 1: Data Collection (core/dataCollector.ts)
 * - Layer 2: Analysis & Scoring (analyzers/*, core/scoringEngine.ts)
 * - Layer 3: Strategy Synthesis (synthesizers/*)
 * - Layer 4: Presentation (API routes + UI components)
 */

// TODO: Export main strategy generation function
// export { generateStrategies } from './synthesizers/strategySynthesizer';

// Data Collection (Stage 2)
export {
  collectStrategyData,
  validateDataCompleteness,
  isLimitedMode,
  getQualityStatus,
} from './core/dataCollector';

// Scoring Engine (Stage 3C)
export {
  calculateSBS,
  rankRecommendations,
  scoreAndRankFindings,
  scoreAllFindings,
  explainScore,
  getSBSRating,
  getPriority,
  type ScoreComponents,
} from './core/scoringEngine';

// Analyzers (Stage 3)
export { analyzeDebt } from './analyzers/debtAnalyzer';
export { analyzeCashflow } from './analyzers/cashflowAnalyzer';
export { analyzeInvestments } from './analyzers/investmentAnalyzer';
export { analyzeProperties } from './analyzers/propertyAnalyzer';
export { analyzeRisk } from './analyzers/riskAnalyzer';
export { analyzeLiquidity } from './analyzers/liquidityAnalyzer';
export { analyzeTax } from './analyzers/taxAnalyzer';
export { analyzeTimeHorizon } from './analyzers/timeHorizonAnalyzer';

// TODO: Export forecasting
// export { generateForecast } from './forecasting/forecastEngine';

export const STRATEGY_ENGINE_VERSION = '1.0.0';
