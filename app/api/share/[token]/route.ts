/**
 * Phase 38 PR 3 — Public Share Pass read endpoint.
 *
 * GET /api/share/:token  → metadata + content listing for the recipient
 *
 * NO AUTH REQUIRED. The token IS the bearer credential. Every access is
 * audit-logged (under the OWNER's userId — the recipient is anonymous to
 * us by design, but the owner's chain-of-custody is preserved per CLAUDE
 * §13.5).
 *
 * Validation order (any failure → don't increment view count):
 *   1. Token exists
 *   2. Not revoked
 *   3. Not expired
 *
 * On success, increments viewCount and stamps lastViewedAt. The audit log
 * carries IP + user-agent so the owner can see "who" accessed via the
 * Manage Shares page.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { documentsForShare, type DocumentBundleRefs } from '@/lib/share/content';

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Params) {
  try {
    const { token } = await ctx.params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 });
    }

    const share = await prisma.sharePackage.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        purpose: true,
        contentType: true,
        contentRefs: true,
        contentLabel: true,
        deliveryMethod: true,
        recipientName: true,
        expiresAt: true,
        revokedAt: true,
        viewCount: true,
        watermarkText: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }
    if (share.revokedAt) {
      return NextResponse.json(
        { error: 'This share link has been revoked by the sender.' },
        { status: 410 } // Gone — different from 404 so the recipient knows it was real
      );
    }
    if (share.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'This share link has expired.' },
        { status: 410 }
      );
    }

    // Resolve content. v1 = DOCUMENT_BUNDLE only.
    let documents: Awaited<ReturnType<typeof documentsForShare>> = [];
    if (share.contentType === 'DOCUMENT_BUNDLE') {
      const refs = (share.contentRefs ?? {}) as DocumentBundleRefs;
      documents = await documentsForShare(share.userId, refs);
    }

    // Increment view count + audit (best-effort; never block the response)
    prisma.sharePackage
      .update({
        where: { id: share.id },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date(),
        },
      })
      .catch(() => {});

    createAuditLog({
      userId: share.userId,
      action: 'READ',
      entityType: 'SharePackage',
      entityId: share.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      metadata: {
        viewedVia: 'public_token_get',
        recipientLabel: share.recipientName,
        contentType: share.contentType,
      },
    }).catch(() => {});

    return NextResponse.json({
      id: share.id,
      ownerName: share.user.name,
      purpose: share.purpose,
      contentType: share.contentType,
      contentLabel: share.contentLabel,
      deliveryMethod: share.deliveryMethod,
      recipientName: share.recipientName,
      expiresAt: share.expiresAt.toISOString(),
      createdAt: share.createdAt.toISOString(),
      viewCount: share.viewCount + 1,
      watermarkText: share.watermarkText,
      documents,
    });
  } catch (error) {
    console.error('[GET /api/share/[token]] error', error);
    return NextResponse.json({ error: 'Failed to load share' }, { status: 500 });
  }
}

// =============================================================================
// DELETE — owner-side revocation (auth required, ownership-checked)
//
// Identifies the share by token (same slug as the public GET above) so
// Next.js dynamic-routing rules are satisfied — only ONE slug name per
// path segment. The owner has the token in their `GET /api/share` list
// response. Auth via `withPermission` plus the `userId` clause in the
// Prisma `updateMany` WHERE means a non-owner holding the token cannot
// revoke (they get 404). The token's 256-bit entropy makes guessing
// computationally infeasible regardless.
// =============================================================================

export const DELETE = withPermission<Params>(
  'report.export',
  async (request, auth, ctx) => {
    try {
      const { token } = (await ctx?.params) ?? { token: '' };
      if (!token) {
        return NextResponse.json({ error: 'Missing share token' }, { status: 400 });
      }

      let body: { reason?: string } = {};
      try {
        body = await request.json();
      } catch {
        // Empty body is fine — reason is optional.
      }

      const result = await prisma.sharePackage.updateMany({
        where: {
          token,
          userId: auth.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: body.reason?.trim() || null,
        },
      });

      if (result.count === 0) {
        return NextResponse.json(
          { error: 'Share not found, already revoked, or not owned by you' },
          { status: 404 }
        );
      }

      // Resolve id for the audit-log entityId (we logged by id elsewhere)
      const updated = await prisma.sharePackage.findUnique({
        where: { token },
        select: { id: true },
      });

      createAuditLog({
        userId: auth.userId,
        action: 'DELETE',
        entityType: 'SharePackage',
        entityId: updated?.id ?? undefined,
        ipAddress:
          (request as NextRequest).headers.get('x-forwarded-for') ?? undefined,
        userAgent:
          (request as NextRequest).headers.get('user-agent') ?? undefined,
        metadata: {
          reason: body.reason ?? null,
          revokedAt: new Date().toISOString(),
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        revokedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[DELETE /api/share/[token]] error', error);
      return NextResponse.json(
        { error: 'Failed to revoke share' },
        { status: 500 }
      );
    }
  }
);
