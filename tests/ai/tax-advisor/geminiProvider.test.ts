/**
 * Phase 41h.2 — GeminiProvider tests with mocked SDK.
 *
 * The Gemini SDK is mocked via dependency injection (`client`
 * option on `GeminiProviderOptions`). No network calls in these
 * tests; CI runs deterministically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeminiProvider,
  toolToFunctionDeclaration,
  ProviderError,
  type ProviderInvokeRequest,
} from '@/lib/ai/tax-advisor';
import {
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
  getContributionCapHeadroomTool,
} from '@/lib/ai/tax-advisor';

beforeEach(() => {
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

// ============================================================
// Tool → Gemini FunctionDeclaration conversion
// ============================================================

describe('toolToFunctionDeclaration — schema conversion', () => {
  it('converts a FACT_LOOKUP tool to a Gemini function declaration', () => {
    const decl = toolToFunctionDeclaration(getContributionCapHeadroomTool);
    expect(decl.name).toBe('getContributionCapHeadroom');
    expect(decl.description.toLowerCase()).toContain('fact_lookup');
    expect(decl.parameters?.type).toBeDefined();
    const props = decl.parameters?.properties as Record<string, unknown>;
    expect(props).toHaveProperty('financialYear');
    expect(props).toHaveProperty('concessionalYTD');
    expect(props).toHaveProperty('nonConcessionalYTD');
    expect(decl.parameters?.required).toEqual([
      'financialYear',
      'concessionalYTD',
      'nonConcessionalYTD',
    ]);
  });
});

// ============================================================
// Constructor / configuration
// ============================================================

describe('GeminiProvider — constructor', () => {
  it('throws ProviderError when no API key and no client injected', () => {
    const oldKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(() => new GeminiProvider()).toThrow(ProviderError);
    } finally {
      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    }
  });

  it('accepts an injected client (test pattern)', () => {
    const fakeClient = makeMockClient({ finalAnswer: { tier: 'TIER_1_FACTS', segments: [{ type: 'TEXT', text: 'ok' }] } });
    const provider = new GeminiProvider({ client: fakeClient });
    expect(provider.name).toBe('gemini');
  });
});

// ============================================================
// invoke() — single-turn (no function calls)
// ============================================================

describe('GeminiProvider.invoke — single-turn', () => {
  it('returns rawAnswer parsed from JSON when model emits final text', async () => {
    const fakeClient = makeMockClient({
      finalAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'TEXT', text: 'Your position…' }],
      },
      promptTokens: 100,
      completionTokens: 50,
    });
    const provider = new GeminiProvider({ client: fakeClient });

    const result = await provider.invoke(makeRequest({}));

    expect(result.rawAnswer).toEqual({
      tier: 'TIER_1_FACTS',
      segments: [{ type: 'TEXT', text: 'Your position…' }],
    });
    expect(result.tokenUsage.prompt).toBe(100);
    expect(result.tokenUsage.completion).toBe(50);
    expect(result.tokenUsage.total).toBe(150);
    expect(result.toolInvocations).toEqual([]);
  });

  it('throws ProviderError if model returns non-JSON', async () => {
    const fakeClient = makeMockClient({ finalText: 'not valid json{' });
    const provider = new GeminiProvider({ client: fakeClient });

    await expect(provider.invoke(makeRequest({}))).rejects.toThrow(ProviderError);
  });
});

// ============================================================
// invoke() — multi-turn (function calls dispatched)
// ============================================================

describe('GeminiProvider.invoke — multi-turn function calling', () => {
  it('executes a function call → continues → returns final answer', async () => {
    const fakeClient = makeMockClient({
      turns: [
        // Turn 1: Gemini emits a function call
        {
          functionCalls: [
            {
              name: 'getContributionCapHeadroom',
              args: {
                financialYear: '2024-25',
                concessionalYTD: 22_000,
                nonConcessionalYTD: 0,
              },
            },
          ],
        },
        // Turn 2: After we send tool result, Gemini emits final text
        {
          finalAnswer: {
            tier: 'TIER_1_FACTS',
            segments: [
              { type: 'TEXT', text: 'Your concessional cap headroom:' },
              {
                type: 'NUMBER_REF',
                ref: 'getContributionCapHeadroom#contributionCaps.concessional.remaining',
              },
            ],
          },
        },
      ],
    });
    const provider = new GeminiProvider({ client: fakeClient });
    const executions: string[] = [];

    const result = await provider.invoke(
      makeRequest({
        executeTool: async (name, input) => {
          executions.push(name);
          // Use the real tool to get a real ToolResult.
          const tool = taxAdvisorToolRegistry.get(name);
          if (!tool) throw new Error('unknown tool');
          return tool.execute(input as never);
        },
      }),
    );

    expect(executions).toEqual(['getContributionCapHeadroom']);
    expect(result.toolInvocations).toHaveLength(1);
    expect(result.toolInvocations[0].toolName).toBe('getContributionCapHeadroom');
    expect((result.rawAnswer as { tier: string }).tier).toBe('TIER_1_FACTS');
  });

  it('aggregates token usage across turns', async () => {
    const fakeClient = makeMockClient({
      turns: [
        {
          functionCalls: [{ name: 'getContributionCapHeadroom', args: {} }],
          promptTokens: 100,
          completionTokens: 30,
        },
        {
          finalAnswer: { tier: 'TIER_1_FACTS', segments: [{ type: 'TEXT', text: 'ok' }] },
          promptTokens: 200,
          completionTokens: 50,
        },
      ],
    });
    const provider = new GeminiProvider({ client: fakeClient });

    const result = await provider.invoke(
      makeRequest({
        executeTool: async (name) => {
          const tool = taxAdvisorToolRegistry.get(name);
          if (!tool) throw new Error('unknown tool');
          return tool.execute({
            financialYear: '2024-25',
            concessionalYTD: 0,
            nonConcessionalYTD: 0,
          } as never);
        },
      }),
    );

    expect(result.tokenUsage.prompt).toBe(300);
    expect(result.tokenUsage.completion).toBe(80);
    expect(result.tokenUsage.total).toBe(380);
  });

  it('throws ProviderError if MAX_TURNS exceeded', async () => {
    // Always return function calls — never finalises.
    const fakeClient = makeMockClient({
      turns: Array.from({ length: 12 }, () => ({
        functionCalls: [{ name: 'getContributionCapHeadroom', args: {} }],
      })),
    });
    const provider = new GeminiProvider({ client: fakeClient });

    await expect(
      provider.invoke(
        makeRequest({
          executeTool: async (name) => {
            const tool = taxAdvisorToolRegistry.get(name);
            if (!tool) throw new Error('unknown tool');
            return tool.execute({
              financialYear: '2024-25',
              concessionalYTD: 0,
              nonConcessionalYTD: 0,
            } as never);
          },
        }),
      ),
    ).rejects.toThrow(/MAX_TURNS/);
  });
});

// ============================================================
// Helpers
// ============================================================

function makeRequest(
  o: Partial<ProviderInvokeRequest> = {},
): ProviderInvokeRequest {
  return {
    systemPrompt: 'system prompt',
    userMessage: 'tell me my cap',
    tools: [getContributionCapHeadroomTool],
    executeTool: async () => {
      throw new Error('executeTool not configured for this test');
    },
    traceId: 'test-trace',
    ...o,
  };
}

interface MockTurn {
  functionCalls?: Array<{ name: string; args: unknown }>;
  finalAnswer?: unknown;
  finalText?: string;
  promptTokens?: number;
  completionTokens?: number;
}

interface MockClientOptions {
  turns?: MockTurn[];
  finalAnswer?: unknown;
  finalText?: string;
  promptTokens?: number;
  completionTokens?: number;
}

function makeMockClient(opts: MockClientOptions): any {
  const turns: MockTurn[] = opts.turns ?? [
    {
      finalAnswer: opts.finalAnswer,
      finalText: opts.finalText,
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
    },
  ];
  let turnIndex = 0;

  return {
    getGenerativeModel: () => ({
      startChat: () => ({
        sendMessage: async () => {
          const turn = turns[turnIndex++];
          if (!turn) {
            throw new Error('mock turn queue exhausted');
          }
          return {
            response: {
              functionCalls: turn.functionCalls
                ? () => turn.functionCalls
                : () => undefined,
              text: () =>
                turn.finalText ??
                JSON.stringify(turn.finalAnswer ?? { tier: 'TIER_1_FACTS', segments: [{ type: 'TEXT', text: '' }] }),
              usageMetadata: {
                promptTokenCount: turn.promptTokens ?? 0,
                candidatesTokenCount: turn.completionTokens ?? 0,
                totalTokenCount: (turn.promptTokens ?? 0) + (turn.completionTokens ?? 0),
              },
            },
          };
        },
      }),
    }),
  };
}
