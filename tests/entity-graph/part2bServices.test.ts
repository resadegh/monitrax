/**
 * Phase 44 Part 2b — money-flow service data-quality tests.
 *
 * The Part 2b services are DB writers (not unit-testable without a
 * database), but their pure data-quality checks — the digital-twin
 * "record + warn, never reject" logic (PHASE_44 §6.1) — are extracted
 * as pure helpers and pinned here.
 */

import { describe, it, expect } from 'vitest';
import { allocationShareWarning } from '@/lib/services/distributionResolutionService';
import { paymentSumWarning } from '@/lib/services/dividendDistributionService';
import { isValidRuleValue } from '@/lib/services/trustDeedRuleService';

describe('Phase 44 Part 2b — allocationShareWarning', () => {
  it('returns null when the allocation shares sum to 100%', () => {
    expect(allocationShareWarning([0.5, 0.5])).toBeNull();
    expect(allocationShareWarning([1])).toBeNull();
    expect(allocationShareWarning([0.25, 0.25, 0.25, 0.25])).toBeNull();
  });

  it('warns when the shares do not sum to 100%', () => {
    const w = allocationShareWarning([0.5, 0.3]);
    expect(w).not.toBeNull();
    expect(w).toContain('80.00%');
  });

  it('warns on an over-100% split', () => {
    expect(allocationShareWarning([0.6, 0.6])).toContain('120.00%');
  });

  it('tolerates tiny Decimal rounding drift', () => {
    expect(allocationShareWarning([0.333333, 0.333333, 0.333334])).toBeNull();
  });
});

describe('Phase 44 Part 2b — paymentSumWarning', () => {
  it('returns null when the per-shareholder payments sum to the declared total', () => {
    expect(paymentSumWarning([6000, 4000], 10000)).toBeNull();
    expect(paymentSumWarning([10000], 10000)).toBeNull();
  });

  it('warns when the payments do not reconcile to the total', () => {
    const w = paymentSumWarning([6000, 3000], 10000);
    expect(w).not.toBeNull();
    expect(w).toContain('9000');
    expect(w).toContain('10000');
  });

  it('tolerates a sub-cent rounding difference', () => {
    expect(paymentSumWarning([3333.33, 3333.33, 3333.34], 10000)).toBeNull();
  });
});

describe('Phase 44 Part 2b — isValidRuleValue', () => {
  it('accepts a non-null JSON object', () => {
    expect(isValidRuleValue({ beneficiaryClass: 'PRIMARY' })).toBe(true);
    expect(isValidRuleValue({})).toBe(true);
  });

  it('rejects null, arrays and primitives', () => {
    expect(isValidRuleValue(null)).toBe(false);
    expect(isValidRuleValue(undefined)).toBe(false);
    expect(isValidRuleValue([1, 2, 3])).toBe(false);
    expect(isValidRuleValue('a string')).toBe(false);
    expect(isValidRuleValue(42)).toBe(false);
    expect(isValidRuleValue(true)).toBe(false);
  });
});
