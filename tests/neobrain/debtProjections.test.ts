import { describe, it, expect } from 'vitest';
import { formatProjections, buildEngineProjections } from '@/lib/neobrain/debtProjections';
import type { LoanInput, PlanResult } from '@/lib/planning/debtPlanner';

/**
 * Neobrain §15 Phase C — debt-analysis projections are ENGINE-computed, never
 * AI-guessed. The numeric correctness lives in `runDebtPlan` (its own tested
 * unit); these tests pin THIS module's job: the format + the never-fabricate
 * branch. Deterministic — no engine call (hand-built PlanResult).
 */

function plan(over: Partial<PlanResult> = {}): PlanResult {
  return {
    loanResults: [],
    totalInterestPaid: 0,
    totalInterestSaved: 0,
    debtFreeDate: null,
    baselineDebtFreeDate: null,
    strategyUsed: 'AVALANCHE',
    ...over,
  };
}

describe('formatProjections — engine PlanResult → projections (format + branch)', () => {
  it('worked example: Mar-2031 vs Sep-2033 baseline, $45,000 saved → 30 months saved', () => {
    // monthsBetween(Mar 2031, Sep 2033) = (2033−2031)*12 + (8−2) = 30. Exact.
    const proj = formatProjections(
      plan({
        debtFreeDate: new Date(2031, 2, 15),
        baselineDebtFreeDate: new Date(2033, 8, 15),
        totalInterestSaved: 45000,
      }),
    );
    expect(proj.monthsSaved).toBe(30);
    expect(proj.totalInterestSaved).toBe(45000);
    expect(proj.debtFreeDate).toMatch(/\w{3} 2031/);
    expect(proj.comparedToMinimum).toContain('30 months');
    expect(proj.comparedToMinimum).toContain('45,000');
  });

  it('rounds interest saved and singularises "1 month"', () => {
    const proj = formatProjections(
      plan({
        debtFreeDate: new Date(2030, 0, 1),
        baselineDebtFreeDate: new Date(2030, 1, 1),
        totalInterestSaved: 1234.7,
      }),
    );
    expect(proj.monthsSaved).toBe(1);
    expect(proj.totalInterestSaved).toBe(1235);
    expect(proj.comparedToMinimum).toContain('1 month sooner');
  });

  it('NEVER fabricates a payoff date when the engine returns null (non-payoffable)', () => {
    const proj = formatProjections(plan({ debtFreeDate: null, totalInterestSaved: 0 }));
    expect(proj.debtFreeDate).toBe('Not payable off at the recommended surplus');
    expect(proj.monthsSaved).toBe(0);
  });

  it('handles a null baseline (monthsSaved 0) without crashing', () => {
    const proj = formatProjections(
      plan({ debtFreeDate: new Date(2032, 5, 1), baselineDebtFreeDate: null, totalInterestSaved: 0 }),
    );
    expect(proj.monthsSaved).toBe(0);
    expect(proj.debtFreeDate).toMatch(/\w{3} 2032/);
  });

  it('returns the exact DebtAnalysisResponse.projections shape', () => {
    const proj = formatProjections(plan({ debtFreeDate: new Date(2030, 0, 1) }));
    expect(Object.keys(proj).sort()).toEqual(
      ['comparedToMinimum', 'debtFreeDate', 'monthsSaved', 'totalInterestSaved'].sort(),
    );
  });
});

describe('buildEngineProjections — engine wiring smoke test', () => {
  function loan(over: Partial<LoanInput> = {}): LoanInput {
    return {
      id: 'l1', name: 'Test', type: 'HOME', principal: 100000, interestRateAnnual: 0.06,
      rateType: 'VARIABLE', fixedExpiry: null, isInterestOnly: false, termMonthsRemaining: 360,
      minRepayment: 600, repaymentFrequency: 'MONTHLY', offsetBalance: 0, extraRepaymentCap: null,
      ...over,
    };
  }

  it('runs the canonical engine and returns the projections shape (no number asserted — engine owns those)', () => {
    const proj = buildEngineProjections([loan()], 'AVALANCHE', 500);
    expect(Object.keys(proj).sort()).toEqual(
      ['comparedToMinimum', 'debtFreeDate', 'monthsSaved', 'totalInterestSaved'].sort(),
    );
    expect(typeof proj.debtFreeDate).toBe('string');
    expect(typeof proj.totalInterestSaved).toBe('number');
    expect(proj.totalInterestSaved).toBeGreaterThanOrEqual(0);
  });
});
