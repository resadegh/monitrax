/**
 * Phase 19: Document Detail API
 * GET /api/documents/[id] - Get document details with signed URL
 * DELETE /api/documents/[id] - Delete a document
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  getDocumentWithSignedUrl,
  deleteDocument,
  renameDocument,
  updateDocumentMeta,
  addDocumentLink,
  removeDocumentLink,
  LinkedEntityType,
} from '@/lib/documents';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================================================
// GET /api/documents/[id] - Get document with signed URL
// ============================================================================

export const GET = withPermission<RouteContext>('report.read', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id: documentId } = await context!.params;

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
});

// ============================================================================
// DELETE /api/documents/[id] - Delete document
// ============================================================================

export const DELETE = withPermission<RouteContext>('report.export', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id: documentId } = await context!.params;

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
});

// ============================================================================
// PATCH /api/documents/[id] - Update document links
// ============================================================================

export const PATCH = withPermission<RouteContext>('report.export', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id: documentId } = await context!.params;

    const body = await request.json();
    const { action, entityType, entityId, name, category } = body;

    // Rename: update the document's display name. Needs only `name`.
    if (action === 'rename') {
      const renameResult = await renameDocument(documentId, userId, name);
      if (!renameResult.success) {
        return NextResponse.json({ error: renameResult.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Update: edit document metadata (name and/or category) from the edit dialog.
    if (action === 'update') {
      const updateResult = await updateDocumentMeta(documentId, userId, { name, category });
      if (!updateResult.success) {
        return NextResponse.json({ error: updateResult.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (!action || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, entityType, entityId' },
        { status: 400 }
      );
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "add", "remove" or "rename"' },
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
});
