/**
 * UNIFIED GOOGLE GEMINI CLIENT
 * Phase 27 - Unified Google AI Engine
 *
 * Enhanced Gemini client with:
 * - Model fallback chain
 * - Usage tracking
 * - JSON response handling
 * - Error recovery
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GEMINI_MODELS, MODEL_FALLBACKS, getModelPricing } from './modelConfig';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get or create Gemini client instance
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not configured. ' +
          'Please add it to your environment variables.'
      );
    }

    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// =============================================================================
// TYPES
// =============================================================================

export interface GeminiCompletionOptions {
  model?: keyof typeof GEMINI_MODELS;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiUsageMetrics {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface GeminiCompletionResult<T = string> {
  data: T;
  usage: GeminiUsageMetrics;
}

// =============================================================================
// CORE COMPLETION FUNCTIONS
// =============================================================================

/**
 * Try to generate content with a specific model
 */
async function tryGenerateWithModel(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number,
  maxOutputTokens?: number
): Promise<{ text: string; usage: GeminiUsageMetrics }> {
  console.log('[Gemini] Trying model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxOutputTokens || 4096,
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  // Get usage metadata
  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || promptTokens + completionTokens;

  // Calculate cost
  const pricing = getModelPricing(modelName);
  const estimatedCost =
    (promptTokens / 1000) * pricing.input +
    (completionTokens / 1000) * pricing.output;

  return {
    text,
    usage: {
      model: modelName,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
    },
  };
}

/**
 * Try to generate JSON content with a specific model
 */
async function tryGenerateJSONWithModel<T>(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number,
  maxOutputTokens?: number
): Promise<GeminiCompletionResult<T>> {
  console.log('[Gemini] Trying JSON model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxOutputTokens || 4096,
      responseMimeType: 'application/json',
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  console.log('[Gemini] Raw response:', text.substring(0, 300) + '...');

  // Parse JSON
  const data = JSON.parse(text) as T;

  // Get usage metadata
  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || promptTokens + completionTokens;

  // Calculate cost
  const pricing = getModelPricing(modelName);
  const estimatedCost =
    (promptTokens / 1000) * pricing.input +
    (completionTokens / 1000) * pricing.output;

  return {
    data,
    usage: {
      model: modelName,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
    },
  };
}

/**
 * Generate a text response using Gemini with automatic model fallback
 */
export async function generateGeminiText(
  options: GeminiCompletionOptions
): Promise<GeminiCompletionResult<string>> {
  const client = getGeminiClient();

  const modelKey = options.model || 'FLASH';
  const primaryModel = GEMINI_MODELS[modelKey];
  const temperature = options.temperature ?? 0.7;

  // Combine system and user prompts
  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  // Build list of models to try (primary + fallbacks)
  const modelsToTry = [primaryModel, ...(MODEL_FALLBACKS[primaryModel] || [])];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const result = await tryGenerateWithModel(
        client,
        modelName,
        fullPrompt,
        temperature,
        options.maxOutputTokens
      );
      return {
        data: result.text,
        usage: result.usage,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] Model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found error (404)
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Generate a JSON response using Gemini with automatic model fallback
 */
export async function generateGeminiJSON<T>(
  options: GeminiCompletionOptions
): Promise<GeminiCompletionResult<T>> {
  const client = getGeminiClient();

  const modelKey = options.model || 'FLASH';
  const primaryModel = GEMINI_MODELS[modelKey];
  const temperature = options.temperature ?? 0.3; // Lower for JSON

  // Combine system and user prompts
  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  // Build list of models to try (primary + fallbacks)
  const modelsToTry = [primaryModel, ...(MODEL_FALLBACKS[primaryModel] || [])];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      return await tryGenerateJSONWithModel<T>(
        client,
        modelName,
        fullPrompt,
        temperature,
        options.maxOutputTokens
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] JSON model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found or JSON parse error
      if (
        errorMsg.includes('404') ||
        errorMsg.includes('not found') ||
        errorMsg.includes('JSON')
      ) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Truncate text to fit within token limits (rough estimate: 4 chars per token)
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

/**
 * Format currency for prompts
 */
export function formatCurrencyForPrompt(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for prompts
 */
export function formatPercentageForPrompt(value: number): string {
  return `${value.toFixed(2)}%`;
}
