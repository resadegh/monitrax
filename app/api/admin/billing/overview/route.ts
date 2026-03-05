/**
 * Phase 33: Admin Billing Overview API
 *
 * GET /api/admin/billing/overview
 * Returns revenue metrics including MRR, ARR, churn rate, ARPU, and subscription breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, USER_TIER_LIMITS, ORGANIZATION_PLAN_LIMITS } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'billing:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Parse period parameter
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'month':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
    }

    // Get all data in parallel
    const [
      userSubscriptions,
      previousUserSubscriptions,
      organizationLicenses,
      previousOrgLicenses,
      cancelledSubscriptions,
      previousCancelledSubscriptions,
      totalUsers,
      totalOrgs,
    ] = await Promise.all([
      // Current period active user subscriptions
      prisma.userSubscription.findMany({
        where: { status: 'active' },
      }),
      // Previous period (for comparison)
      prisma.userSubscription.count({
        where: {
          status: 'active',
          updatedAt: { lt: previousEndDate },
        },
      }),
      // Current active organization licenses
      prisma.organizationLicense.findMany({
        where: { status: 'active' },
      }),
      // Previous period org licenses
      prisma.organizationLicense.count({
        where: {
          status: 'active',
          updatedAt: { lt: previousEndDate },
        },
      }),
      // Cancelled subscriptions this period
      prisma.userSubscription.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: startDate },
        },
      }),
      // Cancelled subscriptions previous period
      prisma.userSubscription.count({
        where: {
          status: 'cancelled',
          updatedAt: { gte: previousStartDate, lt: previousEndDate },
        },
      }),
      // Total users
      prisma.user.count(),
      // Total organizations
      prisma.organization.count(),
    ]);

    // Calculate MRR from user subscriptions
    const userMrr = userSubscriptions.reduce((sum, sub) => {
      const tierPrice = USER_TIER_LIMITS[sub.tier as keyof typeof USER_TIER_LIMITS]?.monthlyPrice || 0;
      return sum + tierPrice;
    }, 0);

    // Calculate MRR from organization licenses
    const orgMrr = organizationLicenses.reduce((sum, license) => {
      const planPrice = ORGANIZATION_PLAN_LIMITS[license.tier as keyof typeof ORGANIZATION_PLAN_LIMITS]?.monthlyPrice || 0;
      return sum + planPrice;
    }, 0);

    const totalMrr = userMrr + orgMrr;
    const arr = totalMrr * 12;

    // Calculate previous period MRR for comparison
    const previousTotalMrr = (previousUserSubscriptions * 15) + (previousOrgLicenses * 200); // Rough estimate
    const mrrGrowth = previousTotalMrr > 0
      ? ((totalMrr - previousTotalMrr) / previousTotalMrr) * 100
      : 0;

    // Calculate churn rate
    const totalSubscriptions = userSubscriptions.length + organizationLicenses.length;
    const churnRate = totalSubscriptions > 0
      ? (cancelledSubscriptions / totalSubscriptions) * 100
      : 0;

    const previousChurnRate = (previousUserSubscriptions + previousOrgLicenses) > 0
      ? (previousCancelledSubscriptions / (previousUserSubscriptions + previousOrgLicenses)) * 100
      : 0;

    // Calculate ARPU (Average Revenue Per User)
    const paidUsers = userSubscriptions.filter(s => s.tier !== 'FREE').length;
    const arpu = paidUsers > 0 ? userMrr / paidUsers : 0;

    // Calculate LTV (assuming average customer lifetime of 24 months)
    const ltv = arpu * 24;

    // Get subscription breakdown by tier
    const userTierCounts = userSubscriptions.reduce((acc, sub) => {
      acc[sub.tier] = (acc[sub.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tierBreakdown = Object.entries(USER_TIER_LIMITS).map(([tier, limits]) => {
      const count = userTierCounts[tier] || 0;
      return {
        tier,
        users: count,
        revenue: count * limits.monthlyPrice,
        percent: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0,
      };
    });

    // Get organization plan breakdown
    const orgPlanCounts = organizationLicenses.reduce((acc, license) => {
      acc[license.tier] = (acc[license.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const planBreakdown = Object.entries(ORGANIZATION_PLAN_LIMITS).map(([plan, limits]) => {
      const count = orgPlanCounts[plan] || 0;
      return {
        plan,
        organizations: count,
        revenue: count * limits.monthlyPrice,
        percent: totalOrgs > 0 ? Math.round((count / totalOrgs) * 100) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          mrr: Math.round(totalMrr * 100) / 100,
          mrrGrowth: Math.round(mrrGrowth * 10) / 10,
          arr: Math.round(arr * 100) / 100,
          churn: Math.round(churnRate * 10) / 10,
          churnChange: Math.round((churnRate - previousChurnRate) * 10) / 10,
          arpu: Math.round(arpu * 100) / 100,
          ltv: Math.round(ltv * 100) / 100,
          totalCustomers: totalUsers + totalOrgs,
          paidCustomers: paidUsers + organizationLicenses.length,
        },
        tierBreakdown,
        planBreakdown,
        period,
      },
    });
  } catch (error) {
    console.error('[Admin Billing Overview] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch billing overview' } },
      { status: 500 }
    );
  }
}
