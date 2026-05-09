/**
 * Margin Trend API — Phase 43.3
 * GET /api/dashboard/margin-trend
 *
 * The "GP-margin direction matters more than the absolute" rule from
 * Stark Naked Numbers (Andrew, Principle 2 — Maximize Your Margins),
 * translated to personal finance: surface the user's monthly net
 * cashflow + savings-rate **trend** as a 6-month sparkline. The
 * direction (improving / worsening / flat) is the load-bearing
 * insight; the absolute number is context.
 *
 * Why a thin endpoint, not a quickMetrics field:
 *   - The trend is a *time series*, not a point-in-time number.
 *     `quickMetrics` is the SSOT for current state; historicals belong
 *     in their own surface (D-43.3-2).
 *   - Computing the time series requires walking
 *     `unified_transactions` grouped by month — different shape from
 *     the master snapshot's frequency-based aggregation.
 *
 * Computation:
 *   - Walk last 6 calendar months (current month inclusive) of the
 *     user's UnifiedTransaction rows, grouped by UTC year-month.
 *   - For each month: monthlyIncome = sum(amount where direction=IN
 *     AND !isTransfer AND !isInvestmentContribution); monthlyExpense
 *     = same with direction=OUT. Net = income − expense.
 *     SavingsRate = (net / income) × 100, clamped at 0 when income
 *     is 0 (avoids division-by-zero noise).
 *   - Trend direction: compare avg savings rate of last 3 vs prior 3
 *     months. ≥ +2pp → 'up', ≤ −2pp → 'down', else 'flat' (the 2pp
 *     threshold is the noise floor below which trend talk would be
 *     misleading).
 *   - `enoughHistory = monthsWithIncome >= 3` (lens self-hides
 *     gracefully for new users with thin transaction data).
 *
 * SSOT contract: every value reads through `prisma.unifiedTransaction`
 * directly — there is no canonical "monthly historical" engine yet.
 * If a future surface needs the same time series, promote this
 * computation into `lib/calculations/marginTrend.ts` (see D-43.3-3).
 *
 * @see docs/blueprint/PHASE_43_3_MARGIN_TREND.md
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import prisma from '@/lib/db';
import { TransactionDirection } from '@prisma/client';

export interface MarginTrendMonth {
  /** ISO year-month, e.g. "2026-04". UTC. */
  month: string;
  /** First day of month, ISO string — for sort + chart x-axis. */
  monthStart: string;
  monthlyIncome: number;
  monthlyExpense: number;
  /** monthlyIncome − monthlyExpense */
  netCashflow: number;
  /** (netCashflow / monthlyIncome) × 100, 0 when no income */
  savingsRate: number;
}

export interface MarginTrendResponse {
  months: MarginTrendMonth[];
  current: MarginTrendMonth | null;
  previous: MarginTrendMonth | null;
  /** Difference in savings-rate percentage points. */
  savingsRateDelta: number | null;
  /** Difference in net-cashflow dollars. */
  netCashflowDelta: number | null;
  /** Sliding-window trend direction across last 6 months. */
  trend: 'up' | 'down' | 'flat';
  /** False when we don't have enough months with income to draw conclusions. */
  enoughHistory: boolean;
  /** Number of months in the window that had at least some income. */
  monthsWithIncome: number;
}

const TREND_THRESHOLD_PP = 2; // percentage points
const WINDOW_MONTHS = 6;
const MIN_MONTHS_FOR_TREND = 3;

/**
 * Build a UTC year-month key, e.g. for Date(2026, 3, 14) returns
 * "2026-04". Pure helper; no Date mutation.
 */
function ymKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Build the array of UTC year-month boundaries we want to bucket
 * transactions into. Returns oldest first (for stable iteration).
 */
function buildMonthWindow(now: Date, months: number): { key: string; start: Date }[] {
  const out: { key: string; start: Date }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0, 0),
    );
    out.push({ key: ymKey(start), start });
  }
  return out;
}

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;
    const now = new Date();
    const window = buildMonthWindow(now, WINDOW_MONTHS);
    const windowStart = window[0]?.start;
    if (!windowStart) {
      return NextResponse.json({ success: false, error: 'window error' }, { status: 500 });
    }

    // Pull only the fields we need; exclude transfers + investment
    // contributions at the SQL layer to keep the JS work minimal.
    const txns = await prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: { gte: windowStart },
        isTransfer: false,
        isInvestmentContribution: false,
      },
      select: {
        date: true,
        amount: true,
        direction: true,
      },
    });

    // Bucket into months. Initialise every window slot so months with
    // no transactions still appear (zero income + zero expense).
    const buckets = new Map<string, { income: number; expense: number; start: Date }>();
    for (const m of window) {
      buckets.set(m.key, { income: 0, expense: 0, start: m.start });
    }
    for (const t of txns) {
      const key = ymKey(t.date);
      const slot = buckets.get(key);
      if (!slot) continue; // outside window (defensive)
      if (t.direction === TransactionDirection.IN) {
        slot.income += t.amount;
      } else if (t.direction === TransactionDirection.OUT) {
        slot.expense += t.amount;
      }
    }

    const months: MarginTrendMonth[] = window.map((m) => {
      const b = buckets.get(m.key)!;
      const income = b.income;
      const expense = b.expense;
      const net = income - expense;
      const savingsRate = income > 0 ? (net / income) * 100 : 0;
      return {
        month: m.key,
        monthStart: b.start.toISOString(),
        monthlyIncome: income,
        monthlyExpense: expense,
        netCashflow: net,
        savingsRate,
      };
    });

    // Current = last month in the window; previous = the one before.
    // (Could also be "current month so far" vs "last full month" — for
    // v1 we use last-finished-month-style indexing; the behaviour is
    // identical since the window walks calendar months, not rolling.)
    const current = months[months.length - 1] ?? null;
    const previous = months[months.length - 2] ?? null;

    const monthsWithIncome = months.filter((m) => m.monthlyIncome > 0).length;
    const enoughHistory = monthsWithIncome >= MIN_MONTHS_FOR_TREND;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    let savingsRateDelta: number | null = null;
    let netCashflowDelta: number | null = null;

    if (enoughHistory && current && previous) {
      savingsRateDelta = current.savingsRate - previous.savingsRate;
      netCashflowDelta = current.netCashflow - previous.netCashflow;

      // Sliding-window trend: avg savings rate last 3 vs prior 3.
      // More stable than month-on-month deltas which swing on a single
      // big bill. Falls back to month-on-month when window is short.
      const half = Math.floor(months.length / 2);
      const recentAvg =
        months.slice(-half).reduce((s, m) => s + m.savingsRate, 0) / half;
      const priorAvg =
        months.slice(0, half).reduce((s, m) => s + m.savingsRate, 0) / half;
      const slidingDelta = recentAvg - priorAvg;

      if (slidingDelta >= TREND_THRESHOLD_PP) trend = 'up';
      else if (slidingDelta <= -TREND_THRESHOLD_PP) trend = 'down';
      else trend = 'flat';
    }

    const response: MarginTrendResponse = {
      months,
      current,
      previous,
      savingsRateDelta,
      netCashflowDelta,
      trend,
      enoughHistory,
      monthsWithIncome,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[API] Margin trend error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute margin trend' },
      { status: 500 },
    );
  }
});
