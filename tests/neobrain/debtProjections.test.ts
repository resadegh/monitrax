import { describe, it, expect } from 'vitest';
import { buildEngineProjections } from '@/lib/neobrain/debtProjections';
import type { LoanInput } from '@/lib/planning/debtPlanner';

/**
 * Neobrain §15 Phase C — debt-analysis projections are ENGINE-computed, never
 * AI-guessed. These pin the wiring (route → debtPlanner → projections) with a
 * deterministic worked example (§20.4).
 *
 * Worked example (0% interest → exact month arithmetic):
 *   $12,000 loan, 0% p.a., $100/mo minimum, 120-month term.
 *   - Baseline (minimum only): 12,000 / 100 = 120 months to clear.
 *   - With $300/mo recommended surplus: 12,000 / 400 = 30 months.
 *   ⇒ monthsSaved = 120 − 30 = 90.  interestSaved = $0 (0% rate).
 */
function loan(over: Partial<LoanInput> = {}): LoanInput {
  return {
    id: 'l1',
    name: 'Test Loan',
    type: 'HOME',
    principal: 12000,
    interestRateAnnual: 0, // decimal
    rateType: 'VARIABLE',
    fixedExpiry: null,
    isInterestOnly: false,
    termMonthsRemaining: 120,
    minRepayment: 100,
    repaymentFrequency: 'MONTHLY',
    offsetBalance: 0,
    extraRepaymentCap: null,
    ...over,
  };
}

describe('buildEngineProjections — engine-grounded debt projections', () => {
  it('worked example: 0% loan, $300/mo surplus → ~90 months saved, $0 interest saved', () => {
    // Hand-calc: baseline 12,000/100 = 120 months; with surplus 12,000/400 = 30
    // months ⇒ 90 saved. Allow ±2 for the engine's paid-off month indexing.
    const proj = buildEngineProjections([loan()], 'AVALANCHE', 300);
    expect(proj.monthsSaved).toBeGreaterThanOrEqual(88);
    expect(proj.monthsSaved).toBeLessThanOrEqual(90);
    expect(proj.totalInterestSaved).toBe(0); // 0% rate → exact
    expect(proj.debtFreeDate).toMatch(/\w{3} \d{4}/); // "Mon YYYY"
    expect(proj.comparedToMinimum).toContain('sooner');
  });

  it('an interest-bearing loan with surplus saves real interest (> $0)', () => {
    const proj = buildEngineProjections(
      [loan({ interestRateAnnual: 0.06, principal: 100000, minRepayment: 600, termMonthsRemaining: 360 })],
      'AVALANCHE',
      500,
    );
    expect(proj.totalInterestSaved).toBeGreaterThan(0);
    expect(proj.monthsSaved).toBeGreaterThan(0);
  });

  it('never fabricates a payoff date for a non-payoffable interest-only loan (no surplus)', () => {
    const proj = buildEngineProjections(
      [loan({ isInterestOnly: true, interestRateAnnual: 0.06 })],
      'AVALANCHE',
      0,
    );
    expect(proj.debtFreeDate).toBe('Not payable off at the recommended surplus');
    expect(proj.monthsSaved).toBe(0);
  });

  it('returns the exact DebtAnalysisResponse.projections shape', () => {
    const proj = buildEngineProjections([loan()], 'SNOWBALL', 200);
    expect(Object.keys(proj).sort()).toEqual(
      ['comparedToMinimum', 'debtFreeDate', 'monthsSaved', 'totalInterestSaved'].sort(),
    );
    expect(typeof proj.totalInterestSaved).toBe('number');
    expect(typeof proj.debtFreeDate).toBe('string');
  });
});
