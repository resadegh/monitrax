/**
 * MON-020 — /cashflow and My Guide must show the SAME estimated tax, from the
 * ONE canonical tax position, WITH Medicare (§19.2 worked example + §19.4
 * cross-surface source lock).
 *
 * WHAT WAS WRONG: /cashflow estimated tax as `calculateIncomeTax(gross − adHoc).taxPayable`
 * — income tax ONLY (no Medicare levy), with a small ad-hoc deduction set —
 * while My Guide used the full `calculateTaxPosition` (Medicare + all deductions
 * + offsets). Same person, two numbers ($153,278 vs $104,323): a §12.2.1
 * duplicate-source defect, plus a missing ~2% Medicare levy on the /cashflow side.
 *
 * THE FIX: one user-level source `getUserTaxPosition(userId)` → `calculateTaxPosition`,
 * read by BOTH surfaces. The tax figure is `taxPosition.tax.netTax` (income tax
 * + Medicare − offsets) on both.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateTaxPosition } from '../../lib/tax-engine/position/taxPositionCalculator';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-020: the canonical tax number includes Medicare (what /cashflow was dropping)', () => {
  it('netTax includes Medicare — gross tax exceeds income-tax-alone (what /cashflow dropped)', () => {
    // $150k salary — comfortably above the Medicare-levy threshold.
    const result = calculateTaxPosition({
      incomes: [
        { id: 'i1', name: 'Salary', type: 'SALARY', amount: 150_000, frequency: 'ANNUAL' },
      ],
      expenses: [],
      depreciations: [],
    });

    const { taxOnIncome, medicareLevy, grossTax, netTax } = result.tax;

    // The 2% Medicare levy applies and is NON-zero at this income.
    expect(medicareLevy).toBeGreaterThan(0);
    // Gross tax = income tax + Medicare (total) → STRICTLY greater than
    // income-tax-alone. This is exactly the levy the old /cashflow calc omitted.
    expect(grossTax).toBeGreaterThan(taxOnIncome);
    // netTax (what both surfaces now show) is positive and ≤ grossTax (offsets).
    expect(netTax).toBeGreaterThan(0);
    expect(netTax).toBeLessThanOrEqual(grossTax);
  });

  it('a low income below the Medicare threshold has no levy (shade-in floor holds)', () => {
    const result = calculateTaxPosition({
      incomes: [{ id: 'i1', name: 'Salary', type: 'SALARY', amount: 10_000, frequency: 'ANNUAL' }],
      expenses: [],
      depreciations: [],
    });
    expect(result.tax.medicareLevy).toBe(0);
  });
});

describe('MON-020: both surfaces read the ONE source (§19.4 cross-surface lock)', () => {
  it('/cashflow reads getUserTaxPosition().taxPosition.tax.netTax — not an ad-hoc income-tax calc', () => {
    const src = read('app/api/cashflow/intelligence/route.ts');
    expect(src).toContain('getUserTaxPosition');
    expect(src).toContain('taxPosition.tax.netTax');
    // The ad-hoc income-tax-only producer must be gone.
    expect(src).not.toContain('calculateIncomeTax');
  });

  it('My Guide (CFO tax insights) reads the same getUserTaxPosition source', () => {
    const src = read('lib/cfo/decisionSupport/taxIntegration.ts');
    expect(src).toContain('getUserTaxPosition');
    // It no longer calls the tax engine directly (one source).
    expect(src).not.toContain('calculateTaxPosition(');
  });

  it('the shared source calls the ONE reform-aware engine', () => {
    const src = read('lib/tax-engine/position/userTaxPosition.ts');
    expect(src).toContain('calculateTaxPosition(');
  });
});
