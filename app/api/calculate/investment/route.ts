/**
 * Investment Calculation API
 * POST /api/calculate/investment
 *
 * Calculate investment performance, returns, and franking credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import prisma from '@/lib/db';
import {
  calculateHoldingValue,
  calculateInvestmentPerformance,
  calculateFrankingCreditAU,
  calculateDividendYieldAU,
  AU_CORPORATE_TAX_RATE,
} from '@/lib/investments';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const investmentCalculationSchema = z.object({
  // Calculate for a specific account or all
  accountId: z.string().optional(),

  // Or provide holdings directly
  holdings: z
    .array(
      z.object({
        id: z.string(),
        ticker: z.string(),
        units: z.number().min(0),
        averagePrice: z.number().min(0),
        currentPrice: z.number().min(0),
        annualDividend: z.number().min(0).default(0),
        frankingPercentage: z.number().min(0).max(100).default(100),
      })
    )
    .optional(),

  transactions: z
    .array(
      z.object({
        type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DISTRIBUTION']),
        units: z.number(),
        price: z.number(),
        fees: z.number().default(0),
      })
    )
    .optional(),

  // Calculate franking credit for a specific dividend
  frankingCalculation: z
    .object({
      netDividend: z.number().positive(),
      frankingPercentage: z.number().min(0).max(100).default(100),
    })
    .optional(),
});

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();

      // Validate input
      const parseResult = investmentCalculationSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const input = parseResult.data;

      // Special case: just calculate franking credits
      if (input.frankingCalculation) {
        const frankingResult = calculateFrankingCreditAU(
          input.frankingCalculation.netDividend,
          input.frankingCalculation.frankingPercentage,
          AU_CORPORATE_TAX_RATE
        );

        return NextResponse.json({
          input: input.frankingCalculation,
          output: {
            grossDividend: Math.round(frankingResult.grossDividend * 100) / 100,
            frankingCredit: Math.round(frankingResult.frankingCredit * 100) / 100,
            netDividend: Math.round(frankingResult.netDividend * 100) / 100,
            frankingPercentage: frankingResult.frankingPercentage,
            corporateTaxRate: AU_CORPORATE_TAX_RATE * 100,
          },
          diagnostics: {
            warnings: [],
            assumptions: ['Australian corporate tax rate of 30% applied'],
          },
        });
      }

      let holdingsData = input.holdings;
      let transactionsData = input.transactions;

      // Fetch from database if not provided
      if (!holdingsData && !input.accountId) {
        // Fetch all investment accounts for user
        const accounts = await prisma.investmentAccount.findMany({
          where: { userId: authReq.user!.userId },
          include: {
            holdings: true,
            transactions: true,
          },
        });

        holdingsData = accounts.flatMap((acc) =>
          acc.holdings.map((h) => ({
            id: h.id,
            ticker: h.ticker,
            units: h.units,
            averagePrice: h.averagePrice,
            currentPrice: h.averagePrice, // Use averagePrice as default (currentPrice would need market data)
            annualDividend: 0, // Would need market data
            frankingPercentage: h.frankingPercentage || 100,
          }))
        );

        transactionsData = accounts.flatMap((acc) =>
          acc.transactions.map((t) => ({
            type: t.type as 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION',
            units: t.units,
            price: t.price,
            fees: t.fees || 0,
          }))
        );
      } else if (input.accountId) {
        const account = await prisma.investmentAccount.findFirst({
          where: {
            id: input.accountId,
            userId: authReq.user!.userId,
          },
          include: {
            holdings: true,
            transactions: true,
          },
        });

        if (!account) {
          return NextResponse.json({ error: 'Investment account not found' }, { status: 404 });
        }

        holdingsData = account.holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          units: h.units,
          averagePrice: h.averagePrice,
          currentPrice: h.averagePrice, // Use averagePrice as default
          annualDividend: 0,
          frankingPercentage: h.frankingPercentage || 100,
        }));

        transactionsData = account.transactions.map((t) => ({
          type: t.type as 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION',
          units: t.units,
          price: t.price,
          fees: t.fees || 0,
        }));
      }

      if (!holdingsData || holdingsData.length === 0) {
        return NextResponse.json({
          input: { holdingsCount: 0 },
          output: {
            totalValue: 0,
            totalCostBase: 0,
            unrealisedGain: 0,
            unrealisedGainPercent: 0,
            holdings: [],
          },
          diagnostics: {
            warnings: ['No holdings found'],
            assumptions: [],
          },
        });
      }

      // Calculate holding values
      const holdingResults = holdingsData.map((h) => {
        const value = calculateHoldingValue(
          { id: h.id, ticker: h.ticker, units: h.units, averagePrice: h.averagePrice },
          h.currentPrice
        );

        const dividendYield =
          h.annualDividend > 0
            ? calculateDividendYieldAU(
                { id: h.id, ticker: h.ticker, frankingPercentage: h.frankingPercentage },
                h.annualDividend,
                h.currentPrice
              )
            : null;

        return {
          ...value,
          dividendYield: dividendYield
            ? {
                yield: Math.round(dividendYield.dividendYield * 10000) / 100,
                grossedUpYield: Math.round(dividendYield.grossedUpYield * 10000) / 100,
                annualDividend: h.annualDividend,
              }
            : null,
        };
      });

      // Calculate overall performance
      const performance = calculateInvestmentPerformance(
        holdingsData.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          units: h.units,
          averagePrice: h.averagePrice,
          currentPrice: h.currentPrice,
        })),
        transactionsData || []
      );

      // Group by ticker
      const byTicker: Record<string, { value: number; units: number; gain: number }> = {};
      for (const holding of holdingResults) {
        if (!byTicker[holding.ticker]) {
          byTicker[holding.ticker] = { value: 0, units: 0, gain: 0 };
        }
        byTicker[holding.ticker].value += holding.marketValue;
        byTicker[holding.ticker].units += holding.units;
        byTicker[holding.ticker].gain += holding.unrealisedGain;
      }

      // Diagnostics
      const diagnostics: { warnings: string[]; assumptions: string[] } = {
        warnings: [],
        assumptions: [],
      };

      const largeGains = holdingResults.filter((h) => h.unrealisedGainPercentage > 50);
      if (largeGains.length > 0) {
        diagnostics.warnings.push(
          `${largeGains.length} holding(s) with >50% gains - consider CGT implications`
        );
      }

      const largeLosses = holdingResults.filter((h) => h.unrealisedGainPercentage < -20);
      if (largeLosses.length > 0) {
        diagnostics.warnings.push(`${largeLosses.length} holding(s) with >20% losses`);
      }

      diagnostics.assumptions.push('Current prices as provided or from database');
      diagnostics.assumptions.push('Australian franking credits assumed at 30% corporate rate');

      const response = {
        input: {
          holdingsCount: holdingsData.length,
          transactionsCount: (transactionsData || []).length,
        },
        output: {
          performance: {
            totalInvested: Math.round(performance.totalInvested * 100) / 100,
            totalMarketValue: Math.round(performance.totalMarketValue * 100) / 100,
            totalUnrealisedGain: Math.round(performance.totalUnrealisedGain * 100) / 100,
            totalUnrealisedGainPercent: Math.round(performance.totalUnrealisedGainPercentage * 100) / 100,
            totalDividendsReceived: Math.round(performance.totalDividendsReceived * 100) / 100,
            totalFees: Math.round(performance.totalFees * 100) / 100,
            netReturn: Math.round(performance.netReturn * 100) / 100,
            netReturnPercent: Math.round(performance.netReturnPercentage * 100) / 100,
          },
          holdings: holdingResults.map((h) => ({
            ticker: h.ticker,
            units: h.units,
            averagePrice: Math.round(h.averagePrice * 100) / 100,
            currentPrice: Math.round(h.currentPrice * 100) / 100,
            marketValue: Math.round(h.marketValue * 100) / 100,
            costBase: Math.round(h.costBase * 100) / 100,
            unrealisedGain: Math.round(h.unrealisedGain * 100) / 100,
            unrealisedGainPercent: Math.round(h.unrealisedGainPercentage * 100) / 100,
            dividendYield: h.dividendYield,
          })),
          byTicker,
        },
        diagnostics,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Investment calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
