/**
 * Phase 45 PR 1 — 10-year projection composer determinism + math tests.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@/lib/decimal';
import {
  tenYearProjection,
  projectScenarioForward,
} from '@/lib/cfo/scenarios/tenYearProjection';

describe('tenYearProjection', () => {
  it('returns trajectory of length years + 1 (year 0 + years 1..N)', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(500_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      years: 10,
    });
    expect(r.trajectory).toHaveLength(11);
    expect(r.trajectory[0].year).toBe(0);
    expect(r.trajectory[10].year).toBe(10);
  });

  it('zero deltas: trajectory just compounds at default 4% asset growth', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      years: 10,
    });
    // 100_000 × 1.04^10 ≈ 148_024
    const expected = 100_000 * Math.pow(1.04, 10);
    expect(r.finalNetWorth.toNumber()).toBeCloseTo(expected, -1);
    expect(r.totalDelta.toNumber()).toBeCloseTo(expected - 100_000, -1);
  });

  it('positive cashflow delta increases net worth over baseline', () => {
    const base = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
    });
    const withDelta = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(12_000), // $1k/mo extra savings
      yearOneTaxDelta: new Decimal(0),
    });
    expect(withDelta.finalNetWorth.toNumber()).toBeGreaterThan(base.finalNetWorth.toNumber());
  });

  it('super contribution: super balance grows beyond growth-rate-alone path', () => {
    // baseSuperBalance grows at superGrowthRate AND receives annualSuperContribution.
    const r = tenYearProjection({
      baseNetWorth: new Decimal(500_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(100_000),
      annualSuperContribution: new Decimal(15_000),
      superGrowthRate: 0.06,
      years: 10,
    });
    // Super balance year 10: should be ~318k+ (compound + annuity)
    // 100k × 1.06^10 = 179_085; + 15k × ((1.06^10 - 1) / 0.06) = 15k × 13.18 = 197_710
    // Total ≈ 376_795. Allow generous tolerance.
    const year10 = r.trajectory[10];
    expect(year10.superBalance!.toNumber()).toBeGreaterThan(300_000);
    expect(year10.superBalance!.toNumber()).toBeLessThan(400_000);
  });

  it('deterministic: same inputs → same outputs', () => {
    const params = {
      baseNetWorth: new Decimal(250_000),
      yearOneCashflowDelta: new Decimal(6_000),
      yearOneTaxDelta: new Decimal(-2_000),
      baseSuperBalance: new Decimal(80_000),
      annualSuperContribution: new Decimal(12_000),
      years: 10,
    };
    const a = tenYearProjection(params);
    const b = tenYearProjection(params);
    expect(a.finalNetWorth.toString()).toBe(b.finalNetWorth.toString());
    expect(a.totalDelta.toString()).toBe(b.totalDelta.toString());
    for (let y = 0; y <= 10; y++) {
      expect(a.trajectory[y].netWorth.toString()).toBe(
        b.trajectory[y].netWorth.toString(),
      );
    }
  });

  it('cumulativeCashflowDelta accumulates wage-indexed deltas', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(10_000),
      yearOneTaxDelta: new Decimal(0),
      cashflowGrowthRate: 0.025,
      years: 10,
    });
    // Year 1 = 10_000. Year 2 cumulative = 10_000 + 10_000 × 1.025 = 20_250.
    expect(r.trajectory[1].cumulativeCashflowDelta.toNumber()).toBeCloseTo(10_000, 0);
    expect(r.trajectory[2].cumulativeCashflowDelta.toNumber()).toBeCloseTo(20_250, 0);
  });

  it('respects custom years parameter (5-year horizon)', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      years: 5,
    });
    expect(r.trajectory).toHaveLength(6);
  });

  it('floors years at 1 (defensive)', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      years: 0,
    });
    expect(r.trajectory).toHaveLength(2); // year 0 + year 1
  });

  it('positive tax delta (tax paid) reduces final net worth', () => {
    const baseR = tenYearProjection({
      baseNetWorth: new Decimal(500_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
    });
    const taxedR = tenYearProjection({
      baseNetWorth: new Decimal(500_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(5_000), // $5k extra tax/yr (e.g. CGT event)
    });
    expect(taxedR.finalNetWorth.toNumber()).toBeLessThan(baseR.finalNetWorth.toNumber());
  });

  it('assumptions array surfaces all default rates', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
    });
    const joined = r.assumptions.join('\n');
    expect(joined).toContain('4.0%'); // asset growth
    expect(joined).toContain('6.0%'); // super growth
    expect(joined).toContain('2.5%'); // wage indexation
    expect(joined).toContain('projection, not a forecast');
  });
});

describe('projectScenarioForward', () => {
  it('accepts numbers + Decimals interchangeably', () => {
    const a = projectScenarioForward(500_000, 6_000, 0);
    const b = projectScenarioForward(
      new Decimal(500_000),
      new Decimal(6_000),
      new Decimal(0),
    );
    expect(a.finalNetWorth.toString()).toBe(b.finalNetWorth.toString());
  });

  it('passes through super options', () => {
    const r = projectScenarioForward(500_000, 0, 0, {
      baseSuperBalance: 100_000,
      annualSuperContribution: 15_000,
    });
    expect(r.trajectory[10].superBalance!.toNumber()).toBeGreaterThan(100_000);
  });

  it('passes through years', () => {
    const r = projectScenarioForward(100_000, 0, 0, { years: 5 });
    expect(r.trajectory).toHaveLength(6);
  });
});
