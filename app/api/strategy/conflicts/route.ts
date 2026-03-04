/**
 * CONFLICTS API
 * GET /api/strategy/conflicts - Detect conflicts between current recommendations
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { detectConflicts } from '@/lib/strategy';

export const GET = withPermission('report.read', async (_request, auth) => {
  try {
    const userId = auth.userId;

    // Fetch all pending recommendations
    const recommendations = await prisma.strategyRecommendation.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      select: {
        id: true,
        category: true,
        type: true,
        title: true,
        sbsScore: true,
        financialImpact: true,
        affectedEntities: true,
      },
    });

    // Detect conflicts
    const conflicts = detectConflicts(recommendations as any);

    return NextResponse.json({
      success: true,
      data: {
        conflictCount: conflicts.length,
        conflicts,
        recommendationsAnalyzed: recommendations.length,
      },
    });
  } catch (error) {
    console.error('[API] Error detecting conflicts:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect conflicts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
