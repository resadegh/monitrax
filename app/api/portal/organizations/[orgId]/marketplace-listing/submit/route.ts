/**
 * Phase 32C PR4a — Org submits marketplace listing for admin review.
 *
 * POST /api/portal/organizations/[orgId]/marketplace-listing/submit
 *
 * Idempotent — calling submit on an already-PENDING_REVIEW or APPROVED
 * listing returns the existing listing unchanged. Only PORTAL_OWNER can
 * submit (the action publishes the firm's public profile + binds them to
 * the lead-fee contract — commercial decision belongs to the Org owner).
 *
 * Validation runs in the service: minimum content length, required
 * compliance number for the discipline (AFSL / credit-rep / TPB), at
 * least one specialisation + region. Errors come back as 400 with a
 * humanly readable message that the editor surfaces inline.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { hasPermission as hasPortalPermission } from '@/lib/portal/permissions';
import { isPortalAccessible } from '@/lib/portal/featureFlags';
import { PORTAL_ERROR_CODES } from '@/lib/portal/constants';
import { submitForReview, MarketplaceServiceError } from '@/lib/services/marketplaceService';
import { createAuditLog } from '@/lib/security/auditLog';
import type { PortalUserRole } from '@prisma/client';

type RouteContext = { params: Promise<{ orgId: string }> };

const ROLE_MAPPING: Record<string, PortalUserRole> = {
  OWNER: 'PORTAL_OWNER',
  ADMIN: 'PORTAL_ADMIN',
  CONTRIBUTOR: 'PORTAL_ADVISOR',
  VIEWER: 'PORTAL_VIEWER',
};

export const POST = withPermission<RouteContext>('org.update', async (request, auth, context) => {
  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' } },
      { status: 503 },
    );
  }

  const { orgId } = await context!.params;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, organizationId: orgId, isActive: true },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' } },
      { status: 403 },
    );
  }
  const portalRole = ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';

  if (!hasPortalPermission(portalRole, 'marketplace:listing:submit')) {
    return NextResponse.json(
      {
        error: {
          code: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE,
          message: 'Only Org owners can submit a listing for review',
        },
      },
      { status: 403 },
    );
  }

  try {
    const listing = await submitForReview(orgId);

    createAuditLog({
      userId: auth.userId,
      organizationId: orgId,
      action: 'MARKETPLACE_LISTING_SUBMITTED',
      entityType: 'PROFESSIONAL_LISTING',
      entityId: listing.id,
      metadata: {
        publicSlug: listing.publicSlug,
        discipline: listing.discipline,
      },
    }).catch(() => {
      /* swallow */
    });

    return NextResponse.json({ success: true, data: { listing } });
  } catch (err) {
    if (err instanceof MarketplaceServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Submit failed';
    return NextResponse.json(
      { error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
