/**
 * Phase 42 PR 6.5d — Gemini-narrated anomaly summary for Daily Pulse.
 *
 * Replaces the hard-coded `buildSimpleAnomalyNarrative()` switch in
 * `dailyPulse.ts` with a tool-style flow:
 *
 *   1. Pull the top N recent flagged anomalies for the user.
 *   2. Build a deterministic, citation-safe input shape — merchant,
 *      anomaly type, magnitude, date — strictly aggregated, no PII.
 *   3. Hand to Claude Haiku 4.5 (Phase 33g.2 client, US$50/mo cap)
 *      with a strict system prompt instructing it to produce ONE
 *      warm 1-line narrative. No advice verbs, no recommendations.
 *   4. Fall back to the deterministic mapper when AI isn't configured
 *      or the call fails. Surface is never empty.
 *
 * **Why this lives in `lib/bookkeeping/engagement/` not `lib/ai/`:**
 * the narrative is a Daily Pulse engagement feature; the AI dependency
 * is incidental and graceful (works without it). Keeping it close to
 * its only consumer makes the dependency easy to trace.
 *
 * **CDR boundary (CLAUDE.md §13.3):** The deterministic input shape
 * passed to the LLM contains merchant strings + amounts + dates only.
 * NO account numbers, NO BSBs, NO transaction descriptions, NO payee
 * details beyond the normalised merchant name. Pass `sanitizeForLLM()`
 * results, not raw `UnifiedTransaction` rows.
 */

import prisma from '@/lib/db';
import {
  generateAnthropicCompletion,
  isAnthropicConfigured,
  ANTHROPIC_MODELS,
} from '@/lib/ai/anthropic';

/**
 * Max anomalies to feed the LLM in a single narration request. Caps the
 * input size + cost. The LLM is asked to produce ONE 1-line narrative
 * summarising the most material item — not a list.
 */
const MAX_ANOMALIES_FED_TO_AI = 5;

const SYSTEM_PROMPT = `You narrate a user's most recent transaction anomalies in ONE warm, plain-English sentence (max 90 chars).

Hard rules (non-negotiable):
- ONE sentence. No lists. No bullet points. No emojis.
- Mention the most material anomaly. Skip the rest.
- Use the merchant name verbatim as given.
- NEVER use advice verbs: "you should", "consider", "I recommend", "review your...".
- NEVER cite dollar amounts unless they're in the provided data.
- NEVER manufacture urgency. No "now", "act fast", "before it's too late".
- Tone: a calm friend pointing at one detail. Not a fraud alert.

Examples of good output:
- "Netflix charged $4 more than last month — first time since 2024."
- "First time we've seen Bunnings on your card."
- "Looks like a duplicate hit from Telstra near Tuesday's bill."

Examples of bad output (NEVER do these):
- ❌ "URGENT: 3 anomalies need review!"
- ❌ "You should check Netflix immediately."
- ❌ "Multiple unusual transactions detected: Netflix, Bunnings, Telstra…"

Return only the sentence. No quotes, no preamble.`;

/**
 * Sanitised input passed to the LLM. Mirrors CLAUDE.md §13.3 — never
 * include raw transaction descriptions, account identifiers, or
 * payee metadata beyond the normalised merchant.
 */
interface AnomalyForNarration {
  merchant: string;
  flag: string; // PRICE_INCREASE / UNUSUAL_AMOUNT / NEW_MERCHANT / DUPLICATE / TIMING_ANOMALY / UNEXPECTED_CATEGORY / …
  amount: number;
  dateLabel: string; // "Tuesday", "2 days ago" — relative, not ISO
  prevAmount?: number; // for PRICE_INCREASE
}

/**
 * Public entry point — replaces `buildSimpleAnomalyNarrative` in
 * `dailyPulse.ts`. Returns the narration, or null if there are no
 * anomalies to narrate.
 */
export async function buildAnomalyNarrative(userId: string): Promise<string | null> {
  const candidates = await fetchRecentAnomalies(userId);
  if (candidates.length === 0) return null;

  // Cheap deterministic path — fallback when AI not configured OR fails.
  const deterministic = renderDeterministicNarrative(candidates[0]);

  if (!isAnthropicConfigured()) {
    return deterministic;
  }

  try {
    const narration = await callAnthropicForNarration(candidates);
    if (narration && narration.length > 0 && narration.length <= 200) {
      return narration;
    }
  } catch (err) {
    // Log + fall through — never block the daily pulse on AI failure.
    console.warn('[anomalyNarrator] Anthropic call failed, falling back to deterministic narrative:', err);
  }

  return deterministic;
}

async function fetchRecentAnomalies(userId: string): Promise<AnomalyForNarration[]> {
  const rows = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      anomalyFlags: { isEmpty: false },
    },
    orderBy: { date: 'desc' },
    take: MAX_ANOMALIES_FED_TO_AI,
    select: {
      merchantStandardised: true,
      merchantRaw: true,
      anomalyFlags: true,
      amount: true,
      date: true,
    },
  });

  return rows.map((r) => ({
    merchant: r.merchantStandardised ?? r.merchantRaw ?? 'A transaction',
    flag: r.anomalyFlags[0] ?? 'UNUSUAL_AMOUNT',
    amount: Math.abs(r.amount),
    dateLabel: formatRelativeDate(r.date),
  }));
}

async function callAnthropicForNarration(
  anomalies: AnomalyForNarration[],
): Promise<string | null> {
  const userMessage = [
    'Most recent anomalies (most-material first):',
    '',
    ...anomalies.map((a, i) => {
      const parts = [
        `${i + 1}. ${a.merchant}`,
        `flag: ${a.flag}`,
        `amount: $${a.amount.toFixed(2)} AUD`,
        `when: ${a.dateLabel}`,
      ];
      if (a.prevAmount !== undefined) {
        parts.push(`previous: $${a.prevAmount.toFixed(2)} AUD`);
      }
      return parts.join('  ·  ');
    }),
    '',
    'Return ONE warm 1-line narrative covering the most material item.',
  ].join('\n');

  const result = await generateAnthropicCompletion({
    model: ANTHROPIC_MODELS.HAIKU,
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 100,
  });

  return result.text.trim() || null;
}

/**
 * Deterministic 1-line narrative — the legacy fallback. Public for
 * unit-testing the shape.
 */
export function renderDeterministicNarrative(anomaly: AnomalyForNarration): string | null {
  switch (anomaly.flag) {
    case 'PRICE_INCREASE':
      return `${anomaly.merchant} went up — review the latest charge.`;
    case 'UNUSUAL_AMOUNT':
      return `Unusual amount on ${anomaly.merchant} — worth a glance.`;
    case 'NEW_MERCHANT':
      return `First time we've seen ${anomaly.merchant}.`;
    case 'DUPLICATE':
      return `Possible duplicate near ${anomaly.merchant}.`;
    case 'TIMING_ANOMALY':
      return `${anomaly.merchant} hit at an unusual time.`;
    case 'UNEXPECTED_CATEGORY':
      return `${anomaly.merchant} doesn't match its usual category.`;
    default:
      return null;
  }
}

/**
 * Relative date label suitable for the LLM ("Tuesday", "2 days ago",
 * "last week"). Never raw ISO — keeps the prompt warm + avoids
 * leaking timezone-specific metadata.
 */
function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-AU', { weekday: 'long' });
  }
  if (diffDays < 14) return 'last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
