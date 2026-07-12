/**
 * NEOAUDIT RELEASE SCORECARD — GET /api/admin/neoaudit/scorecard (NEOAUDIT.md §6).
 *
 * The registry half of the publish gate: how many number-changing issues are
 * still unverified (a publish blocker, §19.5). Admin/architecture surface —
 * gated exactly like the Neomatrix graph route (`audit:read`). The registry is
 * imported (bundled at build) so it resolves on Vercel serverless without a
 * filesystem read — same pattern as `/api/admin/neomatrix/graph`.
 *
 * Per §22.2.4 this returns gate OUTPUT (counts + the external-check names); the
 * panel renders the honest verdict, never a bare "safe to publish" claim.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { summarizeScorecard, type RegistryIssue } from '@/lib/verification/scorecard';
import registry from '@/docs/issues/ISSUES.json';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'You do not have permission to view the NeoAudit scorecard' } },
      { status: 403 },
    );
  }

  const issues = ((registry as { issues?: RegistryIssue[] }).issues ?? []) as RegistryIssue[];
  return NextResponse.json({ success: true, data: summarizeScorecard(issues) });
}
