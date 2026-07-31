/**
 * NeoAudit Ring 0-gen (NEOAUDIT.md §1.2) — metamorphic properties over the
 * canonical income + loan aggregators, completing the §6.2 aggregation trio
 * (expense aggregation is covered in properties.engines.test.ts).
 *
 * These lock two real historical bug classes:
 *  - income taxable/non-taxable split totality (the rental double-count class),
 *  - the loan-interest P0 fix (interestRateAnnual is a DECIMAL → monthly
 *    interest = principal × rate / 12; the pre-2026-06-23 code divided the
 *    already-decimal rate by 100 again, making totalInterest 100× too low).
 *
 * Core `fast-check` with plain vitest (the wrapper needs vitest 4; we run 1.6).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildBankedIncome } from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';
import { aggregateLoanRepayments, type LoanInput } from '@/lib/calculations/loanAggregator';

const money = (max = 500_000) => fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true });
const FREQS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'HALF_YEARLY'] as const;
const REPAY_FREQS = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'] as const;

// MON-131 T1-B: the income laws now run over the ONE banked engine — the
// legacy `aggregateIncome` is deleted (income-net-run-rate contract). The
// arbitrary spans all sources incl. SALARY rows that take the full
// DERIVED_SCHEDULE path (random amounts through the real PAYG schedule).
const incomeArb: fc.Arbitrary<BankedIncomeRow> = fc.record({
  amount: money(),
  frequency: fc.constantFrom(...FREQS),
  type: fc.constantFrom('SALARY', 'RENTAL', 'INVESTMENT', 'OTHER'),
  isTaxable: fc.boolean(),
  isRecurring: fc.constant(true),
});

const banked = (income: BankedIncomeRow[]) =>
  buildBankedIncome({
    income,
    properties: [],
    derivedAgentExpenses: [],
    transactions: [],
    ctx: { config: TAX_YEAR_2026_27, repaymentIncome: null },
  });

describe('Ring 0-gen: banked-income totalities hold for any income list (D20 L2 invariants)', () => {
  it('Σ bySource banked = banked total (pure summation — every row in exactly one source)', () => {
    fc.assert(
      fc.property(fc.array(incomeArb, { maxLength: 40 }), (income) => {
        const r = banked(income);
        const sourceSum =
          r.annual.bySource.salary.banked +
          r.annual.bySource.rental.banked +
          r.annual.bySource.investment.banked +
          r.annual.bySource.other.banked;
        expect(sourceSum).toBeCloseTo(r.annual.banked, 4);
      }),
    );
  });

  it('banked ≤ gross, and gross − banked ≡ the withholding wedge (§5.6 identities)', () => {
    fc.assert(
      fc.property(fc.array(incomeArb, { maxLength: 40 }), (income) => {
        const r = banked(income);
        expect(r.annual.banked).toBeLessThanOrEqual(r.annual.gross + 1e-6);
        expect(r.annual.gross - r.annual.banked).toBeCloseTo(r.annual.withholding.total, 4);
      }),
    );
  });
});

const loanArb: fc.Arbitrary<LoanInput> = fc.record({
  principal: fc.double({ min: 1, max: 2_000_000, noNaN: true, noDefaultInfinity: true }),
  minRepayment: money(20_000),
  repaymentFrequency: fc.constantFrom(...REPAY_FREQS),
  interestRateAnnual: fc.double({ min: 0, max: 0.2, noNaN: true, noDefaultInfinity: true }),
  type: fc.constantFrom('HOME', 'INVESTMENT', 'PERSONAL', 'CREDIT_CARD'),
});

describe('Ring 0-gen: loan aggregation holds its laws for any loan book', () => {
  it('Σ byType principal = totalPrincipal and Σ byType repayments = totalRepayments', () => {
    fc.assert(
      fc.property(fc.array(loanArb, { maxLength: 20 }), (loans) => {
        const agg = aggregateLoanRepayments(loans, 'monthly');
        const principal = Object.values(agg.byType).reduce((s, v) => s + v.principal, 0);
        const repayments = Object.values(agg.byType).reduce((s, v) => s + v.repayments, 0);
        expect(principal).toBeCloseTo(agg.totalPrincipal, 3);
        expect(repayments).toBeCloseTo(agg.totalRepayments, 3);
      }),
    );
  });

  it('annual = 12 × monthly for repayments AND interest', () => {
    fc.assert(
      fc.property(fc.array(loanArb, { maxLength: 20 }), (loans) => {
        const m = aggregateLoanRepayments(loans, 'monthly');
        const y = aggregateLoanRepayments(loans, 'annual');
        expect(y.totalRepayments).toBeCloseTo(m.totalRepayments * 12, 3);
        expect(y.totalInterest).toBeCloseTo(m.totalInterest * 12, 3);
      }),
    );
  });

  it('weighted interest rate lies within the loan-book min/max (a true weighted average)', () => {
    fc.assert(
      fc.property(fc.array(loanArb, { minLength: 1, maxLength: 20 }), (loans) => {
        const agg = aggregateLoanRepayments(loans, 'monthly');
        const rates = loans.map((l) => l.interestRateAnnual);
        expect(agg.weightedInterestRate).toBeGreaterThanOrEqual(Math.min(...rates) - 1e-9);
        expect(agg.weightedInterestRate).toBeLessThanOrEqual(Math.max(...rates) + 1e-9);
      }),
    );
  });

  it('P0 lock: monthly interest = principal × rate / 12 (rate is a DECIMAL, never /100 again)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 2_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 0.2, noNaN: true, noDefaultInfinity: true }),
        (principal, rate) => {
          const agg = aggregateLoanRepayments(
            [{ principal, minRepayment: 0, repaymentFrequency: 'MONTHLY', interestRateAnnual: rate }],
            'monthly',
          );
          expect(agg.totalInterest).toBeCloseTo((principal * rate) / 12, 4);
        },
      ),
    );
  });
});
