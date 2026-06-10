/**
 * /api/ownership/[objectType]/[objectId] — Phase 47 Stage A2.
 *
 * PATCH — "Correct ownership record" for an existing owned object
 * (property / loan / account / investmentAccount / asset). One endpoint,
 * one concern (§12.4): re-attribute legal title + replace co-ownership
 * records, with the Q-EOF-1 correction-never-transfer semantic enforced
 * by the canonical service. Body: `{ ownership, reason }`.
 *
 * SSOT: thin handler — all logic in
 * `lib/services/ownershipSelectionService.ts:correctOwnershipRecord`.
 * Design SoT (§18.4): Stitch screen `ce11109f00f54b989dff74e9af18f1fa`
 * (`.stitch/designs/phase47/correct-ownership-record-v1.{html,png}`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  correctOwnershipRecord,
  getOwnershipRecord,
  isOwnedObjectType,
  OwnershipSelectionError,
  parseOwnershipSelection,
} from '@/lib/services/ownershipSelectionService';

type RouteContext = { params: Promise<{ objectType: string; objectId: string }> };

/** GET — read the current ownership record (powers the edit-surface Ownership row). */
export const GET = withPermission<RouteContext>(
  'entity.read',
  async (_request: NextRequest, auth, context) => {
    try {
      const { objectType, objectId } = await context!.params;
      if (!isOwnedObjectType(objectType)) {
        return NextResponse.json(
          { error: { code: 'INVALID_OBJECT_TYPE', message: 'Unsupported object type.' } },
          { status: 400 },
        );
      }
      const record = await getOwnershipRecord(auth.userId, objectType, objectId);
      return NextResponse.json({ success: true, data: record });
    } catch (err) {
      if (err instanceof OwnershipSelectionError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: 404 },
        );
      }
      console.error('Get ownership record error:', err);
      return NextResponse.json(
        { error: { code: 'OWNERSHIP_READ_FAILED', message: 'Internal server error' } },
        { status: 500 },
      );
    }
  },
);

export const PATCH = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { objectType, objectId } = await context!.params;
      if (!isOwnedObjectType(objectType)) {
        return NextResponse.json(
          { error: { code: 'INVALID_OBJECT_TYPE', message: 'Unsupported object type.' } },
          { status: 400 },
        );
      }

      const body = await request.json();
      const selection = parseOwnershipSelection(body.ownership);
      if (!selection) {
        return NextResponse.json(
          { error: { code: 'INVALID_SELECTION', message: 'ownership is required.' } },
          { status: 400 },
        );
      }
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

      const result = await correctOwnershipRecord(
        auth.userId,
        objectType,
        objectId,
        selection,
        reason,
      );

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof OwnershipSelectionError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.code === 'ENTITY_NOT_FOUND' ? 404 : 400 },
        );
      }
      console.error('Correct ownership record error:', err);
      return NextResponse.json(
        { error: { code: 'OWNERSHIP_CORRECTION_FAILED', message: 'Internal server error' } },
        { status: 500 },
      );
    }
  },
);
