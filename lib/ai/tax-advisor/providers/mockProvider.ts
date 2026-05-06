/**
 * Phase 41h.1 — MockProvider for tests + dev.
 *
 * Deterministic provider — caller pre-configures what `invoke()`
 * returns for given questions. No network, no model. Used by:
 *   - The gateway's test suite (HR-1/HR-2/D-2 enforcement scenarios)
 *   - Local dev without a Gemini API key
 *   - CI (no external dependency)
 *
 * **Usage pattern:**
 *
 * \`\`\`ts
 * const mock = new MockProvider();
 * mock.queueResponse(
 *   { rawAnswer: { tier: 'TIER_1_FACTS', segments: [...] }, ... },
 *   // optional: which tool calls to make first
 *   [{ toolName: 'getContributionCapHeadroom', input: {...} }],
 * );
 * const gateway = createGateway({ provider: mock, ... });
 * await gateway.ask({ question: '...', userId: '...', ... });
 * \`\`\`
 */

import type {
  AIProvider,
  ProviderInvokeRequest,
  ProviderInvokeResponse,
} from './types';
import { ProviderError } from './types';

interface QueuedResponse {
  /** The raw structured output the model "returns". */
  rawAnswer: unknown;
  /**
   * Tool calls the mock should issue before returning. Each is
   * dispatched against `request.executeTool()` to populate the
   * tool session, exactly as a real provider would.
   */
  toolCalls?: Array<{ toolName: string; input: unknown }>;
  /** Optional token usage (defaults to zero — real cost tracking is for Gemini). */
  tokenUsage?: ProviderInvokeResponse['tokenUsage'];
  /** Throw a ProviderError instead of returning. */
  throwError?: { message: string };
}

export class MockProvider implements AIProvider {
  public readonly name = 'mock';
  private queue: QueuedResponse[] = [];

  /** Queue a response for the next invoke() call. */
  queueResponse(response: QueuedResponse): this {
    this.queue.push(response);
    return this;
  }

  /** Clear the queue — handy for test setup. */
  clear(): this {
    this.queue.length = 0;
    return this;
  }

  async invoke(
    request: ProviderInvokeRequest,
  ): Promise<ProviderInvokeResponse> {
    const next = this.queue.shift();
    if (!next) {
      throw new ProviderError(
        'MockProvider queue is empty — call queueResponse() before invoke().',
        this.name,
      );
    }

    if (next.throwError) {
      throw new ProviderError(next.throwError.message, this.name);
    }

    const toolInvocations: ProviderInvokeResponse['toolInvocations'] = [];
    if (next.toolCalls) {
      for (const call of next.toolCalls) {
        const result = await request.executeTool(call.toolName, call.input);
        toolInvocations.push({
          toolName: call.toolName,
          input: call.input,
          result,
        });
      }
    }

    return {
      rawAnswer: next.rawAnswer,
      toolInvocations,
      tokenUsage: next.tokenUsage ?? { prompt: 0, completion: 0, total: 0 },
      providerRequestId: `mock-${Date.now()}`,
    };
  }
}
