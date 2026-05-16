/**
 * Phase 41E.1 — Reform engine module skeleton tests.
 *
 * Asserts that every reform-aware engine module:
 *   1. Returns UNCOMPUTED (`computed: false`) when its
 *      `commencementVerified` flag is `false` (Stage 1 default).
 *   2. Surfaces its measure-specific UC-*-PENDING-* identifier.
 *   3. Does NOT produce a tax number until commencement is verified.
 *   4. Throws loudly if commencementVerified is flipped without the
 *      Stage 2 mechanic being implemented (defensive — protects
 *      against silent post-reform numbers per CLAUDE.md §12.14 FW-2).
 *
 * Also asserts back-compat:
 *   - `applyNegativeGearing` with no `regime` parameter behaves
 *     byte-for-byte identically to its pre-41E.1 behaviour.
 *   - `calculateCgtDiscount` with no reform-related inputs behaves
 *     byte-for-byte identically to its pre-41E.1 behaviour.
 */

import { describe, it, expect } from 'vitest';
import { applyCgtIndexation } from '@/lib/tax-engine/divisions/cgtIndexation';
import { applyCgtMinimumRate, getCgtMinimumEffectiveRate } from '@/lib/tax-engine/divisions/cgtMinimumRate';
import { applyTrustMinimumTax } from '@/lib/tax-engine/divisions/trustMinimumTax';
import {
  applyForeignResidentCgt,
  getForeignResidentNotificationThresholdAud,
} from '@/lib/tax-engine/divisions/foreignResidentCgt';
import {
  applyLossRefundability,
  getLossCarryBackTurnoverCapAud,
} from '@/lib/tax-engine/divisions/lossRefundability';
import { applyNegativeGearing } from '@/lib/tax-engine/divisions/negativeGearing';
import { calculateCgtDiscount } from '@/lib/tax-engine/divisions/cgtDiscount';
import { TAX_YEAR_2025_26 } from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

const configWithFlag = (flag: keyof TaxYearConfig, value: boolean): TaxYearConfig => ({
  ...TAX_YEAR_2025_26,
  [flag]: value,
});

// =============================================================================
// CGT Indexation (Measure 2 — skeleton)
// =============================================================================

describe('Phase 41E.1 — cgtIndexation skeleton', () => {
  it('returns UNCOMPUTED when commencement flag is false (Stage 1 default)', () => {
    const result = applyCgtIndexation({
      costBase: 500_000,
      acquisitionQuarter: '2027-Q3',
      disposalQuarter: '2030-Q1',
      saleProceeds: 700_000,
      config: TAX_YEAR_2025_26,
    });
    expect(result.computed).toBe(false);
    expect(result.indexedCostBase).toBe(0);
    expect(result.indexedGain).toBe(0);
    expect(result.uncomputed).toHaveLength(1);
    expect(result.uncomputed[0].id).toBe('UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT');
  });

  it('throws if commencement flag is flipped without mechanic (FW-2 defensive)', () => {
    expect(() =>
      applyCgtIndexation({
        costBase: 500_000,
        acquisitionQuarter: '2027-Q3',
        disposalQuarter: '2030-Q1',
        saleProceeds: 700_000,
        config: configWithFlag('cgtIndexationCommencementVerified', true),
      }),
    ).toThrow(/indexation mechanic is not yet implemented/);
  });
});

// =============================================================================
// CGT Minimum Rate (Measure 2 — skeleton)
// =============================================================================

describe('Phase 41E.1 — cgtMinimumRate skeleton', () => {
  it('returns UNCOMPUTED when commencement flag is false', () => {
    const result = applyCgtMinimumRate({
      indexedGain: 100_000,
      marginalRate: 0.45,
      config: TAX_YEAR_2025_26,
    });
    expect(result.computed).toBe(false);
    expect(result.taxPayable).toBe(0);
    expect(result.uncomputed[0].id).toBe('UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT');
  });

  it('exposes 30% floor value for AI advisor narration', () => {
    expect(getCgtMinimumEffectiveRate()).toBe(0.30);
  });

  it('throws if commencement flag is flipped without mechanic', () => {
    expect(() =>
      applyCgtMinimumRate({
        indexedGain: 100_000,
        marginalRate: 0.45,
        config: configWithFlag('cgtMinRateCommencementVerified', true),
      }),
    ).toThrow(/30% floor mechanic is not yet implemented/);
  });
});

// =============================================================================
// Trust Minimum Tax (Measure 3 — skeleton)
// =============================================================================

