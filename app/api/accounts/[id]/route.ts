import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { balanceWriteFields } from '@/lib/utils/accountBalance';

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
      const { name, type, currentBalance, interestRate } = body;

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
      const account = await prisma.account.update({
        where: { id },
        data: {
          name,
          type,
          currentBalance,
          interestRate,
          ...(balanceChanging ? balanceWriteFields('USER_VERIFIED') : {}),
        },
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

      return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
