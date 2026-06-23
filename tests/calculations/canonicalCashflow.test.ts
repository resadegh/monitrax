/**
 * SSOT drift guard — canonical monthly cashflow accessor (2026-06-23).
 *
 * Pins the actuals-vs-declared contract (CLAUDE.md §19.1): when actual
 * transactions exist, every flow figure comes from them; declared records
 * are the fallback ONLY when no transactions exist. This is the single
 * accessor every cashflow-emitting surface must call.
 */
import { describe, it, expect } from 'vitest';
import { getCanonicalMonthlyCashflow } from '@/lib/calculations/canonicalCashflow';

// Minimal snapshot slices — only the fields the accessor reads.
function makeSnapshot(over: {
  hasActualData: boolean;
  actualMonthlyInflow?: number;
  actualMonthlyOutflow?: number;
  actualNetCashflow?: number;
  actualAvgMonthlyOutflow?: number;
  monthlyNetIncome?: number;
  monthlyExpenses?: number;
  monthlyLoanRepayments?: number;
  monthlyCashflow?: number;
}) {
  return {
    cashflow: {
      monthlyNetIncome: over.monthlyNetIncome ?? 0,
      monthlyExpenses: over.monthlyExpenses ?? 0,
      monthlyLoanRepayments: over.monthlyLoanRepayments ?? 0,
      monthlyCashflow: over.monthlyCashflow ?? 0,
    },
    quickMetrics: {
      hasActualData: over.hasActualData,
      actualMonthlyInflow: over.actualMonthlyInflow ?? 0,
      actualMonthlyOutflow: over.actualMonthlyOutflow ?? 0,
      actualNetCashflow: over.actualNetCashflow ?? 0,
      actualAvgMonthlyOutflow: over.actualAvgMonthlyOutflow ?? 0,
    },
  } as never;
}

describe('getCanonicalMonthlyCashflow — actuals win when present', () => {
  it('uses ACTUAL figures and reports a real deficit (basis: actual)', () => {
    // Real situation from the audit: In 25,827 / Out 46,741 / Net -20,914.
    const r = getCanonicalMonthlyCashflow(
      makeSnapshot({
        hasActualData: true,
        actualMonthlyInflow: 25827,
        actualMonthlyOutflow: 46741,
        actualNetCashflow: -20914,
        actualAvgMonthlyOutflow: 30000,
        // Declared fiction that must be IGNORED when actuals exist:
        monthlyNetIncome: 20217,
        monthlyExpenses: 9712,
        monthlyLoanRepayments: 0,
        monthlyCashflow: 10505,
      })
    );
    expect(r.basis).toBe('actual');
    expect(r.inflow).toBe(25827);
    expect(r.outflow).toBe(46741);
    expect(r.net).toBe(-20914);
    // Saving rate is honest: -20914 / 25827 × 100 ≈ -80.98% (NOT +51.9%).
    expect(r.savingsRate).toBeCloseTo(-80.98, 1);
  });

  it('falls back to DECLARED only when no transactions (basis: declared)', () => {
    const r = getCanonicalMonthlyCashflow(
      makeSnapshot({
        hasActualData: false,
        monthlyNetIncome: 8000,
        monthlyExpenses: 5000,
        monthlyLoanRepayments: 1000,
        monthlyCashflow: 2000,
      })
    );
    expect(r.basis).toBe('declared');
    expect(r.inflow).toBe(8000);
    expect(r.outflow).toBe(6000); // expenses + loan repayments
    expect(r.net).toBe(2000);
    expect(r.savingsRate).toBeCloseTo(25, 6); // 2000 / 8000
  });

  it('avgMonthlyOutflow falls to current outflow when trailing avg is empty (sparse history)', () => {
    const r = getCanonicalMonthlyCashflow(
      makeSnapshot({
        hasActualData: true,
        actualMonthlyInflow: 5000,
        actualMonthlyOutflow: 4000,
        actualNetCashflow: 1000,
        actualAvgMonthlyOutflow: 0, // no prior full months
      })
    );
    expect(r.avgMonthlyOutflow).toBe(4000);
  });

  it('savingsRate is 0 when there is no inflow (no divide-by-zero)', () => {
    const r = getCanonicalMonthlyCashflow(
      makeSnapshot({ hasActualData: true, actualMonthlyInflow: 0, actualMonthlyOutflow: 100, actualNetCashflow: -100 })
    );
    expect(r.savingsRate).toBe(0);
  });
});
