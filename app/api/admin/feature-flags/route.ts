/**
 * Phase 33: Admin Feature Flags API
 *
 * GET /api/admin/feature-flags
 * List all feature flags.
 *
 * POST /api/admin/feature-flags
 * Create a new feature flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'feature_flags:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const flags = await prisma.globalFeatureFlag.findMany({
      orderBy: { key: 'asc' },
      include: {
        _count: {
          select: {
            overrides: true,
          },
        },
      },
    });

    return NextResponse.json(
      flags.map((flag: typeof flags[number]) => ({
        ...flag,
        overridesCount: flag._count.overrides,
      }))
    );
  } catch (error) {
    console.error('[Admin Feature Flags] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch feature flags' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'feature_flags:create')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate key format
    if (!body.key || !/^[A-Z][A-Z0-9_]*$/.test(body.key)) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INVALID_FLAG_KEY, message: 'Invalid flag key format. Use UPPER_SNAKE_CASE.' } },
        { status: 400 }
      );
    }

    // Check if key exists
    const existing = await prisma.globalFeatureFlag.findUnique({
      where: { key: body.key },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_KEY_EXISTS, message: 'Flag key already exists' } },
        { status: 400 }
      );
    }

    const flag = await prisma.globalFeatureFlag.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description,
        enabled: body.enabled || false,
        enabledForPercent: body.enabledForPercent || 0,
        enabledForTiers: body.enabledForTiers || [],
        enabledForPlans: body.enabledForPlans || [],
        createdBy: authResult.context.adminId,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'FLAG_CREATED',
        category: 'FEATURE_FLAGS',
        targetType: 'FeatureFlag',
        targetId: flag.id,
        description: `Created feature flag: ${flag.key}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { flag },
      },
    });

    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error('[Admin Feature Flags Create] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to create feature flag' } },
      { status: 500 }
    );
  }
}
