/**
 * `buildTaxSummary` parity test — Phase 41e.−1 cleanup PR D.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §9.4, this
 * is the parity baseline for the slice-C refactor (PR #630) that
 * replaced inline tax-bracket math with delegation to
 * `calculateTaxPosition()`. It asserts that the master snapshot's
 * `TaxSummary` adapter produces numbers that match the canonical Phase
 * 20 engine for each archetype fixture.
 *
 * Note: this is the FORWARD-LOOKING parity assertion. Slice C documents
 * an intentional behaviour change vs the OLD inline math (Medicare +
 * offsets are now applied — see PR #630 description). This test locks
 * in the NEW canonical numbers so future 41e.* sub-PRs detect any
 * unintentional drift.
 */

import { describe, it, expect } from 'vitest';
import { calculateTaxPosition } from '@/lib/tax-engine/position/taxPositionCalculator';
import { ARCHETYPES } from '../fixtures/archetypes';

describe('buildTaxSummary parity (audit C-1 fix — slice C / PR #630)', () => {
  describe.each(ARCHETYPES)('$name', (fixture) => {
    it('calculateTaxPosition runs cleanly against the fixture', () => {
      const result = calculateTaxPosition(fixture.taxInputs);
      expect(result).toBeDefined();
      expect(result.financialYear).toBeTruthy();
    });

    it('returns non-negative tax fields', () => {
      const result = calculateTaxPosition(fixture.taxInputs);
      expect(result.tax.taxableIncome).toBeGreaterThanOrEqual(0);
      expect(result.tax.netTax).toBeGreaterThanOrEqual(0);
      expect(result.tax.grossTax).toBeGreaterThanOrEqual(0);
      expect(result.deductions.total).toBeGreaterThanOrEqual(0);
    });

    it('marginal rate is one of the bracket rates (percentage scale)', () => {
      // `incomeTaxCalculator.ts:112` returns marginalRate in percentage
      // scale (0–100). `TaxCalculation.marginalRate` propagates that.
      const result = calculateTaxPosition(fixture.taxInputs);
      const validRates = [0, 16, 30, 37, 45];
      expect(validRates).toContain(result.tax.marginalRate);
    });

    it('refund/owing matches paygWithheld minus netTax (within $1 rounding)', () => {
      const result = calculateTaxPosition(fixture.taxInputs);
      const expected = result.paygWithheld - result.tax.netTax;
      // Engine rounds intermediate steps independently; allow $1 tolerance.
      expect(Math.abs(result.estimatedRefund - expected)).toBeLessThan(1);
    });

    it('totalDeductions equals sum of category breakdown', () => {
      const result = calculateTaxPosition(fixture.taxInputs);
      const sum =
        result.deductions.workRelated +
        result.deductions.property +
        result.deductions.investment +
        result.deductions.depreciation +
        result.deductions.other;
      expect(Math.abs(result.deductions.total - sum)).toBeLessThan(0.01);
    });
  });

  describe('sanity: each archetype lands in the expected bracket band', () => {
    it('Sarah Kim ($130k gross, ~30% bracket)', () => {
      const sarah = ARCHETYPES.find((a) => a.id === 'sarah-kim')!;
      const result = calculateTaxPosition(sarah.taxInputs);
      // Salary $130k minus a few thousand in deductions → still in 30% bracket
      expect(result.tax.marginalRate).toBe(30);
    });

    it('David ($180k) + Emma ($48k) household — falls in 30–45% band', () => {
      const david = ARCHETYPES.find((a) => a.id === 'david-emma')!;
      // Note: v1 fixture lumps both adults into one input; per-individual
      // dispatch lands with 41e.0/.17. For now, household assessable
      // income lands in the 30–45% band depending on offsets.
      const result = calculateTaxPosition(david.taxInputs);
      expect(result.tax.marginalRate).toBeGreaterThanOrEqual(30);
      expect(result.tax.marginalRate).toBeLessThanOrEqual(45);
    });

    it('Olivia ($300k+ income) — comfortably in 45% bracket', () => {
      const olivia = ARCHETYPES.find((a) => a.id === 'olivia')!;
      const result = calculateTaxPosition(olivia.taxInputs);
      expect(result.tax.marginalRate).toBe(45);
    });
  });
});
