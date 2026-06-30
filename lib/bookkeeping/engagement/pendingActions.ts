/**
 * Phase 42 PR6.5b — Pending-actions aggregator + once-per-day gate.
 *
 * Per Reza idea 2026-05-07: *"have the transaction reconciliation and
 * categorisation be popup when user login to be completed"* /
 * *"something like a pending actions popup at first login?"*
 *
 * The popup is the *engagement front door at the right moment*: it
 * fires once per calendar day, on the first dashboard render, and
 * surfaces at most three concrete actions the user can take in 5
 * seconds. Per CLAUDE.md §0 behaviour-psychologist lens —
 * pending-actions framing, NOT categorise-only; three actions max
 * (Hick's Law) with snooze ("Not today") + opt-out ("Don't show me
 * this again") so we never feel like a nag.
 *
 * Per CLAUDE.md §12.3 — composes existing canonical sources:
 *   - `getOrCreatePeriod()` for uncategorised count
 *   - `prisma.unifiedTransaction` for anomaly count
 *   - `prisma.recurringPayment` for unmatched-recurring count
 *   - `prisma.document` for unmatched-receipt count
 * No parallel calc engine; no new aggregator with new math.
 *
 * Per CLAUDE.md §0 designer lens — the popup hides itself the
 * moment there is nothing to do (`actions.length === 0` → don't
 * render). A user with a clean inbox should never see it.
 */

import prisma from '@/lib/db';
import { toPeriodMonthKey } from '../period';
import { getOrCreateEngagementState } from './streak';
import { getReviewQueueCount } from '@/lib/bank/bulkConfirm';

/**
 * Action kinds, ordered by descending priority. The aggregator
 * returns at most three; the popup renders them in this order.
 */
export type PendingActionKind =
  | 'CATEGORISE'    // Highest — drives tax-pack accuracy + Daily Pulse
  | 'ANOMALY'       // High — surfaces things the user should look at
  | 'RECURRING'     // Medium — confirm or skip detected subscriptions
  | 'RECEIPT';      // Low — polish; receipts pending confirm

export interface PendingAction {
  kind: PendingActionKind;
  /** Plain-English label. */
  label: string;
  /** Tappable destination. */
  href: string;
  /** Numeric badge for the action chip; ≥1 always. */
  count: number;
}

export interface PendingActionsResult {
  /** Up to 3 actions, in priority order. */
  actions: PendingAction[];
  /** Sum of all counts (used by the popup header copy). */
  totalCount: number;
  /**
   * Has the popup been shown to this user today already? Caller
   * uses this + `optedOut` to decide whether to render.
   */
  alreadyShownToday: boolean;
  /** Has the user globally opted out? */
  optedOut: boolean;
}

/** Hard cap on the number of actions shown — Hick's Law / spec §6.6. */
export const PENDING_ACTIONS_CAP = 3;

// Phase 56.3 (Reza 2026-06-30) — the 60-day `CATEGORISE_TRAILING_DAYS` window
// is RETIRED. "Needs your review" is now ALL-TIME and computed by the single
// SSOT `lib/bank/bulkConfirm.ts` (`getReviewQueueCount`), so the Home
// hero, the Activity headline + bands, and the card-deck all show one number.
// (Supersedes the 2026-05-08 trailing-window decision.)

/**
 * Build the pending-actions payload for the current calendar day.
 * Cheap-ish: 1 period read (engagement state) + 4 count queries,
 * all bounded by `userId` index scans.
 */
