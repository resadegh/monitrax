/**
 * BUDGET ANALYSIS SAVE CHOICE API
 * POST /api/budget-analysis/save-choice - Save user's budget choice
 *
 * Phase 28: Realistic Budget Integration
 *
 * Saves the user's final budget choice after reviewing AI analysis.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

// =============================================================================
// API Handler
// =============================================================================

export const POST = withPermission('expense.write', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_HOUSEHOLD', auth.userId);
    if (gateBlocked) return gateBlocked;
    try {
      const userId = auth.userId;
      const body = await request.json();

      const { analysisId, choice, customBudget, adjustments } = body;

      // Validate required fields
      if (!analysisId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing analysisId',
          },
          { status: 400 }
        );
      }

      if (!choice || !['minimum', 'recommended', 'comfortable', 'custom'].includes(choice)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid choice',
            message: 'Choice must be one of: minimum, recommended, comfortable, custom',
          },
          { status: 400 }
        );
      }

      if (choice === 'custom' && (customBudget === undefined || customBudget === null)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Custom budget required',
            message: 'customBudget is required when choice is "custom"',
          },
          { status: 400 }
        );
      }

      // Fetch existing analysis
      const analysis = await prisma.budgetAnalysis.findUnique({
        where: { id: analysisId },
      });

      if (!analysis) {
        return NextResponse.json(
          {
            success: false,
            error: 'Analysis not found',
          },
          { status: 404 }
        );
      }

      // Verify ownership
      if (analysis.userId !== userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 403 }
        );
      }

      // Determine final budget based on choice
      let userFinalBudget: number;
      let userOverrodeAi = false;
      let userAdjustmentsData = null;

      const variableBreakdown = analysis.variableBreakdown as any;

      switch (choice) {
        case 'minimum':
          userFinalBudget = analysis.recurringExpensesTotal + ((analysis.minimumScenario as any)?.total || 0);
          break;
        case 'recommended':
          userFinalBudget = analysis.totalRealisticBudget;
          break;
        case 'comfortable':
          userFinalBudget = analysis.recurringExpensesTotal + ((analysis.comfortableScenario as any)?.total || 0);
          break;
        case 'custom':
          userFinalBudget = customBudget;
          userOverrodeAi = true;
          break;
        default:
          userFinalBudget = analysis.totalRealisticBudget;
      }

      // Process adjustments if provided
      if (adjustments && typeof adjustments === 'object') {
        userOverrodeAi = true;
        userAdjustmentsData = {} as Record<string, { original: number; adjusted: number }>;

        for (const [category, adjustedValue] of Object.entries(adjustments)) {
          const original = variableBreakdown?.categories?.[category]?.estimate || 0;
          if (typeof adjustedValue === 'number' && adjustedValue !== original) {
            (userAdjustmentsData as any)[category] = {
              original,
              adjusted: adjustedValue,
            };
          }
        }

        // Recalculate final budget with adjustments
        if (Object.keys(userAdjustmentsData as any).length > 0) {
          const adjustedVariableTotal = Object.values(variableBreakdown?.categories || {}).reduce(
            (sum: number, cat: any) => {
              const category = Object.keys(variableBreakdown?.categories || {}).find(
                k => variableBreakdown.categories[k] === cat
              );
              const adjustment = category ? (adjustments as any)[category] : undefined;
              return sum + (adjustment !== undefined ? adjustment : (cat?.estimate || 0));
            },
            0
          ) as number;
          userFinalBudget = analysis.recurringExpensesTotal + adjustedVariableTotal;
        }
      }

      // Update analysis with user's choice
      const updatedAnalysis = await prisma.budgetAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'CONFIRMED',
          userFinalBudget,
          userOverrodeAi,
          userAdjustments: userAdjustmentsData as any,
        },
      });

      console.log(`[API] Budget choice saved for user ${userId}: $${userFinalBudget}/month (${choice})`);

      return NextResponse.json({
        success: true,
        data: {
          id: updatedAnalysis.id,
          status: updatedAnalysis.status,
          userFinalBudget: updatedAnalysis.userFinalBudget,
          userOverrodeAi: updatedAnalysis.userOverrodeAi,
          userAdjustments: updatedAnalysis.userAdjustments,
          message: 'Your budget has been saved and will be used in the Debt Planner.',
        },
      });
    } catch (error) {
      console.error('[API] Save budget choice error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save budget choice',
        },
        { status: 500 }
      );
    }
});
