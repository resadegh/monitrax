/**
 * Onboarding companion gateway — Phase 12 Track G (G.0).
 *
 * A SEPARATE concern from the extraction gateway in this folder:
 *   - gateway.ts           → forced structured tool-call EXTRACTION
 *   - companionGateway.ts  → THIS FILE, freeform warm REFLECTION
 *
 * The companion reads a minimal, de-identified snapshot of what the user
 * has entered on the current onboarding step and returns a short, warm,
 * advice-free reflection. It is a GUIDE, not an adviser (AFSL boundary):
 * it reflects, normalises, encourages, and explains the product — it
 * NEVER gives financial advice, tax tips, or investment opinions.
 *
 * See docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §5.
 */

import 'server-only';
import {
  generateAnthropicCompletion,
  isAnthropicConfigured,
} from '@/lib/ai/anthropic';

/** Steps the companion supports. G.0 = household only; G.1 widens this. */
export type CompanionStep = 'household';

/**
 * A minimal, de-identified snapshot of the user's entries for one step.
 * COUNTS / ROLES / FLAGS ONLY — never names, never balances, never CDR
 * values. The warm reflection does not need PII to be warm, and keeping
 * the snapshot count-only minimises the data-egress surface to Anthropic.
 */
export type CompanionSnapshot = Record<string, number | boolean>;

export interface CompanionReflectionRequest {
  step: CompanionStep;
  snapshot: CompanionSnapshot;
}

export type CompanionResult =
  | {
      ok: true;
      message: string;
      model: string;
      tokensIn: number;
      tokensOut: number;
    }
  | {
      ok: false;
      reason: 'ANTHROPIC_NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'EMPTY';
      detail?: string;
    };

/**
 * True when the companion can make an LLM call. Call sites check this and
 * fall back to the scripted intro (the companion is never a dependency).
 */
export function isCompanionAvailable(): boolean {
  return isAnthropicConfigured();
}

const COMPANION_SYSTEM_PROMPT = `You are the Monitrax onboarding companion — a warm, calm guide who sits beside an Australian user as they set up their personal finance dashboard, one step at a time.

Your job: read what the user has just entered on the current step and reflect it back in a way that makes a dry form feel human — acknowledge it, normalise it, and encourage them.

STRICT RULES — these are not optional:
- Reply with 1-2 short sentences. No greeting, no sign-off, no lists, no markdown.
- Use ONLY the facts in the snapshot you are given. Never invent or estimate a number or detail.
- You are a GUIDE, not a financial adviser. NEVER give financial advice, tax tips, investment opinions, or "you should…" recommendations about money. Reflecting, encouraging and explaining the product is your whole job.
- Never judge or shame. Every household and situation is normal — normalise warmly.
- Celebrate the small win of the user making progress.
- Australian English. Say "spending" not "expenses", "home" not "PPOR". Plain, warm, specific.
- If the snapshot shows nothing entered yet, gently encourage them to add their first entry.`;

const STEP_BRIEF: Record<CompanionStep, string> = {
  household:
    'The user is on the "Household" step — capturing the people and pets who share their financial life. This is the foundation the rest of setup is personalised around.',
};

function buildUserPrompt(req: CompanionReflectionRequest): string {
  const lines = Object.entries(req.snapshot)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return [
    STEP_BRIEF[req.step],
    `What the user has entered so far (counts only):\n${lines || '- (nothing yet)'}`,
    'Write your 1-2 sentence reflection now.',
  ].join('\n\n');
}

/**
 * Generate a warm, advice-free reflection of the user's current-step
 * entries. Returns a structured result; the caller renders `message` on
 * success and silently keeps the scripted intro on any failure.
 */
export async function generateCompanionReflection(
  req: CompanionReflectionRequest,
): Promise<CompanionResult> {
  if (!isAnthropicConfigured()) {
    return { ok: false, reason: 'ANTHROPIC_NOT_CONFIGURED' };
  }

  try {
    const result = await generateAnthropicCompletion({
      system: COMPANION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(req) }],
      model: 'HAIKU',
      maxTokens: 160,
    });
    const message = result.text.trim();
    if (!message) {
      return { ok: false, reason: 'EMPTY' };
    }
    return {
      ok: true,
      message,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'PROVIDER_ERROR',
      detail: err instanceof Error ? err.message.slice(0, 240) : 'unknown',
    };
  }
}
