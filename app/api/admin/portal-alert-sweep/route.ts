/**
 * POST /api/admin/portal-alert-sweep — Phase 32B PR3 post-#9b polish.
 *
 * SUPER_ADMIN-only "run the portal alert sweep now" endpoint. Mirrors
 * what GCP Cloud Scheduler does on its daily `0 4 * * *` trigger
 * (`POST /api/portal/alerts/sweep`) but is reachable from the admin
 * portal — useful before the scheduler job is wired, for a one-off
 * recompute after onboarding a new client, or for a dry-run preview
 * ("what would the sweep do?") without touching any rows.
 *
 * The work itself lives in `lib/portal/alerts/sweepRunner.ts`
 * (`runPortalAlertSweep`) — this route is the admin-auth wrapper
 * (the cron route is the CRON_SECRET wrapper). One implementation,
 * two front doors (CLAUDE.md §12.2 SSOT).
 *
 * Body (optional, JSON):
 *   { dryRun?: boolean; organizationId?: string }
 *   — `dryRun` computes everything and writes nothing;
 *     `organizationId` limits the sweep to one org.
 *
 * Returns: { ...PortalAlertSweepResult, runBy } on success.
 *
 * CLAUDE.md §13.4 (the cron path uses CRON_SECRET; this path uses the
 * admin session) + §13.3 (alerts + the marker carry aggregates only).
 */

import { NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { runPortalAlertSweep } from '@/lib/portal/alerts/sweepRunner';
import { createAuditLog } from '@/lib/security/auditLog';

// One snapshot per active client across all orgs — same envelope as the
// cron route. 300s is the Vercel Pro hard cap.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RunSweepBody {
  dryRun?: boolean;
  organizationId?: string;
}

export async function POST(request: Request) {
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status:
          authResult.error?.code === ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED ? 503 : 401,
      },
    );
  }

  if (authResult.context.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Only SUPER_ADMIN can run the portal alert sweep.',
        },
      },
      { status: 403 },
    );
  }

  let body: RunSweepBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as RunSweepBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }

  const dryRun = body.dryRun === true;

  try {
    const result = await runPortalAlertSweep({ dryRun, organizationId: body.organizationId });

    createAuditLog({
      userId: authResult.context.adminId,
      action: 'UPDATE',
      status: 'SUCCESS',
      entityType: 'PortalAlertSweep',
      metadata: {
        trigger: 'admin-manual',
        adminEmail: authResult.context.email,
        dryRun,
        organizationId: body.organizationId ?? null,
        orgsProcessed: result.orgsProcessed,
        clientsProcessed: result.clientsProcessed,
        alertsCreated: result.alertsCreated,
        alertsUpdated: result.alertsUpdated,
        alertsResolved: result.alertsResolved,
        errorCount: result.errors.length,
      },
    }).catch(() => {});

    return NextResponse.json({ ...result, runBy: authResult.context.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    createAuditLog({
      userId: authResult.context.adminId,
      action: 'UPDATE',
      status: 'FAILURE',
      entityType: 'PortalAlertSweep',
      metadata: { trigger: 'admin-manual', adminEmail: authResult.context.email, dryRun, message },
    }).catch(() => {});
    return NextResponse.json(
      { success: false, error: { code: 'SWEEP_FAILED', message } },
      { status: 500 },
    );
  }
}
