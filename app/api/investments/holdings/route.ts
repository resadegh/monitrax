import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { z } from 'zod';
import { extractHoldingLinks, wrapWithGRDCS } from '@/lib/grdcs';
import { createAuditLog } from '@/lib/security/auditLog';

const createHoldingSchema = z.object({
  investmentAccountId: z.string().uuid('Invalid account ID'),
  ticker: z.string().min(1, 'Ticker is required'),
  name: z.string().optional(),
  units: z.number().positive('Units must be positive'),
  averagePrice: z.number().positive('Average price must be positive'),
  frankingPercentage: z.number().min(0).max(100).optional(),
  type: z.enum(['SHARE', 'ETF', 'MANAGED_FUND', 'CRYPTO']),
  // Phase 23: Enhanced tracking
  firstPurchaseDate: z.string().datetime().optional(),
  currentPrice: z.number().positive().optional(),
});

export const GET = withPermission('holding.read', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    const whereClause: { investmentAccount: { userId: string }; investmentAccountId?: string } = {
      investmentAccount: { userId: auth.userId },
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
    const holdingsWithLinks = holdings.map((holding: typeof holdings[number]) => {
      const links = extractHoldingLinks(holding);
      return wrapWithGRDCS(holding as Record<string, unknown>, 'investmentHolding', links);
    });

    return NextResponse.json({
      data: holdingsWithLinks,
      _meta: {
        count: holdingsWithLinks.length,
        totalLinkedEntities: holdingsWithLinks.reduce((sum: number, h: { _meta: { linkedCount: number } }) => sum + h._meta.linkedCount, 0),
      },
    });
  } catch (error) {
    console.error('Get holdings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withPermission('holding.write', async (request, auth) => {
  try {
    const body = await request.json();
    const validation = createHoldingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { investmentAccountId, ticker, name, units, averagePrice, frankingPercentage, type, firstPurchaseDate, currentPrice } =
      validation.data;

    // Verify ownership of the investment account
    const account = await prisma.investmentAccount.findUnique({
      where: { id: investmentAccountId },
    });

    const ownershipResult = verifyOwnership(account, auth.userId, 'Investment account');
    if (!ownershipResult.success) return ownershipResult.response;

    // Calculate cost basis and current value
    const totalCostBasis = units * averagePrice;
    const currentValue = currentPrice ? units * currentPrice : null;
    const unrealizedGain = currentValue ? currentValue - totalCostBasis : null;
    const unrealizedGainPct = unrealizedGain && totalCostBasis > 0
      ? (unrealizedGain / totalCostBasis) * 100
      : null;

    const holding = await prisma.investmentHolding.create({
      data: {
        investmentAccountId,
        ticker: ticker.toUpperCase(),
        name: name || null,
        units,
        averagePrice,
        frankingPercentage: frankingPercentage ?? null,
        type,
        // Phase 23 fields
        firstPurchaseDate: firstPurchaseDate ? new Date(firstPurchaseDate) : new Date(),
        totalCostBasis,
        currentPrice: currentPrice || null,
        currentValue,
        priceUpdatedAt: currentPrice ? new Date() : null,
        unrealizedGain,
        unrealizedGainPct,
      },
    });

    // Audit every state-changing write (CLAUDE.md §12.5). Generic CREATE
    // action with entityType — F.5's investment-account writes use
    // INVESTMENT_*; the nested holding writes use the generic actions. No
    // CDR/financial values in metadata (§13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'CREATE',
      status: 'SUCCESS',
      entityType: 'InvestmentHolding',
      entityId: holding.id,
      metadata: { type: holding.type },
    });

    return NextResponse.json(holding, { status: 201 });
  } catch (error) {
    console.error('Create holding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
