/**
 * Phase 42 PR2 — Tests for split sum-validation.
 *
 * Sum-of-splits === transaction.amount ± SPLIT_SUM_EPSILON is the
 * single hard rule of the split layer; if it ever weakens, the
 * tax-pack export totals become unreliable. These tests are the
 * canary.
 *
 * The DB-touching paths (replaceSplits / clearSplits / listSplits)
 * are integration-tested elsewhere; this file covers the pure helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  assertSplitsBalance,
  SplitValidationError,
  SPLIT_SUM_EPSILON,
} from '../../lib/bookkeeping/splits';

describe('assertSplitsBalance', () => {
  it('accepts splits that sum exactly to parent amount', () => {
    expect(() =>
      assertSplitsBalance(-300, [{ amount: -240 }, { amount: -60 }])
    ).not.toThrow();
  });

  it('accepts splits that sum within $0.01 tolerance (cents rounding)', () => {
    // 33.34 + 33.33 + 33.33 = 100.00 exactly
    expect(() =>
      assertSplitsBalance(100, [{ amount: 33.34 }, { amount: 33.33 }, { amount: 33.33 }])
    ).not.toThrow();
    // Within tolerance
    expect(() =>
      assertSplitsBalance(100, [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }])
    ).not.toThrow();
  });

  it('rejects splits that miss by more than $0.01', () => {
    expect(() =>
      assertSplitsBalance(100, [{ amount: 33 }, { amount: 33 }, { amount: 33 }])
    ).toThrow(SplitValidationError);
  });

  it('rejects empty splits arrays (use clearSplits instead)', () => {
    expect(() => assertSplitsBalance(100, [])).toThrow(SplitValidationError);
    try {
      assertSplitsBalance(100, []);
    } catch (err) {
      expect(err).toBeInstanceOf(SplitValidationError);
      expect((err as SplitValidationError).code).toBe('EMPTY_SPLITS');
    }
  });

  it('rejects mismatched signs (positive splits on a negative parent)', () => {
    // The rule is on the SUM, not the per-split sign. So mixing signs
    // is fine if the math works:
    expect(() =>
      assertSplitsBalance(-100, [{ amount: -150 }, { amount: 50 }])
    ).not.toThrow();
    // But a flat sign flip on all splits fails:
    expect(() =>
      assertSplitsBalance(-100, [{ amount: 100 }])
    ).toThrow(SplitValidationError);
  });

  it('handles single-split case (degenerate but legal)', () => {
    expect(() => assertSplitsBalance(50, [{ amount: 50 }])).not.toThrow();
  });

  it('handles many-split case (10 lines)', () => {
    const splits = Array.from({ length: 10 }, () => ({ amount: 10 }));
    expect(() => assertSplitsBalance(100, splits)).not.toThrow();
  });

  it('handles zero-amount parent (legal but unusual)', () => {
    expect(() =>
      assertSplitsBalance(0, [{ amount: 50 }, { amount: -50 }])
    ).not.toThrow();
  });

  it('reports the actual difference in the error message', () => {
    try {
      assertSplitsBalance(100, [{ amount: 30 }, { amount: 60 }]);
    } catch (err) {
      expect((err as SplitValidationError).code).toBe('SUM_MISMATCH');
      expect((err as Error).message).toContain('90.00');
      expect((err as Error).message).toContain('100.00');
      expect((err as Error).message).toContain('10.00');
    }
  });
});

describe('SPLIT_SUM_EPSILON', () => {
  it('is exactly $0.01', () => {
    expect(SPLIT_SUM_EPSILON).toBe(0.01);
  });
});