describe('Phase 41E.1 — trustMinimumTax skeleton', () => {
  it('returns out-of-scope for non-DISCRETIONARY trusts', () => {
    const result = applyTrustMinimumTax({
      trustEntityId: 'e1',
      trustType: 'UNIT',
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config: TAX_YEAR_2025_26,
      fy: '2028-29',
    });
    expect(result.inScope).toBe(false);
    expect(result.computed).toBe(true);
    expect(result.topUpTax).toBe(0);
    expect(result.reason).toMatch(/UNIT/);
  });

  it('returns out-of-scope + UC-TRUST-TYPE-UNKNOWN when trustType is null', () => {
    const result = applyTrustMinimumTax({
      trustEntityId: 'e1',
      trustType: null,
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config: TAX_YEAR_2025_26,
      fy: '2028-29',
    });
    expect(result.inScope).toBe(false);
    expect(result.uncomputed[0].id).toBe('UC-TRUST-TYPE-UNKNOWN');
  });

  it('returns UNCOMPUTED for DISCRETIONARY when commencement is unverified', () => {
    const result = applyTrustMinimumTax({
      trustEntityId: 'e1',
      trustType: 'DISCRETIONARY',
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config: TAX_YEAR_2025_26,
      fy: '2028-29',
    });
    expect(result.inScope).toBe(true);
    expect(result.computed).toBe(false);
    expect(result.uncomputed[0].id).toBe('UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT');
  });

  it('throws if commencement flag is flipped without mechanic', () => {
    expect(() =>
      applyTrustMinimumTax({
        trustEntityId: 'e1',
        trustType: 'DISCRETIONARY',
        taxableIncome: 200_000,
        actualBeneficiaryTax: 80_000,
        config: configWithFlag('trustMinTaxCommencementVerified', true),
        fy: '2028-29',
      }),
    ).toThrow(/Measure 3 mechanic is not yet implemented/);
  });
});

// =============================================================================
// Foreign-Resident CGT (Measure 4 — skeleton with exposure draft)
// =============================================================================

describe('Phase 41E.1 — foreignResidentCgt skeleton', () => {
  it('returns out-of-scope for domestic entities', () => {
    const result = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: false,
      nominalGain: 100_000,
      disposalValue: 1_000_000,
      config: TAX_YEAR_2025_26,
      fy: '2026-27',
    });
    expect(result.inScope).toBe(false);
    expect(result.taxPayable).toBe(0);
  });

  it('null isForeignResident → out-of-scope (default to resident)', () => {
    const result = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: null,
      nominalGain: 100_000,
      disposalValue: 1_000_000,
      config: TAX_YEAR_2025_26,
      fy: '2026-27',
    });
    expect(result.inScope).toBe(false);
  });

  it('foreign-resident → UNCOMPUTED with UC-FR-CGT-PENDING-ROYAL-ASSENT', () => {
    const result = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: true,
      nominalGain: 100_000,
      disposalValue: 1_000_000,
      config: TAX_YEAR_2025_26,
      fy: '2026-27',
    });
    expect(result.inScope).toBe(true);
    expect(result.computed).toBe(false);
    expect(result.uncomputed[0].id).toBe('UC-FR-CGT-PENDING-ROYAL-ASSENT');
    expect(result.triggersNotification).toBe(false);
  });

  it('disposal > $50M triggers notification flag even when UNCOMPUTED', () => {
    const result = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: true,
      nominalGain: 10_000_000,
      disposalValue: 75_000_000,
      config: TAX_YEAR_2025_26,
      fy: '2026-27',
    });
    expect(result.triggersNotification).toBe(true);
    expect(result.uncomputed[0].rationale).toMatch(/TRIGGERS >\$50M notification/);
  });

  it('exposes $50M notification threshold for AI advisor narration', () => {
    expect(getForeignResidentNotificationThresholdAud()).toBe(50_000_000);
  });
});

// =============================================================================
// Loss Refundability (Measure 5 — skeleton with COVID-precedent mechanic)
// =============================================================================

describe('Phase 41E.1 — lossRefundability skeleton', () => {
  it('returns out-of-scope for non-COMPANY entities', () => {
    const result = applyLossRefundability({
      entityId: 'e1',
      entityType: 'OTHER',
      annualTurnoverCurrentFy: 500_000,
      currentFy: { fy: '2026-27', taxablePosition: -50_000, taxPaid: 0, frankingAccountBalance: 0 },
      config: TAX_YEAR_2025_26,
    });
    expect(result.inScope).toBe(false);
    expect(result.refundEligible).toBe(0);
  });

  it('returns out-of-scope when turnover >= $1B (carry-back ceiling)', () => {
    const result = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 2_000_000_000, // $2B
      currentFy: { fy: '2026-27', taxablePosition: -50_000, taxPaid: 0, frankingAccountBalance: 0 },
      config: TAX_YEAR_2025_26,
    });
    expect(result.inScope).toBe(false);
    expect(result.reason).toMatch(/exceeds the \$1,000,000,000 carry-back ceiling/);
  });

  it('returns zero-eligible when company has profit (no loss to carry back)', () => {
    const result = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000,
      currentFy: { fy: '2026-27', taxablePosition: 100_000, taxPaid: 25_000, frankingAccountBalance: 25_000 },
      config: TAX_YEAR_2025_26,
    });
    expect(result.inScope).toBe(true);
    expect(result.computed).toBe(true);
    expect(result.refundEligible).toBe(0);
    expect(result.reason).toMatch(/no loss/);
  });

  it('eligible company with loss + unverified commencement → UNCOMPUTED', () => {
    const result = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000,
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 0 },
      priorFy1: { fy: '2025-26', taxablePosition: 200_000, taxPaid: 50_000, frankingAccountBalance: 50_000 },
      config: TAX_YEAR_2025_26,
    });
    expect(result.inScope).toBe(true);
    expect(result.computed).toBe(false);
    expect(result.uncomputed[0].id).toBe('UC-LOSS-CARRYBACK-PENDING-BILL');
  });

  it('exposes turnover cap for AI advisor narration', () => {
    expect(getLossCarryBackTurnoverCapAud()).toBe(1_000_000_000);
  });
});

