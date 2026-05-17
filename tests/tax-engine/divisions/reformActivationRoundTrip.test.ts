/**
 * Phase 41E.5 — Round-trip activation tests.
 *
 * The FW-2 wall (CLAUDE.md §12.14) is the most load-bearing
 * invariant of the Phase 41E build. These tests verify that:
 *
 *   1. With every `commencementVerified` flag `false` (Stage 1 default),
 *      every reform-aware engine module returns UNCOMPUTED + does NOT
 *      compute post-reform numbers.
 *   2. Flipping a single flag to `true` ACTIVATES that measure's
 *      module — at Stage 1 this throws (defensive: the Stage 2 mechanic
 *      isn't implemented yet, so flipping the flag without the mechanic
 *      is a programming error that should crash loudly, not silently
 *      compute wrong numbers).
 *   3. Flipping the flag back to `false` DEACTIVATES the module
 *      (returns UNCOMPUTED again — reversible). The activation
 *      pathway is symmetric.
 *
 * The defensive `throw` on premature flag flip is the critical
 * guarantee. A future PR (Stage 2 per-measure mechanic) will replace
 * the `throw` with the actual rule mechanic AT THE SAME TIME as
 * the flag is allowed to flip. Until then: throw.
 */

import { describe, it, expect } from 'vitest';
import { applyCgtIndexation } from '@/lib/tax-engine/divisions/cgtIndexation';
import { applyCgtMinimumRate } from '@/lib/tax-engine/divisions/cgtMinimumRate';
import { applyTrustMinimumTax } from '@/lib/tax-engine/divisions/trustMinimumTax';
import { applyForeignResidentCgt } from '@/lib/tax-engine/divisions/foreignResidentCgt';
import { applyLossRefundability } from '@/lib/tax-engine/divisions/lossRefundability';
import { TAX_YEAR_2025_26 } from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

const configWithFlag = (flag: keyof TaxYearConfig, value: boolean): TaxYearConfig => ({
  ...TAX_YEAR_2025_26,
  [flag]: value,
});

describe('Phase 41E.5 — round-trip activation: CGT indexation (M2)', () => {
  it('flag false → UNCOMPUTED', () => {
    const result = applyCgtIndexation({
      costBase: 500_000,
      acquisitionQuarter: '2027-Q3',
      disposalQuarter: '2030-Q1',
      saleProceeds: 700_000,
      config: configWithFlag('cgtIndexationCommencementVerified', false),
    });
    expect(result.computed).toBe(false);
    expect(result.uncomputed[0].id).toBe('UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT');
  });

  it('flag true → throws (Stage 2 mechanic not yet implemented)', () => {
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

  it('flag false → true → false → UNCOMPUTED again (reversibility)', () => {
    const off = applyCgtIndexation({
      costBase: 500_000,
      acquisitionQuarter: '2027-Q3',
      disposalQuarter: '2030-Q1',
      saleProceeds: 700_000,
      config: configWithFlag('cgtIndexationCommencementVerified', false),
    });
    expect(off.computed).toBe(false);

    // Mid-cycle: flag on → throw (defensive — no silent post-reform numbers).
    expect(() =>
      applyCgtIndexation({
        costBase: 500_000,
        acquisitionQuarter: '2027-Q3',
        disposalQuarter: '2030-Q1',
        saleProceeds: 700_000,
        config: configWithFlag('cgtIndexationCommencementVerified', true),
      }),
    ).toThrow();

    // Flag back off → UNCOMPUTED, same as before. Reversible.
    const offAgain = applyCgtIndexation({
      costBase: 500_000,
      acquisitionQuarter: '2027-Q3',
      disposalQuarter: '2030-Q1',
      saleProceeds: 700_000,
      config: configWithFlag('cgtIndexationCommencementVerified', false),
    });
    expect(offAgain.computed).toBe(false);
    expect(offAgain.uncomputed[0].id).toBe('UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT');
  });
});

describe('Phase 41E.5 — round-trip activation: CGT minimum rate (M2)', () => {
  it('flag false → UNCOMPUTED', () => {
    const r = applyCgtMinimumRate({
      indexedGain: 100_000,
      marginalRate: 0.45,
      config: configWithFlag('cgtMinRateCommencementVerified', false),
    });
    expect(r.computed).toBe(false);
  });

  it('flag true → throws', () => {
    expect(() =>
      applyCgtMinimumRate({
        indexedGain: 100_000,
        marginalRate: 0.45,
        config: configWithFlag('cgtMinRateCommencementVerified', true),
      }),
    ).toThrow();
  });
});

describe('Phase 41E.5 — round-trip activation: Trust minimum tax (M3)', () => {
  it('flag false + DISCRETIONARY trust → UNCOMPUTED', () => {
    const r = applyTrustMinimumTax({
      trustEntityId: 'e1',
      trustType: 'DISCRETIONARY',
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config: configWithFlag('trustMinTaxCommencementVerified', false),
      fy: '2028-29',
    });
    expect(r.computed).toBe(false);
    expect(r.inScope).toBe(true);
  });

  it('flag true + DISCRETIONARY trust → throws', () => {
    expect(() =>
      applyTrustMinimumTax({
        trustEntityId: 'e1',
        trustType: 'DISCRETIONARY',
        taxableIncome: 200_000,
        actualBeneficiaryTax: 80_000,
        config: configWithFlag('trustMinTaxCommencementVerified', true),
        fy: '2028-29',
      }),
    ).toThrow();
  });

  it('flag true + UNIT trust → out-of-scope (no throw, scope gate excludes)', () => {
    // Scope gate fires BEFORE the commencement gate — UNIT trusts are
    // excluded from Measure 3 regardless of flag state.
    const r = applyTrustMinimumTax({
      trustEntityId: 'e2',
      trustType: 'UNIT',
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config: configWithFlag('trustMinTaxCommencementVerified', true),
      fy: '2028-29',
    });
    expect(r.inScope).toBe(false);
    expect(r.topUpTax).toBe(0);
  });
});

describe('Phase 41E.5 — round-trip activation: Foreign-resident CGT (M4)', () => {
  it('flag false + foreign resident → UNCOMPUTED', () => {
    const r = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: true,
      nominalGain: 100_000,
      disposalValue: 1_000_000,
      config: configWithFlag('foreignResidentCgtCommencementVerified', false),
      fy: '2026-27',
    });
    expect(r.computed).toBe(false);
    expect(r.inScope).toBe(true);
  });

  it('flag true + foreign resident → throws', () => {
    expect(() =>
      applyForeignResidentCgt({
        entityId: 'e1',
        isForeignResident: true,
        nominalGain: 100_000,
        disposalValue: 1_000_000,
        config: configWithFlag('foreignResidentCgtCommencementVerified', true),
        fy: '2026-27',
      }),
    ).toThrow();
  });

  it('flag true + domestic entity → out-of-scope (no throw, scope gate excludes)', () => {
    const r = applyForeignResidentCgt({
      entityId: 'e1',
      isForeignResident: false,
      nominalGain: 100_000,
      disposalValue: 1_000_000,
      config: configWithFlag('foreignResidentCgtCommencementVerified', true),
      fy: '2026-27',
    });
    expect(r.inScope).toBe(false);
  });
});

