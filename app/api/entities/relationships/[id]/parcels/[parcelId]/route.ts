/**
 * /api/entities/relationships/[id]/parcels/[parcelId] — Phase 47 F3.
 *
 * PATCH  — correct a parcel's details, or dispose it (set `disposedAt`).
 *          Disposal never deletes — CGT history is kept.
 * DELETE — hard-delete a MISTAKEN parcel only.
 *
 * Thin handlers; all writes via `entityRelationshipService` (§8.4).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  updateShareParcel,
  deleteShareParcel,
  RelationshipValidationError,
} from '@/lib/services/entityRelationshipService';
import type { ShareClass } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string; parcelId: string }> };

function statusFor(code: RelationshipValidationError['code']): number {
  return code === 'RELATIONSHIP_NOT_FOUND' ? 404 : 400;
}

interface UpdateParcelBody {
  shareClass?: unknown;
  quantity?: unknown;
  paidPerUnit?: unknown;
  unpaidPerUnit?: unknown;
  acquiredAt?: unknown;
  disposedAt?: unknown; // ISO string sets, null clears
}

export const PATCH = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id, parcelId } = await context!.params;
      const body = (await request.json()) as UpdateParcelBody;

      if (body.quantity !== undefined && (typeof body.quantity !== 'number' || body.quantity <= 0)) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'quantity must be a positive number.' } },
          { status: 400 },
        );
      }
      if (
        body.disposedAt !== undefined &&
        body.disposedAt !== null &&
        (typeof body.disposedAt !== 'string' || isNaN(new Date(body.disposedAt).getTime()))
      ) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'disposedAt must be an ISO date string or null.' } },
          { status: 400 },
        );
      }

      const parcel = await updateShareParcel(
        auth.userId,
        id,
        parcelId,
        {
          ...(body.shareClass !== undefined && { shareClass: body.shareClass as ShareClass }),
          ...(body.quantity !== undefined && { quantity: body.quantity as number }),
          ...(typeof body.paidPerUnit === 'number' && { paidPerUnit: body.paidPerUnit }),
          ...(typeof body.unpaidPerUnit === 'number' && { unpaidPerUnit: body.unpaidPerUnit }),
          ...(typeof body.acquiredAt === 'string' && { acquiredAt: body.acquiredAt }),
          ...(body.disposedAt !== undefined && {
            disposedAt: body.disposedAt as string | null,
          }),
        },
        {
          ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
          userAgent: request.headers.get('user-agent') ?? undefined,
        },
      );
      return NextResponse.json({ data: parcel });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Update parcel error:', error);
      return NextResponse.json(
        { error: { code: 'PARCEL_UPDATE_FAILED', message: 'Failed to update the parcel.' } },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id, parcelId } = await context!.params;
      await deleteShareParcel(auth.userId, id, parcelId, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Delete parcel error:', error);
      return NextResponse.json(
        { error: { code: 'PARCEL_DELETE_FAILED', message: 'Failed to delete the parcel.' } },
        { status: 500 },
      );
    }
  },
);
