/**
 * Net Worth History — honest monthly trend from the `NetWorthSnapshot`
 * store. Powers the editorial Net Worth Trend tile (Workstream R-Charts-2).
 *
 * Honesty contract (CLAUDE.md §0 financial-adviser lens):
 *   - Never invents data. Each point is a literal stored snapshot row.
 *   - Returns an empty array when the user has <2 months of recorded
 *     snapshots — the consumer shows a quiet empty state, never a
 *     fabricated curve. Replaces the prior `generateNetWorthTrendData`
 *     which used `Math.random` to backfill history.
 *
 * Recorder side (lib/services/netWorthSnapshotRecorder.ts) upserts one
 * row per (userId, month) on every dashboard load. The current month is
 * refreshed each visit; once the calendar rolls over, the previous month
 * freezes.
 *
 * SSOT (CLAUDE.md §12.2): this is the single canonical reader of
 * `NetWorthSnapshot`. Any future consumer (CFO, reports, AI) should call
 * this function — never query the table directly.
 */

import { prisma } from '@/lib/db';

export interface NetWorthHistoryPoint {
  /** Month-anchor in YYYY-MM-DD form (first of month, UTC). */
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface NetWorthHistoryResult {
  /** Points oldest → newest. Empty when <2 months of data. */
  trend: NetWorthHistoryPoint[];
  /** Δ between the most recent and oldest point in the window (AUD). */
  deltaAbsolute: number;
  /** % change between most recent and oldest point (0 when no baseline). */
  deltaPct: number;
}

/**
 * Pull `monthsBack` months of stored net-worth snapshots for a user.
 *
 * @param userId      Owning user
 * @param monthsBack  Window size. Defaults to 12.
 */
export async function getNetWorthHistory(
  userId: string,
  monthsBack: number = 12
): Promise<NetWorthHistoryResult> {
  const now = new Date();
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1)
  );

  const rows = await prisma.netWorthSnapshot.findMany({
    where: {
      userId,
      snapshotDate: { gte: windowStart },
    },
    orderBy: { snapshotDate: 'asc' },
    select: {
      snapshotDate: true,
      totalAssets: true,
      totalLiabilities: true,
      netWorth: true,
    },
  });

  // Honesty gate — a single-point "trend" is not a trend. The consumer
  // shows an empty state in that case.
  if (rows.length < 2) {
    return { trend: [], deltaAbsolute: 0, deltaPct: 0 };
  }

  const trend: NetWorthHistoryPoint[] = rows.map((r) => ({
    date: r.snapshotDate.toISOString().slice(0, 10),
    netWorth: r.netWorth,
    totalAssets: r.totalAssets,
    totalLiabilities: r.totalLiabilities,
  }));

  const first = trend[0].netWorth;
  const last = trend[trend.length - 1].netWorth;
  const deltaAbsolute = last - first;
  const deltaPct =
    first !== 0 ? Math.round((deltaAbsolute / Math.abs(first)) * 1000) / 10 : 0;

  return { trend, deltaAbsolute, deltaPct };
}
