import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';
import { extractHoldingLinks, wrapWithGRDCS } from '@/lib/grdcs';

const createHoldingSchema = z.object({
  investmentAccountId: z.string().uuid('Invalid account ID'),
  ticker: z.string().min(1, 'Ticker is required'),
  units: z.number().positive('Units must be positive'),
  averagePrice: z.number().positive('Average price must be positive'),
  frankingPercentage: z.number().min(0).max(100).optional(),
  type: z.enum(['SHARE', 'ETF', 'MANAGED_FUND', 'CRYPTO']),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);
      const accountId = searchParams.get('accountId');

      const whereClause: { investmentAccount: { userId: string }; investmentAccountId?: string } = {
        investmentAccount: { userId: authReq.user!.userId },
      };

      if (accountId) {
        whereClause.investmentAccountId = accountId;
      }

      const holdings = await prisma.investmentHolding.findMany({
        where: whereClause,
        include: {
          investmentAccount: {
            select: { id: true, name: true, platform: true, currency: true },
          },
          transactions: {
            orderBy: { date: 'desc' },
          },
        },
        orderBy: { ticker: 'asc' },
      });

      // Apply GRDCS wrapper to each holding
      const holdingsWithLinks = holdings.map(holding => {
        const links = extractHoldingLinks(holding);
        return wrapWithGRDCS(holding as Record<string, unknown>, 'investmentHolding', links);
      });

      return NextResponse.json({
        data: holdingsWithLinks,
        _meta: {
          count: holdingsWithLinks.length,
          totalLinkedEntities: holdingsWithLinks.reduce((sum, h) => sum + h._meta.linkedCount, 0),
        },
      });
    } catch (error) {
      console.error('Get holdings error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const validation = createHoldingSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { investmentAccountId, ticker, units, averagePrice, frankingPercentage, type } =
        validation.data;

      // Verify ownership of the investment account
      const account = await prisma.investmentAccount.findUnique({
        where: { id: investmentAccountId },
      });

      if (!account || account.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
      }

      const holding = await prisma.investmentHolding.create({
        data: {
          investmentAccountId,
          ticker: ticker.toUpperCase(),
          units,
          averagePrice,
          frankingPercentage: frankingPercentage ?? null,
          type,
        },
      });

      return NextResponse.json(holding, { status: 201 });
    } catch (error) {
      console.error('Create holding error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
