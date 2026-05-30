/**
 * Dashboard Charts API
 * GET /api/dashboard/charts — visualisation-ready aggregations for the
 * editorial chart suite (Workstream R-Charts-1).
 *
 * Distinct concern from /api/dashboard/insights (CLAUDE.md §12.4): that
 * endpoint serves health/recommendations/money-story; this one serves
 * chart-ready arrays with ALL arithmetic done server-side so the
 * presentational chart components stay free of inline financial math
 * (the Phase 41i.6b surface linter forbids it in `components/`).
 *
 * Returns four blocks, each independently empty-safe:
 *   - assetAllocation — donut slices (Property / Investments / Cash / Other)
 *   - cashflowBars    — last 6 months earned vs spent (grouped bars)
 *   - entityComparison— net value per LegalEntity (horizontal bars)
 *   - netWorthTrend   — monthly net-worth points (Workstream R-Charts-2)
 *
 * Also fires the snapshot recorder fire-and-forget on every load — keeps
 * the current month's `NetWorthSnapshot` in sync without blocking the
 * dashboard response (CLAUDE.md §12.10).
 *
 * Data sources are all canonical SSOTs:
 *   - getMasterFinancialSnapshot() → asset breakdown
 *   - getMoneyStoryTrend()         → monthly earned/spent series
 *   - getEntityValueBreakdown()    → per-entity net value (reuses the
 *                                     net-worth calculator under the hood)
 *   - getNetWorthHistory()         → stored monthly net-worth snapshots
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getMoneyStoryTrend } from '@/lib/calculations/moneyStoryTrend';
import { getEntityValueBreakdown } from '@/lib/calculations/entityValueBreakdown';
import { getNetWorthHistory } from '@/lib/calculations/netWorthHistory';
import { recordNetWorthSnapshot } from '@/lib/services/netWorthSnapshotRecorder';

/** Editorial chart-series token keys (resolve to CSS vars client-side). */
type AllocationKey = 'property' | 'investments' | 'cash' | 'other';

interface AllocationSlice {
  key: AllocationKey;
  label: string;
  value: number;
  /** Share of total assets, 0-100, rounded to 1 dp. */
  pct: number;
}

interface CashflowBar {
  label: string; // "Jun", "Jul", ...
  earned: number;
  spent: number;
}

interface EntityBar {
  id: string;
  name: string;
  type: string;
  netValue: number;
}

interface NetWorthTrendPoint {
  /** First-of-month anchor as YYYY-MM-DD (UTC). */
  date: string;
  netWorth: number;
}

export interface DashboardChartsResponse {
  assetAllocation: {
    slices: AllocationSlice[];
    totalAssets: number;
  };
  cashflowBars: CashflowBar[];
  /** Average monthly net (earned − spent) across the bar window. */
  cashflowAvgNet: number;
  entityComparison: EntityBar[];
  netWorthTrend: {
    points: NetWorthTrendPoint[];
    deltaAbsolute: number;
    deltaPct: number;
    currentNetWorth: number;
  };
}

const ROUND1 = (n: number) => Math.round(n * 10) / 10;

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    const [snapshot, trend, entities, history] = await Promise.all([
      getMasterFinancialSnapshot(userId),
      getMoneyStoryTrend(userId, 12),
      getEntityValueBreakdown(userId),
      getNetWorthHistory(userId, 12),
    ]);

    // Fire-and-forget — record/refresh the current month's net-worth
    // snapshot. Never blocks the response, never bubbles a recorder error
    // to the user (CLAUDE.md §12.10).
    recordNetWorthSnapshot({
      userId,
      totalAssets: snapshot.netWorth.assets.total,
      totalLiabilities: snapshot.netWorth.liabilities.total,
      netWorth: snapshot.netWorth.netWorth,
    }).catch(() => {});

    // --- Asset allocation donut -------------------------------------------
    const a = snapshot.netWorth.assets;
    const total = a.total;
    const rawSlices: Array<{ key: AllocationKey; label: string; value: number }> = [
      { key: 'property', label: 'Property', value: a.properties },
      // Super is reported alongside investments in the editorial donut —
      // both are "growth" assets from the user's mental model.
      { key: 'investments', label: 'Investments', value: a.investments + a.superannuation },
      { key: 'cash', label: 'Cash', value: a.accounts },
      { key: 'other', label: 'Other', value: a.personalAssets },
    ];
    const slices: AllocationSlice[] = rawSlices
      .filter((s) => s.value > 0)
      .map((s) => ({
        ...s,
        pct: total > 0 ? ROUND1((s.value / total) * 100) : 0,
      }));

    // --- Cashflow bars (last 6 months) ------------------------------------
    // trend[i].label aligns 1:1 with the monthlyEarned/monthlySpent arrays
    // (both built from the same ordered bucket list in moneyStoryTrend).
    const cashflowBars: CashflowBar[] = trend.trend
      .map((point, i) => ({
        label: point.label,
        earned: trend.monthlyEarned[i] ?? 0,
        spent: trend.monthlySpent[i] ?? 0,
      }))
      .slice(-6);

    const cashflowAvgNet =
      cashflowBars.length > 0
        ? Math.round(
            cashflowBars.reduce((sum, b) => sum + (b.earned - b.spent), 0) /
              cashflowBars.length
          )
        : 0;

    // --- Entity comparison ------------------------------------------------
    const entityComparison: EntityBar[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      netValue: e.netValue,
    }));

    // --- Net Worth trend (R-Charts-2) -------------------------------------
    // history.trend is empty when <2 months of recorded snapshots exist —
    // the consumer renders an honest empty state in that case.
    const netWorthTrend = {
      points: history.trend.map((p) => ({
        date: p.date,
        netWorth: p.netWorth,
      })),
      deltaAbsolute: history.deltaAbsolute,
      deltaPct: history.deltaPct,
      currentNetWorth: snapshot.netWorth.netWorth,
    };

    const response: DashboardChartsResponse = {
      assetAllocation: { slices, totalAssets: total },
      cashflowBars,
      cashflowAvgNet,
      entityComparison,
      netWorthTrend,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard charts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
