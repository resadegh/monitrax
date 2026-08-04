/**
 * BUDGET ANALYSIS LATEST API
 * GET /api/budget-analysis/latest - Get most recent budget analysis
 *
 * Phase 28: Realistic Budget Integration
 *
 * Returns the user's most recent budget analysis with staleness indicator.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

// Analysis is considered stale after 30 days
const STALE_DAYS = 30;

// =============================================================================
// API Handler
// =============================================================================

export const GET = withPermission('expense.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_HOUSEHOLD');
    if (gateBlocked) return gateBlocked;
    try {
      const userId = auth.userId;

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

      // Parse the recurringBreakdown to extract committed vs discretionary
      const breakdown = (analysis.recurringBreakdown as any) || {};

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

          // NEW: Properly separated committed vs discretionary
          committed: {
            total: breakdown.committedTotal || analysis.recurringExpensesTotal,
            essentialExpenses: breakdown.essentialExpensesTotal || 0,
            loanRepayments: breakdown.loanRepaymentsTotal || 0,
            breakdown: breakdown.committedBreakdown || null,
          },
          discretionaryTracked: {
            total: breakdown.discretionaryTrackedTotal || 0,
            breakdown: breakdown.discretionaryBreakdown || null,
          },

          // NEW: Totals with proper breakdown
          totals: {
            committedExpenses: breakdown.committedTotal || analysis.recurringExpensesTotal,
            discretionaryTracked: breakdown.discretionaryTrackedTotal || 0,
            variableExpenses: analysis.aiVariableEstimate,
            totalRealisticBudget: analysis.totalRealisticBudget,
            recurringExpenses: breakdown.total || analysis.recurringExpensesTotal,
            userReportedTotal: analysis.userReportedTotal,
            missingExpenses: analysis.missingVariableExpenses,
          },

          // Legacy format for backwards compatibility
          recurring: {
            total: breakdown.total || analysis.recurringExpensesTotal,
            breakdown: breakdown.categories ? { categories: breakdown.categories, total: breakdown.total } : analysis.recurringBreakdown,
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
