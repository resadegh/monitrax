/**
 * POST /api/portal/alerts/[id]/dismiss — Phase 32B PR3 #9b
 *
 * Adviser dismiss action for a client alert. Sets the row to
 * `DISMISSED` with `dismissedAt = now` and `dismissedByMemberId = the
 * caller's OrganizationMember.id`. Dismissal is sticky: the sweep cron
 * leaves a DISMISSED row alone while the triggering condition still
 * holds, and only flips it to `RESOLVED` (which re-arms the trigger)
 * once the condition clears. The org-scoped `GET /api/portal/alerts`
 * returns only `ACTIVE` rows, so a dismissed alert disappears from the
 * dashboard immediately.
 *
 * Auth: `withPermission('org.update', …)` + an inline active-membership
 * check against the alert's organisation. Only a member of the org
 * that owns the alert can dismiss it.
 *
 * Idempotent-ish: dismissing an already-DISMISSED alert is a no-op
 * success; dismissing a RESOLVED alert returns 409 (it's no longer
 * actionable — wait for the sweep to re-fire it if the condition
 * recurs).
 *
 * Response: { success: true, data: { id, status: 'DISMISSED' } }.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import prisma from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>('org.update', async (_request, auth, context) => {
  const { id } = await context!.params;

  const alert = await prisma.clientAlert.findUnique({
    where: { id },
    select: { id: true, organizationId: true, status: true },
  });
  if (!alert) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
      { status: 404 },
    );
  }

  // Active-membership check — caller must belong to the alert's org.
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: alert.organizationId, userId: auth.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this organisation' } },
      { status: 403 },
    );
  }

  if (alert.status === 'DISMISSED') {
    return NextResponse.json({ success: true, data: { id: alert.id, status: 'DISMISSED' } });
  }
  if (alert.status === 'RESOLVED') {
    return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: 'Alert already resolved — nothing to dismiss' } },
      { status: 409 },
    );
  }

  await prisma.clientAlert.update({
    where: { id: alert.id },
    data: {
      status: 'DISMISSED',
      dismissedAt: new Date(),
      dismissedByMemberId: membership.id,
    },
  });

  return NextResponse.json({ success: true, data: { id: alert.id, status: 'DISMISSED' } });
});
