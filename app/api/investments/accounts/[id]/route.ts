import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';
import { z } from 'zod';

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['BROKERAGE', 'SUPERS', 'FUND', 'TRUST', 'ETF_CRYPTO']).optional(),
  platform: z.string().nullable().optional(),
  currency: z.string().optional(),
  // Phase 23: Balance tracking fields
  openingDate: z.string().datetime().nullable().optional(),
  openingBalance: z.number().min(0).optional(),
  cashBalance: z.number().optional(),
  totalDeposits: z.number().min(0).optional(),
  totalWithdrawals: z.number().min(0).optional(),
  costBasisMethod: z.enum(['FIFO', 'LIFO', 'HIFO', 'SPECIFIC', 'AVERAGE']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('investment.read', async (request, auth, context) => {
  try {
    const { id } = await context!.params;
    const account = await prisma.investmentAccount.findUnique({
      where: { id },
      include: {
        holdings: true,
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    const ownershipResult = verifyOwnership(account, auth.userId, 'Investment account');
    if (!ownershipResult.success) return ownershipResult.response;

    return NextResponse.json(ownershipResult.resource);
  } catch (error) {
    console.error('Get investment account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withPermission<RouteContext>('investment.write', async (request, auth, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const validation = updateAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.investmentAccount.findUnique({
      where: { id },
    });

    const ownershipResult = verifyOwnership(existing, auth.userId, 'Investment account');
    if (!ownershipResult.success) return ownershipResult.response;

    const {
      name, type, platform, currency,
      openingDate, openingBalance, cashBalance,
      totalDeposits, totalWithdrawals, costBasisMethod
    } = validation.data;

    const account = await prisma.investmentAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(platform !== undefined && { platform }),
        ...(currency !== undefined && { currency }),
        ...(openingDate !== undefined && { openingDate: openingDate ? new Date(openingDate) : null }),
        ...(openingBalance !== undefined && { openingBalance }),
        ...(cashBalance !== undefined && { cashBalance }),
        ...(totalDeposits !== undefined && { totalDeposits }),
        ...(totalWithdrawals !== undefined && { totalWithdrawals }),
        ...(costBasisMethod !== undefined && { costBasisMethod }),
      },
    });

    // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'INVESTMENT_UPDATED',
      status: 'SUCCESS',
      entityType: 'InvestmentAccount',
      entityId: account.id,
      metadata: { type: account.type },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error('Update investment account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withPermission<RouteContext>('investment.delete', async (request, auth, context) => {
  try {
    const { id } = await context!.params;
    // Verify ownership
    const existing = await prisma.investmentAccount.findUnique({
      where: { id },
    });

    const ownershipResult = verifyOwnership(existing, auth.userId, 'Investment account');
    if (!ownershipResult.success) return ownershipResult.response;

    await prisma.investmentAccount.delete({
      where: { id },
    });

    // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'INVESTMENT_DELETED',
      status: 'SUCCESS',
      entityType: 'InvestmentAccount',
      entityId: id,
    });

    return NextResponse.json({ message: 'Investment account deleted successfully' });
  } catch (error) {
    console.error('Delete investment account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
