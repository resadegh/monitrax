/**
 * Phase 33: Admin Analytics Active Users API
 *
 * GET /api/admin/analytics/active-users
 * Returns DAU/WAU/MAU metrics based on AuditLog activity.
 *
 * GCP Migration Note:
 * This currently queries the local AuditLog table. When GCP Cloud Logging
 * is enabled, migrate to query Cloud Logging for better retention and
 * real-time analytics. See: lib/admin/services/gcpIntegration.ts (Step 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

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

    if (!hasPermission(authResult.context.role, 'analytics:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Query unique active users from AuditLog
    // GCP Migration: Replace with Cloud Logging query when available
    const [
      dauCurrent,
      dauPrevious,
      wauCurrent,
      wauPrevious,
      mauCurrent,
      mauPrevious,
    ] = await Promise.all([
      // Daily Active Users (last 24 hours)
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: oneDayAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Previous day for comparison
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: twoDaysAgo, lt: oneDayAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Weekly Active Users (last 7 days)
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: oneWeekAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Previous week
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Monthly Active Users (last 30 days)
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: oneMonthAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Previous month
      prisma.auditLog.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: twoMonthsAgo, lt: oneMonthAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const dau = dauCurrent.length;
    const wau = wauCurrent.length;
    const mau = mauCurrent.length;

    // Calculate trends
    const dauTrend = dauPrevious.length > 0
      ? ((dau - dauPrevious.length) / dauPrevious.length) * 100
      : 0;
    const wauTrend = wauPrevious.length > 0
      ? ((wau - wauPrevious.length) / wauPrevious.length) * 100
      : 0;
    const mauTrend = mauPrevious.length > 0
      ? ((mau - mauPrevious.length) / mauPrevious.length) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        current: {
          dau,
          dauTrend: Math.round(dauTrend * 10) / 10,
          wau,
          wauTrend: Math.round(wauTrend * 10) / 10,
          mau,
          mauTrend: Math.round(mauTrend * 10) / 10,
        },
        // Note: Historical data would require more complex aggregation
        // Consider using BigQuery for historical time-series analytics
        dataSource: 'database', // Will be 'gcp_cloud_logging' when migrated
      },
    });
  } catch (error) {
    console.error('[Admin Analytics Active Users] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch active users' } },
      { status: 500 }
    );
  }
}
