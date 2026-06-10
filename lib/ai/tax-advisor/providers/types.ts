/**
 * Phase 41h.1 — AI provider abstraction.
 *
 * Provider-agnostic interface. The AI Policy Gateway calls
 * `Provider.invoke()` rather than a specific SDK, so swapping
 * Gemini → Claude → OpenAI is a one-file change in 41h.2.
 *
 * Industry-standard pattern (LangChain Provider, AI SDK Adapter,
 * etc.): the provider knows about the model API; the gateway knows
 * about Monitrax policy.
 */

import type { TaxAdvisorTool, ToolResult } from '../types';

export interface ProviderInvokeRequest {
  /** The Monitrax persona system prompt + policy preamble. */
  systemPrompt: string;
  /** The user's question (already sanitised by the gateway). */
  userMessage: string;
  /** Tools available for this invocation (subset of the registry). */
  tools: TaxAdvisorTool<any>[];
  /**
   * Tool-execution callback. The provider invokes this when the
   * model emits a tool call. Returns the `ToolResult` for the model
   * to continue from.
   */
  executeTool: (toolName: string, input: unknown) => Promise<ToolResult>;
  /** Trace id for observability. */
  traceId: string;
  /** Optional max tokens / temperature / etc. */
  options?: ProviderOptions;
}

export interface ProviderOptions {
  /** Model identifier — provider-specific (e.g. "gemini-3.5-flash"). */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Hard timeout (ms). Defaults to 30s. */
  timeoutMs?: number;
}

export interface ProviderInvokeResponse {
  /**
   * Raw structured output from the model — must conform to the AI
   * Response Schema. The gateway's validator will check this against
   * the tool-result session before returning to the user.
   */
  rawAnswer: unknown;
  /** Every tool call the model made during this turn. */
  toolInvocations: Array<{
    toolName: string;
    input: unknown;
    result: ToolResult;
  }>;
  /** Token usage for observability + cost tracking. */
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Provider's identifier for this request (debugging). */
  providerRequestId?: string;
}

/**
 * Provider interface. 41h.2 ships the Gemini implementation;
 * 41h-tests ship a MockProvider for deterministic test runs.
 */
export interface AIProvider {
  /** Stable identifier — `'gemini'`, `'mock'`, `'claude'`, etc. */
  name: string;
  invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse>;
}

/**
 * Typed provider error. The gateway catches `unknown` from providers
 * and wraps in `GatewayError` (in `gateway.ts`); providers should
 * throw a `ProviderError` so the wrapping is precise.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
