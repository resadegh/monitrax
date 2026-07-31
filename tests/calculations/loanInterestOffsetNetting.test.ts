/**
 * MON-143 — THE RATCHET for the D21 offset-netting defect class.
 *
 * WHAT ESCAPED. `resolveLoanMonthlyCost` computed its interest floor on the
 * FULL balance, making it the ONLY one of four interest derivations in the app
 * that breached D21 — `propertyLoanInterest.ts:87`, `debt-analysis:465` and
 * `portfolioEngine:428` all net the offset. On Guildford that is $1,964.67
 * against $384.45: **5.1×**, and the floor IS the rendered cost whenever a loan
 * has neither actuals nor a declared repayment.
 *
 * Why nothing caught it: `CashflowLoan` carried no offset field at all, so the
 * engine was structurally incapable of netting and no fixture could express the
 * case. It surfaced only because the T2 relay printed `monthlyInterestFloor`
 * per loan and the Matrix read Guildford's against its balance.
 *
 * These are the two guards that close it:
 *   Ring 0 — the ENGINE half: the floor nets the offset, and the un-netted
 *            value is pinned as WRONG so a regression cannot pass silently.
 *   Ring 1 — the ASYMMETRY half (T2 brief §3.3): D21 nets the offset for
 *            INTEREST while D26 does NOT net it for EQUITY. A later refactor
 *            "tidying" those into agreement would double-count the offset in
 *            one direction or vanish it in the other, so both halves are
 *            pinned together in one test that names the trap.
 *
 * COVERAGE, stated precisely (§22.2.4): proves the floor's arithmetic and the
 * asymmetry. Does NOT prove any surface renders it — on live data today no
 * loan both floors AND carries an offset (Guildford resolves via ACTUALS), so
 * this fix moves no rendered number; it closes the breach before the T2
 * migration wires every consumer onto this producer.
 */
import { describe, it, expect } from 'vitest';
import { resolveLoanMonthlyCost } from '@/lib/calculations/propertyCashflow';

// Guildford, read live at 2627dcdf.
const GUILDFORD = {
  id: 'guildford',
  principal: 377_821.91,
  interestRateAnnual: 0.0624,
  offsetBalance: 303_889.96,
};

describe('MON-143 Ring 0 — the interest floor nets the offset (D21)', () => {
  it('floors on principal − offset, not on the full balance', () => {
    // No transactions and no declared repayment → the floor IS the cost.
    const r = resolveLoanMonthlyCost({ ...GUILDFORD, minRepayment: 0 }, []);

    expect(r.flooredToInterest).toBe(true);
    // (377,821.91 − 303,889.96) × 6.24% ÷ 12
    expect(r.monthlyInterest).toBeCloseTo(384.45, 2);
    expect(r.monthly).toBeCloseTo(384.45, 2);
  });

  it('the pre-fix value is pinned as WRONG — a regression cannot pass quietly', () => {
    const r = resolveLoanMonthlyCost({ ...GUILDFORD, minRepayment: 0 }, []);
    const unNetted = (377_821.91 * 0.0624) / 12; // 1,964.67 — the old behaviour
    expect(unNetted).toBeCloseTo(1964.67, 2);
    expect(r.monthlyInterest).not.toBeCloseTo(unNetted, 2);
    // and the magnitude of the defect, so the number in the docs is testable
    expect(unNetted / r.monthlyInterest).toBeCloseTo(5.11, 1);
  });

  it('no offset → unchanged behaviour (the other four loans)', () => {
    const r = resolveLoanMonthlyCost(
      { id: 'hecs', principal: 25_000, interestRateAnnual: 0.04, minRepayment: 0 },
      [],
    );
    expect(r.monthlyInterest).toBeCloseTo(83.33, 2);
  });

  it('a fully-offset loan floors to zero, never negative', () => {
    const r = resolveLoanMonthlyCost(
      { id: 'full', principal: 100_000, interestRateAnnual: 0.06, offsetBalance: 150_000, minRepayment: 0 },
      [],
    );
    expect(r.monthlyInterest).toBe(0);
    expect(r.monthly).toBeGreaterThanOrEqual(0);
  });

  it('actuals still win — the offset only affects the FLOOR', () => {
    const tx = [
      { date: new Date('2026-05-01'), amount: 2789.71, loanId: 'guildford' },
      { date: new Date('2026-06-01'), amount: 2789.71, loanId: 'guildford' },
      { date: new Date('2026-07-01'), amount: 2789.71, loanId: 'guildford' },
    ];
    const r = resolveLoanMonthlyCost({ ...GUILDFORD, minRepayment: 0 }, tx);
    expect(r.flooredToInterest).toBe(false);
    expect(r.usedActuals).toBe(true);
    // The day-span normaliser divides by (span + one mean interval) × 30.4375,
    // so three calendar-month payments do NOT return the payment amount exactly
    // (8,369.13 ÷ 91.5 × 30.4375 = 2,783.99). Asserting 2,789.71 here would be
    // false precision — what this case exists to prove is that ACTUALS win and
    // the offset-netted floor is not what surfaces.
    expect(r.monthly).toBeGreaterThan(2700);
    expect(r.monthly).not.toBeCloseTo(r.monthlyInterest, 0);
  });
});

describe('MON-143 Ring 1 — the D21/D26 asymmetry, both halves (T2 brief §3.3)', () => {
  it('INTEREST nets the offset; EQUITY does not — and they must never be "tidied" into agreement', () => {
    const r = resolveLoanMonthlyCost({ ...GUILDFORD, minRepayment: 0 }, []);

    // D21 — interest is charged on the balance net of the offset.
    const interestBearing = GUILDFORD.principal - GUILDFORD.offsetBalance;
    expect(r.monthlyInterest).toBeCloseTo((interestBearing * GUILDFORD.interestRateAnnual) / 12, 6);

    // D26 — equity is computed on the FULL balance, because the offset is cash
    // the user still owns and is already counted in liquid assets. Netting it
    // here as well would count the same money twice.
    const propertyValue = 1_000_000;
    const equity = propertyValue - GUILDFORD.principal;
    expect(equity).toBeCloseTo(622_178.09, 2);
    expect(equity).not.toBeCloseTo(propertyValue - interestBearing, 2);

    // The trap, stated so a future refactor has to argue with it: making these
    // consistent with each other breaks one of them. 5.1x on interest, or
    // $303,889.96 double-counted on equity.
    expect(propertyValue - interestBearing - equity).toBeCloseTo(GUILDFORD.offsetBalance, 2);
  });
});
