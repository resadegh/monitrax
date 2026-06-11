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
  getConfidenceSummary,
  type ConfidenceBand,
} from '@/lib/bank/bulkConfirm';

export const GET = withPermission('transaction.read', async (_request: NextRequest, auth) => {
  const summary = await getConfidenceSummary(auth.userId);
  return NextResponse.json({ success: true, data: summary });
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
          message: "Provide band ('medium' | 'low') or a non-empty reviewItemIds array",
        },
      },
      { status: 400 }
    );
  }

  const result = await bulkConfirmCategorisations(auth.userId, { band, reviewItemIds });
  return NextResponse.json({ success: true, data: result });
});
