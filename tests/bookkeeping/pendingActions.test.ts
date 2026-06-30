/**
 * Phase 42 PR6.5b — Pending-actions popup gate tests.
 *
 * The popup is the *behavioural* primitive that converts "you logged
 * in" into "you finished today's review." The once-per-day gate is
 * the load-bearing rule: if it breaks open, the popup becomes a nag;
 * if it breaks closed, the popup never fires. Both are silent
 * regressions that won't trip a UI test.
 *
 * `shouldShowPromptToday` is a pure function — exhaustively testable.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldShowPromptToday,
  PENDING_ACTIONS_CAP,
} from '../../lib/bookkeeping/engagement/pendingActions';

const day = (y: number, m: number, d: number, hour = 12) =>
  new Date(Date.UTC(y, m - 1, d, hour, 0, 0));

describe('shouldShowPromptToday', () => {
  const now = day(2026, 5, 8, 9);

  it('shows when nothing has been touched yet AND there are actions', () => {
    expect(
      shouldShowPromptToday(
        { promptOptedOut: false, lastPromptShownAt: null, lastPromptDismissedAt: null },
        3,
        now,
      ),
    ).toBe(true);
  });

  it('hides when there are zero actions (clean inbox)', () => {
    expect(
      shouldShowPromptToday(
        { promptOptedOut: false, lastPromptShownAt: null, lastPromptDismissedAt: null },
        0,
        now,
      ),
    ).toBe(false);
  });

  it('hides when the user has globally opted out', () => {
    expect(
      shouldShowPromptToday(
        { promptOptedOut: true, lastPromptShownAt: null, lastPromptDismissedAt: null },
        5,
        now,
      ),
    ).toBe(false);
  });

  it('hides when already shown today (same UTC day)', () => {
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: false,
          lastPromptShownAt: day(2026, 5, 8, 6),
          lastPromptDismissedAt: null,
        },
        5,
        now,
      ),
    ).toBe(false);
  });

  it('shows again the next day after being shown', () => {
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: false,
          lastPromptShownAt: day(2026, 5, 7, 6),
          lastPromptDismissedAt: null,
        },
        5,
        now,
      ),
    ).toBe(true);
  });

  it('hides for the rest of today after a "Not today" dismiss', () => {
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: false,
          lastPromptShownAt: null,
          lastPromptDismissedAt: day(2026, 5, 8, 7),
        },
        5,
        now,
      ),
    ).toBe(false);
  });

  it('shows again the next day after a snooze', () => {
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: false,
          lastPromptShownAt: null,
          lastPromptDismissedAt: day(2026, 5, 7, 7),
        },
        5,
        now,
      ),
    ).toBe(true);
  });

  it('opt-out wins even when nothing has been shown today', () => {
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: true,
          lastPromptShownAt: day(2026, 5, 7, 6),
          lastPromptDismissedAt: null,
        },
        5,
        now,
      ),
    ).toBe(false);
  });

  it('treats midnight UTC boundaries as a fresh day', () => {
    // shown at 23:59 UTC on May 7; now is 00:01 UTC on May 8 → fresh day → show
    expect(
      shouldShowPromptToday(
        {
          promptOptedOut: false,
          lastPromptShownAt: day(2026, 5, 7, 23),
          lastPromptDismissedAt: null,
        },
        5,
        day(2026, 5, 8, 0),
      ),
    ).toBe(true);
  });
});

describe('PENDING_ACTIONS_CAP', () => {
  it('is 3 (Hick\'s Law / spec §6.6)', () => {
    expect(PENDING_ACTIONS_CAP).toBe(3);
  });
});

// Phase 56.3 (Reza 2026-06-30) — the CATEGORISE_TRAILING_DAYS 60-day window was
// retired in favour of an ALL-TIME count via the `reviewQueue.ts` SSOT, so the
// old window-constant test is gone. The canonical filter is covered by
// `tests/bookkeeping/reviewQueue.test.ts`.
