/**
 * Phase 19: Documents API
 * GET /api/documents - List documents with filtering
 * POST /api/documents - Upload a new document
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  uploadDocument,
  listDocuments,
  DocumentCategory,
  LinkedEntityType,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/documents';

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

    return NextResponse.json({
      documents: result.documents.map(doc => ({
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
      })),
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

    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(file.type as typeof SUPPORTED_MIME_TYPES[number])) {
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

    // Upload document
    const result = await uploadDocument(userId, {
      file,
      filename: file.name,
      mimeType: file.type,
      category,
      description: description || undefined,
      tags,
      links,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
    }, { status: 201 });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
