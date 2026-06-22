/**
 * Phase 52 — KB housekeeping cron endpoint.
 *
 *   POST /api/categorisation/kb/housekeeping
 *
 * Prunes stale provisional signatures + returns a KB-health report. Designed for
 * GCP Cloud Scheduler (e.g. weekly). Authenticated via `CRON_SECRET` (not user
 * auth) — mirrors `/api/cdr/lifecycle`. See
 * docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §6b.
 *
 * GCP Cloud Scheduler config:
 *   Schedule: 0 3 * * 0  (weekly, Sunday 03:00 Australia/Sydney)
 *   HTTP Target: POST https://<domain>/api/categorisation/kb/housekeeping
 *   Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runKbHousekeeping } from '@/lib/categorisation/kb/housekeeping';
import { createAuditLog } from '@/lib/security/auditLog';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const tokenBuffer = Buffer.from(token, 'utf-8');
  const secretBuffer = Buffer.from(cronSecret, 'utf-8');
  const isValid =
    tokenBuffer.length === secretBuffer.length && crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isValid) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron token' } },
      { status: 401 }
    );
  }

  const report = await runKbHousekeeping();

  createAuditLog({
    action: 'CREATE',
    entityType: 'TransactionSignature',
    metadata: { kbHousekeeping: true, ...report },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: report });
}
