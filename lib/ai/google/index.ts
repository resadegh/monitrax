/**
 * GOOGLE GEMINI AI MODULE
 * Phase 27 - Complete AI Migration to Google Gemini
 *
 * Main export point for all Gemini AI functionality.
 */

// Client and core functions
export {
  getGeminiClient,
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  generateGeminiTextCompletion,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
  estimateTokenCount,
  truncateToTokenLimit,
  type GeminiCompletionOptions,
  type GeminiUsageMetrics,
  type GeminiCompletionResult,
  type GeminiTextResult,
} from './geminiClient';

// Model configuration
export {
  GEMINI_MODELS,
  MODEL_FALLBACKS,
  getModelPricing,
  calculateCost,
  getModelCapabilities,
  getModelForUseCase,
  type GeminiModel,
  type ModelPricing,
  type ModelCapabilities,
  type UseCase,
} from './modelConfig';

// System prompts
export {
  FINANCIAL_ADVISOR_SYSTEM_PROMPT,
  QUICK_ANALYSIS_SYSTEM_PROMPT,
  QUESTION_ANSWERING_PROMPT,
  PROJECTIONS_SYSTEM_PROMPT,
  DOCUMENT_EXTRACTION_PROMPT,
  FORM_AUTOFILL_PROMPT,
  SCENARIO_ANALYSIS_PROMPT,
  GOAL_PROGRESS_PROMPT,
  buildFinancialContextPrompt,
} from './promptManager';
