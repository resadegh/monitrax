/**
 * Phase M.2.5: Admin Error Reporting API
 *
 * GET /api/admin/gcp/errors
 * Lists grouped errors from GCP Error Reporting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  listErrorGroups,
  getErrorSummary,
  isErrorReportingAvailable,
  getErrorReportingConsoleUrl,
} from '@/lib/gcp/errorReporting';

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

  if (!hasPermission(authResult.context.role, 'support:view_errors')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'PERIOD_1_DAY') as any;
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const [groups, summary] = await Promise.all([
      listErrorGroups({ timeRangePeriod: period, pageSize }),
      getErrorSummary(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        errorGroups: groups,
        summary,
        available: isErrorReportingAvailable(),
        consoleUrl: getErrorReportingConsoleUrl(),
      },
    });
  } catch (error) {
    console.error('[Admin Error Reporting] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch error data' } },
      { status: 500 }
    );
  }
}
