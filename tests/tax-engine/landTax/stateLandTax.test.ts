/**
 * Phase 41e.12 — State land tax (NSW + VIC) tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLandTax,
  getLandTaxConfig,
  getSupportedStates,
  NSW_LAND_TAX_CY2025,
  VIC_LAND_TAX_FY2024_25,
  type LandTaxInput,
} from '@/lib/tax-engine/landTax/stateLandTax';

const baseInput = (o: Partial<LandTaxInput> = {}): LandTaxInput => ({
  taxableLandValue: 0,
  ownershipType: 'INDIVIDUAL',
  isForeignOwner: false,
  isResidential: true,
  ...o,
});

describe('calculateLandTax — NSW general (s27)', () => {
  it('value 0 → no tax', () => {
    const r = calculateLandTax(baseInput({ taxableLandValue: 0 }), NSW_LAND_TAX_CY2025);
    expect(r.totalTax).toBe(0);
    expect(r.generalLandTax).toBe(0);
  });

  it('value below NSW threshold ($1.075M) → no general tax', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_000_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.generalLandTax).toBe(0);
    expect(r.breakdown.some((b) => b.label.includes('Below'))).toBe(true);
  });

  it('value at exact NSW threshold ($1.075M) → applies bracket but $0 tax', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_075_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.generalLandTax).toBe(0);
  });

  it('value $1.5M → $100 + 1.6% × $425k = $6,900', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_500_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.generalLandTax).toBeCloseTo(6_900, 2);
  });

  it('value $2M → $100 + 1.6% × $925k = $14,900', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 2_000_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.generalLandTax).toBeCloseTo(14_900, 2);
  });

  it('value $7M → $88,036 + 2% × $429k = $96,616 (top bracket)', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 7_000_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.generalLandTax).toBeCloseTo(96_616, 2);
  });
});

describe('calculateLandTax — VIC general (Schedule 1)', () => {
  it('value below VIC threshold ($50k) → no general tax', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 40_000 }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.generalLandTax).toBe(0);
  });

  it('value $100k → $0 + 0.2% × $50k = $100', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 100_000 }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.generalLandTax).toBeCloseTo(100, 2);
  });

  it('value $600k → $1,100 + 0.95% × $300k = $3,950', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 600_000 }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.generalLandTax).toBeCloseTo(3_950, 2);
  });

  it('value $5M → $46,950 + 2.65% × $2M = $99,950 (top bracket)', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 5_000_000 }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.generalLandTax).toBeCloseTo(99_950, 2);
  });
});

describe('calculateLandTax — Trust surcharge (s5A NSW / s46IB VIC)', () => {
  it('NSW discretionary trust @ $500k → 1.5% × $500k = $7,500', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000, ownershipType: 'DISCRETIONARY_TRUST' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.trustSurcharge).toBeCloseTo(7_500, 2);
  });

  it('NSW discretionary trust @ $2M → capped at 1.5% × $1.075M = $16,125', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 2_000_000, ownershipType: 'DISCRETIONARY_TRUST' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.trustSurcharge).toBeCloseTo(16_125, 2);
  });

  it('VIC discretionary trust @ $500k → 0.5% × $500k = $2,500', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000, ownershipType: 'DISCRETIONARY_TRUST' }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.trustSurcharge).toBeCloseTo(2_500, 2);
  });

  it('UNIT_TRUST_NON_FIXED → trust surcharge applies', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000, ownershipType: 'UNIT_TRUST_NON_FIXED' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.trustSurcharge).toBeGreaterThan(0);
  });

  it('UNIT_TRUST_FIXED → NO trust surcharge', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000, ownershipType: 'UNIT_TRUST_FIXED' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.trustSurcharge).toBe(0);
  });

  it('INDIVIDUAL → NO trust surcharge', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 2_000_000, ownershipType: 'INDIVIDUAL' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.trustSurcharge).toBe(0);
  });

  it('Trust surcharge always emits UC-LAND-TAX-TRUST-SURCHARGE-NUANCE', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000, ownershipType: 'DISCRETIONARY_TRUST' }),
      NSW_LAND_TAX_CY2025,
    );
    expect(
      r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-TRUST-SURCHARGE-NUANCE'),
    ).toBe(true);
  });
});

describe('calculateLandTax — Foreign owner surcharge (Sch 1A NSW / s46IC VIC)', () => {
  it('NSW foreign + residential @ $1M → 4% × $1M = $40,000', () => {
    const r = calculateLandTax(
      baseInput({
        taxableLandValue: 1_000_000,
        isForeignOwner: true,
        isResidential: true,
      }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.foreignOwnerSurcharge).toBeCloseTo(40_000, 2);
  });

  it('NSW foreign + non-residential → no foreign surcharge', () => {
    const r = calculateLandTax(
      baseInput({
        taxableLandValue: 1_000_000,
        isForeignOwner: true,
        isResidential: false,
      }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.foreignOwnerSurcharge).toBe(0);
  });

  it('VIC absentee + residential @ $1M → 4% × $1M = $40,000', () => {
    const r = calculateLandTax(
      baseInput({
        taxableLandValue: 1_000_000,
        isForeignOwner: true,
        isResidential: true,
      }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.foreignOwnerSurcharge).toBeCloseTo(40_000, 2);
  });

  it('VIC absentee + non-residential → still applies (VIC surcharge covers all land)', () => {
    const r = calculateLandTax(
      baseInput({
        taxableLandValue: 1_000_000,
        isForeignOwner: true,
        isResidential: false,
      }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.foreignOwnerSurcharge).toBeCloseTo(40_000, 2);
  });

  it('Australian resident → no foreign surcharge', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_000_000, isForeignOwner: false }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.foreignOwnerSurcharge).toBe(0);
  });
});

describe('calculateLandTax — combined scenarios', () => {
  it('NSW foreign discretionary trust @ $1.5M residential = general + trust + foreign', () => {
    const r = calculateLandTax(
      baseInput({
        taxableLandValue: 1_500_000,
        ownershipType: 'DISCRETIONARY_TRUST',
        isForeignOwner: true,
        isResidential: true,
      }),
      NSW_LAND_TAX_CY2025,
    );
    // General: $100 + 1.6% × $425k = $6,900
    expect(r.generalLandTax).toBeCloseTo(6_900, 2);
    // Trust: 1.5% × $1.075M (capped) = $16,125
    expect(r.trustSurcharge).toBeCloseTo(16_125, 2);
    // Foreign: 4% × $1.5M = $60,000
    expect(r.foreignOwnerSurcharge).toBeCloseTo(60_000, 2);
    // Total
    expect(r.totalTax).toBeCloseTo(6_900 + 16_125 + 60_000, 2);
  });

  it('Australian individual @ $500k NSW residential → no tax at all', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 500_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.totalTax).toBe(0);
  });
});

describe('calculateLandTax — uncomputed flags', () => {
  it('always emits UC-MULTI-STATE-LAND-TAX', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 0 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-MULTI-STATE-LAND-TAX')).toBe(true);
  });

  it('emits UC-LAND-TAX-PPOR-EXEMPTION when taxable value > 0', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_000_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-PPOR-EXEMPTION')).toBe(true);
  });

  it('skips UC-LAND-TAX-PPOR-EXEMPTION when taxable value is 0 (caller exempted)', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 0 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-PPOR-EXEMPTION')).toBe(false);
  });
});

describe('calculateLandTax — citations', () => {
  it('NSW always cites s27 + s5A + Sch 1A', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 1_500_000 }),
      NSW_LAND_TAX_CY2025,
    );
    expect(r.citations.some((c) => c.reference.includes('s27'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s5A'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('Sch 1A'))).toBe(true);
  });

  it('VIC always cites Schedule 1 + s46IB + s46IC', () => {
    const r = calculateLandTax(
      baseInput({ taxableLandValue: 600_000 }),
      VIC_LAND_TAX_FY2024_25,
    );
    expect(r.citations.some((c) => c.reference.includes('Schedule 1'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s46IB'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s46IC'))).toBe(true);
  });
});

describe('getLandTaxConfig + getSupportedStates', () => {
  it('NSW + VIC supported in v1', () => {
    const supported = getSupportedStates();
    expect(supported).toContain('NSW');
    expect(supported).toContain('VIC');
  });

  it('getLandTaxConfig returns correct config for NSW', () => {
    expect(getLandTaxConfig('NSW')).toBe(NSW_LAND_TAX_CY2025);
  });

  it('getLandTaxConfig returns correct config for VIC', () => {
    expect(getLandTaxConfig('VIC')).toBe(VIC_LAND_TAX_FY2024_25);
  });

  it('throws for unsupported states (QLD/SA/WA/TAS/ACT/NT) in v1', () => {
    expect(() => getLandTaxConfig('QLD')).toThrow(/41e.13/);
    expect(() => getLandTaxConfig('SA')).toThrow(/41e.13/);
    expect(() => getLandTaxConfig('WA')).toThrow(/41e.13/);
  });
});
