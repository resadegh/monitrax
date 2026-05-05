/**
 * Phase 32C PR4c — Adviser inbox (org-side request list).
 *
 * GET /api/portal/professional-requests?organizationId=...&status=...
 *
 * Returns the marketplace requests targeting the caller's org. Caller must
 * be an active member of the org. PORTAL_VIEWER can read; ACCEPT/DECLINE
 * (the state-changing actions) live on the [id]/route.ts handler with
 * stricter role gating.
 *
 * Default sort: SUBMITTED first (the queue), then by submittedAt desc.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { listInboxForOrg } from '@/lib/services/professionalRequestService';
import type { RequestStatus } from '@prisma/client';

const VALID_STATUSES: RequestStatus[] = ['SUBMITTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'];

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const statusParam = searchParams.get('status');

  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

  // Verify caller is an active member of this org.
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this organisation' } },
      { status: 403 },
    );
  }

  const status =
    statusParam && VALID_STATUSES.includes(statusParam as RequestStatus)
      ? (statusParam as RequestStatus)
      : undefined;

  const items = await listInboxForOrg(organizationId, status);
  return NextResponse.json({ success: true, data: { items } });
});
