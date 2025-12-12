/**
 * GOOGLE GEMINI AI SERVICE
 * Phase 26 Enhancement - Document Intelligence with Gemini
 *
 * Uses Google's Gemini AI for document field extraction.
 * Can use the same GCS service account or a separate API key.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get or create Gemini client instance
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    // Try GEMINI_API_KEY first, then fall back to extracting from GCS service account
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not configured. ' +
          'Please add it to your Vercel environment variables.'
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
// MODEL CONFIGURATION
// =============================================================================

export const GEMINI_MODELS = {
  // Gemini 2.0 Flash - Latest fast model for document extraction
  FLASH: 'gemini-2.0-flash',
  // Gemini 1.5 Pro - More capable for complex analysis
  PRO: 'gemini-1.5-pro-latest',
  // Gemini Pro - Stable fallback option
  PRO_STABLE: 'gemini-pro',
} as const;

// Fallback model order if primary fails
const MODEL_FALLBACKS: Record<string, string[]> = {
  'gemini-2.0-flash': ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-pro'],
  'gemini-1.5-pro-latest': ['gemini-1.5-pro', 'gemini-pro'],
  'gemini-pro': [],
};

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

// =============================================================================
// COMPLETION UTILITIES
// =============================================================================

export interface GeminiCompletionOptions {
  model?: GeminiModel;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface GeminiCompletionResult<T> {
  data: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Try to generate content with a specific model
 */
async function tryGenerateWithModel<T>(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number
): Promise<GeminiCompletionResult<T>> {
  console.log('[Gemini] Trying model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  console.log('[Gemini] Raw response from', modelName, ':', text.substring(0, 500));

  const data = JSON.parse(text) as T;

  // Get usage metadata if available
  const usageMetadata = response.usageMetadata;

  return {
    data,
    usage: usageMetadata
      ? {
          promptTokens: usageMetadata.promptTokenCount || 0,
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0,
        }
      : undefined,
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
      return await tryGenerateWithModel<T>(client, modelName, fullPrompt, temperature);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] Model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found error (404)
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue; // Try next model
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
 * Try to generate text content with a specific model
 */
async function tryGenerateTextWithModel(
  client: GoogleGenerativeAI,
  modelName: string,
  fullPrompt: string,
  temperature: number
): Promise<string> {
  console.log('[Gemini] Trying text model:', modelName);

  const genModel = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
    },
  });

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;

  return response.text();
}

/**
 * Generate a text response using Gemini with automatic model fallback
 */
export async function generateGeminiCompletion(
  options: GeminiCompletionOptions
): Promise<string> {
  const client = getGeminiClient();

  const primaryModel = options.model || GEMINI_MODELS.FLASH;
  const temperature = options.temperature ?? 0.7;

  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  // Build list of models to try (primary + fallbacks)
  const modelsToTry = [primaryModel, ...(MODEL_FALLBACKS[primaryModel] || [])];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      return await tryGenerateTextWithModel(client, modelName, fullPrompt, temperature);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Gemini] Text model', modelName, 'failed:', errorMsg);

      // Check if it's a model not found error (404)
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue; // Try next model
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All models failed
  throw lastError || new Error('All Gemini models failed');
}
