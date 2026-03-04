/**
 * AI STATUS API
 * GET /api/ai/status
 *
 * Check if AI features are configured and available
 * Phase 27 - Now powered by Google Gemini
 */

import { NextResponse } from 'next/server';
import { isGeminiConfigured, GEMINI_MODELS, AI_ENGINE_VERSION } from '@/lib/ai';
import { withPermission } from '@/lib/auth/guards';

export const GET = withPermission('report.read', async (_request, _auth) => {
  try {
    const configured = isGeminiConfigured();

    return NextResponse.json({
      success: true,
      data: {
        configured,
        provider: 'google-gemini',
        version: AI_ENGINE_VERSION,
        features: {
          financialAdvisor: configured,
          chatAssistant: configured,
          projections: configured,
          documentAnalysis: configured,
        },
        models: configured
          ? {
              quick: GEMINI_MODELS.QUICK_RESPONSE,
              detailed: GEMINI_MODELS.FINANCIAL_ADVISOR,
              document: GEMINI_MODELS.DOCUMENT_ANALYSIS,
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
