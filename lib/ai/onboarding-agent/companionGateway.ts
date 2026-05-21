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

/** Steps the companion supports — welcome + the 9 entity-collection steps. */
export type CompanionStep =
  | 'welcome'
  | 'household'
  | 'entities'
  | 'properties'
  | 'debts'
  | 'accounts'
  | 'investments'
  | 'super'
  | 'assets'
  | 'income-expenses';

/** Runtime list — the route validates an incoming `step` against this. */
export const COMPANION_STEPS: readonly CompanionStep[] = [
  'welcome',
  'household',
  'entities',
  'properties',
  'debts',
  'accounts',
  'investments',
  'super',
  'assets',
  'income-expenses',
];

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

Your job: read the snapshot of what the user has entered on the current step and reply with ONE short, warm sentence that makes a dry form feel human — and that responds to what they ACTUALLY did.

HOW TO READ THE SNAPSHOT:
- Acknowledge the specific thing it shows — be concrete (a family trust, a rental property, two super funds), never generic.
- If it shows a likely GAP — e.g. a rental property with no rent recorded ("rentalsMissingRent"), an investment account with no holdings ("accountsWithoutHoldings") — gently prompt them to add that missing detail so their picture is complete. Prompting for a missing FORM FIELD is product-completeness guidance, NOT financial advice.
- If it shows nothing entered yet, gently encourage their first entry.

STRICT RULES — these are not optional:
- Reply with exactly ONE short sentence — 18 words maximum. No greeting, no sign-off, no lists, no markdown.
- Use ONLY the facts in the snapshot you are given. Never invent or estimate a number or detail.
- You are a GUIDE, not a financial adviser. NEVER give financial advice, tax tips, investment opinions, or "you should…" recommendations about money. Reflecting, encouraging, prompting for missing form fields, and explaining the product is your whole job.
- Never judge or shame. Every household and situation is normal — normalise warmly.
- Celebrate the small win of the user making progress.
- Australian English. Say "spending" not "expenses", "home" not "PPOR". Plain, warm, specific.`;

const STEP_BRIEF: Record<CompanionStep, string> = {
  welcome:
    'the "Welcome" step — the user is telling us their starting point: whether they own or rent their home, whether they hold any investments or super, and which debts they have. Their answers tailor every later step.',
  household:
    'the "Household" step — the people and pets who share the user\'s financial life. The foundation the rest of setup is personalised around.',
  entities:
    'the "Wealth Structure" step — legal entities (family trust, SMSF, company) the user holds wealth through. Holding wealth in your personal name is normal and fine.',
  properties:
    'the "Properties" step — homes and investment properties the user owns, each with its mortgage and, for a rental, the weekly rent it earns.',
  debts:
    'the "Debts" step — non-property loans: car, personal, business loans and HECS/HELP study debt.',
  accounts:
    'the "Accounts" step — the user\'s everyday bank and savings accounts.',
  investments:
    'the "Investments" step — share, ETF and managed-fund accounts and the holdings inside them.',
  super:
    'the "Superannuation" step — the user\'s super fund account(s).',
  assets:
    'the "Assets" step — personal assets like vehicles, valuables and collectibles.',
  'income-expenses':
    'the "Income & Spending" step — the user\'s income sources and regular spending: their starting budget.',
};

function buildUserPrompt(req: CompanionReflectionRequest): string {
  const lines = Object.entries(req.snapshot)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return [
    `The user is on ${STEP_BRIEF[req.step]}`,
    `What they have entered so far (counts only):\n${lines || '- (nothing yet)'}`,
    'Write your one-sentence reflection now.',
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
