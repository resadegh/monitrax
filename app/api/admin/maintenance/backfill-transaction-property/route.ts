/**
 * MON-168 backfill — stamp `UnifiedTransaction.propertyId` on rows linked
 * BEFORE the forward fix (M3 PR-1) existed.
 *
 *   POST /api/admin/maintenance/backfill-transaction-property
 *     body: {}                → DRY RUN (default): reports what WOULD change,
 *                               writes nothing (§12.11 discipline)
 *     body: { "apply": true } → performs the write
 *
 * The stamp is DERIVED STATE (see lib/bookkeeping/propertyLink.ts — the ONE
 * rule): a linked row inherits its Income/Expense/Loan target's propertyId.
 * Rows whose target is not property-scoped (e.g. a GENERAL expense) are
 * counted as `targetNotPropertyScoped` — correct, not an error. Rows whose
 * target id points at a missing row are listed under `targetMissing`, never
 * guessed (§19.2).
 *
 * Idempotent: the write's WHERE re-asserts `propertyId: null`, so a re-run
 * examines only rows still unstamped and a second apply stamps 0.
 *
 * §12.11 destructive-write checklist (recorded in the M3 PR-1 body):
 *   1. WHERE matches: rows with a link id set AND propertyId null — nothing else.
 *   2. Columns overwritten: ONLY `propertyId`, and only from null (never a
 *      user-entered value; the selection excludes non-null stamps).
 *   3. Guard: the null-only WHERE + the value being derived via the same
 *      resolver every forward path uses.
 *
 * Ring-3 handout: docs/verification/briefs/RING3_M3_PACK_FIX.md (the dry-run
 * JSON captured before apply IS the D-21 expected-movement record).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';

interface BackfillReport {
  dryRun: boolean;
  examined: number;
  /** dry run: rows that WOULD be stamped; apply: rows actually stamped. */
  stamped: number;
  perProperty: Array<{ propertyId: string; propertyName: string; count: number }>;
  /** Linked, but the target itself carries no propertyId (GENERAL scope). */
  targetNotPropertyScoped: number;
  /** Link ids whose target row no longer exists — listed, never guessed. */
  targetMissing: string[];
}

export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  if (!hasPermission(authResult.context.role, 'users:update')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const apply = body?.apply === true;

  // Every linked-but-unstamped row, all users (admin maintenance; each row
  // resolves against its OWN user's target — no cross-user attribution).
  const rows = await prisma.unifiedTransaction.findMany({
    where: {
      propertyId: null,
      OR: [{ incomeId: { not: null } }, { expenseId: { not: null } }, { loanId: { not: null } }],
    },
    select: { id: true, userId: true, incomeId: true, expenseId: true, loanId: true },
  });

  // Resolve targets in three batched queries (no N+1), keyed per user so a
  // row can never inherit another user's property.
  const incomeIds = [...new Set(rows.map((r) => r.incomeId).filter((v): v is string => !!v))];
  const expenseIds = [...new Set(rows.map((r) => r.expenseId).filter((v): v is string => !!v))];
  const loanIds = [...new Set(rows.map((r) => r.loanId).filter((v): v is string => !!v))];
  const [incomes, expenses, loans] = await Promise.all([
    incomeIds.length
      ? prisma.income.findMany({ where: { id: { in: incomeIds } }, select: { id: true, userId: true, propertyId: true } })
      : [],
    expenseIds.length
      ? prisma.expense.findMany({ where: { id: { in: expenseIds } }, select: { id: true, userId: true, propertyId: true } })
      : [],
    loanIds.length
      ? prisma.loan.findMany({ where: { id: { in: loanIds } }, select: { id: true, userId: true, propertyId: true } })
      : [],
  ]);
  const byIncome = new Map(incomes.map((r) => [r.id, r]));
  const byExpense = new Map(expenses.map((r) => [r.id, r]));
  const byLoan = new Map(loans.map((r) => [r.id, r]));

  // Same precedence as resolveLinkPropertyId: income > expense > loan.
  const toStamp = new Map<string, string[]>(); // propertyId -> tx ids
  let targetNotPropertyScoped = 0;
  const targetMissing: string[] = [];
  for (const row of rows) {
    const target = row.incomeId
      ? byIncome.get(row.incomeId)
      : row.expenseId
        ? byExpense.get(row.expenseId)
        : row.loanId
          ? byLoan.get(row.loanId)
          : undefined;
    if (!target || target.userId !== row.userId) {
      targetMissing.push(row.id);
      continue;
    }
    if (!target.propertyId) {
      targetNotPropertyScoped++;
      continue;
    }
    const list = toStamp.get(target.propertyId) ?? [];
    list.push(row.id);
    toStamp.set(target.propertyId, list);
  }

  const propertyIdsTouched = [...toStamp.keys()];
  const properties = propertyIdsTouched.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIdsTouched } },
        select: { id: true, name: true },
      })
    : [];
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));

  let stamped = 0;
  if (apply) {
    for (const [propertyId, txIds] of toStamp) {
      const res = await prisma.unifiedTransaction.updateMany({
        // Re-assert the null guard so the write is idempotent even if a
        // concurrent link stamped a row between the read and this write.
        where: { id: { in: txIds }, propertyId: null },
        data: { propertyId },
      });
      stamped += res.count;
    }
    createAuditLog({
      userId: authResult.context.adminId,
      action: 'UPDATE',
      entityType: 'unified_transaction.propertyId backfill (MON-168)',
      metadata: { examined: rows.length, stamped, targetNotPropertyScoped, targetMissing: targetMissing.length },
    }).catch(() => {});
  } else {
    stamped = [...toStamp.values()].reduce((n, ids) => n + ids.length, 0);
  }

  const report: BackfillReport = {
    dryRun: !apply,
    examined: rows.length,
    stamped,
    perProperty: [...toStamp.entries()]
      .map(([propertyId, ids]) => ({
        propertyId,
        propertyName: propertyName.get(propertyId) ?? '(unknown property)',
        count: ids.length,
      }))
      .sort((a, b) => b.count - a.count),
    targetNotPropertyScoped,
    targetMissing,
  };
  return NextResponse.json({ success: true, data: report });
}
