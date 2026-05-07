/**
 * Phase 42 PR3 — Cash quick-add API.
 *
 * POST /api/unified-transactions/cash
 *
 * Body: {
 *   amount: number,           // POSITIVE; direction inferred (default OUT)
 *   description: string,      // free-form ("Coffee with Anita")
 *   date?: string,            // YYYY-MM-DD; defaults to today
 *   direction?: 'IN' | 'OUT', // defaults OUT
 *   categoryLevel1?: string,  // optional category seed
 * }
 *
 * Three-second action — sole-trader / market-seller path. Idempotently
 * creates a CASH-type Account on first call (`getOrCreateCashAccount`),
 * then writes a `UnifiedTransaction` with `source='MANUAL'` against it.
 *
 * Per CLAUDE.md §12.2 SSOT — cash transactions live on the same
 * `unified_transactions` table as everything else. There is no parallel
 * cash ledger; net-worth + emergency-fund snapshots see them via
 * `LIQUID_ACCOUNT_TYPES` (extended in this PR).
 *
 * Per CLAUDE.md §12.3 — the categoriser SSOT bridge from PR2 fires:
 * if a `categoryLevel1` is supplied, it lazy-seeds
 * `CanonicalCategoryRegistry`. Audit row is written via the same
 * `recordTransactionEdit` helper used by every other mutation path.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getOrCreateCashAccount } from '@/lib/bookkeeping/cashAccount';
import { resolveOrCreateCategory } from '@/lib/bookkeeping/categoryRegistry';
import { recordTransactionEdit, pickCategoryFields } from '@/lib/bookkeeping/transactionEditAudit';
import { isPeriodEditable } from '@/lib/bookkeeping/period';
import { touchStreak } from '@/lib/bookkeeping/engagement/streak';

interface CashAddBody {
  amount?: unknown;
  description?: unknown;
  date?: unknown;
  direction?: unknown;
  categoryLevel1?: unknown;
  categoryLevel2?: unknown;
  subcategory?: unknown;
}

export const POST = withPermission('transaction.write', async (request: NextRequest, auth) => {
  let body: CashAddBody;
  try {
    body = (await request.json()) as CashAddBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'JSON body required' } },
      { status: 400 }
    );
  }

  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'amount must be a non-zero finite number' },
      },
      { status: 400 }
    );
  }
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null;
  if (!description) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_DESCRIPTION', message: 'description is required' },
      },
      { status: 400 }
    );
  }

  const direction: 'IN' | 'OUT' = body.direction === 'IN' ? 'IN' : 'OUT';
  // Sign convention matches the rest of the unified ledger: OUT is
  // negative, IN is positive. Receipt of POSITIVE amount in body lets
  // mobile keypads stay simple ("how much?" → 12.50).
  const signedAmount = direction === 'OUT' ? -Math.abs(amount) : Math.abs(amount);

  const dateStr = typeof body.date === 'string' ? body.date : null;
  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_DATE', message: 'date must be a valid ISO string' } },
      { status: 400 }
    );
  }

  // LOCKED-period guard — same rule as the [id] PATCH path.
  const editable = await isPeriodEditable(auth.userId, date);
  if (!editable) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PERIOD_LOCKED',
          message:
            'That month is locked. Unlock the bookkeeping period before adding cash transactions to it.',
        },
      },
      { status: 423 }
    );
  }

  const categoryLevel1 = typeof body.categoryLevel1 === 'string' ? body.categoryLevel1 : null;
  const categoryLevel2 = typeof body.categoryLevel2 === 'string' ? body.categoryLevel2 : null;
  const subcategory = typeof body.subcategory === 'string' ? body.subcategory : null;

  // SSOT bridge — every category write flows through the registry.
  if (categoryLevel1) {
    await resolveOrCreateCategory({
      userId: auth.userId,
      level1: categoryLevel1,
      level2: categoryLevel2,
      subcategory,
    });
  }

  const account = await getOrCreateCashAccount(auth.userId);

  const tx = await prisma.unifiedTransaction.create({
    data: {
      userId: auth.userId,
      accountId: account.id,
      date,
      amount: signedAmount,
      currency: 'AUD',
      direction,
      description,
      merchantRaw: description,
      merchantStandardised: description,
      categoryLevel1,
      categoryLevel2,
      subcategory,
      userCorrectedCategory: Boolean(categoryLevel1),
      confidenceScore: categoryLevel1 ? 1.0 : null,
      source: 'MANUAL',
      processedAt: new Date(),
    },
  });

  // Audit. Cash adds are user-initiated; the "before" is empty (the
  // row didn't exist) so we record the creation as a CATEGORY edit
  // when a category was supplied, otherwise just the bare creation.
  if (categoryLevel1) {
    recordTransactionEdit({
      transactionId: tx.id,
      userId: auth.userId,
      editType: 'CATEGORY',
      before: pickCategoryFields({}),
      after: pickCategoryFields({
        categoryLevel1,
        categoryLevel2,
        subcategory,
        userCorrectedCategory: true,
        confidenceScore: 1.0,
      }),
      source: 'USER',
    });
  }

  // Update the cash account's balance to reflect the new transaction.
  // Manual cash flow: add IN, subtract OUT. Per CLAUDE.md §12.11 — this
  // touches a system-managed numeric field on a row the helper
  // explicitly created or owns; user did not enter the previous balance
  // (it was 0 at creation, or the cumulative effect of prior cash adds).
  await prisma.account.update({
    where: { id: account.id },
    data: {
      currentBalance: { increment: signedAmount },
      balanceLastUpdatedAt: new Date(),
    },
  });

  // Phase 42 PR6 — touch the engagement streak. A cash quick-add IS
  // categorisation activity (the user is actively engaging with the
  // ledger). Fire-and-forget per CLAUDE.md §12.10.
  touchStreak(auth.userId).catch(() => {});

  return NextResponse.json({
    success: true,
    data: { transaction: tx, account: { id: account.id, name: account.name, type: account.type } },
  });
});
