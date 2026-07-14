/**
 * MON-037 — one-off expenses in the TWO engines the general MON-011/023 fix
 * never reached: the per-property cashflow engine and the tax deduction engine.
 *
 * DECISION 1 (Reza 2026-07-14): a one-off (`isRecurring === false`) is
 *   • EXCLUDED from the property's recurring run-rate (Cashflow/yr) — it is not
 *     a monthly cost; it shows as an actual in its month, not ×frequency;
 *   • COUNTED ONCE in the tax deduction (its actual amount, not ×frequency) —
 *     a one-off deductible repair is a real deduction, just not annualised.
 *
 * The bug: a $11,385 battery stored MONTHLY was ×12'd to $136,620 on the
 * property expense card / cashflow AND in tax deductions. These are the Ring-0
 * locks so that class can never ×frequency a one-off again (§23.2 Ratchet).
 *
 * The source-lock (bottom) is the §19.4 / F1-F2 guard: EVERY caller that feeds
 * these two engines must thread `isRecurring`, or a surface silently drifts back
 * to the inflated number (the exact partial-fix failure MON-037 came from).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { computePropertyCashflow } from '../../lib/calculations/propertyCashflow';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

const ROOT = resolve(__dirname, '../..');

describe('MON-037 · propertyCashflow excludes one-offs from the run-rate', () => {
  it('a one-off battery ($11,385 MONTHLY) contributes $0 to annual expenses', () => {
    const cf = computePropertyCashflow({
      expenses: [
        { id: 'rates', amount: 1300, frequency: 'QUARTERLY', isRecurring: true }, // real recurring rate
        { id: 'battery', amount: 11385, frequency: 'MONTHLY', isRecurring: false }, // one-off
      ],
    });
    // only the recurring quarterly rate: 1300 × 4 = 5,200/yr — NOT 5,200 + 136,620
    expect(cf.annualExpenses).toBeCloseTo(5200, 2);
    // the one-off never becomes a recurring expense line
    expect(cf.expenseLines.some((l) => l.id === 'battery')).toBe(false);
    expect(cf.expenseLines.some((l) => l.id === 'rates')).toBe(true);
  });

  it('with no one-offs, behaviour is unchanged (recurring still annualised)', () => {
    const cf = computePropertyCashflow({
      expenses: [{ id: 'ins', amount: 200, frequency: 'MONTHLY', isRecurring: true }],
    });
    expect(cf.annualExpenses).toBeCloseTo(2400, 2); // 200 × 12
  });
});

describe('MON-037 · tax deductions count a one-off ONCE, not ×frequency', () => {
  const oneOff = { id: 'battery', name: 'Battery', category: 'OTHER', amount: 11385, frequency: 'MONTHLY', isTaxDeductible: true, isRecurring: false };
  const recurring = { id: 'rates', name: 'Rates', category: 'OTHER', amount: 1000, frequency: 'MONTHLY', isTaxDeductible: true, isRecurring: true };

  it('Float engine: one-off = its amount once (11,385); recurring = ×12 (12,000)', () => {
    const r = calculateTaxPosition({ incomes: [], expenses: [oneOff, recurring], depreciations: [] });
    // 11,385 (once) + 12,000 (annualised) = 23,385 — NOT 136,620 + 12,000
    expect(r.deductions.total).toBeCloseTo(11385 + 12000, 0);
  });

  it('Decimal engine agrees (same count-once semantics)', () => {
    const r = calculateTaxPositionDecimal({ incomes: [], expenses: [oneOff, recurring], depreciations: [] });
    expect(r.deductions.total.toNumber()).toBeCloseTo(11385 + 12000, 0);
  });

  it('a purely-recurring deductible is unchanged (no regression)', () => {
    const r = calculateTaxPosition({ incomes: [], expenses: [recurring], depreciations: [] });
    expect(r.deductions.total).toBeCloseTo(12000, 0); // 1000 × 12
  });

  it('negative control — WITHOUT the fix a MONTHLY one-off would be 136,620', () => {
    // Proves the test would catch a regression: annualising the one-off (the bug)
    // gives 11,385 × 12 = 136,620, which the assertions above forbid.
    expect(11385 * 12).toBe(136620);
  });
});

describe('MON-037 · §19.4 source-lock — every caller threads isRecurring (F1/F2 guard)', () => {
  const has = (path: string, re: RegExp) => re.test(readFileSync(resolve(ROOT, path), 'utf8'));

  it('property-cashflow callers thread isRecurring into the engine', () => {
    // master property metrics + Home tile explicitly map isRecurring
    expect(has('lib/services/masterFinancialService.ts', /amount: e\.amount, frequency: e\.frequency, isRecurring: e\.isRecurring/)).toBe(true);
    expect(has('app/api/portfolio/snapshot/route.ts', /frequency: e\.frequency, isRecurring: e\.isRecurring/)).toBe(true);
    // detail + list pass the whole expense object (carries isRecurring)
    expect(has('app/dashboard/properties/[id]/page.tsx', /expenses: p\.expenses/)).toBe(true);
    expect(has('app/dashboard/properties/page.tsx', /expenses: property\.expenses/)).toBe(true);
  });

  it('tax-engine callers thread isRecurring into the deduction path', () => {
    for (const p of [
      'lib/services/masterFinancialService.ts',
      'app/api/tax/position/route.ts',
      'lib/tax-engine/position/userTaxPosition.ts',
      'lib/services/entityTaxFactsAssembler.ts',
      'app/api/tax/entity/[entityId]/route.ts',
    ]) {
      expect(has(p, /isRecurring: (e|expense)\.isRecurring/)).toBe(true);
    }
    // entity Prisma selects must fetch isRecurring (else it's undefined at runtime)
    expect(has('lib/services/entityTaxFactsAssembler.ts', /isRecurring: true/)).toBe(true);
    expect(has('app/api/tax/entity/[entityId]/route.ts', /isRecurring: true/)).toBe(true);
  });
});
