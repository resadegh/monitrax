/**
 * AI STATUS API
 * GET /api/ai/status
 *
 * Check if AI features are configured and available
 * Phase 27: Powered by Google Gemini
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGeminiConfigured, GEMINI_MODELS, MODEL_FOR_USE_CASE } from '@/lib/ai/google';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

const AI_ENGINE_VERSION = '2.0.0'; // Phase 27 - Google Gemini

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const configured = isGeminiConfigured();

      return NextResponse.json({
        success: true,
        data: {
          configured,
          provider: 'Google Gemini',
          version: AI_ENGINE_VERSION,
          features: {
            financialAdvisor: configured,
            chatAssistant: configured,
            projections: configured,
            questionAnswering: configured,
            documentIntelligence: configured,
          },
          models: configured
            ? {
                quick: GEMINI_MODELS.FLASH,
                detailed: GEMINI_MODELS.PRO,
                useCase: {
                  financialAdvisor: MODEL_FOR_USE_CASE.FINANCIAL_ADVISOR,
                  quickResponse: MODEL_FOR_USE_CASE.QUICK_RESPONSE,
                  documentExtraction: MODEL_FOR_USE_CASE.DOCUMENT_EXTRACTION,
                },
              }
            : null,
          message: configured
            ? 'AI engine is ready (Powered by Google Gemini)'
            : 'AI engine requires GEMINI_API_KEY configuration',
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
