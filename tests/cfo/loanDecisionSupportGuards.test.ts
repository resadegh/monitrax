/**
 * MON-019 — the loan "opportunities" must not do arithmetic on the
 * never-amortises sentinel, must not show a negative benefit, and must not
 * recommend refinancing an unrefinanceable (high-LVR) loan.
 * (§19.2 worked examples + §19.4 guard.)
 *
 * WHAT WAS WRONG: `calculatePayoffMonths` returns 999 for an interest-only loan
 * (payment ≤ interest). The UI subtracted it — `999 − 168 = 831 mo` → "Save 69
 * years" — and computed "interest saved" over a 999-month phantom horizon
 * (negative benefit). Refinance recs had no LVR gate, so a 104% LVR loan (no
 * lender would write it) was still recommended.
 *
 * THE FIX: guard the sentinel (never amortise → timeReduced/interestSaved null,
 * surface "starts paying down"); add an LVR ceiling to refinance recs.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateExtraRepaymentImpact,
  calculateRefinanceOpportunities,
} from '../../lib/cfo/decisionSupport/loanDecisionSupport';

const loan = (o: Record<string, unknown>) => ({
  id: 'l1',
  name: 'Loan',
  type: 'HOME',
  rateType: 'VARIABLE',
  fixedExpiry: null,
  propertyId: null,
  // Must be the canonical enum value — toMonthly() matches `case 'MONTHLY'`
  // (uppercase); a lowercase 'monthly' falls through to the annual default and
  // silently divides the repayment by 12.
  repaymentFrequency: 'MONTHLY',
  termMonthsRemaining: 300,
  ...o,
});

describe('MON-019: interest-only loans never produce "save 69 years"', () => {
  it('an interest-only loan (payment = interest) does NOT subtract the 999 sentinel', () => {
    // P 800k @ 6% → monthly interest 4,000; minRepayment = 4,000 (interest-only).
    const impact = calculateExtraRepaymentImpact(
      [loan({ principal: 800_000, interestRateAnnual: 0.06, minRepayment: 4_000 })],
      /* monthlyIncome */ 40_000, // suggestedExtra = 4,000 → new payment 8,000 amortises
    )!;
    expect(impact.amortisingNow).toBe(false);
    expect(impact.startsAmortising).toBe(true);
    expect(impact.timeReduced).toBeNull(); // was 831 → "69 years"
    expect(impact.interestSaved).toBeNull(); // no honest baseline over a never-ending loan
    expect(impact.currentPayoffDate).toBeNull();
    expect(impact.newPayoffMonths).not.toBeNull();
    expect(impact.newPayoffMonths!).toBeLessThan(999);
  });

  it('an amortising loan shows real years saved and a POSITIVE benefit', () => {
    // P 300k @ 5% → interest 1,250; minRepayment 2,000 (amortises).
    const impact = calculateExtraRepaymentImpact(
      [loan({ principal: 300_000, interestRateAnnual: 0.05, minRepayment: 2_000 })],
      40_000,
    )!;
    expect(impact.amortisingNow).toBe(true);
    expect(impact.startsAmortising).toBe(false);
    expect(impact.timeReduced).not.toBeNull();
    expect(impact.timeReduced!).toBeGreaterThan(0);
    expect(impact.interestSaved).not.toBeNull();
    expect(impact.interestSaved!).toBeGreaterThan(0); // never negative (was −$270,328)
  });
});

describe('MON-019: refinance recommendations respect an LVR ceiling', () => {
  const properties = [
    { id: 'pA', currentValue: 500_000 },
    { id: 'pB', currentValue: 800_000 },
  ];

  it('does NOT recommend refinancing a 104% LVR loan', () => {
    const opps = calculateRefinanceOpportunities(
      [
        loan({
          id: 'lA',
          principal: 520_000, // 520k / 500k = 104% LVR
          interestRateAnnual: 0.09, // well above market → would otherwise qualify
          propertyId: 'pA',
        }),
      ],
      properties,
    );
    expect(opps).toHaveLength(1);
    expect(opps[0].worthRefinancing).toBe(false); // gated by LVR
  });

  it('DOES recommend refinancing a healthy-LVR loan above market rate', () => {
    const opps = calculateRefinanceOpportunities(
      [
        loan({
          id: 'lB',
          principal: 400_000, // 400k / 800k = 50% LVR
          interestRateAnnual: 0.09,
          propertyId: 'pB',
        }),
      ],
      properties,
    );
    expect(opps).toHaveLength(1);
    expect(opps[0].worthRefinancing).toBe(true);
  });

  it('non-property loans (no propertyId) are not LVR-gated', () => {
    const opps = calculateRefinanceOpportunities(
      [loan({ id: 'lC', type: 'PERSONAL', principal: 30_000, interestRateAnnual: 0.14 })],
      properties,
    );
    expect(opps).toHaveLength(1);
    expect(opps[0].worthRefinancing).toBe(true);
  });
});
