/**
 * Phase 19 & 26: Documents API
 * GET /api/documents - List documents with filtering (includes analysis status)
 * POST /api/documents - Upload a new document (with optional AI analysis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  uploadDocument,
  listDocuments,
  DocumentCategory,
  LinkedEntityType,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/documents';
import { getDocumentIntelligenceEngine } from '@/lib/documents/intelligence';

// Type for document analysis data (matches Prisma schema)
interface DocumentAnalysisData {
  documentId: string;
  id: string;
  status: string;
  documentType: string | null;
  typeConfidence: number | null;
  overallConfidence: number | null;
  extractedData: unknown;
  suggestedActions: unknown;
  userVerified: boolean;
  createdEntityType: string | null;
  createdEntityId: string | null;
}

// ============================================================================
// GET /api/documents - List documents
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const query = {
      userId,
      category: searchParams.get('category') as DocumentCategory | undefined,
      entityType: searchParams.get('entityType') as LinkedEntityType | undefined,
      entityId: searchParams.get('entityId') || undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      sortBy: searchParams.get('sortBy') as 'uploadedAt' | 'filename' | 'size' | undefined,
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
    };

    const result = await listDocuments(query);

    // Phase 26: Fetch analysis status for all documents
    const documentIds = result.documents.map(doc => doc.id);
    const analyses = await prisma.documentAnalysis.findMany({
      where: {
        documentId: { in: documentIds },
      },
      select: {
        documentId: true,
        id: true,
        status: true,
        documentType: true,
        typeConfidence: true,
        overallConfidence: true,
        extractedData: true,
        suggestedActions: true,
        userVerified: true,
        createdEntityType: true,
        createdEntityId: true,
      },
    });

    // Create a map for quick lookup
    const analysisMap = new Map<string, DocumentAnalysisData>(
      (analyses as DocumentAnalysisData[]).map(a => [a.documentId, a])
    );

    return NextResponse.json({
      documents: result.documents.map(doc => {
        const analysis = analysisMap.get(doc.id);
        return {
          id: doc.id,
          filename: doc.filename,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType,
          size: doc.size,
          category: doc.category,
          description: doc.description,
          tags: doc.tags,
          uploadedAt: doc.uploadedAt.toISOString(),
          links: doc.links.map(link => ({
            entityType: link.entityType,
            entityId: link.entityId,
          })),
          // Phase 26: Include analysis summary
          analysis: analysis ? {
            id: analysis.id,
            status: analysis.status,
            documentType: analysis.documentType,
            typeConfidence: analysis.typeConfidence,
            overallConfidence: analysis.overallConfidence,
            extractedData: analysis.extractedData,
            suggestedActions: analysis.suggestedActions,
            userVerified: analysis.userVerified,
            createdEntityType: analysis.createdEntityType,
            createdEntityId: analysis.createdEntityId,
          } : null,
        };
      }),
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('Documents list error:', error);
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/documents - Upload document
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[API/documents POST] Request received');
  console.error('[API/documents POST] Request received (stderr)');
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get MIME type - prefer explicit mimeType field (Vercel/Next.js can lose file.type)
    const explicitMimeType = formData.get('mimeType') as string | null;
    const mimeType = explicitMimeType || file.type;

    console.log('[API/documents POST] File info:', {
      fileName: file.name,
      fileType: file.type,
      explicitMimeType,
      resolvedMimeType: mimeType,
      size: file.size,
    });

    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(mimeType as typeof SUPPORTED_MIME_TYPES[number])) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Parse metadata from form
    const category = formData.get('category') as DocumentCategory;
    if (!category || !Object.values(DocumentCategory).includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const description = formData.get('description') as string | null;
    const tagsString = formData.get('tags') as string | null;
    const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Parse entity links
    const linksString = formData.get('links') as string | null;
    let links: { entityType: LinkedEntityType; entityId: string }[] = [];
    if (linksString) {
      try {
        links = JSON.parse(linksString);
      } catch {
        return NextResponse.json({ error: 'Invalid links format' }, { status: 400 });
      }
    }

    // Check if this is a local drive upload (file already saved on client)
    const storageProvider = formData.get('storageProvider') as string | null;
    const localPath = formData.get('localPath') as string | null;

    // Phase 26: Check if analysis should be triggered
    const analyzeValue = formData.get('analyze') as string | null;
    const shouldAnalyze = analyzeValue === 'true' || analyzeValue === '1';

    // Upload document
    const result = await uploadDocument(userId, {
      file,
      filename: file.name,
      mimeType: mimeType,
      category,
      description: description || undefined,
      tags,
      links,
      // Pass local drive info if provided
      storageProvider: storageProvider === 'LOCAL_DRIVE' ? 'LOCAL_DRIVE' : undefined,
      localPath: localPath || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Phase 26: Trigger document analysis if requested
    let analysis = null;
    if (shouldAnalyze && result.document) {
      try {
        const die = getDocumentIntelligenceEngine();
        if (die.isVisionAvailable()) {
          console.log('[API/documents] Triggering document analysis for:', result.document.id);
          const analysisResult = await die.analyzeDocument({
            documentId: result.document.id,
          });
          if (analysisResult.success) {
            analysis = analysisResult.analysis;
            console.log('[API/documents] Analysis complete:', {
              documentType: analysis?.documentType,
              confidence: analysis?.overallConfidence,
            });
          }
        }
      } catch (analysisError) {
        console.error('[API/documents] Analysis error:', analysisError);
        // Don't fail the upload if analysis fails
      }
    }

    return NextResponse.json({
      success: true,
      document: {
        id: result.document!.id,
        filename: result.document!.filename,
        originalFilename: result.document!.originalFilename,
        mimeType: result.document!.mimeType,
        size: result.document!.size,
        category: result.document!.category,
        description: result.document!.description,
        tags: result.document!.tags,
        uploadedAt: result.document!.uploadedAt.toISOString(),
        links: result.document!.links.map(link => ({
          entityType: link.entityType,
          entityId: link.entityId,
        })),
      },
      signedUrl: result.signedUrl,
      analysis, // Phase 26: Include analysis result if available
    }, { status: 201 });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
