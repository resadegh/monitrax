/**
 * POST /api/account/lifecycle
 *
 * Account-deletion executor endpoint — the Cloud Scheduler trigger that
 * carries out the hard-deletion promised by `/api/account/delete-request`.
 * Finds every user whose 30-day grace period has elapsed
 * (`deletionScheduledFor <= now`) and irreversibly deletes them via
 * `executeScheduledDeletions()` (identity → CDR → DB, abort-on-identity-failure).
 *
 * Auth: CRON_SECRET bearer header (NOT user auth) — same pattern as
 * `/api/cdr/lifecycle`. Intended to be invoked daily by GCP Cloud Scheduler.
 *
 *   POST /api/account/lifecycle
 *   Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 *
 * Privacy Act 1988 (Cth) APP 11.2 + CDR §3.2 right-to-deletion.
 *
 * CLAUDE.md §12.11 destructive-write checklist:
 *   1. WHERE clause matches: users with `deletionRequestedAt != null` AND
 *      `deletionScheduledFor <= now` — i.e. only users who themselves
 *      requested deletion and whose 30-day grace has expired. No row is
 *      touched that the user did not explicitly flag.
 *   2. Columns/rows: full hard-delete of the user + owned entities (see
 *      `lib/services/accountDeletion.ts` for the ordered cascade).
 *   3. Guard: the executor re-reads each user inside `deleteUserAccount`;
 *      identity deletion runs first and ABORTS the data deletion on failure,
 *      so an account is never left half-deleted / resurrectable.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAuditLog } from '@/lib/security/auditLog';
import { executeScheduledDeletions } from '@/lib/services/accountDeletion';

export async function POST(request: NextRequest) {
  // Authenticate cron job via CRON_SECRET (timing-safe).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const tokenBuffer = Buffer.from(token || '', 'utf-8');
  const secretBuffer = Buffer.from(cronSecret, 'utf-8');
  const isValid =
    tokenBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isValid) {
    createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      status: 'BLOCKED',
      entityType: 'AccountLifecycle',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      metadata: { endpoint: '/api/account/lifecycle', method: 'POST' },
    }).catch(() => {});

    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      { status: 401 },
    );
  }

  try {
    const start = Date.now();
    const summary = await executeScheduledDeletions();

    return NextResponse.json({
      success: true,
      data: {
        processed: summary.processed,
        deleted: summary.deleted,
        failed: summary.failed,
        // Per-user error detail aids the post-merge log read (CLAUDE.md §17)
        // without leaking PII — only ids + statuses, never CDR data.
        failures: summary.results
          .filter((r) => !r.success)
          .map((r) => ({ userId: r.userId, identityStatus: r.identityStatus, error: r.error })),
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      },
    });
  } catch (error) {
    console.error('Account lifecycle job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Account lifecycle job failed',
        },
      },
      { status: 500 },
    );
  }
}
