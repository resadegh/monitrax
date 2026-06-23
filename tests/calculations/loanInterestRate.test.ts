/**
 * P0 regression — loan interest 100× too low (2026-06-23).
 *
 * `Loan.interestRateAnnual` is stored as a DECIMAL (0.0625 = 6.25%; see
 * prisma/schema.prisma + components/loans/LoanFormDialog.tsx). loanAggregator
 * computed `interestRateAnnual / 100 / 12`, dividing the already-decimal rate
 * by 100 again → monthly/total interest (the canonical SSOT debt figure) was
 * 100× too low. Fixed to `/ 12` (float) and `.div(12)` (Decimal).
 *
 * Worked example: $100,000 @ 6% p.a. → $500/month interest, $6,000/year.
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateLoanRepayments,
  aggregateLoanRepaymentsDecimal,
} from '@/lib/calculations/loanAggregator';

const loans = [
  {
    principal: 100000,
    minRepayment: 1000,
    repaymentFrequency: 'MONTHLY',
    interestRateAnnual: 0.06, // decimal = 6%
    type: 'HOME',
  },
];

describe('loanAggregator interest — decimal rate (P0 regression)', () => {
  it('float: $100k @ 0.06 → $500/mo, $6,000/yr (not $5 / $60)', () => {
    expect(aggregateLoanRepayments(loans as never, 'monthly').totalInterest).toBeCloseTo(500, 2);
    expect(aggregateLoanRepayments(loans as never, 'annual').totalInterest).toBeCloseTo(6000, 2);
  });

  it('decimal sibling matches the float path exactly', () => {
    expect(aggregateLoanRepaymentsDecimal(loans as never, 'monthly').totalInterest.toString()).toBe('500');
    expect(aggregateLoanRepaymentsDecimal(loans as never, 'annual').totalInterest.toString()).toBe('6000');
  });

  it('weightedInterestRate stays a decimal (0.06), unaffected by the fix', () => {
    expect(aggregateLoanRepayments(loans as never, 'monthly').weightedInterestRate).toBeCloseTo(0.06, 6);
  });
});
