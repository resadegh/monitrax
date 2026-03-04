/**
 * Phase 29: Balance Verification API
 * POST /api/accounts/[id]/balance - Update account balance after user verification
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>('account.write', async (request, auth, context) => {
    try {
      const { id: accountId } = await context!.params;
      const userId = auth.userId;

      const body = await request.json();
      const { verifiedBalance, batchId } = body;

      if (typeof verifiedBalance !== 'number') {
        return NextResponse.json(
          { error: 'Verified balance is required' },
          { status: 400 }
        );
      }

      // Verify account ownership
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Update account balance
      const updatedAccount = await prisma.account.update({
        where: { id: accountId },
        data: {
          currentBalance: verifiedBalance,
          balanceSource: 'USER_VERIFIED',
          balanceLastUpdatedAt: new Date(),
          lastImportedBalance: verifiedBalance,
        },
      });

      // If batchId provided, update the import batch with user-verified balance
      if (batchId) {
        await prisma.importBatch.update({
          where: { id: batchId },
          data: {
            userVerifiedBalance: verifiedBalance,
            balanceVerifiedAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          accountId,
          balance: verifiedBalance,
          balanceSource: 'USER_VERIFIED',
          updatedAt: updatedAccount.balanceLastUpdatedAt,
        },
      });
    } catch (error) {
      console.error('Error updating balance:', error);
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      );
    }
});

export const GET = withPermission<RouteContext>('account.read', async (request, auth, context) => {
    try {
      const { id: accountId } = await context!.params;
      const userId = auth.userId;

      // Verify account ownership
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId },
        select: {
          id: true,
          name: true,
          currentBalance: true,
          balanceSource: true,
          balanceLastUpdatedAt: true,
          lastImportedBalance: true,
        },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: account,
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
      return NextResponse.json(
        { error: 'Failed to fetch balance' },
        { status: 500 }
      );
    }
});
