/**
 * Capital Gains API
 * GET /api/investments/capital-gains - Get capital gains summary and events
 * POST /api/investments/capital-gains/calculate - Preview CGT for proposed sale
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

/**
 * Get Australian financial year for a given date
 */
function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 6) {
    // July onwards = current year to next year
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // Jan-June = previous year to current year
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
}

/**
 * Determine if CGT discount applies (held >= 12 months)
 */
function isCgtDiscountEligible(purchaseDate: Date, saleDate: Date): boolean {
  const days = daysBetween(purchaseDate, saleDate);
  return days >= 365;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);
      const financialYear = searchParams.get('financialYear');
      const accountId = searchParams.get('accountId');

      // Build where clause
      const whereClause: {
        investmentAccount: { userId: string };
        financialYear?: string;
        investmentAccountId?: string;
      } = {
        investmentAccount: { userId: authReq.user!.userId },
      };

      if (financialYear) {
        whereClause.financialYear = financialYear;
      }

      if (accountId) {
        whereClause.investmentAccountId = accountId;
      }

      // Get all capital gain events
      const capitalGainEvents = await prisma.capitalGainEvent.findMany({
        where: whereClause,
        include: {
          holding: {
            select: { id: true, ticker: true, name: true, type: true },
          },
          investmentAccount: {
            select: { id: true, name: true, platform: true },
          },
          lotAllocations: {
            include: {
              purchaseLot: {
                select: { purchaseDate: true, unitCost: true },
              },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      // Define type for capital gain events from query
      type CapitalGainEventWithRelations = typeof capitalGainEvents[number];

      // Calculate summary
      const totalGrossGain = capitalGainEvents
        .filter((e: CapitalGainEventWithRelations) => e.capitalGain > 0)
        .reduce((sum: number, e: CapitalGainEventWithRelations) => sum + e.capitalGain, 0);

      const totalGrossLoss = capitalGainEvents
        .filter((e: CapitalGainEventWithRelations) => e.capitalGain < 0)
        .reduce((sum: number, e: CapitalGainEventWithRelations) => sum + Math.abs(e.capitalGain), 0);

      const netCapitalGain = totalGrossGain - totalGrossLoss;

      const totalCgtDiscount = capitalGainEvents
        .filter((e: CapitalGainEventWithRelations) => e.capitalGain > 0 && e.capitalGainType === 'LONG_TERM')
        .reduce((sum: number, e: CapitalGainEventWithRelations) => sum + e.cgtDiscount, 0);

      const taxableNetGain = Math.max(0, netCapitalGain - totalCgtDiscount);

      // Group by financial year
      type FYSummary = {
        financialYear: string;
        events: CapitalGainEventWithRelations[];
        totalGain: number;
        totalLoss: number;
        netGain: number;
        cgtDiscount: number;
        taxableGain: number;
      };

      const byFinancialYear = capitalGainEvents.reduce((acc: Record<string, FYSummary>, event: CapitalGainEventWithRelations) => {
        const fy = event.financialYear;
        if (!acc[fy]) {
          acc[fy] = {
            financialYear: fy,
            events: [],
            totalGain: 0,
            totalLoss: 0,
            netGain: 0,
            cgtDiscount: 0,
            taxableGain: 0,
          };
        }
        acc[fy].events.push(event);
        if (event.capitalGain > 0) {
          acc[fy].totalGain += event.capitalGain;
          if (event.capitalGainType === 'LONG_TERM') {
            acc[fy].cgtDiscount += event.cgtDiscount;
          }
        } else {
          acc[fy].totalLoss += Math.abs(event.capitalGain);
        }
        acc[fy].netGain = acc[fy].totalGain - acc[fy].totalLoss;
        acc[fy].taxableGain = Math.max(0, acc[fy].netGain - acc[fy].cgtDiscount);
        return acc;
      }, {} as Record<string, FYSummary>);

      return NextResponse.json({
        summary: {
          totalGrossGain,
          totalGrossLoss,
          netCapitalGain,
          cgtDiscountApplied: totalCgtDiscount,
          taxableNetGain,
          eventCount: capitalGainEvents.length,
        },
        byFinancialYear: Object.values(byFinancialYear),
        events: capitalGainEvents,
      });
    } catch (error) {
      console.error('Get capital gains error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

/**
 * Preview capital gains for a proposed sale (without executing)
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { holdingId, unitsSold, salePrice, saleDate, saleFees = 0 } = body;

      if (!holdingId || !unitsSold || !salePrice) {
        return NextResponse.json(
          { error: 'holdingId, unitsSold, and salePrice are required' },
          { status: 400 }
        );
      }

      // Get holding and verify ownership
      const holding = await prisma.investmentHolding.findFirst({
        where: {
          id: holdingId,
          investmentAccount: { userId: authReq.user!.userId },
        },
        include: {
          investmentAccount: true,
          purchaseLots: {
            where: { isFullySold: false },
            orderBy: { purchaseDate: 'asc' }, // FIFO by default
          },
        },
      });

      if (!holding) {
        return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
      }

      // Check if enough units available
      type PurchaseLotType = typeof holding.purchaseLots[number];
      const availableUnits = holding.purchaseLots.reduce(
        (sum: number, lot: PurchaseLotType) => sum + lot.unitsRemaining,
        0
      );

      if (unitsSold > availableUnits) {
        return NextResponse.json(
          { error: `Insufficient units. Available: ${availableUnits}, Requested: ${unitsSold}` },
          { status: 400 }
        );
      }

      // Calculate using FIFO (or account's preferred method)
      const costBasisMethod = holding.investmentAccount.costBasisMethod || 'FIFO';
      const saleDateObj = saleDate ? new Date(saleDate) : new Date();
      const grossProceeds = unitsSold * salePrice - saleFees;

      // Allocate units to lots based on cost basis method
      let remainingUnits = unitsSold;
      let totalCostBasis = 0;
      const lotAllocations: Array<{
        lotId: string;
        purchaseDate: Date;
        unitsAllocated: number;
        costBasisAllocated: number;
        holdingPeriodDays: number;
        cgtDiscountEligible: boolean;
      }> = [];

      // Sort lots based on method
      const sortedLots = [...holding.purchaseLots];
      if (costBasisMethod === 'LIFO') {
        sortedLots.reverse();
      } else if (costBasisMethod === 'HIFO') {
        sortedLots.sort((a, b) => b.unitCost - a.unitCost);
      }
      // FIFO is default (already sorted by purchaseDate asc)

      for (const lot of sortedLots) {
        if (remainingUnits <= 0) break;

        const unitsFromLot = Math.min(remainingUnits, lot.unitsRemaining);
        const costFromLot = unitsFromLot * lot.unitCost;
        const holdingPeriodDays = daysBetween(lot.purchaseDate, saleDateObj);

        lotAllocations.push({
          lotId: lot.id,
          purchaseDate: lot.purchaseDate,
          unitsAllocated: unitsFromLot,
          costBasisAllocated: costFromLot,
          holdingPeriodDays,
          cgtDiscountEligible: isCgtDiscountEligible(lot.purchaseDate, saleDateObj),
        });

        totalCostBasis += costFromLot;
        remainingUnits -= unitsFromLot;
      }

      // Calculate capital gain
      const capitalGain = grossProceeds - totalCostBasis;

      // Determine CGT type - if all lots are eligible, it's LONG_TERM
      const allLotsLongTerm = lotAllocations.every(l => l.cgtDiscountEligible);
      const capitalGainType = allLotsLongTerm ? 'LONG_TERM' : 'SHORT_TERM';

      // Calculate CGT discount (50% for individuals on long-term gains)
      let cgtDiscount = 0;
      if (capitalGainType === 'LONG_TERM' && capitalGain > 0) {
        cgtDiscount = capitalGain * 0.5;
      }

      const taxableGain = capitalGain > 0 ? capitalGain - cgtDiscount : capitalGain;
      const financialYear = getFinancialYear(saleDateObj);

      return NextResponse.json({
        preview: true,
        holdingId,
        ticker: holding.ticker,
        unitsSold,
        salePrice,
        saleDate: saleDateObj.toISOString(),
        saleFees,
        costBasisMethod,
        financialYear,
        calculation: {
          grossProceeds,
          totalCostBasis,
          capitalGain,
          capitalGainType,
          cgtDiscount,
          taxableGain,
        },
        lotAllocations,
        message: capitalGain >= 0
          ? `Estimated taxable gain: $${taxableGain.toFixed(2)}`
          : `Estimated capital loss: $${Math.abs(capitalGain).toFixed(2)}`,
      });
    } catch (error) {
      console.error('Calculate capital gains preview error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
