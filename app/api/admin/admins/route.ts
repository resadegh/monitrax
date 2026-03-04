/**
 * Phase 33: Admin Users Management API
 *
 * GET /api/admin/admins
 * List all admin users with their roles and status.
 *
 * POST /api/admin/admins
 * Create a new admin user (SUPER_ADMIN only).
 *
 * Per CLAUDE.md: Only SUPER_ADMIN can manage other admins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth, hashPassword } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, SECURITY_CONSTANTS } from '@/lib/admin/constants';

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

    if (!hasPermission(authResult.context.role, 'admins:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Enrich with inactivity flag (CDR §1.7 - 90-day inactivity flagging)
    const enrichedAdmins = admins.map((admin) => ({
      ...admin,
      status: admin.isActive ? 'active' : 'inactive',
      isInactive90Days: admin.lastLoginAt
        ? admin.lastLoginAt < ninetyDaysAgo
        : admin.createdAt < ninetyDaysAgo,
      isCurrentlyLocked: admin.lockedUntil ? admin.lockedUntil > now : false,
      lastLogin: admin.lastLoginAt?.toISOString() || null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedAdmins,
    });
  } catch (error) {
    console.error('[Admin Admins GET] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch admin users' } },
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

    // Only SUPER_ADMIN can create other admins
    if (authResult.context.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Only Super Admins can create admin users' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.name || !body.password || !body.role) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INVALID_REQUEST, message: 'Missing required fields: email, name, password, role' } },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INVALID_EMAIL, message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Validate password strength
    if (body.password.length < SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.PASSWORD_TOO_WEAK, message: `Password must be at least ${SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH} characters` } },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'VIEWER'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INVALID_REQUEST, message: 'Invalid role' } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.adminUser.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INVALID_EMAIL, message: 'Email already in use' } },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create admin user
    const newAdmin = await prisma.adminUser.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        role: body.role,
        isActive: true,
        mfaEnabled: false,
        createdBy: authResult.context.adminId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'ADMIN_CREATED',
        category: 'ADMIN_MANAGEMENT',
        targetType: 'AdminUser',
        targetId: newAdmin.id,
        description: `Created admin user: ${newAdmin.email} with role ${newAdmin.role}`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          newAdminEmail: newAdmin.email,
          newAdminRole: newAdmin.role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: newAdmin,
    }, { status: 201 });
  } catch (error) {
    console.error('[Admin Admins POST] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to create admin user' } },
      { status: 500 }
    );
  }
}
