import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['BROKERAGE', 'SUPERS', 'FUND', 'TRUST', 'ETF_CRYPTO']).optional(),
  platform: z.string().nullable().optional(),
  currency: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const account = await prisma.investmentAccount.findUnique({
        where: { id },
        include: {
          holdings: true,
          transactions: {
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!account || account.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
      }

      return NextResponse.json(account);
    } catch (error) {
      console.error('Get investment account error:', error);
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

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
      }

      const { name, type, platform, currency } = validation.data;

      const account = await prisma.investmentAccount.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(platform !== undefined && { platform }),
          ...(currency !== undefined && { currency }),
        },
      });

      return NextResponse.json(account);
    } catch (error) {
      console.error('Update investment account error:', error);
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
      const existing = await prisma.investmentAccount.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
      }

      await prisma.investmentAccount.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Investment account deleted successfully' });
    } catch (error) {
      console.error('Delete investment account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
