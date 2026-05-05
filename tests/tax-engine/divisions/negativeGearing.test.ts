/**
 * Phase 41e.8 — Negative gearing + per-entity loss treatment tests.
 */

import { describe, it, expect } from 'vitest';
import {
  applyNegativeGearing,
  entityCanOffsetLossesCurrentFy,
  type NegativeGearingInput,
} from '@/lib/tax-engine/divisions/negativeGearing';

const baseInput = (
  o: Partial<NegativeGearingInput> = {},
): NegativeGearingInput => ({
  entityType: 'PERSONAL_NAME',
  grossIncome: 30000, // gross rent
  deductibleExpenses: 50000, // interest + rates etc — net loss $20k
  otherIncome: 100000, // salary
  ...o,
});

describe('applyNegativeGearing — net positive (no loss)', () => {
  it('positive net → NO_LOSS, taxable = otherIncome + netResult', () => {
    const r = applyNegativeGearing(
      baseInput({ grossIncome: 50000, deductibleExpenses: 30000 }),
    );
    expect(r.netResult).toBe(20000);
    expect(r.lossTreatment).toBe('NO_LOSS');
    expect(r.lossAbsorbedThisFy).toBe(0);
    expect(r.lossCarriedForward).toBe(0);
    expect(r.taxableIncomeAtEntity).toBe(120000);
  });

  it('break-even → NO_LOSS', () => {
    const r = applyNegativeGearing(
      baseInput({ grossIncome: 30000, deductibleExpenses: 30000 }),
    );
    expect(r.netResult).toBe(0);
    expect(r.lossTreatment).toBe('NO_LOSS');
  });
});

describe('applyNegativeGearing — PERSONAL_NAME (negative gearing)', () => {
  it('loss offsets salary → reduces taxable income', () => {
    const r = applyNegativeGearing(baseInput()); // $20k loss vs $100k salary
    expect(r.netResult).toBe(-20000);
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.lossAbsorbedThisFy).toBe(20000);
    expect(r.lossCarriedForward).toBe(0);
    expect(r.taxableIncomeAtEntity).toBe(80000); // $100k - $20k absorbed
  });

  it('loss exceeds other income → carry forward + UNCOMPUTED flag', () => {
    const r = applyNegativeGearing(
      baseInput({ otherIncome: 5000, deductibleExpenses: 50000 }),
    );
    // $20k loss, only $5k absorbed, $15k carries forward
    expect(r.lossAbsorbedThisFy).toBe(5000);
    expect(r.lossCarriedForward).toBe(15000);
    expect(r.taxableIncomeAtEntity).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-TAX-LOSS-CARRY-FORWARD')).toBe(true);
  });

  it('zero other income → entire loss carries forward', () => {
    const r = applyNegativeGearing(baseInput({ otherIncome: 0 }));
    expect(r.lossAbsorbedThisFy).toBe(0);
    expect(r.lossCarriedForward).toBe(20000);
  });
});

describe('applyNegativeGearing — SOLE_TRADER (same as individual)', () => {
  it('business loss offsets other income', () => {
    const r = applyNegativeGearing(baseInput({ entityType: 'SOLE_TRADER' }));
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.taxableIncomeAtEntity).toBe(80000);
  });
});

describe('applyNegativeGearing — PARTNERSHIP', () => {
  it('partnership loss flows to partners (treated like individual)', () => {
    const r = applyNegativeGearing(baseInput({ entityType: 'PARTNERSHIP' }));
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.reason).toMatch(/Partnership/);
  });
});

describe('applyNegativeGearing — SMSF (offsets fund income)', () => {
  it('SMSF investment loss offsets other fund income', () => {
    const r = applyNegativeGearing(
      baseInput({ entityType: 'SMSF', otherIncome: 50000 }),
    );
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.taxableIncomeAtEntity).toBe(30000); // $50k - $20k loss
  });
});

describe('applyNegativeGearing — DISCRETIONARY_TRUST (loss trapped)', () => {
  it('trust loss does NOT offset other income — carries forward', () => {
    const r = applyNegativeGearing(
      baseInput({ entityType: 'DISCRETIONARY_TRUST' }),
    );
    expect(r.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(r.lossAbsorbedThisFy).toBe(0);
    expect(r.lossCarriedForward).toBe(20000);
    expect(r.taxableIncomeAtEntity).toBe(100000); // otherIncome unchanged
    // UC-TRUST-LOSS-TESTS surfaces (Sch 2F tests in 41e.15)
    expect(r.uncomputed.some((u) => u.id === 'UC-TRUST-LOSS-TESTS')).toBe(true);
    expect(r.citations.some((c) => c.reference === 'Sch 2F')).toBe(true);
  });

  it('UNIT_TRUST same treatment as discretionary trust', () => {
    const r = applyNegativeGearing(baseInput({ entityType: 'UNIT_TRUST' }));
    expect(r.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(r.uncomputed.some((u) => u.id === 'UC-TRUST-LOSS-TESTS')).toBe(true);
  });
});

describe('applyNegativeGearing — COMPANY (loss trapped)', () => {
  it('company loss trapped + UC-COMPANY-LOSS-TESTS surfaces', () => {
    const r = applyNegativeGearing(baseInput({ entityType: 'COMPANY' }));
    expect(r.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(r.lossAbsorbedThisFy).toBe(0);
    expect(r.lossCarriedForward).toBe(20000);
    expect(r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-TESTS')).toBe(true);
    expect(r.citations.some((c) => c.reference === 'Div 165')).toBe(true);
  });

  it('company with positive income → no loss treatment', () => {
    const r = applyNegativeGearing(
      baseInput({
        entityType: 'COMPANY',
        grossIncome: 50000,
        deductibleExpenses: 30000,
      }),
    );
    expect(r.lossTreatment).toBe('NO_LOSS');
    expect(r.uncomputed).toEqual([]);
  });
});

describe('applyNegativeGearing — citations', () => {
  it('always cites Div 8 + Div 36', () => {
    const r = applyNegativeGearing(baseInput());
    expect(r.citations.some((c) => c.reference === 'Div 8')).toBe(true);
    expect(r.citations.some((c) => c.reference === 'Div 36')).toBe(true);
  });

  it('NO_LOSS path still cites Div 8 + Div 36 (deductibility floor)', () => {
    const r = applyNegativeGearing(
      baseInput({ grossIncome: 50000, deductibleExpenses: 30000 }),
    );
    expect(r.citations.some((c) => c.reference === 'Div 8')).toBe(true);
  });

  it('COMPANY trap adds Div 165', () => {
    const r = applyNegativeGearing(baseInput({ entityType: 'COMPANY' }));
    expect(r.citations.some((c) => c.reference === 'Div 165')).toBe(true);
  });

  it('TRUST trap adds Sch 2F', () => {
    const r = applyNegativeGearing(
      baseInput({ entityType: 'DISCRETIONARY_TRUST' }),
    );
    expect(r.citations.some((c) => c.reference === 'Sch 2F')).toBe(true);
  });
});

describe('entityCanOffsetLossesCurrentFy', () => {
  it.each([
    ['PERSONAL_NAME', true],
    ['SOLE_TRADER', true],
    ['PARTNERSHIP', true],
    ['SMSF', true],
    ['DISCRETIONARY_TRUST', false],
    ['UNIT_TRUST', false],
    ['COMPANY', false],
  ] as Array<[Parameters<typeof entityCanOffsetLossesCurrentFy>[0], boolean]>)(
    '%s → %s',
    (type, expected) => {
      expect(entityCanOffsetLossesCurrentFy(type)).toBe(expected);
    },
  );
});
