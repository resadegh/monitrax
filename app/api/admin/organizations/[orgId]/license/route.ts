/**
 * Phase 33: Admin Organization License API
 *
 * GET /api/admin/organizations/:orgId/license
 * Get organization license.
 *
 * PATCH /api/admin/organizations/:orgId/license
 * Update organization license.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
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

    if (!hasPermission(authResult.context.role, 'organizations:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { orgId } = await params;

    const license = await prisma.organizationLicense.findUnique({
      where: { organizationId: orgId },
    });

    if (!license) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.ORGANIZATION_NOT_FOUND, message: 'License not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(license);
  } catch (error) {
    console.error('[Admin License] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch license' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
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

    if (!hasPermission(authResult.context.role, 'organizations:manage_license')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { orgId } = await params;
    const body = await request.json();

    // Get existing license
    const existingLicense = await prisma.organizationLicense.findUnique({
      where: { organizationId: orgId },
    });

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.tier) updateData.tier = body.tier;
    if (body.status) updateData.status = body.status;
    if (body.clientLimit !== undefined) updateData.clientLimit = body.clientLimit;
    if (body.staffLimit !== undefined) updateData.staffLimit = body.staffLimit;
    if (body.customClientLimit !== undefined) updateData.customClientLimit = body.customClientLimit;
    if (body.customStaffLimit !== undefined) updateData.customStaffLimit = body.customStaffLimit;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Handle suspension
    if (body.status === 'suspended' && existingLicense?.status !== 'suspended') {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = body.reason || 'Suspended by admin';
      updateData.suspendedBy = authResult.context.adminId;
    } else if (body.status === 'active' && existingLicense?.status === 'suspended') {
      updateData.suspendedAt = null;
      updateData.suspendedReason = null;
      updateData.suspendedBy = null;
    }

    // Upsert license
    const license = await prisma.organizationLicense.upsert({
      where: { organizationId: orgId },
      update: updateData,
      create: {
        organizationId: orgId,
        tier: body.tier || 'STARTER',
        status: body.status || 'active',
        clientLimit: body.clientLimit || 10,
        staffLimit: body.staffLimit || 3,
        ...updateData,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: existingLicense?.tier !== body.tier ? 'ORG_TIER_CHANGED' : 'ORG_LICENSE_UPDATED',
        category: 'ORGANIZATION_MANAGEMENT',
        targetType: 'Organization',
        targetId: orgId,
        description: `Updated license for organization`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          before: existingLicense,
          after: license,
          reason: body.reason,
        },
      },
    });

    return NextResponse.json(license);
  } catch (error) {
    console.error('[Admin License Update] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update license' } },
      { status: 500 }
    );
  }
}
