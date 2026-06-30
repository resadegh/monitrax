/**
 * GET /api/bookkeeping/review-queue (Phase 56.3, 2026-06-30)
 *   → the ONE canonical "needs your review" summary: { count, bands }.
 *
 * Single source of truth for "how many transactions need me?" — read by the
 * Activity headline + the band chips. The Home hero reads the same count
 * server-side via `getReviewQueueCount`, and the card-deck fetches the actual
 * rows via the list route's `uncategorized=true` filter (same predicate). So
 * every surface agrees (the SSOT fix for Reza's "78 vs 365" report, 2026-06-30).
 *
 * Thin wrapper per CLAUDE.md §12.3 — all logic lives in
 * `lib/bookkeeping/reviewQueue.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getReviewQueueBands } from '@/lib/bookkeeping/reviewQueue';

export const GET = withPermission('transaction.read', async (_request: NextRequest, auth) => {
  const bands = await getReviewQueueBands(auth.userId);
  return NextResponse.json({
    success: true,
    data: { count: bands.total, bands },
  });
});
