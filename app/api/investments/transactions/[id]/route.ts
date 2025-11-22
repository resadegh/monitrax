import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const updateTransactionSchema = z.object({
  holdingId: z.string().uuid().nullable().optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DISTRIBUTION', 'DRP']).optional(),
  price: z.number().min(0).optional(),
  units: z.number().positive().optional(),
  fees: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const transaction = await prisma.investmentTransaction.findUnique({
        where: { id },
        include: {
          investmentAccount: true,
          holding: true,
        },
      });

      if (!transaction || transaction.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      return NextResponse.json(transaction);
    } catch (error) {
      console.error('Get investment transaction error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const validation = updateTransactionSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Verify ownership via investment account
      const existing = await prisma.investmentTransaction.findUnique({
        where: { id },
        include: { investmentAccount: true },
      });

      if (!existing || existing.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      const { holdingId, date, type, price, units, fees, notes } = validation.data;

      // If holdingId is being updated, verify it belongs to the same account
      if (holdingId !== undefined && holdingId !== null) {
        const holding = await prisma.investmentHolding.findUnique({
          where: { id: holdingId },
        });

        if (!holding || holding.investmentAccountId !== existing.investmentAccountId) {
          return NextResponse.json({ error: 'Holding not found in this account' }, { status: 404 });
        }
      }

      const transaction = await prisma.investmentTransaction.update({
        where: { id },
        data: {
          ...(holdingId !== undefined && { holdingId }),
          ...(date !== undefined && { date: new Date(date) }),
          ...(type !== undefined && { type }),
          ...(price !== undefined && { price }),
          ...(units !== undefined && { units }),
          ...(fees !== undefined && { fees }),
          ...(notes !== undefined && { notes }),
        },
      });

      return NextResponse.json(transaction);
    } catch (error) {
      console.error('Update investment transaction error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      // Verify ownership
      const existing = await prisma.investmentTransaction.findUnique({
        where: { id },
        include: { investmentAccount: true },
      });

      if (!existing || existing.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      await prisma.investmentTransaction.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      console.error('Delete investment transaction error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
