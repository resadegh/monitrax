/**
 * Phase 26: Document Analysis API
 *
 * POST /api/documents/analyze
 * Analyzes an uploaded document and extracts structured data.
 *
 * This endpoint integrates with the Document Intelligence Engine (Phase 26)
 * which builds on the Document Management Engine (Phase 25).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocumentIntelligenceEngine } from '@/lib/documents/intelligence';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// ============================================================================
// POST /api/documents/analyze
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { documentId, forceReanalyze = false } = body;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get the Document Intelligence Engine
    const engine = getDocumentIntelligenceEngine();

    // Check if required services are available
    if (!engine.isVisionAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document analysis is not available. Vision API not configured.',
          code: 'VISION_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    // Perform analysis
    console.log('[API] Analyzing document:', documentId);
    const result = await engine.analyzeDocument({
      documentId,
      forceReanalyze,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error('[API] Document analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/documents/analyze?documentId=xxx
// Get existing analysis for a document
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get documentId from query params
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'documentId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify document belongs to user and get analysis
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
      },
      include: {
        analysis: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    if (!document.analysis) {
      return NextResponse.json({
        success: true,
        analysis: null,
        message: 'Document has not been analyzed yet',
      });
    }

    // Format response
    const analysis = document.analysis;

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysis.id,
        documentId: analysis.documentId,
        status: analysis.status,
        documentType: analysis.documentType,
        typeConfidence: analysis.typeConfidence,
        overallConfidence: analysis.overallConfidence,
        extractedData: analysis.extractedData,
        lowConfidenceFields: analysis.lowConfidenceFields,
        suggestedActions: analysis.suggestedActions,
        userVerified: analysis.userVerified,
        analyzedAt: analysis.analyzedAt,
        createdAt: analysis.createdAt,
        errorMessage: analysis.errorMessage,
      },
    });
  } catch (error) {
    console.error('[API] Get analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analysis',
      },
      { status: 500 }
    );
  }
}
