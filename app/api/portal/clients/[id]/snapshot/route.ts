/**
 * Phase 32B PR3 — Drill-in canonical client snapshot.
 *
 * GET /api/portal/clients/[id]/snapshot
 *
 * Returns the SAME canonical `MasterFinancialSnapshot` the consumer
 * dashboard renders, but fetched through a `viewerContext` so the
 * service-layer scope filter applies and a `PRO_DASHBOARD_VIEW` audit
 * row is emitted (plus the per-view `ClientAccessLog` row for the
 * organisation's compliance reports).
 *
 * Path param `id` = OrganizationClient.id (NOT the client's User.id).
 * The route resolves the OrganizationClient row, verifies the caller's
 * seat owns it, then forwards to `getMasterFinancialSnapshot()` with
 * a viewerContext built from canonical DB data.
 *
 * One canonical engine — viewerContext is a parameter on
 * masterFinancialService, NOT a fork. Per CLAUDE.md §0 architect lens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { verifyAdviserClientAccess } from '@/lib/portal/adviserClientAccess';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('org.read', async (request, auth, context) => {
  const { id: organizationClientId } = await context!.params;

  // Phase 41g: consent + membership + role + assignment checks now live
  // in `verifyAdviserClientAccess`. Three portal endpoints share the
  // same guard (snapshot, entities, money-flow); reviewers reject any
  // new client-data endpoint that doesn't route through this helper.
  const access = await verifyAdviserClientAccess(auth.userId, organizationClientId);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: { code: access.code, message: access.message } },
      { status: access.status },
    );
  }

  const { orgClient, membership } = access;

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    // Fetch the snapshot + adviser-overlay support data in parallel. The
    // overlay needs the client metadata (assignedTo, scopes, last accessed),
    // recent notes, open tasks, and the org's profession (drives the
    // compliance footer copy).
    const [snapshot, fullClient, notes, tasks, lastView, org] = await Promise.all([
      getMasterFinancialSnapshot(orgClient.userId, {
        seatId: membership.id,
        clientUserId: orgClient.userId,
        accessScopes: orgClient.accessScopes,
        ipAddress,
        userAgent,
      }),
      prisma.organizationClient.findUnique({
        where: { id: orgClient.id },
      }),
      prisma.clientNote.findMany({
        where: { organizationClientId: orgClient.id },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      prisma.clientTask.findMany({
        where: { organizationClientId: orgClient.id },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 20,
      }),
      // Most recent view BEFORE this one — used as "Last review" in overlay.
      prisma.clientAccessLog.findFirst({
        where: {
          organizationClientId: orgClient.id,
          action: 'PRO_DASHBOARD_VIEW',
        },
        orderBy: { accessedAt: 'desc' },
        skip: 1, // skip the one this request just wrote
        select: { accessedAt: true },
      }),
      prisma.organization.findUnique({
        where: { id: orgClient.organizationId },
        select: { name: true, profession: true },
      }),
    ]);

    const clientUser = await prisma.user.findUnique({
      where: { id: orgClient.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        snapshot,
        organizationClientId: orgClient.id,
        client: fullClient ? { ...fullClient, user: clientUser } : null,
        notes,
        tasks,
        lastReviewedAt: lastView?.accessedAt ?? null,
        organization: org,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Snapshot failed';
    console.error('[Portal API] viewerContext snapshot failed:', message);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SNAPSHOT_FAILED', message },
      },
      { status: 500 }
    );
  }
});
