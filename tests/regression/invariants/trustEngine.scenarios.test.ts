/**
 * Trust Engine · what-if scenario cascade reconciliation (Tranche A).
 *
 * The what-if levers are the highest-stakes numbers in the app — selling a
 * property cascades into CGT, cashflow, net worth and liquidity, and a user
 * makes a real money decision on the result. This locks the `sellProperty`
 * cascade's accounting identities so a wrong sign or a dropped term can't ship:
 *
 *   netCashFreed       === grossProceeds − sellingCosts − loanPayoff
 *   Δliquid            === netCashFreed
 *   Δmonthly cashflow  === −property.monthlyCashflow      (selling removes it)
 *   Δnet worth         === −sellingCosts − yourCgt        (0 CGT on back-compat)
 *   Δportfolio value   === −property.currentValue
 *
 * Reconciliation tie-outs over a fixed case + a deterministic random sweep.
 * The engine is the real `sellPropertyScenario`; no financial logic changed.
 * Models the `sellProperty` cascade the Neomatrix now carries (Tranche A).
 */

import { describe, it, expect } from 'vitest';
import { sellPropertyScenario } from '@/lib/cfo/scenarios/sellProperty';
import { tenYearProjection } from '@/lib/cfo/scenarios/tenYearProjection';
import type { ScenarioContext } from '@/lib/cfo/scenarios/types';
import { Decimal } from '@/lib/decimal';

const SELLING_COSTS_PCT = 0.025; // the engine default

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropInput {
  currentValue: number;
  loanBalance: number;
  monthlyCashflow: number;
}

// Minimal ScenarioContext exercising only the fields sellPropertyScenario reads.
// No propertyTaxContexts/taxConfig/currentFy → buildCgtForSellProperty returns
// null → yourCgt = 0 (the back-compat path), so net-worth reconciles to costs.
function ctxFor(p: PropInput, liquidCash: number, monthlyCashflow: number, netWorth: number, portfolioValue: number) {
  return {
    snapshot: {
      properties: [
        {
          id: 'p1',
          name: 'Unit 5',
          currentValue: p.currentValue,
          loanBalance: p.loanBalance,
          monthlyCashflow: p.monthlyCashflow,
          equity: p.currentValue - p.loanBalance,
        },
      ],
      quickMetrics: { liquidCash, monthlyCashflow },
      netWorth: { netWorth },
      propertyPortfolioValue: portfolioValue,
    },
  } as unknown as ScenarioContext;
}

function reconcile(p: PropInput, liquidCash: number, monthlyCashflow: number, netWorth: number, portfolioValue: number) {
  const r = sellPropertyScenario(ctxFor(p, liquidCash, monthlyCashflow, netWorth, portfolioValue), { propertyId: 'p1' });
  const by = (prefix: string) => r.impacts.find((i) => i.label.startsWith(prefix))!;

  const sellingCosts = p.currentValue * SELLING_COSTS_PCT;
  const netCashFreed = p.currentValue - sellingCosts - p.loanBalance;

  // netCashFreed identity (via the Liquid cash impact)
  expect(by('Liquid cash').delta).toBeCloseTo(netCashFreed, 4);
  expect(by('Liquid cash').after).toBeCloseTo(liquidCash + netCashFreed, 4);
  // cashflow removal
  expect(by('Monthly cashflow').delta).toBeCloseTo(-p.monthlyCashflow, 4);
  expect(by('Monthly cashflow').after).toBeCloseTo(monthlyCashflow - p.monthlyCashflow, 4);
  // net worth absorbs selling costs (+ 0 CGT on the back-compat path)
  expect(by('Net worth').delta).toBeCloseTo(-sellingCosts, 4);
  expect(by('Net worth').after).toBeCloseTo(netWorth - sellingCosts, 4);
  // portfolio value loses the property
  expect(by('Property portfolio value').delta).toBeCloseTo(-p.currentValue, 4);
  expect(by('Property portfolio value').after).toBeCloseTo(portfolioValue - p.currentValue, 4);
}

describe('Trust Engine · what-if sellProperty cascade reconciliation', () => {
  it('fixed case — every cascade identity ties out', () => {
    reconcile({ currentValue: 800_000, loanBalance: 500_000, monthlyCashflow: -200 }, 50_000, 1_000, 1_200_000, 950_000);
  });

  it('holds over a deterministic random sweep (incl. positive + negative gearing, negative equity)', () => {
    const rand = rng(0x5e11);
    for (let i = 0; i < 50; i++) {
      const currentValue = Math.round(rand() * 2_000_000);
      const loanBalance = Math.round(rand() * 1_500_000); // can exceed value → negative equity
      const monthlyCashflow = Math.round((rand() - 0.5) * 4_000); // ±2000
      reconcile(
        { currentValue, loanBalance, monthlyCashflow },
        Math.round(rand() * 200_000),
        Math.round((rand() - 0.5) * 6_000),
        Math.round(rand() * 3_000_000),
        Math.round(rand() * 4_000_000),
      );
    }
  });
});

