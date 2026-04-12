/**
 * Phase M.2.5: Admin Error Reporting API
 * Bulletproof — always returns JSON.
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
  try {
    if (!isAdminPortalAccessible()) {
      return jsonError(503, 'Admin portal is not enabled', ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED);
    }

    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'support:view_errors')) {
      return jsonError(403, 'Insufficient permissions', ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'PERIOD_1_DAY') as any;
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    let errorGroups: unknown[] = [];
    let summary = { totalGroups: 0, totalErrors: 0, affectedUsers: 0, period: 'PERIOD_1_DAY' };
    let available = false;
    let consoleUrl = '';
    let loadError: string | null = null;

    try {
      const er = await import('@/lib/gcp/errorReporting');
      [errorGroups, summary] = await Promise.all([
        er.listErrorGroups({ timeRangePeriod: period, pageSize }),
        er.getErrorSummary(),
      ]);
      available = er.isErrorReportingAvailable();
      consoleUrl = er.getErrorReportingConsoleUrl();
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Error Reporting SDK failed to load';
      const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID || '';
      consoleUrl = `https://console.cloud.google.com/errors?project=${projectId}`;
    }

    return NextResponse.json({
      success: true,
      data: { errorGroups, summary, available, consoleUrl, loadError },
    });
  } catch (error) {
    console.error('[Admin Error Reporting] Fatal error:', error);
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch error data');
  }
}
