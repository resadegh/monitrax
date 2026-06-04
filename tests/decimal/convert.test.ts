/**
 * Q-DEC PR 2.A — Conversion utility tests.
 *
 * Verifies the entry/exit policy + the IEEE-754 trap defence on
 * `toDecimal`. No engines, no harness — just the primitives.
 */

import { describe, it, expect } from 'vitest';
import {
  Decimal,
  toDecimal,
  toDecimalRequired,
  fromDecimal,
  sumDecimal,
  decimalDiff,
  isCloseEnough,
  getPolicyTolerance,
} from '@/lib/decimal';

describe('toDecimal — entry to Decimal-land', () => {
  it('returns null for null and undefined', () => {
    expect(toDecimal(null)).toBeNull();
    expect(toDecimal(undefined)).toBeNull();
  });

  it('returns null for non-finite numbers (Infinity, NaN)', () => {
    expect(toDecimal(Infinity)).toBeNull();
    expect(toDecimal(-Infinity)).toBeNull();
    expect(toDecimal(NaN)).toBeNull();
  });

  it('coerces number via string to avoid IEEE-754 carry-in', () => {
    // The notorious 0.1 + 0.2 case. JS computes 0.30000000000000004.
    // toDecimal must preserve the input AS-WRITTEN, not the binary
    // expansion of that input.
    const trap = 0.1 + 0.2;
    expect(trap).not.toBe(0.3); // sanity check that JS is what we think it is

    const dec = toDecimal(trap)!;
    // The Float 0.30000000000000004 routes through String() → "0.30000000000000004",
    // so the Decimal preserves that string. The point is that we are
    // EXACT about what came in — no silent Decimal smoothing.
    expect(dec.toString()).toBe('0.30000000000000004');
  });

  it('preserves clean decimal inputs without IEEE-754 noise', () => {
    expect(toDecimal(0.3)!.toString()).toBe('0.3');
    expect(toDecimal(1000.55)!.toString()).toBe('1000.55');
  });

  it('parses string inputs as-is', () => {
    expect(toDecimal('1234.5678')!.toString()).toBe('1234.5678');
    expect(toDecimal('0')!.toString()).toBe('0');
  });

  it('is idempotent on Decimal inputs', () => {
    const d = new Decimal('42.42');
    expect(toDecimal(d)).toBe(d);
  });
});

describe('toDecimalRequired — throws on null', () => {
  it('throws for null, undefined, NaN, Infinity', () => {
    expect(() => toDecimalRequired(null as unknown as number)).toThrow();
    expect(() => toDecimalRequired(undefined as unknown as number)).toThrow();
    expect(() => toDecimalRequired(NaN)).toThrow();
    expect(() => toDecimalRequired(Infinity)).toThrow();
  });

  it('returns Decimal for finite inputs', () => {
    expect(toDecimalRequired(0).toString()).toBe('0');
    expect(toDecimalRequired(1234.56).toString()).toBe('1234.56');
  });
});

describe('fromDecimal — exit from Decimal-land, per policy', () => {
  it('rounds currency to 2 dp HALF_EVEN', () => {
    expect(fromDecimal(new Decimal('1234.555'), 'currency')).toBe(1234.56); // .555 → .56 (HALF_EVEN to even)
    expect(fromDecimal(new Decimal('1234.565'), 'currency')).toBe(1234.56); // .565 → .56 (HALF_EVEN to even)
    expect(fromDecimal(new Decimal('1234.575'), 'currency')).toBe(1234.58); // .575 → .58 (HALF_EVEN to even)
  });

  it('rounds rates to 4 dp HALF_EVEN', () => {
    expect(fromDecimal(new Decimal('0.06255'), 'rate')).toBe(0.0626); // .55 → .6 (HALF_EVEN, since 5 is even-up here)
  });

  it('returns 0 for null input', () => {
    expect(fromDecimal(null, 'currency')).toBe(0);
  });
});

describe('sumDecimal — null-safe sum', () => {
  it('returns 0 for empty array', () => {
    expect(sumDecimal([]).toString()).toBe('0');
  });

  it('skips null and undefined entries', () => {
    const sum = sumDecimal([new Decimal('1.5'), null, new Decimal('2.5'), undefined]);
    expect(sum.toString()).toBe('4');
  });

  it('sums 100 × 0.1 EXACTLY to 10 (Decimal precision)', () => {
    // The Float path of this exact sum drifts: 0.1 × 100 in Float
    // famously equals 9.99999... at full precision. Decimal stays
    // at 10 exactly.
    const sum = sumDecimal(Array.from({ length: 100 }, () => new Decimal('0.1')));
    expect(sum.toString()).toBe('10');

    // Confirm the Float drift exists so we understand what we're
    // defending against.
    let floatSum = 0;
    for (let i = 0; i < 100; i += 1) floatSum += 0.1;
    expect(floatSum).not.toBe(10);
  });
});

describe('decimalDiff — Float vs Decimal comparison', () => {
  it('flags identical values as within tolerance', () => {
    const diff = decimalDiff(100.5, new Decimal('100.5'), 'currency');
    expect(diff.absDiff.toString()).toBe('0');
    expect(diff.withinTolerance).toBe(true);
  });

  it('treats sub-cent diffs as within currency tolerance', () => {
    // 0.004 < 0.005 cent tolerance → still rounds to the same cent.
    const diff = decimalDiff(100.5, new Decimal('100.504'), 'currency');
    expect(diff.absDiff.equals(new Decimal('0.004'))).toBe(true);
    expect(diff.withinTolerance).toBe(true);
  });

  it('flags above-tolerance diffs as DIFF', () => {
    const diff = decimalDiff(100.5, new Decimal('100.51'), 'currency');
    expect(diff.absDiff.equals(new Decimal('0.01'))).toBe(true);
    expect(diff.withinTolerance).toBe(false);
  });

  it('uses rate tolerance for rate policy', () => {
    // Diff = 0.0001 — over rate tolerance (0.00005), under currency
    // tolerance (0.005). Same numeric diff, different verdict per policy.
    const rateDiff = decimalDiff(0.0625, new Decimal('0.0626'), 'rate');
    expect(rateDiff.withinTolerance).toBe(false);
    const currencyDiff = decimalDiff(0.0625, new Decimal('0.0626'), 'currency');
    expect(currencyDiff.withinTolerance).toBe(true);
  });

  it('pctDiff stays sane when both values are 0 (uses epsilon=1 denominator)', () => {
    const diff = decimalDiff(0, new Decimal(0), 'currency');
    expect(diff.pctDiff.toString()).toBe('0');
  });
});

describe('isCloseEnough — convenience wrapper', () => {
  it('agrees with decimalDiff(.withinTolerance)', () => {
    expect(isCloseEnough(100.5, new Decimal('100.5'), 'currency')).toBe(true);
    expect(isCloseEnough(100.5, new Decimal('100.51'), 'currency')).toBe(false);
  });
});

describe('getPolicyTolerance — known constants', () => {
  it('returns 0.005 for currency', () => {
    expect(getPolicyTolerance('currency').toString()).toBe('0.005');
  });
  it('returns 0.00005 for rate/units/percentage', () => {
    expect(getPolicyTolerance('rate').toString()).toBe('0.00005');
    expect(getPolicyTolerance('units').toString()).toBe('0.00005');
    expect(getPolicyTolerance('percentage').toString()).toBe('0.00005');
  });
});
