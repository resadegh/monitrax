import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { balanceWriteFields } from '@/lib/utils/accountBalance';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('account.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const account = await prisma.account.findUnique({
        where: { id },
        include: {
          linkedLoan: true,
          transactions: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
      });

      // Verify ownership using centralized utility
      const result = verifyOwnership(account, auth.userId, 'Account');
      if (!result.success) return result.response;

      return NextResponse.json(result.resource);
    } catch (error) {
      console.error('Get account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('account.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();
      const { name, type, institution, currentBalance, interestRate, linkedLoanId } = body;

      // Verify ownership
      const existing = await prisma.account.findUnique({ where: { id } });
      const result = verifyOwnership(existing, auth.userId, 'Account');
      if (!result.success) return result.response;

      // PR 3c.2c — only stamp the balance-write fields when the
      // caller is actually changing the balance. Field-level partial
      // updates (rename, re-type, rate change) should not falsely
      // refresh `balanceLastUpdatedAt` — that would make a stale
      // manual balance appear fresh just because the user fixed a
      // typo in the account name.
      const balanceChanging = currentBalance !== undefined;
      // Account update + offset→loan re-link are atomic (Track F.3).
      const account = await prisma.$transaction(async (tx) => {
        const updated = await tx.account.update({
          where: { id },
          data: {
            name,
            type,
            institution: institution !== undefined ? institution || null : undefined,
            currentBalance,
            interestRate,
            ...(balanceChanging ? balanceWriteFields('USER_VERIFIED') : {}),
          },
        });
        // OFFSET → loan link (Track F.3). Clear whatever loan currently
        // uses this account as its offset, then point the chosen loan at
        // it. A non-OFFSET account (or one with no loan chosen) ends up
        // unlinked. Only run when the caller passed offset-relevant
        // fields, so a dashboard partial-edit that omits them is untouched.
        if (type !== undefined || linkedLoanId !== undefined) {
          await tx.loan.updateMany({
            where: { offsetAccountId: id, userId: auth.userId },
            data: { offsetAccountId: null },
          });
          if (type === 'OFFSET' && linkedLoanId) {
            const loan = await tx.loan.findFirst({
              where: { id: linkedLoanId, userId: auth.userId },
              select: { id: true },
            });
            if (loan) {
              await tx.loan.update({
                where: { id: loan.id },
                data: { offsetAccountId: id },
              });
            }
          }
        }
        return updated;
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'ACCOUNT_UPDATED',
        status: 'SUCCESS',
        entityType: 'Account',
        entityId: account.id,
        metadata: { type: account.type },
      });

      return NextResponse.json(account);
    } catch (error) {
      console.error('Update account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const DELETE = withPermission<RouteContext>('account.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;

      // Verify ownership using centralized utility
      const existing = await prisma.account.findUnique({ where: { id } });
      const result = verifyOwnership(existing, auth.userId, 'Account');
      if (!result.success) return result.response;

      await prisma.account.delete({ where: { id } });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'ACCOUNT_DELETED',
        status: 'SUCCESS',
        entityType: 'Account',
        entityId: id,
      });

      return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
