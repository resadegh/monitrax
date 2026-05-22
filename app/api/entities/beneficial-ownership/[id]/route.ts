/**
 * /api/entities/beneficial-ownership/[id] — Phase 44 Part 1c
 *
 * PATCH  — end a `BeneficialOwnershipOverride` by setting `effectiveTo`
 *          (the nominee / bare-trust arrangement unwound).
 * DELETE — hard-delete an override (a mistaken entry).
 *
 * SSOT: thin handler. Writes go through
 * `lib/services/beneficialOwnershipService.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  endBeneficialOwnershipOverride,
  deleteBeneficialOwnershipOverride,
  BeneficialOwnershipValidationError,
} from '@/lib/services/beneficialOwnershipService';

type RouteContext = { params: Promise<{ id: string }> };

function statusForBeneficialError(code: BeneficialOwnershipValidationError['code']): number {
  return code === 'OVERRIDE_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
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
      await endBeneficialOwnershipOverride(auth.userId, id, effectiveTo, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, effectiveTo: effectiveTo.toISOString() } });
    } catch (error) {
      if (error instanceof BeneficialOwnershipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForBeneficialError(error.code) },
        );
      }
      console.error('End beneficial-ownership override error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to end beneficial-ownership override.';
      return NextResponse.json(
        { error: { code: 'BENEFICIAL_OWNERSHIP_END_FAILED', message } },
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
      await deleteBeneficialOwnershipOverride(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof BeneficialOwnershipValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusForBeneficialError(error.code) },
        );
      }
      console.error('Delete beneficial-ownership override error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to delete beneficial-ownership override.';
      return NextResponse.json(
        { error: { code: 'BENEFICIAL_OWNERSHIP_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
