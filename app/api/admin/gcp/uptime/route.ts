/**
 * Phase M.2.4: Admin Uptime Checks API (Cloud Monitoring)
 *
 * GET /api/admin/gcp/uptime
 * Lists Cloud Monitoring uptime checks and alert policies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  listUptimeChecks,
  listAlertPolicies,
  getUptimeSummary,
  isCloudMonitoringAvailable,
  getUptimeCheckConsoleUrl,
} from '@/lib/gcp/cloudMonitoring';

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
    const [uptimeChecks, alertPolicies, summary] = await Promise.all([
      listUptimeChecks(),
      listAlertPolicies(),
      getUptimeSummary(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        uptimeChecks,
        alertPolicies,
        summary,
        available: isCloudMonitoringAvailable(),
        consoleUrl: getUptimeCheckConsoleUrl(),
      },
    });
  } catch (error) {
    console.error('[Admin Uptime] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch uptime data' } },
      { status: 500 }
    );
  }
}
