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
 *
 * Updated 2026-06-10 after the June-1 retirement of gemini-2.0-flash silently
 * broke every Gemini surface (categorisation, tax advisor, CFO advisor,
 * document intelligence). Model IDs verified against
 * https://ai.google.dev/gemini-api/docs/deprecations on 2026-06-10:
 *   - gemini-3.5-flash   — current stable flash (released 2026-05-19, no
 *                          announced shutdown). Primary for all flash work.
 *   - gemini-2.5-flash   — alive until 2026-10-16. Fallback only.
 *   - gemini-2.5-pro     — alive until 2026-10-16. Pro primary until then.
 *   - gemini-3.1-pro-preview — official 2.5-pro replacement. Pro fallback.
 *
 * ⚠ SCHEDULED BREAKAGE: gemini-2.5-flash and gemini-2.5-pro shut down
 * 2026-10-16 — re-verify this file against the deprecations page before then
 * (tracked in IMPLEMENTATION_PLAN “Up Next”). Never keep a retired ID in
 * GEMINI_MODELS or MODEL_FALLBACKS: retired endpoints reject with 404/429
 * regardless of billing tier.
 */
export const GEMINI_MODELS = {
  // Fast models for quick responses
  FLASH: 'gemini-3.5-flash',
  FLASH_LATEST: 'gemini-3.5-flash',

  // Pro models for detailed analysis
  PRO: 'gemini-2.5-pro',
  PRO_LATEST: 'gemini-3.1-pro-preview',

  // Aliases for use cases
  QUICK_RESPONSE: 'gemini-3.5-flash',
  FINANCIAL_ADVISOR: 'gemini-3.5-flash',
  DOCUMENT_ANALYSIS: 'gemini-3.5-flash',
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

// =============================================================================
// MODEL FALLBACKS
// =============================================================================

/**
 * Fallback model chains for reliability
 * If the primary model fails (404 or unavailable), try fallbacks in order.
 * Only verified-live IDs belong here (see file-header note).
 */
export const MODEL_FALLBACKS: Record<string, string[]> = {
  'gemini-3.5-flash': ['gemini-2.5-flash'],
  'gemini-2.5-flash': ['gemini-3.5-flash'],
  'gemini-2.5-pro': ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
  'gemini-3.1-pro-preview': ['gemini-2.5-pro', 'gemini-3.5-flash'],
};

// =============================================================================
// MODEL PRICING
// =============================================================================

/**
 * Pricing per 1M tokens (USD)
 * Source: https://ai.google.dev/gemini-api/docs/pricing as of 2026-06-10
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Flash models - cheaper, faster
  'gemini-3.5-flash': { inputPer1M: 1.50, outputPer1M: 9.00 },
  'gemini-2.5-flash': { inputPer1M: 0.30, outputPer1M: 2.50 },

  // Pro models - more capable (≤200k-prompt tier)
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
  'gemini-3.1-pro-preview': { inputPer1M: 2.00, outputPer1M: 12.00 },
};

// Default pricing for unknown models
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 1.50, outputPer1M: 9.00 };

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
  'gemini-3.5-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-2.5-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-2.5-pro': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsJSON: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  'gemini-3.1-pro-preview': {
    maxInputTokens: 1000000,
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
