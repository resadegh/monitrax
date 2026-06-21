/**
 * Phase 51.1 — loan repayment matching engine: pure-matcher tests. This is the
 * correctness-critical logic (it drives a tax-relevant link), so the tiers,
 * the "leave unmatched when ambiguous" rule, and the IO-variance case are all
 * pinned here. DB orchestration (suggest/resolve) is integration-covered.
 */

import { describe, it, expect } from 'vitest';
import { matchLoanRepayments } from '@/lib/bookkeeping/loanLedger/matchRepayments';

const d = (s: string) => new Date(s);

describe('matchLoanRepayments', () => {
  it('exact amount + same day → high confidence (pre-selectable)', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1271.34 }],
      [{ id: 'o1', date: d('2026-05-15'), amount: 1271.34 }]
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ loanTransactionId: 'r1', matchedTransactionId: 'o1' });
    expect(out[0].confidence).toBeCloseTo(0.98);
    expect(out[0].reason).toMatch(/exact match/i);
  });

  it('exact amount within the date window → strong but lower confidence', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1271.34 }],
      [{ id: 'o1', date: d('2026-05-17'), amount: 1271.34 }]
    );
    expect(out[0].confidence).toBeGreaterThan(0.66);
    expect(out[0].confidence).toBeLessThan(0.9);
    expect(out[0].reason).toMatch(/2 days apart/);
  });

  it('no candidate within the date window → unmatched (no suggestion)', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1271.34 }],
      [{ id: 'o1', date: d('2026-06-15'), amount: 1271.34 }]
    );
    expect(out).toHaveLength(0);
  });

  it('near (not exact) amount → low-confidence "needs a look" (IO variance)', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1275.34 }],
      [{ id: 'o1', date: d('2026-05-15'), amount: 1271.34 }]
    );
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.5);
    expect(out[0].reason).toMatch(/differs by \$4\.00 — interest-only repayment varies/);
  });

  it('amount beyond the near-tolerance → no match', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1500 }],
      [{ id: 'o1', date: d('2026-05-15'), amount: 1271.34 }]
    );
    expect(out).toHaveLength(0);
  });

  it('two equally-exact candidates → flagged ambiguous, confidence capped for review', () => {
    const out = matchLoanRepayments(
      [{ id: 'r1', date: d('2026-05-15'), amount: 1271.34 }],
      [
        { id: 'o1', date: d('2026-05-15'), amount: 1271.34 },
        { id: 'o2', date: d('2026-05-15'), amount: 1271.34 },
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBeLessThanOrEqual(0.6);
    expect(out[0].reason).toMatch(/possible matches/);
  });

  it('each offset outflow is used at most once (1:1)', () => {
    const out = matchLoanRepayments(
      [
        { id: 'r1', date: d('2026-05-15'), amount: 1271.34 },
        { id: 'r2', date: d('2026-06-15'), amount: 1271.34 },
      ],
      [
        { id: 'o1', date: d('2026-05-15'), amount: 1271.34 },
        { id: 'o2', date: d('2026-06-15'), amount: 1271.34 },
      ]
    );
    expect(out).toHaveLength(2);
    const matched = out.map((s) => s.matchedTransactionId).sort();
    expect(matched).toEqual(['o1', 'o2']);
  });

  it('disambiguates multiple months to the closest date (different loans, same amount)', () => {
    const out = matchLoanRepayments(
      [{ id: 'r-jun', date: d('2026-06-15'), amount: 1271.34 }],
      [
        { id: 'o-may', date: d('2026-05-15'), amount: 1271.34 },
        { id: 'o-jun', date: d('2026-06-16'), amount: 1271.34 },
      ]
    );
    expect(out[0].matchedTransactionId).toBe('o-jun');
  });
});
