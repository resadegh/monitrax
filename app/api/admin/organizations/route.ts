/**
 * Phase 33: Admin Organizations API
 *
 * GET /api/admin/organizations
 * List all organizations with pagination and filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, PAGINATION_DEFAULTS } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  // Check if portal is accessible
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    // Verify authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Check permission
    if (!hasPermission(authResult.context.role, 'organizations:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || String(PAGINATION_DEFAULTS.PAGE));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULTS.LIMIT)),
      PAGINATION_DEFAULTS.MAX_LIMIT
    );
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get organizations with license data
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    // Enrich with license and client data
    const enrichedOrgs = await Promise.all(
      organizations.map(async (org: typeof organizations[number]) => {
        const [license, clientCount] = await Promise.all([
          prisma.organizationLicense.findUnique({
            where: { organizationId: org.id },
          }),
          prisma.organizationClient.count({
            where: { organizationId: org.id },
          }),
        ]);

        // Filter by tier and status if provided
        if (tier && license?.tier !== tier) return null;
        if (status && license?.status !== status) return null;

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          memberCount: org._count.members,
          clientCount,
          license: license
            ? {
                tier: license.tier,
                status: license.status,
                clientLimit: license.customClientLimit || license.clientLimit,
                staffLimit: license.customStaffLimit || license.staffLimit,
              }
            : null,
        };
      })
    );

    // Filter out nulls (from tier/status filtering)
    const filteredOrgs = enrichedOrgs.filter(Boolean);

    return NextResponse.json({
      data: filteredOrgs,
      pagination: {
        page,
        limit,
        total: filteredOrgs.length,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Organizations] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch organizations' } },
      { status: 500 }
    );
  }
}
