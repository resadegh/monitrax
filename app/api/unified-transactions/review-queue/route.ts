/**
 * Phase 49.4 — review-queue listing + per-item actions.
 *
 * GET  /api/unified-transactions/review-queue?band=medium|low
 *   → the PENDING queue items in that confidence band, so the user can
 *     SEE the medium/low pile before bulk-confirming (the items aren't in
 *     the transaction list — they're staged in TransactionReviewQueue).
 *
 * POST /api/unified-transactions/review-queue
 *   Body: { action: 'confirm' | 'skip', reviewItemIds: string[] }
 *   → confirm promotes the selected queue items into real transactions
 *     (shared bulkConfirmCategorisations); skip dismisses them.
 *
 * Thin wrappers per §12.3 — logic lives in lib/bank/reviewQueue.ts +
 * lib/bank/bulkConfirm.ts. Distinct from /bulk-confirm (band summary +
 * whole-band confirm) — this route is the item-level review surface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listReviewQueueByBand, skipReviewItems, type ReviewBand } from '@/lib/bank/reviewQueue';
import { bulkConfirmCategorisations } from '@/lib/bank/bulkConfirm';

export const GET = withPermission('transaction.read', async (request: NextRequest, auth) => {
  const bandParam = new URL(request.url).searchParams.get('band');
  if (bandParam !== 'medium' && bandParam !== 'low') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BAND', message: "band must be 'medium' or 'low'" } },
      { status: 400 }
    );
  }
  const items = await listReviewQueueByBand(auth.userId, bandParam as ReviewBand);
  return NextResponse.json({ success: true, data: { items } });
});

interface ReviewActionBody {
  action?: unknown;
  reviewItemIds?: unknown;
}

export const POST = withPermission('transaction.write', async (request: NextRequest, auth) => {
  let body: ReviewActionBody;
  try {
    body = (await request.json()) as ReviewActionBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'JSON body required' } },
      { status: 400 }
    );
  }

  const ids = Array.isArray(body.reviewItemIds)
    ? body.reviewItemIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'EMPTY_IDS', message: 'reviewItemIds must be a non-empty array' } },
      { status: 400 }
    );
  }

  if (body.action === 'skip') {
    const result = await skipReviewItems(auth.userId, ids);
    return NextResponse.json({ success: true, data: result });
  }
  if (body.action === 'confirm') {
    const result = await bulkConfirmCategorisations(auth.userId, { reviewItemIds: ids });
    return NextResponse.json({ success: true, data: result });
  }
  return NextResponse.json(
    { success: false, error: { code: 'INVALID_ACTION', message: "action must be 'confirm' or 'skip'" } },
    { status: 400 }
  );
});
