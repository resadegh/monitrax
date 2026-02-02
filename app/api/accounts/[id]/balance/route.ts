/**
 * Phase 29: Balance Verification API
 * POST /api/accounts/[id]/balance - Update account balance after user verification
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId } = await params;
      const userId = authReq.user!.userId;

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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: accountId } = await params;
      const userId = authReq.user!.userId;

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
}
