/**
 * Phase 41h.2 — Gemini provider adapter.
 *
 * Implements `AIProvider` for Google's Gemini API. Translates the
 * gateway's provider-agnostic request → Gemini SDK call → gateway
 * response. **No code outside `lib/ai/tax-advisor/providers/` should
 * import the Gemini SDK directly.**
 *
 * **Architecture:**
 *   1. Convert `TaxAdvisorTool[]` → Gemini `FunctionDeclaration[]`
 *   2. Start a chat with the Monitrax system prompt + user message
 *   3. Multi-turn dispatch loop:
 *      - Send message → response may contain function calls
 *      - For each function call → execute via `request.executeTool()`
 *      - Send function results back to Gemini
 *      - Repeat until response is final JSON text
 *   4. Parse final JSON → return as `rawAnswer`
 *   5. Aggregate token usage from `usageMetadata`
 *
 * **Why JSON mode + structured output:** Gemini supports
 * `responseMimeType: "application/json"`. The gateway's Zod schema
 * (`responseSchema.ts`) validates the parsed JSON. Combining the
 * two gives us shape safety without trusting Gemini's free text.
 *
 * **Why no `responseSchema` parameter:** Gemini's structured-output
 * mode supports a schema, but the schema dialect doesn't cover Zod's
 * `discriminatedUnion`. We rely on JSON mode + post-parse Zod validation,
 * which works on every model version.
 *
 * **Multi-turn safety:** capped at `MAX_TURNS` to prevent runaway
 * loops. If Gemini keeps calling tools without finalising, we throw
 * `ProviderError` and the gateway returns `PROVIDER_ERROR` to the user.
 */

import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Tool,
  type Part,
} from '@google/generative-ai';

import type {
  AIProvider,
  ProviderInvokeRequest,
  ProviderInvokeResponse,
} from './types';
import { ProviderError } from './types';
import type { TaxAdvisorTool, ToolInputSchema } from '../types';

// gemini-2.0-flash retired 2026-06-01 (Google deprecations page) — migrated to
// the current stable flash 2026-06-10. Re-verify model lineup before 2026-10-16.
const DEFAULT_MODEL = 'gemini-3.5-flash';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TURNS = 8; // Defensive — multi-turn loop guard.

