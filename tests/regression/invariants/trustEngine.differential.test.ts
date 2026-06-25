/**
 * Trust Engine · Layer 1 — independent-recomputation differentials. Reza
 * directive 2026-06-25: a system to be "100% sure the results are valid,
 * correct and trustworthy."
 *
 * L1 computes a high-stakes number TWO GENUINELY INDEPENDENT ways and asserts
 * they agree. The existing differential coverage is float-vs-decimal (the SAME
 * algorithm, different arithmetic) — strong, but a logic bug present in both
 * paths would survive it. These differentials use a STRUCTURALLY different
 * second algorithm, so a single-implementation bug shows up as a divergence:
 *
 *   • Net worth — the canonical engine (class-bucketed) vs an independent raw
 *     row-by-row sum. A bucketing/aggregation bug in one but not the other
 *     would diverge.
 *   • Income tax — the canonical engine (find-bracket + baseAmount) vs an
 *     independent marginal-slice summation (Σ over slices of
 *     (min(income,upper) − lower) × rate). A drifted baseAmount, threshold or
 *     rate would diverge.
 *
 * A `sensitivity` self-check proves each differential CAN fail (a deliberately
 * wrong reference must NOT match) — an always-equal differential is worthless.
 *
 * Pure, over the six golden archetypes + a deterministic random sweep. No
 * financial logic changed; this cross-validates it.
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
import { calculateIncomeTax } from '@/lib/tax-engine/core/incomeTaxCalculator';
import { TAX_YEAR_2024_25 } from '@/lib/tax-engine/config/taxYearConfig';
import { ARCHETYPES } from '../golden-master/archetypes';

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
  const superTypes = ['RETAIL', 'INDUSTRY', 'SMSF'] as const; // include SMSF to exercise the exclusion
  return {
    properties: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentValue: amt(1_500_000), type: 'HOME' })),
    accounts: Array.from({ length: Math.floor(r() * 4) }, () => ({ currentBalance: amt(200_000), type: 'SAVINGS' })),
    investments: Array.from({ length: Math.floor(r() * 4) }, () => ({ units: amt(5000), currentPrice: 1 + amt(80), averagePrice: 1 + amt(60) })),
    superannuation: Array.from({ length: Math.floor(r() * 3) }, () => ({ balance: amt(600_000), fundType: pick(superTypes as unknown as string[]) as SuperInput['fundType'] })),
    personalAssets: Array.from({ length: Math.floor(r() * 3) }, () => ({ currentValue: amt(100_000) })),
    loans: Array.from({ length: Math.floor(r() * 4) }, () => ({ principal: amt(800_000), type: 'HOME', propertyId: null })),
  };
}

const PORTFOLIOS: Array<{ name: string; p: Portfolio }> = [
  ...ARCHETYPES.map((a) => ({
    name: a.key,
    p: {
      properties: a.properties,
      accounts: a.accounts,
      investments: a.investments,
      superannuation: a.superannuation,
      personalAssets: a.personalAssets,
      loans: a.loans,
    } as Portfolio,
  })),
  ...Array.from({ length: 40 }, (_, i) => ({ name: `seed-${i}`, p: randomPortfolio(i * 2654435761 + 1) })),
];

// =============================================================================
// L1.1 — Net worth: canonical engine vs an INDEPENDENT raw row-by-row sum.
// =============================================================================

/** Independent net worth — sums raw rows directly, no engine, no class buckets.
 *  Replicates only the DEFINITIONAL rules (market value fallback, SMSF
 *  exclusion — §ph39.5), not the engine's aggregation structure. */
function independentNetWorth(p: Portfolio): number {
  const assets =
    p.properties.reduce((s, x) => s + (x.currentValue ?? 0), 0) +
    p.accounts.reduce((s, x) => s + (x.currentBalance ?? 0), 0) +
    p.investments.reduce((s, x) => s + (x.units ?? 0) * ((x.currentPrice ?? x.averagePrice) ?? 0), 0) +
    p.superannuation.reduce((s, x) => s + (x.fundType === 'SMSF' ? 0 : (x.balance ?? 0)), 0) +
    p.personalAssets.reduce((s, x) => s + (x.currentValue ?? 0), 0);
  const liabilities = p.loans.reduce((s, x) => s + (x.principal ?? 0), 0);
  return assets - liabilities;
}

describe('Trust Engine L1 · net worth — engine agrees with an independent raw sum', () => {
  it.each(PORTFOLIOS)('$name — canonical engine === independent row-by-row sum', ({ p }) => {
    const engine = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets).netWorth;
    expect(engine).toBeCloseTo(independentNetWorth(p), 4);
  });

  it('sensitivity — a reference that forgets to exclude SMSF does NOT match (the differential can fail)', () => {
    const p = randomPortfolio(999);
    // only meaningful when the portfolio actually has SMSF super
    const hasSmsf = p.superannuation.some((s) => s.fundType === 'SMSF');
    const wrong =
      independentNetWorth(p) + p.superannuation.reduce((s, x) => s + (x.fundType === 'SMSF' ? (x.balance ?? 0) : 0), 0);
    const engine = calculateNetWorth(p.properties, p.accounts, p.investments, p.loans, p.superannuation, p.personalAssets).netWorth;
    if (hasSmsf) expect(engine).not.toBeCloseTo(wrong, 0);
  });
});

// =============================================================================
// L1.2 — Income tax: canonical engine vs an INDEPENDENT marginal-slice sum.
// =============================================================================

/** Independent income tax — sums marginal slices across the ATO brackets,
 *  WITHOUT the engine's find-bracket + baseAmount lookup. The slice lower edge
 *  is `bracket.min − 1` (= the prior bracket's max / the threshold). */
function independentTax(income: number, brackets: typeof TAX_YEAR_2024_25.brackets): number {
  if (income <= 0) return 0;
  let tax = 0;
  for (const b of brackets) {
    const lower = b.min - 1; // the threshold (prior bracket's inclusive max)
    const upper = b.max ?? Infinity;
    if (income > lower) tax += (Math.min(income, upper) - lower) * b.rate;
  }
  return Math.max(0, Math.round(tax * 100) / 100);
}

describe('Trust Engine L1 · income tax — engine agrees with an independent marginal-slice sum', () => {
  const incomes: number[] = [];
  for (let x = 0; x <= 400_000; x += 211) incomes.push(x);
  for (const b of TAX_YEAR_2024_25.brackets) incomes.push(b.min - 1, b.min, b.min + 1);
  const sweep = [...new Set(incomes.filter((x) => x >= 0))].sort((a, b) => a - b);

  it('canonical engine === independent marginal-slice over the whole income sweep', () => {
    for (const income of sweep) {
      const engine = calculateIncomeTax(income, TAX_YEAR_2024_25).taxPayable;
      expect(engine).toBeCloseTo(independentTax(income, TAX_YEAR_2024_25.brackets), 2);
    }
  });

  it('sensitivity — a reference with a wrong top rate does NOT match the engine (the differential can fail)', () => {
    const brokenBrackets = TAX_YEAR_2024_25.brackets.map((b) =>
      b.max == null ? { ...b, rate: 0.40 } : b, // wrong top marginal rate
    );
    // at $300k the top slice differs ⇒ must diverge
    const engine = calculateIncomeTax(300_000, TAX_YEAR_2024_25).taxPayable;
    expect(engine).not.toBeCloseTo(independentTax(300_000, brokenBrackets as typeof TAX_YEAR_2024_25.brackets), 0);
  });
});
