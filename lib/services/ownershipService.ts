/**
 * Phase 44 Part 1b-ii — joint / shared ownership service (SSOT writer).
 *
 * The ONLY writer of `OwnershipGroup` / `OwnershipStake`. These answer
 * "who owns this *asset*" (a property, loan, account) — as distinct from
 * `EntityRelationship` ("who owns this *entity's equity*") and
 * `BeneficialOwnershipOverride` ("legal title ≠ beneficial owner for
 * this specific asset"). The build keeps the three crisp (§3A, §7 note).
 *
 * Joint tenancy is NOT fractional ownership — it carries survivorship
 * (corrected v3, §7). `survivorshipApplies` is stored per stake so the
 * estate engine knows not to pass a joint interest through a deceased
 * estate. No tax or financial arithmetic here (§8.3).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, TenancyType } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

/** Tolerance for a tenants-in-common share split summing to 100% (Decimal rounding). */
const SHARE_SUM_TOLERANCE = 0.01;

export type OwnershipErrorCode =
  | 'NO_STAKES'
  | 'ENTITY_NOT_FOUND'
  | 'SOLE_TENANCY_STAKE_COUNT'
  | 'JOINT_TENANCY_STAKE_COUNT'
  | 'GROUP_NOT_FOUND';

export class OwnershipValidationError extends Error {
  constructor(public readonly code: OwnershipErrorCode, message: string) {
    super(message);
    this.name = 'OwnershipValidationError';
  }
}

export interface OwnershipStakeInput {
  entityId: string;
  /** Required + must sum to ~100 for TENANTS_IN_COMMON; reporting-only for JOINT_TENANTS. */
  sharePct?: number | null;
  survivorshipApplies?: boolean;
  notes?: string | null;
}

export interface CreateOwnershipGroupInput {
  /** 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset' */
  ownedObjectType: string;
  ownedObjectId: string;
  tenancyType: TenancyType;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  stakes: OwnershipStakeInput[];
}

export interface OwnershipWriteResult {
  ownershipGroupId: string;
  /** Non-fatal data-quality flags — the group is recorded regardless (digital twin, §9). */
  warnings: string[];
}

/**
 * Pure data-quality check for a set of stakes against the tenancy type.
 * Returns warnings only — the caller throws separately for the hard,
 * data-model-impossible cases (wrong stake count). A tenants-in-common
 * split that does not sum to 100% is RECORDED and flagged, not rejected.
 */
export function validateOwnershipStakes(
  tenancyType: TenancyType,
  stakes: OwnershipStakeInput[],
): string[] {
  const warnings: string[] = [];
  if (tenancyType === 'TENANTS_IN_COMMON') {
    const missingPct = stakes.some((s) => s.sharePct === undefined || s.sharePct === null);
    if (missingPct) {
      warnings.push('One or more tenants-in-common stakes have no ownership percentage.');
    } else {
      const sum = stakes.reduce((acc, s) => acc + (s.sharePct ?? 0), 0);
      if (Math.abs(sum - 100) > SHARE_SUM_TOLERANCE) {
        warnings.push(`Tenants-in-common shares sum to ${sum}%, not 100%.`);
      }
    }
  }
  if (tenancyType === 'JOINT_TENANTS') {
    if (stakes.some((s) => s.survivorshipApplies === false)) {
      warnings.push(
        'A joint-tenancy stake is recorded without survivorship — joint tenancy carries right of survivorship by definition.',
      );
    }
  }
  return warnings;
}

/**
 * Create an `OwnershipGroup` and its `OwnershipStake` rows in one
 * transaction. Hard-rejects only the data-model-impossible cases
 * (no stakes, wrong stake count for the tenancy type, an entity not
 * owned by the user). Soft data-quality issues are returned as warnings.
 */
