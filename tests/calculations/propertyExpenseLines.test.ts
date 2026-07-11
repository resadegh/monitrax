/**
 * MON-005 — per-property Expenses card reconciliation lock (§19.4).
 *
 * The PropertyExpensesCard renders each expense row from `expenseLines[]` and
 * the header total from `annualExpenses` — BOTH from one `computePropertyCashflow`
 * call. This test is the HARD guard that Σ rows === header, so a future change to
 * the engine's expense loop can never silently desync the card's row-sum from its
 * total (the §19.4 "fixed here, still broken there" failure mode).
 *
 * §19.2 worked examples derive every expected number from the amount×frequency
 * rule (toMonthly) and the §19.1 actuals-first rule.
 */
import { describe, it, expect } from 'vitest';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

describe('MON-005: expenseLines reconcile with annualExpenses (§19.4 propagation lock)', () => {
  it('declared-only: Σ expenseLines[].annual === annualExpenses, all Estimate', () => {
    // Council rates $1,000/quarter → monthly 1000/3 = 333.33 → annual 4,000.
    // Landlord insurance $1,200/year → monthly 100 → annual 1,200.
    // Total annualExpenses = 4,000 + 1,200 = 5,200.
    const cf = computePropertyCashflow({
      expenses: [
        { id: 'e1', amount: 1000, frequency: 'QUARTERLY' },
        { id: 'e2', amount: 1200, frequency: 'ANNUAL' },
      ],
    });

    expect(cf.expenseLines).toHaveLength(2);
    const sum = cf.expenseLines.reduce((s, l) => s + l.annual, 0);
    expect(sum).toBeCloseTo(cf.annualExpenses, 6);
    expect(cf.annualExpenses).toBeCloseTo(5200, 6);
    // No transactions → every line is an Estimate.
    expect(cf.expenseLines.every((l) => l.usedActuals === false)).toBe(true);
  });

  it('actuals-first: a reconciled expense uses transactions and STILL reconciles', () => {
    // Declared: Water $300/quarter (→ annual 1,200). But four ~monthly actual
    // transactions of $150 each reveal the real cost is ~$150/mo (→ annual ~1,800).
    // The line must be marked Actual and the header must equal Σ lines.
    const base = new Date('2026-01-15').getTime();
    const day = 24 * 60 * 60 * 1000;
    const cf = computePropertyCashflow({
      expenses: [{ id: 'w1', amount: 300, frequency: 'QUARTERLY' }],
      transactions: [
        { date: new Date(base), amount: -150, incomeId: null, expenseId: 'w1', loanId: null },
        { date: new Date(base + 30 * day), amount: -150, incomeId: null, expenseId: 'w1', loanId: null },
        { date: new Date(base + 60 * day), amount: -150, incomeId: null, expenseId: 'w1', loanId: null },
        { date: new Date(base + 90 * day), amount: -150, incomeId: null, expenseId: 'w1', loanId: null },
      ],
    });

    expect(cf.expenseLines).toHaveLength(1);
    const line = cf.expenseLines[0];
    expect(line.usedActuals).toBe(true);
    // Actuals (~$150/mo) beat the declared $100/mo — the reconciled figure is higher.
    expect(line.monthly).toBeGreaterThan(100);
    // The reconciliation lock holds regardless of actuals vs declared.
    expect(line.annual).toBeCloseTo(cf.annualExpenses, 6);
    expect(line.monthly * 12).toBeCloseTo(line.annual, 6);
  });

  it('empty: no expenses → no lines, zero total', () => {
    const cf = computePropertyCashflow({ expenses: [] });
    expect(cf.expenseLines).toHaveLength(0);
    expect(cf.annualExpenses).toBe(0);
  });
});
