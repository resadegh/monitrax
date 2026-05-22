/**
 * /api/entities/relationships — Phase 44 Part 1c
 *
 * GET  — list every `EntityRelationship` for the calling user (newest
 *        first, both entity names resolved). Used by the entity-detail
 *        dialog's relationship list.
 * POST — create a typed, time-bounded relationship edge.
 *
 * SSOT: thin handler. EVERY graph write goes through
 * `lib/services/entityRelationshipService.ts` — the only writer of
 * `EntityRelationship` (PHASE_44_ENTITY_GRAPH.md §8.4, CLAUDE.md §12.2).
 * The service classifies the edge against the §6 validity matrix inside
 * the write transaction; an IMPOSSIBLE_SYSTEM_ERROR edge is rejected, a
 * NON_COMPLIANT one is recorded + flagged (§6.1). No tax arithmetic
 * anywhere here (§8.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createRelationship,
  listRelationships,
  RelationshipValidationError,
  type CreateRelationshipInput,
} from '@/lib/services/entityRelationshipService';
import type {
  EntityRelationshipType,
  BeneficiaryClass,
} from '@prisma/client';

// Mirror of the Prisma `EntityRelationshipType` enum — validated at the
// boundary so a bad value never reaches the service (CLAUDE.md §12.5).
const VALID_RELATIONSHIP_TYPES: ReadonlySet<EntityRelationshipType> = new Set<EntityRelationshipType>([
  'TRUSTEE_OF',
  'APPOINTOR_OF',
  'GUARDIAN_OF',
  'POWER_HOLDER_OF',
  'SETTLOR_OF',
  'BENEFICIARY_OF',
  'EXECUTOR_OF',
  'ADMINISTRATOR_OF',
  'LEGAL_PERSONAL_REPRESENTATIVE_FOR',
  'UNITHOLDER_OF',
  'SHAREHOLDER_OF',
  'DIRECTOR_OF',
  'SECRETARY_OF',
  'PUBLIC_OFFICER_OF',
  'MEMBER_OF',
  'PARTNER_OF',
  'OPERATES_AS_SOLE_TRADER',
  'FAMILY_MEMBER_OF',
  'ASSOCIATE_OF',
]);

const VALID_BENEFICIARY_CLASSES: ReadonlySet<BeneficiaryClass> = new Set<BeneficiaryClass>([
  'PRIMARY',
  'GENERAL',
  'DEFAULT',
  'NAMED',
  'RESIDUARY',
  'SPECIFIC_GIFT',
  'LIFE_TENANT',
  'REMAINDERMAN',
]);

/** Map a service validation error to its HTTP status. */
function statusForRelationshipError(code: RelationshipValidationError['code']): number {
  switch (code) {
    case 'ENTITY_NOT_FOUND':
    case 'RELATIONSHIP_NOT_FOUND':
      return 404;
    case 'DUPLICATE_EDGE':
      return 409;
    case 'IMPOSSIBLE_EDGE':
      return 400;
    default:
      return 400;
  }
}

export const GET = withPermission('entity.read', async (_request: NextRequest, auth) => {
  try {
    const relationships = await listRelationships(auth.userId);
    return NextResponse.json({
      data: relationships,
      _meta: { count: relationships.length },
    });
  } catch (error) {
    console.error('List relationships error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list relationships.';
    return NextResponse.json(
      { error: { code: 'RELATIONSHIPS_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateRelationshipBody {
  fromEntityId?: unknown;
  toEntityId?: unknown;
  type?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  beneficiaryClass?: unknown;
  partnerInterestPct?: unknown;
  partnerCapitalAmount?: unknown;
  familyRelation?: unknown;
  lprReason?: unknown;
  appointorPower?: unknown;
  powerType?: unknown;
  powerSubject?: unknown;
  tfnQuoted?: unknown;
  notes?: unknown;
}

/** Parse an optional ISO date string. Returns `undefined` if absent, throws on a bad value. */
function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO date string.`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date.`);
  return d;
}

export const POST = withPermission('entity.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateRelationshipBody;

    // -- Validate at the boundary (CLAUDE.md §12.5) --------------------------
    const fromEntityId = typeof body.fromEntityId === 'string' ? body.fromEntityId : '';
    const toEntityId = typeof body.toEntityId === 'string' ? body.toEntityId : '';
    if (!fromEntityId || !toEntityId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'fromEntityId and toEntityId are required.' } },
        { status: 400 },
      );
    }
    if (fromEntityId === toEntityId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'An entity cannot hold a relationship to itself.' } },
        { status: 400 },
      );
    }

    const type = body.type as EntityRelationshipType;
    if (!VALID_RELATIONSHIP_TYPES.has(type)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'type is not a valid relationship type.' } },
        { status: 400 },
      );
    }

    if (
      body.beneficiaryClass !== undefined &&
      body.beneficiaryClass !== null &&
      !VALID_BENEFICIARY_CLASSES.has(body.beneficiaryClass as BeneficiaryClass)
    ) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'beneficiaryClass is not a valid value.' } },
        { status: 400 },
      );
    }

    let effectiveFrom: Date | undefined;
    let effectiveTo: Date | undefined;
    try {
      effectiveFrom = parseOptionalDate(body.effectiveFrom, 'effectiveFrom');
      effectiveTo = parseOptionalDate(body.effectiveTo, 'effectiveTo');
    } catch (dateError) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: dateError instanceof Error ? dateError.message : 'Invalid date.',
          },
        },
        { status: 400 },
      );
    }

    const input: CreateRelationshipInput = {
      fromEntityId,
      toEntityId,
      type,
      effectiveFrom,
      effectiveTo: effectiveTo ?? null,
      beneficiaryClass: (body.beneficiaryClass as BeneficiaryClass | undefined) ?? null,
      partnerInterestPct:
        typeof body.partnerInterestPct === 'number' ? body.partnerInterestPct : null,
      partnerCapitalAmount:
        typeof body.partnerCapitalAmount === 'number' ? body.partnerCapitalAmount : null,
      familyRelation: typeof body.familyRelation === 'string' ? body.familyRelation : null,
      lprReason: typeof body.lprReason === 'string' ? body.lprReason : null,
      appointorPower: Array.isArray(body.appointorPower)
        ? body.appointorPower.filter((p): p is string => typeof p === 'string')
        : [],
      powerType: typeof body.powerType === 'string' ? body.powerType : null,
      powerSubject: typeof body.powerSubject === 'string' ? body.powerSubject : null,
      tfnQuoted: typeof body.tfnQuoted === 'boolean' ? body.tfnQuoted : null,
      notes: typeof body.notes === 'string' && body.notes.trim().length > 0 ? body.notes.trim() : null,
    };

    const result = await createRelationship(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof RelationshipValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.issues } },
        { status: statusForRelationshipError(error.code) },
      );
    }
    console.error('Create relationship error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create relationship.';
    return NextResponse.json(
      { error: { code: 'RELATIONSHIP_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
