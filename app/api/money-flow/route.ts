/**
 * /api/money-flow — Phase 41d
 *
 * GET — returns the per-entity Money Flow shape consumed by the
 * `MoneyFlowSankey` on `/dashboard/entities`. Annual reference period
 * for v1; monthly + multi-FY toggles can land later if there's demand.
 *
 * SSOT: thin wrapper over `getMoneyFlow()` in
 * `lib/services/moneyFlowService.ts`. Route handler does no math.
 *
 * Permission: `report.read` — same gate as `/api/master-snapshot` since
 * both expose aggregated financial views (no per-row CDR data leaves
 * the boundary).
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

export const GET = withPermission('report.read', async (_request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_HOME');
    if (gateBlocked) return gateBlocked;
  try {
    const flow = await getMoneyFlow(auth.userId);
    return NextResponse.json({ data: flow });
  } catch (error) {
    // Phase 41d resilience: surface the underlying message (no PII —
    // this endpoint never returns row-level data) so the page error
    // block can render something useful instead of `[object Object]`.
    console.error('Money flow error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to compute money flow.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