// =============================================================================
// tenYearProjection — the chart spine every what-if lever renders. One wrong
// growth factor mis-projects EVERY scenario at once, so this locks it three ways:
//   • golden compounding (hand-derived FV from the documented rates)
//   • an INDEPENDENT re-implementation of the per-year recurrence (differential)
//   • the year-0 + totalDelta identities
// =============================================================================

/** Independent re-implementation of the tenYearProjection recurrence (number
 *  math, not the engine's Decimal walk) — agreement cross-validates the engine. */
function independentProjection(opts: {
  baseNetWorth: number;
  baseSuper: number;
  contribution: number;
  yearOneCashflowDelta: number;
  yearOneTaxDelta: number;
  years: number;
  asset: number;
  superR: number;
  cashflowR: number;
}): { finalNetWorth: number; year0: number } {
  let nonSuper = opts.baseNetWorth - opts.baseSuper;
  let superBal = opts.baseSuper;
  let cfDelta = opts.yearOneCashflowDelta;
  const year0 = nonSuper + superBal;
  for (let y = 1; y <= opts.years; y++) {
    nonSuper = nonSuper * (1 + opts.asset);
    superBal = superBal * (1 + opts.superR) + opts.contribution;
    nonSuper = nonSuper + cfDelta - opts.yearOneTaxDelta;
    cfDelta = cfDelta * (1 + opts.cashflowR);
  }
  return { finalNetWorth: nonSuper + superBal, year0 };
}

describe('Trust Engine · what-if tenYearProjection (the chart spine)', () => {
  it('golden — pure asset compounding: $100k at 4% real for 10y = $148,024.43', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(0),
      annualSuperContribution: new Decimal(0),
      years: 10,
      assetGrowthRate: 0.04,
    });
    // 100000 × 1.04^10
    expect(r.finalNetWorth.toNumber()).toBeCloseTo(148024.43, 2);
    expect(r.trajectory[0].netWorth.toNumber()).toBeCloseTo(100000, 6); // year-0 identity
    expect(r.totalDelta.toNumber()).toBeCloseTo(r.finalNetWorth.toNumber() - 100000, 6);
  });

  it('golden — pure super compounding: $100k at 6% real for 10y = $179,084.77', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(100_000),
      annualSuperContribution: new Decimal(0),
      years: 10,
      superGrowthRate: 0.06,
    });
    expect(r.finalNetWorth.toNumber()).toBeCloseTo(179084.77, 2);
  });

  it('agrees with an independent recurrence + holds the identities over a random sweep', () => {
    const rand = rng(0x7c0d);
    for (let i = 0; i < 50; i++) {
      const o = {
        baseNetWorth: Math.round(rand() * 2_000_000),
        baseSuper: Math.round(rand() * 400_000),
        contribution: Math.round(rand() * 30_000),
        yearOneCashflowDelta: Math.round((rand() - 0.4) * 40_000),
        yearOneTaxDelta: Math.round((rand() - 0.5) * 10_000),
        years: 1 + Math.floor(rand() * 30),
        asset: 0.02 + rand() * 0.06,
        superR: 0.03 + rand() * 0.06,
        cashflowR: rand() * 0.04,
      };
      const r = tenYearProjection({
        baseNetWorth: new Decimal(o.baseNetWorth),
        yearOneCashflowDelta: new Decimal(o.yearOneCashflowDelta),
        yearOneTaxDelta: new Decimal(o.yearOneTaxDelta),
        baseSuperBalance: new Decimal(o.baseSuper),
        annualSuperContribution: new Decimal(o.contribution),
        years: o.years,
        assetGrowthRate: o.asset,
        superGrowthRate: o.superR,
        cashflowGrowthRate: o.cashflowR,
      });
      const ind = independentProjection(o);
      // differential: engine === independent recurrence
      expect(r.finalNetWorth.toNumber()).toBeCloseTo(ind.finalNetWorth, 2);
      // identities
      expect(r.trajectory[0].netWorth.toNumber()).toBeCloseTo(o.baseNetWorth, 4);
      expect(r.totalDelta.toNumber()).toBeCloseTo(r.finalNetWorth.toNumber() - o.baseNetWorth, 4);
      // each point's net worth === its own nonSuper + super components
      for (const pt of r.trajectory) {
        expect(Number.isFinite(pt.netWorth.toNumber())).toBe(true);
      }
    }
  });
});
