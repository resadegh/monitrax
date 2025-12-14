/**
 * GEMINI MODEL CONFIGURATION
 * Phase 27 - Complete AI Migration to Google Gemini
 *
 * Centralized model configuration and pricing for Google Gemini models.
 */

// =============================================================================
// AVAILABLE MODELS
// =============================================================================

/**
 * Gemini model identifiers
 * Updated to use current available models (Dec 2024)
 */
export const GEMINI_MODELS = {
  // Fast models for quick responses
  FLASH: 'gemini-2.0-flash',
  FLASH_LATEST: 'gemini-2.5-flash-preview-05-20',

  // Pro models for detailed analysis
  PRO: 'gemini-2.5-pro-preview-05-06',
  PRO_LATEST: 'gemini-pro-latest',

  // Aliases for use cases
  QUICK_RESPONSE: 'gemini-2.0-flash',
  FINANCIAL_ADVISOR: 'gemini-2.5-flash-preview-05-20',
  DOCUMENT_ANALYSIS: 'gemini-2.0-flash',
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

// =============================================================================
// MODEL FALLBACKS
// =============================================================================

/**
 * Fallback model chains for reliability
 * If the primary model fails (404 or unavailable), try fallbacks in order
 */
export const MODEL_FALLBACKS: Record<string, string[]> = {
  'gemini-2.0-flash': ['gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash'],
  'gemini-2.5-flash-preview-05-20': ['gemini-2.0-flash', 'gemini-1.5-flash'],
  'gemini-2.5-pro-preview-05-06': ['gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash'],
  'gemini-pro-latest': ['gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
  'gemini-1.5-flash': ['gemini-2.0-flash'],
  'gemini-1.5-pro': ['gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
};

// =============================================================================
// MODEL PRICING
// =============================================================================

/**
 * Pricing per 1M tokens (USD)
 * Source: Google AI pricing as of Dec 2024
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Flash models - cheaper, faster
  'gemini-2.0-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-2.5-flash-preview-05-20': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },

  // Pro models - more capable
  'gemini-2.5-pro-preview-05-06': { inputPer1M: 1.25, outputPer1M: 10.00 },
  'gemini-pro-latest': { inputPer1M: 1.25, outputPer1M: 5.00 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
};

// Default pricing for unknown models
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 0.15, outputPer1M: 0.60 };

/**
 * Get pricing for a specific model
 */
export function getModelPricing(modelName: string): ModelPricing {
  return MODEL_PRICING[modelName] || DEFAULT_PRICING;
}

/**
 * Calculate estimated cost for a request
 */
export function calculateCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(modelName);
  return (
    (promptTokens / 1000000) * pricing.inputPer1M +
    (completionTokens / 1000000) * pricing.outputPer1M
  );
}

// =============================================================================
// MODEL CAPABILITIES
// =============================================================================

/**
 * Model capabilities and limits
 */
export interface ModelCapabilities {
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsJSON: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
}

const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'gemini-2.0-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-2.5-flash-preview-05-20': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-2.5-pro-preview-05-06': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-1.5-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-1.5-pro': {
    maxInputTokens: 2000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
};

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  maxInputTokens: 100000,
  maxOutputTokens: 4096,
  supportsJSON: true,
  supportsVision: false,
  supportsFunctionCalling: false,
};

/**
 * Get capabilities for a specific model
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelName] || DEFAULT_CAPABILITIES;
}

// =============================================================================
// MODEL SELECTION
// =============================================================================

export type UseCase = 'quick' | 'detailed' | 'document' | 'vision';

/**
 * Get recommended model for a use case
 */
export function getModelForUseCase(useCase: UseCase): string {
  switch (useCase) {
    case 'quick':
      return GEMINI_MODELS.QUICK_RESPONSE;
    case 'detailed':
      return GEMINI_MODELS.FINANCIAL_ADVISOR;
    case 'document':
      return GEMINI_MODELS.DOCUMENT_ANALYSIS;
    case 'vision':
      return GEMINI_MODELS.FLASH;
    default:
      return GEMINI_MODELS.FLASH;
  }
}
