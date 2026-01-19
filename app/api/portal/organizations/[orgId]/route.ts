/**
 * Phase 32: Single Organization Management API
 *
 * GET /api/portal/organizations/[orgId] - Get organization details
 * PATCH /api/portal/organizations/[orgId] - Update organization
 * DELETE /api/portal/organizations/[orgId] - Delete organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isPortalAccessible } from '@/lib/portal/featureFlags';
import { PermissionGuards } from '@/lib/portal/permissions';
import { PORTAL_ERROR_CODES } from '@/lib/portal/constants';
import type { PortalUserRole } from '@prisma/client';

// Placeholder for auth - will integrate with existing auth system
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  return null;
}

async function getMemberContext(userId: string, orgId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId: orgId,
      isActive: true,
    },
    include: {
      organization: true,
    },
  });

  if (!membership) return null;

  // Map UserRole to PortalUserRole for permission checks
  const roleMapping: Record<string, PortalUserRole> = {
    OWNER: 'PORTAL_OWNER',
    ADMIN: 'PORTAL_ADMIN',
    CONTRIBUTOR: 'PORTAL_ADVISOR',
    VIEWER: 'PORTAL_VIEWER',
  };

  return {
    membership,
    portalRole: roleMapping[membership.role] || ('PORTAL_VIEWER' as PortalUserRole),
  };
}

/**
 * GET /api/portal/organizations/[orgId]
 * Get detailed organization information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const context = await getMemberContext(userId, orgId);

    if (!context) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Check permission
    if (!PermissionGuards.canReadOrganization(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get portal settings
    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: orgId },
    });

    // Get counts
    const [memberCount, clientCount, activeIntegrations] = await Promise.all([
      prisma.organizationMember.count({
        where: { organizationId: orgId, isActive: true },
      }),
      prisma.organizationClient.count({
        where: { organizationId: orgId, status: { not: 'ARCHIVED' } },
      }),
      prisma.accountingIntegration.count({
        where: { organizationId: orgId, isConnected: true },
      }),
    ]);

    return NextResponse.json({
      organization: {
        id: context.membership.organization.id,
        name: context.membership.organization.name,
        slug: context.membership.organization.slug,
        description: context.membership.organization.description,
        createdAt: context.membership.organization.createdAt,
        updatedAt: context.membership.organization.updatedAt,
      },
      portalSettings: portalSettings || null,
      membership: {
        id: context.membership.id,
        role: context.portalRole,
        joinedAt: context.membership.joinedAt,
      },
      stats: {
        memberCount,
        clientCount,
        activeIntegrations,
      },
    });
  } catch (error) {
    console.error('[Portal API] Error fetching organization:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portal/organizations/[orgId]
 * Update organization details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const context = await getMemberContext(userId, orgId);

    if (!context) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Check permission
    if (!PermissionGuards.canUpdateOrganization(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions to update organization' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      // Portal settings
      brandName,
      brandLogoUrl,
      brandPrimaryColor,
      brandSecondaryColor,
      businessEmail,
      businessPhone,
      businessAddress,
      abn,
      acn,
      afslNumber,
      taxAgentNumber,
      portalEnabled,
    } = body;

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update organization if name or description changed
      if (name !== undefined || description !== undefined) {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
          },
        });
      }

      // Update portal settings
      const portalSettingsData: Record<string, unknown> = {};

      if (brandName !== undefined) portalSettingsData.brandName = brandName;
      if (brandLogoUrl !== undefined) portalSettingsData.brandLogoUrl = brandLogoUrl;
      if (brandPrimaryColor !== undefined) portalSettingsData.brandPrimaryColor = brandPrimaryColor;
      if (brandSecondaryColor !== undefined) portalSettingsData.brandSecondaryColor = brandSecondaryColor;
      if (businessEmail !== undefined) portalSettingsData.businessEmail = businessEmail;
      if (businessPhone !== undefined) portalSettingsData.businessPhone = businessPhone;
      if (businessAddress !== undefined) portalSettingsData.businessAddress = businessAddress;
      if (abn !== undefined) portalSettingsData.abn = abn;
      if (acn !== undefined) portalSettingsData.acn = acn;
      if (afslNumber !== undefined) portalSettingsData.afslNumber = afslNumber;
      if (taxAgentNumber !== undefined) portalSettingsData.taxAgentNumber = taxAgentNumber;
      if (portalEnabled !== undefined) portalSettingsData.portalEnabled = portalEnabled;

      if (Object.keys(portalSettingsData).length > 0) {
        await tx.organizationPortalSettings.upsert({
          where: { organizationId: orgId },
          update: portalSettingsData,
          create: {
            organizationId: orgId,
            ...portalSettingsData,
          },
        });
      }

      return tx.organization.findUnique({
        where: { id: orgId },
      });
    });

    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: orgId },
    });

    return NextResponse.json({
      organization: result,
      portalSettings,
      message: 'Organization updated successfully',
    });
  } catch (error) {
    console.error('[Portal API] Error updating organization:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portal/organizations/[orgId]
 * Delete organization (requires PORTAL_OWNER role)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const context = await getMemberContext(userId, orgId);

    if (!context) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Only PORTAL_OWNER can delete
    if (!PermissionGuards.canDeleteOrganization(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Only organization owners can delete the organization' },
        { status: 403 }
      );
    }

    // Delete organization (cascades to related records)
    await prisma.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('[Portal API] Error deleting organization:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
