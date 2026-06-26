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
import type { ScenarioContext } from '@/lib/cfo/scenarios/types';

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
