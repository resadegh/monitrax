/**
 * Neomatrix A1 — financialIndependence (pure engine; worked-example audit).
 *
 * `computeFinancialIndependence` is the SSOT for the "Freedom" hero coverage
 * numbers: what fraction of real lifestyle spend is funded by NET, ACCESSIBLE
 * passive income (§0 financial-adviser honesty + §19.1/§19.2).
 *
 * Law (external authority):
 *   - FI ratio = passive income ÷ living expenses (financial-independence definition).
 *   - coverageNow = netAccessiblePassiveAnnual / lifestyleAnnual × 100.
 *   - at-60 layer = (netAccessiblePassive + preservedSuper × drawdown) / lifestyle × 100,
 *     drawdown default 0.04 (the "4% rule", Bengen/Trinity) — a labelled assumption.
 *   - growth/income split: property net cashflow > 0 → income-producing, ≤ 0 → growth-building.
 *
 * A mismatch is a `suspected-issue` raised with Reza, never a licence to change
 * the engine to match (CLAUDE.md §10 / §19).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeFinancialIndependence,
  DEFAULT_SUPER_DRAWDOWN_RATE,
} from '@/lib/calculations/financialIndependence';

const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);
const nodeIds = new Set(graph.nodes.map((n: { id: string }) => n.id));

// Canonical §19.2 worked example — net passive $24k/yr, lifestyle $120k/yr,
// preserved super $300k, three properties (two growth-building, one income).
const base = () => ({
  netAccessiblePassiveAnnual: 24000,
  preservedSuperBalance: 300000,
  lifestyleAnnual: 120000,
  propertyNetMonthly: [-500, 200, -300],
});

describe('Neomatrix A1 — financialIndependence (model refs the code)', () => {
  it('the engine node exists in financial-graph.json (audit tied to the model)', () => {
    expect(nodeIds.has('engine.financialIndependence.computeFinancialIndependence')).toBe(true);
  });

  it('default drawdown rate is the 4% rule', () => {
    expect(DEFAULT_SUPER_DRAWDOWN_RATE).toBe(0.04);
  });

  it('coverageNow = net accessible passive ÷ lifestyle × 100', () => {
    const r = computeFinancialIndependence(base());
    // 24,000 / 120,000 × 100 = 20.0
    expect(r.coverageNowPct).toBe(20);
    expect(r.netAccessiblePassiveMonthly).toBe(2000);
    expect(r.lifestyleMonthly).toBe(10000);
  });

  it('coverageAt60 adds preserved super × 4% drawdown', () => {
    const r = computeFinancialIndependence(base());
    // super income = 300,000 × 0.04 = 12,000/yr → (24,000 + 12,000)/120,000 = 30.0
    expect(r.coverageAt60Pct).toBe(30);
    expect(r.superIncomeAt60Monthly).toBe(1000);
    expect(r.superDrawdownRate).toBe(0.04);
  });

  it('growth vs income split: net cashflow > 0 = income-producing, ≤ 0 = growth-building', () => {
    const r = computeFinancialIndependence(base());
    // [-500, 200, -300] → 1 income-producing, 2 growth-building
    expect(r.incomeProducingCount).toBe(1);
    expect(r.growthBuildingCount).toBe(2);
  });

  it('momentum splits net-worth Δ into savings vs "money working" when history is present', () => {
    const r = computeFinancialIndependence({
      ...base(),
      netWorthDeltaLastPeriod: 18400,
      savingsLastPeriod: 5000,
    });
    expect(r.momentum).toEqual({ total: 18400, fromSavings: 5000, fromPortfolio: 13400 });
  });

  it('momentum is null when net-worth history is insufficient (never fabricate)', () => {
    const r = computeFinancialIndependence(base());
    expect(r.momentum).toBeNull();
  });

  it('honest empty state: no lifestyle spend → coverage 0 + hasData false (no divide-by-zero)', () => {
    const r = computeFinancialIndependence({ ...base(), lifestyleAnnual: 0 });
    expect(r.coverageNowPct).toBe(0);
    expect(r.coverageAt60Pct).toBe(0);
    expect(r.hasData).toBe(false);
  });

  it('a fully work-optional portfolio reads ≥ 100%', () => {
    const r = computeFinancialIndependence({
      ...base(),
      netAccessiblePassiveAnnual: 130000,
    });
    // 130,000 / 120,000 × 100 = 108.3
    expect(r.coverageNowPct).toBeGreaterThanOrEqual(100);
  });
});
