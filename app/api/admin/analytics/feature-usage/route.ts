/**
 * Phase 33: Admin Analytics Feature Usage API
 *
 * GET /api/admin/analytics/feature-usage
 * Returns feature adoption and usage metrics based on AuditLog patterns.
 *
 * GCP Migration Note:
 * This queries AuditLog for API endpoint patterns. When Cloud Logging
 * is enabled, migrate to query Cloud Logging for more detailed analytics
 * and longer retention. Consider using BigQuery for complex pattern analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

// Feature mapping: maps audit actions/entity types to feature names
const FEATURE_MAPPING: Record<string, { name: string; pattern: string[] }> = {
  DASHBOARD: {
    name: 'Dashboard',
    pattern: ['DASHBOARD_VIEW', 'master-snapshot'],
  },
  PROPERTIES: {
    name: 'Property Tracking',
    pattern: ['PROPERTY_', 'Property'],
  },
  LOANS: {
    name: 'Loan Management',
    pattern: ['LOAN_', 'Loan'],
  },
  DOCUMENTS: {
    name: 'Document Upload',
    pattern: ['DOCUMENT_', 'Document'],
  },
  TAX: {
    name: 'Tax Planning',
    pattern: ['TAX_', 'TaxSummary'],
  },
  INVESTMENTS: {
    name: 'Investment Tracking',
    pattern: ['INVESTMENT_', 'Investment', 'Account'],
  },
  AI_INSIGHTS: {
    name: 'AI Insights',
    pattern: ['AI_', 'insight', 'Insight'],
  },
};

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

    if (!hasPermission(authResult.context.role, 'analytics:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get total active users for percentage calculation
    const totalActiveUsers = await prisma.auditLog.findMany({
      where: {
        userId: { not: null },
        createdAt: { gte: oneMonthAgo },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const totalUsers = totalActiveUsers.length;

    // Query feature usage from AuditLog
    // GCP Migration: Replace with Cloud Logging query when available
    const featureUsage = await Promise.all(
      Object.entries(FEATURE_MAPPING).map(async ([key, { name, pattern }]) => {
        // Build OR conditions for patterns
        const orConditions = pattern.map((p) => ({
          OR: [
            { action: { contains: p } },
            { entityType: { contains: p } },
          ],
        }));

        // Current period unique users
        const currentUsers = await prisma.auditLog.findMany({
          where: {
            userId: { not: null },
            createdAt: { gte: oneMonthAgo },
            OR: orConditions.flatMap((c) => c.OR),
          },
          select: { userId: true },
          distinct: ['userId'],
        });

        // Previous period for trend
        const previousUsers = await prisma.auditLog.findMany({
          where: {
            userId: { not: null },
            createdAt: { gte: twoMonthsAgo, lt: oneMonthAgo },
            OR: orConditions.flatMap((c) => c.OR),
          },
          select: { userId: true },
          distinct: ['userId'],
        });

        const currentCount = currentUsers.length;
        const previousCount = previousUsers.length;

        // Determine trend
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (previousCount > 0) {
          const change = ((currentCount - previousCount) / previousCount) * 100;
          if (change > 5) trend = 'up';
          else if (change < -5) trend = 'down';
        } else if (currentCount > 0) {
          trend = 'up';
        }

        return {
          feature: key,
          name,
          users: currentCount,
          percent: totalUsers > 0 ? Math.round((currentCount / totalUsers) * 100) : 0,
          trend,
        };
      })
    );

    // Sort by usage
    featureUsage.sort((a, b) => b.users - a.users);

    return NextResponse.json({
      success: true,
      data: {
        features: featureUsage,
        totalActiveUsers: totalUsers,
        period: 'month',
        dataSource: 'database', // Will be 'gcp_cloud_logging' when migrated
      },
    });
  } catch (error) {
    console.error('[Admin Analytics Feature Usage] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch feature usage' } },
      { status: 500 }
    );
  }
}
