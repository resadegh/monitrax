/**
 * MON-040 — tax optimisation recommendations showed impossible values
 * ("save 3685%", "$1,105,500", "$6,274,704").
 *
 * Root cause: `generateRecommendations` read `tax.marginalRate` as a DECIMAL
 * fraction, but it is a PERCENT (37 for the 37% bracket — `incomeTaxCalculator`
 * returns `marginalRate * 100`, and the tax page renders it as a percent). So
 * `(marginalRate - 0.15)` was `36.85` and `× 100` → 3685%; `remainingCap × 36.85`
 * → ~$1.1M. Fix: use the decimal `mr = marginalRate / 100` for rate arithmetic,
 * keep the percent convention (`marginalRate - 15` for the "% saved").
 *
 * Ring-0 lock: a 37%-bracket taxpayer with unused concessional cap gets a
 * salary-sacrifice rec that saves 22% (37 − 15), a realistic dollar figure, and
 * — the cheap class invariant — no recommendation can "save" more tax than the
 * user actually owes.
 */
import { describe, it, expect } from 'vitest';
import { calculateTaxPosition } from '../../lib/tax-engine/position/taxPositionCalculator';

// $150k salary → the 37% marginal bracket (2025-26), unused concessional cap.
const position = calculateTaxPosition({
  incomes: [{ id: 'sal', name: 'Salary', type: 'SALARY', amount: 150000, frequency: 'ANNUAL', isTaxable: true }],
  expenses: [],
  depreciations: [],
});

describe('MON-040 · tax recommendations are realistic', () => {
  const salSac = position.recommendations.find((r) => r.id === 'salary-sacrifice');

  it('a salary-sacrifice recommendation is produced for the 37% bracket', () => {
    expect(salSac).toBeDefined();
  });

  it('the % saved reads 22% (37 − 15), NOT 3685%', () => {
    expect(salSac?.description).toMatch(/save 22% compared/);
    expect(salSac?.description).not.toMatch(/3685/);
    // no absurd 3+ digit percentage anywhere in the copy
    expect(salSac?.description).not.toMatch(/save \d{3,}%/);
  });

  it('the dollar savings is realistic (cap × 22%, ~$6.6k) — not ~$1.1M', () => {
    expect(salSac!.potentialSavings).toBeGreaterThan(0);
    expect(salSac!.potentialSavings).toBeLessThan(20000); // 30k cap × 0.22 = 6,600
  });

  it('CLASS INVARIANT — no recommendation "saves" more tax than is owed', () => {
    const netTax = position.tax.netTax;
    for (const r of position.recommendations) {
      expect(r.potentialSavings ?? 0).toBeLessThanOrEqual(netTax);
    }
  });

  it('negative control — the decimal-misread bug would have produced ≥ 100000', () => {
    // 30,000 cap × (37 − 0.15) = 1,105,500 (the bug). The assertions above forbid it.
    expect(30000 * (37 - 0.15)).toBeCloseTo(1105500, 0);
  });
});
