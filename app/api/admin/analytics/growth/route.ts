/**
 * Phase 33: Admin Analytics Growth API
 *
 * GET /api/admin/analytics/growth
 * Returns user and organization growth metrics over time.
 *
 * GCP Migration Note:
 * Consider migrating to BigQuery for complex time-series analytics
 * and historical trend analysis at scale.
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // day, week, month
    const metric = searchParams.get('metric') || 'users'; // users, organizations

    // Calculate date ranges for the last 6 periods
    const now = new Date();
    const periods: { label: string; start: Date; end: Date }[] = [];

    for (let i = 5; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let label: string;

      switch (period) {
        case 'week':
          start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          label = `Week ${6 - i}`;
          break;
        case 'day':
          start = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
          end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          label = start.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
          break;
        case 'month':
        default:
          start = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth() - i, 1);
          label = start.toLocaleDateString('en-AU', { month: 'short' });
          break;
      }

      periods.push({ label, start, end });
    }

    // Get counts for each period
    const growthData = await Promise.all(
      periods.map(async ({ label, start, end }) => {
        const [users, orgs] = await Promise.all([
          prisma.user.count({
            where: {
              createdAt: { gte: start, lt: end },
            },
          }),
          prisma.organization.count({
            where: {
              createdAt: { gte: start, lt: end },
            },
          }),
        ]);

        return {
          period: label,
          users,
          orgs,
        };
      })
    );

    // Get totals
    const [totalUsers, totalOrgs] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
    ]);

    // Calculate cumulative growth
    let cumulativeUsers = totalUsers - growthData.reduce((sum, d) => sum + d.users, 0);
    let cumulativeOrgs = totalOrgs - growthData.reduce((sum, d) => sum + d.orgs, 0);

    const cumulativeData = growthData.map((d) => {
      cumulativeUsers += d.users;
      cumulativeOrgs += d.orgs;
      return {
        ...d,
        cumulativeUsers,
        cumulativeOrgs,
      };
    });

    // Calculate growth rate
    const firstPeriod = growthData[0];
    const lastPeriod = growthData[growthData.length - 1];
    const userGrowthRate = firstPeriod.users > 0
      ? ((lastPeriod.users - firstPeriod.users) / firstPeriod.users) * 100
      : 0;
    const orgGrowthRate = firstPeriod.orgs > 0
      ? ((lastPeriod.orgs - firstPeriod.orgs) / firstPeriod.orgs) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        growthData: cumulativeData,
        summary: {
          totalUsers,
          totalOrgs,
          newUsersThisPeriod: lastPeriod.users,
          newOrgsThisPeriod: lastPeriod.orgs,
          userGrowthRate: Math.round(userGrowthRate * 10) / 10,
          orgGrowthRate: Math.round(orgGrowthRate * 10) / 10,
        },
        period,
        dataSource: 'database',
      },
    });
  } catch (error) {
    console.error('[Admin Analytics Growth] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch growth data' } },
      { status: 500 }
    );
  }
}
