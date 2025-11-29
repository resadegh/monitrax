/**
 * AI STATUS API
 * GET /api/ai/status
 *
 * Check if AI features are configured and available
 */

import { NextRequest, NextResponse } from 'next/server';
import { isOpenAIConfigured, AI_MODELS, AI_ENGINE_VERSION } from '@/lib/ai';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const configured = isOpenAIConfigured();

      return NextResponse.json({
        success: true,
        data: {
          configured,
          version: AI_ENGINE_VERSION,
          features: {
            financialAdvisor: configured,
            chatAssistant: configured,
            projections: configured,
          },
          models: configured
            ? {
                quick: AI_MODELS.QUICK_RESPONSE,
                detailed: AI_MODELS.FINANCIAL_ADVISOR,
              }
            : null,
        },
      });
    } catch (error) {
      console.error('[API] AI status check error:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check AI status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
