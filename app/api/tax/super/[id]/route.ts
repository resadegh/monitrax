/**
 * Phase 12 Track F.6 — per-account superannuation API.
 *
 * `PUT /api/tax/super/[id]`    — update a superannuation account
 * `DELETE /api/tax/super/[id]` — delete a superannuation account
 *
 * Created so the onboarding wizard's Super step can two-way-sync the
 * `SuperannuationAccount` table (the parent `/api/tax/super` route had
 * GET + POST only — no per-id update/delete). Both handlers are
 * ownership-guarded via `verifyOwnership` and audited (§12.5 / §13.3).
 *
 * Scope: only the three minimum-viable wizard fields (name / fundName /
 * currentBalance) are writable here — every other `SuperannuationAccount`
 * column keeps its value (a partial update; `undefined` fields are
 * skipped by Prisma).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withPermission<RouteContext>('income.write', async (request, auth, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const { name, fundName, currentBalance } = body;

    // Verify ownership
    const existing = await prisma.superannuationAccount.findUnique({ where: { id } });
    const ownershipResult = verifyOwnership(existing, auth.userId, 'Superannuation account');
    if (!ownershipResult.success) return ownershipResult.response;

    const account = await prisma.superannuationAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(fundName !== undefined && { fundName: fundName || null }),
        ...(currentBalance !== undefined && { currentBalance }),
      },
    });

    // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'SUPER_UPDATED',
      status: 'SUCCESS',
      entityType: 'SuperannuationAccount',
      entityId: account.id,
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error('Update super account error:', error);
    return NextResponse.json(
      { error: 'Failed to update superannuation account' },
      { status: 500 }
    );
  }
});

export const DELETE = withPermission<RouteContext>('income.delete', async (request, auth, context) => {
  try {
    const { id } = await context!.params;

    // Verify ownership
    const existing = await prisma.superannuationAccount.findUnique({ where: { id } });
    const ownershipResult = verifyOwnership(existing, auth.userId, 'Superannuation account');
    if (!ownershipResult.success) return ownershipResult.response;

    await prisma.superannuationAccount.delete({ where: { id } });

    // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'SUPER_DELETED',
      status: 'SUCCESS',
      entityType: 'SuperannuationAccount',
      entityId: id,
    });

    return NextResponse.json({ message: 'Superannuation account deleted successfully' });
  } catch (error) {
    console.error('Delete super account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete superannuation account' },
      { status: 500 }
    );
  }
});
