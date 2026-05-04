/**
 * Phase 32: Organization Management API
 *
 * GET /api/portal/organizations - List user's organizations with portal access
 * POST /api/portal/organizations - Create a new organization
 *
 * Phase N.2: Migrated to withPermission (G37/G38/G39)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { isPortalAccessible } from '@/lib/portal/featureFlags';
import { PORTAL_ERROR_CODES } from '@/lib/portal/constants';
import type { Prisma } from '@prisma/client';

// Type for organization data
interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  profession: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Type for membership with organization data from the query
interface MembershipWithOrg {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organization: OrganizationData;
}

/**
 * GET /api/portal/organizations
 * List all organizations the current user has portal access to
 */
export const GET = withPermission('org.read', async (request, auth) => {
  // Check if portal is enabled
  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = auth.userId;

  try {
    // Get all organizations where user is a member
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    // Get portal settings for each organization
    const organizations = await Promise.all(
      memberships.map(async (membership: MembershipWithOrg) => {
        const portalSettings = await prisma.organizationPortalSettings.findUnique({
          where: { organizationId: membership.organizationId },
        });

        // Get counts
        const [memberCount, clientCount] = await Promise.all([
          prisma.organizationMember.count({
            where: { organizationId: membership.organizationId, isActive: true },
          }),
          prisma.organizationClient.count({
            where: {
              organizationId: membership.organizationId,
              status: { not: 'ARCHIVED' },
            },
          }),
        ]);

        return {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          description: membership.organization.description,
          role: membership.role,
          portalEnabled: portalSettings?.portalEnabled ?? false,
          // Phase 32B PR1: `profession` is the canonical "what kind of firm
          // is this?" field on Organization. The legacy
          // OrganizationPortalSettings.organizationType is a shadow that
          // backfills from this; falling back to it preserves behaviour for
          // orgs created before the migration.
          profession:
            membership.organization.profession ??
            portalSettings?.organizationType ??
            null,
          organizationType: portalSettings?.organizationType ?? null,
          plan: portalSettings?.plan ?? null,
          brandName: portalSettings?.brandName ?? null,
          brandLogoUrl: portalSettings?.brandLogoUrl ?? null,
          memberCount,
          clientCount,
          joinedAt: membership.joinedAt,
          createdAt: membership.organization.createdAt,
        };
      })
    );

    return NextResponse.json({
      organizations,
      total: organizations.length,
    });
  } catch (error) {
    console.error('[Portal API] Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/portal/organizations
 * Create a new organization with portal settings
 */
export const POST = withPermission('org.update', async (request, auth) => {
  // Check if portal is enabled
  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = auth.userId;

  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      organizationType = 'ACCOUNTING_FIRM',
      plan = 'STARTER',
      businessEmail,
      businessPhone,
      abn,
    } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const organizationSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    // Check if slug is unique
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'SLUG_EXISTS', message: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    // Create organization with portal settings in a transaction
    const organization = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the organization
      const org = await tx.organization.create({
        data: {
          name: name.trim(),
          slug: organizationSlug,
          description: description?.trim() || null,
        },
      });

      // Create portal settings
      await tx.organizationPortalSettings.create({
        data: {
          organizationId: org.id,
          organizationType,
          plan,
          portalEnabled: false, // Disabled by default until configured
          businessEmail: businessEmail || null,
          businessPhone: businessPhone || null,
          abn: abn || null,
        },
      });

      // Add the creator as PORTAL_OWNER
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: 'OWNER', // Maps to PORTAL_OWNER in portal context
          joinedAt: new Date(),
          isActive: true,
        },
      });

      return org;
    });

    // Fetch complete organization data
    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: organization.id },
    });

    return NextResponse.json(
      {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          description: organization.description,
          portalEnabled: portalSettings?.portalEnabled ?? false,
          organizationType: portalSettings?.organizationType,
          plan: portalSettings?.plan,
          createdAt: organization.createdAt,
        },
        message: 'Organization created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Portal API] Error creating organization:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create organization' },
      { status: 500 }
    );
  }
});
