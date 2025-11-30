/**
 * Phase 19: Document Detail API
 * GET /api/documents/[id] - Get document details with signed URL
 * DELETE /api/documents/[id] - Delete a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  getDocumentWithSignedUrl,
  deleteDocument,
  addDocumentLink,
  removeDocumentLink,
  LinkedEntityType,
} from '@/lib/documents';

// ============================================================================
// GET /api/documents/[id] - Get document with signed URL
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: documentId } = await params;

    const result = await getDocumentWithSignedUrl(documentId, userId);

    if (!result) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: result.document.id,
      filename: result.document.filename,
      originalFilename: result.document.originalFilename,
      mimeType: result.document.mimeType,
      size: result.document.size,
      category: result.document.category,
      description: result.document.description,
      tags: result.document.tags,
      uploadedAt: result.document.uploadedAt.toISOString(),
      links: result.document.links.map(link => ({
        entityType: link.entityType,
        entityId: link.entityId,
      })),
      signedUrl: result.signedUrl,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/documents/[id] - Delete document
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: documentId } = await params;

    // Check for hard delete query param
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    const result = await deleteDocument(documentId, userId, hardDelete);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/documents/[id] - Update document links
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: documentId } = await params;

    const body = await request.json();
    const { action, entityType, entityId } = body;

    if (!action || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, entityType, entityId' },
        { status: 400 }
      );
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    if (!Object.values(LinkedEntityType).includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entityType' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'add') {
      result = await addDocumentLink(documentId, userId, { entityType, entityId });
    } else {
      result = await removeDocumentLink(documentId, userId, entityType, entityId);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}
