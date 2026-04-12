/**
 * Phase M.2.4: Admin Uptime Checks API (Cloud Monitoring)
 *
 * GET /api/admin/gcp/uptime
 *
 * Bulletproof error handling: ALWAYS returns JSON, never empty response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

function jsonError(status: number, message: string, code: string = ADMIN_ERROR_CODES.INTERNAL_ERROR) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  // Wrapping EVERYTHING in try/catch to guarantee JSON response
  try {
    if (!isAdminPortalAccessible()) {
      return jsonError(503, 'Admin portal is not enabled', ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED);
    }

    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'audit:read')) {
      return jsonError(403, 'Insufficient permissions', ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }

    // Lazy-load the GCP Monitoring service — catch any load-time errors
    let uptimeChecks: unknown[] = [];
    let alertPolicies: unknown[] = [];
    let summary: { totalChecks: number; activeChecks: number; lastHourSuccessRate: number | null } = {
      totalChecks: 0,
      activeChecks: 0,
      lastHourSuccessRate: null,
    };
    let available = false;
    let consoleUrl = '';
    let loadError: string | null = null;

    try {
      const monitoring = await import('@/lib/gcp/cloudMonitoring');
      [uptimeChecks, alertPolicies, summary] = await Promise.all([
        monitoring.listUptimeChecks(),
        monitoring.listAlertPolicies(),
        monitoring.getUptimeSummary(),
      ]);
      available = monitoring.isCloudMonitoringAvailable();
      consoleUrl = monitoring.getUptimeCheckConsoleUrl();
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Cloud Monitoring SDK failed to load';
      // Try to at least get the console URL
      try {
        const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID || '';
        consoleUrl = `https://console.cloud.google.com/monitoring/uptime?project=${projectId}`;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        uptimeChecks,
        alertPolicies,
        summary,
        available,
        consoleUrl,
        loadError,
      },
    });
  } catch (error) {
    console.error('[Admin Uptime] Fatal error:', error);
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch uptime data');
  }
}
