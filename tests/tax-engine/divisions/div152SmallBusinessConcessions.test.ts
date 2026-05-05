/**
 * Phase 41e.7 — Div 152 small business CGT concessions tests.
 */

import { describe, it, expect } from 'vitest';
import {
  applyDiv152,
  type Div152Input,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';

const baseInput = (o: Partial<Div152Input> = {}): Div152Input => ({
  gainAfterDiv115: 200000,
  maxNetAssetValue: 3_000_000,
  aggregatedTurnover: 1_000_000,
  isActiveAsset: true,
  monthsHeld: 60,
  isRetirementOrIncapacity: false,
  ...o,
});

describe('applyDiv152 — basic conditions (s152-10)', () => {
  it('passes via MNAV ≤ $6M', () => {
    const r = applyDiv152(baseInput({ maxNetAssetValue: 5_000_000 }));
    expect(r.basicConditionsMet).toBe(true);
  });

  it('passes via turnover ≤ $2M (even with high MNAV)', () => {
    const r = applyDiv152(
      baseInput({ maxNetAssetValue: 10_000_000, aggregatedTurnover: 1_500_000 }),
    );
    expect(r.basicConditionsMet).toBe(true);
  });

  it('fails: MNAV > $6M AND turnover > $2M', () => {
    const r = applyDiv152(
      baseInput({ maxNetAssetValue: 10_000_000, aggregatedTurnover: 5_000_000 }),
    );
    expect(r.basicConditionsMet).toBe(false);
    expect(r.assessableGain).toBe(200000); // unchanged
  });

  it('fails: not an active asset', () => {
    const r = applyDiv152(baseInput({ isActiveAsset: false }));
    expect(r.basicConditionsMet).toBe(false);
  });

  it('flags UC-DIV152-AGGREGATION when MNAV near threshold', () => {
    const r = applyDiv152(baseInput({ maxNetAssetValue: 5_500_000 }));
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV152-AGGREGATION')).toBe(true);
  });

  it('does NOT flag aggregation when far from threshold', () => {
    const r = applyDiv152(baseInput({ maxNetAssetValue: 1_000_000, aggregatedTurnover: 500_000 }));
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV152-AGGREGATION')).toBeUndefined();
  });
});

describe('applyDiv152 — 15-year exemption (s152-105)', () => {
  it('asset 15+ years + retirement → entire gain disregarded', () => {
    const r = applyDiv152(
      baseInput({
        gainAfterDiv115: 500000,
        monthsHeld: 15 * 12,
        isRetirementOrIncapacity: true,
      }),
    );
    expect(r.fifteenYearExemptionApplied).toBe(true);
    expect(r.assessableGain).toBe(0);
    expect(r.activeAssetReductionApplied).toBe(false); // skipped
    expect(r.citations.some((c) => c.reference === 's152-105')).toBe(true);
  });

  it('asset < 15 years → exemption NOT applied; falls through to 50% reduction', () => {
    const r = applyDiv152(
      baseInput({
        monthsHeld: 14 * 12, // 14 years
        isRetirementOrIncapacity: true,
      }),
    );
    expect(r.fifteenYearExemptionApplied).toBe(false);
    expect(r.activeAssetReductionApplied).toBe(true); // default election
  });

  it('15+ years but NO retirement → exemption not applied', () => {
    const r = applyDiv152(
      baseInput({
        monthsHeld: 20 * 12,
        isRetirementOrIncapacity: false,
      }),
    );
    expect(r.fifteenYearExemptionApplied).toBe(false);
  });
});

describe('applyDiv152 — 50% active asset reduction (s152-205)', () => {
  it('default election → 50% reduction applied', () => {
    const r = applyDiv152(baseInput());
    expect(r.activeAssetReductionApplied).toBe(true);
    expect(r.assessableGain).toBe(100000); // 50% of $200k
  });

  it('opt-out → no reduction, full gain remains', () => {
    const r = applyDiv152(baseInput({ electActiveAssetReduction: false }));
    expect(r.activeAssetReductionApplied).toBe(false);
    expect(r.assessableGain).toBe(200000);
  });
});

describe('applyDiv152 — retirement exemption (s152-305)', () => {
  it('apply retirement exemption → reduces remaining gain up to $500k cap', () => {
    const r = applyDiv152(
      baseInput({
        electActiveAssetReduction: false, // disable to isolate retirement
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 0,
      }),
    );
    expect(r.retirementExemptionApplied).toBe(200000); // full gain ≤ $500k
    expect(r.assessableGain).toBe(0);
  });

  it('lifetime cap binding → only remaining cap applied', () => {
    const r = applyDiv152(
      baseInput({
        gainAfterDiv115: 400000,
        electActiveAssetReduction: false,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 350000, // only $150k cap remaining
      }),
    );
    expect(r.retirementExemptionApplied).toBe(150000);
    expect(r.assessableGain).toBe(250000); // $400k - $150k
  });

  it('cumulative cap exceeded → no exemption applied', () => {
    const r = applyDiv152(
      baseInput({
        electActiveAssetReduction: false,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 500000, // full cap used
      }),
    );
    expect(r.retirementExemptionApplied).toBe(0);
    expect(r.assessableGain).toBe(200000); // unchanged
  });

  it('stacks with 50% reduction', () => {
    const r = applyDiv152(
      baseInput({
        gainAfterDiv115: 200000,
        electActiveAssetReduction: true, // → $100k after
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 0,
      }),
    );
    expect(r.activeAssetReductionApplied).toBe(true);
    expect(r.retirementExemptionApplied).toBe(100000); // remaining $100k
    expect(r.assessableGain).toBe(0);
  });
});

describe('applyDiv152 — rollover (s152-410)', () => {
  it('rollover → defers remaining gain + flags UC-DIV152-ROLLOVER', () => {
    const r = applyDiv152(
      baseInput({
        electActiveAssetReduction: false,
        electRollover: true,
      }),
    );
    expect(r.rolloverApplied).toBe(200000);
    expect(r.assessableGain).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV152-ROLLOVER')).toBe(true);
  });

  it('full stack — 50% reduction + retirement + rollover', () => {
    const r = applyDiv152(
      baseInput({
        gainAfterDiv115: 800000,
        electActiveAssetReduction: true,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 0,
        electRollover: true,
      }),
    );
    // Step 1: 50% reduction → $400k
    // Step 2: retirement $400k (within $500k cap)
    // Step 3: rollover $0 (nothing left)
    expect(r.activeAssetReductionApplied).toBe(true);
    expect(r.retirementExemptionApplied).toBe(400000);
    expect(r.rolloverApplied).toBe(0);
    expect(r.assessableGain).toBe(0);
  });

  it('large gain hits all four — 50% + retirement-cap + rollover residual', () => {
    const r = applyDiv152(
      baseInput({
        gainAfterDiv115: 2_000_000,
        electActiveAssetReduction: true,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 0,
        electRollover: true,
      }),
    );
    // Step 1: 50% reduction → $1m
    // Step 2: retirement $500k (cap) → $500k
    // Step 3: rollover $500k → $0
    expect(r.retirementExemptionApplied).toBe(500000);
    expect(r.rolloverApplied).toBe(500000);
    expect(r.assessableGain).toBe(0);
  });
});

describe('applyDiv152 — citations + steps', () => {
  it('always cites Div 152 + s152-10', () => {
    const r = applyDiv152(baseInput());
    expect(r.citations.some((c) => c.reference === 'Div 152')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's152-10')).toBe(true);
  });

  it('cites s152-205 when active-asset reduction applies', () => {
    const r = applyDiv152(baseInput());
    expect(r.citations.some((c) => c.reference === 's152-205')).toBe(true);
  });

  it('cites s152-105 only when 15-year exemption applies', () => {
    const noExemption = applyDiv152(baseInput());
    expect(noExemption.citations.find((c) => c.reference === 's152-105')).toBeUndefined();

    const withExemption = applyDiv152(
      baseInput({ monthsHeld: 15 * 12, isRetirementOrIncapacity: true }),
    );
    expect(withExemption.citations.some((c) => c.reference === 's152-105')).toBe(true);
  });

  it('steps array reports each concession + running gain', () => {
    const r = applyDiv152(
      baseInput({
        electActiveAssetReduction: true,
        electRetirementExemption: true,
      }),
    );
    expect(r.steps.length).toBeGreaterThan(0);
    // After 50% reduction, runningGain should be $100k
    const reductionStep = r.steps.find((s) => s.citation === 's152-205');
    expect(reductionStep?.runningGain).toBe(100000);
  });
});

describe('applyDiv152 — edge cases', () => {
  it('zero gain → all zero', () => {
    const r = applyDiv152(baseInput({ gainAfterDiv115: 0 }));
    expect(r.assessableGain).toBe(0);
    expect(r.retirementExemptionApplied).toBe(0);
  });

  it('basic conditions fail → returns gain unchanged regardless of elections', () => {
    const r = applyDiv152(
      baseInput({
        isActiveAsset: false,
        electActiveAssetReduction: true,
        electRetirementExemption: true,
        electRollover: true,
      }),
    );
    expect(r.assessableGain).toBe(200000);
    expect(r.activeAssetReductionApplied).toBe(false);
    expect(r.retirementExemptionApplied).toBe(0);
    expect(r.rolloverApplied).toBe(0);
  });
});
