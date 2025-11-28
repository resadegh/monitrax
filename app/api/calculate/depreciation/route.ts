/**
 * Depreciation Calculation API
 * POST /api/calculate/depreciation
 *
 * Calculate depreciation schedules for investment properties.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import prisma from '@/lib/db';
import {
  calculateDepreciationAnnual,
  calculatePropertyDepreciation,
  generateDepreciationForecast,
  calculateProRataDepreciation,
  getDiv43Rate,
  DepreciationResult,
  DepreciationForecast,
} from '@/lib/depreciation';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const depreciationCalculationSchema = z.object({
  // Calculate for a specific property
  propertyId: z.string().optional(),

  // Or provide schedules directly
  schedules: z
    .array(
      z.object({
        id: z.string(),
        assetName: z.string(),
        category: z.enum(['DIV40', 'DIV43']),
        cost: z.number().positive(),
        startDate: z.string(), // ISO date string
        rate: z.number().min(0).max(100),
        method: z.enum(['PRIME_COST', 'DIMINISHING_VALUE']),
      })
    )
    .optional(),

  // Calculation options
  asOfDate: z.string().optional(), // ISO date string
  forecastYears: z.number().int().min(1).max(40).default(10),

  // Calculate Division 43 rate for a construction date
  constructionDate: z.string().optional(),
});

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();

      // Validate input
      const parseResult = depreciationCalculationSchema.safeParse(body);
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
      const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

      // Special case: just calculate Division 43 rate
      if (input.constructionDate) {
        const constructionDate = new Date(input.constructionDate);
        const rate = getDiv43Rate(constructionDate);

        return NextResponse.json({
          input: { constructionDate: input.constructionDate },
          output: {
            rate: rate * 100, // Convert to percentage
            rateDescription:
              rate === 0.025
                ? '2.5% (post-September 1987)'
                : rate === 0.04
                  ? '4% (July 1985 - September 1987)'
                  : '0% (pre-July 1985 - no deduction)',
            yearsToFullDepreciation: rate > 0 ? Math.ceil(1 / rate) : null,
          },
          diagnostics: {
            warnings: rate === 0 ? ['No capital works deduction available for pre-1985 buildings'] : [],
            assumptions: ['Australian Division 43 rules applied'],
          },
        });
      }

      let schedulesData = input.schedules;

      // Fetch from database if propertyId provided
      if (input.propertyId && !schedulesData) {
        const property = await prisma.property.findFirst({
          where: {
            id: input.propertyId,
            userId: authReq.user!.userId,
          },
          include: {
            depreciationSchedules: true,
          },
        });

        if (!property) {
          return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        schedulesData = property.depreciationSchedules.map((s: any) => ({
          id: s.id,
          assetName: s.assetName,
          category: s.category as 'DIV40' | 'DIV43',
          cost: s.cost,
          startDate: s.startDate.toISOString(),
          rate: s.rate,
          method: s.method as 'PRIME_COST' | 'DIMINISHING_VALUE',
        }));
      }

      if (!schedulesData || schedulesData.length === 0) {
        return NextResponse.json({
          input: { schedulesCount: 0 },
          output: {
            totalAnnualDepreciation: 0,
            totalDiv40: 0,
            totalDiv43: 0,
            schedules: [],
          },
          diagnostics: {
            warnings: ['No depreciation schedules found'],
            assumptions: [],
          },
        });
      }

      // Convert to format expected by calculation functions
      const schedules = schedulesData.map((s) => ({
        id: s.id,
        assetName: s.assetName,
        category: s.category,
        cost: s.cost,
        startDate: new Date(s.startDate),
        rate: s.rate,
        method: s.method,
      }));

      // Calculate current depreciation for each schedule
      const depreciationResults: DepreciationResult[] = schedules.map((schedule) =>
        calculateDepreciationAnnual(schedule, asOfDate)
      );

      // Calculate property totals
      const totalDiv40 = depreciationResults
        .filter((r) => r.category === 'DIV40')
        .reduce((sum, r) => sum + r.annualDepreciation, 0);

      const totalDiv43 = depreciationResults
        .filter((r) => r.category === 'DIV43')
        .reduce((sum, r) => sum + r.annualDepreciation, 0);

      const totalAnnualDepreciation = totalDiv40 + totalDiv43;

      // Generate forecasts
      const forecasts: Record<string, DepreciationForecast[]> = {};
      for (const schedule of schedules) {
        forecasts[schedule.id] = generateDepreciationForecast(schedule, input.forecastYears);
      }

      // Calculate aggregate forecast
      const aggregateForecast: DepreciationForecast[] = [];
      for (let year = 1; year <= input.forecastYears; year++) {
        let annualAmount = 0;
        for (const scheduleId of Object.keys(forecasts)) {
          const yearData = forecasts[scheduleId].find((f) => f.year === year);
          if (yearData) {
            annualAmount += yearData.annualAmount;
          }
        }
        aggregateForecast.push({
          year,
          annualAmount: Math.round(annualAmount * 100) / 100,
          cumulativeAmount: aggregateForecast.reduce((sum, f) => sum + f.annualAmount, 0) + annualAmount,
          writtenDownValue: 0, // Not applicable for aggregate
        });
      }

      // Calculate tax benefit (at 37% marginal rate)
      const marginalTaxRate = 0.37;
      const annualTaxBenefit = totalAnnualDepreciation * marginalTaxRate;

      // Diagnostics
      const diagnostics: { warnings: string[]; assumptions: string[] } = {
        warnings: [],
        assumptions: [],
      };

      const fullyDepreciated = depreciationResults.filter((r) => r.yearsRemaining === 0);
      if (fullyDepreciated.length > 0) {
        diagnostics.warnings.push(`${fullyDepreciated.length} asset(s) fully depreciated`);
      }

      const lowValueAssets = depreciationResults.filter(
        (r) => r.originalCost < 1000 && r.category === 'DIV40'
      );
      if (lowValueAssets.length > 0) {
        diagnostics.warnings.push(
          `${lowValueAssets.length} low-value asset(s) may qualify for instant write-off`
        );
      }

      diagnostics.assumptions.push('Australian ATO Division 40 and 43 rules applied');
      diagnostics.assumptions.push(`Depreciation calculated as of ${asOfDate.toISOString().split('T')[0]}`);
      diagnostics.assumptions.push('Tax benefit calculated at 37% marginal rate');

      const response = {
        input: {
          propertyId: input.propertyId,
          schedulesCount: schedulesData.length,
          asOfDate: asOfDate.toISOString().split('T')[0],
          forecastYears: input.forecastYears,
        },
        output: {
          summary: {
            totalAnnualDepreciation: Math.round(totalAnnualDepreciation * 100) / 100,
            totalDiv40: Math.round(totalDiv40 * 100) / 100,
            totalDiv43: Math.round(totalDiv43 * 100) / 100,
            annualTaxBenefit: Math.round(annualTaxBenefit * 100) / 100,
            monthlyTaxBenefit: Math.round((annualTaxBenefit / 12) * 100) / 100,
          },
          schedules: depreciationResults.map((r) => ({
            scheduleId: r.scheduleId,
            assetName: r.assetName,
            category: r.category,
            method: r.method,
            originalCost: Math.round(r.originalCost * 100) / 100,
            currentWrittenDownValue: Math.round(r.currentWrittenDownValue * 100) / 100,
            annualDepreciation: Math.round(r.annualDepreciation * 100) / 100,
            dailyDepreciation: Math.round(r.dailyDepreciation * 100) / 100,
            totalDepreciationClaimed: Math.round(r.totalDepreciationClaimed * 100) / 100,
            yearsRemaining: r.yearsRemaining,
          })),
          forecast: aggregateForecast,
          forecastBySchedule: Object.fromEntries(
            Object.entries(forecasts).map(([id, f]) => [
              id,
              f.map((row) => ({
                year: row.year,
                annualAmount: Math.round(row.annualAmount * 100) / 100,
                cumulativeAmount: Math.round(row.cumulativeAmount * 100) / 100,
                writtenDownValue: Math.round(row.writtenDownValue * 100) / 100,
              })),
            ])
          ),
        },
        diagnostics,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Depreciation calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
