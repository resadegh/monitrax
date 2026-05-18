/**
 * Phase 42 PR3.5 — Receipt picker endpoint.
 *
 *   POST /api/bookkeeping/receipts/pick-match
 *     { documentId, expenseId, transactionId }
 *
 * Called by the `<ReceiptCandidatePicker>` UI after the user selects
 * one of the candidates returned in a `PICK_FROM` verdict (composite
 * score 0.7–0.95 — high enough to be plausible but too ambiguous for
 * the auto-link path at ≥0.95).
 *
 * Per CLAUDE.md §12.3 SSOT — calls the shared `linkReceiptToTransaction()`
 * helper in `lib/bookkeeping/receiptMatcher.ts`. The same helper the
 * AUTO_LINK branch in `/api/documents/analyze/confirm` uses; no
 * duplicate link logic anywhere in the codebase.
 *
 * Auth: `transaction.write` permission (same gate as any path that
 * mutates a UnifiedTransaction's link state).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  linkReceiptToTransaction,
  ReceiptLinkError,
} from '@/lib/bookkeeping/receiptMatcher';

interface PickMatchBody {
  documentId?: unknown;
  expenseId?: unknown;
  transactionId?: unknown;
}

export const POST = withPermission(
  'transaction.write',
  async (request: NextRequest, auth) => {
    let body: PickMatchBody;
    try {
      body = (await request.json()) as PickMatchBody;
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
        { status: 400 }
      );
    }

    const { documentId, expenseId, transactionId } = body;
    if (
      typeof documentId !== 'string' ||
      typeof expenseId !== 'string' ||
      typeof transactionId !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'documentId, expenseId, and transactionId must be strings',
          },
        },
        { status: 400 }
      );
    }

    try {
      const updated = await linkReceiptToTransaction({
        userId: auth.userId,
        transactionId,
        documentId,
        expenseId,
        source: 'USER',
      });
      return NextResponse.json({
        success: true,
        data: {
          transactionId: updated.id,
          documentId: updated.matchedDocumentId,
          expenseId: updated.expenseId,
        },
      });
    } catch (err) {
      if (err instanceof ReceiptLinkError) {
        const status = err.code === 'RECEIPT_LINK_NOT_FOUND' ? 404 : 409;
        return NextResponse.json(
          { success: false, error: { code: err.code, message: err.message } },
          { status }
        );
      }
      console.error('[receipts/pick-match] unexpected error:', err);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL', message: 'Failed to link receipt' } },
        { status: 500 }
      );
    }
  }
);
