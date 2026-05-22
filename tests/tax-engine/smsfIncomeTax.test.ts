/**
 * Phase 44 Part 2c-i — SMSF fund-earnings income-tax tests.
 *
 * A tax-compute module is legally consequential — every branch is
 * pinned: the 15% concessional rate, ECPI (and the carve-outs where it
 * does NOT apply — contributions + NALI), the NALI top rate, the
 * non-complying top rate, and the `UNCOMPUTED` honesty gate when the
 * ECPI proportion is unknown for a pension-phase fund.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSmsfIncomeTax,
  type SmsfIncomeTaxInput,
} from '@/lib/tax-engine/super/smsfIncomeTax';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const config = getTaxYearConfig('2024-25');

function input(over: Partial<SmsfIncomeTaxInput>): SmsfIncomeTaxInput {
  return {
    assessableInvestmentIncome: 0,
    deductions: 0,
    assessableContributions: 0,
    nonArmsLengthIncome: 0,
    isComplying: true,
    isInPensionPhase: false,
    ...over,
  };
}

describe('Phase 44 Part 2c-i — SMSF income tax: complying, accumulation phase', () => {
  it('taxes net investment income + contributions at 15%', () => {
    const r = calculateSmsfIncomeTax(
      input({ assessableInvestmentIncome: 10000, deductions: 2000, assessableContributions: 20000 }),
      config,
    );
    // net investment income 8000 @ 15% = 1200; contributions 20000 @ 15% = 3000.
    expect(r.investmentIncomeTax).toBeCloseTo(1200, 4);
    expect(r.contributionsTax).toBeCloseTo(3000, 4);
    expect(r.naliTax).toBe(0);
    expect(r.tax).toBeCloseTo(4200, 4);
    expect(r.uncomputed).toHaveLength(0);
  });

  it('floors negative net investment income at zero', () => {
    const r = calculateSmsfIncomeTax(
      input({ assessableInvestmentIncome: 1000, deductions: 5000 }),
      config,
    );
    expect(r.investmentIncomeTax).toBe(0);
    expect(r.tax).toBe(0);
  });
});

describe('Phase 44 Part 2c-i — SMSF income tax: NALI', () => {
  it('taxes NALI at the top marginal rate even for a complying fund', () => {
    const r = calculateSmsfIncomeTax(input({ nonArmsLengthIncome: 5000 }), config);
    // 5000 @ 45% = 2250.
    expect(r.naliTax).toBeCloseTo(2250, 4);
    expect(r.tax).toBeCloseTo(2250, 4);
  });

  it('ECPI never reduces NALI — NALI is taxed in full in pension phase', () => {
    const r = calculateSmsfIncomeTax(
      input({ nonArmsLengthIncome: 5000, isInPensionPhase: true, ecpiExemptProportion: 1 }),
      config,
    );
    expect(r.naliTax).toBeCloseTo(2250, 4);
  });
});

describe('Phase 44 Part 2c-i — SMSF income tax: ECPI (pension phase)', () => {
  it('exempts the ECPI proportion of investment income; contributions unaffected', () => {
    const r = calculateSmsfIncomeTax(
      input({
        assessableInvestmentIncome: 10000,
        assessableContributions: 20000,
        isInPensionPhase: true,
        ecpiExemptProportion: 0.6,
      }),
      config,
    );
    // 60% of 10000 exempt → 4000 assessable @ 15% = 600; contributions 20000 @ 15% = 3000.
    expect(r.ecpiExemptAmount).toBeCloseTo(6000, 4);
    expect(r.investmentIncomeTax).toBeCloseTo(600, 4);
    expect(r.contributionsTax).toBeCloseTo(3000, 4);
    expect(r.tax).toBeCloseTo(3600, 4);
  });

  it('ECPI does NOT apply to assessable contributions — they stay 15% even at 100% ECPI', () => {
    const r = calculateSmsfIncomeTax(
      input({
        assessableInvestmentIncome: 10000,
        assessableContributions: 20000,
        isInPensionPhase: true,
        ecpiExemptProportion: 1,
      }),
      config,
    );
    expect(r.investmentIncomeTax).toBe(0);
    expect(r.contributionsTax).toBeCloseTo(3000, 4);
    expect(r.tax).toBeCloseTo(3000, 4);
  });

  it('clamps an out-of-range ECPI proportion into 0..1', () => {
    const r = calculateSmsfIncomeTax(
      input({ assessableInvestmentIncome: 10000, isInPensionPhase: true, ecpiExemptProportion: 1.5 }),
      config,
    );
    expect(r.ecpiExemptAmount).toBeCloseTo(10000, 4);
    expect(r.investmentIncomeTax).toBe(0);
  });

  it('returns UNCOMPUTED when a pension-phase fund has no ECPI proportion', () => {
    const r = calculateSmsfIncomeTax(
      input({
        assessableInvestmentIncome: 10000,
        assessableContributions: 20000,
        nonArmsLengthIncome: 4000,
        isInPensionPhase: true,
        // ecpiExemptProportion deliberately omitted
      }),
      config,
    );
    expect(r.tax).toBeNull();
    expect(r.investmentIncomeTax).toBeNull();
    expect(r.ecpiExemptAmount).toBeNull();
    expect(r.uncomputed.map((u) => u.id)).toContain('UC-SMSF-ECPI-PROPORTION');
    // Contributions + NALI tax — where ECPI never applies — are still shown.
    expect(r.contributionsTax).toBeCloseTo(3000, 4);
    expect(r.naliTax).toBeCloseTo(1800, 4);
  });
});

describe('Phase 44 Part 2c-i — SMSF income tax: non-complying fund', () => {
  it('taxes all assessable income at the top rate', () => {
    const r = calculateSmsfIncomeTax(
      input({
        assessableInvestmentIncome: 10000,
        assessableContributions: 5000,
        isComplying: false,
      }),
      config,
    );
    // (10000 + 5000) @ 45% = 6750.
    expect(r.tax).toBeCloseTo(6750, 4);
    expect(r.isComplying).toBe(false);
  });
});
