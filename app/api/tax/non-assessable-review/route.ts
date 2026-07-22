/**
 * MON-094 — non-assessable receipt review: preview + Reza-gated reclassify.
 *
 * GET  /api/tax/non-assessable-review — the PREVIEW: every existing Income
 *      row whose descriptor the ONE canonical detector
 *      (`detectNonAssessable`, lib/intake/classifyIntake.ts) flags as a
 *      non-assessable receipt (ATO refund / internal transfer / loan
 *      drawdown) and which does NOT yet carry a non-assessable taxCategory.
 *      READ-ONLY. Each suggestion carries the reason + the annual tax-gross
 *      effect of confirming it.
 *
 * POST /api/tax/non-assessable-review — confirm the reclassification for an
 *      EXPLICIT list of rows: `{ ids: [...], confirm: "RECLASSIFY" }`.
 *      §12.11 guards: the detection is RE-DERIVED server-side per row —
 *      client ids that don't match the live detector (or already carry a
 *      taxCategory) are rejected with 409, never silently skipped; ONLY
 *      `taxCategory` + `taxNotes` are written (system tax-determination
 *      fields — the row's name/amount/frequency/user-entered values are
 *      never touched); nothing is reclassified without this per-request
 *      explicit confirm. There is no "reclassify-all".
 *
 * Thin wrapper (§12.3): detection lives in the canonical intake classifier;
 * assessability itself is decided ONLY by `determineTaxability`'s
 * NON_ASSESSABLE_TAX_CATEGORIES override (lib/tax-engine/income/
 * taxabilityRules.ts) — this route just stores the row-level tag.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { detectNonAssessable } from '@/lib/intake/classifyIntake';
import { NON_ASSESSABLE_TAX_CATEGORIES } from '@/lib/tax-engine/income/taxabilityRules';
import { toAnnual } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

interface ReviewRow {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  isRecurring: boolean | null;
  taxCategory: string | null;
}

async function fetchSuggestions(userId: string) {
  const rows = (await prisma.income.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      type: true,
      amount: true,
      frequency: true,
      isRecurring: true,
      taxCategory: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as ReviewRow[];

  return rows.flatMap((row) => {
    // Already carries a non-assessable category → nothing to review.
    if (row.taxCategory && NON_ASSESSABLE_TAX_CATEGORIES.has(row.taxCategory)) return [];
    const detection = detectNonAssessable(row.name);
    if (!detection) return [];
    // The tax-gross effect of confirming: a one-off counts once (MON-053),
    // a recurring row is annualised — either way the whole annual amount
    // leaves the taxable gross. Reported for the preview only; the engine
    // itself recomputes from the stored tag.
    return [
      {
        id: row.id,
        name: row.name,
        type: row.type,
        amount: row.amount,
        frequency: row.frequency,
        isRecurring: row.isRecurring,
        currentTaxCategory: row.taxCategory,
        suggestedTaxCategory: detection.taxCategory,
        kind: detection.kind,
        reason: detection.reason,
        // The annual tax-gross effect of confirming — computed HERE (the
        // thin-wrapper route, from canonical producers) so the page never
        // sums money on the surface (source-lock). Mirrors the engine's
        // assessable-base semantics (taxPositionCalculator.ts MON-053
        // guard): a one-off counts ONCE; a recurring row annualises via
        // THE canonical toAnnual.
        annualEffect:
          row.isRecurring === false
            ? Math.abs(row.amount)
            : toAnnual(Math.abs(row.amount), row.frequency as Frequency),
      },
    ];
  });
}

export const GET = withPermission('income.read', async (_request, auth) => {
  try {
    const suggestions = await fetchSuggestions(auth.userId);
    const totalAnnualEffect = suggestions.reduce((s, x) => s + x.annualEffect, 0);
    return NextResponse.json({ success: true, data: { suggestions, totalAnnualEffect } });
  } catch (error) {
    console.error('[tax/non-assessable-review] preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build the non-assessable review' },
      { status: 500 },
    );
  }
});

export const POST = withPermission('income.write', async (request, auth) => {
  try {
    const body = await request.json();
    const { ids, confirm } = body ?? {};

    if (confirm !== 'RECLASSIFY') {
      return NextResponse.json(
        { error: 'Reclassification requires the explicit confirmation payload (confirm: "RECLASSIFY") — nothing changes without it.' },
        { status: 400 },
      );
    }
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'A non-empty ids array is required' }, { status: 400 });
    }

    // §12.11: re-derive the detection server-side — every requested id must
    // still be a live suggestion (detector match + no existing non-assessable
    // tag). A stale/foreign id fails the WHOLE request so the preview the
    // user confirmed is exactly what is applied.
    const suggestions = await fetchSuggestions(auth.userId);
    const byId = new Map(suggestions.map((s) => [s.id, s]));
    const stale = (ids as string[]).filter((id) => !byId.has(id));
    if (stale.length > 0) {
      return NextResponse.json(
        {
          error:
            'One or more rows no longer match the live detection (data changed since the preview). Refresh and confirm again.',
          code: 'REVIEW_STALE',
          staleIds: stale,
        },
        { status: 409 },
      );
    }

    let updated = 0;
    for (const id of ids as string[]) {
      const s = byId.get(id)!;
      // Guard (§12.11 Q3): update ONLY rows re-verified as detector matches,
      // scoped to this user in the where clause itself, and ONLY the system
      // tax-determination columns (updateMany so userId stays in the filter).
      const res = await prisma.income.updateMany({
        where: { id, userId: auth.userId },
        data: { taxCategory: s.suggestedTaxCategory, taxNotes: s.reason },
      });
      updated += res.count;
    }

    void createAuditLog({
      userId: auth.userId,
      action: 'UPDATE',
      status: 'SUCCESS',
      entityType: 'Income',
      entityId: ids[0],
      metadata: sanitizeCdrMetadata({
        reclassifiedBy: 'mon-094-non-assessable-review-user-confirmed',
        updatedCount: updated,
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { updated } });
  } catch (error) {
    console.error('[tax/non-assessable-review] reclassify error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to apply the reclassification' },
      { status: 500 },
    );
  }
});
