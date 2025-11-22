import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['BROKERAGE', 'SUPERS', 'FUND', 'TRUST', 'ETF_CRYPTO']),
  platform: z.string().optional(),
  currency: z.string().default('AUD'),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const accounts = await prisma.investmentAccount.findMany({
        where: { userId: authReq.user!.userId },
        include: {
          holdings: true,
          transactions: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(accounts);
    } catch (error) {
      console.error('Get investment accounts error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const validation = createAccountSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { name, type, platform, currency } = validation.data;

      const account = await prisma.investmentAccount.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          platform: platform || null,
          currency: currency || 'AUD',
        },
      });

      return NextResponse.json(account, { status: 201 });
    } catch (error) {
      console.error('Create investment account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
