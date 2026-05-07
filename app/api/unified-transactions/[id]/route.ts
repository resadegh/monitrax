/**
 * UNIFIED TRANSACTION BY ID API
 * Phase 13 - Transactional Intelligence
 *
 * GET    - Get single transaction
 * PATCH  - Update transaction (category correction, tags, etc.)
 * DELETE - Delete transaction
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.5.2
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { isPeriodEditable } from '@/lib/bookkeeping/period';
import {
  recordTransactionEdit,
  pickCategoryFields,
  pickLinkFields,
  type TransactionEditType,
} from '@/lib/bookkeeping/transactionEditAudit';
import { resolveOrCreateCategory } from '@/lib/bookkeeping/categoryRegistry';
import { touchStreak } from '@/lib/bookkeeping/engagement/streak';

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// GET - Single Transaction
// =============================================================================

export const GET = withPermission<RouteContext>('transaction.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      const transaction = await prisma.unifiedTransaction.findUnique({
        where: { id },
        include: { account: true },
      });

      if (!transaction) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (transaction.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Get transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transaction' },
        { status: 500 }
      );
    }
});

// =============================================================================
// PATCH - Update Transaction (Category Correction, Tags)
// =============================================================================

export const PATCH = withPermission<RouteContext>('transaction.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;
      const body = await request.json();

      // Verify ownership
      const existing = await prisma.unifiedTransaction.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      // Phase 42 PR1 — refuse mutations on LOCKED bookkeeping periods.
      // Per `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §3 D-42-3:
      // LOCKED is opt-in and rare (Tax Pack handed to accountant). Edits
      // are blocked at the API layer until the user explicitly unlocks.
      // Pre-existing audit trail (TransactionEdit) preserves history.
      const periodEditable = await isPeriodEditable(userId, existing.date);
      if (!periodEditable) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PERIOD_LOCKED',
              message:
                'This transaction is in a locked month. Unlock the period before editing.',
            },
          },
          { status: 423 } // 423 Locked
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      // Category correction
      if (body.categoryLevel1 !== undefined) {
        updateData.categoryLevel1 = body.categoryLevel1;
        updateData.userCorrectedCategory = true;
        updateData.confidenceScore = 1.0;

        // Phase 42 PR2 — SSOT bridge (carryover from PR1). Every
        // category written via the PATCH path lazily seeds the
        // CanonicalCategoryRegistry. Race-tolerant; no-op if the
        // (level1, level2, subcategory) triple already exists for
        // this user. Per CLAUDE.md §12.2 the registry is the single
        // canonical source for category labels — the legacy string
        // columns on the transaction continue to populate for
        // backwards-compat with `getMasterFinancialSnapshot` and the
        // expense / income aggregators.
        await resolveOrCreateCategory({
          userId,
          level1: body.categoryLevel1,
          level2: body.categoryLevel2 ?? null,
          subcategory: body.subcategory ?? null,
        });

        // Create merchant mapping for learning
        if (existing.merchantStandardised) {
          await prisma.merchantMapping.upsert({
            where: {
              userId_merchantRaw: {
                userId,
                merchantRaw: existing.merchantStandardised.toLowerCase(),
              },
            },
            update: {
              categoryLevel1: body.categoryLevel1,
              categoryLevel2: body.categoryLevel2 || null,
              subcategory: body.subcategory || null,
              confidence: 1.0,
              source: 'USER',
              usageCount: { increment: 1 },
            },
            create: {
              userId,
              merchantRaw: existing.merchantStandardised.toLowerCase(),
              merchantStandardised: existing.merchantStandardised,
              categoryLevel1: body.categoryLevel1,
              categoryLevel2: body.categoryLevel2 || null,
              subcategory: body.subcategory || null,
              confidence: 1.0,
              source: 'USER',
              usageCount: 1,
            },
          });
        }
      }

      if (body.categoryLevel2 !== undefined) {
        updateData.categoryLevel2 = body.categoryLevel2;
      }

      if (body.subcategory !== undefined) {
        updateData.subcategory = body.subcategory;
      }

      // Tags
      if (body.tags !== undefined) {
        updateData.tags = body.tags;
      }

      // Entity linking
      if (body.propertyId !== undefined) {
        updateData.propertyId = body.propertyId || null;
      }
      if (body.loanId !== undefined) {
        updateData.loanId = body.loanId || null;
      }
      if (body.incomeId !== undefined) {
        updateData.incomeId = body.incomeId || null;
      }
      if (body.expenseId !== undefined) {
        updateData.expenseId = body.expenseId || null;
      }

      // Recurring override
      if (body.isRecurring !== undefined) {
        updateData.isRecurring = body.isRecurring;
      }

      const transaction = await prisma.unifiedTransaction.update({
        where: { id },
        data: updateData,
        include: { account: true },
      });

      // Phase 42 PR1 — record per-mutation audit row(s). Fire-and-forget
      // per CLAUDE.md §12.10. The deepEqual short-circuit inside
      // recordTransactionEdit means no row is written when an edit
      // didn't actually change a value.
      const editTypes: TransactionEditType[] = [];
      if (
        body.categoryLevel1 !== undefined ||
        body.categoryLevel2 !== undefined ||
        body.subcategory !== undefined
      ) {
        editTypes.push('CATEGORY');
      }
      if (
        body.propertyId !== undefined ||
        body.loanId !== undefined ||
        body.incomeId !== undefined ||
        body.expenseId !== undefined
      ) {
        editTypes.push('LINK_ENTITY');
      }
      if (body.tags !== undefined) editTypes.push('TAGS');
      if (body.isRecurring !== undefined) editTypes.push('RECURRING');

      if (editTypes.includes('CATEGORY')) {
        recordTransactionEdit({
          transactionId: id,
          userId,
          editType: 'CATEGORY',
          before: pickCategoryFields(existing),
          after: pickCategoryFields(transaction),
          source: 'USER',
        });
      }
      if (editTypes.includes('LINK_ENTITY')) {
        recordTransactionEdit({
          transactionId: id,
          userId,
          editType: 'LINK_ENTITY',
          before: pickLinkFields(existing),
          after: pickLinkFields(transaction),
          source: 'USER',
        });
      }
      if (editTypes.includes('TAGS')) {
        recordTransactionEdit({
          transactionId: id,
          userId,
          editType: 'TAGS',
          before: { tags: existing.tags },
          after: { tags: transaction.tags },
          source: 'USER',
        });
      }
      if (editTypes.includes('RECURRING')) {
        recordTransactionEdit({
          transactionId: id,
          userId,
          editType: 'RECURRING',
          before: { isRecurring: existing.isRecurring },
          after: { isRecurring: transaction.isRecurring },
          source: 'USER',
        });
      }

      // Phase 42 PR6 — touch the engagement streak. Fire-and-forget per
      // CLAUDE.md §12.10; a streak failure NEVER breaks the calling
      // mutation. Idempotent on the same calendar day so spam-clicking
      // doesn't double-count.
      if (editTypes.includes('CATEGORY') || editTypes.includes('LINK_ENTITY')) {
        touchStreak(userId).catch(() => {});
      }

      return NextResponse.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Update transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction' },
        { status: 500 }
      );
    }
});

// =============================================================================
// DELETE - Delete Transaction
// =============================================================================

export const DELETE = withPermission<RouteContext>('transaction.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      // Verify ownership
      const existing = await prisma.unifiedTransaction.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      await prisma.unifiedTransaction.delete({ where: { id } });

      return NextResponse.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
      console.error('Delete transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }
});
