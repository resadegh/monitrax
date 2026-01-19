/**
 * Phase 32: Organization Management API
 *
 * GET /api/portal/organizations - List user's organizations with portal access
 * POST /api/portal/organizations - Create a new organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isPortalAccessible } from '@/lib/portal/featureFlags';
import { PORTAL_ERROR_CODES } from '@/lib/portal/constants';

// Placeholder for auth - will integrate with existing auth system
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  // TODO: Integrate with existing auth system
  // This will use the same JWT auth as the main app
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  // For now, return null - actual implementation will parse JWT
  return null;
}

/**
 * GET /api/portal/organizations
 * List all organizations the current user has portal access to
 */
export async function GET(request: NextRequest) {
  // Check if portal is enabled
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
      memberships.map(async (membership) => {
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
}

/**
 * POST /api/portal/organizations
 * Create a new organization with portal settings
 */
export async function POST(request: NextRequest) {
  // Check if portal is enabled
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
    const organization = await prisma.$transaction(async (tx) => {
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
}