// =============================================================================
// Back-compat: applyNegativeGearing without regime parameter
// =============================================================================

describe('Phase 41E.1 — applyNegativeGearing back-compat', () => {
  it('without regime parameter, behaves byte-for-byte like pre-41E.1 (individual offset)', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      // no `regime` — defaults to PRE_REFORM_GRANDFATHERED
    });
    expect(result.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(result.lossAbsorbedThisFy).toBe(20_000);
    expect(result.taxableIncomeAtEntity).toBe(80_000);
    expect(result.uncomputed).toHaveLength(0);
  });

  it('with regime=PRE_REFORM_GRANDFATHERED, same behaviour as omitted', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      regime: 'PRE_REFORM_GRANDFATHERED',
    });
    expect(result.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(result.lossAbsorbedThisFy).toBe(20_000);
  });

  it('with regime=POST_REFORM_NEW_BUILD, offset still permitted (new-build safe-harbour)', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      regime: 'POST_REFORM_NEW_BUILD',
    });
    expect(result.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(result.lossAbsorbedThisFy).toBe(20_000);
  });

  it('with regime=POST_REFORM_RESTRICTED, loss is trapped at entity', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      regime: 'POST_REFORM_RESTRICTED',
    });
    expect(result.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(result.lossAbsorbedThisFy).toBe(0);
    expect(result.lossCarriedForward).toBe(20_000);
    expect(result.taxableIncomeAtEntity).toBe(100_000); // salary untouched
    expect(result.uncomputed.some((u) => u.id === 'UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT')).toBe(true);
  });

  it('with regime=UC_PROPERTY_CONTRACT_DATE_UNKNOWN, surfaces UNCOMPUTED + falls back to pre-reform', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      regime: 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN',
    });
    expect(result.lossTreatment).toBe('OFFSET_OTHER_INCOME'); // conservative fallback
    expect(result.lossAbsorbedThisFy).toBe(20_000);
    expect(result.uncomputed.some((u) => u.id === 'UC-PROPERTY-CONTRACT-DATE-UNKNOWN')).toBe(true);
  });

  it('with regime=UC_NEW_BUILD_UNCONFIRMED, surfaces UNCOMPUTED + falls back to pre-reform', () => {
    const result = applyNegativeGearing({
      entityType: 'PERSONAL_NAME',
      grossIncome: 30_000,
      deductibleExpenses: 50_000,
      otherIncome: 100_000,
      regime: 'UC_NEW_BUILD_UNCONFIRMED',
    });
    expect(result.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(result.uncomputed.some((u) => u.id === 'UC-NEW-BUILD-UNCONFIRMED')).toBe(true);
  });
});

// =============================================================================
// Back-compat: calculateCgtDiscount without reform inputs
// =============================================================================

describe('Phase 41E.1 — calculateCgtDiscount back-compat', () => {
  it('without reform inputs, behaves byte-for-byte like pre-41E.1 (50% for individual)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      // no acquisitionContractDate / disposalFy / config
    });
    expect(result.discountRate).toBe(0.5);
    expect(result.discountedGain).toBe(50_000);
  });

  it('with reform inputs BUT cgtIndexationCommencementVerified=false → pre-reform behaviour', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: new Date('2027-01-01T00:00:00Z'), // post-cut-over
      disposalFy: '2027-28',
      config: TAX_YEAR_2025_26, // commencement NOT verified
    });
    expect(result.discountRate).toBe(0.5); // still pre-reform
  });

  it('with reform flag on + post-cut-over contract + post-FY-2027-28 disposal → 0% (POST_REFORM)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: new Date('2027-01-01T00:00:00Z'),
      disposalFy: '2027-28',
      config: configWithFlag('cgtIndexationCommencementVerified', true),
    });
    expect(result.discountRate).toBe(0);
    expect(result.reason).toMatch(/POST_REFORM/);
  });

  it('with reform flag on BUT grandfathered contract date → still 50% (grandfathered)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: new Date('2020-01-01T00:00:00Z'), // pre-cut-over
      disposalFy: '2027-28',
      config: configWithFlag('cgtIndexationCommencementVerified', true),
    });
    expect(result.discountRate).toBe(0.5); // grandfathering wins
  });

  it('with reform flag on + post-cut-over + pre-FY-2027-28 disposal → still 50% (before commencement FY)', () => {
    const result = calculateCgtDiscount({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: new Date('2027-01-01T00:00:00Z'),
      disposalFy: '2026-27', // pre-commencement
      config: configWithFlag('cgtIndexationCommencementVerified', true),
    });
    expect(result.discountRate).toBe(0.5);
  });
});
