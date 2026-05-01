/**
 * Phase 38 PR 3 — Share Pass revocation.
 *
 * DELETE /api/share/:id  → revoke a share (soft — sets revokedAt)
 *
 * Why soft-delete: an audit trail of "this user created this share, then
 * revoked it on this date" is more valuable than a hard delete that
 * leaves no fingerprint. The recipient page checks `revokedAt` on every
 * access; revoked shares 410 Gone, never 404, so the recipient can tell
 * the link was cancelled rather than fabricated.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';

type Params = { params: Promise<{ id: string }> };

export const DELETE = withPermission<Params>(
  'report.export',
  async (request, auth, ctx) => {
    try {
      const { id } = (await ctx?.params) ?? { id: '' };
      if (!id) {
        return NextResponse.json({ error: 'Missing share id' }, { status: 400 });
      }
      let body: { reason?: string } = {};
      try {
        body = await request.json();
      } catch {
        // Empty body is fine — reason is optional.
      }

      // Ownership check + revocation in a single conditional update.
      // If the WHERE clause doesn't match (wrong user, already revoked,
      // not found), Prisma's updateMany returns count: 0 — we 404.
      const result = await prisma.sharePackage.updateMany({
        where: {
          id,
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

      createAuditLog({
        userId: auth.userId,
        action: 'DELETE',
        entityType: 'SharePackage',
        entityId: id,
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
        metadata: {
          reason: body.reason ?? null,
          revokedAt: new Date().toISOString(),
        },
      }).catch(() => {});

      return NextResponse.json({ success: true, revokedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[DELETE /api/share/[id]] error', error);
      return NextResponse.json(
        { error: 'Failed to revoke share' },
        { status: 500 }
      );
    }
  }
);
