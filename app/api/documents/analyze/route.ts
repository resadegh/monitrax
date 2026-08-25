/**
 * Phase 26: Document Analysis API
 *
 * POST /api/documents/analyze
 * Analyzes an uploaded document and extracts structured data.
 *
 * PATCH /api/documents/analyze  (MON-188, M2 kept-depth PR-1)
 * Persists the user's Smart Inbox inline edits into the analysis record —
 * `Done` writes through instead of holding a component-local draft that a
 * reload silently discarded. Same route family, no new endpoint (§12.4).
 *
 * This endpoint integrates with the Document Intelligence Engine (Phase 26)
 * which builds on the Document Management Engine (Phase 25).
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getDocumentIntelligenceEngine } from '@/lib/documents/intelligence';
import { prisma } from '@/lib/db';

// ============================================================================
// POST /api/documents/analyze
// ============================================================================

export const POST = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;

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
        userId,
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
});

// ============================================================================
// PATCH /api/documents/analyze — persist Smart Inbox edits (MON-188)
// ============================================================================

/** The four user-editable inbox fields — the ONLY keys this endpoint writes. */
const EDITABLE_FIELDS = ['vendor', 'amount', 'date', 'category'] as const;

export const PATCH = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body = await request.json();
    const { analysisId, fields } = body as {
      analysisId?: string;
      fields?: Record<string, unknown>;
    };

    if (!analysisId || !fields || typeof fields !== 'object') {
      return NextResponse.json(
        { success: false, error: 'analysisId and fields are required' },
        { status: 400 }
      );
    }

    // §12.11 guard: only an analysis whose DOCUMENT belongs to the caller,
    // and only while it is still awaiting review (a verified analysis is the
    // record of what was approved — corrections after that are a new flow).
    const analysis = await prisma.documentAnalysis.findFirst({
      where: { id: analysisId, userVerified: false, document: { userId } },
      select: { id: true, extractedData: true },
    });
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Merge ONLY the editable fields, preserving the wrapped field shape the
    // analyzers write ({value, confidence}) — the user's word is confidence 1.
    const merged: Record<string, unknown> = {
      ...((analysis.extractedData as Record<string, unknown> | null) ?? {}),
    };
    let changed = 0;
    for (const key of EDITABLE_FIELDS) {
      const v = fields[key];
      if (typeof v === 'string') {
        merged[key] = { value: v, confidence: 1, source: 'user' };
        changed++;
      }
    }
    if (changed === 0) {
      return NextResponse.json(
        { success: false, error: 'No editable fields in request' },
        { status: 400 }
      );
    }

    await prisma.documentAnalysis.update({
      where: { id: analysis.id },
      data: { extractedData: merged as object },
    });

    return NextResponse.json({ success: true, updatedFields: changed });
  } catch (error) {
    console.error('[API] Persist analysis edits error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save the edit' },
      { status: 500 }
    );
  }
});

// ============================================================================
// GET /api/documents/analyze?documentId=xxx
// Get existing analysis for a document
// ============================================================================

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

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
        userId,
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
});
