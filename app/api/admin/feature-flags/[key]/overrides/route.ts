/**
 * R0 — admin CRUD for per-user feature-flag overrides
 * (PROD_SIMPLIFICATION_PLAN.md §5 R0: the go-live verification
 * mechanism — enable a hidden module IN PROD for one user only so
 * Ring-3 runs on live data before any public re-enable).
 *
 * GET  /api/admin/feature-flags/[key]/overrides
 *   List the key's USER overrides, newest first, with the target
 *   user's email for display.
 *
 * POST /api/admin/feature-flags/[key]/overrides
 *   Create/refresh an override: body `{ email | userId, enabled?,
 *   expiresAt?, reason? }` (enabled defaults true — the R0 use-case).
 *   Upserts on the (flag, USER, user) unique so re-adding a user
 *   refreshes rather than errors. Audit-logged; gate cache invalidated.
 *
 * Deletion lives at ./[overrideId]/route.ts.
 *
 * NOTE (§4.5 history): P1 deliberately REMOVED the dead override
 * controls — zero evaluation readers existed. R0 re-introduces the
 * mechanism WITH its reader (`isModuleEnabledForUser`), so this time
 * the control is real.
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
    const flag = await prisma.globalFeatureFlag.findUnique({ where: { key }, select: { id: true } });
    if (!flag) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Feature flag not found' } },
        { status: 404 }
      );
    }

    const overrides = await prisma.featureFlagOverride.findMany({
      where: { flagId: flag.id, targetType: 'USER' },
      orderBy: { createdAt: 'desc' },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: overrides.map((o) => o.targetId) } },
      select: { id: true, email: true },
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    return NextResponse.json({
      overrides: overrides.map((o) => ({
        id: o.id,
        userId: o.targetId,
        email: emailById.get(o.targetId) ?? '(unknown user)',
        enabled: o.enabled,
        reason: o.reason,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
        createdBy: o.createdBy,
      })),
    });
  } catch (error) {
    console.error('[Admin Flag Overrides GET] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to list overrides' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const flag = await prisma.globalFeatureFlag.findUnique({ where: { key }, select: { id: true } });
    if (!flag) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.FLAG_NOT_FOUND, message: 'Feature flag not found' } },
        { status: 404 }
      );
    }

    // Resolve the target user: explicit userId, or email lookup.
    let userId: string | null = typeof body.userId === 'string' ? body.userId : null;
    if (!userId && typeof body.email === 'string') {
      const user = await prisma.user.findUnique({
        where: { email: body.email.trim().toLowerCase() },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }
    if (!userId) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'No user found for the given email/userId' } },
        { status: 400 }
      );
    }

    const enabled = body.enabled !== false; // default true — the R0 use-case
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Invalid expiresAt' } },
        { status: 400 }
      );
    }

    // Upsert on the (flag, USER, user) unique — §12.11 note: the update
    // branch only ever touches an override row for THIS (flag, user)
    // pair, i.e. rows this admin surface itself owns; never user data.
    const override = await prisma.featureFlagOverride.upsert({
      where: {
        flagId_targetType_targetId: { flagId: flag.id, targetType: 'USER', targetId: userId },
      },
      create: {
        flagId: flag.id,
        targetType: 'USER',
        targetId: userId,
        enabled,
        reason: typeof body.reason === 'string' ? body.reason : 'R0 per-user verification override',
        expiresAt,
        createdBy: authResult.context.adminId,
      },
      update: {
        enabled,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        expiresAt,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'FLAG_OVERRIDE_CREATED',
        category: 'FEATURE_FLAGS',
        targetType: 'FeatureFlagOverride',
        targetId: override.id,
        description: `Override ${enabled ? 'enabled' : 'disabled'} for flag ${key}, user ${userId}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { flagKey: key, targetUserId: userId, enabled, expiresAt },
      },
    });

    // Propagate immediately on this instance (≤30s on warm peers).
    invalidateFlagCache(key);

    return NextResponse.json({ success: true, override });
  } catch (error) {
    console.error('[Admin Flag Overrides POST] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to create override' } },
      { status: 500 }
    );
  }
}
