/**
 * Phase 12 Track F.3 — accounts two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffAccounts` is the pure core that guarantees this. These tests also
 * cover the F.3-specific rule: BASIQ / IMPORT accounts are NEVER written by
 * the wizard sync (they are owned by their source) — only MANUAL accounts
 * produce ops.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffAccounts,
  wizardAccountsToSnapshot,
  snapshotToWizardAccounts,
  isPersistedId,
  accountRealId,
  EMPTY_ACCOUNTS_SNAPSHOT,
  type AccountsSnapshot,
} from '@/lib/onboarding/accountsSync';
import type { AccountInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — two MANUAL accounts (one offset, linked
// to a property mortgage) + one BASIQ account from an Open Banking connect.
const persistedSnapshot: AccountsSnapshot = {
  accounts: [
    {
      id: 'uuid-txn',
      name: 'Everyday',
      type: 'TRANSACTIONAL',
      institution: 'CBA',
      currentBalance: 3200,
      source: 'MANUAL',
    },
    {
      id: 'uuid-offset',
      name: 'Offset',
      type: 'OFFSET',
      institution: 'ANZ',
      currentBalance: 45000,
      linkedLoanId: 'uuid-loan',
      source: 'MANUAL',
    },
    {
      id: 'uuid-basiq',
      name: 'ING Savings',
      type: 'SAVINGS',
      institution: 'ING',
      currentBalance: 12000,
      source: 'BASIQ',
    },
  ],
};

describe('diffAccounts — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    expect(diffAccounts(persistedSnapshot, persistedSnapshot).accountOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizardAccounts = snapshotToWizardAccounts(persistedSnapshot);
    const current = wizardAccountsToSnapshot(wizardAccounts);
    expect(diffAccounts(persistedSnapshot, current).accountOps).toEqual([]);
  });

  it('classifies a brand-new MANUAL account (no id) as CREATE', () => {
    const current: AccountsSnapshot = {
      accounts: [
        ...persistedSnapshot.accounts,
        {
          name: 'Holiday fund',
          type: 'SAVINGS',
          institution: 'UBank',
          currentBalance: 5000,
          source: 'MANUAL',
        },
      ],
    };
    const diff = diffAccounts(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'create' });
    expect(diff.accountOps[0].id).toBeUndefined();
    expect(diff.accountOps[0].record.name).toBe('Holiday fund');
  });

  it('classifies an edited MANUAL account as UPDATE (keeps the id)', () => {
    const current: AccountsSnapshot = {
      accounts: persistedSnapshot.accounts.map((a) =>
        a.id === 'uuid-txn' ? { ...a, currentBalance: 3500 } : a,
      ),
    };
    const diff = diffAccounts(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'update', id: 'uuid-txn' });
  });

  it('classifies a removed MANUAL account as DELETE', () => {
    const current: AccountsSnapshot = {
      accounts: persistedSnapshot.accounts.filter((a) => a.id !== 'uuid-txn'),
    };
    const diff = diffAccounts(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'delete', id: 'uuid-txn' });
  });

  it('detects an offset re-link as an UPDATE', () => {
    const current: AccountsSnapshot = {
      accounts: persistedSnapshot.accounts.map((a) =>
        a.id === 'uuid-offset' ? { ...a, linkedLoanId: 'uuid-other-loan' } : a,
      ),
    };
    const diff = diffAccounts(persistedSnapshot, current);
    expect(diff.accountOps).toHaveLength(1);
    expect(diff.accountOps[0]).toMatchObject({ op: 'update', id: 'uuid-offset' });
  });

  it('produces ZERO ops for a first-ever empty account list', () => {
    expect(
      diffAccounts(EMPTY_ACCOUNTS_SNAPSHOT, EMPTY_ACCOUNTS_SNAPSHOT).accountOps,
    ).toEqual([]);
  });
});

describe('diffAccounts — BASIQ / IMPORT accounts are never written', () => {
  it('produces NO op when a BASIQ account is edited (externally owned)', () => {
    const current: AccountsSnapshot = {
      accounts: persistedSnapshot.accounts.map((a) =>
        a.id === 'uuid-basiq' ? { ...a, name: 'Renamed', currentBalance: 99999 } : a,
      ),
    };
    expect(diffAccounts(persistedSnapshot, current).accountOps).toEqual([]);
  });

  it('produces NO delete when a BASIQ account is removed from the wizard', () => {
    const current: AccountsSnapshot = {
      accounts: persistedSnapshot.accounts.filter((a) => a.id !== 'uuid-basiq'),
    };
    expect(diffAccounts(persistedSnapshot, current).accountOps).toEqual([]);
  });

  it('never CREATEs an IMPORT account even if it has no id', () => {
    const current: AccountsSnapshot = {
      accounts: [
        {
          name: 'Imported account',
          type: 'TRANSACTIONAL',
          institution: 'NAB',
          currentBalance: 800,
          source: 'IMPORT',
        },
      ],
    };
    expect(diffAccounts(EMPTY_ACCOUNTS_SNAPSHOT, current).accountOps).toEqual([]);
  });
});

describe('wizardAccountsToSnapshot — quality guard + id resolution', () => {
  function wizardAccount(over: Partial<AccountInput>): AccountInput {
    return {
      id: 'uuid-x',
      name: 'An account',
      type: 'SAVINGS',
      currentBalance: 1000,
      ...over,
    };
  }

  it('drops an unpersisted MANUAL account with no name (incomplete in-session card)', () => {
    const snap = wizardAccountsToSnapshot([
      wizardAccount({ id: 'temp_acct_1', name: '' }),
    ]);
    expect(snap.accounts).toHaveLength(0);
  });

  it('KEEPS a persisted account even if its name was blanked (never silently deletes)', () => {
    const snap = wizardAccountsToSnapshot([
      wizardAccount({ id: 'uuid-real', name: '' }),
    ]);
    expect(snap.accounts).toHaveLength(1);
    expect(snap.accounts[0].id).toBe('uuid-real');
  });

  it('recovers a BASIQ account real id from existingAccountId', () => {
    const snap = wizardAccountsToSnapshot([
      wizardAccount({
        id: 'temp_acct_basiq',
        existingAccountId: 'uuid-basiq-real',
        source: 'BASIQ',
      }),
    ]);
    expect(snap.accounts[0].id).toBe('uuid-basiq-real');
    expect(snap.accounts[0].source).toBe('BASIQ');
  });
});

describe('isPersistedId / accountRealId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_acct_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-acct-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });

  it('accountRealId resolves a synced MANUAL account from id', () => {
    expect(
      accountRealId({
        id: 'uuid-real',
        name: 'A',
        type: 'SAVINGS',
        currentBalance: 0,
      }),
    ).toBe('uuid-real');
  });

  it('accountRealId resolves a BASIQ account from existingAccountId', () => {
    expect(
      accountRealId({
        id: 'temp_acct_x',
        existingAccountId: 'uuid-basiq',
        source: 'BASIQ',
        name: 'A',
        type: 'SAVINGS',
        currentBalance: 0,
      }),
    ).toBe('uuid-basiq');
  });

  it('accountRealId returns undefined for a never-persisted MANUAL account', () => {
    expect(
      accountRealId({
        id: 'temp_acct_x',
        name: 'A',
        type: 'SAVINGS',
        currentBalance: 0,
      }),
    ).toBeUndefined();
  });
});
