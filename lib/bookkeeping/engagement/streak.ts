/**
 * Phase 42 PR6 — Streak state machine.
 *
 * Per Phase 42 spec §6.4 ("Streak system — Duolingo-style with humanity"),
 * the rules are:
 *
 *   - Earn a day: review ≥1 transaction in a 24h rolling window
 *   - Streak shield: one missed day per 7-day window doesn't break the
 *     streak (avoids the all-or-nothing collapse that kills habits)
 *   - Recovery: a broken streak's "next day's first action restores
 *     50% credit" (we floor to nearest int)
 *   - Cap visible at 365+
 *
 * Per CLAUDE.md §12.3 — single calculation engine. Every "the user
 * touched a transaction" event in the app calls `touchStreak()` here.
 * No parallel streak logic anywhere else. Per CLAUDE.md §0
 * behaviour-psychologist lens — the shield mechanic is the whole
 * point; if a future PR tries to remove it, reviewers MUST reject.
 *
 * Pure-ish: the state transitions are computed deterministically by
 * `computeNextStreakState()` (testable in isolation), then persisted
 * by `touchStreak()`.
 */

import prisma from '@/lib/db';
import type { EngagementState } from '@prisma/client';

/** Rolling-window length for the shield mechanic. */
export const STREAK_SHIELD_WINDOW_DAYS = 7;

/** Visible cap; beyond this the UI shows "365+". */
export const STREAK_VISIBLE_CAP = 365;

/** Restoration credit — fraction of the broken streak we restore on next-day touch. */
export const STREAK_RESTORATION_FRACTION = 0.5;

export interface StreakStateInput {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  lastShieldUsedAt: Date | null;
}

export interface StreakStateOutput {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  lastShieldUsedAt: Date | null;
  /** Why the streak changed — used by UI copy + the celebration trigger. */
  transition:
    | 'NEW_STREAK'      // first activity ever
    | 'EXTENDED'         // consecutive day; +1 streak
    | 'SAME_DAY'         // already touched today; no-op
    | 'SHIELD_USED'      // 1 day gap, shield burned, streak preserved
    | 'BROKEN_AND_RESTORED' // gap >1 day OR shield already used; restored to 50%
    | 'BROKEN'           // first miss after restoration; resets to 1
    | 'RESET_AFTER_LONG_GAP'; // very long gap; treat as fresh start
  /** True when the streak transitioned to a new personal best. */
  isPersonalBest: boolean;
}

/**
 * UTC-midnight day key — strips time-of-day so two events on the same
 * calendar day collapse to the same value.
 */
function dayKey(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Days difference (calendar-day, UTC). Same as the receipt matcher's
 * `daysBetween` but inlined here to avoid cross-module dep.
 */
export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.abs(dayKey(a) - dayKey(b)) / (1000 * 60 * 60 * 24);
}

/**
 * Pure state-transition function. Computes the next streak state
 * given the current state + a "touch" timestamp (typically `new Date()`
 * for live calls; injectable for tests).
 *
 * Decision tree:
 *   1. No prior activity → NEW_STREAK = 1
 *   2. Same calendar day → SAME_DAY no-op
 *   3. Gap = 1 day → EXTENDED + 1
 *   4. Gap = 2 days AND no shield used in current rolling window →
 *      SHIELD_USED, streak preserved + lastShieldUsedAt set
 *   5. Gap > 2 days, OR gap = 2 with shield burned →
 *      BROKEN_AND_RESTORED to floor(prev * STREAK_RESTORATION_FRACTION)
 *      OR fresh = 1 if prev was 1
 *   6. Gap > 30 days (long absence) → RESET_AFTER_LONG_GAP = 1
 */
