/**
 * GCP API Health Check
 * Diagnostic endpoint that reports what GCP services are configured and reachable.
 * Used to debug GCP integration issues without loading heavy gRPC SDKs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // Check env vars (no SDK imports)
  const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID;
  const hasServiceAccountKey = !!process.env.GCS_SERVICE_ACCOUNT_KEY;
  const hasOrgId = !!process.env.GCP_ORGANIZATION_ID;
  const hasCronSecret = !!process.env.CRON_SECRET;

  // Try to parse service account key
  let serviceAccountEmail: string | null = null;
  let keyParseError: string | null = null;
  if (hasServiceAccountKey) {
    try {
      const decoded = Buffer.from(process.env.GCS_SERVICE_ACCOUNT_KEY!, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      serviceAccountEmail = parsed.client_email || null;
    } catch (err) {
      keyParseError = err instanceof Error ? err.message : 'Failed to parse';
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      projectId: projectId || null,
      hasServiceAccountKey,
      serviceAccountEmail,
      keyParseError,
      hasOrgId,
      orgId: hasOrgId ? process.env.GCP_ORGANIZATION_ID : null,
      hasCronSecret,
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || null,
    },
  });
}
