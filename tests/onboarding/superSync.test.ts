/**
 * Phase 12 Track F.6 — superannuation two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffSuper` is the pure core that guarantees this.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffSuper,
  wizardSuperToSnapshot,
  snapshotToWizardSuper,
  isPersistedId,
  EMPTY_SUPER_SNAPSHOT,
  type SuperSnapshot,
} from '@/lib/onboarding/superSync';
import type { SuperAccountInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — a single super account.
const persistedSnapshot: SuperSnapshot = {
  accounts: [
    {
      id: 'uuid-super',
      name: 'My Super',
      fundName: 'AustralianSuper',
      currentBalance: 145000,
    },
  ],
};

describe('diffSuper — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    expect(diffSuper(persistedSnapshot, persistedSnapshot).accountOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizard = snapshotToWizardSuper(persistedSnapshot);
    const current = wizardSuperToSnapshot(wizard);
    expect(diffSuper(persistedSnapshot, current).accountOps).toEqual([]);
  });

  it('classifies a brand-new account (no id) as CREATE', () => {
    const current: SuperSnapshot = {
      accounts: [
        ...persistedSnapshot.accounts,
        { name: 'SMSF', fundName: 'My SMSF', currentBalance: 320000 },
      ],
    };
    const diff = diffSuper(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'create' });
    expect(diff.accountOps[0].id).toBeUndefined();
    expect(diff.accountOps[0].record.fundName).toBe('My SMSF');
  });

  it('classifies an edited account as UPDATE (keeps the id)', () => {
    const current: SuperSnapshot = {
      accounts: persistedSnapshot.accounts.map((s) => ({ ...s, currentBalance: 150000 })),
    };
    const diff = diffSuper(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'update', id: 'uuid-super' });
  });

  it('classifies a removed account as DELETE', () => {
    const diff = diffSuper(persistedSnapshot, EMPTY_SUPER_SNAPSHOT);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'delete', id: 'uuid-super' });
  });

  it('produces ZERO ops for a first-ever empty list', () => {
    expect(diffSuper(EMPTY_SUPER_SNAPSHOT, EMPTY_SUPER_SNAPSHOT).accountOps).toEqual([]);
  });
});

describe('wizardSuperToSnapshot — quality guard', () => {
  function wizardSuper(over: Partial<SuperAccountInput>): SuperAccountInput {
    return {
      id: 'uuid-x',
      name: 'My Super',
      fundName: 'AustralianSuper',
      currentBalance: 50000,
      ...over,
    };
  }

  it('drops an unpersisted account with no fund name AND 0 balance', () => {
    const snap = wizardSuperToSnapshot([
      wizardSuper({ id: 'temp_super_1', fundName: '', currentBalance: 0 }),
    ]);
    expect(snap.accounts).toHaveLength(0);
  });

  it('keeps an unpersisted account that has a fund name', () => {
    const snap = wizardSuperToSnapshot([
      wizardSuper({ id: 'temp_super_2', fundName: 'HESTA', currentBalance: 0 }),
    ]);
    expect(snap.accounts).toHaveLength(1);
  });

  it('keeps an unpersisted account that has a balance', () => {
    const snap = wizardSuperToSnapshot([
      wizardSuper({ id: 'temp_super_3', fundName: '', currentBalance: 1000 }),
    ]);
    expect(snap.accounts).toHaveLength(1);
  });

  it('KEEPS a persisted account even if its fields were blanked (never silently deletes)', () => {
    const snap = wizardSuperToSnapshot([
      wizardSuper({ id: 'uuid-real', fundName: '', currentBalance: 0 }),
    ]);
    expect(snap.accounts).toHaveLength(1);
    expect(snap.accounts[0].id).toBe('uuid-real');
  });
});

describe('isPersistedId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_super_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-super-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
