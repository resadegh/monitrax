/**
 * ALTERNATIVES API
 * GET /api/strategy/:id/alternatives - Get alternative approaches for a recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { generateAlternatives } from '@/lib/strategy';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch recommendation
    const recommendation = await prisma.strategyRecommendation.findFirst({
      where: {
        id: params.id,
        userId: user.id,
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
}
