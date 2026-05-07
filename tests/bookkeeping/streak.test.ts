/**
 * Phase 42 PR6 — Streak state machine tests.
 *
 * The state machine is the load-bearing engagement primitive. Per
 * spec §6.4, the rules are tight enough to test exhaustively:
 *
 *   - First activity = NEW_STREAK (1)
 *   - Same calendar day = SAME_DAY (no-op)
 *   - +1 day = EXTENDED (+1)
 *   - +2 days, no shield burned = SHIELD_USED (+1)
 *   - +2 days, shield burned = BROKEN_AND_RESTORED (50%)
 *   - +3..30 days = BROKEN_AND_RESTORED (50%) — or BROKEN if streak was 1
 *   - >30 days = RESET_AFTER_LONG_GAP (1)
 *
 * If any of these break, habits break — reviewers must reject any
 * change that breaks the shield mechanic.
 */

import { describe, it, expect } from 'vitest';
import {
  computeNextStreakState,
  isShieldAvailable,
  formatStreak,
  calendarDaysBetween,
  STREAK_VISIBLE_CAP,
  STREAK_RESTORATION_FRACTION,
  STREAK_SHIELD_WINDOW_DAYS,
} from '../../lib/bookkeeping/engagement/streak';

const day = (year: number, month: number, date: number) => new Date(Date.UTC(year, month - 1, date, 12, 0, 0));

describe('calendarDaysBetween', () => {
  it('returns 0 for the same UTC calendar day regardless of time', () => {
    expect(
      calendarDaysBetween(new Date(Date.UTC(2026, 9, 22, 8)), new Date(Date.UTC(2026, 9, 22, 23)))
    ).toBe(0);
  });
  it('returns 1 for consecutive days', () => {
    expect(calendarDaysBetween(day(2026, 10, 22), day(2026, 10, 23))).toBe(1);
  });
  it('handles a 30-day gap', () => {
    expect(calendarDaysBetween(day(2026, 10, 22), day(2026, 11, 21))).toBe(30);
  });
  it('handles month boundaries', () => {
    expect(calendarDaysBetween(day(2026, 10, 31), day(2026, 11, 1))).toBe(1);
  });
});

describe('isShieldAvailable', () => {
  it('available when never used', () => {
    expect(isShieldAvailable(null, day(2026, 10, 22))).toBe(true);
  });
  it('NOT available when used inside the 7-day window', () => {
    expect(isShieldAvailable(day(2026, 10, 22), day(2026, 10, 25))).toBe(false);
  });
  it('available again when older than the window', () => {
    expect(isShieldAvailable(day(2026, 10, 22), day(2026, 10, 29))).toBe(true);
    expect(isShieldAvailable(day(2026, 10, 22), day(2026, 10, 30))).toBe(true);
  });
});

describe('formatStreak', () => {
  it('shows raw count for low values', () => {
    expect(formatStreak(0)).toBe('0');
    expect(formatStreak(7)).toBe('7');
    expect(formatStreak(364)).toBe('364');
  });
  it('caps at "365+"', () => {
    expect(formatStreak(365)).toBe('365+');
    expect(formatStreak(1000)).toBe('365+');
  });
});

describe('computeNextStreakState', () => {
  it('first ever activity → NEW_STREAK = 1', () => {
    const r = computeNextStreakState(
      { currentStreak: 0, longestStreak: 0, lastActiveDate: null, lastShieldUsedAt: null },
      day(2026, 10, 22)
    );
    expect(r.transition).toBe('NEW_STREAK');
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.isPersonalBest).toBe(true);
  });

  it('same calendar day → SAME_DAY no-op', () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 12, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 22)
    );
    expect(r.transition).toBe('SAME_DAY');
    expect(r.currentStreak).toBe(5);
    expect(r.longestStreak).toBe(12);
  });

  it('next day → EXTENDED + 1', () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 12, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 23)
    );
    expect(r.transition).toBe('EXTENDED');
    expect(r.currentStreak).toBe(6);
  });

  it('next day past the longest → personal best flag', () => {
    const r = computeNextStreakState(
      { currentStreak: 12, longestStreak: 12, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 23)
    );
    expect(r.isPersonalBest).toBe(true);
    expect(r.longestStreak).toBe(13);
  });

  it('+2 days with shield available → SHIELD_USED, streak preserved', () => {
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 5, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 24)
    );
    expect(r.transition).toBe('SHIELD_USED');
    expect(r.currentStreak).toBe(6);
    expect(r.lastShieldUsedAt).toEqual(day(2026, 10, 24));
  });

  it('+2 days with shield burned (within 7d) → BROKEN_AND_RESTORED', () => {
    const r = computeNextStreakState(
      { currentStreak: 6, longestStreak: 6, lastActiveDate: day(2026, 10, 24), lastShieldUsedAt: day(2026, 10, 24) },
      day(2026, 10, 26)
    );
    expect(r.transition).toBe('BROKEN_AND_RESTORED');
    expect(r.currentStreak).toBe(Math.floor(6 * STREAK_RESTORATION_FRACTION));
    expect(r.longestStreak).toBe(6); // never decreases on breakage
  });

  it('+3 days → BROKEN_AND_RESTORED (50%)', () => {
    const r = computeNextStreakState(
      { currentStreak: 10, longestStreak: 10, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 25)
    );
    expect(r.transition).toBe('BROKEN_AND_RESTORED');
    expect(r.currentStreak).toBe(5);
  });

  it('+3 days when previous streak was 1 → BROKEN (no false-celebration)', () => {
    const r = computeNextStreakState(
      { currentStreak: 1, longestStreak: 1, lastActiveDate: day(2026, 10, 22), lastShieldUsedAt: null },
      day(2026, 10, 25)
    );
    expect(r.transition).toBe('BROKEN');
    expect(r.currentStreak).toBe(1);
  });

  it('>30 day gap → RESET_AFTER_LONG_GAP (= 1)', () => {
    const r = computeNextStreakState(
      { currentStreak: 50, longestStreak: 50, lastActiveDate: day(2026, 9, 22), lastShieldUsedAt: null },
      day(2026, 11, 30)
    );
    expect(r.transition).toBe('RESET_AFTER_LONG_GAP');
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(50); // preserved
    expect(r.lastShieldUsedAt).toBeNull();
  });

  it('shield window resets after 7 days of usage', () => {
    // Use shield day 22; come back day 29 (+7 from shield) — shield available again
    const r = computeNextStreakState(
      { currentStreak: 5, longestStreak: 5, lastActiveDate: day(2026, 10, 28), lastShieldUsedAt: day(2026, 10, 22) },
      day(2026, 10, 30)
    );
    expect(r.transition).toBe('SHIELD_USED');
    expect(r.currentStreak).toBe(6);
  });

  it('STREAK_SHIELD_WINDOW_DAYS is 7', () => {
    expect(STREAK_SHIELD_WINDOW_DAYS).toBe(7);
  });

  it('STREAK_RESTORATION_FRACTION is 0.5', () => {
    expect(STREAK_RESTORATION_FRACTION).toBe(0.5);
  });

  it('STREAK_VISIBLE_CAP is 365', () => {
    expect(STREAK_VISIBLE_CAP).toBe(365);
  });
});
