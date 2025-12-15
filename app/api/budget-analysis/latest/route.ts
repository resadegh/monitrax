/**
 * BUDGET ANALYSIS LATEST API
 * GET /api/budget-analysis/latest - Get most recent budget analysis
 *
 * Phase 28: Realistic Budget Integration
 *
 * Returns the user's most recent budget analysis with staleness indicator.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// Analysis is considered stale after 30 days
const STALE_DAYS = 30;

// =============================================================================
// API Handler
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch most recent analysis
      const analysis = await prisma.budgetAnalysis.findFirst({
        where: { userId },
        orderBy: { analysisDate: 'desc' },
        include: {
          householdProfile: true,
        },
      });

      if (!analysis) {
        // Check if household profile exists
        const profile = await prisma.householdProfile.findUnique({
          where: { userId },
        });

        return NextResponse.json(
          {
            success: false,
            error: 'No budget analysis found',
            message: 'Please complete household profile and generate a budget analysis.',
            householdProfileComplete: profile?.isComplete || false,
          },
          { status: 404 }
        );
      }

      // Calculate staleness
      const now = new Date();
      const analysisDate = new Date(analysis.analysisDate);
      const daysSinceAnalysis = Math.floor(
        (now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isStale = daysSinceAnalysis > STALE_DAYS;

      // Check if household profile changed since analysis
      let profileChanged = false;
      if (analysis.householdProfile) {
        const profileUpdated = new Date(analysis.householdProfile.updatedAt);
        profileChanged = profileUpdated > analysisDate;
      }

      return NextResponse.json({
        success: true,
        data: {
          id: analysis.id,
          analysisDate: analysis.analysisDate,
          status: analysis.status,
          totalRealisticBudget: analysis.totalRealisticBudget,
          recurringExpensesTotal: analysis.recurringExpensesTotal,
          aiVariableEstimate: analysis.aiVariableEstimate,
          userFinalBudget: analysis.userFinalBudget,
          userOverrodeAi: analysis.userOverrodeAi,
          isStale,
          profileChanged,
          daysOld: daysSinceAnalysis,

          // Include full breakdown for UI
          recurring: {
            total: analysis.recurringExpensesTotal,
            breakdown: analysis.recurringBreakdown,
          },
          variable: {
            total: analysis.aiVariableEstimate,
            breakdown: analysis.variableBreakdown,
          },
          scenarios: {
            minimum: analysis.minimumScenario,
            recommended: analysis.recommendedScenario,
            comfortable: analysis.comfortableScenario,
          },
          aiExplanation: analysis.aiExplanation,
          aiConfidence: analysis.aiConfidence,
        },
      });
    } catch (error) {
      console.error('[API] Get latest budget analysis error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve budget analysis',
        },
        { status: 500 }
      );
    }
  });
}
