/**
 * Mechanism A PART 2 — duplicate-source preview + Reza-gated merge
 * (MON-074/076; docs/architecture/CALC_SSOT_WALL.md "Mechanism A").
 *
 * GET  /api/intake/duplicates — the PREVIEW: every income/expense duplicate
 *      group under the Part-1 signature policy, with the proposed survivor,
 *      the rows that would be deleted, and the net effect on the declared
 *      annual gross. READ-ONLY — this is the live row-level census.
 *
 * POST /api/intake/duplicates — execute ONE group's merge. Requires the
 *      explicit confirmation payload `{ kind, survivorId, mergeIds, confirm:
 *      "MERGE" }`. The group is RE-DERIVED server-side and the request must
 *      match it exactly — client-supplied ids are never trusted, and a group
 *      that no longer matches the signature policy (data changed since the
 *      preview) is rejected. NOTHING merges without this per-group call —
 *      there is no merge-all. (§12.11 — the checklist lives in the PR body.)
 *
 * Thin wrappers (§12.3): grouping + merge semantics live in
 * `lib/intake/duplicateMerge.ts`.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import {
  findDuplicateGroups,
  executeMerge,
  type MergeableRow,
  type MergeDbClient,
} from '@/lib/intake/duplicateMerge';

async function fetchRows(userId: string): Promise<{ income: MergeableRow[]; expense: MergeableRow[] }> {
  const [income, expense] = await Promise.all([
    prisma.income.findMany({
      where: { userId },
      select: {
        id: true, name: true, type: true, amount: true, frequency: true,
        isRecurring: true, ownerEntityId: true, propertyId: true,
        investmentAccountId: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { userId },
      select: {
        id: true, name: true, category: true, amount: true, frequency: true,
        isRecurring: true, ownerEntityId: true, propertyId: true, loanId: true,
        assetId: true, investmentAccountId: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    income: income as unknown as MergeableRow[],
    expense: (expense as unknown as Array<MergeableRow & { category?: string }>).map((e) => ({
      ...e,
      type: (e as { category?: string }).category ?? null,
    })),
  };
}

export const GET = withPermission('income.read', async (_request, auth) => {
  try {
    const { income, expense } = await fetchRows(auth.userId);
    const groups = [
      ...findDuplicateGroups('income', income),
      ...findDuplicateGroups('expense', expense),
    ];
    return NextResponse.json({ success: true, data: { groups } });
  } catch (error) {
    console.error('[intake/duplicates] preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build the duplicate preview' },
      { status: 500 },
    );
  }
});

export const POST = withPermission('income.write', async (request, auth) => {
  try {
    const body = await request.json();
    const { kind, survivorId, mergeIds, confirm } = body ?? {};

    if (confirm !== 'MERGE') {
      return NextResponse.json(
        { error: 'Merge requires the explicit confirmation payload (confirm: "MERGE") — nothing merges without it.' },
        { status: 400 },
      );
    }
    if ((kind !== 'income' && kind !== 'expense') || typeof survivorId !== 'string' || !Array.isArray(mergeIds) || mergeIds.length === 0) {
      return NextResponse.json(
        { error: 'kind, survivorId and non-empty mergeIds are required' },
        { status: 400 },
      );
    }

    // Re-derive the groups server-side and require an EXACT match — the
    // preview the user confirmed must still hold against live data.
    const rows = await fetchRows(auth.userId);
    const groups = findDuplicateGroups(kind, rows[kind as 'income' | 'expense']);
    const group = groups.find((g) => g.survivorId === survivorId);
    const requested = [...mergeIds].sort();
    if (!group || JSON.stringify([...group.mergeIds].sort()) !== JSON.stringify(requested)) {
      return NextResponse.json(
        {
          error:
            'This group no longer matches the live data (rows changed since the preview). Refresh the preview and confirm again.',
          code: 'GROUP_STALE',
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx: unknown) =>
      executeMerge(tx as MergeDbClient, auth.userId, kind, survivorId, group.mergeIds),
    );

    void createAuditLog({
      userId: auth.userId,
      action: 'DELETE',
      entityType: kind === 'income' ? 'INCOME' : 'EXPENSE',
      entityId: survivorId,
      metadata: sanitizeCdrMetadata({
        mergedBy: 'mechanism-a-part2-user-confirmed',
        deletedCount: result.deleted,
        droppedDisbursementRule: result.droppedDisbursementRule,
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        survivorId,
        deleted: result.deleted,
        droppedDisbursementRule: result.droppedDisbursementRule,
        annualDeclaredEffect: group.annualDeclaredEffect,
      },
    });
  } catch (error) {
    console.error('[intake/duplicates] merge error:', error);
    return NextResponse.json(
      { success: false, error: 'Merge failed — no rows were changed (transactional)' },
      { status: 500 },
    );
  }
});
