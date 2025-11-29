/**
 * OPENAI CLIENT SERVICE
 * Phase 11 Enhancement - AI Integration
 *
 * Centralized OpenAI client with configuration and utilities.
 */

import OpenAI from 'openai';
import type { AIUsageMetrics } from './types';

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not configured. ' +
          'Please add it to your .env file.'
      );
    }

    openaiClient = new OpenAI({
      apiKey,
    });
  }

  return openaiClient;
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

export const AI_MODELS = {
  // GPT-4 for complex financial analysis
  FINANCIAL_ADVISOR: 'gpt-4-turbo-preview',
  // GPT-4 mini for quick responses
  QUICK_RESPONSE: 'gpt-4o-mini',
  // GPT-4 for detailed analysis
  DETAILED_ANALYSIS: 'gpt-4-turbo-preview',
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

// Pricing per 1000 tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.005, output: 0.015 },
};

// =============================================================================
// COMPLETION UTILITIES
// =============================================================================

export interface CompletionOptions {
  model?: AIModel;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface CompletionResult {
  content: string;
  usage: AIUsageMetrics;
}

/**
 * Generate a chat completion with usage tracking
 */
export async function generateCompletion(
  options: CompletionOptions
): Promise<CompletionResult> {
  const client = getOpenAIClient();

  const model = options.model || AI_MODELS.QUICK_RESPONSE;
  const maxTokens = options.maxTokens || 2000;
  const temperature = options.temperature ?? 0.7;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt },
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    response_format:
      options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content || '';
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;

  // Calculate cost
  const pricing = MODEL_PRICING[model] || { input: 0.01, output: 0.03 };
  const estimatedCost =
    (promptTokens / 1000) * pricing.input +
    (completionTokens / 1000) * pricing.output;

  return {
    content,
    usage: {
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost,
    },
  };
}

/**
 * Generate a JSON response with type safety
 */
export async function generateJSONCompletion<T>(
  options: Omit<CompletionOptions, 'responseFormat'>
): Promise<{ data: T; usage: AIUsageMetrics }> {
  const result = await generateCompletion({
    ...options,
    responseFormat: 'json',
  });

  try {
    const data = JSON.parse(result.content) as T;
    return { data, usage: result.usage };
  } catch (error) {
    console.error('[OpenAI] Failed to parse JSON response:', result.content);
    throw new Error('AI response was not valid JSON');
  }
}

// =============================================================================
// PROMPT UTILITIES
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
