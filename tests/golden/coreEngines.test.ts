/**
 * NeoAudit Ring 0-gen (NEOAUDIT.md §1.2) — metamorphic properties over the
 * CORE aggregation engines: net worth, the canonical savings rate, and the
 * forward-balance projection. These are the engines behind the self-audit
 * invariants (I1/I3/I12) and the areas VR-001 flagged as thinly covered.
 *
 * Every law below must hold for ANY generated input; fast-check shrinks a
 * violation to a minimal counter-example. Core `fast-check` with plain vitest
 * (the @fast-check/vitest wrapper needs vitest 4; we run 1.6).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateNetWorth,
  type PropertyInput,
  type AccountInput,
  type InvestmentInput,
  type LoanInput,
  type SuperInput,
  type AssetInput,
} from '@/lib/calculations/netWorthCalculator';
import { getCanonicalSavingsRate, projectBalanceForward } from '@/lib/calculations/canonicalCashflow';

const money = (max = 5_000_000) => fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true });

const propertyArb = fc.record({ currentValue: money(), type: fc.constantFrom('HOME', 'INVESTMENT') });
const accountArb = fc.record({
  currentBalance: money(500_000),
  type: fc.constantFrom('SAVINGS', 'TRANSACTION', 'OFFSET', 'TERM_DEPOSIT'),
});
const investmentArb = fc.record({
  units: fc.double({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true }),
  currentPrice: fc.option(fc.double({ min: 0, max: 5_000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  averagePrice: fc.double({ min: 0, max: 5_000, noNaN: true, noDefaultInfinity: true }),
});
const loanArb = fc.record({
  principal: money(2_000_000),
  type: fc.constantFrom('HOME', 'INVESTMENT', 'CREDIT_CARD', 'PERSONAL', 'CAR'),
});
const superArb = fc.record({
  balance: money(1_000_000),
  fundType: fc.constantFrom('INDUSTRY', 'RETAIL', 'SMSF'),
});

const nw = (o: {
  properties?: PropertyInput[];
  accounts?: AccountInput[];
  investments?: InvestmentInput[];
  loans?: LoanInput[];
  superannuation?: SuperInput[];
  personalAssets?: AssetInput[];
}) =>
  calculateNetWorth(
    o.properties ?? [],
    o.accounts ?? [],
    o.investments ?? [],
    o.loans ?? [],
    o.superannuation ?? [],
    o.personalAssets ?? [],
  );

describe('Ring 0-gen: net worth identities hold for any portfolio', () => {
  const portfolio = fc.record({
    properties: fc.array(propertyArb, { maxLength: 8 }),
    accounts: fc.array(accountArb, { maxLength: 12 }),
    investments: fc.array(investmentArb, { maxLength: 10 }),
    loans: fc.array(loanArb, { maxLength: 8 }),
    superannuation: fc.array(superArb, { maxLength: 4 }),
  });

  it('fundamental identity: netWorth = assets.total − liabilities.total', () => {
    fc.assert(
      fc.property(portfolio, (p) => {
        const r = nw(p);
        expect(r.netWorth).toBeCloseTo(r.assets.total - r.liabilities.total, 3);
      }),
    );
  });

  it('assets additivity: total = properties + accounts + investments + super + personal', () => {
    fc.assert(
      fc.property(portfolio, (p) => {
        const a = nw(p).assets;
        expect(a.properties + a.accounts + a.investments + a.superannuation + a.personalAssets).toBeCloseTo(a.total, 3);
      }),
    );
  });

  it('liabilities additivity: total = mortgages + personalLoans + creditCards (every loan in exactly one bucket)', () => {
    fc.assert(
      fc.property(portfolio, (p) => {
        const l = nw(p).liabilities;
        expect(l.mortgages + l.personalLoans + l.creditCards).toBeCloseTo(l.total, 3);
        // Totality: the three buckets account for every dollar of principal.
        const allPrincipal = (p.loans ?? []).reduce((s, x) => s + x.principal, 0);
        expect(l.total).toBeCloseTo(allPrincipal, 3);
      }),
    );
  });

  it('property equity = assets.properties − liabilities.mortgages (the I4 basis)', () => {
    fc.assert(
      fc.property(portfolio, (p) => {
        const r = nw(p);
        expect(r.breakdown.propertyEquity).toBeCloseTo(r.assets.properties - r.liabilities.mortgages, 3);
      }),
    );
  });
});

describe('Ring 0-gen: net worth monotonicity + SMSF exclusion', () => {
  it('appending a loan never increases net worth', () => {
    fc.assert(
      fc.property(fc.array(accountArb, { maxLength: 6 }), loanArb, (accounts, extra) => {
        const before = nw({ accounts }).netWorth;
        const after = nw({ accounts, loans: [extra] }).netWorth;
        expect(after).toBeLessThanOrEqual(before + 1e-6);
      }),
    );
  });

  it('appending a positive personal asset never decreases net worth', () => {
    fc.assert(
      fc.property(fc.array(accountArb, { maxLength: 6 }), money(1_000_000), (accounts, value) => {
        const before = nw({ accounts }).netWorth;
        const after = nw({ accounts, personalAssets: [{ currentValue: value }] }).netWorth;
        expect(after).toBeGreaterThanOrEqual(before - 1e-6);
      }),
    );
  });

  it('SMSF member accounts are excluded (their value flows through the entity — no double-count)', () => {
    fc.assert(
      fc.property(money(1_000_000), (balance) => {
        const r = nw({ superannuation: [{ balance, fundType: 'SMSF' }] });
        expect(r.assets.superannuation).toBeCloseTo(0, 3);
        expect(r.netWorth).toBeCloseTo(0, 3);
      }),
    );
  });
});

// getCanonicalSavingsRate reads only quickMetrics in the declared branch; a
// minimal typed slice satisfies the accessor without a full snapshot.
type SavingsSnap = Parameters<typeof getCanonicalSavingsRate>[0];
const declaredSnap = (income: number, expenses: number, loans: number): SavingsSnap =>
  ({ quickMetrics: { monthlyIncome: income, monthlyExpenses: expenses, monthlyLoanRepayments: loans } } as unknown as SavingsSnap);

describe('Ring 0-gen: canonical savings rate (MON-029) — one rule, honest bounds', () => {
  it('declared rate = ((income − outgoings) / income) × 100 exactly', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }), money(50_000), money(50_000), (inc, exp, loan) => {
        const { rate, basis } = getCanonicalSavingsRate(declaredSnap(inc, exp, loan), null);
        expect(basis).toBe('declared');
        expect(rate).toBeCloseTo(((inc - (exp + loan)) / inc) * 100, 6);
      }),
    );
  });

  it('zero income → 0% (never NaN/Infinity)', () => {
    fc.assert(
      fc.property(money(50_000), money(50_000), (exp, loan) => {
        const { rate } = getCanonicalSavingsRate(declaredSnap(0, exp, loan), null);
        expect(rate).toBe(0);
      }),
    );
  });

  it('trailing actuals win when present: basis = actual-ttm, rate = the trailing figure', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 500_000, noNaN: true, noDefaultInfinity: true }),
        (trailingRate, annualIncome) => {
          const { rate, basis } = getCanonicalSavingsRate(declaredSnap(9999, 1, 1), {
            trailingMonthsWithData: 12,
            annualIncome,
            annualOutgoings: 0,
            savingsRateTrailing: trailingRate,
          });
          expect(basis).toBe('actual-ttm');
          expect(rate).toBe(trailingRate);
        },
      ),
    );
  });
});

describe('Ring 0-gen: forward-balance projection (MON-021) is linear', () => {
  it('days = 0 → the start balance unchanged', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }), fc.double({ min: -1e5, max: 1e5, noNaN: true, noDefaultInfinity: true }), (bal, net) => {
        expect(projectBalanceForward(bal, net, 0)).toBeCloseTo(bal, 6);
      }),
    );
  });

  it('doubling the horizon doubles the projected change', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e5, max: 1e5, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 365, noNaN: true, noDefaultInfinity: true }),
        (bal, net, days) => {
          const d1 = projectBalanceForward(bal, net, days) - bal;
          const d2 = projectBalanceForward(bal, net, days * 2) - bal;
          expect(d2).toBeCloseTo(d1 * 2, 4);
        },
      ),
    );
  });
});
