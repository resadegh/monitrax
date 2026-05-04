/**
 * Phase 41g — Drill-in money flow.
 *
 * GET /api/portal/clients/[id]/money-flow
 *
 * Returns the client's per-entity money flow shape consumed by the
 * `MoneyFlowSankey` component. Path param `id` = `OrganizationClient.id`
 * (NOT the underlying User id) — same convention as the snapshot route.
 *
 * Auth: routes through `verifyAdviserClientAccess` (consent + member-
 * ship + role + assignment). Audit: piggybacks on the page-level
 * snapshot view; no separate `ClientAccessLog` row written here.
 *
 * SSOT: thin wrapper over `getMoneyFlow()` — same canonical service
 * the consumer `/api/money-flow` route calls.
 *
 * Note for Phase 41e: when the entity-aware tax engine lands, the
 * proportional tax allocation in `getMoneyFlow()` is replaced by
 * Div 6/6E exact distribution math. This endpoint surface stays
 * unchanged — the service swap is internal.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import { verifyAdviserClientAccess } from '@/lib/portal/adviserClientAccess';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>(
  'org.read',
  async (_request: NextRequest, auth, context) => {
    const { id: organizationClientId } = await context!.params;
    const access = await verifyAdviserClientAccess(auth.userId, organizationClientId);

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: { code: access.code, message: access.message } },
        { status: access.status },
      );
    }

    try {
      const flow = await getMoneyFlow(access.orgClient.userId);
      return NextResponse.json({
        success: true,
        data: flow,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Money flow failed';
      console.error('[Portal API] adviser money flow failed:', message);
      return NextResponse.json(
        { success: false, error: { code: 'MONEY_FLOW_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
