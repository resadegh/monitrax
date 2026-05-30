/**
 * Net Worth Snapshot Recorder — fires once per dashboard load to keep the
 * current month's `NetWorthSnapshot` row in sync with the user's latest
 * position. Powers the editorial Net Worth Trend tile (Workstream R-Charts-2).
 *
 * Design contract:
 *   - One row per (userId, month-anchor). `snapshotDate` is always the
 *     first day of the calendar month, UTC.
 *   - Upsert: visiting the dashboard mid-month refreshes the current
 *     month's totals; once the calendar rolls over, the previous month
 *     freezes (this code path never touches it again).
 *   - Fire-and-forget at the route layer — the caller invokes this with
 *     `.catch(() => {})` so a recorder hiccup never blocks the dashboard
 *     response (CLAUDE.md §12.10).
 *
 * §12.11 destructive-write checklist (upsert):
 *   1. `where` clause matches: only rows scoped by `(userId, snapshotDate)`
 *      where `snapshotDate` is the first-of-month derived in this code path
 *      and `userId` is the authed user — never another user's row.
 *   2. Columns overwritten: `totalAssets`, `totalLiabilities`, `netWorth` —
 *      all owned exclusively by this code path (derived aggregates). No
 *      user-entered field is touched.
 *   3. Guard: synthetic key (the month-anchor we computed); the table is
 *      written ONLY by this recorder.
 */

import { prisma } from '@/lib/db';

export interface NetWorthSnapshotInput {
  userId: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

/**
 * Return the first day of the current calendar month at 00:00:00 UTC.
 * Exported for tests and to keep month-anchor logic in a single SSOT spot.
 */
export function currentMonthAnchor(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Upsert the current month's snapshot for a user. Idempotent across
 * multiple calls in the same month.
 */
export async function recordNetWorthSnapshot(
  input: NetWorthSnapshotInput
): Promise<void> {
  const anchor = currentMonthAnchor();
  await prisma.netWorthSnapshot.upsert({
    where: {
      userId_snapshotDate: {
        userId: input.userId,
        snapshotDate: anchor,
      },
    },
    create: {
      userId: input.userId,
      snapshotDate: anchor,
      totalAssets: input.totalAssets,
      totalLiabilities: input.totalLiabilities,
      netWorth: input.netWorth,
    },
    update: {
      totalAssets: input.totalAssets,
      totalLiabilities: input.totalLiabilities,
      netWorth: input.netWorth,
    },
  });
}
