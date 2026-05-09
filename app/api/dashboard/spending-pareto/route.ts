/**
 * Spending Pareto API — Phase 43.2
 * GET /api/dashboard/spending-pareto
 *
 * The "fire your worst customers" / Pareto principle from Stark Naked
 * Numbers, inverted for personal finance: instead of cutting categories,
 * surface the *vital few* spending categories that drive ~80% of monthly
 * outgoings — the highest-leverage focus areas for any spending review.
 *
 * Pareto-cut rule:
 *   - Sort categories by monthly spend descending.
 *   - Walk the list accumulating spend.
 *   - The "vital few" = every category up to and including the one that
 *     pushes cumulative ≥ 80% of total spend.
 *   - The "trivial many" = everything after.
 *
 * Edge cases handled in the route (so the lens never re-derives):
 *   - Empty spending → response with `vitalFew: []`, lens self-hides.
 *   - Single category → that one category is the entire vital few.
 *   - Many tiny categories → cap vital few at 8 max (false-precision
 *     guardrail; if 80% is spread across 30+ categories, the user
 *     doesn't have a Pareto problem to focus on).
 *
 * SSOT contract: every value reads through `getMasterFinancialSnapshot()`.
 * Uses `snapshot.expenses.monthly.byCategory` (already canonically
 * computed by `aggregateExpensesByCategory` in `expenseAggregator.ts`).
 *
 * @see docs/blueprint/PHASE_43_2_SPENDING_PARETO.md
 * @see lib/services/masterFinancialService.ts
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

export interface ParetoCategory {
  category: string;
  amount: number;
  pct: number;
  cumulativePct: number;
}

export interface SpendingParetoResponse {
  vitalFew: ParetoCategory[];
  vitalFewTotal: number;
  vitalFewPct: number;
  trivialManyCount: number;
  trivialManyAmount: number;
  trivialManyPct: number;
  totalMonthlySpend: number;
  totalCategoryCount: number;
}

/** Maximum vital-few rows surfaced — false-precision guardrail. */
const MAX_VITAL_FEW = 8;
/** Pareto threshold — the user's "80%" line. */
const PARETO_THRESHOLD = 80;

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;
    const snapshot = await getMasterFinancialSnapshot(userId);

    // Sort categories by spend descending. Source is already canonical.
    const categories = [...snapshot.expenses.monthly.byCategory].sort(
      (a, b) => b.amount - a.amount,
    );
    const totalMonthlySpend = categories.reduce((s, c) => s + c.amount, 0);

    if (categories.length === 0 || totalMonthlySpend <= 0) {
      const empty: SpendingParetoResponse = {
        vitalFew: [],
        vitalFewTotal: 0,
        vitalFewPct: 0,
        trivialManyCount: 0,
        trivialManyAmount: 0,
        trivialManyPct: 0,
        totalMonthlySpend: 0,
        totalCategoryCount: 0,
      };
      return NextResponse.json({ success: true, data: empty });
    }

    // Walk the sorted list; cut at ≥ 80% cumulative OR MAX_VITAL_FEW,
    // whichever comes first.
    const vitalFew: ParetoCategory[] = [];
    let cumulative = 0;
    for (const c of categories) {
      const pct = (c.amount / totalMonthlySpend) * 100;
      cumulative += pct;
      vitalFew.push({
        category: c.category,
        amount: c.amount,
        pct,
        cumulativePct: cumulative,
      });
      if (cumulative >= PARETO_THRESHOLD) break;
      if (vitalFew.length >= MAX_VITAL_FEW) break;
    }

    const vitalFewTotal = vitalFew.reduce((s, c) => s + c.amount, 0);
    const vitalFewPct = (vitalFewTotal / totalMonthlySpend) * 100;
    const trivialManyAmount = totalMonthlySpend - vitalFewTotal;
    const trivialManyPct = 100 - vitalFewPct;
    const trivialManyCount = categories.length - vitalFew.length;

    const response: SpendingParetoResponse = {
      vitalFew,
      vitalFewTotal,
      vitalFewPct,
      trivialManyCount,
      trivialManyAmount,
      trivialManyPct,
      totalMonthlySpend,
      totalCategoryCount: categories.length,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[API] Spending Pareto error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute spending Pareto' },
      { status: 500 },
    );
  }
});
