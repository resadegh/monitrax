/**
 * Phase 33: Admin Feature Flag Detail API
 *
 * GET /api/admin/feature-flags/[key]
 * Get a specific feature flag.
 *
 * PATCH /api/admin/feature-flags/[key]
 * Update a feature flag (toggle, rollout, tiers).
 *
 * DELETE /api/admin/feature-flags/[key]
 * Delete a feature flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateFlagCache } from '@/lib/featureFlags/moduleGate';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    if (!hasPermission(authResult.context.role, 'feature_flags:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { key } = await params;

    const flag = await prisma.globalFeatureFlag.findUnique({
      where: { key },
      include: {
        overrides: true,
        _count: { select: { overrides: true } },
      },
    });

    if (!flag) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Feature flag not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...flag,
      overridesCount: flag._count.overrides,
    });
  } catch (error) {
    console.error('[Admin Feature Flag GET] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch feature flag' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { key } = await params;
    const body = await request.json();

    // Find existing flag
    const existingFlag = await prisma.globalFeatureFlag.findUnique({
      where: { key },
    });

    if (!existingFlag) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Feature flag not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedBy: authResult.context.adminId,
    };

    if (typeof body.enabled === 'boolean') {
      updateData.enabled = body.enabled;
    }
    if (typeof body.name === 'string') {
      updateData.name = body.name;
    }
    if (typeof body.description === 'string') {
      updateData.description = body.description;
    }
    if (typeof body.enabledForPercent === 'number') {
      updateData.enabledForPercent = Math.max(0, Math.min(100, body.enabledForPercent));
    }
    if (Array.isArray(body.enabledForTiers)) {
      updateData.enabledForTiers = body.enabledForTiers;
    }
    if (Array.isArray(body.enabledForPlans)) {
      updateData.enabledForPlans = body.enabledForPlans;
    }

    const updatedFlag = await prisma.globalFeatureFlag.update({
      where: { key },
      data: updateData,
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'FLAG_UPDATED',
        category: 'FEATURE_FLAGS',
        targetType: 'FeatureFlag',
        targetId: updatedFlag.id,
        description: `Updated feature flag: ${key}`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          before: existingFlag,
          after: updatedFlag,
          changes: body,
        },
      },
    });

    // PROD Simplification P1.6 — flush the in-process cache for EVERY
    // flag, unconditionally. The keyed gate cache (moduleGate.ts) now
    // serves Basiq + all module keys, so the previous Basiq-only hook
    // would have left module flips stale on this instance. Admin flips
    // propagate immediately here + ≤30s on warm peers via the TTL.
    invalidateFlagCache(updatedFlag.key);

    return NextResponse.json(updatedFlag);
  } catch (error) {
    console.error('[Admin Feature Flag PATCH] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update feature flag' } },
      { status: 500 }
    );
  }
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

    if (!hasPermission(authResult.context.role, 'feature_flags:delete')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { key } = await params;

    const flag = await prisma.globalFeatureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Feature flag not found' } },
        { status: 404 }
      );
    }

    // Delete the flag (cascades to overrides)
    await prisma.globalFeatureFlag.delete({
      where: { key },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'FLAG_DELETED',
        category: 'FEATURE_FLAGS',
        targetType: 'FeatureFlag',
        targetId: flag.id,
        description: `Deleted feature flag: ${key}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { deletedFlag: flag },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Feature Flag DELETE] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to delete feature flag' } },
      { status: 500 }
    );
  }
}
