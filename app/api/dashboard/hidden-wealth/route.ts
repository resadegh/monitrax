/**
 * Hidden Wealth API — Phase 43.1
 * GET /api/dashboard/hidden-wealth
 *
 * The "balance sheet is where all the cash is hiding" insight (Andrew,
 * Stark Naked Numbers) translated into personal finance: split a user's
 * total assets by *accessibility* into three buckets that answer the
 * question "what can I actually spend right now vs what's locked away?"
 *
 *   • Liquid Today      — quickMetrics.liquidCash (cash + offsets)
 *   • Accessible        — investments.totalValue (shares/ETFs sellable in days)
 *   • Locked Long-Term  — propertyPortfolioEquity + super + personal assets
 *
 * SSOT contract: every value reads through `getMasterFinancialSnapshot()`.
 * No new calc engine. No duplicate aggregation.
 *
 * @see docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md
 * @see lib/services/masterFinancialService.ts
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

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
  };
}

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;
    const snapshot = await getMasterFinancialSnapshot(userId);

    // Three buckets — every value already canonically computed by the
    // master snapshot. Liquid = cash on hand. Accessible = positions
    // you can convert to cash within ~90 days (subject to CGT, market
    // liquidity, settlement — flagged in the lens copy, not modelled
    // here). Locked = property equity (sale required), super
    // (preservation age), personal assets (illiquid + depreciating).
    const liquidToday = snapshot.quickMetrics.liquidCash;
    const accessible = snapshot.investments.totalValue;
    const propertyEquity = snapshot.propertyPortfolioEquity;
    const superannuation = snapshot.netWorth.assets.superannuation;
    const personalAssets = snapshot.netWorth.assets.assets;
    const lockedLongTerm = propertyEquity + superannuation + personalAssets;

    const response: HiddenWealthResponse = {
      liquidToday,
      accessible,
      lockedLongTerm,
      totalAssets: snapshot.netWorth.assets.total,
      netWorth: snapshot.netWorth.netWorth,
      breakdown: {
        cash: liquidToday,
        investments: accessible,
        propertyEquity,
        superannuation,
        personalAssets,
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
