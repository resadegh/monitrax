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
 * Scope: the user-editable fund fields are writable here — name, fundName,
 * memberNumber, fundABN, currentBalance, taxableComponent, taxFreeComponent,
 * investmentOption. This is a partial update: only fields present in the
 * request body are written; `undefined` fields are skipped by Prisma so every
 * other column (caps, YTD tracking, returns) keeps its value. Extended from
 * the original three wizard fields (name/fundName/currentBalance) when the
 * My Wealth → Superannuation page (Phase 39.4) needed full fund editing.
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
    const {
      name,
      fundName,
      memberNumber,
      fundABN,
      currentBalance,
      taxableComponent,
      taxFreeComponent,
      investmentOption,
      fundType,
      ownerEntityId,
    } = body;

    // Verify ownership — only the caller's own row can be reached (the
    // update below is keyed by this verified id, never a bulk where).
    const existing = await prisma.superannuationAccount.findUnique({ where: { id } });
    const ownershipResult = verifyOwnership(existing, auth.userId, 'Superannuation account');
    if (!ownershipResult.success) return ownershipResult.response;

    // Phase 39.5: SMSF entity link — ownerEntityId may only reference a
    // LegalEntity owned by this user. `null` clears the link.
    let ownerEntityUpdate: { ownerEntityId: string | null } | undefined;
    if (ownerEntityId !== undefined) {
      if (ownerEntityId === null || ownerEntityId === '') {
        ownerEntityUpdate = { ownerEntityId: null };
      } else {
        const entity = await prisma.legalEntity.findFirst({
          where: { id: ownerEntityId, userId: auth.userId },
          select: { id: true },
        });
        if (!entity) {
          return NextResponse.json(
            { error: 'Linked entity not found' },
            { status: 400 }
          );
        }
        ownerEntityUpdate = { ownerEntityId: entity.id };
      }
    }
    const validFundType =
      fundType === 'INDUSTRY' || fundType === 'RETAIL' || fundType === 'SMSF';

    const account = await prisma.superannuationAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(fundName !== undefined && { fundName: fundName || null }),
        ...(memberNumber !== undefined && { memberNumber: memberNumber || null }),
        ...(fundABN !== undefined && { fundABN: fundABN || null }),
        ...(currentBalance !== undefined && { currentBalance }),
        ...(taxableComponent !== undefined && { taxableComponent }),
        ...(taxFreeComponent !== undefined && { taxFreeComponent }),
        ...(investmentOption !== undefined && { investmentOption: investmentOption || null }),
        ...(validFundType && { fundType }),
        ...(ownerEntityUpdate ?? {}),
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
