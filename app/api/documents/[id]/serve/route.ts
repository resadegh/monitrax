/**
 * Phase 19: Document Serve API
 * GET /api/documents/[id]/serve - Serve document content for preview
 *
 * This endpoint proxies document content through our server to avoid
 * X-Frame-Options restrictions from GCS signed URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getStorageProvider } from '@/lib/documents/storage';
import { isGCSConfigured } from '@/lib/documents/storage/factory';

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

    // Get document metadata
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        storagePath: true,
        storageProvider: true,
        mimeType: true,
        originalFilename: true,
        fileContent: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let fileBuffer: Buffer;

    // Get file content based on storage provider
    if (document.storageProvider === 'GOOGLE_CLOUD_STORAGE' && isGCSConfigured) {
      // Download from GCS
      const storage = await getStorageProvider(userId);
      const result = await storage.download(document.storagePath);

      if (!result.success || !result.data) {
        return NextResponse.json(
          { error: result.error || 'Failed to download file' },
          { status: 500 }
        );
      }

      fileBuffer = result.data;
    } else if (document.fileContent) {
      // Use database storage
      fileBuffer = Buffer.from(document.fileContent);
    } else {
      return NextResponse.json(
        { error: 'File content not available' },
        { status: 404 }
      );
    }

    // Set headers that allow iframe embedding
    const headers = new Headers();
    headers.set('Content-Type', document.mimeType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${document.originalFilename}"`);
    headers.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
    // Explicitly allow framing (no X-Frame-Options header)
    // Remove any default security headers that might block framing
    headers.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Document serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve document' },
      { status: 500 }
    );
  }
}