export interface GeminiProviderOptions {
  /**
   * Override the API key. Production reads from `GEMINI_API_KEY`
   * via `process.env`; tests inject a mock client.
   */
  apiKey?: string;
  /**
   * Inject a pre-built client (for tests with mocked SDK).
   */
  client?: GoogleGenerativeAI;
  defaultModel?: string;
}

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly defaultModel: string;

  constructor(options: GeminiProviderOptions = {}) {
    if (options.client) {
      this.client = options.client;
    } else {
      const key = options.apiKey ?? process.env.GEMINI_API_KEY;
      if (!key) {
        throw new ProviderError(
          'GEMINI_API_KEY not configured and no client injected.',
          this.name,
        );
      }
      this.client = new GoogleGenerativeAI(key);
    }
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
  }

  async invoke(
    request: ProviderInvokeRequest,
  ): Promise<ProviderInvokeResponse> {
    const modelName = request.options?.model ?? this.defaultModel;
    const timeoutMs = request.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const temperature = request.options?.temperature ?? 0.2;

    const tools: Tool[] = [
      { functionDeclarations: request.tools.map(toolToFunctionDeclaration) },
    ];

    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: request.systemPrompt,
      tools,
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        maxOutputTokens: request.options?.maxOutputTokens,
      },
    });

    const chat = model.startChat({});

    const toolInvocations: ProviderInvokeResponse['toolInvocations'] = [];
    const tokenAccumulator = { prompt: 0, completion: 0, total: 0 };

    let nextMessage: string | Part[] = request.userMessage;
    let finalText: string | null = null;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const sendPromise = chat.sendMessage(nextMessage);
      const result = await withTimeout(sendPromise, timeoutMs, this.name);
      const response = result.response;

      // Accumulate token usage across turns.
      const usage = response.usageMetadata;
      if (usage) {
        tokenAccumulator.prompt += usage.promptTokenCount || 0;
        tokenAccumulator.completion += usage.candidatesTokenCount || 0;
        tokenAccumulator.total += usage.totalTokenCount || 0;
      }

      const functionCalls =
        typeof response.functionCalls === 'function'
          ? response.functionCalls()
          : undefined;

      if (functionCalls && functionCalls.length > 0) {
        // Execute each function call via the gateway-supplied callback.
        const responseParts: Part[] = [];
        for (const fc of functionCalls) {
          const toolResult = await request.executeTool(fc.name, fc.args ?? {});
          toolInvocations.push({
            toolName: fc.name,
            input: fc.args ?? {},
            result: toolResult,
          });
          responseParts.push({
            functionResponse: {
              name: fc.name,
              // Send back the raw tool result so Gemini can ground its
              // narrative in real numbers + citations. We send the full
              // ToolResult shape; Gemini's JSON dialect handles nested
              // objects.
              response: serialiseToolResultForGemini(toolResult),
            },
          });
        }
        nextMessage = responseParts;
        continue;
      }

      // No function calls → expect final JSON text.
      try {
        finalText = response.text();
      } catch (err) {
        throw new ProviderError(
          `Gemini response had no text and no function calls: ${err instanceof Error ? err.message : String(err)}`,
          this.name,
        );
      }
      break;
    }

    if (finalText === null) {
      throw new ProviderError(
        `Gemini exceeded MAX_TURNS (${MAX_TURNS}) without producing a final answer.`,
        this.name,
      );
    }

    // Parse JSON. The gateway's Zod validator catches shape errors.
    let rawAnswer: unknown;
    try {
      rawAnswer = JSON.parse(finalText);
    } catch (err) {
      throw new ProviderError(
        `Gemini returned non-JSON in JSON mode: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
      );
    }

    return {
      rawAnswer,
      toolInvocations,
      tokenUsage: tokenAccumulator,
      providerRequestId: undefined, // Gemini SDK doesn't surface a request id
    };
  }
}

// ---------- Tool schema conversion ----------

/**
 * Convert a `TaxAdvisorTool` to a Gemini `FunctionDeclaration`.
 * Gemini's schema dialect is a subset of OpenAPI; our `ToolInputSchema`
 * subset maps cleanly.
 */
export function toolToFunctionDeclaration(
  tool: TaxAdvisorTool<any>,
): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: convertSchema(tool.inputSchema),
  };
}

function convertSchema(schema: ToolInputSchema): FunctionDeclaration['parameters'] {
  const properties: Record<string, ReturnType<typeof convertProperty>> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    properties[key] = convertProperty(prop);
  }
  return {
    type: SchemaType.OBJECT,
    properties,
    required: [...schema.required],
  } as FunctionDeclaration['parameters'];
}

function convertProperty(
  prop: ToolInputSchema['properties'][string],
): unknown {
  const base: Record<string, unknown> = {
    description: prop.description,
  };
  switch (prop.type) {
    case 'string':
      base.type = SchemaType.STRING;
      if (prop.enum) base.enum = [...prop.enum];
      return base;
    case 'number':
      base.type = SchemaType.NUMBER;
      return base;
    case 'integer':
      base.type = SchemaType.INTEGER;
      return base;
    case 'boolean':
      base.type = SchemaType.BOOLEAN;
      return base;
    case 'array':
      base.type = SchemaType.ARRAY;
      base.items = prop.items ?? { type: SchemaType.STRING };
      return base;
    case 'object':
      base.type = SchemaType.OBJECT;
      return base;
  }
}

// ---------- Helpers ----------

function serialiseToolResultForGemini(
  result: import('../types').ToolResult,
): Record<string, unknown> {
  // Strip `raw` (provider doesn't need internal calc objects); keep the
  // typed surface (numericFields + citations + uncomputed + narrativeText)
  // so Gemini can ground its narrative in tool output.
  return {
    toolName: result.toolName,
    computedAt: result.computedAt,
    numericFields: result.numericFields,
    citations: result.citations,
    uncomputed: result.uncomputed,
    narrativeText: result.narrativeText,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  providerName: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new ProviderError(`Timed out after ${ms}ms`, providerName));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
