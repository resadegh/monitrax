/**
 * Q-DEC PR 2.B — Decimal frequency-converter tests.
 *
 * Mirrors the contract of the Float `toMonthly` / `toAnnual`:
 *   WEEKLY × 52, FORTNIGHTLY × 26, MONTHLY × 12, QUARTERLY × 4,
 *   ANNUAL × 1. Monthly = annual / 12.
 *
 * Null-safe — null/undefined input returns Decimal(0) (matches the
 * Float path's `Number(x || 0)` convention).
 */

import { describe, it, expect } from 'vitest';
import { toAnnualDecimal, toMonthlyDecimal, toAnnual, toMonthly } from '@/lib/utils/frequencies';
import { Decimal } from '@/lib/decimal';
import type { Frequency } from '@/lib/types/prisma-enums';

describe('toAnnualDecimal', () => {
  it('multiplies by the right periods per frequency', () => {
    expect(toAnnualDecimal(100, 'WEEKLY').toString()).toBe('5200');
    expect(toAnnualDecimal(100, 'FORTNIGHTLY').toString()).toBe('2600');
    expect(toAnnualDecimal(100, 'MONTHLY').toString()).toBe('1200');
    expect(toAnnualDecimal(100, 'QUARTERLY').toString()).toBe('400');
    expect(toAnnualDecimal(100, 'HALF_YEARLY').toString()).toBe('200');
    expect(toAnnualDecimal(100, 'ANNUAL').toString()).toBe('100');
  });

  it('returns Decimal(0) for null/undefined input', () => {
    expect(toAnnualDecimal(null, 'MONTHLY').toString()).toBe('0');
    expect(toAnnualDecimal(undefined, 'MONTHLY').toString()).toBe('0');
  });

  it('accepts string input', () => {
    expect(toAnnualDecimal('1234.56', 'MONTHLY').toString()).toBe('14814.72');
  });

  it('accepts existing Decimal input', () => {
    expect(toAnnualDecimal(new Decimal('1234.56'), 'MONTHLY').toString()).toBe('14814.72');
  });

  it('defaults to passthrough for unknown frequency (matches Float default)', () => {
    // The Float toAnnual returns amount unchanged for unknown frequencies.
    // Mirror that — Decimal preserves the input value.
    expect(toAnnualDecimal(100, 'GARBAGE' as Frequency).toString()).toBe('100');
  });
});

describe('toMonthlyDecimal', () => {
  it('is annual / 12', () => {
    expect(toMonthlyDecimal(1200, 'ANNUAL').toString()).toBe('100');
    expect(toMonthlyDecimal(100, 'WEEKLY').toString()).toBe(new Decimal('5200').div(12).toString());
    expect(toMonthlyDecimal(100, 'FORTNIGHTLY').toString()).toBe(new Decimal('2600').div(12).toString());
  });

  it('handles non-clean divisions without Float rounding (e.g. WEEKLY 100 → 5200/12)', () => {
    const decimal = toMonthlyDecimal(100, 'WEEKLY');
    // The Decimal answer is 433.333... at full precision; Float = 433.3333333333333.
    // Both round to the same cent at currency tolerance.
    expect(decimal.toDecimalPlaces(2).toString()).toBe('433.33');
  });
});

describe('Decimal converters agree with Float at currency tolerance', () => {
  const cases: Array<{ amount: number; frequency: Frequency }> = [
    { amount: 1234.56, frequency: 'MONTHLY' },
    { amount: 100, frequency: 'WEEKLY' },
    { amount: 250, frequency: 'FORTNIGHTLY' },
    { amount: 4500, frequency: 'QUARTERLY' },
    { amount: 215.59, frequency: 'HALF_YEARLY' },
    { amount: 87654.32, frequency: 'ANNUAL' },
  ];

  it.each(cases)(
    'toAnnual( $amount, $frequency ) agrees within 0.005',
    ({ amount, frequency }) => {
      const floatV = toAnnual(amount, frequency);
      const decV = toAnnualDecimal(amount, frequency);
      expect(decV.minus(floatV).abs().lessThanOrEqualTo(new Decimal('0.005'))).toBe(true);
    },
  );

  it.each(cases)(
    'toMonthly( $amount, $frequency ) agrees within 0.005',
    ({ amount, frequency }) => {
      const floatV = toMonthly(amount, frequency);
      const decV = toMonthlyDecimal(amount, frequency);
      expect(decV.minus(floatV).abs().lessThanOrEqualTo(new Decimal('0.005'))).toBe(true);
    },
  );
});
