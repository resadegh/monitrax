/**
 * Phase 33: Admin User Subscription API
 *
 * GET /api/admin/users/:userId/subscription
 * Get user subscription.
 *
 * PATCH /api/admin/users/:userId/subscription
 * Update user subscription. Suspend/reactivate transitions are enforced at
 * the IAM authority first: the user's GCP Identity Platform account is
 * disabled/enabled via `setIdentityDisabledByEmail()` BEFORE the local
 * UserSubscription row is mirrored. If the identity update fails, the whole
 * request fails — a DB-only "suspended" flag would be cosmetic (nothing in
 * the consumer app reads it; GCP is the IAM/IDM authority).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { setIdentityDisabledByEmail } from '@/lib/auth/identityPlatformAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    if (!hasPermission(authResult.context.role, 'users:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { userId } = await params;

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    return NextResponse.json(
      subscription || {
        userId,
        tier: 'FREE',
        status: 'active',
      }
    );
  } catch (error) {
    console.error('[Admin Subscription] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch subscription' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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

    if (!hasPermission(authResult.context.role, 'users:manage_subscription')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();

    // The user must exist — we need the email for the Identity Platform call,
    // and upserting a subscription for a non-existent user would orphan a row.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.USER_NOT_FOUND, message: 'User not found' } },
        { status: 404 }
      );
    }

    // Get existing subscription
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.tier) updateData.tier = body.tier;
    if (body.status) updateData.status = body.status;

    // Handle suspension — IAM authority first, DB mirror second.
    const isSuspending = body.status === 'suspended' && existingSubscription?.status !== 'suspended';
    const isReactivating = body.status === 'active' && existingSubscription?.status === 'suspended';
    let identityResult: Awaited<ReturnType<typeof setIdentityDisabledByEmail>> | null = null;

    if (isSuspending || isReactivating) {
      identityResult = await setIdentityDisabledByEmail(user.email, isSuspending);

      if (identityResult.status === 'failed') {
        // Do NOT write the DB mirror — a suspension GCP didn't apply is a lie.
        return NextResponse.json(
          {
            error: {
              code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
              message: `Identity Platform ${isSuspending ? 'disable' : 'enable'} failed — suspension state unchanged. ${identityResult.detail ?? ''}`.trim(),
            },
          },
          { status: 502 }
        );
      }
      // 'updated'   — identity disabled/enabled; proceed with mirror.
      // 'not_found' — no Firebase identity (local-only/seeded user); DB mirror only.
      // 'skipped'   — GCP not the auth provider (local dev); DB mirror only.
    }

    if (isSuspending) {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = body.reason || 'Suspended by admin';
      updateData.suspendedBy = authResult.context.adminId;
    } else if (isReactivating) {
      updateData.suspendedAt = null;
      updateData.suspendedReason = null;
      updateData.suspendedBy = null;
    }

    // Upsert subscription
    const subscription = await prisma.userSubscription.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        tier: body.tier || 'FREE',
        status: body.status || 'active',
        ...updateData,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: isSuspending
          ? 'USER_SUSPENDED'
          : isReactivating
            ? 'USER_REACTIVATED'
            : existingSubscription?.tier !== body.tier
              ? 'USER_TIER_CHANGED'
              : 'USER_UPDATED',
        category: 'USER_MANAGEMENT',
        targetType: 'User',
        targetId: userId,
        description: isSuspending
          ? `Suspended user ${user.email} (Identity Platform: ${identityResult?.status})`
          : isReactivating
            ? `Reactivated user ${user.email} (Identity Platform: ${identityResult?.status})`
            : `Updated subscription for user`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          before: existingSubscription,
          after: subscription,
          reason: body.reason,
          identityPlatform: identityResult
            ? { status: identityResult.status, detail: identityResult.detail }
            : undefined,
        },
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('[Admin Subscription Update] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update subscription' } },
      { status: 500 }
    );
  }
}
