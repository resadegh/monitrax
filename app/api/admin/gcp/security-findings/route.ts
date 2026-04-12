/**
 * Phase M.3.1: Admin Security Command Center API
 *
 * GET /api/admin/gcp/security-findings
 * Lists security findings from GCP Security Command Center.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  listSecurityFindings,
  getSecurityFindingsSummary,
  isSCCAvailable,
  getSCCConsoleUrl,
} from '@/lib/gcp/securityCommandCenter';

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
    const [findings, summary] = await Promise.all([
      listSecurityFindings(100),
      getSecurityFindingsSummary(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        findings,
        summary,
        available: isSCCAvailable(),
        consoleUrl: getSCCConsoleUrl(),
        note: !isSCCAvailable()
          ? 'Security Command Center requires GCP_ORGANIZATION_ID and org-level IAM permissions. Use the GCP Console link to view findings.'
          : null,
      },
    });
  } catch (error) {
    console.error('[Admin SCC] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch security findings' } },
      { status: 500 }
    );
  }
}
