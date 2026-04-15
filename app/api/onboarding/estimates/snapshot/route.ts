/**
 * GET /api/onboarding/estimates/snapshot — Phase 12 Track B (B.8)
 *
 * Read-only thin wrapper around getMasterFinancialSnapshot. Used
 * by the Final Reveal step to pull the four hero metrics (net worth,
 * monthly savings, total debt, health grade) + the insight line.
 *
 * Pure pass-through per CLAUDE.md §12.3. No business logic here.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

export const GET = withPermission('settings.read', async (_request, auth) => {
  const startedAt = Date.now();
  try {
    const snapshot = await getMasterFinancialSnapshot(auth.userId);

    // Return only the slices the Final Reveal actually consumes.
    // CDR-safe per §13.3 — no transactions, no BSBs, no institution
    // identifiers cross this boundary.
    return NextResponse.json({
      success: true,
      data: {
        netWorth: snapshot.quickMetrics.netWorthValue,
        monthlyIncome: snapshot.quickMetrics.monthlyIncome,
        monthlyExpenses: snapshot.quickMetrics.monthlyExpenses,
        monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
        totalLiabilities: snapshot.quickMetrics.totalLiabilities,
        healthGrade: snapshot.healthScore.grade,
        healthScore: snapshot.healthScore.score,
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error('GET /api/onboarding/estimates/snapshot failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'ONBOARDING_SNAPSHOT_FAILED',
          message: 'Could not load your financial snapshot',
          details: null,
        },
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        },
      },
      { status: 500 }
    );
  }
});
