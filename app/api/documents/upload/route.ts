/**
 * Phase 25: Unified Document Upload API
 * Uses the Document Management Engine for all uploads
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getDocumentManagementEngine,
  createUploadContext,
  UploadSource,
} from '@/lib/documents/engine';
import {
  DocumentCategory,
  StorageProviderType,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/documents/types';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
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
      userId: user.id,
      timestamp: new Date(),
    });

    console.log('[API/upload] Processing upload through engine:', {
      source,
      filename: file.name,
      size: file.size,
      entities: Object.keys(cleanEntities),
      userInput: Object.keys(cleanUserInput),
    });

    // Process through Document Management Engine
    const engine = getDocumentManagementEngine();
    const result = await engine.processUpload(context);

    if (!result.success) {
      console.error('[API/upload] Engine upload failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 500 }
      );
    }

    console.log('[API/upload] Upload successful:', {
      documentId: result.document?.id,
      storagePath: result.storagePath,
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      storagePath: result.storagePath,
      storageUrl: result.storageUrl,
    });
  } catch (error) {
    console.error('[API/upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    );
  }
}

/**
 * Preview what the engine would do for an upload (for debugging)
 */
export async function OPTIONS(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      userId: user.id,
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
}
