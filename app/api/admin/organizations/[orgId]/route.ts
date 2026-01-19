/**
 * Phase 33: Admin Organization Detail API
 *
 * GET /api/admin/organizations/:orgId
 * Get organization details.
 *
 * PATCH /api/admin/organizations/:orgId
 * Update organization details.
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

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.ORGANIZATION_NOT_FOUND, message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Get license and client count
    const [license, clientCount, portalSettings] = await Promise.all([
      prisma.organizationLicense.findUnique({
        where: { organizationId: orgId },
      }),
      prisma.organizationClient.count({
        where: { organizationId: orgId },
      }),
      prisma.organizationPortalSettings.findUnique({
        where: { organizationId: orgId },
      }),
    ]);

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      memberCount: organization._count.members,
      clientCount,
      members: organization.members.map((m: typeof organization.members[number]) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        isActive: m.isActive,
        user: m.user,
      })),
      license: license
        ? {
            id: license.id,
            tier: license.tier,
            status: license.status,
            clientLimit: license.customClientLimit || license.clientLimit,
            staffLimit: license.customStaffLimit || license.staffLimit,
            stripeCustomerId: license.stripeCustomerId,
            currentPeriodEnd: license.currentPeriodEnd,
            suspendedAt: license.suspendedAt,
            suspendedReason: license.suspendedReason,
            notes: license.notes,
          }
        : null,
      portalSettings: portalSettings
        ? {
            organizationType: portalSettings.organizationType,
            portalEnabled: portalSettings.portalEnabled,
            businessEmail: portalSettings.businessEmail,
            abn: portalSettings.abn,
          }
        : null,
    });
  } catch (error) {
    console.error('[Admin Organization Detail] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch organization' } },
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

    if (!hasPermission(authResult.context.role, 'organizations:update')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { orgId } = await params;
    const body = await request.json();

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: body.name,
        description: body.description,
      },
    });

    // Log the action
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'ORG_UPDATED',
        category: 'ORGANIZATION_MANAGEMENT',
        targetType: 'Organization',
        targetId: orgId,
        description: `Updated organization: ${organization.name}`,
        ipAddress: authResult.context.ipAddress,
        metadata: { changes: body },
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error('[Admin Organization Update] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update organization' } },
      { status: 500 }
    );
  }
}