export function computeNextStreakState(
  prev: StreakStateInput,
  now: Date = new Date()
): StreakStateOutput {
  // Case 1 — first activity
  if (!prev.lastActiveDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(prev.longestStreak, 1),
      lastActiveDate: now,
      lastShieldUsedAt: null,
      transition: 'NEW_STREAK',
      isPersonalBest: 1 > prev.longestStreak,
    };
  }

  const gapDays = calendarDaysBetween(prev.lastActiveDate, now);

  // Case 2 — same calendar day
  if (gapDays === 0) {
    return {
      currentStreak: prev.currentStreak,
      longestStreak: prev.longestStreak,
      lastActiveDate: now,
      lastShieldUsedAt: prev.lastShieldUsedAt,
      transition: 'SAME_DAY',
      isPersonalBest: false,
    };
  }

  // Case 6 — long absence (> 30 days), reset entirely
  if (gapDays > 30) {
    return {
      currentStreak: 1,
      longestStreak: prev.longestStreak,
      lastActiveDate: now,
      lastShieldUsedAt: null,
      transition: 'RESET_AFTER_LONG_GAP',
      isPersonalBest: false,
    };
  }

  // Case 3 — exact next day
  if (gapDays === 1) {
    const next = prev.currentStreak + 1;
    return {
      currentStreak: next,
      longestStreak: Math.max(prev.longestStreak, next),
      lastActiveDate: now,
      lastShieldUsedAt: prev.lastShieldUsedAt,
      transition: 'EXTENDED',
      isPersonalBest: next > prev.longestStreak,
    };
  }

  // Case 4 — gap of 2 days; consider the shield
  if (gapDays === 2) {
    const shieldAvailable = isShieldAvailable(prev.lastShieldUsedAt, now);
    if (shieldAvailable) {
      const next = prev.currentStreak + 1;
      return {
        currentStreak: next,
        longestStreak: Math.max(prev.longestStreak, next),
        lastActiveDate: now,
        lastShieldUsedAt: now,
        transition: 'SHIELD_USED',
        isPersonalBest: next > prev.longestStreak,
      };
    }
    // Shield burned — fall through to case 5
  }

  // Case 5 — broken; restore to 50% of previous (floor; min 1)
  const restored = Math.max(1, Math.floor(prev.currentStreak * STREAK_RESTORATION_FRACTION));
  // If the previous streak was already 1, "restored to 1" is the
  // same as "fresh" — surface as BROKEN rather than BROKEN_AND_RESTORED
  // so UI copy doesn't show a celebratory "we restored!" for a no-op.
  const wasMeaningfulStreak = prev.currentStreak > 1;
  return {
    currentStreak: restored,
    longestStreak: prev.longestStreak, // never increases on breakage
    lastActiveDate: now,
    lastShieldUsedAt: null, // reset shield window
    transition: wasMeaningfulStreak ? 'BROKEN_AND_RESTORED' : 'BROKEN',
    isPersonalBest: false,
  };
}

/**
 * Is the shield available right now? True when no shield has been
 * used yet OR the last shield use is older than STREAK_SHIELD_WINDOW_DAYS.
 */
export function isShieldAvailable(lastShieldUsedAt: Date | null, now: Date): boolean {
  if (!lastShieldUsedAt) return true;
  const ageDays = calendarDaysBetween(lastShieldUsedAt, now);
  return ageDays >= STREAK_SHIELD_WINDOW_DAYS;
}

/**
 * Format the streak count for display. Caps at "365+" per spec §6.4.
 */
export function formatStreak(count: number): string {
  if (count >= STREAK_VISIBLE_CAP) return `${STREAK_VISIBLE_CAP}+`;
  return String(count);
}

// =============================================================================
// DB-touching surface
// =============================================================================

/**
 * Get-or-create the user's EngagementState row. Idempotent.
 */
export async function getOrCreateEngagementState(userId: string): Promise<EngagementState> {
  const existing = await prisma.engagementState.findUnique({
    where: { userId },
  });
  if (existing) return existing;
  // Race-tolerant — concurrent touches collapse here.
  try {
    return await prisma.engagementState.create({
      data: { userId },
    });
  } catch {
    const winner = await prisma.engagementState.findUnique({ where: { userId } });
    if (winner) return winner;
    throw new Error(`Failed to get-or-create EngagementState for user ${userId}`);
  }
}

/**
 * Touch the user's streak. Idempotent on the same calendar day.
 * Composes `computeNextStreakState` (pure) → persists.
 *
 * Called fire-and-forget from every categorisation mutation path —
 * `[id]` PATCH, `bulk-categorise`, cash quick-add, splits replace.
 * Per CLAUDE.md §12.10 audit-style fire-and-forget: a streak failure
 * NEVER breaks the calling mutation.
 */
export async function touchStreak(userId: string, now: Date = new Date()): Promise<EngagementState> {
  const state = await getOrCreateEngagementState(userId);
  const next = computeNextStreakState(
    {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate,
      lastShieldUsedAt: state.lastShieldUsedAt,
    },
    now
  );

  // Skip the DB round-trip on SAME_DAY no-ops.
  if (next.transition === 'SAME_DAY' && state.lastActiveDate) {
    return state;
  }

  return prisma.engagementState.update({
    where: { userId },
    data: {
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastActiveDate: next.lastActiveDate,
      lastShieldUsedAt: next.lastShieldUsedAt,
      totalCategorisations: { increment: 1 },
    },
  });
}

/**
 * Mark the completion celebration as shown today. Returns `true` when
 * the celebration is allowed to fire (i.e. it hasn't already fired
 * today). Per spec §6.5 — confetti once per day max; scarcity
 * preserves the delight.
 */
export async function tryFireCelebration(userId: string, now: Date = new Date()): Promise<boolean> {
  const state = await getOrCreateEngagementState(userId);
  if (state.lastCelebrationAt) {
    const same = calendarDaysBetween(state.lastCelebrationAt, now) === 0;
    if (same) return false;
  }
  await prisma.engagementState.update({
    where: { userId },
    data: { lastCelebrationAt: now },
  });
  return true;
}

export type { EngagementState };
