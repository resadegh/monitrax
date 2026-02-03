import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyIndirectOwnership } from '@/lib/utils/ownership';
import { z } from 'zod';

const updateHoldingSchema = z.object({
  ticker: z.string().min(1).optional(),
  name: z.string().optional(),
  units: z.number().positive().optional(),
  averagePrice: z.number().positive().optional(),
  frankingPercentage: z.number().min(0).max(100).nullable().optional(),
  type: z.enum(['SHARE', 'ETF', 'MANAGED_FUND', 'CRYPTO']).optional(),
  // Phase 23: Price update
  currentPrice: z.number().positive().optional(),
});

const priceUpdateSchema = z.object({
  currentPrice: z.number().positive('Price must be positive'),
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

      const ownershipResult = verifyIndirectOwnership(
        holding,
        holding?.investmentAccount,
        authReq.user!.userId,
        'Holding'
      );
      if (!ownershipResult.success) return ownershipResult.response;

      return NextResponse.json(ownershipResult.resource);
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

      const ownershipResult = verifyIndirectOwnership(
        existing,
        existing?.investmentAccount,
        authReq.user!.userId,
        'Holding'
      );
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedHolding = ownershipResult.resource;

      const { ticker, name, units, averagePrice, frankingPercentage, type, currentPrice } = validation.data;

      // Get current holding for calculations
      const newUnits = units ?? verifiedHolding.units;
      const newAvgPrice = averagePrice ?? verifiedHolding.averagePrice;
      const newPrice = currentPrice ?? verifiedHolding.currentPrice;

      // Recalculate values if units, price, or current price changed
      const totalCostBasis = newUnits * newAvgPrice;
      const currentValue = newPrice ? newUnits * newPrice : null;
      const unrealizedGain = currentValue ? currentValue - totalCostBasis : null;
      const unrealizedGainPct = unrealizedGain && totalCostBasis > 0
        ? (unrealizedGain / totalCostBasis) * 100
        : null;

      const holding = await prisma.investmentHolding.update({
        where: { id },
        data: {
          ...(ticker !== undefined && { ticker: ticker.toUpperCase() }),
          ...(name !== undefined && { name }),
          ...(units !== undefined && { units }),
          ...(averagePrice !== undefined && { averagePrice }),
          ...(frankingPercentage !== undefined && { frankingPercentage }),
          ...(type !== undefined && { type }),
          // Phase 23: Update calculated fields
          ...(currentPrice !== undefined && {
            currentPrice,
            priceUpdatedAt: new Date(),
          }),
          totalCostBasis,
          currentValue,
          unrealizedGain,
          unrealizedGainPct,
        },
      });

      return NextResponse.json(holding);
    } catch (error) {
      console.error('Update holding error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

/**
 * PATCH - Quick price update for a holding
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const validation = priceUpdateSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Verify ownership
      const existing = await prisma.investmentHolding.findUnique({
        where: { id },
        include: { investmentAccount: true },
      });

      const ownershipResult = verifyIndirectOwnership(
        existing,
        existing?.investmentAccount,
        authReq.user!.userId,
        'Holding'
      );
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedHolding = ownershipResult.resource;

      const { currentPrice } = validation.data;

      // Recalculate values
      const totalCostBasis = verifiedHolding.units * verifiedHolding.averagePrice;
      const currentValue = verifiedHolding.units * currentPrice;
      const unrealizedGain = currentValue - totalCostBasis;
      const unrealizedGainPct = totalCostBasis > 0
        ? (unrealizedGain / totalCostBasis) * 100
        : 0;

      const holding = await prisma.investmentHolding.update({
        where: { id },
        data: {
          currentPrice,
          priceUpdatedAt: new Date(),
          currentValue,
          unrealizedGain,
          unrealizedGainPct,
        },
      });

      return NextResponse.json({
        ...holding,
        priceChange: {
          previousPrice: verifiedHolding.currentPrice,
          newPrice: currentPrice,
          percentageChange: verifiedHolding.currentPrice
            ? ((currentPrice - verifiedHolding.currentPrice) / verifiedHolding.currentPrice) * 100
            : null,
        },
      });
    } catch (error) {
      console.error('Update holding price error:', error);
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

      const ownershipResult = verifyIndirectOwnership(
        existing,
        existing?.investmentAccount,
        authReq.user!.userId,
        'Holding'
      );
      if (!ownershipResult.success) return ownershipResult.response;

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
