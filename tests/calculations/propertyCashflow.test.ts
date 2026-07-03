/**
 * MON-002 — canonical per-property cashflow (§19.2 worked examples + §19.4
 * cross-surface one-source proof).
 *
 * Verifies: actuals-first (real cadence wins over declared frequency), loan cost
 * NEVER silently $0, P&I-vs-interest split, and that BOTH property surfaces read
 * this one engine (no second inline producer).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { computePropertyCashflow } from '../../lib/calculations/propertyCashflow';

describe('computePropertyCashflow', () => {
  // ── Worked example: Thornlands Lot 2 (declared, minRepayment = 0) ──
  // The bug this fixes: cashflow was $33,800 == rent, i.e. NOTHING subtracted
  // for the $482k @ 6.49% loan. Now the loan cost floors to interest.
  it('Lot 2: loan cost is never $0 (floors to interest) — declared', () => {
    const cf = computePropertyCashflow({
      income: [{ type: 'RENTAL', amount: 650, frequency: 'WEEKLY' }],
      expenses: [],
      loans: [{ principal: 482000, interestRateAnnual: 0.0649, minRepayment: 0 }],
    });
    expect(cf.annualRent).toBeCloseTo(33800, 2); // 650 × 52
    expect(cf.annualLoanInterest).toBeCloseTo(31281.8, 2); // 482000 × 0.0649
    expect(cf.annualLoanRepayment).toBeCloseTo(31281.8, 2); // floored to interest (never 0)
    expect(cf.annualLoanRepayment).not.toBe(0);
    expect(cf.annualCashflow).toBeCloseTo(2518.2, 2); // 33800 − 0 − 31281.8 (was wrongly +33,800)
    expect(cf.basis).toBe('declared');
  });

  // ── Worked example: Thornlands Lot 1 (declared, manual P&I repayment) ──
  it('Lot 1: manual P&I repayment; headline uses P&I, tax uses interest', () => {
    const cf = computePropertyCashflow({
      income: [{ type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' }],
      expenses: [{ amount: 43546, frequency: 'ANNUAL' }],
      loans: [{ principal: 947076, interestRateAnnual: 0.0649, minRepayment: 5975.38, repaymentFrequency: 'MONTHLY' }],
    });
    expect(cf.annualRent).toBeCloseTo(14340, 2); // 1195 × 12
    expect(cf.annualLoanRepayment).toBeCloseTo(71704.56, 2); // 5975.38 × 12 (P&I)
    expect(cf.annualLoanInterest).toBeCloseTo(61465.23, 2); // 947076 × 0.0649
    // headline (cash, P&I) — matches the -$100,912 the user saw
    expect(cf.annualCashflow).toBeCloseTo(-100910.56, 2);
    // tax (interest-only) is less negative than the cash figure
    expect(cf.annualTaxCashflow).toBeCloseTo(-90671.23, 2);
    expect(cf.annualTaxCashflow).toBeGreaterThan(cf.annualCashflow);
  });

  // ── Worked example: actuals-first beats a wrong declared frequency ──
  // A fortnightly rent mis-stored as MONTHLY: declared ×12 = $14,340 (wrong),
  // but the reconciled monthly average (from the fortnightly cadence) wins.
  it('actuals-first: reconciled cadence overrides a wrong declared frequency', () => {
    const monthlyAvg = (1195 * 26) / 12; // fortnightly $1195 expressed monthly
    const cf = computePropertyCashflow({
      income: [{ type: 'RENTAL', amount: 1195, frequency: 'MONTHLY', hasTransactions: true, monthlyAverageActual: monthlyAvg }],
    });
    expect(cf.annualRent).toBeCloseTo(1195 * 26, 2); // ≈ $31,070, NOT $14,340
    expect(cf.usedActuals.income).toBe(true);
    expect(cf.basis).toBe('actual');
  });

  it('actual loan repayment (captured) drives the P&I, ignoring the manual value', () => {
    const cf = computePropertyCashflow({
      loans: [{ principal: 500000, interestRateAnnual: 0.06, minRepayment: 1, repaymentFrequency: 'MONTHLY', hasTransactions: true, monthlyAverageActual: 3000 }],
    });
    expect(cf.annualLoanRepayment).toBeCloseTo(36000, 2); // 3000 × 12, not the manual 1×12
    expect(cf.usedActuals.loans).toBe(true);
  });

  it('empty property is all zeros, declared basis', () => {
    const cf = computePropertyCashflow({});
    expect(cf.annualCashflow).toBe(0);
    expect(cf.basis).toBe('declared');
  });
});

// ── §19.4 ONE-SOURCE proof: every property surface reads this engine, and no
//    surface re-derives cashflow inline. If a second producer reappears, fail. ──
describe('property cashflow — single source (§19.4)', () => {
  const ROOT = resolve(__dirname, '../..');
  const surfaces = [
    'app/dashboard/properties/[id]/page.tsx',
    'app/dashboard/properties/page.tsx',
  ];
  for (const rel of surfaces) {
    it(`${rel} reads the canonical engine and has no inline cashflow producer`, () => {
      const src = readFileSync(resolve(ROOT, rel), 'utf8');
      expect(src).toMatch(/computePropertyCashflow/); // reads the one engine
      // No second producer: the old inline function must be gone.
      expect(src).not.toMatch(/function\s+computeCashflow\b/);
    });
  }
});
