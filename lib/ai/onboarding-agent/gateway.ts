/**
 * Onboarding-agent gateway — Phase 12 §E.1.
 *
 * The single boundary between the chat surface and the LLM. The
 * gateway:
 *   1. Composes the system prompt + user message + tool spec.
 *   2. Calls Anthropic with `tool_choice: { type: "tool", name: ... }`
 *      to force a tool call (no plain-text replies allowed).
 *   3. Validates the LLM's tool input against the Zod schema. Any
 *      schema violation = treated as "no extraction" + audit logged.
 *   4. Returns the validated WizardStateDelta to the caller.
 *
 * SEPARATE FROM THE TAX-ADVISOR GATEWAY. Different concerns:
 *   - lib/ai/tax-advisor/gateway.ts → CFO surface, FACT_LOOKUP / SCENARIO_RUN,
 *     AFSL-bounded financial-advice extraction
 *   - lib/ai/onboarding-agent/gateway.ts → THIS FILE, EXTRACT_WIZARD_STEP_DELTA,
 *     pure data-entry extraction, no advice surface
 *
 * Never blend them. CLAUDE.md §12.4 (one endpoint per concern) +
 * Phase 12 §2 hard rule #7.
 */

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_MODELS,
  getAnthropicClient,
  isAnthropicConfigured,
} from '@/lib/ai/anthropic';
import {
  wizardStateDeltaSchema,
  type WizardStateDelta,
  type HouseholdFields,
} from './schemas/wizardStateDelta';
import {
  EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME,
  HOUSEHOLD_SYSTEM_PROMPT,
  householdExtractTool,
} from './tools/extractWizardStepDelta';

export type SupportedTopic = 'household';

export interface ExtractRequest {
  topic: SupportedTopic;
  userMessage: string;
  /** State already staged for this topic — so the LLM doesn't duplicate. */
  currentStateSubset: HouseholdFields;
  /** Last ~4 turns for disambiguation. Format: "agent: …" or "user: …". */
  recentTranscript: Array<{ role: 'agent' | 'user'; text: string }>;
}

export interface ExtractSuccess {
  ok: true;
  delta: WizardStateDelta;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface ExtractFailure {
  ok: false;
  reason:
    | 'ANTHROPIC_NOT_CONFIGURED'
    | 'NO_TOOL_USE'
    | 'SCHEMA_VIOLATION'
    | 'PROVIDER_ERROR'
    | 'INVALID_TOPIC';
  detail?: string;
}

export type ExtractResult = ExtractSuccess | ExtractFailure;

/**
 * Returns true when the gateway is wired up + a key is configured.
 * Call sites should check this before invoking `extractWizardStepDelta()`
 * and fall back to a text-only entry path when false.
 */
export function isOnboardingAgentAvailable(): boolean {
  return isAnthropicConfigured();
}

export async function extractWizardStepDelta(
  req: ExtractRequest,
): Promise<ExtractResult> {
  if (!isAnthropicConfigured()) {
    return { ok: false, reason: 'ANTHROPIC_NOT_CONFIGURED' };
  }

  if (req.topic !== 'household') {
    // v1 supports the household topic only. Future topics expand here.
    return { ok: false, reason: 'INVALID_TOPIC', detail: `topic=${req.topic}` };
  }

  const client = getAnthropicClient();
  const model = ANTHROPIC_MODELS.HAIKU;

  // Compose the user-side message. The prompt body is a structured
  // brief — current staged subset + recent transcript + the latest
  // user message. The system prompt lives in the system parameter
  // (Anthropic API convention).
  const userPrompt = buildUserPrompt(req);

  try {
    // Cast through `as never` because the Anthropic SDK's
    // narrow types for tools/tool_choice vary by version and we
    // don't want a brittle type assertion at every call site.
    // The shape sent here matches Anthropic's documented messages
    // API for tool use.
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system: HOUSEHOLD_SYSTEM_PROMPT,
      tools: [householdExtractTool] as never,
      tool_choice: {
        type: 'tool',
        name: EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME,
      } as never,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (!toolUseBlock || toolUseBlock.name !== EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME) {
      return { ok: false, reason: 'NO_TOOL_USE' };
    }

    const parsed = wizardStateDeltaSchema.safeParse(toolUseBlock.input);
    if (!parsed.success) {
      return {
        ok: false,
        reason: 'SCHEMA_VIOLATION',
        detail: parsed.error.message.slice(0, 240),
      };
    }

    return {
      ok: true,
      delta: parsed.data,
      model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'PROVIDER_ERROR',
      detail: err instanceof Error ? err.message.slice(0, 240) : 'unknown',
    };
  }
}

function buildUserPrompt(req: ExtractRequest): string {
  const transcriptLines = req.recentTranscript
    .slice(-4)
    .map((t) => `${t.role}: ${t.text}`)
    .join('\n');

  // We pass field NAMES of what's already staged (not values). The
  // LLM uses this to avoid re-emitting fields the user has already
  // confirmed; we don't need to ship balances or other CDR-shaped
  // content into the prompt for the household topic, but the
  // discipline applies uniformly: only metadata, never values.
  const stagedFieldNames = Object.entries(req.currentStateSubset)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}(count=${v.length})`;
      return k;
    })
    .join(', ');

  return [
    `Topic: household`,
    `Already staged for this topic: ${stagedFieldNames || '(nothing yet)'}`,
    transcriptLines.length > 0 ? `Recent transcript:\n${transcriptLines}` : '',
    `User's latest message: ${req.userMessage}`,
    ``,
    `Extract what the user said into the tool's structured shape. Numbers from the user only; if the user did not state a value, list the field name in "unresolved".`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
