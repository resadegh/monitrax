/**
 * Phase 2 — Wealth Universe Money Flow lens.
 *
 * Pins the load-bearing §12.14 FW-1 / FW-2 dispatch in the wealth-graph
 * aggregator. This function decides which money-flow ribbons in the
 * canvas carry a "pending Royal Assent" notice — getting it wrong means
 * either (a) the user sees a tax warning that doesn't apply, or (b) the
 * canvas silently applies post-reform math we're not yet allowed to.
 *
 * Boundary discipline mirrors `reformConstants.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { classifyDistributionRegime } from '@/lib/services/wealthGraphService';

describe('Phase 2 §12.14 — classifyDistributionRegime', () => {
  describe('non-discretionary trusts are out of Measure 3 scope', () => {
    for (const trustType of ['FIXED', 'UNIT', 'CHARITABLE', 'OTHER', null] as const) {
      it(`returns PRE_REFORM for trustType=${trustType} regardless of FY`, () => {
        const r = classifyDistributionRegime('2028-29', trustType);
        expect(r.taxRegime).toBe('PRE_REFORM');
        expect(r.reformNotice).toBeNull();
      });
    }
  });

  describe('discretionary trusts pre-FY 2028-29 are PRE_REFORM', () => {
    for (const fy of ['2024-25', '2025-26', '2026-27', '2027-28']) {
      it(`returns PRE_REFORM for discretionary trust in FY ${fy}`, () => {
        const r = classifyDistributionRegime(fy, 'DISCRETIONARY');
        expect(r.taxRegime).toBe('PRE_REFORM');
        expect(r.reformNotice).toBeNull();
      });
    }
  });

  describe('discretionary trusts FY 2028-29 onwards', () => {
    it('FY 2028-29 + Bill not assented → POST_REFORM_PENDING with notice', () => {
      // All taxYearConfig entries currently have
      // `trustMinTaxCommencementVerified: false`. The function MUST
      // surface the notice and NOT compute the post-reform amount.
      const r = classifyDistributionRegime('2028-29', 'DISCRETIONARY');
      expect(r.taxRegime).toBe('POST_REFORM_PENDING');
      expect(r.reformNotice).not.toBeNull();
      expect(r.reformNotice).toContain('30% minimum tax');
      expect(r.reformNotice).toContain('Royal Assent');
      // §12.14 FW-2 — the notice must explicitly call out that the
      // amount is the GROSS figure, not the post-reform one.
      expect(r.reformNotice).toContain('gross');
    });

    it('FY 2029-30 (further post-commencement) also POST_REFORM_PENDING when Bill not assented', () => {
      const r = classifyDistributionRegime('2029-30', 'DISCRETIONARY');
      expect(r.taxRegime).toBe('POST_REFORM_PENDING');
      expect(r.reformNotice).not.toBeNull();
    });
  });

  describe('malformed FY input is handled safely (no throw)', () => {
    it('returns PRE_REFORM for an invalid FY string instead of throwing', () => {
      // The canvas must never crash on a malformed FY in user data.
      // The flow is still rendered — just without a post-reform notice.
      const r = classifyDistributionRegime('not-a-fy', 'DISCRETIONARY');
      expect(r.taxRegime).toBe('PRE_REFORM');
      expect(r.reformNotice).toBeNull();
    });
  });
});