export async function buildPendingActions(
  userId: string,
  now: Date = new Date()
): Promise<PendingActionsResult> {
  const monthKey = toPeriodMonthKey(now);

  const [
    engagement,
    uncategorisedCount,
    anomalyCount,
    unmatchedRecurringCount,
    pendingReceiptCount,
  ] = await Promise.all([
    getOrCreateEngagementState(userId),
    // Count what the user can SEE as Uncategorised on Activity.
    // CRITICAL — this MUST match the Activity page's "uncategorized=true"
    // filter EXACTLY (see app/api/unified-transactions/route.ts:84):
    //   - no expense/income/loan link
    //   - not a transfer (matches false OR null — legacy rows)
    //   - not an investment contribution (same nullable-handling)
    //
    // The 2026-05-08 Reza-reported "badge always 0" bug came from
    // filtering on `categoryLevel1 IS NULL OR ''` instead of the
    // link-status semantics. BASIQ-auto-categorised tx have a
    // non-null `categoryLevel1` (e.g. "Food & Dining") AND no
    // linked Expense — they appear in the user's "uncategorised
    // first" filter but were missed by the categoryLevel1-only
    // check. The Activity filter is the SSOT for "what does the
    // user think is uncategorised."
    // Phase 56.3 (Reza 2026-06-30) — the CATEGORISE count now reads the ONE
    // canonical SSOT (`lib/bank/bulkConfirm.ts`), ALL-TIME (the 60-day
    // window is dropped per Reza: "anything the user hasn't confirmed, all
    // time"). This makes the Home hero number EQUAL the Activity headline +
    // the card-deck — fixing the "78 (60d) vs 365 (all-time)" divergence.
    getReviewQueueCount(userId),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        date: { gte: monthKey },
        anomalyFlags: { isEmpty: false },
      },
    }),
    prisma.recurringPayment.count({
      where: {
        userId,
        isActive: true,
        matchStatus: 'UNMATCHED',
      },
    }),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        source: 'RECEIPT',
        OR: [{ categoryLevel1: null }, { categoryLevel1: '' }],
      },
    }),
  ]);

  const candidates: PendingAction[] = [];

  if (uncategorisedCount > 0) {
    candidates.push({
      kind: 'CATEGORISE',
      label: actionLabel('CATEGORISE', uncategorisedCount),
      // Phase 56.3 — "Fix now" opens the card-deck review (the new design),
      // not just the list. The Activity page reads `?review=1` to auto-open it.
      href: '/dashboard/activity?review=1',
      count: uncategorisedCount,
    });
  }
  if (anomalyCount > 0) {
    candidates.push({
      kind: 'ANOMALY',
      label: actionLabel('ANOMALY', anomalyCount),
      href: '/dashboard/activity?filter=anomalies',
      count: anomalyCount,
    });
  }
  if (unmatchedRecurringCount > 0) {
    candidates.push({
      kind: 'RECURRING',
      label: actionLabel('RECURRING', unmatchedRecurringCount),
      href: '/dashboard/activity?filter=recurring',
      count: unmatchedRecurringCount,
    });
  }
  if (pendingReceiptCount > 0) {
    candidates.push({
      kind: 'RECEIPT',
      label: actionLabel('RECEIPT', pendingReceiptCount),
      href: '/dashboard/documents',
      count: pendingReceiptCount,
    });
  }

  const actions = candidates.slice(0, PENDING_ACTIONS_CAP);
  const totalCount = actions.reduce((sum, a) => sum + a.count, 0);

  return {
    actions,
    totalCount,
    alreadyShownToday: isSameUtcDay(engagement.lastPromptShownAt, now),
    optedOut: engagement.promptOptedOut,
  };
}

/**
 * Pure-function gate. The popup should fire when:
 *   - The user has NOT opted out
 *   - The popup has not been shown today
 *   - There is at least one action to surface
 *
 * Snooze ("Not today") is recorded as `lastPromptDismissedAt`; the
 * gate is shared between Shown and Dismissed by checking the
 * UTC-day equality of either timestamp.
 */
export function shouldShowPromptToday(
  state: {
    promptOptedOut: boolean;
    lastPromptShownAt: Date | null;
    lastPromptDismissedAt: Date | null;
  },
  totalActionCount: number,
  now: Date = new Date()
): boolean {
  if (state.promptOptedOut) return false;
  if (totalActionCount <= 0) return false;
  if (isSameUtcDay(state.lastPromptShownAt, now)) return false;
  if (isSameUtcDay(state.lastPromptDismissedAt, now)) return false;
  return true;
}

/** Mark the popup as shown today (idempotent — second call same day no-ops). */
export async function markPromptShown(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.engagementState.update({
    where: { userId },
    data: { lastPromptShownAt: now },
  });
}

/** Snooze for the rest of today. Resurfaces tomorrow. */
export async function dismissPromptForToday(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.engagementState.update({
    where: { userId },
    data: { lastPromptDismissedAt: now },
  });
}

/** Opt out globally. User can re-enable in settings later. */
export async function optOutOfPrompt(userId: string): Promise<void> {
  await prisma.engagementState.update({
    where: { userId },
    data: { promptOptedOut: true },
  });
}

function actionLabel(kind: PendingActionKind, count: number): string {
  switch (kind) {
    case 'CATEGORISE':
      return count === 1 ? '1 transaction to categorise' : `${count} transactions to categorise`;
    case 'ANOMALY':
      return count === 1 ? '1 unusual charge worth a glance' : `${count} unusual charges worth a glance`;
    case 'RECURRING':
      return count === 1 ? '1 possible subscription to confirm' : `${count} possible subscriptions to confirm`;
    case 'RECEIPT':
      return count === 1 ? '1 receipt to file' : `${count} receipts to file`;
  }
}

function isSameUtcDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
