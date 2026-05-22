/**
 * /api/entities/relationships/[id] — Phase 44 Part 1c
 *
 * PATCH  — end a relationship by setting `effectiveTo` (a director
 *          resigns, shares are sold, a trust vests). The edge is
 *          retained for history — CGT dates + director tenure depend
 *          on it (PHASE_44_ENTITY_GRAPH.md §3).
 * DELETE — hard-delete a relationship (a mistaken entry). A genuinely
 *          ended relationship should be PATCH-ended instead, so the
 *          history is kept.
 *
 * SSOT: thin handler. Every graph write goes through
 * `lib/services/entityRelationshipService.ts` (CLAUDE.md §12.2).
 *
 * Route shape: `withPermission<RouteContext>(...)` with Promise-typed
 * params + the non-null `context!` assertion — the Next.js 15 strict
 * route shape (see /api/entities/[id] for the full WHY).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  endRelationship,
  deleteRelationship,
  RelationshipValidationError,
} from '@/lib/services/entityRelationshipService';

type RouteContext = { params: Promise<{ id: string }> };

function statusForRelationshipError(code: RelationshipValidationError['code']): number {
  switch (code) {
    case 'ENTITY_NOT_FOUND':
    case 'RELATIONSHIP_NOT_FOUND':
      return 404;
    case 'DUPLICATE_EDGE':
      return 409;
    default:
      return 400;
  }
}

export const PATCH = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      const body = (await request.json()) as { effectiveTo?: unknown };
      const raw = body.effectiveTo;
      const effectiveTo =
        typeof raw === 'string' && raw.length > 0 ? new Date(raw) : new Date();
      if (Number.isNaN(effectiveTo.getTime())) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'effectiveTo is not a valid date.' } },
          { status: 400 },
        );
      }

      await endRelationship(auth.userId, id, effectiveTo, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, effectiveTo: effectiveTo.toISOString() } });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForRelationshipError(error.code) },
        );
      }
      console.error('End relationship error:', error);
      const message = error instanceof Error ? error.message : 'Failed to end relationship.';
      return NextResponse.json(
        { error: { code: 'RELATIONSHIP_END_FAILED', message } },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withPermission<RouteContext>(
  'entity.delete',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      await deleteRelationship(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForRelationshipError(error.code) },
        );
      }
      console.error('Delete relationship error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete relationship.';
      return NextResponse.json(
        { error: { code: 'RELATIONSHIP_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
