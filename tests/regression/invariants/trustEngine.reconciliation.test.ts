/**
 * Trust Engine · Layer 3 — reconciliation tie-outs (the accounting discipline:
 * the numbers must TIE OUT). Reza directive 2026-06-25: a system to be "100%
 * sure the results are valid, correct and trustworthy."
 *
 * L3 proves that aggregates equal the sum of their parts and that flows
 * reconcile to their components — the class of bug where money is silently
 * created or lost in aggregation. Extends the Phase 4 invariant suite (which
 * already locks net-worth = assets − liabilities + per-entity additivity); this
 * adds the tie-outs that were NOT yet covered:
 *
 *   • Net-worth CLASS additivity — total === Σ of every asset/liability class
 *     subtotal (not just the assets−liabilities identity). A dropped class
 *     would understate wealth silently.
 *   • Cashflow PERIOD + NET tie-out — Σ current-month non-transfer OUT
 *     transactions === currentMonthOutflow, and net === inflow − outflow.
 *     The statement-sum + roll-forward seed (§19.1 actuals).
 *
 * Pure tie-outs over the six golden archetypes + a deterministic random sweep —
 * laws of the engines, not snapshots. No financial logic changed; this PROVES it.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  type PropertyInput,
  type AccountInput,
  type InvestmentInput,
  type SuperInput,
  type AssetInput,
  type LoanInput,
} from '@/lib/calculations/netWorthCalculator';
import {
  computeActualCashflow,
  type ActualCashflowTransaction,
} from '@/lib/calculations/actualCashflow';
import { ARCHETYPES } from '../golden-master/archetypes';

// deterministic PRNG (mulberry32) — reproducible inputs, no new dep.
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

interface Portfolio {
  entityIds: string[];
  properties: Array<PropertyInput & { currentValue: number }>;
  accounts: Array<AccountInput & { currentBalance: number; type: string }>;
  investments: InvestmentInput[];
  superannuation: SuperInput[];
  personalAssets: AssetInput[];
  loans: Array<LoanInput & { principal: number }>;
}

function randomPortfolio(seed: number): Portfolio {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const amt = (max: number) => Math.round(r() * max);
  const entityIds = ['you', 'spouse', 'trust', 'co', 'smsf'].slice(0, 1 + Math.floor(r() * 5));
  const owner = () => pick(entityIds);
  const loanTypes = ['HOME', 'INVESTMENT', 'PERSONAL', 'CREDIT_CARD'];
  const acctTypes = ['SAVINGS', 'OFFSET', 'TRANSACTION'];
  const superTypes = ['RETAIL', 'INDUSTRY'] as const;
  return {
    entityIds,
    properties: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentValue: amt(1_500_000), type: 'HOME', ownerEntityId: owner() })),
    accounts: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentBalance: amt(200_000), type: pick(acctTypes), ownerEntityId: owner() })),
    investments: Array.from({ length: Math.floor(r() * 4) }, () => ({ units: amt(5000), currentPrice: 1 + amt(80), averagePrice: 1 + amt(60), ownerEntityId: owner() })),
    superannuation: Array.from({ length: Math.floor(r() * 3) }, () => ({ balance: amt(600_000), fundType: pick(superTypes as unknown as string[]) as SuperInput['fundType'], ownerEntityId: owner() })),
    personalAssets: Array.from({ length: Math.floor(r() * 3) }, () => ({ currentValue: amt(100_000), ownerEntityId: owner() })),
    loans: Array.from({ length: Math.floor(r() * 4) }, () => ({ principal: amt(800_000), type: pick(loanTypes), propertyId: null, ownerEntityId: owner() })),
  };
}

const ARCHETYPE_PORTFOLIOS = ARCHETYPES.map((a) => ({
  name: a.key,
  p: {
    entityIds: a.entities.map((e) => e.id),
    properties: a.properties,
    accounts: a.accounts,
    investments: a.investments,
    superannuation: a.superannuation,
    personalAssets: a.personalAssets,
    loans: a.loans,
  } as Portfolio,
}));
const RANDOM_PORTFOLIOS = Array.from({ length: 40 }, (_, i) => ({ name: `seed-${i}`, p: randomPortfolio(i * 2654435761 + 1) }));
const ALL = [...ARCHETYPE_PORTFOLIOS, ...RANDOM_PORTFOLIOS];

// =============================================================================
// L3.1 — Net-worth class additivity: total === Σ class subtotals
//        (a silently dropped asset class would understate wealth).
// =============================================================================

describe('Trust Engine L3 · net worth — every class subtotal ties out to the total', () => {
  it.each(ALL)('$name — assets.total === Σ(property/account/investment/super/personalAsset) subtotals', ({ p }) => {
    const nw = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    const a = nw.assets;
    const sumOfClasses = a.properties + a.accounts + a.investments + a.superannuation + a.personalAssets;
    expect(a.total).toBeCloseTo(sumOfClasses, 6);
  });

  it.each(ALL)('$name — liabilities.total === Σ(mortgages/personalLoans/creditCards) subtotals', ({ p }) => {
    const nw = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    const l = nw.liabilities;
    expect(l.total).toBeCloseTo(l.mortgages + l.personalLoans + l.creditCards, 6);
  });

  it.each(ALL)('$name — net worth ties out: netWorth === assets.total − liabilities.total', ({ p }) => {
    const nw = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets);
    expect(nw.netWorth).toBeCloseTo(nw.assets.total - nw.liabilities.total, 6);
  });
});

// =============================================================================
// L3.2 — Cashflow statement + net tie-out (the roll-forward seed, §19.1).
//        Σ current-month non-transfer OUT === currentMonthOutflow;
//        net === inflow − outflow. Transfers never enter the totals.
// =============================================================================

describe('Trust Engine L3 · actual cashflow — statement sum + net tie out', () => {
  const NOW = new Date('2026-06-15T00:00:00Z');
  const thisMonth = (day: number) => new Date(Date.UTC(2026, 5, day));
  const lastMonth = (day: number) => new Date(Date.UTC(2026, 4, day));

  it('Σ current-month non-transfer OUT === currentMonthOutflow; net === inflow − outflow', () => {
    const txns: ActualCashflowTransaction[] = [
      { date: thisMonth(2), amount: -120.5, direction: 'OUT', categoryLevel1: 'Groceries' },
      { date: thisMonth(3), amount: -80, direction: 'OUT', categoryLevel1: null },
      { date: thisMonth(4), amount: 5000, direction: 'IN', categoryLevel1: 'Salary' },
      { date: thisMonth(5), amount: -999, direction: 'OUT', categoryLevel1: 'X', isTransfer: true }, // excluded
      { date: lastMonth(9), amount: -300, direction: 'OUT', categoryLevel1: 'Groceries' }, // prior month
    ];
    const r = computeActualCashflow(txns, { now: NOW });

    // statement tie-out: the period total equals the sum of its source rows
    const expectedOut = txns
      .filter((t) => t.isTransfer !== true && t.direction === 'OUT' && t.date >= thisMonth(1) && t.date < thisMonth(30))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    expect(r.currentMonthOutflow).toBeCloseTo(expectedOut, 6);
    // net tie-out
    expect(r.currentMonthNet).toBeCloseTo(r.currentMonthInflow - r.currentMonthOutflow, 6);
  });

  it('holds over a deterministic random sweep (net === inflow − outflow, statement reconciles)', () => {
    const rand = rng(0x5e3d);
    for (let trial = 0; trial < 40; trial++) {
      const n = 1 + Math.floor(rand() * 30);
      const txns: ActualCashflowTransaction[] = [];
      let expectIn = 0;
      let expectOut = 0;
      for (let i = 0; i < n; i++) {
        const day = 1 + Math.floor(rand() * 14);
        const isOut = rand() < 0.7;
        const isTransfer = rand() < 0.15;
        const amt = Math.round(rand() * 800_00) / 100;
        txns.push({
          date: thisMonth(day),
          amount: isOut ? -amt : amt,
          direction: isOut ? 'OUT' : 'IN',
          categoryLevel1: rand() < 0.3 ? null : 'Cat',
          isTransfer,
        });
        if (!isTransfer) {
          if (isOut) expectOut += amt;
          else expectIn += amt;
        }
      }
      const r = computeActualCashflow(txns, { now: NOW });
      expect(r.currentMonthOutflow).toBeCloseTo(expectOut, 6);
      expect(r.currentMonthInflow).toBeCloseTo(expectIn, 6);
      expect(r.currentMonthNet).toBeCloseTo(r.currentMonthInflow - r.currentMonthOutflow, 6);
    }
  });
});
