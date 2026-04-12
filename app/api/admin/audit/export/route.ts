/**
 * Admin Audit Log Export API
 *
 * GET /api/admin/audit/export
 * Exports audit logs as CSV. Supports same filters as the main audit endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

const EXPORT_MAX_ROWS = 10000;

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    // Attempt admin session auth. If no admin session exists,
    // fall back to feature-flag-only access (matches /api/admin/dashboard pattern).
    // TODO: Enforce verifyAdminGCPAuth + RBAC once admin login flow is fully wired.
    const authResult = await verifyAdminGCPAuth(request);
    if (authResult.success && authResult.context) {
      if (!hasPermission(authResult.context.role, 'audit:export')) {
        return NextResponse.json(
          { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'all';
    const action = searchParams.get('action') || '';
    const status = searchParams.get('status') || '';
    const userId = searchParams.get('userId') || '';
    const entityType = searchParams.get('entityType') || '';
    const category = searchParams.get('category') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const rows: string[][] = [];
    const headers = ['Timestamp', 'Source', 'Action', 'Status', 'Actor', 'Entity Type', 'Entity ID', 'IP Address', 'Category', 'Description'];

    // Admin audit logs
    if (source === 'admin' || source === 'all') {
      const where: Record<string, unknown> = {};
      if (action) where.action = action;
      if (category) where.category = category;
      if (userId) where.adminUserId = userId;
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
        if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate);
      }

      const adminLogs = await prisma.adminAuditLog.findMany({
        where,
        take: EXPORT_MAX_ROWS,
        orderBy: { timestamp: 'desc' },
        include: { adminUser: { select: { name: true, email: true } } },
      });

      for (const log of adminLogs) {
        rows.push([
          log.timestamp.toISOString(),
          'admin',
          log.action,
          'SUCCESS',
          log.adminUser?.name ?? log.adminUserId,
          log.targetType ?? '',
          log.targetId ?? '',
          log.ipAddress ?? '',
          log.category ?? '',
          log.description ?? '',
        ]);
      }
    }

    // User audit logs
    if (source === 'user' || source === 'all') {
      const where: Record<string, unknown> = {};
      if (action) where.action = action;
      if (status) where.status = status;
      if (userId) where.userId = userId;
      if (entityType) where.entityType = entityType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }

      const userLogs = await prisma.auditLog.findMany({
        where,
        take: EXPORT_MAX_ROWS,
        orderBy: { createdAt: 'desc' },
      });

      for (const log of userLogs) {
        rows.push([
          log.createdAt.toISOString(),
          'user',
          log.action,
          log.status ?? 'SUCCESS',
          log.userId ?? '',
          log.entityType ?? '',
          log.entityId ?? '',
          log.ipAddress ?? '',
          '',
          '',
        ]);
      }
    }

    // Sort all rows by timestamp descending
    rows.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

    // Build CSV
    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Admin Audit Export] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to export audit logs' } },
      { status: 500 }
    );
  }
}
