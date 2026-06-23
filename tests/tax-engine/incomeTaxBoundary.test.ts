/**
 * P0 regression — income-tax bracket-boundary bug (2026-06-23).
 *
 * The loop used `if (taxableIncome <= bracket.min) break;`. Because `tax` is
 * only assigned inside the bracket-match block, an income EXACTLY equal to a
 * bracket minimum ($45,001 / $135,001 / $190,001) broke out with `tax` still 0
 * → the calculator returned $0 tax at every bracket boundary. Fixed to strict
 * `<` (and `.lt` in the Decimal sibling). `bracket.min` is the inclusive lower
 * bound (prior bracket max + 1), so income equal to it belongs IN that bracket.
 *
 * Expected values are FY24-25 ATO scale tax (Stage-3), EXCLUDING Medicare levy
 * (this calculator returns scale tax only). Hand-derived per bracket:
 *   45,001 → 4288 + (45001-45001+1)*0.30   = 4288.30
 *  135,001 → 31288 + (135001-135001+1)*0.37 = 31288.37
 *  190,001 → 51638 + (190001-190001+1)*0.45 = 51638.45
 */
import { describe, it, expect } from 'vitest';
import { calculateIncomeTax } from '@/lib/tax-engine/core/incomeTaxCalculator';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const cfg = getTaxYearConfig('2024-25');
const tax = (ti: number) => calculateIncomeTax(ti, cfg).taxPayable;

describe('incomeTax FY24-25 — bracket boundaries (P0 regression)', () => {
  it('the exact bracket-minimum incomes are NOT zeroed', () => {
    expect(tax(45001)).toBeCloseTo(4288.3, 2);   // was $0 before the fix
    expect(tax(135001)).toBeCloseTo(31288.37, 2); // was $0 before the fix
    expect(tax(190001)).toBeCloseTo(51638.45, 2); // was $0 before the fix
    expect(tax(18201)).toBeCloseTo(0.16, 2);      // was $0 before the fix
  });

  it('bracket maxima (base amounts) are exact', () => {
    expect(tax(18200)).toBe(0);
    expect(tax(45000)).toBeCloseTo(4288, 2);
    expect(tax(135000)).toBeCloseTo(31288, 2);
    expect(tax(190000)).toBeCloseTo(51638, 2);
  });

  it('interior + top-bracket incomes match ATO', () => {
    expect(tax(0)).toBe(0);
    expect(tax(50000)).toBeCloseTo(5788, 2);    // 4288 + 5000*0.30
    expect(tax(200000)).toBeCloseTo(56138, 2);  // 51638 + 10000*0.45
  });

  it('is monotonic across every boundary (no dip to 0 at the edge)', () => {
    for (const b of [45000, 135000, 190000]) {
      expect(tax(b + 1)).toBeGreaterThan(tax(b) - 0.01);
    }
  });
});
