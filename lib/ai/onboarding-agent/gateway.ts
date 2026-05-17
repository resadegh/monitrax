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
  type PropertiesFields,
} from './schemas/wizardStateDelta';
import {
  EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME,
  HOUSEHOLD_SYSTEM_PROMPT,
  PROPERTIES_SYSTEM_PROMPT,
  householdExtractTool,
  propertiesExtractTool,
} from './tools/extractWizardStepDelta';

export type SupportedTopic = 'household' | 'properties';

export type TopicStateSubset = HouseholdFields | PropertiesFields;

export interface ExtractRequest {
  topic: SupportedTopic;
  userMessage: string;
  /** State already staged for this topic — so the LLM doesn't duplicate
   *  and can position-merge (for topics with arrays like Properties). */
  currentStateSubset: TopicStateSubset;
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

  if (req.topic !== 'household' && req.topic !== 'properties') {
    // Future topics (debts, accounts, …) expand the union here.
    return { ok: false, reason: 'INVALID_TOPIC', detail: `topic=${req.topic}` };
  }

  const client = getAnthropicClient();
  const model = ANTHROPIC_MODELS.HAIKU;

  // Pick the right system prompt + tool spec per topic. Both tools
  // share the same tool NAME (the closed-discriminant pattern from
  // CLAUDE.md §12.4) — they differ only in input_schema. The system
  // prompt switches based on topic so the LLM sees the right
  // vocabulary mapping rules.
  const systemPrompt =
    req.topic === 'household' ? HOUSEHOLD_SYSTEM_PROMPT : PROPERTIES_SYSTEM_PROMPT;
  const toolSpec =
    req.topic === 'household' ? householdExtractTool : propertiesExtractTool;

  // Compose the user-side message. The prompt body is a structured
  // brief — current staged subset + recent transcript + the latest
  // user message.
  const userPrompt = buildUserPrompt(req);

  try {
    // Cast through `as never` because the Anthropic SDK's
    // narrow types for tools/tool_choice vary by version and we
    // don't want a brittle type assertion at every call site.
    // The shape sent here matches Anthropic's documented messages
    // API for tool use.
    const response = await client.messages.create({
      model,
      max_tokens: 800,
      system: systemPrompt,
      tools: [toolSpec] as never,
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

  // For HOUSEHOLD: we pass field NAMES of what's already staged so the
  // LLM avoids duplicating fields the user has already given.
  // For PROPERTIES: we pass the FULL staged properties array (including
  // numeric values the user already gave) — the LLM needs the full
  // state to do the positional-merge correctly. This is sensitive in
  // principle (chat data echoes back), but every value in
  // PropertiesFields came from the user this session — no CDR egress
  // expansion beyond what was already in the conversation.
  const stagedBlock =
    req.topic === 'household'
      ? formatStagedFieldNames(req.currentStateSubset)
      : formatStagedPropertiesState(req.currentStateSubset as PropertiesFields);

  return [
    `Topic: ${req.topic}`,
    `Already staged for this topic:\n${stagedBlock}`,
    transcriptLines.length > 0 ? `Recent transcript:\n${transcriptLines}` : '',
    `User's latest message: ${req.userMessage}`,
    ``,
    `Extract what the user said into the tool's structured shape. Numbers from the user only; if the user did not state a value, list the field name in "unresolved". For properties, echo ALL staged properties (with new fields merged into existing entries by position) and append any new ones at the end.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatStagedFieldNames(subset: TopicStateSubset): string {
  const names = Object.entries(subset)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => (Array.isArray(v) ? `${k}(count=${v.length})` : k))
    .join(', ');
  return names || '(nothing yet)';
}

function formatStagedPropertiesState(subset: PropertiesFields): string {
  const parts: string[] = [];
  if (typeof subset.ownsProperty === 'boolean') {
    parts.push(`ownsProperty: ${subset.ownsProperty}`);
  }
  if (!subset.properties || subset.properties.length === 0) {
    parts.push('properties: []');
  } else {
    parts.push('properties:');
    subset.properties.forEach((p, idx) => {
      const bits: string[] = [`name=${JSON.stringify(p.name)}`];
      if (p.type !== undefined) bits.push(`type=${p.type}`);
      if (p.currentValue !== undefined) bits.push(`currentValue=${p.currentValue}`);
      if (p.hasLoan !== undefined) bits.push(`hasLoan=${p.hasLoan}`);
      parts.push(`  [${idx}] ${bits.join(', ')}`);
    });
  }
  return parts.join('\n');
}
