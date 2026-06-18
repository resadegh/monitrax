/**
 * Phase 3 fix PR2 (audit L2-2) — asset-ownership cleanup on delete.
 *
 * `OwnershipGroup` / `BeneficialOwnershipOverride` reference assets
 * polymorphically (no DB FK), so the asset-delete handlers must clean them up
 * in-transaction. These tests pin the cleanup contract without a live DB by
 * passing a fake transaction client and asserting:
 *   - both ownership tables are cleaned for the asset,
 *   - the `where` is confined to the user + this exact asset (§12.11),
 *   - counts are aggregated and returned,
 *   - the common sole-owned case (0 rows) is a no-op result.
 *
 * The OwnershipStake cascade (stake → group, onDelete: Cascade) is a DB-level
 * FK verified by the schema/migration; it is not re-tested here.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  cleanupAssetOwnership,
  type OwnedObjectType,
} from '@/lib/services/assetOwnershipCleanup';

function makeClient(groupCount: number, overrideCount: number) {
  const ownershipDeleteMany = vi.fn().mockResolvedValue({ count: groupCount });
  const overrideDeleteMany = vi.fn().mockResolvedValue({ count: overrideCount });
  const client = {
    ownershipGroup: { deleteMany: ownershipDeleteMany },
    beneficialOwnershipOverride: { deleteMany: overrideDeleteMany },
  } as any;
  return { client, ownershipDeleteMany, overrideDeleteMany };
}

describe('cleanupAssetOwnership', () => {
  it('deletes from BOTH ownership tables, scoped to user + asset (§12.11)', async () => {
    const { client, ownershipDeleteMany, overrideDeleteMany } = makeClient(2, 1);

    const result = await cleanupAssetOwnership(client, {
      userId: 'user-1',
      ownedObjectType: 'property',
      ownedObjectId: 'prop-9',
    });

    const expectedWhere = {
      where: { userId: 'user-1', ownedObjectType: 'property', ownedObjectId: 'prop-9' },
    };
    expect(ownershipDeleteMany).toHaveBeenCalledTimes(1);
    expect(ownershipDeleteMany).toHaveBeenCalledWith(expectedWhere);
    expect(overrideDeleteMany).toHaveBeenCalledTimes(1);
    expect(overrideDeleteMany).toHaveBeenCalledWith(expectedWhere);
    expect(result).toEqual({ ownershipGroupsDeleted: 2, beneficialOverridesDeleted: 1 });
  });

  it('sole-owned asset (no ownership rows) → both counts 0, still both tables checked', async () => {
    const { client, ownershipDeleteMany, overrideDeleteMany } = makeClient(0, 0);

    const result = await cleanupAssetOwnership(client, {
      userId: 'user-1',
      ownedObjectType: 'account',
      ownedObjectId: 'acc-1',
    });

    expect(result).toEqual({ ownershipGroupsDeleted: 0, beneficialOverridesDeleted: 0 });
    expect(ownershipDeleteMany).toHaveBeenCalledOnce();
    expect(overrideDeleteMany).toHaveBeenCalledOnce();
  });

  it.each<OwnedObjectType>(['property', 'loan', 'account', 'investmentAccount', 'asset'])(
    'passes through ownedObjectType=%s unchanged to both deletes',
    async (type) => {
      const { client, ownershipDeleteMany, overrideDeleteMany } = makeClient(1, 0);

      await cleanupAssetOwnership(client, {
        userId: 'u',
        ownedObjectType: type,
        ownedObjectId: 'x',
      });

      const where = { where: { userId: 'u', ownedObjectType: type, ownedObjectId: 'x' } };
      expect(ownershipDeleteMany).toHaveBeenCalledWith(where);
      expect(overrideDeleteMany).toHaveBeenCalledWith(where);
    },
  );
});
