/**
 * Phase 42 PR2 — Bulk re-categorise endpoint.
 *
 * POST /api/unified-transactions/bulk-categorise
 *
 * Body: {
 *   transactionIds: string[],     // 1-200 transactions per call
 *   categoryLevel1: string,        // canonical category triple
 *   categoryLevel2?: string | null,
 *   subcategory?: string | null,
 * }
 *
 * Single endpoint for the Activity-page "Categorise N selected" toolbar.
 * Per CLAUDE.md §12.3 (single calculation engine) — does NOT duplicate
 * the [id] PATCH categoriser logic; it loops the same canonical writes
 * inside one Prisma transaction. Per CLAUDE.md §12.2 SSOT — every
 * category write flows through `resolveOrCreateCategory()`. Per the
 * Phase 42 spec §2 engagement principle — bulk categorisation is the
 * power-user accelerator that turns "50 transactions to review" into
 * "2 clicks done" without sacrificing the audit trail.
 *
 * Audit: every row writes a `TransactionEdit` row with editType=CATEGORY.
 * Period guard: any transaction in a LOCKED month rejects the WHOLE
 * call (not partial — atomicity matters for compliance).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { isPeriodEditable } from '@/lib/bookkeeping/period';
import { resolveOrCreateCategory } from '@/lib/bookkeeping/categoryRegistry';
import {
  recordTransactionEdit,
  pickCategoryFields,
} from '@/lib/bookkeeping/transactionEditAudit';
import { touchStreak } from '@/lib/bookkeeping/engagement/streak';
import { recordKbContribution } from '@/lib/categorisation/kb/recordFromConfirmation';

interface BulkCategoriseBody {
  transactionIds?: unknown;
  categoryLevel1?: unknown;
  categoryLevel2?: unknown;
  subcategory?: unknown;
}

const MAX_BULK = 200;

export const POST = withPermission('transaction.write', async (request: NextRequest, auth) => {
  let body: BulkCategoriseBody;
  try {
    body = (await request.json()) as BulkCategoriseBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'JSON body required' } },
      { status: 400 }
    );
  }

  // ---- validation -----------------------------------------------------------
  const ids = Array.isArray(body.transactionIds)
    ? body.transactionIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'EMPTY_IDS', message: 'transactionIds must be a non-empty array of strings' },
      },
      { status: 400 }
    );
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BATCH_TOO_LARGE',
          message: `Maximum ${MAX_BULK} transactions per bulk call (got ${ids.length})`,
        },
      },
      { status: 400 }
    );
  }
  if (typeof body.categoryLevel1 !== 'string' || body.categoryLevel1.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_CATEGORY', message: 'categoryLevel1 is required and must be a non-empty string' },
      },
      { status: 400 }
    );
  }
  const categoryLevel1 = body.categoryLevel1;
  const categoryLevel2 = typeof body.categoryLevel2 === 'string' ? body.categoryLevel2 : null;
  const subcategory = typeof body.subcategory === 'string' ? body.subcategory : null;

  // ---- ownership + period guard --------------------------------------------
  const transactions = await prisma.unifiedTransaction.findMany({
    where: { id: { in: ids }, userId: auth.userId },
    select: {
      id: true,
      date: true,
      categoryLevel1: true,
      categoryLevel2: true,
      subcategory: true,
      userCorrectedCategory: true,
      confidenceScore: true,
      merchantStandardised: true,
    },
  });

  if (transactions.length !== ids.length) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND_OR_NOT_OWNED',
          message: `${ids.length - transactions.length} of ${ids.length} transactions are missing or owned by another user`,
        },
      },
      { status: 403 }
    );
  }

  // Reject the WHOLE batch if any row sits in a locked period.
  const periodChecks = await Promise.all(
    transactions.map(async (t) => ({ id: t.id, editable: await isPeriodEditable(auth.userId, t.date) }))
  );
  const lockedTx = periodChecks.find((c) => !c.editable);
  if (lockedTx) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PERIOD_LOCKED',
          message: `Transaction ${lockedTx.id} is in a locked month. Unlock the period or remove it from the selection.`,
        },
      },
      { status: 423 }
    );
  }

  // ---- SSOT registry + canonical merchant mapping --------------------------
  // Single registry lookup for the whole batch — per CLAUDE.md §12.2
  // (one canonical source for category labels). The batch never bypasses
  // the registry.
  await resolveOrCreateCategory({
    userId: auth.userId,
    level1: categoryLevel1,
    level2: categoryLevel2,
    subcategory,
  });

  // ---- atomic update (single Prisma transaction) ---------------------------
  await prisma.$transaction(async (txnCtx) => {
    await txnCtx.unifiedTransaction.updateMany({
      where: { id: { in: ids }, userId: auth.userId },
      data: {
        categoryLevel1,
        categoryLevel2,
        subcategory,
        userCorrectedCategory: true,
        confidenceScore: 1.0,
      },
    });

    // Roll up merchant mappings for each merchant we touched (Phase 13
    // learning surface — same logic as the [id] PATCH path, just
    // batched). This is NOT a duplicate calculation; it's the same
    // mapping the per-row PATCH writes.
    const distinctMerchants = Array.from(
      new Set(
        transactions
          .map((t) => t.merchantStandardised?.toLowerCase())
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
      )
    );
    for (const merchantRaw of distinctMerchants) {
      const standardised = transactions.find(
        (t) => t.merchantStandardised?.toLowerCase() === merchantRaw
      )?.merchantStandardised;
      if (!standardised) continue;
      await txnCtx.merchantMapping.upsert({
        where: { userId_merchantRaw: { userId: auth.userId, merchantRaw } },
        update: {
          categoryLevel1,
          categoryLevel2: categoryLevel2 ?? null,
          subcategory: subcategory ?? null,
          confidence: 1.0,
          source: 'USER',
          usageCount: { increment: 1 },
        },
        create: {
          userId: auth.userId,
          merchantRaw,
          merchantStandardised: standardised,
          categoryLevel1,
          categoryLevel2: categoryLevel2 ?? null,
          subcategory: subcategory ?? null,
          confidence: 1.0,
          source: 'USER',
          usageCount: 1,
        },
      });
    }
  });

  // ---- audit (fire-and-forget per row) -------------------------------------
  for (const t of transactions) {
    recordTransactionEdit({
      transactionId: t.id,
      userId: auth.userId,
      editType: 'CATEGORY',
      before: pickCategoryFields(t),
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

  // Phase 52.5c — teach the SHARED, de-identified KB once per distinct merchant
  // in this batch (the user-chosen canonical triple is the same vocabulary the
  // KB stores, so no fragmentation). This makes the "Categorise N selected"
  // power path feed the cross-user AI engine, not just the private merchant
  // mapping written above. Fire-and-forget + gated OFF by default
  // (KB_WRITE_ENABLED) + de-identified by the scrubber.
  const kbMerchants = Array.from(
    new Map(
      transactions
        .filter((t) => t.merchantStandardised)
        .map((t) => [t.merchantStandardised!.toLowerCase(), t.merchantStandardised!])
    ).values()
  );
  for (const merchant of kbMerchants) {
    recordKbContribution({
      userId: auth.userId,
      rawDescription: merchant,
      categoryLevel1,
      categoryLevel2,
      subcategory,
    });
  }

  // Phase 42 PR6 — touch the engagement streak. Bulk action = one
  // streak touch per call (not per-row); idempotent on the same day.
  // Fire-and-forget per CLAUDE.md §12.10.
  touchStreak(auth.userId).catch(() => {});

  return NextResponse.json({
    success: true,
    data: {
      updatedCount: transactions.length,
      categoryLevel1,
      categoryLevel2,
      subcategory,
    },
  });
});
