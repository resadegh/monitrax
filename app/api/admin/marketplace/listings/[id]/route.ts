/**
 * Phase 32C PR4a — Admin marketplace listing drill-in + actions.
 *
 * GET    /api/admin/marketplace/listings/[id]    — full listing detail
 * POST   /api/admin/marketplace/listings/[id]    — approve / reject / suspend
 *
 * The action is sent in the body as `{ action: 'approve' | 'reject' | 'suspend',
 * reason?, verificationNotes?, asicCrossChecked?, tpbCrossChecked?,
 * leadFeeTier{Emerging|Growing|Established}? }`. Status transitions enforced
 * by the service.
 *
 * AdminAuditLog rows are written for each action via the canonical admin
 * audit logger.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission as hasAdminPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  getListingByIdForAdmin,
  approveListing,
  rejectListing,
  suspendListing,
  MarketplaceServiceError,
} from '@/lib/services/marketplaceService';
import type { AdminPermission } from '@/lib/admin/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  if (!hasAdminPermission(authResult.context.role, 'marketplace:listings:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const listing = await getListingByIdForAdmin(id);
  if (!listing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Listing not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { listing } });
}

interface ActionBody {
  action: 'approve' | 'reject' | 'suspend';
  reason?: string;
  verificationNotes?: string | null;
  asicCrossChecked?: boolean;
  tpbCrossChecked?: boolean;
  leadFeeTierEmerging?: number;
  leadFeeTierGrowing?: number;
  leadFeeTierEstablished?: number;
}

const ACTION_PERMISSION: Record<ActionBody['action'], AdminPermission> = {
  approve: 'marketplace:listings:approve',
  reject: 'marketplace:listings:reject',
  suspend: 'marketplace:listings:suspend',
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { id } = await context.params;

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }

  if (!body.action || !ACTION_PERMISSION[body.action]) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'action must be approve | reject | suspend' } },
      { status: 400 },
    );
  }

  const requiredPermission = ACTION_PERMISSION[body.action];
  if (!hasAdminPermission(authResult.context.role, requiredPermission)) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: `Insufficient permissions for ${body.action}` } },
      { status: 403 },
    );
  }

  try {
    let listing;
    switch (body.action) {
      case 'approve':
        listing = await approveListing(id, {
          adminId: authResult.context.adminId,
          asicCrossChecked: body.asicCrossChecked,
          tpbCrossChecked: body.tpbCrossChecked,
          verificationNotes: body.verificationNotes,
          leadFeeTierEmerging: body.leadFeeTierEmerging,
          leadFeeTierGrowing: body.leadFeeTierGrowing,
          leadFeeTierEstablished: body.leadFeeTierEstablished,
        });
        break;
      case 'reject':
        if (!body.reason) {
          return NextResponse.json(
            { error: { code: 'INCOMPLETE_DRAFT', message: 'reason is required when rejecting' } },
            { status: 400 },
          );
        }
        listing = await rejectListing(id, {
          adminId: authResult.context.adminId,
          reason: body.reason,
          verificationNotes: body.verificationNotes,
        });
        break;
      case 'suspend':
        if (!body.reason) {
          return NextResponse.json(
            { error: { code: 'INCOMPLETE_DRAFT', message: 'reason is required when suspending' } },
            { status: 400 },
          );
        }
        listing = await suspendListing(id, authResult.context.adminId, body.reason);
        break;
    }

    return NextResponse.json({ success: true, data: { listing } });
  } catch (err) {
    if (err instanceof MarketplaceServiceError) {
      const status =
        err.code === 'NOT_FOUND'
          ? 404
          : err.code === 'INVALID_STATUS_TRANSITION'
            ? 409
            : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json(
      { error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
}
