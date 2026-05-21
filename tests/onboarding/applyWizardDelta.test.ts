/**
 * applyWizardDelta — Phase 12 Track G.4 tests.
 *
 * The "describe it in your own words" accelerator's pure delta → wizard
 * merge. Verifies the APPEND semantics (a delta never replaces or
 * deletes), the per-topic field mapping + defaults, and `countDeltaItems`.
 */

import { describe, it, expect } from 'vitest';
import {
  applyWizardDelta,
  countDeltaItems,
} from '@/lib/onboarding/applyWizardDelta';
import { INITIAL_WIZARD_DATA } from '@/components/onboarding/wizard/types';
import type { WizardStateDelta } from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

const EMPTY = INITIAL_WIZARD_DATA;

describe('applyWizardDelta — household', () => {
  const delta: WizardStateDelta = {
    topic: 'household',
    fields: {
      householdMembers: [
        { name: 'Alex', relationship: 'SELF', isIncomeEarner: true },
        { name: 'Sam', relationship: 'PARTNER', isIncomeEarner: true },
      ],
      householdPets: [{ name: 'Rex', type: 'DOG' }],
      carsCount: 2,
    },
    unresolved: [],
  };

  it('appends members + pets and sets carsCount', () => {
    const u = applyWizardDelta(delta, EMPTY);
    expect(u.householdMembers).toHaveLength(2);
    expect(u.householdMembers?.[0].name).toBe('Alex');
    expect(u.householdMembers?.[0].id).toMatch(/^temp_/);
    expect(u.householdPets).toHaveLength(1);
    expect(u.carsCount).toBe(2);
  });

  it('APPENDS to existing members — never replaces', () => {
    const withOne = {
      ...EMPTY,
      householdMembers: [
        { id: 'real-1', name: 'Existing', relationship: 'SELF' as const, isIncomeEarner: true },
      ],
    };
    const u = applyWizardDelta(delta, withOne);
    expect(u.householdMembers).toHaveLength(3); // 1 existing + 2 new
    expect(u.householdMembers?.[0].id).toBe('real-1');
  });
});

describe('applyWizardDelta — properties', () => {
  it('maps a property delta onto a PropertyInput with defaults', () => {
    const delta: WizardStateDelta = {
      topic: 'properties',
      fields: {
        properties: [{ name: 'Smith St unit', type: 'INVESTMENT', currentValue: 480000, hasLoan: true }],
      },
      unresolved: [],
    };
    const u = applyWizardDelta(delta, EMPTY);
    expect(u.properties).toHaveLength(1);
    const p = u.properties![0];
    expect(p.name).toBe('Smith St unit');
    expect(p.currentValue).toBe(480000);
    expect(p.hasLoan).toBe(true);
    expect(p.address).toBe('');     // default
    expect(p.purchasePrice).toBe(0); // default
    expect(p.expenses).toEqual([]);  // default
  });
});

describe('applyWizardDelta — income-expenses', () => {
  it('appends both incomes and expenses', () => {
    const delta: WizardStateDelta = {
      topic: 'income-expenses',
      fields: {
        incomes: [{ name: 'Salary', type: 'SALARY', amount: 120000, frequency: 'ANNUAL' }],
        expenses: [{ name: 'Rent', category: 'RENT', amount: 600, frequency: 'WEEKLY' }],
      },
      unresolved: [],
    };
    const u = applyWizardDelta(delta, EMPTY);
    expect(u.income).toHaveLength(1);
    expect(u.income?.[0].amount).toBe(120000);
    expect(u.expenses).toHaveLength(1);
    expect(u.expenses?.[0].frequency).toBe('WEEKLY');
  });
});

describe('applyWizardDelta — defaults when delta omits optional fields', () => {
  it('debt with only a name falls back to safe defaults', () => {
    const delta: WizardStateDelta = {
      topic: 'debts',
      fields: { debts: [{ name: 'Car loan' }] },
      unresolved: [],
    };
    const u = applyWizardDelta(delta, EMPTY);
    expect(u.debts).toHaveLength(1);
    expect(u.debts?.[0].type).toBe('PERSONAL');
    expect(u.debts?.[0].principal).toBe(0);
    expect(u.debts?.[0].repaymentFrequency).toBe('MONTHLY');
  });

  it('an empty delta produces no updates', () => {
    const delta: WizardStateDelta = {
      topic: 'accounts',
      fields: {},
      unresolved: [],
    };
    expect(applyWizardDelta(delta, EMPTY)).toEqual({});
  });
});

describe('countDeltaItems', () => {
  it('counts household members + pets + the carsCount field', () => {
    const delta: WizardStateDelta = {
      topic: 'household',
      fields: {
        householdMembers: [{ name: 'A', relationship: 'SELF', isIncomeEarner: true }],
        householdPets: [{ name: 'Rex', type: 'DOG' }],
        carsCount: 1,
      },
      unresolved: [],
    };
    expect(countDeltaItems(delta)).toBe(3);
  });

  it('counts incomes + expenses for the income-expenses topic', () => {
    const delta: WizardStateDelta = {
      topic: 'income-expenses',
      fields: {
        incomes: [{ name: 'Salary' }, { name: 'Side gig' }],
        expenses: [{ name: 'Rent' }],
      },
      unresolved: [],
    };
    expect(countDeltaItems(delta)).toBe(3);
  });

  it('is zero for an empty delta', () => {
    expect(
      countDeltaItems({ topic: 'assets', fields: {}, unresolved: [] }),
    ).toBe(0);
  });
});
