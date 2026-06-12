/**
 * /api/entities/relationships/[id]/parcels — Phase 47 F3.
 *
 * GET  — list the `ShareParcel` rows on one SHAREHOLDER_OF /
 *        UNITHOLDER_OF relationship.
 * POST — add a parcel ("500 ordinary, acquired 12 Mar 2021, $1.00
 *        paid"). The advisor chart's "[500]" / "[1 ORD]" become data.
 *
 * SSOT: thin handlers — every write goes through
 * `lib/services/entityRelationshipService.ts`, the only writer of the
 * graph (PHASE_44 §8.4). Ownership resolves through the parent edge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  listShareParcels,
  addShareParcel,
  RelationshipValidationError,
} from '@/lib/services/entityRelationshipService';
import type { ShareClass } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_SHARE_CLASSES: ReadonlySet<string> = new Set([
  'ORDINARY',
  'PREFERENCE',
  'REDEEMABLE_PREFERENCE',
  'A_CLASS',
  'B_CLASS',
  'C_CLASS',
  'OTHER',
]);

function statusFor(code: RelationshipValidationError['code']): number {
  return code === 'RELATIONSHIP_NOT_FOUND' ? 404 : 400;
}

export const GET = withPermission<RouteContext>(
  'entity.read',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;
      const parcels = await listShareParcels(auth.userId, id);
      return NextResponse.json({ data: parcels, _meta: { count: parcels.length } });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('List parcels error:', error);
      return NextResponse.json(
        { error: { code: 'PARCELS_LOAD_FAILED', message: 'Failed to list parcels.' } },
        { status: 500 },
      );
    }
  },
);

interface CreateParcelBody {
  shareClass?: unknown;
  quantity?: unknown;
  paidPerUnit?: unknown;
  unpaidPerUnit?: unknown;
  acquiredAt?: unknown;
}

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = (await request.json()) as CreateParcelBody;

      const quantity = typeof body.quantity === 'number' ? body.quantity : NaN;
      if (!isFinite(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'quantity must be a positive number.' } },
          { status: 400 },
        );
      }
      if (
        body.shareClass !== undefined &&
        (typeof body.shareClass !== 'string' || !VALID_SHARE_CLASSES.has(body.shareClass))
      ) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: `shareClass must be one of: ${[...VALID_SHARE_CLASSES].join(', ')}` } },
          { status: 400 },
        );
      }
      if (typeof body.acquiredAt !== 'string' || isNaN(new Date(body.acquiredAt).getTime())) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'acquiredAt must be an ISO date string.' } },
          { status: 400 },
        );
      }
      const paidPerUnit =
        body.paidPerUnit === undefined ? undefined : typeof body.paidPerUnit === 'number' && body.paidPerUnit >= 0 ? body.paidPerUnit : NaN;
      const unpaidPerUnit =
        body.unpaidPerUnit === undefined ? undefined : typeof body.unpaidPerUnit === 'number' && body.unpaidPerUnit >= 0 ? body.unpaidPerUnit : NaN;
      if (Number.isNaN(paidPerUnit) || Number.isNaN(unpaidPerUnit)) {
        return NextResponse.json(
          { error: { code: 'INVALID_INPUT', message: 'paidPerUnit / unpaidPerUnit must be non-negative numbers.' } },
          { status: 400 },
        );
      }

      const parcel = await addShareParcel(
        auth.userId,
        id,
        {
          shareClass: body.shareClass as ShareClass | undefined,
          quantity,
          paidPerUnit,
          unpaidPerUnit,
          acquiredAt: body.acquiredAt,
        },
        {
          ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
          userAgent: request.headers.get('user-agent') ?? undefined,
        },
      );
      return NextResponse.json({ data: parcel }, { status: 201 });
    } catch (error) {
      if (error instanceof RelationshipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Create parcel error:', error);
      return NextResponse.json(
        { error: { code: 'PARCEL_CREATE_FAILED', message: 'Failed to add the parcel.' } },
        { status: 500 },
      );
    }
  },
);
