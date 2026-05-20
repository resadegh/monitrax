/**
 * Phase 12 Track F.4 — debts two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffDebts` is the pure core that guarantees this — re-entry with no
 * edits must diff to an empty op set.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffDebts,
  wizardDebtsToSnapshot,
  snapshotToWizardDebts,
  isPersistedId,
  EMPTY_DEBTS_SNAPSHOT,
  type DebtsSnapshot,
} from '@/lib/onboarding/debtsSync';
import type { DebtInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — a car loan + a HECS/HELP student loan.
const persistedSnapshot: DebtsSnapshot = {
  debts: [
    {
      id: 'uuid-car',
      name: 'Car loan',
      type: 'CAR',
      lender: '',
      principal: 24000,
      interestRateAnnual: 8.5,
      minRepayment: 520,
      repaymentFrequency: 'MONTHLY',
      termMonthsRemaining: 48,
      isHecsHelp: false,
    },
    {
      id: 'uuid-hecs',
      name: 'HECS',
      type: 'STUDENT',
      lender: '',
      principal: 31000,
      interestRateAnnual: 4,
      minRepayment: 0,
      repaymentFrequency: 'MONTHLY',
      termMonthsRemaining: 60,
      isHecsHelp: true,
    },
  ],
};

describe('diffDebts — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    expect(diffDebts(persistedSnapshot, persistedSnapshot).debtOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    const wizardDebts = snapshotToWizardDebts(persistedSnapshot);
    const current = wizardDebtsToSnapshot(wizardDebts);
    expect(diffDebts(persistedSnapshot, current).debtOps).toEqual([]);
  });

  it('classifies a brand-new debt (no id) as CREATE', () => {
    const current: DebtsSnapshot = {
      debts: [
        ...persistedSnapshot.debts,
        {
          name: 'Personal loan',
          type: 'PERSONAL',
          lender: 'ANZ',
          principal: 8000,
          interestRateAnnual: 12,
          minRepayment: 300,
          repaymentFrequency: 'MONTHLY',
          termMonthsRemaining: 36,
          isHecsHelp: false,
        },
      ],
    };
    const diff = diffDebts(persistedSnapshot, current);
    expect(diff.debtOps).toHaveLength(1);
    expect(diff.debtOps[0]).toMatchObject({ op: 'create' });
    expect(diff.debtOps[0].id).toBeUndefined();
    expect(diff.debtOps[0].record.name).toBe('Personal loan');
  });

  it('classifies an edited debt as UPDATE (keeps the id)', () => {
    const current: DebtsSnapshot = {
      debts: persistedSnapshot.debts.map((d) =>
        d.id === 'uuid-car' ? { ...d, principal: 22000 } : d,
      ),
    };
    const diff = diffDebts(persistedSnapshot, current);
    expect(diff.debtOps).toHaveLength(1);
    expect(diff.debtOps[0]).toMatchObject({ op: 'update', id: 'uuid-car' });
  });

  it('classifies a removed debt as DELETE', () => {
    const current: DebtsSnapshot = {
      debts: persistedSnapshot.debts.filter((d) => d.id !== 'uuid-car'),
    };
    const diff = diffDebts(persistedSnapshot, current);
    expect(diff.debtOps).toHaveLength(1);
    expect(diff.debtOps[0]).toMatchObject({ op: 'delete', id: 'uuid-car' });
  });

  it('does NOT treat a lender-only change as an edit (lender is not persisted)', () => {
    const current: DebtsSnapshot = {
      debts: persistedSnapshot.debts.map((d) =>
        d.id === 'uuid-car' ? { ...d, lender: 'Toyota Finance' } : d,
      ),
    };
    expect(diffDebts(persistedSnapshot, current).debtOps).toEqual([]);
  });

  it('produces ZERO ops for a first-ever empty debt list', () => {
    expect(diffDebts(EMPTY_DEBTS_SNAPSHOT, EMPTY_DEBTS_SNAPSHOT).debtOps).toEqual([]);
  });
});

describe('wizardDebtsToSnapshot — quality guard', () => {
  function wizardDebt(over: Partial<DebtInput>): DebtInput {
    return {
      id: 'uuid-x',
      name: 'A debt',
      type: 'PERSONAL',
      principal: 5000,
      interestRateAnnual: 10,
      minRepayment: 200,
      repaymentFrequency: 'MONTHLY',
      termMonthsRemaining: 36,
      ...over,
    };
  }

  it('drops an unpersisted debt with principal <= 0 (incomplete in-session card)', () => {
    const snap = wizardDebtsToSnapshot([
      wizardDebt({ id: 'temp_debt_1', principal: 0 }),
    ]);
    expect(snap.debts).toHaveLength(0);
  });

  it('KEEPS a persisted debt even if its balance was blanked (never silently deletes)', () => {
    const snap = wizardDebtsToSnapshot([
      wizardDebt({ id: 'uuid-real', principal: 0 }),
    ]);
    expect(snap.debts).toHaveLength(1);
    expect(snap.debts[0].id).toBe('uuid-real');
  });

  it('derives isHecsHelp from a STUDENT type', () => {
    const snap = wizardDebtsToSnapshot([
      wizardDebt({ id: 'temp_debt_2', type: 'STUDENT', principal: 20000 }),
    ]);
    expect(snap.debts[0].isHecsHelp).toBe(true);
  });
});

describe('isPersistedId', () => {
  it('treats real uuids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
    expect(isPersistedId('temp_debt_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-debt-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
