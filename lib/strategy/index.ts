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

// TODO: Export scoring
// export { calculateSBS } from './core/scoringEngine';

// TODO: Export forecasting
// export { generateForecast } from './forecasting/forecastEngine';

export const STRATEGY_ENGINE_VERSION = '1.0.0';
