/**
 * Phase 17: Personal CFO Engine
 * Public API for the CFO Intelligence System
 */

// Core types
export * from './types';

// Score calculation
export { calculateCFOScore, getCFOScoreHistory, saveCFOScore } from './scoreCalculator';

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
