/**
 * GOOGLE AI MODULE EXPORTS
 * Phase 27 - Unified Google AI Engine
 */

// Client
export {
  getGeminiClient,
  isGeminiConfigured,
  generateGeminiText,
  generateGeminiJSON,
  truncateToTokenLimit,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
  type GeminiCompletionOptions,
  type GeminiCompletionResult,
  type GeminiUsageMetrics,
} from './geminiClient';

// Model Configuration
export {
  GEMINI_MODELS,
  MODEL_FALLBACKS,
  MODEL_FOR_USE_CASE,
  MODEL_PRICING,
  MODEL_LIMITS,
  getModelPricing,
  getModelLimits,
  getModelForUseCase,
  getTemperatureForUseCase,
  type GeminiModelKey,
  type GeminiModel,
} from './modelConfig';

// Prompts
export {
  FINANCIAL_ADVISOR_SYSTEM_PROMPT,
  QUICK_ANALYSIS_SYSTEM_PROMPT,
  QUESTION_ANSWERING_SYSTEM_PROMPT,
  SCENARIO_ANALYSIS_SYSTEM_PROMPT,
  GOAL_ANALYSIS_SYSTEM_PROMPT,
  HEALTH_EXPLAINER_SYSTEM_PROMPT,
  TRANSACTION_CATEGORIZER_SYSTEM_PROMPT,
  PROPERTY_ANALYZER_SYSTEM_PROMPT,
  getSystemPrompt,
} from './promptManager';
