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
  // Gemini 2.0 Flash - Fast and reliable for document extraction
  FLASH: 'gemini-2.0-flash',
  // Gemini 2.5 Flash - Latest flash model
  FLASH_LATEST: 'gemini-2.5-flash',
  // Gemini 2.5 Pro - Most capable for complex analysis
  PRO: 'gemini-2.5-pro',
} as const;

// Fallback model order if primary fails - use current available models
const MODEL_FALLBACKS: Record<string, string[]> = {
  'gemini-2.0-flash': ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001'],
  'gemini-2.5-flash': ['gemini-2.0-flash', 'gemini-flash-latest'],
  'gemini-2.5-pro': ['gemini-pro-latest', 'gemini-2.5-flash'],
  'gemini-flash-latest': ['gemini-2.0-flash', 'gemini-2.5-flash'],
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
 * List available models (for debugging)
 */
export async function listAvailableModels(): Promise<string[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    console.log('[Gemini] Listing models with API key:', apiKey.substring(0, 10) + '...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    console.log('[Gemini] List models response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] Failed to list models:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    const models = data.models?.map((m: { name: string }) => m.name) || [];
    console.log('[Gemini] Available models count:', models.length);
    console.log('[Gemini] Available models:', JSON.stringify(models));
    return models;
  } catch (error) {
    console.error('[Gemini] Error listing models:', error);
    return [];
  }
}

/**
 * Test direct REST API call (bypasses SDK for debugging)
 */
export async function testGeminiDirectAPI(): Promise<{ success: boolean; error?: string; models?: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  console.log('[Gemini Direct Test] Starting with key:', apiKey.substring(0, 10) + '...');

  try {
    // First, list available models
    const listResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    console.log('[Gemini Direct Test] List models status:', listResponse.status);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      return { success: false, error: `List models failed: ${listResponse.status} - ${errorText}` };
    }

    const listData = await listResponse.json();
    const models = listData.models?.map((m: { name: string; supportedGenerationMethods?: string[] }) => ({
      name: m.name,
      methods: m.supportedGenerationMethods || []
    })) || [];

    console.log('[Gemini Direct Test] Found models:', JSON.stringify(models, null, 2));

    // Find a model that supports generateContent
    const generateModel = models.find((m: { name: string; methods: string[] }) =>
      m.methods.includes('generateContent')
    );

    if (!generateModel) {
      return {
        success: false,
        error: 'No models support generateContent',
        models: models.map((m: { name: string }) => m.name)
      };
    }

    console.log('[Gemini Direct Test] Using model:', generateModel.name);

    // Try a simple generation
    const genResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${generateModel.name}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "hello"' }] }]
        })
      }
    );

    console.log('[Gemini Direct Test] Generate status:', genResponse.status);

    if (!genResponse.ok) {
      const errorText = await genResponse.text();
      return {
        success: false,
        error: `Generate failed: ${genResponse.status} - ${errorText}`,
        models: models.map((m: { name: string }) => m.name)
      };
    }

    return { success: true, models: models.map((m: { name: string }) => m.name) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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
