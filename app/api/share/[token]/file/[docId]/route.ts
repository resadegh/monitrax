/**
 * Phase 38 PR 3 — Public single-file fetch via share token.
 *
 * GET /api/share/:token/file/:docId
 *
 * Validates the token (active, not revoked, not expired) AND that
 * `docId` is part of the share's contentRefs AND that the document
 * still exists + isn't soft-deleted. Then streams the file inline.
 *
 * NO AUTH on the recipient — token IS the credential. Audit-logged
 * under owner's userId.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  getMonitraxStorageProvider,
  getGoogleCloudStorageProvider,
  isGoogleCloudStorageConfigured,
} from '@/lib/documents/storage';
import type { DocumentBundleRefs } from '@/lib/share/content';

type Params = { params: Promise<{ token: string; docId: string }> };

export async function GET(request: Request, ctx: Params) {
  try {
    const { token, docId } = await ctx.params;
    if (!token || !docId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const share = await prisma.sharePackage.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        contentType: true,
        contentRefs: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    if (share.revokedAt) {
      return NextResponse.json({ error: 'Share has been revoked' }, { status: 410 });
    }
    if (share.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Share has expired' }, { status: 410 });
    }
    if (share.contentType !== 'DOCUMENT_BUNDLE') {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    const refs = (share.contentRefs ?? {}) as DocumentBundleRefs;
    const allowedIds = Array.isArray(refs.documentIds) ? refs.documentIds : [];
    if (!allowedIds.includes(docId)) {
      return NextResponse.json(
        { error: 'Document not part of this share' },
        { status: 404 }
      );
    }

    const doc = await prisma.document.findFirst({
      where: { id: docId, userId: share.userId, deletedAt: null },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        mimeType: true,
        storageProvider: true,
        storagePath: true,
        fileContent: true,
      },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Document no longer available' }, { status: 404 });
    }

    // Resolve file bytes via the existing storage abstraction.
    // Provider routing mirrors lib/documents/documentService.ts.
    let buffer: Buffer | null = null;

    if (doc.fileContent) {
      // Monitrax-stored files keep bytes in the DB
      buffer = Buffer.from(doc.fileContent);
    } else if (doc.storageProvider === 'GOOGLE_CLOUD_STORAGE' && isGoogleCloudStorageConfigured()) {
      const gcs = getGoogleCloudStorageProvider();
      const result = await gcs.download(doc.storagePath);
      if (result?.success && result.data) {
        buffer = Buffer.isBuffer(result.data) ? result.data : Buffer.from(result.data);
      }
    } else if (doc.storageProvider === 'MONITRAX') {
      const monitrax = getMonitraxStorageProvider();
      const result = await monitrax.download(doc.storagePath);
      if (result?.success && result.data) {
        buffer = Buffer.isBuffer(result.data) ? result.data : Buffer.from(result.data);
      }
    } else if (doc.storageProvider === 'LOCAL_DRIVE') {
      // LOCAL_DRIVE files live on the owner's computer — they're not
      // remotely retrievable. Surface a clean error to the recipient.
      return NextResponse.json(
        { error: 'This document is stored on the sender\'s local drive and cannot be opened remotely.' },
        { status: 410 }
      );
    }

    if (!buffer) {
      return NextResponse.json({ error: 'File could not be retrieved' }, { status: 500 });
    }

    // Audit (fire-and-forget)
    createAuditLog({
      userId: share.userId,
      action: 'READ',
      entityType: 'Document',
      entityId: doc.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      metadata: {
        viewedVia: 'public_share_file',
        sharePackageId: share.id,
      },
    }).catch(() => {});

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          doc.originalFilename
        )}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/share/[token]/file/[docId]] error', error);
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}
