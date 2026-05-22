/**
 * /api/entities/beneficial-ownership — Phase 44 Part 1c
 *
 * GET  — list the caller's `BeneficialOwnershipOverride` rows.
 * POST — record that legal title and beneficial ownership differ for a
 *        specific asset (a nominee, a bare trust, a custodian).
 *
 * Legal title equals beneficial ownership UNLESS an override says
 * otherwise. Overrides are asset-scoped — they attach to a specific
 * parcel/property/holding, never broadly to an entity (which is why the
 * §5 `NOMINEE_FOR` edge was removed). PHASE_44_ENTITY_GRAPH.md §3A, §7.
 *
 * SSOT: thin handler. Writes go through
 * `lib/services/beneficialOwnershipService.ts` — the only writer.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createBeneficialOwnershipOverride,
  listBeneficialOwnershipOverrides,
  BeneficialOwnershipValidationError,
  type CreateBeneficialOwnershipInput,
} from '@/lib/services/beneficialOwnershipService';
import type { BeneficialOwnershipBasis } from '@prisma/client';

const VALID_BASES: ReadonlySet<BeneficialOwnershipBasis> = new Set<BeneficialOwnershipBasis>([
  'BARE_TRUST',
  'NOMINEE',
  'CUSTODIAN',
  'RESULTING_TRUST',
  'OTHER',
]);

const VALID_OWNED_OBJECT_TYPES: ReadonlySet<string> = new Set([
  'asset',
  'shareParcel',
  'ownershipStake',
  'investmentHolding',
]);

function statusForBeneficialError(code: BeneficialOwnershipValidationError['code']): number {
  switch (code) {
    case 'ENTITY_NOT_FOUND':
    case 'OVERRIDE_NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}

export const GET = withPermission('entity.read', async (_request: NextRequest, auth) => {
  try {
    const overrides = await listBeneficialOwnershipOverrides(auth.userId);
    return NextResponse.json({ data: overrides, _meta: { count: overrides.length } });
  } catch (error) {
    console.error('List beneficial-ownership overrides error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to list beneficial-ownership overrides.';
    return NextResponse.json(
      { error: { code: 'BENEFICIAL_OWNERSHIP_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateBeneficialOwnershipBody {
  legalOwnerEntityId?: unknown;
  beneficialOwnerEntityId?: unknown;
  ownedObjectType?: unknown;
  ownedObjectId?: unknown;
  basis?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  sourceDocumentId?: unknown;
}

export const POST = withPermission('entity.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateBeneficialOwnershipBody;

    const legalOwnerEntityId =
      typeof body.legalOwnerEntityId === 'string' ? body.legalOwnerEntityId : '';
    const beneficialOwnerEntityId =
      typeof body.beneficialOwnerEntityId === 'string' ? body.beneficialOwnerEntityId : '';
    if (!legalOwnerEntityId || !beneficialOwnerEntityId) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'legalOwnerEntityId and beneficialOwnerEntityId are required.',
          },
        },
        { status: 400 },
      );
    }

    const ownedObjectType =
      typeof body.ownedObjectType === 'string' ? body.ownedObjectType : '';
    const ownedObjectId = typeof body.ownedObjectId === 'string' ? body.ownedObjectId : '';
    if (!VALID_OWNED_OBJECT_TYPES.has(ownedObjectType) || !ownedObjectId) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: `ownedObjectType must be one of: ${[...VALID_OWNED_OBJECT_TYPES].join(', ')}, and ownedObjectId is required.`,
          },
        },
        { status: 400 },
      );
    }

    const basis = body.basis as BeneficialOwnershipBasis;
    if (!VALID_BASES.has(basis)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'basis is not a valid value.' } },
        { status: 400 },
      );
    }

    const input: CreateBeneficialOwnershipInput = {
      legalOwnerEntityId,
      beneficialOwnerEntityId,
      ownedObjectType,
      ownedObjectId,
      basis,
      effectiveFrom:
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.length > 0
          ? new Date(body.effectiveFrom)
          : undefined,
      effectiveTo:
        typeof body.effectiveTo === 'string' && body.effectiveTo.length > 0
          ? new Date(body.effectiveTo)
          : null,
      sourceDocumentId:
        typeof body.sourceDocumentId === 'string' && body.sourceDocumentId.length > 0
          ? body.sourceDocumentId
          : null,
    };

    const id = await createBeneficialOwnershipOverride(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    if (error instanceof BeneficialOwnershipValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusForBeneficialError(error.code) },
      );
    }
    console.error('Create beneficial-ownership override error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create beneficial-ownership override.';
    return NextResponse.json(
      { error: { code: 'BENEFICIAL_OWNERSHIP_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
