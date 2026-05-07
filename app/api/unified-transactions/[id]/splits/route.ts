/**
 * Phase 42 PR2 — Transaction split API.
 *
 * GET    /api/unified-transactions/[id]/splits   — list splits
 * PUT    /api/unified-transactions/[id]/splits   — replace all splits
 * DELETE /api/unified-transactions/[id]/splits   — clear all splits
 *
 * "Replace" rather than "create" semantics — the Phase 42 split model
 * represents the COMPLETE per-line breakdown of a transaction, not a
 * partial layer. Mutating means swapping the whole set; the service
 * layer (`lib/bookkeeping/splits.ts:replaceSplits`) is the canonical
 * entry point that runs sum-validation + propagates the dominant
 * category up to the parent.
 *
 * Per CLAUDE.md §0 architect lens, the route handler is THIN — every
 * decision lives in the service module.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { isPeriodEditable } from '@/lib/bookkeeping/period';
import {
  replaceSplits,
  clearSplits,
  listSplits,
  resolveOrCreateCategoryForSplit,
  SplitValidationError,
  type SplitInput,
} from '@/lib/bookkeeping/splits';
import prisma from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

interface PutSplitInput {
  amount: number;
  /** Either a resolved registry id... */
  categoryId?: string;
  /** ...or a level1/2/sub triple to lazy-seed. */
  categoryLevel1?: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  propertyId?: string | null;
  loanId?: string | null;
  expenseId?: string | null;
  isTaxDeductible?: boolean;
  note?: string | null;
}

interface PutBody {
  splits: PutSplitInput[];
}

function mapValidationError(err: SplitValidationError): NextResponse {
  const status =
    err.code === 'TX_NOT_FOUND'
      ? 404
      : err.code === 'NOT_OWNER' || err.code === 'CATEGORY_NOT_FOUND'
      ? 403
      : err.code === 'PERIOD_LOCKED'
      ? 423
      : 400;
  return NextResponse.json(
    { success: false, error: { code: err.code, message: err.message } },
    { status }
  );
}

// =============================================================================
// GET — list splits for a transaction
// =============================================================================

export const GET = withPermission<RouteContext>('transaction.read', async (_request, auth, context) => {
  const { id } = await context!.params;
  const splits = await listSplits(id, auth.userId);
  return NextResponse.json({ success: true, data: { splits } });
});

// =============================================================================
// PUT — replace all splits
// =============================================================================

export const PUT = withPermission<RouteContext>('transaction.write', async (request: NextRequest, auth, context) => {
  const { id } = await context!.params;

  // LOCKED-period guard: same rule as the [id] PATCH route — edits to a
  // LOCKED bookkeeping period return HTTP 423 until unlocked.
  const tx = await prisma.unifiedTransaction.findUnique({
    where: { id },
    select: { userId: true, date: true },
  });
  if (!tx) {
    return NextResponse.json(
      { success: false, error: { code: 'TX_NOT_FOUND', message: 'Transaction not found' } },
      { status: 404 }
    );
  }
  if (tx.userId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_OWNER', message: 'Unauthorized' } },
      { status: 403 }
    );
  }
  const editable = await isPeriodEditable(auth.userId, tx.date);
  if (!editable) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PERIOD_LOCKED',
          message: 'This transaction is in a locked month. Unlock the period before editing.',
        },
      },
      { status: 423 }
    );
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'JSON body required' } },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.splits) || body.splits.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'EMPTY_SPLITS', message: 'splits[] is required and must be non-empty' },
      },
      { status: 400 }
    );
  }

  // Resolve any string-based categories to registry IDs upfront. Per
  // CLAUDE.md §12.2 SSOT — all category writes flow through the
  // `CanonicalCategoryRegistry`.
  const resolvedSplits: SplitInput[] = await Promise.all(
    body.splits.map(async (s) => {
      let categoryId = s.categoryId;
      if (!categoryId) {
        if (!s.categoryLevel1) {
          throw new SplitValidationError(
            'Each split must specify either categoryId OR categoryLevel1',
            'CATEGORY_NOT_FOUND'
          );
        }
        categoryId = await resolveOrCreateCategoryForSplit({
          userId: auth.userId,
          level1: s.categoryLevel1,
          level2: s.categoryLevel2 ?? null,
          subcategory: s.subcategory ?? null,
        });
      }
      return {
        amount: s.amount,
        categoryId,
        propertyId: s.propertyId ?? null,
        loanId: s.loanId ?? null,
        expenseId: s.expenseId ?? null,
        isTaxDeductible: s.isTaxDeductible ?? false,
        note: s.note ?? null,
      };
    })
  );

  try {
    const result = await replaceSplits({
      transactionId: id,
      userId: auth.userId,
      splits: resolvedSplits,
      source: 'USER',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof SplitValidationError) return mapValidationError(err);
    console.error('[splits PUT] failed:', err);
    return NextResponse.json(
      { success: false, error: { code: 'SPLIT_FAILED', message: 'Failed to update splits' } },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE — clear all splits (transaction reverts to single-category)
// =============================================================================

export const DELETE = withPermission<RouteContext>('transaction.write', async (_request, auth, context) => {
  const { id } = await context!.params;
  try {
    const result = await clearSplits(id, auth.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof SplitValidationError) return mapValidationError(err);
    console.error('[splits DELETE] failed:', err);
    return NextResponse.json(
      { success: false, error: { code: 'SPLIT_FAILED', message: 'Failed to clear splits' } },
      { status: 500 }
    );
  }
});
