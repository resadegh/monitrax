/**
 * Phase 12 Track F.5 — investments two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffInvestments` is the pure core that guarantees this. These tests also
 * cover the account+holdings aggregate nesting and the F.5 quality guards.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffInvestments,
  wizardInvestmentsToSnapshot,
  snapshotToWizardInvestments,
  isPersistedId,
  EMPTY_INVESTMENTS_SNAPSHOT,
  type InvestmentsSnapshot,
} from '@/lib/onboarding/investmentsSync';
import type { InvestmentAccountInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — a brokerage account with two holdings.
const persistedSnapshot: InvestmentsSnapshot = {
  investments: [
    {
      id: 'uuid-acc',
      name: 'CommSec',
      platform: 'CommSec',
      type: 'BROKERAGE',
      cashBalance: 1500,
      holdings: [
        {
          id: 'uuid-vas',
          ticker: 'VAS',
          name: 'Vanguard Australian Shares',
          units: 100,
          averagePrice: 95,
          type: 'ETF',
        },
        {
          id: 'uuid-bhp',
          ticker: 'BHP',
          name: 'BHP Group',
          units: 50,
          averagePrice: 42,
          type: 'SHARE',
        },
      ],
    },
  ],
};

describe('diffInvestments — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    expect(diffInvestments(persistedSnapshot, persistedSnapshot).investmentOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizard = snapshotToWizardInvestments(persistedSnapshot);
    const current = wizardInvestmentsToSnapshot(wizard);
    expect(diffInvestments(persistedSnapshot, current).investmentOps).toEqual([]);
  });

  it('classifies a brand-new account (no id) as CREATE with holding creates', () => {
    const current: InvestmentsSnapshot = {
      investments: [
        ...persistedSnapshot.investments,
        {
          name: 'Sharesies',
          platform: 'Sharesies',
          type: 'ETF_CRYPTO',
          cashBalance: 0,
          holdings: [
            { ticker: 'VGS', units: 30, averagePrice: 110, type: 'ETF' },
          ],
        },
      ],
    };
    const diff = diffInvestments(persistedSnapshot, current);
    expect(diff.investmentOps).toHaveLength(1);
    const op = diff.investmentOps[0];
    expect(op.op).toBe('create');
    expect(op.id).toBeUndefined();
    expect(op.holdingOps).toHaveLength(1);
    expect(op.holdingOps[0].op).toBe('create');
  });

  it('classifies an edited account core as UPDATE (keeps the id)', () => {
    const current: InvestmentsSnapshot = {
      investments: persistedSnapshot.investments.map((a) => ({ ...a, cashBalance: 2000 })),
    };
    const diff = diffInvestments(persistedSnapshot, current);
    expect(diff.investmentOps).toHaveLength(1);
    expect(diff.investmentOps[0]).toMatchObject({ op: 'update', id: 'uuid-acc', coreChanged: true });
  });

  it('classifies a removed account as DELETE (holdingOps empty — cascade)', () => {
    const diff = diffInvestments(persistedSnapshot, EMPTY_INVESTMENTS_SNAPSHOT);
    expect(diff.investmentOps).toHaveLength(1);
    expect(diff.investmentOps[0]).toMatchObject({ op: 'delete', id: 'uuid-acc' });
    expect(diff.investmentOps[0].holdingOps).toEqual([]);
  });

  it('detects a holding change as a core-unchanged account UPDATE', () => {
    const current: InvestmentsSnapshot = {
      investments: persistedSnapshot.investments.map((a) => ({
        ...a,
        holdings: [
          { ...a.holdings[0], units: 120 }, // VAS changed → update
          // BHP removed → delete
          { ticker: 'VGS', units: 10, averagePrice: 110, type: 'ETF' }, // new → create
        ],
      })),
    };
    const diff = diffInvestments(persistedSnapshot, current);
    expect(diff.investmentOps).toHaveLength(1);
    const op = diff.investmentOps[0];
    expect(op).toMatchObject({ op: 'update', coreChanged: false });
    const byOp = (o: string) => op.holdingOps.filter((x) => x.op === o);
    expect(byOp('create')).toHaveLength(1);
    expect(byOp('update')).toHaveLength(1);
    expect(byOp('update')[0].id).toBe('uuid-vas');
    expect(byOp('delete')).toHaveLength(1);
    expect(byOp('delete')[0].id).toBe('uuid-bhp');
  });

  it('produces ZERO ops for a first-ever empty list', () => {
    expect(
      diffInvestments(EMPTY_INVESTMENTS_SNAPSHOT, EMPTY_INVESTMENTS_SNAPSHOT).investmentOps,
    ).toEqual([]);
  });
});

describe('wizardInvestmentsToSnapshot — quality guards', () => {
  function wizardAccount(over: Partial<InvestmentAccountInput>): InvestmentAccountInput {
    return {
      id: 'uuid-x',
      name: 'An account',
      platform: 'Platform',
      type: 'BROKERAGE',
      cashBalance: 0,
      holdings: [],
      ...over,
    };
  }

  it('drops a holding with no ticker / 0 units / 0 price', () => {
    const snap = wizardInvestmentsToSnapshot([
      wizardAccount({
        holdings: [
          { id: 'temp_h1', ticker: 'VAS', name: '', units: 10, averagePrice: 95, type: 'ETF' },
          { id: 'temp_h2', ticker: '', name: '', units: 5, averagePrice: 10, type: 'ETF' },
          { id: 'temp_h3', ticker: 'BHP', name: '', units: 0, averagePrice: 42, type: 'SHARE' },
          { id: 'temp_h4', ticker: 'VGS', name: '', units: 5, averagePrice: 0, type: 'ETF' },
        ],
      }),
    ]);
    expect(snap.investments[0].holdings).toHaveLength(1);
    expect(snap.investments[0].holdings[0].ticker).toBe('VAS');
  });

  it('drops an unpersisted account with no name (incomplete in-session card)', () => {
    const snap = wizardInvestmentsToSnapshot([
      wizardAccount({ id: 'temp_acc_1', name: '' }),
    ]);
    expect(snap.investments).toHaveLength(0);
  });

  it('KEEPS a persisted account even if its name was blanked (never silently deletes)', () => {
    const snap = wizardInvestmentsToSnapshot([
      wizardAccount({ id: 'uuid-real', name: '' }),
    ]);
    expect(snap.investments).toHaveLength(1);
    expect(snap.investments[0].id).toBe('uuid-real');
  });
});

describe('isPersistedId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_inv_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-inv-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
