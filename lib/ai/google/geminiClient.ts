/**
 * ENHANCED GEMINI CLIENT
 * Phase 27 - Complete AI Migration to Google Gemini
 *
 * Provides robust Gemini AI client with:
 * - Automatic model fallbacks
 * - JSON and text completion
 * - Token usage tracking
 * - Error handling with retries
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GEMINI_MODELS, MODEL_FALLBACKS, getModelPricing } from './modelConfig';

// =============================================================================
// CLIENT SINGLETON
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
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiUsageMetrics {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface GeminiCompletionResult<T> {
  data: T;
  usage: GeminiUsageMetrics;
}

export interface GeminiTextResult {
  text: string;
  usage: GeminiUsageMetrics;
}

// =============================================================================
// COMPLETION FUNCTIONS
// =============================================================================

/**
 * Try to generate content with a specific model (internal)
 */
async function tryGenerateWithModel<T>(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number,
  maxTokens?: number
): Promise<GeminiCompletionResult<T>> {
  console.log('[Gemini] Trying model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  console.log('[Gemini] Raw response length:', text.length);

  // Parse JSON response
  const data = JSON.parse(text) as T;

  // Get usage metadata
  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || 0;

  // Calculate cost
  const pricing = getModelPricing(modelName);
  const estimatedCost =
    (promptTokens / 1000000) * pricing.inputPer1M +
    (completionTokens / 1000000) * pricing.outputPer1M;

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
 * Try to generate text content with a specific model (internal)
 */
async function tryGenerateTextWithModel(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number,
  maxTokens?: number
): Promise<GeminiTextResult> {
  console.log('[Gemini] Trying text model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  // Get usage metadata
  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || 0;

  // Calculate cost
  const pricing = getModelPricing(modelName);
  const estimatedCost =
    (promptTokens / 1000000) * pricing.inputPer1M +
    (completionTokens / 1000000) * pricing.outputPer1M;

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
 * Generate a JSON response using Gemini with automatic model fallback
 */
export async function generateGeminiJSONCompletion<T>(
  options: GeminiCompletionOptions
): Promise<GeminiCompletionResult<T>> {
  const client = getGeminiClient();

  const primaryModel = options.model || GEMINI_MODELS.FLASH;
  const temperature = options.temperature ?? 0.2;

  // Combine system and user prompts
  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  // Build list of models to try (primary + fallbacks)
  const modelsToTry = [primaryModel, ...(MODEL_FALLBACKS[primaryModel] || [])];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      return await tryGenerateWithModel<T>(
        client,
        modelName,
        fullPrompt,
        temperature,
        options.maxTokens
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] Model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found error (404)
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      // For JSON parse errors, also try fallback
      if (errorMsg.includes('JSON')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All models failed
  throw lastError || new Error('All Gemini models failed');
}

/**
 * Generate a text response using Gemini with automatic model fallback
 */
export async function generateGeminiTextCompletion(
  options: GeminiCompletionOptions
): Promise<GeminiTextResult> {
  const client = getGeminiClient();

  const primaryModel = options.model || GEMINI_MODELS.FLASH;
  const temperature = options.temperature ?? 0.7;

  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  // Build list of models to try (primary + fallbacks)
  const modelsToTry = [primaryModel, ...(MODEL_FALLBACKS[primaryModel] || [])];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      return await tryGenerateTextWithModel(
        client,
        modelName,
        fullPrompt,
        temperature,
        options.maxTokens
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] Text model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found error (404)
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All models failed
  throw lastError || new Error('All Gemini models failed');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency for AI prompts
 */
export function formatCurrencyForPrompt(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage for AI prompts
 */
export function formatPercentageForPrompt(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximate token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '...';
}
