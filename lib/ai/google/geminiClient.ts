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
import { recordAiUsage } from '@/lib/ai/usage/recordAiUsage';

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
  /**
   * Neobrain telemetry (Phase 54): the logical surface making this call
   * (e.g. 'categorisation', 'cfo-advisor'). Recorded to `AiUsageEvent` so the
   * admin panel can attribute cost per surface. Defaults to 'unknown'.
   */
  surface?: string;
  /** Owning user for telemetry attribution; omit for system calls. */
  userId?: string | null;
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
// RETRY / FALLBACK POLICY
// =============================================================================

// Fix: 429 rate-limit errors previously hit the "throw immediately" branch of
// the model-fallback loop — one quota blip aborted the whole call with no
// retry. Burst callers (e.g. QIF import batching, lib/bank/aiCategorisation)
// then degraded ALL results to confidence 0. Transient upstream errors are now
// retried per model with exponential backoff before moving to the next
// fallback model. See: docs/changelog/CHANGELOG_2026_06_10.md
const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_RETRY_DELAY_MS = 1000;

/** Transient errors worth retrying: rate limits, overload, network blips. */
function isRetriableGeminiError(message: string): boolean {
  return (
    message.includes('429') ||
    message.includes('503') ||
    /rate.?limit|resource.?exhausted|quota/i.test(message) ||
    /overloaded|temporarily unavailable/i.test(message) ||
    /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(message)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `attempt(modelName)` across the model fallback chain. Retriable errors
 * (429/503/network) back off and retry up to MAX_ATTEMPTS_PER_MODEL per model
 * before falling through to the next model; 404 / JSON-shape errors skip
 * straight to the next model; anything else throws immediately.
 */
async function withModelFallbackAndRetry<T>(
  modelsToTry: string[],
  attempt: (modelName: string) => Promise<T>
): Promise<T> {
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    for (let attemptNo = 1; attemptNo <= MAX_ATTEMPTS_PER_MODEL; attemptNo++) {
      try {
        return await attempt(modelName);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(errorMsg);

        if (isRetriableGeminiError(errorMsg)) {
          if (attemptNo < MAX_ATTEMPTS_PER_MODEL) {
            const delay =
              BASE_RETRY_DELAY_MS * 2 ** (attemptNo - 1) + Math.floor(Math.random() * 250);
            console.error(
              `[Gemini] ${modelName} transient failure (attempt ${attemptNo}/${MAX_ATTEMPTS_PER_MODEL}), retrying in ${delay}ms:`,
              errorMsg
            );
            await sleep(delay);
            continue;
          }
          console.error(
            `[Gemini] ${modelName} exhausted ${MAX_ATTEMPTS_PER_MODEL} attempts, trying next fallback model:`,
            errorMsg
          );
          break; // next model
        }

        // Model not found or malformed JSON — this model won't recover; try the next one.
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('JSON')) {
          console.error(`[Gemini] ${modelName} failed, trying next fallback model:`, errorMsg);
          break; // next model
        }

        // Non-retriable, non-fallback error (auth, bad request, safety block).
        throw error;
      }
    }
  }

  throw lastError || new Error('All Gemini models failed');
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

  try {
    const result = await withModelFallbackAndRetry(modelsToTry, (modelName) =>
      tryGenerateWithModel<T>(client, modelName, fullPrompt, temperature, options.maxTokens)
    );
    // Neobrain telemetry (Phase 54) — fire-and-forget; never blocks the response.
    recordAiUsage({
      surface: options.surface ?? 'unknown',
      userId: options.userId,
      model: result.usage.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCostUsd: result.usage.estimatedCost,
      success: true,
    });
    return result;
  } catch (err) {
    recordAiUsage({
      surface: options.surface ?? 'unknown',
      userId: options.userId,
      model: primaryModel,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      success: false,
    });
    throw err;
  }
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

  try {
    const result = await withModelFallbackAndRetry(modelsToTry, (modelName) =>
      tryGenerateTextWithModel(client, modelName, fullPrompt, temperature, options.maxTokens)
    );
    recordAiUsage({
      surface: options.surface ?? 'unknown',
      userId: options.userId,
      model: result.usage.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCostUsd: result.usage.estimatedCost,
      success: true,
    });
    return result;
  } catch (err) {
    recordAiUsage({
      surface: options.surface ?? 'unknown',
      userId: options.userId,
      model: primaryModel,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      success: false,
    });
    throw err;
  }
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
