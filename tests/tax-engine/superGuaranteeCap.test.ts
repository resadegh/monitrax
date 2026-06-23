/**
 * P1 regression — Super Guarantee max-contribution-base cap (2026-06-23 audit).
 *
 * `calculateSuperGuarantee` hardcoded the quarterly max contribution base at
 * $62,500 (FY25-26's value) instead of reading `config.superGuaranteeQuarterlyCap`
 * (the per-FY SSOT). For FY24-25 the base is $65,070/qtr — using $62,500
 * understated SG for high earners. Fixed to use the config (SSOT) in both the
 * float and Decimal paths.
 *
 * ATO max super contribution base (per quarter), held in taxYearConfig:
 *   FY24-25 = $65,070  (SG rate 11.5%)
 *   FY25-26 = $62,500  (SG rate 12%)
 * Annual base = quarterly × 4. SG = min(salary, annualBase) × rate.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSuperGuarantee,
  calculateSuperGuaranteeDecimal,
} from '@/lib/tax-engine/super/contributionCalculator';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const fy2425 = getTaxYearConfig('2024-25');
const fy2526 = getTaxYearConfig('2025-26');

describe('Super Guarantee cap uses per-FY config base (P1 regression)', () => {
  it('FY24-25 high earner caps at $65,070/qtr × 4 × 11.5% (not the old $62,500)', () => {
    // 65070*4 = 260,280 annual base; ×0.115 = 29,932.20
    expect(calculateSuperGuarantee(300000, fy2425).amount).toBeCloseTo(29932.2, 2);
    // the old hardcoded $62,500 would have given 250000*0.115 = 28,750 — must NOT
    expect(calculateSuperGuarantee(300000, fy2425).amount).not.toBeCloseTo(28750, 2);
  });

  it('FY25-26 high earner caps at $62,500/qtr × 4 × 12%', () => {
    // 62500*4 = 250,000 annual base; ×0.12 = 30,000
    expect(calculateSuperGuarantee(300000, fy2526).amount).toBeCloseTo(30000, 2);
  });

  it('below the cap: SG is the full rate on salary', () => {
    expect(calculateSuperGuarantee(100000, fy2425).amount).toBeCloseTo(11500, 2); // 100000*0.115
  });

  it('Decimal path matches the float path', () => {
    expect(calculateSuperGuaranteeDecimal(300000, fy2425).amount.toFixed(2)).toBe('29932.20');
    expect(calculateSuperGuaranteeDecimal(300000, fy2526).amount.toFixed(2)).toBe('30000.00');
    expect(calculateSuperGuaranteeDecimal(100000, fy2425).amount.toFixed(2)).toBe('11500.00');
  });
});
