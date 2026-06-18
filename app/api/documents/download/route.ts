/**
 * Phase 19 / Phase 50: Document Download API
 * GET /api/documents/download - Serve files via an HMAC-signed URL.
 *
 * Validates our own HMAC signature + expiry, then streams the bytes from
 * whichever backend actually holds them:
 *   - MONITRAX  → read the bytea from Postgres.
 *   - GCS       → download via the storage provider (keyless WIF or key).
 *
 * The HMAC signature (issued by `getDocumentReadUrl` / the Monitrax signer) is
 * the access capability and is provider-agnostic — it authorises a `storagePath`
 * regardless of where the bytes live. GCS documents are routed here (rather than
 * to a native GCS signed URL) when we authenticate keyless, because keyless
 * credentials cannot sign a v4 URL locally — and streaming through our own route
 * keeps every read mediated (the better CDR posture).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMonitraxStorageProvider } from '@/lib/documents/storage';
import { getGoogleCloudStorageProvider } from '@/lib/documents/storage/googleCloudStorageProvider';
import { StorageProviderType } from '@/lib/documents/types';

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

    // Verify the HMAC signature (provider-agnostic — authorises this path).
    const monitrax = getMonitraxStorageProvider();
    const isValid = monitrax.verifySignature(path, expires, signature);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Resolve which backend holds the bytes (and the content metadata) from the
    // Document row keyed by storagePath.
    const document = await prisma.document.findFirst({
      where: { storagePath: path, deletedAt: null },
      select: {
        storageProvider: true,
        mimeType: true,
        size: true,
        originalFilename: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Stream the bytes from the correct provider.
    let fileBuffer: Buffer;
    if (document.storageProvider === StorageProviderType.GOOGLE_CLOUD_STORAGE) {
      const gcs = getGoogleCloudStorageProvider();
      await gcs.initialize();
      const result = await gcs.download(path);
      if (!result.success || !result.data) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      fileBuffer = result.data;
    } else {
      // MONITRAX (DB bytea). LOCAL_DRIVE files are never served here (the client
      // reads them locally), so a missing file is a genuine 404.
      const exists = await monitrax.exists(path);
      if (!exists) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      fileBuffer = await monitrax.readFile(path);
    }

    const filename = document.originalFilename || path.split('/').pop() || 'download';

    const headers = new Headers();
    headers.set('Content-Type', document.mimeType || 'application/octet-stream');
    headers.set('Content-Length', String(document.size ?? fileBuffer.length));
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    headers.set('Cache-Control', 'private, max-age=300'); // 5 minutes

    return new NextResponse(new Uint8Array(fileBuffer), {
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
