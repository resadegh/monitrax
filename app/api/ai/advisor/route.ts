/**
 * AI FINANCIAL ADVISOR API
 * POST /api/ai/advisor
 *
 * Generate comprehensive AI-powered financial advice based on user data
 * Phase 27 - Now powered by Google Gemini
 */

import { NextResponse } from 'next/server';
import {
  generateAIAdvice,
  buildFinancialContextFromSnapshot,
  isGeminiConfigured,
} from '@/lib/ai';
import { collectStrategyData, validateDataCompleteness } from '@/lib/strategy';
import { withPermission } from '@/lib/auth/guards';

export const POST = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Check if AI is configured
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI advisor not configured',
          message:
            'Please configure GEMINI_API_KEY environment variable to enable AI features.',
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      query,
      mode = 'detailed',
      focusAreas,
      includeProjections = false,
    } = body;

    console.log(`[API] AI Advisor request for user: ${userId}`);
    console.log(`[API] Mode: ${mode}, Query: ${query || 'none'}`);

    // Collect user's financial data
    console.log('[API] Collecting financial data...');
    const strategyData = await collectStrategyData(userId);
    const dataQuality = validateDataCompleteness(strategyData);

    // Check data quality
    if (dataQuality.overallScore < 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient data for AI analysis',
          message:
            'Please add more financial data (properties, loans, accounts, transactions) before using the AI advisor.',
          dataQuality: {
            score: dataQuality.overallScore,
            missingCritical: dataQuality.missingCritical,
            recommendations: dataQuality.recommendations,
          },
        },
        { status: 400 }
      );
    }

    // Build financial context for AI
    const context = buildFinancialContextFromSnapshot(
      strategyData.snapshot,
      strategyData.preferences,
      strategyData.insights,
      strategyData.health
    );

    // Generate AI advice using Gemini
    console.log('[API] Generating Gemini AI advice...');
    const result = await generateAIAdvice({
      userId,
      query,
      context,
      options: {
        mode,
        focusAreas,
        includeProjections,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI analysis failed',
          message: result.advice.summary,
        },
        { status: 500 }
      );
    }

    console.log(`[API] Gemini AI advice generated successfully`);
    console.log(`[API] Health score: ${result.advice.healthScore}`);
    console.log(
      `[API] Recommendations: ${result.advice.recommendations?.length || 0}`
    );
    console.log(`[API] Token usage: ${result.usage.totalTokens}`);
    console.log(
      `[API] Estimated cost: $${result.usage.estimatedCost.toFixed(4)}`
    );

    return NextResponse.json({
      success: true,
      data: {
        advice: result.advice,
        dataQuality: {
          score: dataQuality.overallScore,
          status:
            dataQuality.overallScore >= 60
              ? 'good'
              : dataQuality.overallScore >= 40
                ? 'fair'
                : 'limited',
        },
        usage: result.usage,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error) {
    console.error('[API] AI Advisor error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate AI advice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// GET endpoint for quick status/health check
export const GET = withPermission('report.read', async (_request, _auth) => {
  try {
    const configured = isGeminiConfigured();

    return NextResponse.json({
      success: true,
      data: {
        available: configured,
        message: configured
          ? 'AI advisor is ready (powered by Gemini)'
          : 'AI advisor requires GEMINI_API_KEY configuration',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Status check failed',
      },
      { status: 500 }
    );
  }
});
