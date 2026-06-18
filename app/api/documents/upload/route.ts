/**
 * Phase 25 & 26: Unified Document Upload API
 *
 * Uses the Document Management Engine (Phase 25) for uploads
 * and optionally the Document Intelligence Engine (Phase 26) for analysis.
 *
 * Supports `analyze=true` parameter to trigger immediate analysis after upload.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  getDocumentManagementEngine,
  createUploadContext,
  UploadSource,
} from '@/lib/documents/engine';
import { getDocumentIntelligenceEngine } from '@/lib/documents/intelligence';
import {
  DocumentCategory,
  StorageProviderType,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/documents/types';

export const POST = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
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

    // Parse source (defaults to API_DIRECT)
    const sourceValue = formData.get('source') as string | null;
    const source = Object.values(UploadSource).includes(sourceValue as UploadSource)
      ? (sourceValue as UploadSource)
      : UploadSource.API_DIRECT;

    // Parse entity context
    const entities = {
      propertyId: (formData.get('propertyId') as string) || undefined,
      expenseId: (formData.get('expenseId') as string) || undefined,
      loanId: (formData.get('loanId') as string) || undefined,
      incomeId: (formData.get('incomeId') as string) || undefined,
      accountId: (formData.get('accountId') as string) || undefined,
      offsetAccountId: (formData.get('offsetAccountId') as string) || undefined,
      investmentAccountId: (formData.get('investmentAccountId') as string) || undefined,
      investmentHoldingId: (formData.get('investmentHoldingId') as string) || undefined,
      transactionId: (formData.get('transactionId') as string) || undefined,
      assetId: (formData.get('assetId') as string) || undefined,
    };

    // Remove undefined values
    const cleanEntities = Object.fromEntries(
      Object.entries(entities).filter(([_, v]) => v !== undefined)
    );

    // Parse user input
    const categoryValue = formData.get('category') as string | null;
    const category = Object.values(DocumentCategory).includes(categoryValue as DocumentCategory)
      ? (categoryValue as DocumentCategory)
      : undefined;

    const storagePreferenceValue = formData.get('storagePreference') as string | null;
    const storagePreference = Object.values(StorageProviderType).includes(
      storagePreferenceValue as StorageProviderType
    )
      ? (storagePreferenceValue as StorageProviderType)
      : undefined;

    const tagsValue = formData.get('tags') as string | null;
    const tags = tagsValue ? tagsValue.split(',').filter(Boolean) : undefined;

    const userInput = {
      category,
      description: (formData.get('description') as string) || undefined,
      tags,
      storagePreference,
    };

    // Remove undefined values
    const cleanUserInput = Object.fromEntries(
      Object.entries(userInput).filter(([_, v]) => v !== undefined)
    );

    // Build upload context
    const context = createUploadContext({
      source,
      file,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      entities: cleanEntities,
      userInput: cleanUserInput,
      userId,
      timestamp: new Date(),
    });

    // Parse analyze flag (Phase 26: Document Intelligence Engine)
    const analyzeValue = formData.get('analyze') as string | null;
    const shouldAnalyze = analyzeValue === 'true' || analyzeValue === '1';

    console.log('[API/upload] Processing upload through engine:', {
      source,
      filename: file.name,
      size: file.size,
      entities: Object.keys(cleanEntities),
      userInput: Object.keys(cleanUserInput),
      analyze: shouldAnalyze,
    });

    // Process through Document Management Engine (Phase 25)
    const dme = getDocumentManagementEngine();
    const result = await dme.processUpload(context);

    if (!result.success) {
      console.error('[API/upload] Engine upload failed:', result.error);
      // Quota exhaustion is a client condition (413), not a server error (500).
      const status = result.errorCode === 'STORAGE_QUOTA_EXCEEDED' ? 413 : 500;
      return NextResponse.json(
        { error: result.error || 'Upload failed', code: result.errorCode },
        { status }
      );
    }

    console.log('[API/upload] Upload successful:', {
      documentId: result.document?.id,
      storagePath: result.storagePath,
    });

    // Phase 26: Trigger analysis if requested.
    // Phase 50 D.1: skip re-analysis on a duplicate — it's an already-stored
    // document (the client shows "already uploaded" and won't re-create an
    // expense), so re-running OCR would waste a Vision call.
    let analysis = null;
    if (shouldAnalyze && result.document?.id && !result.duplicate) {
      console.log('[API/upload] Triggering document analysis...');
      const die = getDocumentIntelligenceEngine();

      // Only attempt analysis if Vision API is available
      if (die.isVisionAvailable()) {
        try {
          const analysisResult = await die.analyzeDocument({
            documentId: result.document.id,
          });

          if (analysisResult.success) {
            analysis = analysisResult.analysis;
            console.log('[API/upload] Analysis complete:', {
              documentType: analysis?.documentType,
              confidence: analysis?.overallConfidence,
            });
          } else {
            console.warn('[API/upload] Analysis failed:', analysisResult.error);
          }
        } catch (analysisError) {
          console.error('[API/upload] Analysis error:', analysisError);
          // Don't fail the upload if analysis fails
        }
      } else {
        console.log('[API/upload] Vision API not available, skipping analysis');
      }
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      storagePath: result.storagePath,
      storageUrl: result.storageUrl,
      analysis,  // Phase 26: Include analysis result if available
      duplicate: result.duplicate ?? false,  // Phase 50 D.1: already-stored file
    });
  } catch (error) {
    console.error('[API/upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    );
  }
});

/**
 * Preview what the engine would do for an upload (for debugging)
 */
export const OPTIONS = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const sourceValue = formData.get('source') as string | null;
    const source = Object.values(UploadSource).includes(sourceValue as UploadSource)
      ? (sourceValue as UploadSource)
      : UploadSource.API_DIRECT;

    const context = createUploadContext({
      source,
      file,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      entities: {},
      userInput: {},
      userId,
      timestamp: new Date(),
    });

    const engine = getDocumentManagementEngine();
    const preview = await engine.previewUpload(context);

    return NextResponse.json({
      preview,
    });
  } catch (error) {
    console.error('[API/upload] Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview upload' },
      { status: 500 }
    );
  }
});
