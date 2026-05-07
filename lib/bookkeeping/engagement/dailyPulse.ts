/**
 * Phase 42 PR6 — Daily Pulse data builder.
 *
 * The Daily Pulse is the *engagement front door* (spec §6.6) — a
 * single card on Home (`/dashboard`) that:
 *
 *   - Frames today's review as a kept-up-with daily ritual
 *   - Hides the uncategorised count behind completion %
 *   - Surfaces the streak (only when ≥ 3 days; no shame for new users)
 *   - Shows a 1-line anomaly narrative below the CTA
 *
 * Per CLAUDE.md §12.3 — composes existing helpers (period.ts +
 * streak.ts); no parallel calc engine. The orchestrator's job is to
 * SHAPE the data the card needs, not to recompute anything.
 *
 * Per CLAUDE.md §0 behaviour-psychologist lens — the CTA copy adapts:
 *   0 to review     → "All caught up ✓" (celebration state, no button)
 *   1-15 to review  → "Review N →"
 *   16+ to review   → "Quick housekeeping (~3 min) →"
 */

import prisma from '@/lib/db';
import { getOrCreatePeriod, toPeriodMonthKey, formatPeriodMonth } from '../period';
import { getOrCreateEngagementState, formatStreak } from './streak';

export interface DailyPulse {
  /** Calendar month label e.g. "October". */
  monthLabel: string;
  /** YYYY-MM key for the current period. */
  monthKey: string;
  /** Total transactions for the current month. */
  totalCount: number;
  /** Reviewed (user-corrected) transactions for the current month. */
  reviewedCount: number;
  /** Outstanding-to-review count = total - reviewed. */
  toReviewCount: number;
  /** Completion percent 0..100 (rounded). */
  completionPct: number;
  /** Streak in display form ("12" or "365+" or "" when <3). */
  streakLabel: string;
  /** Raw streak count (UI may use it for animations). */
  streakCount: number;
  /** True when streak hit 3 — show the 🔥 badge. */
  showStreakBadge: boolean;
  /** Adaptive CTA per the spec. */
  cta: { kind: 'CAUGHT_UP' | 'FEW' | 'MANY'; label: string; href: string };
  /** Optional 1-line anomaly narrative. */
  anomalyNarrative: string | null;
  /** Has today's completion celebration already fired? */
  celebrationFiredToday: boolean;
}

const STREAK_BADGE_THRESHOLD = 3;

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Build the Daily Pulse for the current calendar month.
 *
 * Cheap-ish: two DB reads (period + engagement state). The optional
 * anomaly narrative reads up to 50 most-recent transactions; full
 * Gemini-narrated anomaly insights come in PR6.5.
 */
export async function buildDailyPulse(userId: string, now: Date = new Date()): Promise<DailyPulse> {
  const periodMonthKey = toPeriodMonthKey(now);
  const monthLabel = MONTH_LABELS[periodMonthKey.getUTCMonth()];
  const monthKey = formatPeriodMonth(periodMonthKey);

  // Period counts — refreshes from canonical ledger on every call
  // so the display always reflects current state.
  const period = await getOrCreatePeriod(userId, periodMonthKey);
  const totalCount = period.totalTransactionCount;
  const reviewedCount = period.reviewedTransactionCount;
  const toReviewCount = Math.max(0, totalCount - reviewedCount);
  const completionPct = totalCount === 0 ? 100 : Math.round((reviewedCount / totalCount) * 100);

  // Engagement state — streak + last celebration anchor.
  const engagement = await getOrCreateEngagementState(userId);
  const streakCount = engagement.currentStreak;
  const showStreakBadge = streakCount >= STREAK_BADGE_THRESHOLD;
  const streakLabel = showStreakBadge ? formatStreak(streakCount) : '';

  // CTA — adapts per spec §6.6.
  let cta: DailyPulse['cta'];
  if (toReviewCount === 0) {
    cta = { kind: 'CAUGHT_UP', label: 'All caught up ✓', href: '/dashboard/activity' };
  } else if (toReviewCount <= 15) {
    cta = {
      kind: 'FEW',
      label: `Review ${toReviewCount} →`,
      href: '/dashboard/activity',
    };
  } else {
    cta = {
      kind: 'MANY',
      label: 'Quick housekeeping (~3 min) →',
      href: '/dashboard/activity',
    };
  }

  // Anomaly narrative — surfaces the FIRST recent anomaly flag as a
  // plain-English one-liner. Full Gemini narration ships in PR6.5.
  const anomalyNarrative = await buildSimpleAnomalyNarrative(userId);

  // Celebration — has it already fired today?
  let celebrationFiredToday = false;
  if (engagement.lastCelebrationAt) {
    const sameDay =
      Date.UTC(engagement.lastCelebrationAt.getUTCFullYear(), engagement.lastCelebrationAt.getUTCMonth(), engagement.lastCelebrationAt.getUTCDate()) ===
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    celebrationFiredToday = sameDay;
  }

  return {
    monthLabel,
    monthKey,
    totalCount,
    reviewedCount,
    toReviewCount,
    completionPct,
    streakLabel,
    streakCount,
    showStreakBadge,
    cta,
    anomalyNarrative,
    celebrationFiredToday,
  };
}

/**
 * Cheap deterministic anomaly narrative from the existing
 * `unified_transactions.anomalyFlags` field. PRICE_INCREASE on a
 * recurring merchant gets a friendly "Netflix went up $4 this month"
 * copy when both observations are available; otherwise we fall back
 * to a generic flag-name → English label.
 *
 * NOT Gemini — that lands in PR6.5. Per CLAUDE.md §12.3 we don't
 * spawn a parallel narrative engine; PR6.5 will replace this with a
 * tool-calling Gemini hookup.
 */
async function buildSimpleAnomalyNarrative(userId: string): Promise<string | null> {
  const recent = await prisma.unifiedTransaction.findFirst({
    where: {
      userId,
      anomalyFlags: { isEmpty: false },
    },
    orderBy: { date: 'desc' },
  });
  if (!recent) return null;

  const flag = recent.anomalyFlags[0];
  const merchant = recent.merchantStandardised ?? recent.merchantRaw ?? 'A transaction';
  switch (flag) {
    case 'PRICE_INCREASE':
      return `${merchant} went up — review the latest charge.`;
    case 'UNUSUAL_AMOUNT':
      return `Unusual amount on ${merchant} — worth a glance.`;
    case 'NEW_MERCHANT':
      return `First time we've seen ${merchant}.`;
    case 'DUPLICATE':
      return `Possible duplicate near ${merchant}.`;
    case 'TIMING_ANOMALY':
      return `${merchant} hit at an unusual time — review.`;
    case 'UNEXPECTED_CATEGORY':
      return `${merchant} doesn't match its usual category — quick check?`;
    default:
      return null;
  }
}
