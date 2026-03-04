/**
 * Phase 33: Admin Security Monitoring API
 *
 * GET /api/admin/security
 * Returns security monitoring data including auth events,
 * rate limiting, access violations, and active sessions.
 *
 * GCP Migration Note:
 * - Firebase Auth events should be pulled from Cloud Logging when enabled
 * - Consider Cloud Security Command Center integration for threat detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
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
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'audit:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // =========================================================================
    // 7a. Authentication Events
    // =========================================================================
    const [
      loginSuccess24h,
      loginFailure24h,
      loginSuccess7d,
      loginFailure7d,
      mfaChallenges,
      lockedAccounts,
      recentLockouts,
    ] = await Promise.all([
      // Successful logins last 24 hours
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          OR: [
            { action: 'LOGIN_SUCCESS' },
            { action: 'ADMIN_LOGIN' },
          ],
          status: 'SUCCESS',
        },
      }),
      // Failed logins last 24 hours
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          OR: [
            { action: 'LOGIN_FAILURE' },
            { action: 'ADMIN_LOGIN_FAILED' },
          ],
        },
      }),
      // Successful logins last 7 days
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          OR: [
            { action: 'LOGIN_SUCCESS' },
            { action: 'ADMIN_LOGIN' },
          ],
          status: 'SUCCESS',
        },
      }),
      // Failed logins last 7 days
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          OR: [
            { action: 'LOGIN_FAILURE' },
            { action: 'ADMIN_LOGIN_FAILED' },
          ],
        },
      }),
      // MFA challenges
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: { contains: 'MFA' },
        },
      }),
      // Currently locked admin accounts
      prisma.adminUser.count({
        where: {
          lockedUntil: { gt: now },
        },
      }),
      // Recent lockouts
      prisma.adminUser.findMany({
        where: {
          lockedUntil: { gt: thirtyDaysAgo },
        },
        select: {
          id: true,
          email: true,
          name: true,
          lockedUntil: true,
          failedLoginCount: true,
        },
        orderBy: { lockedUntil: 'desc' },
        take: 10,
      }),
    ]);

    // =========================================================================
    // 7b. Rate Limiting Events
    // =========================================================================
    const [
      rateLimitHits24h,
      rateLimitHits7d,
      topRateLimitIps,
    ] = await Promise.all([
      // Rate limit hits last 24 hours
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneDayAgo },
          action: 'RATE_LIMIT_HIT',
        },
      }),
      // Rate limit hits last 7 days
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: 'RATE_LIMIT_HIT',
        },
      }),
      // Top IPs hitting rate limits
      prisma.auditLog.groupBy({
        by: ['ipAddress'],
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: 'RATE_LIMIT_HIT',
          ipAddress: { not: null },
        },
        _count: { ipAddress: true },
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 10,
      }),
    ]);

    // =========================================================================
    // 7c. Access Violations
    // =========================================================================
    const [
      unauthorizedAccess,
      forbiddenAccess,
      topViolatedRoutes,
    ] = await Promise.all([
      // Unauthorized access attempts (401)
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: { contains: 'UNAUTHORIZED' },
        },
      }),
      // Forbidden access attempts (403)
      prisma.auditLog.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: { contains: 'FORBIDDEN' },
        },
      }),
      // Routes with most auth failures
      prisma.auditLog.groupBy({
        by: ['entityType'],
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: 'FAILURE',
          entityType: { not: null },
        },
        _count: { entityType: true },
        orderBy: { _count: { entityType: 'desc' } },
        take: 10,
      }),
    ]);

    // =========================================================================
    // 7d. Active Sessions
    // =========================================================================
    const [
      activeAdminSessions,
      activeAdminSessionDetails,
      recentAdminActivity,
    ] = await Promise.all([
      // Active admin sessions count
      prisma.adminSession.count({
        where: {
          expiresAt: { gt: now },
          isRevoked: false,
        },
      }),
      // Active admin session details
      prisma.adminSession.findMany({
        where: {
          expiresAt: { gt: now },
          isRevoked: false,
        },
        include: {
          adminUser: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 20,
      }),
      // Recent admin activity
      prisma.adminAuditLog.findMany({
        where: {
          timestamp: { gte: oneDayAgo },
        },
        include: {
          adminUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
    ]);

    // Calculate auth success rate
    const totalAuth7d = loginSuccess7d + loginFailure7d;
    const authSuccessRate = totalAuth7d > 0
      ? Math.round((loginSuccess7d / totalAuth7d) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      data: {
        authEvents: {
          loginSuccess24h,
          loginFailure24h,
          loginSuccess7d,
          loginFailure7d,
          mfaChallenges,
          authSuccessRate,
          lockedAccounts,
          recentLockouts: recentLockouts.map(l => ({
            id: l.id,
            name: l.name,
            email: l.email,
            lockedUntil: l.lockedUntil?.toISOString(),
            failedAttempts: l.failedLoginCount,
            isCurrentlyLocked: l.lockedUntil && l.lockedUntil > now,
          })),
        },
        rateLimiting: {
          hits24h: rateLimitHits24h,
          hits7d: rateLimitHits7d,
          topIps: topRateLimitIps.map(r => ({
            ip: r.ipAddress || 'Unknown',
            count: r._count.ipAddress,
          })),
        },
        accessViolations: {
          unauthorized: unauthorizedAccess,
          forbidden: forbiddenAccess,
          total: unauthorizedAccess + forbiddenAccess,
          topRoutes: topViolatedRoutes.map(r => ({
            route: r.entityType || 'Unknown',
            count: r._count.entityType,
          })),
        },
        activeSessions: {
          adminCount: activeAdminSessions,
          adminSessions: activeAdminSessionDetails.map(s => ({
            id: s.id,
            adminName: s.adminUser.name,
            adminEmail: s.adminUser.email,
            role: s.adminUser.role,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent?.substring(0, 50),
            lastActivity: s.lastActivityAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
          })),
        },
        recentActivity: recentAdminActivity.map(a => ({
          id: a.id,
          adminName: a.adminUser.name,
          action: a.action,
          category: a.category,
          description: a.description,
          timestamp: a.timestamp.toISOString(),
          ipAddress: a.ipAddress,
        })),
        lastUpdated: now.toISOString(),
        dataSource: 'database', // Will be 'gcp' when Cloud Logging is integrated
      },
    });
  } catch (error) {
    console.error('[Admin Security] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch security data' } },
      { status: 500 }
    );
  }
}
