import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const createTransactionSchema = z.object({
  investmentAccountId: z.string().uuid('Invalid account ID'),
  holdingId: z.string().uuid('Invalid holding ID').optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DISTRIBUTION', 'DRP']),
  price: z.number().min(0, 'Price must be non-negative'),
  units: z.number().positive('Units must be positive'),
  fees: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);
      const accountId = searchParams.get('accountId');
      const holdingId = searchParams.get('holdingId');

      const whereClause: {
        investmentAccount: { userId: string };
        investmentAccountId?: string;
        holdingId?: string;
      } = {
        investmentAccount: { userId: authReq.user!.userId },
      };

      if (accountId) {
        whereClause.investmentAccountId = accountId;
      }
      if (holdingId) {
        whereClause.holdingId = holdingId;
      }

      const transactions = await prisma.investmentTransaction.findMany({
        where: whereClause,
        include: {
          investmentAccount: {
            select: { id: true, name: true },
          },
          holding: {
            select: { id: true, ticker: true },
          },
        },
        orderBy: { date: 'desc' },
      });

      return NextResponse.json(transactions);
    } catch (error) {
      console.error('Get investment transactions error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const validation = createTransactionSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { investmentAccountId, holdingId, date, type, price, units, fees, notes } =
        validation.data;

      // Verify ownership of the investment account
      const account = await prisma.investmentAccount.findUnique({
        where: { id: investmentAccountId },
      });

      if (!account || account.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
      }

      // If holdingId provided, verify it belongs to the same account
      if (holdingId) {
        const holding = await prisma.investmentHolding.findUnique({
          where: { id: holdingId },
        });

        if (!holding || holding.investmentAccountId !== investmentAccountId) {
          return NextResponse.json({ error: 'Holding not found in this account' }, { status: 404 });
        }
      }

      // For DIVIDEND or DISTRIBUTION, franking credits should be captured via holding
      const transaction = await prisma.investmentTransaction.create({
        data: {
          investmentAccountId,
          holdingId: holdingId ?? null,
          date: new Date(date),
          type,
          price,
          units,
          fees: fees ?? null,
          notes: notes ?? null,
        },
      });

      return NextResponse.json(transaction, { status: 201 });
    } catch (error) {
      console.error('Create investment transaction error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
