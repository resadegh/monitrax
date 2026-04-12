/**
 * Admin Audit Compliance API
 *
 * GET  /api/admin/audit/compliance — CDR compliance status + anomaly detection
 * POST /api/admin/audit/compliance — Run retention cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  getRetentionStats,
  enforceAuditLogRetention,
  runAnomalyDetection,
  CDR_MIN_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS,
} from '@/lib/security/cdrAuditCompliance';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    // Best-effort admin auth (matches dashboard pattern)
    await verifyAdminGCPAuth(request);

    const [retentionStats, anomalies, actionCoverage] = await Promise.all([
      getRetentionStats(),
      runAnomalyDetection(),
      getActionCoverage(),
    ]);

    return NextResponse.json({
      data: {
        retention: retentionStats,
        anomalies,
        actionCoverage,
        cdrRequirements: {
          criticalSystemEvents: actionCoverage.hasSystemEvents,
          securityEventsLogged: actionCoverage.hasSecurityEvents,
          authenticationLogged: actionCoverage.hasAuthEvents,
          apiRequestsLogged: actionCoverage.hasApiRequests,
          logsRetainedOver90Days: retentionStats.oldestUserLog
            ? daysSince(retentionStats.oldestUserLog) >= CDR_MIN_RETENTION_DAYS ||
              retentionStats.totalUserLogs === 0
            : true,
          retentionPolicyDays: DEFAULT_RETENTION_DAYS,
          cdrMinDays: CDR_MIN_RETENTION_DAYS,
          noCdrDataInLogs: true, // Enforced by sanitizeCdrMetadata in withAuth
          authProvider: 'gcp-identity-platform', // Primary auth events captured by GCP + OAUTH_LOGIN in local audit trail
        },
      },
    });
  } catch (error) {
    console.error('[Admin Audit Compliance] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch compliance data' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    await verifyAdminGCPAuth(request);

    const body = await request.json().catch(() => ({}));
    const retentionDays = body.retentionDays || DEFAULT_RETENTION_DAYS;

    const result = await enforceAuditLogRetention(retentionDays);

    return NextResponse.json({
      data: {
        ...result,
        retentionDays,
        message: `Cleaned up logs older than ${retentionDays} days`,
      },
    });
  } catch (error) {
    console.error('[Admin Audit Retention] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to run retention cleanup' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

async function getActionCoverage(): Promise<{
  hasSystemEvents: boolean;
  hasSecurityEvents: boolean;
  hasAuthEvents: boolean;
  hasApiRequests: boolean;
  actionBreakdown: Record<string, number>;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const actionCounts = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: true,
  });

  const breakdown: Record<string, number> = {};
  for (const row of actionCounts) {
    breakdown[row.action] = row._count;
  }

  const actions = new Set(Object.keys(breakdown));

  return {
    hasSystemEvents: actions.has('UNAUTHORIZED_ACCESS') || actions.has('FORBIDDEN_ACCESS') || actions.has('RATE_LIMIT_HIT'),
    hasSecurityEvents: actions.has('RATE_LIMIT_HIT') || actions.has('ACCOUNT_LOCKED') || actions.has('MFA_FAILURE'),
    hasAuthEvents: actions.has('OAUTH_LOGIN') || actions.has('LOGIN') || actions.has('LOGOUT') || actions.has('REGISTER'),
    hasApiRequests: actions.has('API_REQUEST'),
    actionBreakdown: breakdown,
  };
}
