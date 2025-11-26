/**
 * ALTERNATIVES API
 * GET /api/strategy/:id/alternatives - Get alternative approaches for a recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { generateAlternatives } from '@/lib/strategy';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch recommendation
      const recommendation = await prisma.strategyRecommendation.findFirst({
        where: {
          id: params.id,
          userId,
        },
      });

      if (!recommendation) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      // Generate alternatives
      const alternatives = generateAlternatives(recommendation as any);

      return NextResponse.json({
        success: true,
        data: {
          recommendation: {
            id: recommendation.id,
            title: recommendation.title,
            category: recommendation.category,
            sbsScore: recommendation.sbsScore,
          },
          alternatives,
        },
      });

    } catch (error) {
      console.error('[API] Error generating alternatives:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate alternatives',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
