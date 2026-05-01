/**
 * Phase 38 PR 3 — Share Pass create + list.
 *
 * POST /api/share   → create a SharePackage (auth required)
 * GET  /api/share   → list the caller's SharePackages (auth required)
 *
 * The DOCUMENT_BUNDLE content type validates that every requested
 * `documentId` belongs to the caller (defence-in-depth ownership check)
 * before persisting the share. The recipient page later re-validates on
 * every access — token alone is not enough; the snapshot it points to
 * must still match the owner's data and not have been revoked.
 *
 * Audit logging: every create + revoke event is written via createAuditLog
 * with entityType='SharePackage' (CLAUDE.md §13.5 chain-of-custody).
 * Recipient-side reads/downloads are logged from the public endpoints.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  generateShareToken,
  buildShareUrl,
  buildDefaultWatermark,
  computeExpiry,
  DEFAULT_SHARE_EXPIRY_DAYS,
} from '@/lib/share/tokens';

type SharePurpose =
  | 'TAX_RETURN'
  | 'LOAN_APPLICATION'
  | 'INSURANCE_CLAIM'
  | 'ADVISER_REVIEW'
  | 'OTHER';

type ShareDelivery = 'LINK' | 'EMAIL_LINK' | 'DOWNLOAD_ONLY';

type ExportStructure = 'financial-year-first' | 'entity-first' | 'category-first';

interface CreateShareRequest {
  contentType: 'DOCUMENT_BUNDLE';
  documentIds: string[]; // required for DOCUMENT_BUNDLE
  structure?: ExportStructure;
  purpose: SharePurpose;
  recipientName?: string;
  recipientEmail?: string;
  expiresInDays?: number; // default 30 — see lib/share/tokens.ts
  contentLabel?: string;
  deliveryMethod?: ShareDelivery;
  notes?: string;
}

const VALID_PURPOSE: ReadonlyArray<SharePurpose> = [
  'TAX_RETURN',
  'LOAN_APPLICATION',
  'INSURANCE_CLAIM',
  'ADVISER_REVIEW',
  'OTHER',
];

const VALID_DELIVERY: ReadonlyArray<ShareDelivery> = ['LINK', 'EMAIL_LINK', 'DOWNLOAD_ONLY'];

// =============================================================================
// POST — create share
// =============================================================================

export const POST = withPermission('report.export', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body = (await request.json()) as Partial<CreateShareRequest>;

    // ---- Input validation ----
    if (body.contentType !== 'DOCUMENT_BUNDLE') {
      return NextResponse.json(
        { error: "Only contentType 'DOCUMENT_BUNDLE' is supported in v1" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds[] is required and must be non-empty' },
        { status: 400 }
      );
    }
    if (!body.purpose || !VALID_PURPOSE.includes(body.purpose)) {
      return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 });
    }
    const deliveryMethod: ShareDelivery =
      body.deliveryMethod && VALID_DELIVERY.includes(body.deliveryMethod)
        ? body.deliveryMethod
        : 'LINK';
    const structure: ExportStructure = body.structure ?? 'financial-year-first';
    const expiresInDays = Math.min(
      Math.max(body.expiresInDays ?? DEFAULT_SHARE_EXPIRY_DAYS, 1),
      365
    );

    // ---- Defence-in-depth ownership check ----
    // Verify every documentId belongs to the caller AND isn't soft-deleted.
    // Without this, a caller could share another user's documents by guessing
    // IDs. The Phase 25 ownership invariants are user-scoped via Prisma
    // queries everywhere else; we mirror that here.
    const ownedCount = await prisma.document.count({
      where: {
        id: { in: body.documentIds },
        userId,
        deletedAt: null,
      },
    });
    if (ownedCount !== body.documentIds.length) {
      return NextResponse.json(
        { error: 'One or more documents not found or not owned by you' },
        { status: 403 }
      );
    }

    // ---- Resolve owner name for the watermark ----
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const watermarkText = buildDefaultWatermark(owner?.name ?? 'Monitrax user');

    // ---- Token + persist ----
    const token = generateShareToken();
    const created = await prisma.sharePackage.create({
      data: {
        userId,
        token,
        recipientName: body.recipientName?.trim() || null,
        recipientEmail: body.recipientEmail?.trim() || null,
        purpose: body.purpose as never, // Prisma enum runtime accepts the literal
        contentType: 'DOCUMENT_BUNDLE' as never,
        contentRefs: {
          documentIds: body.documentIds,
          structure,
        },
        contentLabel: body.contentLabel?.trim() || null,
        deliveryMethod: deliveryMethod as never,
        expiresAt: computeExpiry(expiresInDays),
        watermarkText,
        notes: body.notes?.trim() || null,
      },
      select: {
        id: true,
        token: true,
        purpose: true,
        contentType: true,
        contentLabel: true,
        deliveryMethod: true,
        recipientName: true,
        recipientEmail: true,
        expiresAt: true,
        watermarkText: true,
        viewCount: true,
        createdAt: true,
      },
    });

    // ---- Audit (fire-and-forget; never blocks response) ----
    createAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'SharePackage',
      entityId: created.id,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      metadata: {
        purpose: created.purpose,
        contentType: created.contentType,
        deliveryMethod: created.deliveryMethod,
        documentCount: body.documentIds.length,
        expiresAt: created.expiresAt.toISOString(),
        recipientEmail: created.recipientEmail,
        // INTENTIONALLY do not log document IDs or filenames — CDR sanitisation
      },
    }).catch(() => {});

    const origin = request.headers.get('origin');
    const shareUrl = buildShareUrl(created.token, origin);

    return NextResponse.json({
      ...created,
      shareUrl,
    });
  } catch (error) {
    console.error('[POST /api/share] error', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET — list caller's shares (active first, then revoked/expired)
// =============================================================================

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const now = new Date();
    const shares = await prisma.sharePackage.findMany({
      where: {
        userId,
        ...(includeInactive
          ? {}
          : {
              revokedAt: null,
              expiresAt: { gt: now },
            }),
      },
      orderBy: [
        { revokedAt: 'asc' }, // nulls first → active shares on top
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        token: true,
        purpose: true,
        contentType: true,
        contentLabel: true,
        contentRefs: true,
        deliveryMethod: true,
        recipientName: true,
        recipientEmail: true,
        expiresAt: true,
        revokedAt: true,
        viewCount: true,
        lastViewedAt: true,
        watermarkText: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const origin = request.headers.get('origin');
    const annotated = shares.map((s) => ({
      ...s,
      shareUrl: buildShareUrl(s.token, origin),
      isActive: !s.revokedAt && s.expiresAt.getTime() > now.getTime(),
    }));

    return NextResponse.json({ shares: annotated, total: annotated.length });
  } catch (error) {
    console.error('[GET /api/share] error', error);
    return NextResponse.json({ error: 'Failed to list shares' }, { status: 500 });
  }
});
