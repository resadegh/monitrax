/**
 * Phase M.2.2: Admin Audit Logs via Cloud Logging API
 *
 * GET /api/admin/audit/cloud-logging
 *
 * Queries GCP Cloud Logging directly for audit log entries.
 * This is the GCP-First approach — Cloud Logging is the authoritative source
 * for audit logs (365-day retention, tamper-proof, CDR compliant).
 *
 * Falls back to PostgreSQL if Cloud Logging is unavailable (dev environments).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { queryCloudLogs, isCloudLoggingAvailable, getCloudLoggingConsoleUrl } from '@/lib/gcp/cloudLogging';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

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

  try {
    const { searchParams } = new URL(request.url);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 500);
    const pageToken = searchParams.get('pageToken') || undefined;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;

    // Query Cloud Logging (primary source of truth)
    const cloudResult = await queryCloudLogs({
      logName: 'monitrax-audit',
      pageSize,
      pageToken,
      action,
      entityType,
      severity,
      userId,
      startTime,
      endTime,
    });

    // Fallback: if Cloud Logging returned no entries and isn't available, query PostgreSQL
    if (cloudResult.source === 'postgres-fallback') {
      const where: Record<string, unknown> = {};
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (userId) where.userId = userId;
      if (startTime || endTime) {
        where.createdAt = {};
        if (startTime) (where.createdAt as Record<string, Date>).gte = new Date(startTime);
        if (endTime) (where.createdAt as Record<string, Date>).lte = new Date(endTime);
      }

      const logs = await prisma.auditLog.findMany({
        where,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        data: {
          entries: logs.map(l => ({
            insertId: l.id,
            timestamp: l.createdAt.toISOString(),
            severity: l.status === 'FAILURE' ? 'ERROR' : l.status === 'BLOCKED' ? 'WARNING' : 'INFO',
            labels: {
              action: l.action as string,
              entityType: l.entityType || 'unknown',
            },
            jsonPayload: {
              userId: l.userId,
              organizationId: l.organizationId,
              action: l.action,
              status: l.status,
              entityType: l.entityType,
              entityId: l.entityId,
              ipAddress: l.ipAddress,
              metadata: l.metadata,
            },
          })),
          nextPageToken: null,
          source: 'postgres-fallback',
          cloudLoggingAvailable: isCloudLoggingAvailable(),
          consoleUrl: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        entries: cloudResult.entries,
        nextPageToken: cloudResult.nextPageToken,
        source: cloudResult.source,
        cloudLoggingAvailable: true,
        consoleUrl: getCloudLoggingConsoleUrl('monitrax-audit'),
      },
    });
  } catch (error) {
    console.error('[Admin Audit Cloud Logging] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch audit logs from Cloud Logging' } },
      { status: 500 }
    );
  }
}
