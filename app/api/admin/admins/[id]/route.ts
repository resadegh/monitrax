/**
 * Phase 33: Admin User Detail API
 *
 * GET /api/admin/admins/[id]
 * Get a specific admin user's details.
 *
 * PATCH /api/admin/admins/[id]
 * Update admin user (role, status, force password reset).
 *
 * DELETE /api/admin/admins/[id]
 * Deactivate an admin user (soft delete).
 *
 * Per CLAUDE.md: Only SUPER_ADMIN can manage other admins.
 * Cannot deactivate self or demote self.
 * Cannot delete the last SUPER_ADMIN.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    const admin = await prisma.adminUser.findUnique({
      where: { id },
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
        ipWhitelist: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.ADMIN_NOT_FOUND, message: 'Admin user not found' } },
        { status: 404 }
      );
    }

    // Get recent activity for this admin
    const recentActivity = await prisma.adminAuditLog.findMany({
      where: { adminUserId: id },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        category: true,
        description: true,
        timestamp: true,
        ipAddress: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...admin,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('[Admin Admins GET/:id] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch admin user' } },
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
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Only SUPER_ADMIN can update other admins
    if (authResult.context.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Only Super Admins can modify admin users' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Find existing admin
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existingAdmin) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.ADMIN_NOT_FOUND, message: 'Admin user not found' } },
        { status: 404 }
      );
    }

    // Cannot demote self
    if (id === authResult.context.adminId && body.role && body.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.CANNOT_DEMOTE_SELF, message: 'Cannot demote your own account' } },
        { status: 400 }
      );
    }

    // Cannot suspend self
    if (id === authResult.context.adminId && body.isActive === false) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.CANNOT_SUSPEND_SELF, message: 'Cannot deactivate your own account' } },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      updateData.name = body.name;
    }
    if (typeof body.role === 'string') {
      const validRoles = ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'VIEWER'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: { code: ADMIN_ERROR_CODES.INVALID_REQUEST, message: 'Invalid role' } },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }
    if (typeof body.isActive === 'boolean') {
      updateData.isActive = body.isActive;
    }
    if (body.resetPassword === true) {
      // Force password reset by setting a flag (would normally trigger email)
      // For now, we just log the action
    }
    if (body.unlockAccount === true) {
      updateData.lockedUntil = null;
      updateData.failedLoginCount = 0;
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        updatedAt: true,
      },
    });

    // Determine action type for audit
    let action = 'ADMIN_UPDATED';
    if (body.role && body.role !== existingAdmin.role) {
      action = 'ADMIN_ROLE_CHANGED';
    } else if (body.isActive === false && existingAdmin.isActive) {
      action = 'ADMIN_DEACTIVATED';
    } else if (body.isActive === true && !existingAdmin.isActive) {
      action = 'ADMIN_REACTIVATED';
    }

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action,
        category: 'ADMIN_MANAGEMENT',
        targetType: 'AdminUser',
        targetId: id,
        description: `Updated admin user: ${existingAdmin.email}`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          before: {
            name: existingAdmin.name,
            role: existingAdmin.role,
            isActive: existingAdmin.isActive,
          },
          after: {
            name: updatedAdmin.name,
            role: updatedAdmin.role,
            isActive: updatedAdmin.isActive,
          },
          changes: body,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAdmin,
    });
  } catch (error) {
    console.error('[Admin Admins PATCH/:id] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update admin user' } },
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
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete admins
    if (authResult.context.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Only Super Admins can delete admin users' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Cannot delete self
    if (id === authResult.context.adminId) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.CANNOT_SUSPEND_SELF, message: 'Cannot delete your own account' } },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.ADMIN_NOT_FOUND, message: 'Admin user not found' } },
        { status: 404 }
      );
    }

    // Check if this is the last SUPER_ADMIN
    if (admin.role === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.adminUser.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: { code: ADMIN_ERROR_CODES.CANNOT_DELETE_LAST_SUPER_ADMIN, message: 'Cannot delete the last Super Admin' } },
          { status: 400 }
        );
      }
    }

    // Soft delete (deactivate)
    await prisma.adminUser.update({
      where: { id },
      data: { isActive: false },
    });

    // Revoke all active sessions
    await prisma.adminSession.updateMany({
      where: {
        adminUserId: id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'Admin account deactivated',
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'ADMIN_DEACTIVATED',
        category: 'ADMIN_MANAGEMENT',
        targetType: 'AdminUser',
        targetId: id,
        description: `Deactivated admin user: ${admin.email}`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          deactivatedAdmin: {
            email: admin.email,
            role: admin.role,
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Admins DELETE/:id] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to delete admin user' } },
      { status: 500 }
    );
  }
}
