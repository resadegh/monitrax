/**
 * NeoAudit Ring 0-gen — metamorphic properties over the aggregation engines.
 * Laws that must hold for ANY generated input (additivity, decomposition,
 * sign), which enumerated fixtures can't cover exhaustively.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { aggregateExpenses } from '@/lib/calculations/expenseAggregator';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

const FREQS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'HALF_YEARLY'] as const;
const money = () => fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true });

const expenseArb = fc.record({
  amount: money(),
  frequency: fc.constantFrom(...FREQS),
  category: fc.constantFrom('RATES', 'INSURANCE', 'MAINTENANCE', 'STRATA', 'UTILITIES', 'OTHER'),
  isEssential: fc.boolean(),
  isTaxDeductible: fc.boolean(),
});

describe('Ring 0-gen: expense aggregation is additive for any expense list', () => {
  it('essential + discretionary = total (every expense in exactly one bucket)', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 40 }), (expenses) => {
        const agg = aggregateExpenses(expenses, 'monthly');
        expect(agg.essential + agg.discretionary).toBeCloseTo(agg.total, 4);
      }),
    );
  });

  it('Σ category amounts = total', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 40 }), (expenses) => {
        const agg = aggregateExpenses(expenses, 'monthly');
        const catSum = Object.values(agg.byCategory).reduce((s, v) => s + v, 0);
        expect(catSum).toBeCloseTo(agg.total, 4);
      }),
    );
  });

  it('annual aggregation = monthly aggregation × 12', () => {
    fc.assert(
      fc.property(fc.array(expenseArb, { maxLength: 40 }), (expenses) => {
        const m = aggregateExpenses(expenses, 'monthly');
        const y = aggregateExpenses(expenses, 'annual');
        expect(y.total).toBeCloseTo(m.total * 12, 3);
      }),
    );
  });
});

const cashflowExpense = fc.record({
  id: fc.uuid(),
  amount: money(),
  frequency: fc.constantFrom(...FREQS),
});
const cashflowLoan = fc.record({
  id: fc.uuid(),
  principal: money(),
  interestRateAnnual: fc.double({ min: 0, max: 0.2, noNaN: true, noDefaultInfinity: true }),
  minRepayment: fc.option(money(), { nil: null }),
  repaymentFrequency: fc.constantFrom('WEEKLY', 'FORTNIGHTLY', 'MONTHLY'),
});

describe('Ring 0-gen: computePropertyCashflow decomposition holds for any inputs', () => {
  it('Σ expenseLines.annual = annualExpenses (the MON-005 reconciliation)', () => {
    fc.assert(
      fc.property(fc.array(cashflowExpense, { maxLength: 20 }), (expenses) => {
        const cf = computePropertyCashflow({ expenses });
        const sum = cf.expenseLines.reduce((s, l) => s + l.annual, 0);
        expect(sum).toBeCloseTo(cf.annualExpenses, 4);
      }),
    );
  });

  it('Σ loanLines.monthly = monthlyLoanRepayment (the MON-032 reconciliation)', () => {
    fc.assert(
      fc.property(fc.array(cashflowLoan, { maxLength: 10 }), (loans) => {
        const cf = computePropertyCashflow({ loans });
        const sum = cf.loanLines.reduce((s, l) => s + l.monthly, 0);
        expect(sum).toBeCloseTo(cf.monthlyLoanRepayment, 4);
      }),
    );
  });

  it('annual mirrors are exactly 12× the monthly figures', () => {
    fc.assert(
      fc.property(fc.array(cashflowExpense, { maxLength: 10 }), fc.array(cashflowLoan, { maxLength: 5 }), (expenses, loans) => {
        const cf = computePropertyCashflow({ expenses, loans });
        expect(cf.annualExpenses).toBeCloseTo(cf.monthlyExpenses * 12, 4);
        expect(cf.annualLoanRepayment).toBeCloseTo(cf.monthlyLoanRepayment * 12, 4);
      }),
    );
  });

  it('headline identity: annualCashflow = rent − expenses − repayment', () => {
    fc.assert(
      fc.property(fc.array(cashflowExpense, { maxLength: 10 }), fc.array(cashflowLoan, { maxLength: 5 }), (expenses, loans) => {
        const cf = computePropertyCashflow({ expenses, loans });
        expect(cf.annualCashflow).toBeCloseTo(cf.annualRent - cf.annualExpenses - cf.annualLoanRepayment, 3);
      }),
    );
  });

  it('loan cost is never silently $0 when a loan with a positive rate exists', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.001, max: 0.2, noNaN: true, noDefaultInfinity: true }),
        (principal, rate) => {
          const cf = computePropertyCashflow({
            loans: [{ id: 'l', principal, interestRateAnnual: rate, minRepayment: null }],
          });
          // Floors to interest: principal × rate / 12 > 0.
          expect(cf.monthlyLoanRepayment).toBeGreaterThan(0);
        },
      ),
    );
  });
});
