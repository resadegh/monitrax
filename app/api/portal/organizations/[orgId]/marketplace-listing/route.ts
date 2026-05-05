/**
 * Phase 32C PR4a — Org-side marketplace listing endpoint.
 *
 * GET    /api/portal/organizations/[orgId]/marketplace-listing
 *        Returns the Org's listing (or null if none exists yet).
 *
 * PUT    /api/portal/organizations/[orgId]/marketplace-listing
 *        Create / update the draft listing. Editing an APPROVED listing
 *        flips it back to PENDING_REVIEW so the admin re-checks before
 *        re-publishing. Editing a REJECTED listing returns it to DRAFT.
 *
 * Portal role gating: PORTAL_OWNER + PORTAL_ADMIN can write; PORTAL_ADVISOR +
 * PORTAL_VIEWER read-only. Submit-for-review is OWNER-only — see the sibling
 * `submit/route.ts`.
 *
 * Audit: every write goes through canonical `createAuditLog()` with
 * `MARKETPLACE_LISTING_UPDATED` action so the Org's compliance team can
 * trace every change to the public profile.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { hasPermission as hasPortalPermission } from '@/lib/portal/permissions';
import { isPortalAccessible } from '@/lib/portal/featureFlags';
import { PORTAL_ERROR_CODES } from '@/lib/portal/constants';
import {
  getListingForOrg,
  upsertListing,
  isValidSlug,
  MarketplaceServiceError,
  type ListingDraftInput,
} from '@/lib/services/marketplaceService';
import { createAuditLog } from '@/lib/security/auditLog';
import type { PortalUserRole } from '@prisma/client';

type RouteContext = { params: Promise<{ orgId: string }> };

const ROLE_MAPPING: Record<string, PortalUserRole> = {
  OWNER: 'PORTAL_OWNER',
  ADMIN: 'PORTAL_ADMIN',
  CONTRIBUTOR: 'PORTAL_ADVISOR',
  VIEWER: 'PORTAL_VIEWER',
};

async function resolvePortalRole(userId: string, orgId: string): Promise<PortalUserRole | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, organizationId: orgId, isActive: true },
    select: { role: true },
  });
  if (!membership) return null;
  return ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';
}

export const GET = withPermission<RouteContext>('org.read', async (request, auth, context) => {
  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' } },
      { status: 503 },
    );
  }

  const { orgId } = await context!.params;

  const portalRole = await resolvePortalRole(auth.userId, orgId);
  if (!portalRole) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' } },
      { status: 403 },
    );
  }
  if (!hasPortalPermission(portalRole, 'marketplace:listing:read')) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient role' } },
      { status: 403 },
    );
  }

  const listing = await getListingForOrg(orgId);
  return NextResponse.json({ success: true, data: { listing } });
});

export const PUT = withPermission<RouteContext>('org.update', async (request, auth, context) => {
  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' } },
      { status: 503 },
    );
  }

  const { orgId } = await context!.params;

  const portalRole = await resolvePortalRole(auth.userId, orgId);
  if (!portalRole) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' } },
      { status: 403 },
    );
  }
  if (!hasPortalPermission(portalRole, 'marketplace:listing:write')) {
    return NextResponse.json(
      { error: { code: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient role to edit listing' } },
      { status: 403 },
    );
  }

  let body: ListingDraftInput;
  try {
    body = (await request.json()) as ListingDraftInput;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  // Light shape validation. Service-layer validators do the heavy lifting.
  if (!body.displayName || typeof body.displayName !== 'string') {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'displayName is required' } },
      { status: 400 },
    );
  }
  if (!body.publicSlug || !isValidSlug(body.publicSlug)) {
    return NextResponse.json(
      { error: { code: 'INVALID_SLUG', message: 'publicSlug must be 2-64 chars, lowercase alphanumeric + hyphens' } },
      { status: 400 },
    );
  }
  if (!body.discipline) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'discipline is required' } },
      { status: 400 },
    );
  }

  try {
    const listing = await upsertListing(orgId, body);

    // Fire-and-forget audit (CLAUDE.md §12.10 — never block response on audit).
    createAuditLog({
      userId: auth.userId,
      organizationId: orgId,
      action: 'MARKETPLACE_LISTING_UPDATED',
      entityType: 'PROFESSIONAL_LISTING',
      entityId: listing.id,
      metadata: {
        publicSlug: listing.publicSlug,
        status: listing.status,
        discipline: listing.discipline,
      },
    }).catch(() => {
      /* swallow */
    });

    return NextResponse.json({ success: true, data: { listing } });
  } catch (err) {
    if (err instanceof MarketplaceServiceError) {
      const status = err.code === 'SLUG_TAKEN' ? 409 : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Listing update failed';
    return NextResponse.json(
      { error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
