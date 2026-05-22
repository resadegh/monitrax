/**
 * /api/entities/[id]/verify — Phase 44 Part 1c (Q4)
 *
 * POST — flip an entity's `accountantVerified` provenance flag. Part of
 *        the accountant-review share-pass (PHASE_44_ENTITY_GRAPH.md §9):
 *        the accountant confirms the entity is recorded correctly, the
 *        user marks it verified.
 *
 * SSOT: thin handler. The write goes through
 * `legalEntityService.setEntityAccountantVerified()`. Audit log written
 * here — the route owns the audit for LegalEntity writes (this file's
 * convention).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { setEntityAccountantVerified } from '@/lib/services/legalEntityService';
import { logCRUD } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      const body = (await request.json()) as { verified?: unknown };
      if (typeof body.verified !== 'boolean') {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'verified (boolean) is required.' } },
          { status: 400 },
        );
      }
      const found = await setEntityAccountantVerified(auth.userId, id, body.verified);
      if (!found) {
        return NextResponse.json(
          { error: { code: 'ENTITY_NOT_FOUND', message: 'Entity not found or not owned by you.' } },
          { status: 404 },
        );
      }

      logCRUD({
        userId: auth.userId,
        action: 'UPDATE',
        entityType: 'LegalEntity',
        entityId: id,
        metadata: { accountantVerified: body.verified },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      }).catch(() => {});

      return NextResponse.json({ data: { id, accountantVerified: body.verified } });
    } catch (error) {
      console.error('Verify entity error:', error);
      const message = error instanceof Error ? error.message : 'Failed to verify entity.';
      return NextResponse.json(
        { error: { code: 'ENTITY_VERIFY_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
