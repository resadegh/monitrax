/**
 * STRATEGY GENERATION API
 * POST /api/strategy/generate
 *
 * Generates all strategy recommendations for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateStrategies } from '@/lib/strategy';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Parse options from body (optional)
      const body = await request.json().catch(() => ({}));
      const { forceRefresh = false } = body;

      console.log(`[API] Generating strategies for user: ${userId}`);

      // Generate strategies
      const result = await generateStrategies({
        userId,
        forceRefresh,
      });

      console.log(`[API] Generated ${result.recommendations.length} recommendations`);
      console.log(`[API] Data quality: ${result.dataQuality.overallScore}%`);
      console.log(`[API] Execution time: ${result.executionTime}ms`);

      // Return result
      return NextResponse.json({
        success: true,
        data: {
          recommendations: result.recommendations,
          dataQuality: result.dataQuality,
          stats: {
            totalFindings: result.findingsCount,
            recommendationsSaved: result.recommendations.length,
            analyzersRun: result.analyzersRun,
            executionTime: result.executionTime,
          },
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });

    } catch (error) {
      console.error('[API] Strategy generation error:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate strategies',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
