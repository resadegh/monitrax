/**
 * Phase 3 fix PR2 (audit L2-2) — canonical asset-ownership cleanup.
 *
 * `OwnershipGroup` / `OwnershipStake` and `BeneficialOwnershipOverride` reference
 * assets **polymorphically** (`ownedObjectType` + `ownedObjectId`, both plain
 * strings — NOT foreign keys), so the database cannot cascade them when the
 * underlying asset (property / loan / account / investment account / personal
 * asset) is deleted. Left alone, deleting an asset orphans its ownership rows
 * (they linger pointing at a non-existent `ownedObjectId`).
 *
 * Every asset-delete handler MUST call {@link cleanupAssetOwnership} inside the
 * same transaction as the asset delete, so the asset and its ownership records
 * are removed atomically. This is the in-transaction cleanup the audit prefers
 * over a periodic orphan sweep.
 *
 * `OwnershipStake` rows cascade via their real FK to `OwnershipGroup`
 * (`onDelete: Cascade`), so removing the groups removes the stakes.
 */

import { deleteOwnershipGroupsForAsset } from './ownershipService';
import { deleteBeneficialOverridesForAsset } from './beneficialOwnershipService';
import type { PrismaClient, Prisma } from '@prisma/client';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

/** The five asset kinds that can carry polymorphic ownership rows. */
export type OwnedObjectType =
  | 'property'
  | 'loan'
  | 'account'
  | 'investmentAccount'
  | 'asset';

export interface AssetOwnershipCleanupResult {
  ownershipGroupsDeleted: number;
  beneficialOverridesDeleted: number;
}

/**
 * Remove every `OwnershipGroup` (+ cascaded stakes) and
 * `BeneficialOwnershipOverride` that references the given asset.
 *
 * @param client a Prisma transaction client (pass the `tx` from the asset
 *   delete's `$transaction`) so cleanup is atomic with the asset delete.
 * @returns counts of rows removed (both 0 for a sole-owned asset — the common case).
 */
export async function cleanupAssetOwnership(
  client: PrismaTxOrClient,
  params: { userId: string; ownedObjectType: OwnedObjectType; ownedObjectId: string },
): Promise<AssetOwnershipCleanupResult> {
  const { userId, ownedObjectType, ownedObjectId } = params;
  const ownershipGroupsDeleted = await deleteOwnershipGroupsForAsset(
    client,
    userId,
    ownedObjectType,
    ownedObjectId,
  );
  const beneficialOverridesDeleted = await deleteBeneficialOverridesForAsset(
    client,
    userId,
    ownedObjectType,
    ownedObjectId,
  );
  return { ownershipGroupsDeleted, beneficialOverridesDeleted };
}