export async function createOwnershipGroup(
  userId: string,
  input: CreateOwnershipGroupInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<OwnershipWriteResult> {
  if (input.stakes.length === 0) {
    throw new OwnershipValidationError('NO_STAKES', 'An ownership group needs at least one owner.');
  }
  if (input.tenancyType === 'SOLE' && input.stakes.length !== 1) {
    throw new OwnershipValidationError(
      'SOLE_TENANCY_STAKE_COUNT',
      'Sole ownership must have exactly one owner.',
    );
  }
  if (input.tenancyType === 'JOINT_TENANTS' && input.stakes.length < 2) {
    throw new OwnershipValidationError(
      'JOINT_TENANCY_STAKE_COUNT',
      'Joint tenancy needs at least two owners.',
    );
  }

  const warnings = validateOwnershipStakes(input.tenancyType, input.stakes);

  const groupId = await prisma.$transaction(async (tx) => {
    // Every stake's entity must belong to the calling user.
    const entityIds = [...new Set(input.stakes.map((s) => s.entityId))];
    const owned = await tx.legalEntity.count({
      where: { id: { in: entityIds }, userId },
    });
    if (owned !== entityIds.length) {
      throw new OwnershipValidationError(
        'ENTITY_NOT_FOUND',
        'One or more owners do not exist or are not owned by you.',
      );
    }

    const group = await tx.ownershipGroup.create({
      data: {
        userId,
        ownedObjectType: input.ownedObjectType,
        ownedObjectId: input.ownedObjectId,
        tenancyType: input.tenancyType,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        effectiveTo: input.effectiveTo ?? null,
        stakes: {
          create: input.stakes.map((s) => ({
            entityId: s.entityId,
            sharePct: s.sharePct ?? null,
            survivorshipApplies:
              s.survivorshipApplies ?? input.tenancyType === 'JOINT_TENANTS',
            notes: s.notes ?? null,
          })),
        },
      },
      select: { id: true },
    });
    return group.id;
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'OwnershipGroup',
    entityId: groupId,
    metadata: { tenancyType: input.tenancyType, stakeCount: input.stakes.length },
    ...requestMeta,
  }).catch(() => {});

  return { ownershipGroupId: groupId, warnings };
}

/** End an `OwnershipGroup` by setting `effectiveTo` (ownership changed hands). */
export async function endOwnershipGroup(
  userId: string,
  ownershipGroupId: string,
  effectiveTo: Date,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.ownershipGroup.findFirst({
    where: { id: ownershipGroupId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new OwnershipValidationError(
      'GROUP_NOT_FOUND',
      'Ownership group not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write; `effectiveTo` only.
  await prisma.ownershipGroup.update({
    where: { id: ownershipGroupId, userId },
    data: { effectiveTo },
  });
  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'OwnershipGroup',
    entityId: ownershipGroupId,
    metadata: { ended: true },
    ...requestMeta,
  }).catch(() => {});
}

/** Hard-delete an `OwnershipGroup` (mistaken entry). Stakes cascade-delete. */
export async function deleteOwnershipGroup(
  userId: string,
  ownershipGroupId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.ownershipGroup.findFirst({
    where: { id: ownershipGroupId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new OwnershipValidationError(
      'GROUP_NOT_FOUND',
      'Ownership group not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's group.
  await prisma.ownershipGroup.delete({ where: { id: ownershipGroupId, userId } });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'OwnershipGroup',
    entityId: ownershipGroupId,
    ...requestMeta,
  }).catch(() => {});
}

export interface OwnershipGroupSummary {
  id: string;
  ownedObjectType: string;
  ownedObjectId: string;
  tenancyType: TenancyType;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  stakes: {
    id: string;
    entityId: string;
    entityName: string;
    sharePct: number | null;
    survivorshipApplies: boolean;
  }[];
}

/** List a user's ownership groups, optionally filtered to one owned object. */
export async function listOwnershipGroups(
  userId: string,
  filter?: { ownedObjectType: string; ownedObjectId: string },
  client: PrismaTxOrClient = prisma,
): Promise<OwnershipGroupSummary[]> {
  const rows = await client.ownershipGroup.findMany({
    where: {
      userId,
      ...(filter && {
        ownedObjectType: filter.ownedObjectType,
        ownedObjectId: filter.ownedObjectId,
      }),
    },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      ownedObjectType: true,
      ownedObjectId: true,
      tenancyType: true,
      effectiveFrom: true,
      effectiveTo: true,
      stakes: {
        select: {
          id: true,
          entityId: true,
          sharePct: true,
          survivorshipApplies: true,
          entity: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((g) => ({
    id: g.id,
    ownedObjectType: g.ownedObjectType,
    ownedObjectId: g.ownedObjectId,
    tenancyType: g.tenancyType,
    effectiveFrom: g.effectiveFrom,
    effectiveTo: g.effectiveTo,
    stakes: g.stakes.map((s) => ({
      id: s.id,
      entityId: s.entityId,
      entityName: s.entity.name,
      sharePct: s.sharePct === null ? null : Number(s.sharePct),
      survivorshipApplies: s.survivorshipApplies,
    })),
  }));
}
