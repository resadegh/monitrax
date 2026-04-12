/**
 * Phase M.3.1: Admin Security Command Center API
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

    if (!hasPermission(authResult.context.role, 'audit:read')) {
      return jsonError(403, 'Insufficient permissions', ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }

    let findings: unknown[] = [];
    let summary: {
      total: number;
      active: number;
      bySeverity: { critical: number; high: number; medium: number; low: number };
      lastUpdated: string | null;
    } = { total: 0, active: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, lastUpdated: null };
    let available = false;
    let consoleUrl = '';
    let note: string | null = null;
    let loadError: string | null = null;

    try {
      const scc = await import('@/lib/gcp/securityCommandCenter');
      [findings, summary] = await Promise.all([
        scc.listSecurityFindings(100),
        scc.getSecurityFindingsSummary(),
      ]);
      available = scc.isSCCAvailable();
      consoleUrl = scc.getSCCConsoleUrl();
      note = !available
        ? 'Security Command Center requires GCP_ORGANIZATION_ID and org-level IAM permissions. Use the GCP Console link to view findings.'
        : null;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'SCC SDK failed to load';
      note = 'SCC integration is unavailable. Use the GCP Console link below to view findings directly.';
      const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID || '';
      consoleUrl = `https://console.cloud.google.com/security/command-center?project=${projectId}`;
    }

    return NextResponse.json({
      success: true,
      data: { findings, summary, available, consoleUrl, note, loadError },
    });
  } catch (error) {
    console.error('[Admin SCC] Fatal error:', error);
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch security findings');
  }
}
