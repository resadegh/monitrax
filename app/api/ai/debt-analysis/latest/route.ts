/**
 * GET /api/ai/debt-analysis/latest
 *
 * Fetches the most recent AI debt analysis for the authenticated user.
 * Returns the saved analysis so it persists across page loads.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

export const GET = withPermission('report.read', async (_request, auth) => {
  try {
    const userId = auth.userId;

    // Fetch the most recent debt analysis for this user
    const latestAnalysis = await prisma.debtAnalysis.findFirst({
      where: { userId },
      orderBy: { analysisDate: 'desc' },
    });

    if (!latestAnalysis) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No saved debt analysis found',
      });
    }

    // Transform database record back to API response format
    const analysis = {
      summary: latestAnalysis.summary,
      debtHealthScore: latestAnalysis.debtHealthScore,
      recommendedStrategy: latestAnalysis.recommendedStrategy,
      strategyReason: latestAnalysis.strategyReason,
      optimalSurplus: {
        minimum: latestAnalysis.surplusMinimum,
        recommended: latestAnalysis.surplusRecommended,
        aggressive: latestAnalysis.surplusAggressive,
        reasoning: latestAnalysis.surplusReasoning || '',
      },
      keyInsights: latestAnalysis.keyInsights as any[] || [],
      loanPriority: latestAnalysis.loanPriority as any[] || [],
      actionPlan: latestAnalysis.actionPlan as any[] || [],
      projections: latestAnalysis.projections as any || null,
      warnings: latestAnalysis.warnings as string[] || [],
    };

    const context = {
      totalDebt: latestAnalysis.totalDebt,
      monthlyIncome: latestAnalysis.monthlyIncome,
      monthlyExpenses: latestAnalysis.monthlyExpenses,
      availableForExtraRepayments: latestAnalysis.availableForExtra,
      loanCount: latestAnalysis.loanCount,
      analysisDate: latestAnalysis.analysisDate,
    };

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        context,
        savedAt: latestAnalysis.analysisDate,
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch latest debt analysis:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch debt analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
