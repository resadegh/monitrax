/**
 * GEMINI MODEL CONFIGURATION
 * Phase 27 - Unified Google AI Engine
 *
 * Model definitions, pricing, and fallback chains
 */

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

/**
 * Available Gemini models
 */
export const GEMINI_MODELS = {
  // Gemini 1.5 Flash - Fast and cost-effective for most tasks
  FLASH: 'gemini-1.5-flash-latest',
  // Gemini 1.5 Pro - More capable for complex analysis
  PRO: 'gemini-1.5-pro-latest',
  // Gemini Pro - Stable fallback (legacy but reliable)
  PRO_STABLE: 'gemini-pro',
} as const;

export type GeminiModelKey = keyof typeof GEMINI_MODELS;
export type GeminiModel = (typeof GEMINI_MODELS)[GeminiModelKey];

// =============================================================================
// MODEL FALLBACK CHAINS
// =============================================================================

/**
 * Fallback model order if primary fails
 */
export const MODEL_FALLBACKS: Record<string, string[]> = {
  'gemini-1.5-flash-latest': ['gemini-1.5-flash', 'gemini-pro'],
  'gemini-1.5-pro-latest': ['gemini-1.5-pro', 'gemini-pro'],
  'gemini-pro': [],
};

// =============================================================================
// USE CASE MODEL MAPPING
// =============================================================================

/**
 * Recommended models for different use cases
 */
export const MODEL_FOR_USE_CASE = {
  // Complex financial analysis requiring deep reasoning
  FINANCIAL_ADVISOR: 'PRO' as GeminiModelKey,
  // Quick questions and chat responses
  QUICK_RESPONSE: 'FLASH' as GeminiModelKey,
  // Document field extraction
  DOCUMENT_EXTRACTION: 'FLASH' as GeminiModelKey,
  // Transaction categorization
  TRANSACTION_CATEGORIZER: 'FLASH' as GeminiModelKey,
  // Health score explanations
  HEALTH_EXPLAINER: 'FLASH' as GeminiModelKey,
  // Scenario analysis (what-if)
  SCENARIO_ANALYZER: 'PRO' as GeminiModelKey,
  // Chat/conversational AI
  CHAT_ASSISTANT: 'FLASH' as GeminiModelKey,
  // Property analysis
  PROPERTY_ANALYZER: 'FLASH' as GeminiModelKey,
} as const;

// =============================================================================
// PRICING CONFIGURATION
// =============================================================================

/**
 * Pricing per 1000 tokens (USD) - as of Dec 2025
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash-latest': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro-latest': { input: 0.00125, output: 0.005 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-pro': { input: 0.0005, output: 0.0015 },
};

/**
 * Get pricing for a model (with fallback to default)
 */
export function getModelPricing(model: string): { input: number; output: number } {
  return MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
}

// =============================================================================
// MODEL LIMITS
// =============================================================================

/**
 * Token limits per model
 */
export const MODEL_LIMITS: Record<string, { maxInput: number; maxOutput: number }> = {
  'gemini-1.5-flash-latest': { maxInput: 1000000, maxOutput: 8192 },
  'gemini-1.5-flash': { maxInput: 1000000, maxOutput: 8192 },
  'gemini-1.5-pro-latest': { maxInput: 2000000, maxOutput: 8192 },
  'gemini-1.5-pro': { maxInput: 2000000, maxOutput: 8192 },
  'gemini-pro': { maxInput: 30720, maxOutput: 2048 },
};

/**
 * Get limits for a model
 */
export function getModelLimits(model: string): { maxInput: number; maxOutput: number } {
  return MODEL_LIMITS[model] || { maxInput: 30720, maxOutput: 2048 };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the model name from a use case
 */
export function getModelForUseCase(useCase: keyof typeof MODEL_FOR_USE_CASE): string {
  const modelKey = MODEL_FOR_USE_CASE[useCase];
  return GEMINI_MODELS[modelKey];
}

/**
 * Get temperature recommendation for use case
 */
export function getTemperatureForUseCase(useCase: keyof typeof MODEL_FOR_USE_CASE): number {
  switch (useCase) {
    case 'FINANCIAL_ADVISOR':
      return 0.5; // Balanced for advice
    case 'QUICK_RESPONSE':
      return 0.7; // More creative
    case 'DOCUMENT_EXTRACTION':
      return 0.2; // Very precise
    case 'TRANSACTION_CATEGORIZER':
      return 0.1; // Very precise
    case 'HEALTH_EXPLAINER':
      return 0.5; // Balanced
    case 'SCENARIO_ANALYZER':
      return 0.4; // Slightly conservative
    case 'CHAT_ASSISTANT':
      return 0.7; // Conversational
    case 'PROPERTY_ANALYZER':
      return 0.4; // Analytical
    default:
      return 0.5;
  }
}
