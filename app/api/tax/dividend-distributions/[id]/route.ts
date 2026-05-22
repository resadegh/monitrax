/**
 * /api/tax/dividend-distributions/[id] — Phase 44 Part 2b
 *
 * PATCH  — move the dividend between DRAFT and CONFIRMED (`{ status }`).
 * DELETE — hard-delete the dividend (payments cascade).
 *
 * SSOT: thin handler over `dividendDistributionService`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  updateDividendDistributionStatus,
  deleteDividendDistribution,
  DividendDistributionValidationError,
} from '@/lib/services/dividendDistributionService';
import type { ResolutionStatus } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES: ReadonlySet<ResolutionStatus> = new Set<ResolutionStatus>([
  'DRAFT',
  'CONFIRMED',
]);

function statusFor(code: DividendDistributionValidationError['code']): number {
  return code === 'DIVIDEND_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
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
      await updateDividendDistributionStatus(auth.userId, id, body.status as ResolutionStatus, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, status: body.status } });
    } catch (error) {
      if (error instanceof DividendDistributionValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Update dividend status error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update dividend.';
      return NextResponse.json(
        { error: { code: 'DIVIDEND_UPDATE_FAILED', message } },
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
      await deleteDividendDistribution(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof DividendDistributionValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Delete dividend error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete dividend.';
      return NextResponse.json(
        { error: { code: 'DIVIDEND_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
