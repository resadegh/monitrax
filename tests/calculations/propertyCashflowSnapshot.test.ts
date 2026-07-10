/**
 * MON-014 — the Home property tiles must show CASHFLOW, not gross rent, and read
 * the ONE canonical per-property engine (§19.2 worked example + §19.4 source lock).
 *
 * WHAT WAS WRONG: a THIRD non-canonical cashflow producer in
 * `app/api/portfolio/snapshot/route.ts` computed per-property cashflow as
 * `rent − expenses − Σ toAnnual(minRepayment || 0)`. When a loan had no
 * minRepayment recorded, `|| 0` dropped the loan cost to $0, so the Home tile
 * showed ~gross rent (Broadbeach +$5,461) while a loan WITH minRepayment showed
 * true cashflow. Same column, different meaning per row.
 *
 * THE FIX: the snapshot route now calls the ONE canonical engine
 * `computePropertyCashflow` with the SAME inputs as the master snapshot — loan
 * cost floored to interest (never $0) — so the Home tile equals the detail page.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computePropertyCashflow } from '../../lib/calculations/propertyCashflow';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-014: per-property cashflow never drops loan cost to $0', () => {
  it('a loan with NO minRepayment floors to interest — not $0 (the Broadbeach bug)', () => {
    const cf = computePropertyCashflow({
      income: [{ id: 'r1', type: 'RENT', amount: 30_000, frequency: 'ANNUAL' }],
      expenses: [{ id: 'e1', amount: 6_000, frequency: 'ANNUAL' }],
      loans: [{ id: 'l1', principal: 300_000, interestRateAnnual: 0.06, minRepayment: null }],
    });
    // Loan cost floored to interest (300k × 6% = 18,000/yr), NEVER silently $0.
    expect(cf.annualLoanInterest).toBe(18_000);
    expect(cf.annualLoanRepayment).toBe(18_000);
    // Cashflow subtracts the loan cost: 30,000 − 6,000 − 18,000 = 6,000.
    expect(cf.annualRent).toBe(30_000);
    expect(cf.annualExpenses).toBe(6_000);
    expect(cf.annualCashflow).toBe(6_000);
    expect(cf.monthlyCashflow).toBe(500);
    // The OLD snapshot bug (rent − expenses − 0) would have shown +$24,000 (~gross rent).
    expect(cf.annualRent - cf.annualExpenses).toBe(24_000);
    expect(cf.annualCashflow).not.toBe(24_000);
  });

  it('a loan WITH minRepayment uses the repayment (already-correct rows unchanged)', () => {
    const cf = computePropertyCashflow({
      income: [{ id: 'r1', type: 'RENT', amount: 24_000, frequency: 'ANNUAL' }],
      expenses: [{ id: 'e1', amount: 3_000, frequency: 'ANNUAL' }],
      loans: [{ id: 'l1', principal: 400_000, interestRateAnnual: 0.06, minRepayment: 2_500, repaymentFrequency: 'MONTHLY' }],
    });
    expect(cf.annualLoanRepayment).toBe(30_000); // 2,500/mo × 12 (repayment, not interest)
    expect(cf.annualCashflow).toBe(24_000 - 3_000 - 30_000); // −9,000
  });
});

describe('MON-014: Home tiles read the ONE canonical engine (§19.4 source lock)', () => {
  it('the portfolio/snapshot route computes per-property cashflow via computePropertyCashflow', () => {
    const src = read('app/api/portfolio/snapshot/route.ts');
    expect(src).toContain('computePropertyCashflow({');
    // The per-property inline "drop loan to $0" producer must be gone.
    expect(src).not.toContain('annualRentalIncome - annualPropertyExpenses - annualLoanRepayments');
  });

  it('the master snapshot uses the same engine (both surfaces converge)', () => {
    const src = read('lib/services/masterFinancialService.ts');
    expect(src).toContain('computePropertyCashflow({');
  });
});
