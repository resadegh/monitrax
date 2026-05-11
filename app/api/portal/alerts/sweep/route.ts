/**
 * POST /api/portal/alerts/sweep — Phase 32B PR3 #9a
 *
 * Cron-only endpoint that recomputes the Practice "needs attention
 * today" alert stream for every organisation's active clients.
 * Designed to be called by GCP Cloud Scheduler daily — pick an off-peak
 * slot that doesn't fight the CDR retention crons (02:00 / 03:00 UTC).
 *
 * The actual work lives in `lib/portal/alerts/sweepRunner.ts`
 * (`runPortalAlertSweep`) so the cron path and the admin "run sweep
 * now" path (`POST /api/admin/portal-alert-sweep`) share one
 * implementation (CLAUDE.md §12.2 SSOT). This route is the thin
 * cron-auth wrapper.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` — same shared secret as
 * `/api/cdr/lifecycle` + `/api/conversations/retention-sweep`. Verified
 * via timing-safe compare. Unauthorised hits write a `BLOCKED` audit
 * row (mirrors the other crons).
 *
 * Body (optional, JSON):
 *   { dryRun?: boolean; organizationId?: string }
 *   — `dryRun` computes everything but writes nothing (admin preview);
 *     `organizationId` limits the sweep to one org (testing / backfill).
 *
 * Response: { success, orgsProcessed, clientsProcessed, clientsSkipped,
 *             alertsCreated, alertsUpdated, alertsResolved, durationMs,
 *             dryRun, errors }. Returns 200 even when nothing changed.
 *
 * GCP Cloud Scheduler config:
 *   Name:     monitrax-portal-alert-sweep
 *   Schedule: 0 4 * * * (daily 04:00 UTC — after the retention crons)
 *   Target:   POST https://<domain>/api/portal/alerts/sweep
 *   Headers:  { "Authorization": "Bearer <CRON_SECRET>" }
 *
 * CLAUDE.md §13.4 (CRON_SECRET pattern) + §13.3 (alerts carry
 * aggregates only — no raw CDR data in payloads).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPortalAlertSweep } from '@/lib/portal/alerts/sweepRunner';
import { createAuditLog } from '@/lib/security/auditLog';

export const dynamic = 'force-dynamic';
// A full sweep computes one snapshot per active client across all orgs.
// At lighthouse scale (a handful of orgs × tens of clients) this is
// well under a minute, but the 5-minute Vercel Pro cap gives headroom
// for growth before this needs a queue/batch redesign.
export const maxDuration = 300;

interface SweepBody {
  dryRun?: boolean;
  organizationId?: string;
}

export async function POST(request: NextRequest) {
  // 1. Authenticate via CRON_SECRET (timing-safe compare).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const a = Buffer.from(token);
  const b = Buffer.from(cronSecret);
  const authorised = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!authorised) {
    createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      status: 'BLOCKED',
      entityType: 'PortalAlertSweep',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      metadata: { endpoint: '/api/portal/alerts/sweep', method: 'POST' },
    }).catch(() => {});
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      { status: 401 },
    );
  }

  // 2. Parse the (optional) body.
  let body: SweepBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as SweepBody;
  } catch {
    // Malformed body → treat as defaults. Not worth a 400 for a cron.
  }

  // 3. Run the shared sweep.
  const result = await runPortalAlertSweep({
    dryRun: body.dryRun === true,
    organizationId: body.organizationId,
  });

  return NextResponse.json(result);
}
