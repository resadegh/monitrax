/**
 * Phase 41g — Drill-in entity layer.
 *
 * GET /api/portal/clients/[id]/entities
 *
 * Returns the client's `LegalEntity` graph + household members so the
 * adviser drill-in surface can render the same `EntityTree` component
 * the consumer page uses, but populated with the CLIENT's data (not
 * the adviser's).
 *
 * Path param `id` = `OrganizationClient.id` (NOT the underlying User
 * id). Same convention as the existing `/snapshot` route.
 *
 * Auth chain (per `verifyAdviserClientAccess`):
 *   1. Active OrganizationClient row
 *   2. consentStatus === 'GRANTED'
 *   3. Caller has an active seat on the org
 *   4. Caller's role permits client viewing
 *   5. If PORTAL_ADVISOR, caller is assigned to this client
 *
 * Audit: this endpoint does NOT write its own `ClientAccessLog` row —
 * the page-level `/snapshot` request already wrote a `PRO_DASHBOARD_VIEW`
 * row for this view session. Multiplying audit rows per component would
 * pollute the compliance log without adding signal. If component-level
 * access logs are ever required, we add new action codes (`PRO_ENTITY_VIEW`
 * etc.) and emit them here.
 *
 * SSOT: thin wrapper that delegates to the canonical `listEntitiesForUser`
 * service — same one the consumer `/api/entities` route calls.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
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
      const [entities, members] = await Promise.all([
        listEntitiesForUser(access.orgClient.userId),
        prisma.householdMember.findMany({
          where: { householdProfile: { userId: access.orgClient.userId } },
          select: {
            id: true,
            name: true,
            relationship: true,
            isIncomeEarner: true,
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { entities, members },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Entity fetch failed';
      console.error('[Portal API] adviser entities fetch failed:', message);
      return NextResponse.json(
        { success: false, error: { code: 'ENTITIES_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
