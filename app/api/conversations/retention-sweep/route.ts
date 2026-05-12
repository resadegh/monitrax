/**
 * POST /api/conversations/retention-sweep
 *
 * Cron-only endpoint that sweeps `ConversationMessage` rows past their
 * 7-year retention window (`retentionUntil < now()`). Designed to be
 * called by GCP Cloud Scheduler daily at 03:00 Australia/Sydney (AEST/AEDT) — one hour after
 * the CDR retention cron at 02:00 Australia/Sydney (AEST/AEDT) so they don't fight for DB CPU
 * on warm-up.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` header — same shared
 * secret as `/api/cdr/lifecycle`. Verified via timing-safe compare
 * (G27 fix). Unauthorised hits write a `BLOCKED` audit row.
 *
 * Body (optional, JSON):
 *   { batchSize?: number; maxRows?: number; dryRun?: boolean }
 *   — defaults are tuned for the daily cron; admin UI may pass
 *   `dryRun: true` to preview the next sweep.
 *
 * Response:
 *   { success: true, purged: number, batches: number, durationMs: number,
 *     oldestExpiredAt?: ISO, newestExpiredAt?: ISO, capHit: boolean,
 *     dryRun: boolean }
 *
 * Returns 200 even when nothing was purged (zero-purge is success — the
 * sweep ran and there was nothing to do). Non-2xx is reserved for auth
 * failure or unexpected error.
 *
 * GCP Cloud Scheduler config:
 *   Name:     monitrax-conversation-retention-sweep
 *   Schedule: 0 3 * * * (daily 03:00 Australia/Sydney (AEST/AEDT))
 *   Target:   POST https://<domain>/api/conversations/retention-sweep
 *   Headers:  { "Authorization": "Bearer <CRON_SECRET>" }
 *   See `docs/operational/runbooks/RETENTION_SCHEDULERS.md` for the
 *   full setup.
 *
 * CLAUDE.md §13.5 (no indefinite retention) + §13.4 (CRON_SECRET pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepExpiredMessages } from '@/lib/services/conversationRetentionService';
import { createAuditLog } from '@/lib/security/auditLog';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
// First sweep after switching this on for a long-history org could
// delete tens of thousands of rows. 5 minutes is the Vercel Pro hard
// cap and gives plenty of headroom — the in-service `maxRows` cap of
// 50k provides a structural backstop too.
export const maxDuration = 300;

interface SweepBody {
  batchSize?: number;
  maxRows?: number;
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
  // 1. Authenticate via CRON_SECRET (timing-safe compare).
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
    // Audit unauthorised cron attempt — same pattern as CDR lifecycle.
    createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      status: 'BLOCKED',
      entityType: 'ConversationRetentionSweep',
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      metadata: {
        endpoint: '/api/conversations/retention-sweep',
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

  // 2. Parse optional tuning body (admin UI uses `dryRun: true`).
  let body: SweepBody = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = (await request.json()) as SweepBody;
    } catch {
      // Tolerate empty / invalid body — cron-driven calls send none.
    }
  }

  // 3. Run the sweep.
  try {
    const result = await sweepExpiredMessages({
      batchSize: body.batchSize,
      maxRows: body.maxRows,
      dryRun: body.dryRun,
    });

    return NextResponse.json({
      success: true,
      purged: result.purged,
      batches: result.batches,
      oldestExpiredAt: result.oldestExpiredAt?.toISOString(),
      newestExpiredAt: result.newestExpiredAt?.toISOString(),
      durationMs: result.durationMs,
      capHit: result.capHit,
      dryRun: result.dryRun,
    });
  } catch (err) {
    log.error('[conversation-retention] sweep failed', err as Error);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SWEEP_FAILED', message },
      },
      { status: 500 },
    );
  }
}
