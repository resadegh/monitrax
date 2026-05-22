/**
 * /api/entities/ownership-groups/[id] — Phase 44 Part 1c (Q1)
 *
 * PATCH  — end an `OwnershipGroup` by setting `effectiveTo` (ownership
 *          changed hands). The group is retained for history.
 * DELETE — hard-delete an `OwnershipGroup` (a mistaken entry). Stakes
 *          cascade-delete with the group.
 *
 * SSOT: thin handler. Writes go through `lib/services/ownershipService.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  endOwnershipGroup,
  deleteOwnershipGroup,
  OwnershipValidationError,
} from '@/lib/services/ownershipService';

type RouteContext = { params: Promise<{ id: string }> };

function statusForOwnershipError(code: OwnershipValidationError['code']): number {
  return code === 'GROUP_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
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
      await endOwnershipGroup(auth.userId, id, effectiveTo, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, effectiveTo: effectiveTo.toISOString() } });
    } catch (error) {
      if (error instanceof OwnershipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForOwnershipError(error.code) },
        );
      }
      console.error('End ownership group error:', error);
      const message = error instanceof Error ? error.message : 'Failed to end ownership group.';
      return NextResponse.json(
        { error: { code: 'OWNERSHIP_GROUP_END_FAILED', message } },
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
      await deleteOwnershipGroup(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof OwnershipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForOwnershipError(error.code) },
        );
      }
      console.error('Delete ownership group error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete ownership group.';
      return NextResponse.json(
        { error: { code: 'OWNERSHIP_GROUP_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
