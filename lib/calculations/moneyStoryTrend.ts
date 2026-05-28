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
  /**
   * Phase KPI-tiles (2026-05-28) — raw monthly series for the dashboard
   * KPI sparklines (Cash Flow / Income / Outgoings). One entry per month
   * in the window, oldest first. Unlike `trend.kept` (clamped ≥ 0 for the
   * ribbon), `monthlyNetCashflow` can go negative — the cashflow sparkline
   * needs that. Empty arrays when <2 months of data.
   */
  monthlyEarned: number[];
  monthlySpent: number[];
  monthlyNetCashflow: number[];
  /**
   * Pre-computed deltas for the KPI sparkline delta-pills. All arithmetic
   * lives here (the service layer) so the dashboard page + API route stay
   * free of inline financial math (the Phase 41i.6b surface linter forbids
   * it in `app/`). 0 when not enough history.
   */
  cashflowDeltaMonthly: number; // latest month − previous month
  incomeDeltaPct: number;       // (latest − first) / first × 100, YoY-ish
  outgoingsDeltaVsAvg: number;  // latest month − window average
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

  const ordered = [...buckets.entries()];

  const trend: RibbonPoint[] = ordered.map(([key, b]) => {
    const monthIdx = parseInt(key.split('-')[1], 10) - 1;
    return {
      label: MONTH_LABELS[monthIdx],
      spent: Math.round(b.spent),
      kept: Math.max(0, Math.round(b.earned - b.spent)),
    };
  });

  // Raw monthly series for the KPI sparklines (chronological, oldest
  // first). monthlyNetCashflow can be negative — that's the point for the
  // cashflow tile.
  const monthlyEarned = ordered.map(([, b]) => Math.round(b.earned));
  const monthlySpent = ordered.map(([, b]) => Math.round(b.spent));
  const monthlyNetCashflow = ordered.map(([, b]) => Math.round(b.earned - b.spent));

  const emptyKpi = {
    monthlyEarned: [] as number[],
    monthlySpent: [] as number[],
    monthlyNetCashflow: [] as number[],
    cashflowDeltaMonthly: 0,
    incomeDeltaPct: 0,
    outgoingsDeltaVsAvg: 0,
  };

  // Count months that actually have any transaction activity. If <2
  // we don't have enough history to draw a meaningful ribbon; return
  // an empty trend so the consumer hides the chart cleanly.
  const monthsWithData = trend.filter((p) => p.kept + p.spent > 0).length;
  if (monthsWithData < 2) {
    return {
      trend: [],
      currentMargin: 0,
      baselineMargin: 0,
      marginDeltaPoints: 0,
      ...emptyKpi,
    };
  }

  const last = trend[trend.length - 1];
  const first = trend.find((p) => p.kept + p.spent > 0)!;
  const lastEarned = last.kept + last.spent;
  const firstEarned = first.kept + first.spent;
  const currentMargin = lastEarned > 0 ? Math.round((last.kept / lastEarned) * 100) : 0;
  const baselineMargin = firstEarned > 0 ? Math.round((first.kept / firstEarned) * 100) : 0;

  // KPI delta computations — all financial arithmetic stays here in the
  // service so the dashboard surface stays linter-clean (Phase 41i.6b).
  const cfLen = monthlyNetCashflow.length;
  const cashflowDeltaMonthly =
    cfLen >= 2 ? monthlyNetCashflow[cfLen - 1] - monthlyNetCashflow[cfLen - 2] : 0;

  const earnedFirst = monthlyEarned.find((v) => v > 0) ?? 0;
  const earnedLast = monthlyEarned[monthlyEarned.length - 1];
  const incomeDeltaPct =
    earnedFirst > 0 ? Math.round(((earnedLast - earnedFirst) / earnedFirst) * 1000) / 10 : 0;

  const spentTotal = monthlySpent.reduce((a, b) => a + b, 0);
  const spentAvg = monthlySpent.length > 0 ? spentTotal / monthlySpent.length : 0;
  const outgoingsDeltaVsAvg =
    monthlySpent.length > 0
      ? Math.round(monthlySpent[monthlySpent.length - 1] - spentAvg)
      : 0;

  return {
    trend,
    currentMargin,
    baselineMargin,
    marginDeltaPoints: currentMargin - baselineMargin,
    monthlyEarned,
    monthlySpent,
    monthlyNetCashflow,
    cashflowDeltaMonthly,
    incomeDeltaPct,
    outgoingsDeltaVsAvg,
  };
}
