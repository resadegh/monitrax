/**
 * Phase 49 (Activity redesign) — confidence-based bulk confirmation.
 *
 * GET  /api/unified-transactions/bulk-confirm
 *   → confidence summary { high, medium, low, uncategorised } for the
 *     "AI bookkeeper" card.
 *
 * POST /api/unified-transactions/bulk-confirm
 *   Body: { band?: 'medium' | 'low', reviewItemIds?: string[] }
 *   → promotes review-queue items in the band (or by id) into real
 *     UnifiedTransactions, accepting the AI's category as-is. Band mode
 *     powers "Confirm all N medium" / "Confirm N low".
 *
 * Thin wrappers per CLAUDE.md §12.3 — all logic lives in the canonical
 * service lib/bank/bulkConfirm.ts. Distinct concern from bulk-categorise
 * (which RE-categorises to a user-chosen triple); this endpoint only
 * promotes the AI's own work to user-confirmed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  bulkConfirmCategorisations,
  bulkConfirmHighBand,
  getCategorisableTotal,
  getConfidenceSummary,
  getReviewQueueBands,
  type ConfidenceBand,
} from '@/lib/bank/bulkConfirm';

export const GET = withPermission('transaction.read', async (_request: NextRequest, auth) => {
  // Phase 56.3 — return the legacy confidence summary AND the ONE canonical
  // review-queue count + bands (the SSOT every surface reads): `reviewCount` +
  // `reviewBands` (high/medium/low partition the same unconfirmed set → they
  // sum to reviewCount). Fixes the "Home 78 vs Activity 365" divergence.
  // Phase 56.7 — also return `categorisableTotal` (the real denominator) so the
  // state-aware Review tile can show a TRUE "% categorised" (§19), not a guess.
  const [summary, reviewBands, categorisableTotal] = await Promise.all([
    getConfidenceSummary(auth.userId),
    getReviewQueueBands(auth.userId),
    getCategorisableTotal(auth.userId),
  ]);
  return NextResponse.json({
    success: true,
    data: { ...summary, reviewCount: reviewBands.total, reviewBands, categorisableTotal },
  });
});

interface BulkConfirmBody {
  band?: unknown;
  reviewItemIds?: unknown;
}

export const POST = withPermission('transaction.write', async (request: NextRequest, auth) => {
  let body: BulkConfirmBody;
  try {
    body = (await request.json()) as BulkConfirmBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'JSON body required' } },
      { status: 400 }
    );
  }

  // Phase 49.13 — 'high' confirms in place (rows are already transactions);
  // medium/low promote out of the review queue.
  if (body.band === 'high') {
    const result = await bulkConfirmHighBand(auth.userId);
    return NextResponse.json({ success: true, data: result });
  }

  const band =
    body.band === 'medium' || body.band === 'low' ? (body.band as ConfidenceBand) : undefined;
  const reviewItemIds = Array.isArray(body.reviewItemIds)
    ? body.reviewItemIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : undefined;

  if (!band && (!reviewItemIds || reviewItemIds.length === 0)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: "Provide band ('high' | 'medium' | 'low') or a non-empty reviewItemIds array",
        },
      },
      { status: 400 }
    );
  }

  const result = await bulkConfirmCategorisations(auth.userId, { band, reviewItemIds });
  return NextResponse.json({ success: true, data: result });
});
