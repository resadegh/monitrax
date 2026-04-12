/**
 * Phase 33: Admin Audit Log API
 *
 * GET /api/admin/audit
 * List audit logs with pagination and filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, PAGINATION_DEFAULTS } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
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

    if (!hasPermission(authResult.context.role, 'audit:read')) {
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
    const adminId = searchParams.get('adminId') || '';
    const action = searchParams.get('action') || '';
    const category = searchParams.get('category') || '';
    const targetType = searchParams.get('targetType') || '';
    const targetId = searchParams.get('targetId') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (adminId) where.adminUserId = adminId;
    if (action) where.action = action;
    if (category) where.category = category;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate);
    }

    // Get audit logs
    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          adminUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map((log: typeof logs[number]) => ({
        id: log.id,
        action: log.action,
        category: log.category,
        targetType: log.targetType,
        targetId: log.targetId,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        timestamp: log.timestamp,
        admin: log.adminUser,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Audit] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch audit logs' } },
      { status: 500 }
    );
  }
}
