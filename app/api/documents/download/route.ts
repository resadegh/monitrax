/**
 * Phase 19: Document Download API
 * GET /api/documents/download - Serve files via signed URL
 *
 * This endpoint validates the signature and expiry, then streams the file.
 * In production, this would typically be handled by S3/CloudFront directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitraxStorageProvider } from '@/lib/documents/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const path = searchParams.get('path');
    const expiresStr = searchParams.get('expires');
    const signature = searchParams.get('signature');

    // Validate required parameters
    if (!path || !expiresStr || !signature) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires)) {
      return NextResponse.json(
        { error: 'Invalid expires parameter' },
        { status: 400 }
      );
    }

    // Check if URL has expired
    const now = Math.floor(Date.now() / 1000);
    if (now > expires) {
      return NextResponse.json(
        { error: 'URL has expired' },
        { status: 410 }
      );
    }

    // Verify signature
    const storage = getMonitraxStorageProvider();
    const isValid = storage.verifySignature(path, expires, signature);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Check if file exists
    const exists = await storage.exists(path);
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file metadata
    const metadata = await storage.getMetadata(path);
    if (!metadata) {
      return NextResponse.json(
        { error: 'Failed to get file metadata' },
        { status: 500 }
      );
    }

    // Read and stream the file
    const fileBuffer = await storage.readFile(path);

    // Determine filename from path
    const filename = path.split('/').pop() || 'download';

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', metadata.contentType);
    headers.set('Content-Length', metadata.size.toString());
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    headers.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(fileBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Document download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
