/**
 * /api/tax/distribution-resolutions/[id] — Phase 44 Part 2b
 *
 * PATCH  — move the resolution between DRAFT and CONFIRMED (`{ status }`).
 * DELETE — hard-delete the resolution (allocations cascade).
 *
 * SSOT: thin handler over `distributionResolutionService`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  updateDistributionResolutionStatus,
  deleteDistributionResolution,
  DistributionResolutionValidationError,
} from '@/lib/services/distributionResolutionService';
import type { ResolutionStatus } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES: ReadonlySet<ResolutionStatus> = new Set<ResolutionStatus>([
  'DRAFT',
  'CONFIRMED',
]);

function statusFor(code: DistributionResolutionValidationError['code']): number {
  return code === 'RESOLUTION_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
}

export const PATCH = withPermission<RouteContext>(
  'tax_data.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      const body = (await request.json()) as { status?: unknown };
      if (!VALID_STATUSES.has(body.status as ResolutionStatus)) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'status must be DRAFT or CONFIRMED.' } },
          { status: 400 },
        );
      }
      await updateDistributionResolutionStatus(auth.userId, id, body.status as ResolutionStatus, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, status: body.status } });
    } catch (error) {
      if (error instanceof DistributionResolutionValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Update resolution status error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update resolution.';
      return NextResponse.json(
        { error: { code: 'RESOLUTION_UPDATE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withPermission<RouteContext>(
  'tax_data.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      await deleteDistributionResolution(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof DistributionResolutionValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Delete resolution error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete resolution.';
      return NextResponse.json(
        { error: { code: 'RESOLUTION_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
