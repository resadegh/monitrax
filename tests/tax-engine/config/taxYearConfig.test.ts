/**
 * Master-config self-test — Phase 41e.−1 cleanup PR D.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.4, this
 * test asserts the canon. If anyone deletes a TaxYearConfig field,
 * hard-codes a value back, or forgets to extend the config to a new FY,
 * CI catches it.
 */

import { describe, it, expect } from 'vitest';
import {
  TAX_YEAR_2023_24,
  TAX_YEAR_2024_25,
  TAX_YEAR_2025_26,
  getTaxYearConfig,
  getCurrentTaxYearConfig,
} from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

const ALL_FYS: ReadonlyArray<{ fy: string; config: TaxYearConfig }> = [
  { fy: '2023-24', config: TAX_YEAR_2023_24 },
  { fy: '2024-25', config: TAX_YEAR_2024_25 },
  { fy: '2025-26', config: TAX_YEAR_2025_26 },
];

describe('TaxYearConfig — canonical SSOT (CLAUDE.md §12.2 + audit §10.4)', () => {
  describe.each(ALL_FYS)('$fy', ({ config }) => {
    it('has every field populated (no undefined required keys)', () => {
      expect(config.financialYear).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.startDate).toBeInstanceOf(Date);
      expect(config.endDate).toBeInstanceOf(Date);
      expect(config.brackets.length).toBeGreaterThan(0);
      expect(config.taxFreeThreshold).toBeGreaterThan(0);
      expect(config.medicareRate).toBeGreaterThan(0);
      expect(config.medicareThresholds).toBeDefined();
      expect(config.medicareSurchargeThresholds.length).toBeGreaterThan(0);
      expect(config.lito).toBeDefined();
      expect(config.superGuaranteeRate).toBeGreaterThan(0);
      expect(config.superGuaranteeQuarterlyCap).toBeGreaterThan(0);
      expect(config.concessionalCap).toBeGreaterThan(0);
      expect(config.nonConcessionalCap).toBeGreaterThan(0);
      expect(config.division293Threshold).toBeGreaterThan(0);
      expect(config.superContributionsTaxRate).toBeGreaterThan(0);
      expect(config.coContributionIncomeThreshold).toBeGreaterThan(0);
      expect(config.carryForwardTsbThreshold).toBeGreaterThan(0);
      expect(config.bringForwardThresholds.full).toBeGreaterThan(0);
      expect(config.bringForwardThresholds.reduced).toBeGreaterThan(0);
      expect(config.bringForwardThresholds.none).toBeGreaterThan(0);
      expect(config.cgtDiscount).toBeGreaterThan(0);
      expect(config.cgtDiscountMonths).toBeGreaterThan(0);
      expect(config.reviewSchedule.nextReviewBy).toBeTruthy();
      expect(config.reviewSchedule.reviewers.length).toBeGreaterThan(0);
    });

    it('brackets cover [0, ∞) with no gaps or overlaps', () => {
      const sorted = [...config.brackets].sort((a, b) => a.min - b.min);
      // First bracket starts at 0
      expect(sorted[0].min).toBe(0);
      // Final bracket has no upper bound
      expect(sorted[sorted.length - 1].max).toBeNull();
      // Each subsequent bracket starts exactly 1 above the previous bracket's max
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        expect(prev.max).not.toBeNull();
        expect(cur.min).toBe((prev.max as number) + 1);
      }
    });

    it('all bracket rates are non-negative + ascending', () => {
      const sorted = [...config.brackets].sort((a, b) => a.min - b.min);
      let prevRate = -1;
      for (const bracket of sorted) {
        expect(bracket.rate).toBeGreaterThanOrEqual(0);
        expect(bracket.rate).toBeGreaterThanOrEqual(prevRate);
        prevRate = bracket.rate;
      }
    });

    it('bringForward thresholds are monotonically ordered (full ≤ reduced ≤ none)', () => {
      expect(config.bringForwardThresholds.full).toBeLessThanOrEqual(
        config.bringForwardThresholds.reduced,
      );
      expect(config.bringForwardThresholds.reduced).toBeLessThanOrEqual(
        config.bringForwardThresholds.none,
      );
    });

    it('superContributionsTaxRate is the canonical 15% (ITAA 1997 s295-485)', () => {
      // Sanity guard — if AU policy ever changes this, the failing
      // assertion is the trigger to update the rate everywhere via
      // this single canonical home (audit §10.1).
      expect(config.superContributionsTaxRate).toBe(0.15);
    });

    it('reviewSchedule.nextReviewBy is a valid ISO date string', () => {
      const parsed = new Date(config.reviewSchedule.nextReviewBy);
      expect(parsed.toString()).not.toBe('Invalid Date');
    });
  });

  it('FY24-25 → FY25-26 SG rate rises to 12% per ATO schedule', () => {
    expect(TAX_YEAR_2024_25.superGuaranteeRate).toBe(0.115);
    expect(TAX_YEAR_2025_26.superGuaranteeRate).toBe(0.12);
  });

  it('FY25-26 is registered in the lookup (resolves audit C-4)', () => {
    expect(getTaxYearConfig('2025-26')).toBe(TAX_YEAR_2025_26);
  });

  it('getCurrentTaxYearConfig returns one of the registered configs', () => {
    const current = getCurrentTaxYearConfig();
    const registered = ALL_FYS.map((f) => f.config);
    expect(registered).toContain(current);
  });

  it('reviewSchedule.nextReviewBy for the current FY is in the future', () => {
    // The whole point of the field per audit §10.2 — forces a human
    // review checkpoint before each FY rolls in. If the date is past,
    // the review is overdue and the failing test is the reminder.
    const current = getCurrentTaxYearConfig();
    const reviewDate = new Date(current.reviewSchedule.nextReviewBy);
    const now = new Date();
    expect(reviewDate.getTime()).toBeGreaterThan(now.getTime());
  });
});
