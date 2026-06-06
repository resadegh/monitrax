/**
 * Q-DEC PR 3.B — Tests for `serializeDecimalsForJson`.
 *
 * The walker is the JSON boundary for every Decimal-engine API route.
 * Coverage:
 *   - Decimal → number conversion via fromDecimal(policy)
 *   - Per-path policy overrides
 *   - Non-Decimal leaves pass through (strings, booleans, null, Date)
 *   - Nested objects + arrays + null-safety
 */

import { describe, it, expect } from 'vitest';
import { Decimal, serializeDecimalsForJson } from '@/lib/decimal';

describe('serializeDecimalsForJson — basic conversion', () => {
  it('converts top-level Decimal to number', () => {
    const r = serializeDecimalsForJson(new Decimal('123.456'));
    expect(r).toBe(123.46);
  });

  it('null passes through', () => {
    expect(serializeDecimalsForJson(null)).toBeNull();
  });

  it('undefined passes through', () => {
    expect(serializeDecimalsForJson(undefined)).toBeUndefined();
  });

  it('primitive types pass through', () => {
    expect(serializeDecimalsForJson('hello')).toBe('hello');
    expect(serializeDecimalsForJson(42)).toBe(42);
    expect(serializeDecimalsForJson(true)).toBe(true);
  });

  it('Date passes through unchanged', () => {
    const d = new Date('2026-06-06T00:00:00Z');
    expect(serializeDecimalsForJson(d)).toBe(d);
  });
});

describe('serializeDecimalsForJson — nested structures', () => {
  it('converts Decimal inside object', () => {
    const r = serializeDecimalsForJson({
      total: new Decimal('100.50'),
      label: 'monthly',
    });
    expect(r).toEqual({ total: 100.5, label: 'monthly' });
  });

  it('converts Decimal inside array', () => {
    const r = serializeDecimalsForJson([new Decimal('1.25'), new Decimal('2.75')]);
    expect(r).toEqual([1.25, 2.75]);
  });

  it('traverses deeply nested structures', () => {
    const r = serializeDecimalsForJson({
      tax: {
        netTax: new Decimal('12345.67'),
        offsets: {
          lito: new Decimal('700'),
          total: new Decimal('700'),
        },
      },
      warnings: ['Low PAYG'],
    });
    expect(r).toEqual({
      tax: {
        netTax: 12345.67,
        offsets: { lito: 700, total: 700 },
      },
      warnings: ['Low PAYG'],
    });
  });

  it('handles array of objects', () => {
    const r = serializeDecimalsForJson({
      entities: [
        { id: 'e1', tax: new Decimal('5000') },
        { id: 'e2', tax: new Decimal('7000') },
      ],
    });
    expect(r).toEqual({
      entities: [
        { id: 'e1', tax: 5000 },
        { id: 'e2', tax: 7000 },
      ],
    });
  });
});

describe('serializeDecimalsForJson — policy overrides', () => {
  it('default currency policy rounds to 2dp HALF_EVEN', () => {
    const r = serializeDecimalsForJson(new Decimal('123.455'));
    // 0.005 → banker's rounding to nearest even → 123.46
    expect(r).toBe(123.46);
  });

  it('rate policy keeps 4dp', () => {
    const r = serializeDecimalsForJson(
      { rate: new Decimal('0.06521') },
      { policyByPath: { rate: 'rate' } },
    );
    expect(r).toEqual({ rate: 0.0652 });
  });

  it('default policy override applies to all paths', () => {
    const r = serializeDecimalsForJson(
      { a: new Decimal('0.1234'), b: new Decimal('0.5678') },
      { defaultPolicy: 'rate' },
    );
    expect(r).toEqual({ a: 0.1234, b: 0.5678 });
  });

  it('per-path override beats default', () => {
    const r = serializeDecimalsForJson(
      {
        money: new Decimal('123.456'),
        rate: new Decimal('0.123456'),
      },
      {
        defaultPolicy: 'currency',
        policyByPath: { rate: 'rate' },
      },
    );
    expect(r).toEqual({ money: 123.46, rate: 0.1235 });
  });
});

describe('serializeDecimalsForJson — nulls in nested structures', () => {
  it('preserves null leaves (e.g. ECPI null when proportion missing)', () => {
    const r = serializeDecimalsForJson({
      tax: null,
      investmentIncomeTax: null,
      contributionsTax: new Decimal('3750'),
    });
    expect(r).toEqual({
      tax: null,
      investmentIncomeTax: null,
      contributionsTax: 3750,
    });
  });

  it('null array entries pass through', () => {
    const r = serializeDecimalsForJson([new Decimal('1'), null, new Decimal('3')]);
    expect(r).toEqual([1, null, 3]);
  });
});

describe('serializeDecimalsForJson — JSON.stringify round-trip', () => {
  it('output is JSON.stringify-safe', () => {
    const r = serializeDecimalsForJson({
      totals: {
        netTax: new Decimal('12500.75'),
        paygWithheld: new Decimal('15000'),
      },
      uncomputed: [{ id: 'UC-FBT', rationale: 'pending' }],
    });
    const json = JSON.stringify(r);
    expect(json).toContain('"netTax":12500.75');
    expect(json).toContain('"paygWithheld":15000');
    expect(json).toContain('"UC-FBT"');
  });
});
