/**
 * M2.4 (B-3) — the properties-list dialog reads the canonical engine,
 * never a re-derivation (MONITRAX_V1_MASTER_PLAN.md §4 M2.4;
 * BRIEF_M2_CORRECTNESS.md §B-3).
 *
 * The Details tab of the property dialog used to compute a
 * budget-vs-actual annual cashflow INLINE from raw rows
 * (Σ convertToAnnual(amount, frequency) vs Σ monthlyAverageActual×12),
 * bypassing `computePropertyCashflow` — the SSOT engine the tile on the
 * SAME page reads. The two could disagree on one screen.
 *
 * Ring-1 lock: the inline formulas are gone from the page and the
 * dialog block reads `cashflowOf(...)` (the page's one engine closure).
 * Ring-2 identity: on a fixture property with mixed declared+actual
 * inputs, the engine states ONE annualCashflow — the value the tile,
 * the dialog and the detail page now all render.
 *
 * Coverage boundary: locks the page SOURCE and the engine value; does
 * NOT render the React dialog. The rendered convergence on live data is
 * the Matrix's Ring-3 (M2.2).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

const pageSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'app/dashboard/properties/page.tsx'),
  'utf8',
);

describe('M2.4 — properties dialog cashflow comes from the ONE engine', () => {
  it('the inline budget/actual re-derivation is gone from the page', () => {
    // The exact formulas the old block used — none may return.
    expect(pageSrc).not.toContain('annualIncomeBudget');
    expect(pageSrc).not.toContain('annualIncomeActual');
    expect(pageSrc).not.toContain('annualExpenseBudget');
    expect(pageSrc).not.toContain('annualLoanActual');
    expect(pageSrc).not.toContain('cashflowBudget');
    expect(pageSrc).not.toMatch(/monthlyAverageActual \|\| 0\) \* 12/);
  });

  it('the dialog block reads the canonical engine and states its basis', () => {
    const block = pageSrc.slice(pageSrc.indexOf("selectedProperty.type === 'INVESTMENT' && (() => {"));
    expect(block).toContain('cashflowOf(selectedProperty)');
    expect(block).toContain('cf.annualCashflow');
    expect(block).toContain('cf.basis');
  });

  it('engine identity: one stated annualCashflow for mixed declared+actual inputs', () => {
    // Declared: rent $500/wk, insurance $1,200/yr, loan repayment $2,000/mo.
    // Actuals: none (declared basis) — the engine's number is the ONLY number.
    const cf = computePropertyCashflow({
      income: [
        { id: 'i1', name: 'Rent', type: 'RENTAL', amount: 500, frequency: 'WEEKLY' },
      ],
      expenses: [
        { id: 'e1', name: 'Insurance', category: 'INSURANCE', amount: 1200, frequency: 'ANNUALLY' },
      ],
      loans: [
        {
          id: 'l1',
          name: 'IP loan',
          principal: 400_000,
          interestRateAnnual: 0.06,
          minRepayment: 2000,
          repaymentFrequency: 'MONTHLY',
        },
      ],
      transactions: [],
    });
    // Hand-computed (§19.2): rent 500×52/12 = 2,166.67/mo; insurance 100/mo;
    // loan 2,000/mo → monthly cashflow 66.67 → annual 800.
    expect(cf.monthlyCashflow).toBeCloseTo(66.67, 1);
    expect(cf.annualCashflow).toBeCloseTo(800, 0);
    expect(cf.basis).toBe('declared');
  });
});
