/**
 * Phase 52 — KB seed endpoint (build 52.4).
 *
 *   POST /api/categorisation/kb/seed
 *
 * Idempotently seeds the curated AU merchant list into the shared KB. Run once
 * (and again when the seed list grows). Authenticated via `CRON_SECRET` (mirrors
 * `/api/cdr/lifecycle` + the housekeeping endpoint). See
 * docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §7 (52.4).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { seedCategorisationKb } from '@/lib/categorisation/kb/seedKb';
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
  const a = Buffer.from(token, 'utf-8');
  const b = Buffer.from(cronSecret, 'utf-8');
  const isValid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!isValid) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron token' } },
      { status: 401 }
    );
  }

  const result = await seedCategorisationKb();

  createAuditLog({
    action: 'CREATE',
    entityType: 'TransactionSignature',
    metadata: { kbSeed: true, ...result },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: result });
}
