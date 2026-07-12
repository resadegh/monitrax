/**
 * NeoAudit Scenario Lab — Tier 1 authored scenario "high-gear" (NEOAUDIT.md §2).
 *
 * A single, fully-specified property with every headline number hand-computed
 * (§19.2), asserted through the canonical `computePropertyCashflow` engine.
 * This is the VR-001 stress shape: 104% LVR, interest-only (no minRepayment →
 * interest floor), fortnightly rent, mixed-cadence expenses, negative cashflow.
 *
 * The manifest below IS the spec — every value is derived by hand from the
 * amount×frequency rules and the engine's documented behaviour, NOT read back
 * from the engine. If the engine drifts, these break.
 */
import { describe, it, expect } from 'vitest';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

// ── Inputs (fixed) ──────────────────────────────────────────────────────────
const SCENARIO = {
  // Rent: $1,000 per fortnight → monthly 1000×26/12 = 2,166.6667 → annual 26,000.
  income: [{ id: 'inc-rent', type: 'RENTAL', amount: 1000, frequency: 'FORTNIGHTLY' }],
  // Council rates $1,200/quarter → annual 4,800. Insurance $1,200/year → 1,200.
  // Total annual expenses = 6,000 → monthly 500.
  expenses: [
    { id: 'exp-rates', amount: 1200, frequency: 'QUARTERLY' },
    { id: 'exp-ins', amount: 1200, frequency: 'ANNUAL' },
  ],
  // Loan $520k @ 6% p.a., interest-only (no minRepayment, no actuals) →
  // engine floors to interest: 520,000 × 0.06 / 12 = 2,600/mo → annual 31,200.
  loans: [{ id: 'loan-1', principal: 520_000, interestRateAnnual: 0.06, minRepayment: null }],
};

// ── Hand-computed expected outputs ──────────────────────────────────────────
const EXPECTED = {
  annualRent: 26_000, // 1000 × 26
  annualExpenses: 6_000, // 1200×4 + 1200
  monthlyLoanRepayment: 2_600, // interest floor 520000×0.06/12
  annualLoanRepayment: 31_200, // 2600 × 12
  annualLoanInterest: 31_200, // same — it IS interest-only here
  annualCashflow: 26_000 - 6_000 - 31_200, // = -11,200
  annualTaxCashflow: 26_000 - 6_000 - 31_200, // interest = repayment → identical = -11,200
};

describe('Scenario "high-gear": engine output matches the hand-computed manifest', () => {
  const cf = computePropertyCashflow(SCENARIO);

  it('annual rent = $26,000 (fortnightly ×26)', () => {
    expect(cf.annualRent).toBeCloseTo(EXPECTED.annualRent, 2);
  });

  it('annual expenses = $6,000 (quarterly rates + annual insurance)', () => {
    expect(cf.annualExpenses).toBeCloseTo(EXPECTED.annualExpenses, 2);
  });

  it('interest-only loan floors to $2,600/mo (never silently $0)', () => {
    expect(cf.monthlyLoanRepayment).toBeCloseTo(EXPECTED.monthlyLoanRepayment, 2);
    expect(cf.annualLoanRepayment).toBeCloseTo(EXPECTED.annualLoanRepayment, 2);
    expect(cf.loanLines[0].flooredToInterest).toBe(true);
  });

  it('annual cashflow = −$11,200 (rent − expenses − repayment)', () => {
    expect(cf.annualCashflow).toBeCloseTo(EXPECTED.annualCashflow, 2);
    expect(cf.annualCashflow).toBeLessThan(0); // the stress shape is negative
  });

  it('tax cashflow equals cash cashflow here (loan cost is pure interest)', () => {
    expect(cf.annualTaxCashflow).toBeCloseTo(EXPECTED.annualTaxCashflow, 2);
    expect(cf.annualLoanInterest).toBeCloseTo(EXPECTED.annualLoanInterest, 2);
  });

  it('declared basis (no reconciled transactions supplied)', () => {
    expect(cf.basis).toBe('declared');
  });
});
