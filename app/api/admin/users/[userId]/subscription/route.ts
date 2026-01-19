/**
 * Phase 33: Admin User Subscription API
 *
 * GET /api/admin/users/:userId/subscription
 * Get user subscription.
 *
 * PATCH /api/admin/users/:userId/subscription
 * Update user subscription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

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
    const authResult = await verifyAdminAuth(request);
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
    const authResult = await verifyAdminAuth(request);
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

    // Get existing subscription
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.tier) updateData.tier = body.tier;
    if (body.status) updateData.status = body.status;

    // Handle suspension
    if (body.status === 'suspended' && existingSubscription?.status !== 'suspended') {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = body.reason || 'Suspended by admin';
      updateData.suspendedBy = authResult.context.adminId;
    } else if (body.status === 'active' && existingSubscription?.status === 'suspended') {
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
        action: existingSubscription?.tier !== body.tier ? 'USER_TIER_CHANGED' : 'USER_UPDATED',
        category: 'USER_MANAGEMENT',
        targetType: 'User',
        targetId: userId,
        description: `Updated subscription for user`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          before: existingSubscription,
          after: subscription,
          reason: body.reason,
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
