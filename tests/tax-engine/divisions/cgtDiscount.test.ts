/**
 * CGT discount tests — Phase 41e.1 slice A.
 *
 * Pins the per-entity rate dispatch contract per ITAA 1997 Div 115:
 *   - PERSONAL_NAME / SOLE_TRADER / DISCRETIONARY_TRUST / UNIT_TRUST /
 *     PARTNERSHIP → 50%
 *   - SMSF (complying) → 33⅓% (1/3)
 *   - SMSF (non-complying) → 0%
 *   - COMPANY → 0% (s115-280 carve-out)
 *   - any entity, < 12 months held → 0%
 *
 * Worked examples derived from ATO publications on CGT discount.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCgtDiscount,
  getCgtDiscountRate,
  type CgtEligibleEntityType,
} from '@/lib/tax-engine/divisions/cgtDiscount';

describe('calculateCgtDiscount — holding-period gate (s115-25)', () => {
  it('< 12 months → no discount, full nominal gain taxable', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 11,
      nominalGain: 100000,
    });
    expect(result.metHoldingPeriod).toBe(false);
    expect(result.discountRate).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.discountedGain).toBe(100000);
    expect(result.reason).toMatch(/12-month rule/);
  });

  it('exactly 12 months → discount applies (≥ 12 boundary)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 12,
      nominalGain: 100000,
    });
    expect(result.metHoldingPeriod).toBe(true);
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(50000);
  });

  it('< 12 months for SMSF → also no discount (gate is universal)', () => {
    const result = calculateCgtDiscount({
      entityType: 'SMSF',
      monthsHeld: 6,
      nominalGain: 60000,
    });
    expect(result.metHoldingPeriod).toBe(false);
    expect(result.discountRate).toBe(0);
  });
});

describe('calculateCgtDiscount — per-entity rate dispatch', () => {
  it('PERSONAL_NAME — 50% discount', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 18,
      nominalGain: 100000,
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountAmount).toBe(50000);
    expect(result.discountedGain).toBe(50000);
    expect(result.reason).toMatch(/individual/);
  });

  it('SOLE_TRADER — 50% discount (taxed as individual)', () => {
    const result = calculateCgtDiscount({
      entityType: 'SOLE_TRADER',
      monthsHeld: 24,
      nominalGain: 80000,
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(40000);
  });

  it('PARTNERSHIP — 50% discount (applied at partner level)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PARTNERSHIP',
      monthsHeld: 36,
      nominalGain: 200000,
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(100000);
    expect(result.reason).toMatch(/partner level/);
  });

  it('DISCRETIONARY_TRUST — 50% discount (flows to beneficiary)', () => {
    const result = calculateCgtDiscount({
      entityType: 'DISCRETIONARY_TRUST',
      monthsHeld: 48,
      nominalGain: 150000,
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(75000);
  });

  it('UNIT_TRUST — 50% discount (pro-rata to unit-holders)', () => {
    const result = calculateCgtDiscount({
      entityType: 'UNIT_TRUST',
      monthsHeld: 24,
      nominalGain: 90000,
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(45000);
  });

  it('SMSF (complying) — 33⅓% discount per s115-100', () => {
    const result = calculateCgtDiscount({
      entityType: 'SMSF',
      monthsHeld: 18,
      nominalGain: 90000,
      isComplying: true,
    });
    expect(result.discountRate).toBeCloseTo(1 / 3, 6);
    expect(result.discountAmount).toBeCloseTo(30000, 2);
    expect(result.discountedGain).toBeCloseTo(60000, 2);
    expect(result.reason).toMatch(/33⅓/);
  });

  it('SMSF (non-complying) — 0% discount (s115-100 carve-out)', () => {
    const result = calculateCgtDiscount({
      entityType: 'SMSF',
      monthsHeld: 24,
      nominalGain: 90000,
      isComplying: false,
    });
    expect(result.discountRate).toBe(0);
    expect(result.discountedGain).toBe(90000);
    expect(result.reason).toMatch(/non-complying/);
  });

  it('COMPANY — 0% discount (s115-280 carve-out)', () => {
    const result = calculateCgtDiscount({
      entityType: 'COMPANY',
      monthsHeld: 60,
      nominalGain: 200000,
    });
    expect(result.discountRate).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.discountedGain).toBe(200000);
    expect(result.reason).toMatch(/companies are not eligible/);
    // Boundary footer needs s115-280 visible
    expect(result.citations.some((c) => c.reference === 's115-280')).toBe(true);
  });
});

describe('calculateCgtDiscount — citations + UNCOMPUTED', () => {
  it('always includes ITAA 1997 s115-25 + s115-100 in citations', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 50000,
    });
    expect(result.citations.some((c) => c.reference === 's115-25')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's115-100')).toBe(true);
  });

  it('foreign-resident raises UC-FOREIGN-RESIDENT-CGT but does not block calc', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 36,
      nominalGain: 100000,
      isForeignResident: true,
    });
    // v1 still computes the standard 50% — surfaces the apportionment
    // gap as UNCOMPUTED for the user to action.
    expect(result.discountRate).toBe(0.5);
    expect(result.uncomputed.length).toBe(1);
    expect(result.uncomputed[0].id).toBe('UC-FOREIGN-RESIDENT-CGT');
    expect(result.uncomputed[0].rationale).toMatch(/Subdiv 115-D/);
  });

  it('non-foreign-resident has empty uncomputed array', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 36,
      nominalGain: 100000,
    });
    expect(result.uncomputed).toEqual([]);
  });
});

describe('calculateCgtDiscount — edge cases', () => {
  it('zero nominal gain → zero discount, zero discounted gain', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 18,
      nominalGain: 0,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountedGain).toBe(0);
  });

  it('negative gain (loss) — discount is 0; caller routes through loss-netting', () => {
    // The function trusts the caller to route losses through the
    // netting module (slice B). When given a negative gain, it returns
    // discountAmount: 0 (Math.max guard) and discountedGain == nominalGain.
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 18,
      nominalGain: -25000,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountedGain).toBe(-25000);
  });
});

describe('getCgtDiscountRate helper', () => {
  it.each([
    ['PERSONAL_NAME', 0.5],
    ['SOLE_TRADER', 0.5],
    ['PARTNERSHIP', 0.5],
    ['DISCRETIONARY_TRUST', 0.5],
    ['UNIT_TRUST', 0.5],
    ['COMPANY', 0],
  ] as Array<[CgtEligibleEntityType, number]>)('%s → %s', (type, rate) => {
    expect(getCgtDiscountRate(type)).toBe(rate);
  });

  it('SMSF complying → 1/3', () => {
    expect(getCgtDiscountRate('SMSF', true)).toBeCloseTo(1 / 3, 6);
  });

  it('SMSF non-complying → 0', () => {
    expect(getCgtDiscountRate('SMSF', false)).toBe(0);
  });
});
