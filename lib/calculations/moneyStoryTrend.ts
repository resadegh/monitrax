/**
 * Money Story trend — 12-month bucket of earned (IN) vs spent (OUT)
 * from the user's transaction history. Powers the FreedomRibbonChart
 * on the dashboard's Money Story v2 hero.
 *
 * Honesty contract (CLAUDE.md §0 financial-adviser lens):
 *   - Never invents data. Each bucket is a literal sum of the user's
 *     own transactions for that calendar month.
 *   - Months with zero transactions render as zero, not interpolated.
 *   - For users with <2 months of recorded transactions, returns an
 *     empty array — the consumer hides the ribbon and shows a quiet
 *     empty state (the hero + KPI strip still work).
 *
 * Performance: single query, monthsBack months of date range, no
 * loops. Aggregation in memory after the fetch (12 × ~N points = fast).
 */

import { prisma } from '@/lib/db';
import type { RibbonPoint } from '@/components/editorial/money-story';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export interface MoneyStoryTrendResult {
  /** One RibbonPoint per month, oldest first. Empty when <2 months of data. */
  trend: RibbonPoint[];
  /**
   * Most recent full month's kept margin (% kept of earned).
   * Used to compute the "widened by N points" sub-text.
   */
  currentMargin: number;
  /**
   * The kept margin from `monthsBack` months ago. Used to compute the
   * delta in the sub-text. Returns 0 when not enough history.
   */
  baselineMargin: number;
  /** Margin delta in percentage points (currentMargin - baselineMargin). */
  marginDeltaPoints: number;
}

/**
 * Build a 12-month Money Story trend from the user's transactions.
 *
 * @param userId  Owning user
 * @param monthsBack  Number of months in the trend window. Defaults to 12.
 */
export async function getMoneyStoryTrend(
  userId: string,
  monthsBack: number = 12
): Promise<MoneyStoryTrendResult> {
  // Window start = the first day of the (current_month - monthsBack + 1).
  // E.g. on 2026-05-27 with monthsBack=12 → window starts 2025-06-01.
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: windowStart },
    },
    select: {
      date: true,
      amount: true,
      direction: true,
    },
    orderBy: { date: 'asc' },
  });

  // Bucket key = "YYYY-MM" so chronological sort is lexicographic.
  type Bucket = { earned: number; spent: number };
  const buckets = new Map<string, Bucket>();

  // Pre-seed every month in the window so a month with zero
  // transactions still renders as a zero-bucket (avoids gaps in the
  // ribbon).
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { earned: 0, spent: 0 });
  }

  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.direction === 'IN') bucket.earned += t.amount;
    else if (t.direction === 'OUT') bucket.spent += Math.abs(t.amount);
  }

  const trend: RibbonPoint[] = [...buckets.entries()].map(([key, b]) => {
    const monthIdx = parseInt(key.split('-')[1], 10) - 1;
    return {
      label: MONTH_LABELS[monthIdx],
      spent: Math.round(b.spent),
      kept: Math.max(0, Math.round(b.earned - b.spent)),
    };
  });

  // Count months that actually have any transaction activity. If <2
  // we don't have enough history to draw a meaningful ribbon; return
  // an empty trend so the consumer hides the chart cleanly.
  const monthsWithData = trend.filter((p) => p.kept + p.spent > 0).length;
  if (monthsWithData < 2) {
    return { trend: [], currentMargin: 0, baselineMargin: 0, marginDeltaPoints: 0 };
  }

  const last = trend[trend.length - 1];
  const first = trend.find((p) => p.kept + p.spent > 0)!;
  const lastEarned = last.kept + last.spent;
  const firstEarned = first.kept + first.spent;
  const currentMargin = lastEarned > 0 ? Math.round((last.kept / lastEarned) * 100) : 0;
  const baselineMargin = firstEarned > 0 ? Math.round((first.kept / firstEarned) * 100) : 0;

  return {
    trend,
    currentMargin,
    baselineMargin,
    marginDeltaPoints: currentMargin - baselineMargin,
  };
}
