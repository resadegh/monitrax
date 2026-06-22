/**
 * Actual-cashflow engine tests — Phase 1 (cashflow-actuals).
 *
 * Pins the headline-correctness contract of
 * `lib/calculations/actualCashflow.ts`:
 *   - transfers excluded
 *   - uncategorised OUT bucketed under 'Uncategorised' AND counted in totals
 *   - Math.abs() applied to negative amounts
 *   - IN vs OUT split by `direction` (not amount sign)
 *   - trailing-3-full-month average maths (fixed /3 divisor)
 *   - empty input → all-zero result with hasActualData=false
 */

import { describe, it, expect } from 'vitest';
import {
  computeActualCashflow,
  UNCATEGORISED_LABEL,
  type ActualCashflowTransaction,
} from '@/lib/calculations/actualCashflow';

// Fixed reference "now" so month bucketing is deterministic: 2026-06-15.
const NOW = new Date(2026, 5, 15); // month index 5 = June
const CURRENT = (day: number) => new Date(2026, 5, day);
const MAY = (day: number) => new Date(2026, 4, day);
const APRIL = (day: number) => new Date(2026, 3, day);
const MARCH = (day: number) => new Date(2026, 2, day);

function tx(p: Partial<ActualCashflowTransaction>): ActualCashflowTransaction {
  return {
    date: CURRENT(2),
    amount: 100,
    direction: 'OUT',
    categoryLevel1: 'Groceries',
    isTransfer: false,
    ...p,
  };
}

describe('computeActualCashflow', () => {
  it('returns all-zero, hasActualData=false for empty input', () => {
    const r = computeActualCashflow([], { now: NOW });
    expect(r).toEqual({
      currentMonthOutflow: 0,
      currentMonthInflow: 0,
      currentMonthNet: 0,
      avgMonthlyOutflow: 0,
      avgMonthlyInflow: 0,
      outflowByCategory: {},
      hasActualData: false,
    });
  });

  it('excludes transfers from every total', () => {
    const r = computeActualCashflow(
      [
        tx({ amount: 500, direction: 'OUT', isTransfer: true }),
        tx({ amount: 500, direction: 'IN', isTransfer: true }),
        tx({ amount: 200, direction: 'OUT', isTransfer: false }),
      ],
      { now: NOW }
    );
    expect(r.currentMonthOutflow).toBe(200);
    expect(r.currentMonthInflow).toBe(0);
    expect(r.outflowByCategory).toEqual({ Groceries: 200 });
    // Only the non-transfer row counts for hasActualData.
    expect(r.hasActualData).toBe(true);
  });

  it('treats a window of only transfers as no actual data', () => {
    const r = computeActualCashflow(
      [tx({ direction: 'OUT', isTransfer: true })],
      { now: NOW }
    );
    expect(r.hasActualData).toBe(false);
    expect(r.currentMonthOutflow).toBe(0);
  });

  it('buckets null/empty category under Uncategorised and counts it', () => {
    const r = computeActualCashflow(
      [
        tx({ amount: 80, categoryLevel1: null }),
        tx({ amount: 20, categoryLevel1: '' }),
        tx({ amount: 50, categoryLevel1: 'Dining' }),
      ],
      { now: NOW }
    );
    expect(r.outflowByCategory[UNCATEGORISED_LABEL]).toBe(100);
    expect(r.outflowByCategory.Dining).toBe(50);
    // Uncategorised is INCLUDED in the headline outflow total.
    expect(r.currentMonthOutflow).toBe(150);
  });

  it('uses Math.abs on negative OUT amounts', () => {
    const r = computeActualCashflow(
      [
        tx({ amount: -300, direction: 'OUT', categoryLevel1: 'Rent' }),
        tx({ amount: 100, direction: 'OUT', categoryLevel1: 'Rent' }),
      ],
      { now: NOW }
    );
    expect(r.currentMonthOutflow).toBe(400);
    expect(r.outflowByCategory.Rent).toBe(400);
  });

  it('splits IN vs OUT by direction, not amount sign', () => {
    const r = computeActualCashflow(
      [
        tx({ amount: -5000, direction: 'IN' }), // negative but it's income
        tx({ amount: 1200, direction: 'OUT', categoryLevel1: 'Bills' }),
      ],
      { now: NOW }
    );
    expect(r.currentMonthInflow).toBe(5000);
    expect(r.currentMonthOutflow).toBe(1200);
    expect(r.currentMonthNet).toBe(3800);
    // IN never appears in the outflow breakdown.
    expect(r.outflowByCategory).toEqual({ Bills: 1200 });
  });

  it('computes currentMonthNet as inflow minus outflow (can be negative)', () => {
    const r = computeActualCashflow(
      [
        tx({ amount: 1000, direction: 'IN' }),
        tx({ amount: 1500, direction: 'OUT', categoryLevel1: 'Spend' }),
      ],
      { now: NOW }
    );
    expect(r.currentMonthNet).toBe(-500);
  });

  it('averages the trailing 3 FULL months with a fixed /3 divisor', () => {
    // March OUT 300, April OUT 600, May OUT 900 → avg = 1800/3 = 600.
    // Current-month rows must NOT affect the average.
    const r = computeActualCashflow(
      [
        tx({ date: MARCH(10), amount: 300, direction: 'OUT' }),
        tx({ date: APRIL(10), amount: 600, direction: 'OUT' }),
        tx({ date: MAY(10), amount: 900, direction: 'OUT' }),
        tx({ date: CURRENT(5), amount: 9999, direction: 'OUT' }),
        // trailing inflow: only April 1200 → avg = 1200/3 = 400.
        tx({ date: APRIL(12), amount: 1200, direction: 'IN' }),
      ],
      { now: NOW }
    );
    expect(r.avgMonthlyOutflow).toBe(600);
    expect(r.avgMonthlyInflow).toBe(400);
    // current month outflow is the 9999 row only
    expect(r.currentMonthOutflow).toBe(9999);
  });

  it('a zero-spend trailing month still divides by 3', () => {
    // Only May has spend (600); March + April empty → avg = 600/3 = 200.
    const r = computeActualCashflow(
      [tx({ date: MAY(10), amount: 600, direction: 'OUT' })],
      { now: NOW }
    );
    expect(r.avgMonthlyOutflow).toBe(200);
  });

  it('excludes transfers from the trailing average too', () => {
    const r = computeActualCashflow(
      [
        tx({ date: APRIL(10), amount: 5000, direction: 'OUT', isTransfer: true }),
        tx({ date: APRIL(11), amount: 300, direction: 'OUT', isTransfer: false }),
      ],
      { now: NOW }
    );
    expect(r.avgMonthlyOutflow).toBe(100); // 300 / 3
  });
});
