/**
 * Hidden Wealth API — Phase 43.1
 * GET /api/dashboard/hidden-wealth
 *
 * The "balance sheet is where all the cash is hiding" insight (Andrew,
 * Stark Naked Numbers) translated into personal finance: split a user's
 * NET WORTH by *accessibility* into three buckets that answer the
 * question "what can I actually spend right now vs what's locked away?"
 *
 *   • Liquid Today      — liquid cash − credit cards
 *   • Accessible        — investments + non-liquid cash (term deposits)
 *   • Locked Long-Term  — property equity + super + personal assets − HECS/personal loans
 *
 * SSOT contract: every value reads through `getMasterFinancialSnapshot()`
 * and the buckets are computed by the ONE canonical engine
 * `computeAccessibilityBuckets` (MON-012). The buckets ALWAYS tie out —
 * `liquidToday + accessible + lockedLongTerm === netWorth` — by construction.
 * No duplicate aggregation.
 *
 * @see docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md
 * @see lib/services/masterFinancialService.ts
 * @see lib/calculations/accessibilityBuckets.ts
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computeAccessibilityBuckets } from '@/lib/calculations/accessibilityBuckets';

export interface HiddenWealthResponse {
  liquidToday: number;
  accessible: number;
  lockedLongTerm: number;
  totalAssets: number;
  netWorth: number;
  breakdown: {
    cash: number;
    investments: number;
    propertyEquity: number;
    superannuation: number;
    personalAssets: number;
    creditCards: number;
    longTermDebt: number;
  };
}

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;
    const snapshot = await getMasterFinancialSnapshot(userId);

    // One engine partitions net worth into the three accessibility buckets,
    // netting each liability against its time-horizon bucket so the buckets
    // ALWAYS sum to net worth (MON-012). Every input is a canonical
    // net-worth field — no re-aggregation here.
    const b = computeAccessibilityBuckets(
      snapshot.netWorth,
      snapshot.quickMetrics.liquidCash,
    );

    const response: HiddenWealthResponse = {
      liquidToday: b.liquidToday,
      accessible: b.accessible,
      lockedLongTerm: b.lockedLongTerm,
      totalAssets: snapshot.netWorth.assets.total,
      netWorth: snapshot.netWorth.netWorth,
      breakdown: {
        cash: b.cash,
        investments: b.investments,
        propertyEquity: b.propertyEquity,
        superannuation: b.superannuation,
        personalAssets: b.personalAssets,
        creditCards: b.creditCards,
        longTermDebt: b.longTermDebt,
      },
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('[API] Hidden wealth error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute hidden wealth' },
      { status: 500 },
    );
  }
});
