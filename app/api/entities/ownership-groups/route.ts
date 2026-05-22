/**
 * /api/entities/ownership-groups — Phase 44 Part 1c (Q1 — joint ownership)
 *
 * GET  — list the caller's `OwnershipGroup` rows, optionally filtered to
 *        one owned object via `?ownedObjectType=&ownedObjectId=`.
 * POST — create an `OwnershipGroup` + its `OwnershipStake` rows: joint
 *        tenancy (survivorship) or tenants-in-common (fixed fractions).
 *
 * `OwnershipGroup`/`OwnershipStake` answer "who owns this *asset*" — as
 * distinct from `EntityRelationship` ("who owns this *entity's equity*").
 * They layer BESIDE `ownerEntityId` (the primary legal-title owner),
 * never replacing it (PHASE_44_ENTITY_GRAPH.md §3A, §7).
 *
 * SSOT: thin handler. Every write goes through
 * `lib/services/ownershipService.ts` — the only writer of these models.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createOwnershipGroup,
  listOwnershipGroups,
  OwnershipValidationError,
  type CreateOwnershipGroupInput,
  type OwnershipStakeInput,
} from '@/lib/services/ownershipService';
import type { TenancyType } from '@prisma/client';

const VALID_TENANCY_TYPES: ReadonlySet<TenancyType> = new Set<TenancyType>([
  'SOLE',
  'JOINT_TENANTS',
  'TENANTS_IN_COMMON',
  'OTHER',
]);

const VALID_OWNED_OBJECT_TYPES: ReadonlySet<string> = new Set([
  'property',
  'loan',
  'account',
  'investmentAccount',
  'asset',
]);

function statusForOwnershipError(code: OwnershipValidationError['code']): number {
  switch (code) {
    case 'ENTITY_NOT_FOUND':
    case 'GROUP_NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}

export const GET = withPermission('entity.read', async (request: NextRequest, auth) => {
  try {
    const url = new URL(request.url);
    const ownedObjectType = url.searchParams.get('ownedObjectType');
    const ownedObjectId = url.searchParams.get('ownedObjectId');
    const filter =
      ownedObjectType && ownedObjectId ? { ownedObjectType, ownedObjectId } : undefined;
    const groups = await listOwnershipGroups(auth.userId, filter);
    return NextResponse.json({ data: groups, _meta: { count: groups.length } });
  } catch (error) {
    console.error('List ownership groups error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list ownership groups.';
    return NextResponse.json(
      { error: { code: 'OWNERSHIP_GROUPS_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateOwnershipGroupBody {
  ownedObjectType?: unknown;
  ownedObjectId?: unknown;
  tenancyType?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  stakes?: unknown;
}

interface RawStake {
  entityId?: unknown;
  sharePct?: unknown;
  survivorshipApplies?: unknown;
  notes?: unknown;
}

export const POST = withPermission('entity.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateOwnershipGroupBody;

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

    const tenancyType = body.tenancyType as TenancyType;
    if (!VALID_TENANCY_TYPES.has(tenancyType)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'tenancyType is not a valid value.' } },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.stakes) || body.stakes.length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'At least one ownership stake is required.' } },
        { status: 400 },
      );
    }

    const stakes: OwnershipStakeInput[] = [];
    for (const raw of body.stakes as RawStake[]) {
      if (!raw || typeof raw.entityId !== 'string' || raw.entityId.length === 0) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Every stake needs an entityId.' } },
          { status: 400 },
        );
      }
      if (
        raw.sharePct !== undefined &&
        raw.sharePct !== null &&
        (typeof raw.sharePct !== 'number' || raw.sharePct < 0 || raw.sharePct > 100)
      ) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'sharePct must be a number between 0 and 100.' } },
          { status: 400 },
        );
      }
      stakes.push({
        entityId: raw.entityId,
        sharePct: typeof raw.sharePct === 'number' ? raw.sharePct : null,
        survivorshipApplies:
          typeof raw.survivorshipApplies === 'boolean' ? raw.survivorshipApplies : undefined,
        notes: typeof raw.notes === 'string' && raw.notes.trim().length > 0 ? raw.notes.trim() : null,
      });
    }

    const input: CreateOwnershipGroupInput = {
      ownedObjectType,
      ownedObjectId,
      tenancyType,
      effectiveFrom:
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.length > 0
          ? new Date(body.effectiveFrom)
          : undefined,
      effectiveTo:
        typeof body.effectiveTo === 'string' && body.effectiveTo.length > 0
          ? new Date(body.effectiveTo)
          : null,
      stakes,
    };

    const result = await createOwnershipGroup(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof OwnershipValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusForOwnershipError(error.code) },
      );
    }
    console.error('Create ownership group error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create ownership group.';
    return NextResponse.json(
      { error: { code: 'OWNERSHIP_GROUP_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
