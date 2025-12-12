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
  // Gemini 1.5 Flash - Fast and cheap, great for document extraction
  FLASH: 'gemini-1.5-flash',
  // Gemini 1.5 Pro - More capable for complex analysis
  PRO: 'gemini-1.5-pro',
} as const;

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
 * Generate a JSON response using Gemini
 */
export async function generateGeminiJSONCompletion<T>(
  options: GeminiCompletionOptions
): Promise<GeminiCompletionResult<T>> {
  const client = getGeminiClient();

  const model = options.model || GEMINI_MODELS.FLASH;
  const temperature = options.temperature ?? 0.2;

  const genModel = client.getGenerativeModel({
    model,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  });

  // Combine system and user prompts
  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  console.log('[Gemini] Sending request to model:', model);

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  console.log('[Gemini] Raw response:', text.substring(0, 500));

  try {
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
  } catch (error) {
    console.error('[Gemini] Failed to parse JSON response:', text);
    throw new Error('Gemini response was not valid JSON');
  }
}

/**
 * Generate a text response using Gemini
 */
export async function generateGeminiCompletion(
  options: GeminiCompletionOptions
): Promise<string> {
  const client = getGeminiClient();

  const model = options.model || GEMINI_MODELS.FLASH;
  const temperature = options.temperature ?? 0.7;

  const genModel = client.getGenerativeModel({
    model,
    generationConfig: {
      temperature,
    },
  });

  const fullPrompt = `${options.systemPrompt}\n\n${options.userPrompt}`;

  const result = await genModel.generateContent(fullPrompt);
  const response = result.response;

  return response.text();
}
