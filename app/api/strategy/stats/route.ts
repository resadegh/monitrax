/**
 * STRATEGY STATS API
 * GET /api/strategy/stats - Get summary statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get counts by status
    const statusCounts = await prisma.strategyRecommendation.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    });

    // Get counts by category
    const categoryCounts = await prisma.strategyRecommendation.groupBy({
      by: ['category'],
      where: { userId: user.id, status: 'PENDING' },
      _count: true,
    });

    // Get top recommendations
    const topRecommendations = await prisma.strategyRecommendation.findMany({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
      orderBy: { sbsScore: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        sbsScore: true,
        severity: true,
      },
    });

    // Calculate average SBS score
    const avgScore = await prisma.strategyRecommendation.aggregate({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
      _avg: {
        sbsScore: true,
      },
    });

    // Get recent activity
    const recentActivity = await prisma.strategyRecommendation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        actionedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        byStatus: statusCounts.reduce((acc: any, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        byCategory: categoryCounts.reduce((acc: any, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
        topRecommendations,
        averageSBSScore: avgScore._avg.sbsScore || 0,
        recentActivity,
      },
    });

  } catch (error) {
    console.error('[API] Error fetching stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
