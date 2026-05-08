/**
 * POST /api/portal/practice/alerts/generate
 *
 * Cron-only endpoint that runs the Practice alert engine across every
 * org with at least one ACTIVE+GRANTED OrganizationClient. Designed to
 * be called by GCP Cloud Scheduler daily at 04:00 UTC — one hour
 * after the conversation retention sweep at 03:00 UTC, two hours
 * after the CDR consent-expiry cron at 02:00 UTC.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` header — same shared
 * secret as `/api/cdr/lifecycle` and the conversation sweeper.
 * Verified via timing-safe compare. Unauthorised hits write a
 * `BLOCKED` audit row.
 *
 * Body: none required. Future tuning fields could go here.
 *
 * Response:
 *   { success: true, organizationsProcessed: number,
 *     clientsProcessed: number, alertsCreated: number,
 *     alertsAutoClosed: number, durationMs: number }
 *
 * Returns 200 even when nothing fired (zero-fire is success — the
 * engine ran). Non-2xx is reserved for auth + unexpected error.
 *
 * GCP Cloud Scheduler config:
 *   Name:     monitrax-practice-alert-engine
 *   Schedule: 0 4 * * * (daily 04:00 UTC)
 *   Target:   POST https://monitrax.com.au/api/portal/practice/alerts/generate
 *   Headers:  { "Authorization": "Bearer <CRON_SECRET>" }
 *   See `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` §5.
 *
 * Closes Phase 32B PR3 item #9.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateAlertsForAllOrganizations } from '@/lib/services/practiceAlertEngine';
import { createAuditLog } from '@/lib/security/auditLog';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
// First-run on a long-history org could touch many clients × 30 days
// of snapshot history. 5 minutes is the Vercel Pro hard cap.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // 1. CRON_SECRET auth (timing-safe).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'CRON_SECRET not configured' },
      },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const tokenBuffer = Buffer.from(token, 'utf-8');
  const secretBuffer = Buffer.from(cronSecret, 'utf-8');
  const isValid =
    tokenBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isValid) {
    createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      status: 'BLOCKED',
      entityType: 'PracticeAlertEngineCron',
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      metadata: {
        endpoint: '/api/portal/practice/alerts/generate',
        method: 'POST',
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      },
      { status: 401 },
    );
  }

  // 2. Run the engine.
  try {
    const result = await generateAlertsForAllOrganizations();

    return NextResponse.json({
      success: true,
      organizationsProcessed: result.organizationsProcessed,
      clientsProcessed: result.clientsProcessed,
      alertsCreated: result.alertsCreated,
      alertsAutoClosed: result.alertsAutoClosed,
      durationMs: result.durationMs,
    });
  } catch (err) {
    log.error('[practice-alert-engine-cron] failed', err as Error);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GENERATE_FAILED', message },
      },
      { status: 500 },
    );
  }
}
