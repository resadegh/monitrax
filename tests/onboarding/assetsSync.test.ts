/**
 * Phase 12 Track F.7 — assets two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffAssets` is the pure core that guarantees this. These tests also
 * cover the asset+expenses aggregate nesting and the F.7 quality guards.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffAssets,
  wizardAssetsToSnapshot,
  snapshotToWizardAssets,
  isPersistedId,
  EMPTY_ASSETS_SNAPSHOT,
  type AssetsSnapshot,
} from '@/lib/onboarding/assetsSync';
import type { AssetInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — a vehicle (with a running cost) +
// a non-vehicle collectible.
const persistedSnapshot: AssetsSnapshot = {
  assets: [
    {
      id: 'uuid-car',
      name: '2021 Mazda CX-5',
      type: 'VEHICLE',
      purchasePrice: 38000,
      currentValue: 29000,
      purchaseDate: '2021-08-01',
      vehicleMake: 'Mazda',
      vehicleModel: 'CX-5',
      vehicleYear: 2021,
      expenses: [
        {
          id: 'uuid-rego',
          name: 'Registration',
          category: 'OTHER',
          amount: 900,
          frequency: 'ANNUAL',
        },
      ],
    },
    {
      id: 'uuid-art',
      name: 'Artwork',
      type: 'COLLECTIBLE',
      purchasePrice: 4000,
      currentValue: 6000,
      purchaseDate: '2019-02-10',
      expenses: [],
    },
  ],
};

describe('diffAssets — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    expect(diffAssets(persistedSnapshot, persistedSnapshot).assetOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizard = snapshotToWizardAssets(persistedSnapshot);
    const current = wizardAssetsToSnapshot(wizard);
    expect(diffAssets(persistedSnapshot, current).assetOps).toEqual([]);
  });

  it('classifies a brand-new asset (no id) as CREATE with expense creates', () => {
    const current: AssetsSnapshot = {
      assets: [
        ...persistedSnapshot.assets,
        {
          name: 'Laptop',
          type: 'ELECTRONICS',
          purchasePrice: 2400,
          currentValue: 1500,
          purchaseDate: '2024-03-01',
          expenses: [
            { name: 'AppleCare', category: 'OTHER', amount: 200, frequency: 'ANNUAL' },
          ],
        },
      ],
    };
    const diff = diffAssets(persistedSnapshot, current);
    expect(diff.assetOps).toHaveLength(1);
    const op = diff.assetOps[0];
    expect(op.op).toBe('create');
    expect(op.id).toBeUndefined();
    expect(op.expenseOps).toHaveLength(1);
    expect(op.expenseOps[0].op).toBe('create');
  });

  it('classifies an edited asset core as UPDATE (keeps the id)', () => {
    const current: AssetsSnapshot = {
      assets: persistedSnapshot.assets.map((a) =>
        a.id === 'uuid-car' ? { ...a, currentValue: 27000 } : a,
      ),
    };
    const diff = diffAssets(persistedSnapshot, current);
    expect(diff.assetOps).toHaveLength(1);
    expect(diff.assetOps[0]).toMatchObject({ op: 'update', id: 'uuid-car', coreChanged: true });
  });

  it('classifies a removed asset as DELETE with its expenses deleted first', () => {
    const current: AssetsSnapshot = {
      assets: persistedSnapshot.assets.filter((a) => a.id !== 'uuid-car'),
    };
    const diff = diffAssets(persistedSnapshot, current);
    expect(diff.assetOps).toHaveLength(1);
    const op = diff.assetOps[0];
    expect(op).toMatchObject({ op: 'delete', id: 'uuid-car' });
    // Expense.asset is onDelete:SetNull — the expense must be deleted too.
    expect(op.expenseOps).toEqual([
      expect.objectContaining({ op: 'delete', id: 'uuid-rego' }),
    ]);
  });

  it('detects an expense change as a core-unchanged asset UPDATE', () => {
    const current: AssetsSnapshot = {
      assets: persistedSnapshot.assets.map((a) =>
        a.id === 'uuid-car'
          ? {
              ...a,
              expenses: [
                { ...a.expenses[0], amount: 1000 }, // rego changed → update
                { name: 'Insurance', category: 'INSURANCE', amount: 1400, frequency: 'ANNUAL' },
              ],
            }
          : a,
      ),
    };
    const diff = diffAssets(persistedSnapshot, current);
    const op = diff.assetOps[0];
    expect(op).toMatchObject({ op: 'update', coreChanged: false });
    const byOp = (o: string) => op.expenseOps.filter((x) => x.op === o);
    expect(byOp('create')).toHaveLength(1);
    expect(byOp('update')).toHaveLength(1);
    expect(byOp('update')[0].id).toBe('uuid-rego');
  });

  it('produces ZERO ops for a first-ever empty list', () => {
    expect(diffAssets(EMPTY_ASSETS_SNAPSHOT, EMPTY_ASSETS_SNAPSHOT).assetOps).toEqual([]);
  });
});

describe('wizardAssetsToSnapshot — quality guards', () => {
  function wizardAsset(over: Partial<AssetInput>): AssetInput {
    return {
      id: 'uuid-x',
      name: 'An asset',
      type: 'ELECTRONICS',
      purchasePrice: 1000,
      currentValue: 800,
      purchaseDate: '2023-01-01',
      expenses: [],
      ...over,
    };
  }

  it('drops an expense with amount <= 0', () => {
    const snap = wizardAssetsToSnapshot([
      wizardAsset({
        expenses: [
          { id: 'temp_e1', name: 'Real', category: 'OTHER', amount: 500, frequency: 'ANNUAL' },
          { id: 'temp_e2', name: 'Empty', category: 'OTHER', amount: 0, frequency: 'ANNUAL' },
        ],
      }),
    ]);
    expect(snap.assets[0].expenses).toHaveLength(1);
    expect(snap.assets[0].expenses[0].name).toBe('Real');
  });

  it('drops an unpersisted asset with no purchase date (incomplete in-session card)', () => {
    const snap = wizardAssetsToSnapshot([
      wizardAsset({ id: 'temp_asset_1', purchaseDate: undefined }),
    ]);
    expect(snap.assets).toHaveLength(0);
  });

  it('KEEPS a persisted asset even if its purchase date was blanked', () => {
    const snap = wizardAssetsToSnapshot([
      wizardAsset({ id: 'uuid-real', purchaseDate: '' }),
    ]);
    expect(snap.assets).toHaveLength(1);
    expect(snap.assets[0].id).toBe('uuid-real');
  });
});

describe('isPersistedId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_asset_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-asset-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
