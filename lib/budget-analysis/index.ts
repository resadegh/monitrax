/**
 * Phase 28: Realistic Budget Integration
 *
 * Main export point for budget analysis functionality.
 */

// Types
export * from './types';

// AI Prompt utilities
export {
  VARIABLE_EXPENSE_ESTIMATION_PROMPT,
  buildVariableExpensePrompt,
  validateVariableExpenseResponse,
  calculateBenchmarkExpenses,
} from './aiPrompt';
