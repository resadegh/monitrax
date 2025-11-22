import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const updateHoldingSchema = z.object({
  ticker: z.string().min(1).optional(),
  units: z.number().positive().optional(),
  averagePrice: z.number().positive().optional(),
  frankingPercentage: z.number().min(0).max(100).nullable().optional(),
  type: z.enum(['SHARE', 'ETF', 'MANAGED_FUND', 'CRYPTO']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const holding = await prisma.investmentHolding.findUnique({
        where: { id },
        include: {
          investmentAccount: true,
          transactions: {
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!holding || holding.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      return NextResponse.json(holding);
    } catch (error) {
      console.error('Get holding error:', error);
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
      const validation = updateHoldingSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Verify ownership via investment account
      const existing = await prisma.investmentHolding.findUnique({
        where: { id },
        include: { investmentAccount: true },
      });

      if (!existing || existing.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      const { ticker, units, averagePrice, frankingPercentage, type } = validation.data;

      const holding = await prisma.investmentHolding.update({
        where: { id },
        data: {
          ...(ticker !== undefined && { ticker: ticker.toUpperCase() }),
          ...(units !== undefined && { units }),
          ...(averagePrice !== undefined && { averagePrice }),
          ...(frankingPercentage !== undefined && { frankingPercentage }),
          ...(type !== undefined && { type }),
        },
      });

      return NextResponse.json(holding);
    } catch (error) {
      console.error('Update holding error:', error);
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
      const existing = await prisma.investmentHolding.findUnique({
        where: { id },
        include: { investmentAccount: true },
      });

      if (!existing || existing.investmentAccount.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      await prisma.investmentHolding.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Holding deleted successfully' });
    } catch (error) {
      console.error('Delete holding error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
