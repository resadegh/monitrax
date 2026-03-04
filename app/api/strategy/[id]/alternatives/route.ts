/**
 * ALTERNATIVES API
 * GET /api/strategy/:id/alternatives - Get alternative approaches for a recommendation
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { generateAlternatives } from '@/lib/strategy';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('report.read', async (_request, auth, context) => {
  try {
    const { id } = await context!.params;
    const userId = auth.userId;

    // Fetch recommendation
    const recommendation = await prisma.strategyRecommendation.findFirst({
      where: {
        id,
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
