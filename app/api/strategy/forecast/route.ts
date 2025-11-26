/**
 * FORECAST API ENDPOINT
 * Phase 11 - Stage 5: Multi-Year Forecasting
 *
 * GET /api/strategy/forecast - Generate multi-year financial forecast
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  collectStrategyData,
  generateForecast,
  type ForecastAssumptions,
} from '@/lib/strategy';

// =============================================================================
// GET - Generate Forecast
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);

      // Get query parameters
      const scenario = (searchParams.get('scenario') || 'DEFAULT') as
        | 'CONSERVATIVE'
        | 'DEFAULT'
        | 'AGGRESSIVE';
      const yearsParam = searchParams.get('years');
      const years = yearsParam ? parseInt(yearsParam, 10) : 30;

      // Validate years
      if (![5, 10, 20, 30].includes(years)) {
        return NextResponse.json(
          { error: 'Years must be 5, 10, 20, or 30' },
          { status: 400 }
        );
      }

      // Collect strategy data
      const data = await collectStrategyData(userId);

      // Get user strategy session for custom assumptions
      const session = await prisma.strategySession.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      // Build custom assumptions from session
      const customAssumptions: Partial<ForecastAssumptions> = {};

      if (session) {
        if (session.retirementAge) {
          customAssumptions.retirementAge = session.retirementAge;
        }
        // Note: Other assumptions like inflationRate, portfolioReturnRate, etc.
        // are determined by the scenario (CONSERVATIVE/DEFAULT/AGGRESSIVE)
      }

      // Generate forecast
      const forecast = generateForecast(data, customAssumptions, scenario);

      // Trim projections to requested years
      const trimmedForecast = {
        ...forecast,
        projections: forecast.projections.slice(0, years + 1),
      };

      return NextResponse.json({
        success: true,
        data: trimmedForecast,
      });
    } catch (error) {
      console.error('[ForecastAPI] Error generating forecast:', error);
      return NextResponse.json(
        {
          error: 'Failed to generate forecast',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Generate and Compare All Scenarios
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();
      const { years = 30, customAssumptions = {} } = body;

      // Validate years
      if (![5, 10, 20, 30].includes(years)) {
        return NextResponse.json(
          { error: 'Years must be 5, 10, 20, or 30' },
          { status: 400 }
        );
      }

      // Collect strategy data
      const data = await collectStrategyData(userId);

      // Generate all three scenarios
      const scenarios = ['CONSERVATIVE', 'DEFAULT', 'AGGRESSIVE'] as const;
      const forecasts = scenarios.map((scenarioType) => {
        const forecast = generateForecast(data, customAssumptions, scenarioType);
        return {
          ...forecast,
          projections: forecast.projections.slice(0, years + 1),
        };
      });

      // Build comparison summary
      const comparison = {
        timeHorizon: years,
        scenarios: forecasts.map((f) => ({
          scenario: f.scenario,
          netWorthAtEnd: f.projections[f.projections.length - 1].netWorth,
          retirementReadiness: f.summary.canRetireComfortably,
          replacementRatio: f.summary.replacementRatio,
        })),
        recommendedScenario: forecasts.find((f) => f.scenario === 'DEFAULT')?.scenario,
      };

      return NextResponse.json({
        success: true,
        data: {
          forecasts,
          comparison,
        },
      });
    } catch (error) {
      console.error('[ForecastAPI] Error generating scenarios:', error);
      return NextResponse.json(
        {
          error: 'Failed to generate forecast scenarios',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
