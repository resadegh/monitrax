import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';
import { extractInvestmentAccountLinks, wrapWithGRDCS } from '@/lib/grdcs';

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['BROKERAGE', 'SUPERS', 'FUND', 'TRUST', 'ETF_CRYPTO']),
  platform: z.string().optional(),
  currency: z.string().default('AUD'),
  // Phase 23: Opening and balance tracking
  openingDate: z.string().datetime().optional(),
  openingBalance: z.number().min(0).default(0),
  costBasisMethod: z.enum(['FIFO', 'LIFO', 'HIFO', 'SPECIFIC', 'AVERAGE']).default('FIFO'),
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
          incomes: true,
          expenses: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each investment account
      const accountsWithLinks = accounts.map((account: typeof accounts[number]) => {
        const links = extractInvestmentAccountLinks(account);
        return wrapWithGRDCS(account as Record<string, unknown>, 'investmentAccount', links);
      });

      return NextResponse.json({
        data: accountsWithLinks,
        _meta: {
          count: accountsWithLinks.length,
          totalLinkedEntities: accountsWithLinks.reduce((sum: number, a: { _meta: { linkedCount: number } }) => sum + a._meta.linkedCount, 0),
        },
      });
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

      const { name, type, platform, currency, openingDate, openingBalance, costBasisMethod } = validation.data;

      const account = await prisma.investmentAccount.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          platform: platform || null,
          currency: currency || 'AUD',
          // Phase 23 fields
          openingDate: openingDate ? new Date(openingDate) : null,
          openingBalance: openingBalance || 0,
          cashBalance: openingBalance || 0, // Start with opening balance
          costBasisMethod: costBasisMethod || 'FIFO',
        },
      });

      return NextResponse.json(account, { status: 201 });
    } catch (error) {
      console.error('Create investment account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
