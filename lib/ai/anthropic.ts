/**
 * Anthropic Claude API — server-side client.
 *
 * Phase 33g.2 (2026-05-10): first Anthropic dep in the codebase. Used by
 * the live AI feedback chat triage (`lib/services/feedbackService.ts`) and
 * the onboarding conversational agent (`lib/ai/onboarding-agent/gateway.ts`,
 * Phase 12 Track E). In-app financial advice continues to flow through
 * Gemini (`lib/ai/gemini.ts`).
 *
 * Why a different model for feedback triage:
 *   - Conversational quality / clarification-question quality is Claude's strength
 *   - Gemini is wired into the AFSL-bounded financial advice surface — keeping
 *     them physically separated avoids accidental cross-contamination of
 *     system prompts, rate-limit budgets, and audit metadata
 *
 * Cost-control posture (CLAUDE.md §12.7 + cost-control runbook §4):
 *   - Feedback triage: claude-haiku-4-5 (Haiku 4.5) — cheap + fast
 *   - Onboarding agent: claude-sonnet-4-6 (Sonnet 4.6) — forced structured
 *     extraction needs a model that reliably produces schema-valid tool
 *     calls; Haiku does not. Onboarding is once-per-user + capped.
 *   - Hard env cap set at console.anthropic.com → Settings → Limits → US$50/mo
 *   - Graceful disable: when ANTHROPIC_API_KEY is absent, every call site
 *     falls back to non-AI behaviour (form-only feedback drawer, etc.)
 *   - All calls audit with token counts in metadata (FEEDBACK_AI_REPLIED)
 *
 * CDR boundary (CLAUDE.md §13.3):
 *   - This client NEVER receives CDR data. Callers may only pass
 *     conversation text + system prompts authored by Monitrax.
 *   - Reviewers reject any caller that wires user snapshot data into a
 *     prompt without an explicit consent flow.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let cachedClient: Anthropic | null = null;

export const ANTHROPIC_MODELS = {
  /** Cheap conversational triage. Default for feedback chat. */
  HAIKU: 'claude-haiku-4-5' as const,
  /**
   * Mid-tier — strong, reliable structured tool-call extraction at a
   * fraction of Opus cost. Used by the onboarding conversational agent
   * (`lib/ai/onboarding-agent/gateway.ts`): that surface FORCES a tool
   * call and validates the result against a strict Zod schema. Haiku
   * does not do that reliably — it frequently emits output the schema
   * rejects, surfacing to the user as "Could not understand the answer."
   * Sonnet handles forced structured extraction dependably. Onboarding
   * is once-per-user and capped (200 extractions/user/day) so the cost
   * delta over Haiku is negligible.
   */
  SONNET: 'claude-sonnet-4-6' as const,
  /** Reserved for synthesis-summary work. NEVER for per-message replies. */
  OPUS: 'claude-opus-4-7' as const,
} as const;

/**
 * True when ANTHROPIC_API_KEY is configured. Server-side only — call sites
 * must check this before invoking any client method, and gracefully fall
 * back when false. The consumer feedback drawer uses this to switch
 * between chat-style (AI on) and form-only (AI off).
 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Get a singleton Anthropic client. Throws when key is absent — call
 * `isAnthropicConfigured()` first.
 */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY missing — call isAnthropicConfigured() before getAnthropicClient()',
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return cachedClient;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicCompletionResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Generate a single text completion. Caller passes the system prompt
 * separately (Anthropic's API model). Returns text + cost-tracking
 * metadata so audit log entries carry token counts for spend attribution.
 */
export async function generateAnthropicCompletion(opts: {
  system: string;
  messages: AnthropicMessage[];
  model?: keyof typeof ANTHROPIC_MODELS;
  maxTokens?: number;
}): Promise<AnthropicCompletionResult> {
  const client = getAnthropicClient();
  const modelId = ANTHROPIC_MODELS[opts.model ?? 'HAIKU'];
  const response = await client.messages.create({
    model: modelId,
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 600,
  });

  // Anthropic returns content as an array of blocks; we only use text.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return {
    text,
    model: modelId,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  };
}
