/**
 * Phase 32C PR4c — Adviser inbox detail + accept / decline action.
 *
 * GET  /api/portal/professional-requests/[id]?organizationId=...
 * POST /api/portal/professional-requests/[id]
 *      Body: { action: 'accept' | 'decline', declineReason?, organizationId }
 *
 * Caller must be an active OWNER / ADMIN / CONTRIBUTOR member of the
 * listing's organisation. VIEWER cannot accept or decline (read-only).
 *
 * Accept: lifecycle transitions to ACCEPTED + lead-fee billing intent
 * recorded + ClientLink materialised in a single transaction. Stripe
 * charge wires in PR6.
 *
 * Decline: lifecycle transitions to DECLINED + reason text required.
 * No fee charged, no link created.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  acceptRequest,
  declineRequest,
  getRequestForOrg,
  ProfessionalRequestServiceError,
} from '@/lib/services/professionalRequestService';
import { createAuditLog } from '@/lib/security/auditLog';
import type { PortalUserRole } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

const ROLE_MAPPING: Record<string, PortalUserRole> = {
  OWNER: 'PORTAL_OWNER',
  ADMIN: 'PORTAL_ADMIN',
  CONTRIBUTOR: 'PORTAL_ADVISOR',
  VIEWER: 'PORTAL_VIEWER',
};

const RESPOND_ROLES: PortalUserRole[] = ['PORTAL_OWNER', 'PORTAL_ADMIN', 'PORTAL_ADVISOR'];

interface ActionBody {
  action: 'accept' | 'decline';
  declineReason?: string;
  organizationId: string;
}

async function resolveMember(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({
    where: { userId, organizationId, isActive: true },
    select: { id: true, role: true },
  });
}

export const GET = withPermission<RouteContext>('org.read', async (request, auth, context) => {
  const { id } = await context!.params;
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

  const membership = await resolveMember(auth.userId, organizationId);
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this organisation' } },
      { status: 403 },
    );
  }

  const requestRecord = await getRequestForOrg(id, organizationId);
  if (!requestRecord) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { request: requestRecord } });
});

export const POST = withPermission<RouteContext>('org.update', async (request, auth, context) => {
  const { id } = await context!.params;

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }
  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'action must be accept or decline' } },
      { status: 400 },
    );
  }

  const membership = await resolveMember(auth.userId, body.organizationId);
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this organisation' } },
      { status: 403 },
    );
  }
  const portalRole = ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';
  if (!RESPOND_ROLES.includes(portalRole)) {
    return NextResponse.json(
      { success: false, error: { code: 'INSUFFICIENT_ROLE', message: 'Your role cannot respond to requests' } },
      { status: 403 },
    );
  }

  try {
    if (body.action === 'accept') {
      const updated = await acceptRequest({
        requestId: id,
        respondedByMemberId: membership.id,
      });

      createAuditLog({
        userId: auth.userId,
        organizationId: body.organizationId,
        action: 'PROFESSIONAL_REQUEST_ACCEPTED',
        entityType: 'PROFESSIONAL_REQUEST',
        entityId: id,
        metadata: {
          leadFeeTier: updated.leadFeeTier,
          // Decimal serialises as string — safe for audit metadata
          leadFeeAmount: updated.leadFeeAmount?.toString() ?? null,
          clientLinkId: updated.clientLinkId,
        },
      }).catch(() => {});

      return NextResponse.json({ success: true, data: { request: updated } });
    }

    if (!body.declineReason || body.declineReason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: 'INCOMPLETE_INPUT', message: 'declineReason required (min 5 chars)' } },
        { status: 400 },
      );
    }
    const updated = await declineRequest({
      requestId: id,
      respondedByMemberId: membership.id,
      declineReason: body.declineReason,
    });
    createAuditLog({
      userId: auth.userId,
      organizationId: body.organizationId,
      action: 'PROFESSIONAL_REQUEST_DECLINED',
      entityType: 'PROFESSIONAL_REQUEST',
      entityId: id,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: { request: updated } });
  } catch (err) {
    if (err instanceof ProfessionalRequestServiceError) {
      const status =
        err.code === 'NOT_FOUND'
          ? 404
          : err.code === 'FORBIDDEN'
            ? 403
            : err.code === 'INVALID_STATUS_TRANSITION'
              ? 409
              : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
