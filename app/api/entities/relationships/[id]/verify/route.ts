/**
 * /api/entities/relationships/[id]/verify — Phase 44 Part 1c (Q4)
 *
 * POST — flip a relationship's `accountantVerified` provenance flag.
 *        Part of the accountant-review share-pass: the user hands their
 *        accountant the structure report, the accountant confirms, the
 *        user marks the confirmed edges verified
 *        (PHASE_44_ENTITY_GRAPH.md §9).
 *
 * SSOT: thin handler. The write goes through
 * `entityRelationshipService.setRelationshipAccountantVerified()`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  setRelationshipAccountantVerified,
  RelationshipValidationError,
} from '@/lib/services/entityRelationshipService';

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
      await setRelationshipAccountantVerified(auth.userId, id, body.verified, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, accountantVerified: body.verified } });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.code === 'RELATIONSHIP_NOT_FOUND' ? 404 : 400 },
        );
      }
      console.error('Verify relationship error:', error);
      const message = error instanceof Error ? error.message : 'Failed to verify relationship.';
      return NextResponse.json(
        { error: { code: 'RELATIONSHIP_VERIFY_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
