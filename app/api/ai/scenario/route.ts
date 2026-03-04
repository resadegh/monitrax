/**
 * AI SCENARIO ANALYSIS API
 * POST /api/ai/scenario
 *
 * Analyze "what-if" financial scenarios
 */

import { NextResponse } from 'next/server';
import {
  analyzeScenario,
  buildFinancialContextFromSnapshot,
  isGeminiConfigured,
} from '@/lib/ai';
import { collectStrategyData } from '@/lib/strategy';
import { withPermission } from '@/lib/auth/guards';

const VALID_SCENARIO_TYPES = [
  'extra_payment',
  'investment',
  'property_purchase',
  'refinance',
] as const;

type ScenarioType = (typeof VALID_SCENARIO_TYPES)[number];

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
    const { type, amount, description } = body;

    // Validate scenario type
    if (!type || !VALID_SCENARIO_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scenario type',
          message: `Type must be one of: ${VALID_SCENARIO_TYPES.join(', ')}`,
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
          message: 'Please provide a description of the scenario.',
        },
        { status: 400 }
      );
    }

    console.log(`[API] AI Scenario analysis for user: ${userId}`);
    console.log(`[API] Scenario type: ${type}, Description: ${description}`);

    // Collect user's financial data
    const strategyData = await collectStrategyData(userId);

    // Build financial context
    const context = buildFinancialContextFromSnapshot(
      strategyData.snapshot,
      strategyData.preferences,
      strategyData.insights,
      strategyData.health
    );

    // Analyze scenario
    const result = await analyzeScenario(
      {
        type: type as ScenarioType,
        amount,
        description,
      },
      context
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Scenario analysis failed',
          message: 'Unable to analyze the scenario. Please try again.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        scenario: { type, amount, description },
        analysis: result.analysis,
        pros: result.pros,
        cons: result.cons,
        recommendation: result.recommendation,
      },
    });
  } catch (error) {
    console.error('[API] AI Scenario analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze scenario',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
