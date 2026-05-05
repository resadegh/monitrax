/**
 * Phase 32C PR4a — Admin marketplace listing queue.
 *
 * GET /api/admin/marketplace/listings
 *
 * Returns the queue of professional listings, defaulting to PENDING_REVIEW
 * sort order so admins land on the work that needs them. Optional filters:
 *   - `status` — DRAFT / PENDING_REVIEW / APPROVED / REJECTED / SUSPENDED
 *   - `discipline` — OrganizationType
 *   - `search` — matches displayName / tagline / Org name
 *
 * Auth: Monitrax AdminUser (`verifyAdminGCPAuth`). Permission:
 * `marketplace:listings:read`. SUPPORT_ADMIN + VIEWER + SUPER_ADMIN have it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission as hasAdminPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { listForAdmin } from '@/lib/services/marketplaceService';
import type { ListingStatus, OrganizationType } from '@prisma/client';

const VALID_STATUSES: ListingStatus[] = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const VALID_DISCIPLINES: OrganizationType[] = [
  'ACCOUNTING_FIRM',
  'FINANCIAL_ADVISOR',
  'MORTGAGE_BROKER',
  'TAX_AGENT',
  'BOOKKEEPER',
  'OTHER',
];

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const disciplineParam = searchParams.get('discipline');
  const search = searchParams.get('search') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const status = statusParam && VALID_STATUSES.includes(statusParam as ListingStatus)
    ? (statusParam as ListingStatus)
    : undefined;
  const discipline = disciplineParam && VALID_DISCIPLINES.includes(disciplineParam as OrganizationType)
    ? (disciplineParam as OrganizationType)
    : undefined;

  const result = await listForAdmin({ status, discipline, search, limit, offset });
  return NextResponse.json({ success: true, data: result });
}
