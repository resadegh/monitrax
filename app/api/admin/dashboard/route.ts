/**
 * Phase 33: Admin Dashboard Stats API
 *
 * GET /api/admin/dashboard
 * Returns real-time platform statistics.
 *
 * Fix: G35 — Added verifyAdminAuth() to prevent unauthenticated access.
 * See: docs/changelog/CHANGELOG_2026_04_11.md
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function GET(request: Request) {
  // Authenticate admin user (G35 fix — was previously unauthenticated)
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.error?.code === ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED ? 503 : 401 }
    );
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch all stats in parallel
    const [
      totalUsers,
      totalOrganizations,
      usersLast30Days,
      usersLast60Days,
      orgsLast30Days,
      orgsLast60Days,
      newUsersToday,
      recentUsers,
      recentAuditLogs,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      // Total organizations
      prisma.organization.count(),
      // Users created in last 30 days
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Users created in last 60 days (for comparison)
      prisma.user.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      // Orgs created in last 30 days
      prisma.organization.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Orgs created in last 60 days
      prisma.organization.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      // New users today
      prisma.user.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Recent users (last 10)
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      }),
      // Recent audit logs
      prisma.adminAuditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          adminUser: {
            select: { name: true },
          },
        },
      }),
    ]);

    // Calculate growth percentages
    const userGrowth = usersLast60Days > 0
      ? ((usersLast30Days - usersLast60Days) / usersLast60Days * 100).toFixed(1)
      : 0;
    const orgGrowth = orgsLast60Days > 0
      ? ((orgsLast30Days - orgsLast60Days) / orgsLast60Days * 100).toFixed(1)
      : 0;

    // Get subscription stats if the model exists
    let subscriptionStats = { mrr: 0, mrrGrowth: 0, churnRate: 0 };
    try {
      const subscriptions = await prisma.userSubscription.findMany({
        where: { status: 'active' },
      });
      // Calculate MRR based on tier pricing
      const tierPricing: Record<string, number> = {
        FREE: 0,
        BASIC: 9.99,
        PRO: 19.99,
        PREMIUM: 39.99,
      };
      subscriptionStats.mrr = subscriptions.reduce((sum, sub) => {
        return sum + (tierPricing[sub.tier] || 0);
      }, 0);
    } catch {
      // UserSubscription model may not exist yet
    }

    // Format recent users with tier info
    const formattedRecentUsers = await Promise.all(
      recentUsers.map(async (user) => {
        let tier = 'FREE';
        try {
          const subscription = await prisma.userSubscription.findUnique({
            where: { userId: user.id },
          });
          if (subscription) {
            tier = subscription.tier;
          }
        } catch {
          // UserSubscription may not exist
        }
        return {
          id: user.id,
          name: user.name || 'Unknown',
          email: user.email,
          tier,
          createdAt: user.createdAt.toISOString().split('T')[0],
        };
      })
    );

    // Format recent activity
    const formattedActivity = recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      admin: log.adminUser?.name || 'System',
      target: log.targetId || log.description || '',
      time: getRelativeTime(log.timestamp),
    }));

    return NextResponse.json({
      stats: {
        totalUsers,
        totalOrganizations,
        usersLast30Days,
        orgsLast30Days,
        newUsersToday,
        mrr: Math.round(subscriptionStats.mrr),
        mrrGrowth: subscriptionStats.mrrGrowth,
        churnRate: subscriptionStats.churnRate,
        userGrowth: parseFloat(userGrowth as string) || 0,
        orgGrowth: parseFloat(orgGrowth as string) || 0,
      },
      recentUsers: formattedRecentUsers,
      recentActivity: formattedActivity,
    });
  } catch (error) {
    console.error('[Admin Dashboard] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch dashboard stats' } },
      { status: 500 }
    );
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toISOString().split('T')[0];
}
