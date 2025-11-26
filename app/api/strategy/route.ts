/**
 * STRATEGY RECOMMENDATIONS API
 * GET /api/strategy - List all recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Parse query params
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const category = searchParams.get('category') || undefined;
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Build where clause
      const where: any = {
        userId,
      };

      if (status) {
        where.status = status;
      }

      if (category) {
        where.category = category;
      }

      // Fetch recommendations
      const [recommendations, total] = await Promise.all([
        prisma.strategyRecommendation.findMany({
          where,
          orderBy: [
            { sbsScore: 'desc' }, // Highest SBS first
            { createdAt: 'desc' },
          ],
          take: limit,
          skip: offset,
          select: {
            id: true,
            category: true,
            type: true,
            severity: true,
            title: true,
            summary: true,
            sbsScore: true,
            confidence: true,
            status: true,
            financialImpact: true,
            riskImpact: true,
            affectedEntities: true,
            createdAt: true,
            expiresAt: true,
          },
        }),
        prisma.strategyRecommendation.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          recommendations,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });

    } catch (error) {
      console.error('[API] Error fetching recommendations:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch recommendations',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
