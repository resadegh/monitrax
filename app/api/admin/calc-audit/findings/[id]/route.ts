/**
 * Phase 41i.3 — Finding lifecycle update.
 *
 * PATCH /api/admin/calc-audit/findings/[id]
 *   Body: { toResolution: CalcAuditFindingResolution, adminNotes?: string }
 *
 * Admin-only (`audit:read` permission). Validates the lifecycle
 * transition (OPEN → INVESTIGATING → ...) before applying.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  updateFindingResolution,
  FindingTransitionError,
} from '@/lib/calc-audit/findingService';
import type { CalcAuditFindingResolution } from '@prisma/client';

const VALID_RESOLUTIONS: CalcAuditFindingResolution[] = [
  'OPEN',
  'INVESTIGATING',
  'FALSE_POSITIVE',
  'FIX_REQUIRED',
  'FIXED',
];

interface PatchBody {
  toResolution?: string;
  adminNotes?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST_BODY', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }

  if (!body.toResolution || !(VALID_RESOLUTIONS as string[]).includes(body.toResolution)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_RESOLUTION',
          message: `toResolution must be one of: ${VALID_RESOLUTIONS.join(', ')}`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const updated = await updateFindingResolution({
      findingId: id,
      toResolution: body.toResolution as CalcAuditFindingResolution,
      resolvedBy: authResult.context.email,
      adminNotes: body.adminNotes,
    });
    return NextResponse.json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    if (err instanceof FindingTransitionError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.code === 'NOT_FOUND' ? 404 : 400 },
      );
    }
    throw err;
  }
}
