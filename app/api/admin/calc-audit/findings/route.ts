/**
 * Phase 41i.3 — Findings list endpoint.
 *
 * GET /api/admin/calc-audit/findings
 *   Lists persisted CalcAuditFinding records for the admin queue.
 *   Filters: resolutions[] (default OPEN+INVESTIGATING), source,
 *   engineName, limit, offset.
 *
 * Admin-only (`audit:read` permission). Per HR-3 — never user-facing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { listFindings } from '@/lib/calc-audit/findingService';
import type {
  CalcAuditFindingResolution,
  CalcAuditFindingSource,
} from '@prisma/client';

const VALID_RESOLUTIONS: CalcAuditFindingResolution[] = [
  'OPEN',
  'INVESTIGATING',
  'FALSE_POSITIVE',
  'FIX_REQUIRED',
  'FIXED',
];

const VALID_SOURCES: CalcAuditFindingSource[] = [
  'L1_DIFFERENTIAL',
  'L3_ON_DEMAND',
  'L2_ANOMALY',
];

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
          message: 'Admin portal is not enabled',
        },
      },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Insufficient permissions',
        },
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const resolutionsParam = url.searchParams.getAll('resolution');
  const resolutions = resolutionsParam
    .filter((r): r is CalcAuditFindingResolution =>
      (VALID_RESOLUTIONS as string[]).includes(r),
    );
  const sourceParam = url.searchParams.get('source');
  const source =
    sourceParam && (VALID_SOURCES as string[]).includes(sourceParam)
      ? (sourceParam as CalcAuditFindingSource)
      : undefined;
  const engineName = url.searchParams.get('engineName') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '100') || 100;
  const offset = Number(url.searchParams.get('offset') ?? '0') || 0;

  const result = await listFindings({
    resolutions: resolutions.length > 0 ? resolutions : undefined,
    source,
    engineName,
    limit: Math.min(Math.max(limit, 1), 500),
    offset: Math.max(offset, 0),
  });

  return NextResponse.json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
}
