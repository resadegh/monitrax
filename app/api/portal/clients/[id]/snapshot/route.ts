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
import { PermissionGuards } from '@/lib/portal/permissions';
import type { PortalUserRole } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

const ROLE_MAPPING: Record<string, PortalUserRole> = {
  OWNER: 'PORTAL_OWNER',
  ADMIN: 'PORTAL_ADMIN',
  CONTRIBUTOR: 'PORTAL_ADVISOR',
  VIEWER: 'PORTAL_VIEWER',
};

export const GET = withPermission<RouteContext>('org.read', async (request: NextRequest, auth, routeCtx) => {
  const { id: organizationClientId } = await routeCtx.params;

  const orgClient = await prisma.organizationClient.findUnique({
    where: { id: organizationClientId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      status: true,
      consentStatus: true,
      accessScopes: true,
      assignedToMemberId: true,
    },
  });

  if (!orgClient) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Client link not found' } },
      { status: 404 }
    );
  }

  if (orgClient.status !== 'ACTIVE' || orgClient.consentStatus !== 'GRANTED') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONSENT_NOT_GRANTED',
          message:
            'This client has not granted active consent. Send a consent request before viewing their data.',
        },
      },
      { status: 403 }
    );
  }

  // Verify the caller has an active seat on the same organisation as the
  // client link. Without this check any logged-in user could read any
  // OrganizationClient by guessing the id.
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: auth.userId,
      organizationId: orgClient.organizationId,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_A_MEMBER',
          message: 'You are not a member of this organisation',
        },
      },
      { status: 403 }
    );
  }

  const portalRole = ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';

  if (!PermissionGuards.canViewClientData(portalRole)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: 'Your role does not permit viewing client data',
        },
      },
      { status: 403 }
    );
  }

  // PORTAL_ADVISOR can only view clients assigned to them. PORTAL_OWNER /
  // ADMIN see the whole book.
  if (
    portalRole === 'PORTAL_ADVISOR' &&
    orgClient.assignedToMemberId !== membership.id
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CLIENT_NOT_ASSIGNED',
          message: 'You are not assigned to this client',
        },
      },
      { status: 403 }
    );
  }

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
