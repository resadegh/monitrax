/**
 * AI GOAL ANALYSIS API
 * POST /api/ai/goal
 *
 * Analyze progress toward financial goals
 */

import { NextResponse } from 'next/server';
import {
  analyzeGoalProgress,
  buildFinancialContextFromSnapshot,
  isGeminiConfigured,
} from '@/lib/ai';
import { collectStrategyData } from '@/lib/strategy';
import { withPermission } from '@/lib/auth/guards';

const VALID_GOAL_TYPES = [
  'retirement',
  'debt_free',
  'investment_target',
  'property_purchase',
] as const;

type GoalType = (typeof VALID_GOAL_TYPES)[number];

export const POST = withPermission('report.write', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Check if AI is configured
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI analysis not configured',
          message:
            'Please configure GEMINI_API_KEY environment variable to enable AI features.',
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { type, targetAmount, targetDate, description } = body;

    // Validate goal type
    if (!type || !VALID_GOAL_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid goal type',
          message: `Type must be one of: ${VALID_GOAL_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate description
    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Description is required',
          message: 'Please provide a description of your goal.',
        },
        { status: 400 }
      );
    }

    console.log(`[API] AI Goal analysis for user: ${userId}`);
    console.log(`[API] Goal type: ${type}, Description: ${description}`);

    // Collect user's financial data
    const strategyData = await collectStrategyData(userId);

    // Build financial context
    const context = buildFinancialContextFromSnapshot(
      strategyData.snapshot,
      strategyData.preferences,
      strategyData.insights,
      strategyData.health
    );

    // Analyze goal progress
    const result = await analyzeGoalProgress(
      {
        type: type as GoalType,
        targetAmount,
        targetDate,
        description,
      },
      context
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Goal analysis failed',
          message: 'Unable to analyze the goal. Please try again.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        goal: { type, targetAmount, targetDate, description },
        feasibility: result.feasibility,
        analysis: result.analysis,
        adjustments: result.adjustments,
        milestones: result.milestones,
      },
    });
  } catch (error) {
    console.error('[API] AI Goal analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze goal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
