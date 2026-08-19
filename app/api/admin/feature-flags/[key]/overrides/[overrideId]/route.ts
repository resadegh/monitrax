/**
 * R0 — DELETE /api/admin/feature-flags/[key]/overrides/[overrideId]
 * Remove one per-user override (ending its holder's access to the
 * hidden module within the 30s gate-cache window). Audit-logged;
 * gate cache invalidated. See ../route.ts for the R0 context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateFlagCache } from '@/lib/featureFlags/moduleGate';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

interface RouteParams {
  params: Promise<{ key: string; overrideId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    if (!hasPermission(authResult.context.role, 'feature_flags:update')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { key, overrideId } = await params;

    // Scope the lookup to the key so a mismatched URL can't delete
    // another flag's override.
    const override = await prisma.featureFlagOverride.findFirst({
      where: { id: overrideId, flag: { key } },
    });
    if (!override) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Override not found for this flag' } },
        { status: 404 }
      );
    }

    // §12.11: deletes exactly ONE row by id, pre-verified to belong to
    // this flag; the row is admin-surface configuration, never user data.
    await prisma.featureFlagOverride.delete({ where: { id: override.id } });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'FLAG_OVERRIDE_DELETED',
        category: 'FEATURE_FLAGS',
        targetType: 'FeatureFlagOverride',
        targetId: override.id,
        description: `Override removed for flag ${key}, user ${override.targetId}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { flagKey: key, targetUserId: override.targetId },
      },
    });

    invalidateFlagCache(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Flag Override DELETE] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to delete override' } },
      { status: 500 }
    );
  }
}
