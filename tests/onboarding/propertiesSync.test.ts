/**
 * Phase 12 Track F.2 — properties two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffProperties` is the pure core that guarantees this — re-entry with no
 * edits must diff to an empty op set. These tests also cover the F.2 quality
 * guards (a $0 loan / income / expense is dropped) and the whole-aggregate
 * nesting (a property's create carries its loan / income / expense as child
 * creates; a property's delete carries them as child deletes).
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffProperties,
  wizardPropertiesToSnapshot,
  snapshotToWizardProperties,
  isPersistedId,
  EMPTY_PROPERTIES_SNAPSHOT,
  type PropertiesSnapshot,
} from '@/lib/onboarding/propertiesSync';
import type { PropertyInput } from '@/components/onboarding/wizard/types';

// A realistic real-table snapshot — what `readProperties()` returns for a
// user who already has two properties: a mortgaged home + an investment unit.
const persistedSnapshot: PropertiesSnapshot = {
  properties: [
    {
      id: 'uuid-home',
      name: 'Family home',
      address: '12 Smith St',
      type: 'HOME',
      purchasePrice: 600000,
      currentValue: 850000,
      purchaseDate: '2019-03-01',
      valuationDate: '2026-05-20',
      hasLoan: true,
      loan: {
        id: 'uuid-loan',
        lender: 'ANZ',
        principal: 420000,
        interestRateAnnual: 6.25,
        rateType: 'VARIABLE',
        isInterestOnly: false,
        termMonthsRemaining: 300,
        minRepayment: 2600,
        repaymentFrequency: 'MONTHLY',
      },
      expenses: [
        {
          id: 'uuid-exp-rates',
          name: 'Council rates',
          category: 'RATES',
          amount: 2400,
          frequency: 'ANNUAL',
        },
      ],
    },
    {
      id: 'uuid-ip',
      name: 'Bondi unit',
      address: '5 Beach Rd',
      type: 'INVESTMENT',
      purchasePrice: 700000,
      currentValue: 920000,
      purchaseDate: '2021-06-15',
      valuationDate: '2026-05-20',
      hasLoan: false,
      income: { id: 'uuid-inc', amount: 650, frequency: 'WEEKLY' },
      expenses: [],
    },
  ],
};

describe('diffProperties — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    const diff = diffProperties(persistedSnapshot, persistedSnapshot);
    expect(diff.propertyOps).toEqual([]);
  });

  it('produces ZERO ops after a round-trip through the wizard mappers', () => {
    // Exactly what the wizard step does: snapshot → PropertyInput[] (on
    // open) → back to a snapshot (on Continue). A no-edit round-trip must
    // still diff to nothing — otherwise re-entering the step and pressing
    // Continue would duplicate every property, loan, income and expense.
    const wizardProps = snapshotToWizardProperties(persistedSnapshot);
    const current = wizardPropertiesToSnapshot(wizardProps);
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toEqual([]);
  });

  it('classifies a brand-new property (no id) as CREATE with child creates', () => {
    const current: PropertiesSnapshot = {
      properties: [
        ...persistedSnapshot.properties,
        {
          // No id → never persisted.
          name: 'Mountain cabin',
          address: '9 Pine Way',
          type: 'INVESTMENT',
          purchasePrice: 0,
          currentValue: 480000,
          purchaseDate: '2026-01-10',
          hasLoan: true,
          loan: {
            lender: 'CBA',
            principal: 300000,
            interestRateAnnual: 6.1,
            rateType: 'FIXED',
            isInterestOnly: true,
            termMonthsRemaining: 360,
            minRepayment: 1800,
            repaymentFrequency: 'MONTHLY',
          },
          income: { amount: 520, frequency: 'WEEKLY' },
          expenses: [
            { name: 'Strata', category: 'STRATA', amount: 900, frequency: 'QUARTERLY' },
          ],
        },
      ],
    };
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toHaveLength(1);
    const op = diff.propertyOps[0];
    expect(op.op).toBe('create');
    expect(op.id).toBeUndefined();
    expect(op.record.name).toBe('Mountain cabin');
    // Every child of a new property is a create.
    expect(op.loanOps).toHaveLength(1);
    expect(op.loanOps[0].op).toBe('create');
    expect(op.incomeOps).toHaveLength(1);
    expect(op.incomeOps[0].op).toBe('create');
    expect(op.expenseOps).toHaveLength(1);
    expect(op.expenseOps[0].op).toBe('create');
  });

  it('classifies an edited persisted property core as UPDATE (keeps the id)', () => {
    const current: PropertiesSnapshot = {
      properties: persistedSnapshot.properties.map((p) =>
        p.id === 'uuid-home' ? { ...p, currentValue: 900000 } : p,
      ),
    };
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toHaveLength(1);
    expect(diff.propertyOps[0]).toMatchObject({ op: 'update', id: 'uuid-home', coreChanged: true });
  });

  it('classifies a removed persisted property as DELETE (with child deletes, Q-F2)', () => {
    const current: PropertiesSnapshot = {
      properties: persistedSnapshot.properties.filter((p) => p.id !== 'uuid-home'),
    };
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toHaveLength(1);
    const op = diff.propertyOps[0];
    expect(op).toMatchObject({ op: 'delete', id: 'uuid-home' });
    // The mortgage + expense are deleted alongside (no orphan rows).
    expect(op.loanOps).toEqual([
      expect.objectContaining({ op: 'delete', id: 'uuid-loan' }),
    ]);
    expect(op.expenseOps).toEqual([
      expect.objectContaining({ op: 'delete', id: 'uuid-exp-rates' }),
    ]);
  });

  it('detects a changed mortgage as a loan UPDATE without a property core write', () => {
    const current: PropertiesSnapshot = {
      properties: persistedSnapshot.properties.map((p) =>
        p.id === 'uuid-home' && p.loan
          ? { ...p, loan: { ...p.loan, principal: 410000 } }
          : p,
      ),
    };
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toHaveLength(1);
    const op = diff.propertyOps[0];
    expect(op).toMatchObject({ op: 'update', id: 'uuid-home', coreChanged: false });
    expect(op.loanOps).toEqual([
      expect.objectContaining({ op: 'update', id: 'uuid-loan' }),
    ]);
  });

  it('classifies a removed mortgage as a loan DELETE', () => {
    const current: PropertiesSnapshot = {
      properties: persistedSnapshot.properties.map((p) =>
        p.id === 'uuid-home' ? { ...p, hasLoan: false, loan: undefined } : p,
      ),
    };
    const diff = diffProperties(persistedSnapshot, current);
    expect(diff.propertyOps).toHaveLength(1);
    expect(diff.propertyOps[0].loanOps).toEqual([
      expect.objectContaining({ op: 'delete', id: 'uuid-loan' }),
    ]);
  });

  it('handles a mixed expense diff — create + update + delete in one pass', () => {
    const current: PropertiesSnapshot = {
      properties: persistedSnapshot.properties.map((p) =>
        p.id === 'uuid-home'
          ? {
              ...p,
              expenses: [
                // uuid-exp-rates changed → update
                {
                  id: 'uuid-exp-rates',
                  name: 'Council rates',
                  category: 'RATES',
                  amount: 2600,
                  frequency: 'ANNUAL',
                },
                // new → create
                { name: 'Insurance', category: 'INSURANCE', amount: 1400, frequency: 'ANNUAL' },
              ],
            }
          : p,
      ),
    };
    const diff = diffProperties(persistedSnapshot, current);
    const op = diff.propertyOps[0];
    const byOp = (o: string) => op.expenseOps.filter((x) => x.op === o);
    expect(byOp('create')).toHaveLength(1);
    expect(byOp('update')).toHaveLength(1);
    expect(byOp('update')[0].id).toBe('uuid-exp-rates');
  });

  it('produces ZERO ops for a first-ever empty portfolio', () => {
    const diff = diffProperties(EMPTY_PROPERTIES_SNAPSHOT, EMPTY_PROPERTIES_SNAPSHOT);
    expect(diff.propertyOps).toEqual([]);
  });
});

describe('wizardPropertiesToSnapshot — quality guards (financial-adviser lens)', () => {
  function wizardProperty(over: Partial<PropertyInput>): PropertyInput {
    return {
      id: 'uuid-x',
      name: 'A property',
      address: '1 Test St',
      type: 'HOME',
      purchasePrice: 0,
      currentValue: 500000,
      purchaseDate: '2020-01-01',
      hasLoan: false,
      expenses: [],
      ...over,
    };
  }

  it('drops a mortgage with principal <= 0 (a $0 loan is false precision)', () => {
    const snap = wizardPropertiesToSnapshot([
      wizardProperty({
        hasLoan: true,
        loan: {
          id: 'temp_loan_1',
          name: '',
          lender: '',
          principal: 0,
          interestRateAnnual: 0,
          rateType: 'VARIABLE',
          isInterestOnly: false,
          termMonthsRemaining: 360,
          minRepayment: 0,
          repaymentFrequency: 'MONTHLY',
        },
      }),
    ]);
    expect(snap.properties[0].loan).toBeUndefined();
    expect(snap.properties[0].hasLoan).toBe(false);
  });

  it('drops rental income with amount <= 0', () => {
    const snap = wizardPropertiesToSnapshot([
      wizardProperty({
        type: 'INVESTMENT',
        income: { id: 'temp_inc_1', type: 'RENTAL', amount: 0, frequency: 'WEEKLY' },
      }),
    ]);
    expect(snap.properties[0].income).toBeUndefined();
  });

  it('drops expenses with amount <= 0', () => {
    const snap = wizardPropertiesToSnapshot([
      wizardProperty({
        expenses: [
          { id: 'temp_e1', name: 'Real', category: 'RATES', amount: 1200, frequency: 'ANNUAL' },
          { id: 'temp_e2', name: 'Empty', category: 'OTHER', amount: 0, frequency: 'ANNUAL' },
        ],
      }),
    ]);
    expect(snap.properties[0].expenses).toHaveLength(1);
    expect(snap.properties[0].expenses[0].name).toBe('Real');
  });

  it('drops an unpersisted property with no purchase date (incomplete in-session card)', () => {
    const snap = wizardPropertiesToSnapshot([
      wizardProperty({ id: 'temp_prop_1', purchaseDate: undefined }),
    ]);
    expect(snap.properties).toHaveLength(0);
  });

  it('KEEPS a persisted property even if its purchase date was blanked (never silently deletes)', () => {
    const snap = wizardPropertiesToSnapshot([
      wizardProperty({ id: 'uuid-real', purchaseDate: '' }),
    ]);
    expect(snap.properties).toHaveLength(1);
    expect(snap.properties[0].id).toBe('uuid-real');
  });
});

describe('isPersistedId — distinguishes real uuids from synthetic wizard ids', () => {
  it('treats real uuids as persisted', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
  });
  it('treats synthetic wizard/chat ids as NOT persisted', () => {
    expect(isPersistedId('temp_1716100000000_abc')).toBe(false);
    expect(isPersistedId('temp_prop_1716100000000_1_abcdef')).toBe(false);
    expect(isPersistedId('chat-prop-0-1716100000000')).toBe(false);
    expect(isPersistedId('chat-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
    expect(isPersistedId('')).toBe(false);
  });
});

describe('mappers — interest rate round-trips as a percentage', () => {
  it('snapshotToWizardProperties keeps the loan rate in percent', () => {
    const wizardProps = snapshotToWizardProperties(persistedSnapshot);
    expect(wizardProps[0].loan?.interestRateAnnual).toBe(6.25);
  });
  it('wizardPropertiesToSnapshot keeps the loan rate in percent', () => {
    const wizardProps = snapshotToWizardProperties(persistedSnapshot);
    const snap = wizardPropertiesToSnapshot(wizardProps);
    expect(snap.properties[0].loan?.interestRateAnnual).toBe(6.25);
  });
});
