/**
 * AI ASK API
 * POST /api/ai/ask
 *
 * Ask specific financial questions and get AI-powered answers
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  askFinancialQuestion,
  buildFinancialContextFromSnapshot,
  isOpenAIConfigured,
} from '@/lib/ai';
import { collectStrategyData, validateDataCompleteness } from '@/lib/strategy';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Check if AI is configured
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI assistant not configured',
            message:
              'Please configure OPENAI_API_KEY environment variable to enable AI features.',
          },
          { status: 503 }
        );
      }

      // Parse request body
      const body = await request.json().catch(() => ({}));
      const { question } = body;

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Question is required',
            message: 'Please provide a question in the request body.',
          },
          { status: 400 }
        );
      }

      // Limit question length
      if (question.length > 1000) {
        return NextResponse.json(
          {
            success: false,
            error: 'Question too long',
            message: 'Please limit your question to 1000 characters.',
          },
          { status: 400 }
        );
      }

      console.log(`[API] AI Ask request for user: ${userId}`);
      console.log(`[API] Question: ${question.substring(0, 100)}...`);

      // Collect user's financial data
      const strategyData = await collectStrategyData(userId);
      const dataQuality = validateDataCompleteness(strategyData);

      // Build financial context for AI
      const context = buildFinancialContextFromSnapshot(
        strategyData.snapshot,
        strategyData.preferences,
        strategyData.insights,
        strategyData.health
      );

      // Get AI answer
      console.log('[API] Getting AI response...');
      const result = await askFinancialQuestion(context, question);

      console.log(`[API] AI response generated`);
      console.log(`[API] Token usage: ${result.usage.totalTokens}`);

      return NextResponse.json({
        success: true,
        data: {
          question,
          answer: result.answer,
          suggestions: result.suggestions,
          dataQualityNote:
            dataQuality.overallScore < 60
              ? 'Note: Limited financial data available. Add more accounts and transactions for better insights.'
              : undefined,
          usage: result.usage,
        },
      });
    } catch (error) {
      console.error('[API] AI Ask error:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get AI response',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