describe('Phase 41E.5 — round-trip activation: Loss carry-back (M5)', () => {
  it('flag false + eligible company → UNCOMPUTED', () => {
    const r = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000,
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 0 },
      priorFy1: { fy: '2025-26', taxablePosition: 200_000, taxPaid: 50_000, frankingAccountBalance: 50_000 },
      config: configWithFlag('lossCarryBackCommencementVerified', false),
    });
    expect(r.computed).toBe(false);
    expect(r.inScope).toBe(true);
  });

  it('flag true + eligible company → throws', () => {
    expect(() =>
      applyLossRefundability({
        entityId: 'e1',
        entityType: 'COMPANY',
        annualTurnoverCurrentFy: 500_000,
        currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 0 },
        priorFy1: { fy: '2025-26', taxablePosition: 200_000, taxPaid: 50_000, frankingAccountBalance: 50_000 },
        config: configWithFlag('lossCarryBackCommencementVerified', true),
      }),
    ).toThrow();
  });

  it('flag true + over-turnover company → out-of-scope (no throw)', () => {
    const r = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 2_000_000_000, // $2B — over the $1B ceiling
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 0 },
      config: configWithFlag('lossCarryBackCommencementVerified', true),
    });
    expect(r.inScope).toBe(false);
  });
});

describe('Phase 41E.5 — every flag is independent', () => {
  it('flipping M2 indexation flag does NOT activate M3 or M5', () => {
    // Defensive — the per-measure flags must NOT be conflated. A
    // future engineer copy-pasting code shouldn't accidentally tie
    // two flags together.
    const config = configWithFlag('cgtIndexationCommencementVerified', true);

    // M3 should still UNCOMPUTED.
    const trustResult = applyTrustMinimumTax({
      trustEntityId: 'e1',
      trustType: 'DISCRETIONARY',
      taxableIncome: 200_000,
      actualBeneficiaryTax: 80_000,
      config,
      fy: '2028-29',
    });
    expect(trustResult.computed).toBe(false);
    expect(trustResult.uncomputed[0].id).toBe('UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT');

    // M5 should still UNCOMPUTED.
    const m5 = applyLossRefundability({
      entityId: 'e1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000,
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 0 },
      config,
    });
    expect(m5.computed).toBe(false);
  });
});
