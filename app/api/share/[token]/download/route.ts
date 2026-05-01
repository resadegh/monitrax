/**
 * Phase 38 PR 3 — Public Share Pass ZIP download.
 *
 * GET /api/share/:token/download → streams a ZIP organised by the share's
 * `contentRefs.structure` setting (financial-year-first / entity-first /
 * category-first).
 *
 * Reuses the same JSZip + folder logic as the existing
 * /api/documents/export endpoint — but invokes it with the SHARE's owner
 * userId, NOT the recipient's (the recipient is anonymous). The set of
 * documents is the intersection of the share's documentIds and the
 * owner's still-valid documents. Soft-deleted docs are silently dropped.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  getMonitraxStorageProvider,
  getGoogleCloudStorageProvider,
  isGoogleCloudStorageConfigured,
} from '@/lib/documents/storage';
import JSZip from 'jszip';
import type { DocumentBundleRefs, ExportStructure } from '@/lib/share/content';

type Params = { params: Promise<{ token: string }> };

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

function getAustralianFY(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
}

const CATEGORY_FOLDER: Record<string, string> = {
  CONTRACT: 'Contracts',
  STATEMENT: 'Statements',
  RECEIPT: 'Receipts',
  TAX: 'Tax_Documents',
  PDS: 'Product_Disclosures',
  VALUATION: 'Valuations',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Leases',
  INVOICE: 'Invoices',
  OTHER: 'Other',
};

export async function GET(request: Request, ctx: Params) {
  try {
    const { token } = await ctx.params;
    if (!token) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 });
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
        watermarkText: true,
        user: { select: { name: true } },
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
    const ids = Array.isArray(refs.documentIds) ? refs.documentIds : [];
    const structure: ExportStructure = refs.structure ?? 'financial-year-first';
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Empty share' }, { status: 404 });
    }

    const docs = await prisma.document.findMany({
      where: {
        id: { in: ids },
        userId: share.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        mimeType: true,
        category: true,
        storageProvider: true,
        storagePath: true,
        fileContent: true,
        uploadedAt: true,
        links: { select: { entityType: true, entityId: true } },
      },
    });

    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'No documents available — they may have been deleted or revoked.' },
        { status: 410 }
      );
    }

    // Build the ZIP. Folder layout mirrors /api/documents/export.
    const zip = new JSZip();
    const monitrax = getMonitraxStorageProvider();
    const gcs = isGoogleCloudStorageConfigured() ? getGoogleCloudStorageProvider() : null;

    let included = 0;
    let skipped = 0;

    for (const doc of docs) {
      // Resolve bytes
      let buffer: Buffer | null = null;
      if (doc.fileContent) {
        buffer = Buffer.from(doc.fileContent);
      } else if (doc.storageProvider === 'GOOGLE_CLOUD_STORAGE' && gcs) {
        const r = await gcs.download(doc.storagePath);
        if (r?.success && r.data) {
          buffer = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
        }
      } else if (doc.storageProvider === 'MONITRAX') {
        const r = await monitrax.download(doc.storagePath);
        if (r?.success && r.data) {
          buffer = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
        }
      }
      // LOCAL_DRIVE files are silently skipped (can't be retrieved server-side)

      if (!buffer) {
        skipped++;
        continue;
      }

      // Path layout
      const fy = getAustralianFY(doc.uploadedAt);
      const cat = CATEGORY_FOLDER[doc.category as string] ?? 'Other';
      const safeName = sanitizeFilename(doc.originalFilename);
      let folder: string;
      if (structure === 'financial-year-first') {
        folder = `${fy}/${cat}`;
      } else if (structure === 'category-first') {
        folder = `${cat}/${fy}`;
      } else {
        // entity-first — group by first link's entityType, fallback to "Unlinked"
        const firstLink = doc.links[0];
        const entity = firstLink ? firstLink.entityType : 'Unlinked';
        folder = `${entity}/${cat}`;
      }
      zip.file(`${folder}/${safeName}`, buffer);
      included++;
    }

    // Drop a watermark + manifest at the root so the recipient + auditor
    // can verify provenance offline.
    const manifest = [
      `Monitrax Share Bundle`,
      `Generated: ${new Date().toISOString()}`,
      `Owner: ${share.user.name}`,
      `Watermark: ${share.watermarkText ?? '—'}`,
      `Documents included: ${included}`,
      ...(skipped > 0 ? [`Documents skipped (storage unreachable): ${skipped}`] : []),
      `Structure: ${structure}`,
    ].join('\n');
    zip.file('_README.txt', manifest);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Audit (fire-and-forget)
    createAuditLog({
      userId: share.userId,
      action: 'EXPORT',
      entityType: 'SharePackage',
      entityId: share.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      metadata: {
        viewedVia: 'public_share_zip',
        documentsIncluded: included,
        documentsSkipped: skipped,
        structure,
      },
    }).catch(() => {});

    const filename = `monitrax-share-${getAustralianFY(new Date())}.zip`;
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/share/[token]/download] error', error);
    return NextResponse.json({ error: 'Failed to build ZIP' }, { status: 500 });
  }
}
