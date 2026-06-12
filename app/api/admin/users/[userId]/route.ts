/**
 * Phase 33: Admin User Detail API
 *
 * GET /api/admin/users/:userId
 * Get user details.
 *
 * PATCH /api/admin/users/:userId
 * Update user details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            accounts: true,
            properties: true,
            loans: true,
            documents: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.USER_NOT_FOUND, message: 'User not found' } },
        { status: 404 }
      );
    }

    // Subscription, memberships, last login, recent activity — independent reads
    const [subscription, memberships, lastLogin, recentActivity] = await Promise.all([
      prisma.userSubscription.findUnique({
        where: { userId },
      }),
      prisma.organizationMember.findMany({
        where: { userId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.loginAttempt.findFirst({
        where: { userId, success: true },
        orderBy: { attemptedAt: 'desc' },
        select: { attemptedAt: true },
      }),
      // metadata deliberately excluded — audit metadata is sanitized at write
      // time, but the admin surface only needs the event shape (CDR §13.3)
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          status: true,
          entityType: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: lastLogin?.attemptedAt ?? null,
      recentActivity,
      stats: {
        accountsCount: user._count.accounts,
        propertiesCount: user._count.properties,
        loansCount: user._count.loans,
        documentsCount: user._count.documents,
      },
      subscription: subscription || {
        tier: 'FREE',
        status: 'active',
      },
      organizations: memberships.map((m: typeof memberships[number]) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        isActive: m.isActive,
      })),
    });
  } catch (error) {
    console.error('[Admin User Detail] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch user' } },
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

    if (!hasPermission(authResult.context.role, 'users:update')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        email: body.email,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'USER_UPDATED',
        category: 'USER_MANAGEMENT',
        targetType: 'User',
        targetId: userId,
        description: `Updated user: ${user.email}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { changes: body },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[Admin User Update] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update user' } },
      { status: 500 }
    );
  }
}
