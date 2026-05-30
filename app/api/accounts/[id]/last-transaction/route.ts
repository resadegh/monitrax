import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/accounts/[id]/last-transaction — the date of the most recent
 * transaction held for an account (Phase 21.5 R7-PR2 import-date hint).
 *
 * Powers the "export from {lastDate+1} to today" instruction in the import
 * dialog, so the user picks the right date filter at their bank instead of
 * guessing. Read-only; ownership-checked. No CDR data leaves here beyond a
 * single date (no amounts / merchants) — §13.3.
 */
export const GET = withPermission<RouteContext>('account.read', async (_request, auth, context) => {
  try {
    const { id: accountId } = await context!.params;

    // Ownership: only return data for an account the caller owns.
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: auth.userId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const latest = await prisma.unifiedTransaction.aggregate({
      where: { userId: auth.userId, accountId },
      _max: { date: true },
    });

    return NextResponse.json({
      data: { lastTransactionDate: latest._max.date ? latest._max.date.toISOString() : null },
    });
  } catch (error) {
    console.error('Get last transaction date error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
