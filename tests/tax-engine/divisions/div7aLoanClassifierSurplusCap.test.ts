/**
 * Phase 41f.3 — Div 7A surplus-cap tests.
 *
 * Verifies the new `Div7AClassifyOptions.distributableSurplus` opt
 * caps the aggregate deemed-dividend exposure pro-rata across loans
 * and swaps in the right UNCOMPUTED flag set:
 *   - surplus provided + cap binds → UC-DIV7A-SURPLUS-CAPPED + UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE
 *   - surplus provided + cap doesn't bind → UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE only
 *   - surplus omitted → legacy UC-DIV7A-DISTRIBUTABLE-SURPLUS (unchanged)
 */

import { describe, it, expect } from 'vitest';
import {
  classifyDiv7ALoans,
  type Div7ALoanInput,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';

const NO_AGREEMENT_LOAN: Div7ALoanInput = {
  loanId: 'L1',
  openingBalance: 100_000,
  yearsRemaining: 7,
  benchmarkRate: 0.0837,
  paymentsMadeThisFy: 0,
  hasComplianceAgreement: false, // → NO_AGREEMENT → deemed dividend = openingBalance
};

describe('Phase 41f.3 — Div 7A surplus cap', () => {
  describe('legacy path — no surplus provided', () => {
    it('emits UC-DIV7A-DISTRIBUTABLE-SURPLUS (legacy flag) when deemed > 0', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN]);
      expect(r.totalDeemedDividend).toBe(100_000);
      expect(r.uncomputed.map((u) => u.id)).toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS');
      expect(r.uncomputed.map((u) => u.id)).not.toContain('UC-DIV7A-SURPLUS-CAPPED');
      expect(r.uncomputed.map((u) => u.id)).not.toContain(
        'UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE',
      );
    });

    it('does NOT emit any surplus flag when deemed = 0', () => {
      const compliant: Div7ALoanInput = {
        ...NO_AGREEMENT_LOAN,
        hasComplianceAgreement: true,
        paymentsMadeThisFy: 50_000, // covers MRP
      };
      const r = classifyDiv7ALoans([compliant]);
      expect(r.totalDeemedDividend).toBe(0);
      const ids = r.uncomputed.map((u) => u.id);
      expect(ids).not.toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS');
      expect(ids).not.toContain('UC-DIV7A-SURPLUS-CAPPED');
    });
  });

  describe('surplus provided — cap binds (gross > surplus)', () => {
    it('caps total deemed dividend to the surplus and pro-rata distributes per loan', () => {
      const r = classifyDiv7ALoans(
        [
          { ...NO_AGREEMENT_LOAN, loanId: 'L1', openingBalance: 60_000 },
          { ...NO_AGREEMENT_LOAN, loanId: 'L2', openingBalance: 40_000 },
        ],
        { distributableSurplus: 50_000 },
      );

      // Gross = 100k; surplus = 50k → cap binds → totals = 50k
      expect(r.totalDeemedDividend).toBe(50_000);

      // Pro-rata: L1 was 60k of 100k gross → 60% × 50k = 30k
      // Pro-rata: L2 was 40k of 100k gross → 40% × 50k = 20k
      const l1 = r.classifications.find((c) => c.loanId === 'L1')!;
      const l2 = r.classifications.find((c) => c.loanId === 'L2')!;
      expect(l1.deemedDividendAmount).toBe(30_000);
      expect(l2.deemedDividendAmount).toBe(20_000);
    });

    it('emits UC-DIV7A-SURPLUS-CAPPED + UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE when cap binds', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 30_000 });
      const ids = r.uncomputed.map((u) => u.id);
      expect(ids).toContain('UC-DIV7A-SURPLUS-CAPPED');
      expect(ids).toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE');
      // The legacy flag must NOT be emitted when surplus was provided
      expect(ids).not.toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS');
    });
  });

  describe('surplus provided — cap does not bind (gross ≤ surplus)', () => {
    it('keeps the gross deemed dividend unchanged when surplus > gross', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 200_000 });
      expect(r.totalDeemedDividend).toBe(100_000); // gross unchanged
      const l1 = r.classifications.find((c) => c.loanId === 'L1')!;
      expect(l1.deemedDividendAmount).toBe(100_000);
    });

    it('keeps the gross deemed dividend unchanged when surplus = gross (boundary)', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 100_000 });
      expect(r.totalDeemedDividend).toBe(100_000);
    });

    it('emits ONLY UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE (no SURPLUS-CAPPED) when cap does not bind', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 200_000 });
      const ids = r.uncomputed.map((u) => u.id);
      expect(ids).toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE');
      expect(ids).not.toContain('UC-DIV7A-SURPLUS-CAPPED');
      expect(ids).not.toContain('UC-DIV7A-DISTRIBUTABLE-SURPLUS');
    });
  });

  describe('surplus = 0 — fully caps deemed dividend to 0', () => {
    it('zeroes the deemed dividend when surplus is 0', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 0 });
      expect(r.totalDeemedDividend).toBe(0);
      const l1 = r.classifications.find((c) => c.loanId === 'L1')!;
      expect(l1.deemedDividendAmount).toBe(0);
    });
  });

  describe('input validation — surplus opt is forgiving', () => {
    it('treats negative surplus as "not provided" (legacy path)', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: -100 });
      expect(r.totalDeemedDividend).toBe(100_000); // not capped
      // Negative surplus is a config error from the caller; we don't crash, we just
      // ignore it AND don't emit the surplus flags (legacy path)
      const ids = r.uncomputed.map((u) => u.id);
      expect(ids).not.toContain('UC-DIV7A-SURPLUS-CAPPED');
    });

    it('treats NaN surplus as "not provided" (legacy path)', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: NaN });
      expect(r.totalDeemedDividend).toBe(100_000);
    });
  });

  describe('citations', () => {
    it('always cites s109Y when the surplus opt is used', () => {
      const r = classifyDiv7ALoans([NO_AGREEMENT_LOAN], { distributableSurplus: 50_000 });
      expect(r.citations.some((c) => c.reference === 's109Y')).toBe(true);
    });
  });
});
