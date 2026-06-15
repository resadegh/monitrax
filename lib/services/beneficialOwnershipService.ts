/**
 * Phase 44 Part 1b-ii — beneficial-ownership-override service (SSOT writer).
 *
 * The ONLY writer of `BeneficialOwnershipOverride`. Legal title equals
 * beneficial ownership UNLESS an override says otherwise — a nominee, a
 * bare trust, a custodian (§3A). Overrides are asset-scoped: they attach
 * to a specific share parcel / property / holding, never broadly to an
 * entity (which is why the §5 `NOMINEE_FOR` edge was removed). The
 * graph's `resolveBeneficialOwner()` reads these rows.
 *
 * No tax or financial arithmetic here (§8.3) — the tax engine reads the
 * resolved beneficial owner; this service only records who it is.
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, BeneficialOwnershipBasis } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

export type BeneficialOwnershipErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'SAME_OWNER'
  | 'OVERRIDE_NOT_FOUND';

export class BeneficialOwnershipValidationError extends Error {
  constructor(public readonly code: BeneficialOwnershipErrorCode, message: string) {
    super(message);
    this.name = 'BeneficialOwnershipValidationError';
  }
}

export interface CreateBeneficialOwnershipInput {
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  /** 'asset' | 'shareParcel' | 'ownershipStake' | 'investmentHolding' */
  ownedObjectType: string;
  ownedObjectId: string;
  basis: BeneficialOwnershipBasis;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  sourceDocumentId?: string | null;
}

/**
 * Record that legal title and beneficial ownership differ for a specific
 * asset. Rejects only the impossible cases — an entity not owned by the
 * user, or a legal owner equal to the beneficial owner (an override that
 * overrides nothing).
 */
export async function createBeneficialOwnershipOverride(
  userId: string,
  input: CreateBeneficialOwnershipInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  if (input.legalOwnerEntityId === input.beneficialOwnerEntityId) {
    throw new BeneficialOwnershipValidationError(
      'SAME_OWNER',
      'The legal owner and the beneficial owner are the same entity — no override is needed.',
    );
  }

  const owned = await prisma.legalEntity.count({
    where: {
      id: { in: [input.legalOwnerEntityId, input.beneficialOwnerEntityId] },
      userId,
    },
  });
  if (owned !== 2) {
    throw new BeneficialOwnershipValidationError(
      'ENTITY_NOT_FOUND',
      'The legal owner or beneficial owner does not exist or is not owned by you.',
    );
  }

  const created = await prisma.beneficialOwnershipOverride.create({
    data: {
      userId,
      legalOwnerEntityId: input.legalOwnerEntityId,
      beneficialOwnerEntityId: input.beneficialOwnerEntityId,
      ownedObjectType: input.ownedObjectType,
      ownedObjectId: input.ownedObjectId,
      basis: input.basis,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      effectiveTo: input.effectiveTo ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
    },
    select: { id: true },
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'BeneficialOwnershipOverride',
    entityId: created.id,
    metadata: { basis: input.basis, ownedObjectType: input.ownedObjectType },
    ...requestMeta,
  }).catch(() => {});

  return created.id;
}

/** End an override by setting `effectiveTo` (the nominee arrangement unwound). */
export async function endBeneficialOwnershipOverride(
  userId: string,
  overrideId: string,
  effectiveTo: Date,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.beneficialOwnershipOverride.findFirst({
    where: { id: overrideId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new BeneficialOwnershipValidationError(
      'OVERRIDE_NOT_FOUND',
      'Beneficial-ownership override not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write; `effectiveTo` only.
  await prisma.beneficialOwnershipOverride.update({
    where: { id: overrideId, userId },
    data: { effectiveTo },
  });
  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'BeneficialOwnershipOverride',
    entityId: overrideId,
    metadata: { ended: true },
    ...requestMeta,
  }).catch(() => {});
}

/** Hard-delete an override (mistaken entry). */
export async function deleteBeneficialOwnershipOverride(
  userId: string,
  overrideId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.beneficialOwnershipOverride.findFirst({
    where: { id: overrideId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new BeneficialOwnershipValidationError(
      'OVERRIDE_NOT_FOUND',
      'Beneficial-ownership override not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's override.
  await prisma.beneficialOwnershipOverride.delete({ where: { id: overrideId, userId } });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'BeneficialOwnershipOverride',
    entityId: overrideId,
    ...requestMeta,
  }).catch(() => {});
}

/**
 * Phase 3 fix PR2 (audit L2-2) — delete EVERY `BeneficialOwnershipOverride`
 * referencing a given asset, for cleanup when that asset is deleted. Like
 * `OwnershipGroup`, overrides point at assets polymorphically with no DB FK, so
 * the owning asset's delete handler must call this (no cascade otherwise).
 *
 * Accepts a transaction client so the cleanup is atomic with the asset delete.
 * Returns the number of overrides removed. §12.11: the composite `where`
 * confines the delete to the caller's rows for exactly this asset.
 */
export async function deleteBeneficialOverridesForAsset(
  client: PrismaTxOrClient,
  userId: string,
  ownedObjectType: string,
  ownedObjectId: string,
): Promise<number> {
  const result = await client.beneficialOwnershipOverride.deleteMany({
    where: { userId, ownedObjectType, ownedObjectId },
  });
  return result.count;
}

export interface BeneficialOwnershipSummary {
  id: string;
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  ownedObjectType: string;
  ownedObjectId: string;
  basis: BeneficialOwnershipBasis;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  accountantVerified: boolean;
}

/** List a user's beneficial-ownership overrides. */
export async function listBeneficialOwnershipOverrides(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<BeneficialOwnershipSummary[]> {
  const rows = await client.beneficialOwnershipOverride.findMany({
    where: { userId },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      legalOwnerEntityId: true,
      beneficialOwnerEntityId: true,
      ownedObjectType: true,
      ownedObjectId: true,
      basis: true,
      effectiveFrom: true,
      effectiveTo: true,
      accountantVerified: true,
    },
  });
  return rows;
}
