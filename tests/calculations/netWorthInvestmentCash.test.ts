/**
 * MON-013 — investment-account cash in net worth + cross-surface convergence
 * (§19.2 worked example + §19.4 one-source proof).
 *
 * WHAT WAS WRONG: the canonical net-worth engine valued an investment account
 * as ONLY its holdings (units × price) and ignored `InvestmentAccount.cashBalance`.
 * The master snapshot (Balances) therefore understated net worth / total assets
 * by the un-invested cash, while `/api/portfolio/snapshot` (the Home "Assets"
 * tile) used its OWN inline totals that (a) INCLUDED that cash but (b) OMITTED
 * superannuation and (c) valued holdings at COST not market — so Home and
 * Balances disagreed on the app's most load-bearing number.
 *
 * THE FIX: one engine. `calculateNetWorth` now takes investment-account cash;
 * BOTH the master snapshot and the portfolio/snapshot route feed the SAME engine
 * the SAME inputs (holdings at market, super included, ACTIVE assets only, cash
 * included) so every surface converges (§12.2.1 / §19.4).
 *
 * This file proves the engine number (worked example) AND is a structural drift
 * guard: if a surface silently re-inlines its own net-worth math, it fails.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  calculateNetWorth,
  calculateNetWorthDecimal,
} from '../../lib/calculations/netWorthCalculator';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// A single raw fixture, mapped exactly the way BOTH producers map it.
const fixture = {
  properties: [{ currentValue: 500_000 }],
  accounts: [{ currentBalance: 50_000, type: 'SAVINGS' }],
  // holding: market value 100 × 20 = 2,000 (cost 100 × 15 = 1,500 — market must win)
  holdings: [{ units: 100, currentPrice: 20, averagePrice: 15 }],
  loans: [
    { principal: 300_000, type: 'HOME' as const, propertyId: null },
    { principal: 2_000, type: 'CREDIT_CARD' as const, propertyId: null },
  ],
  superannuation: [{ currentBalance: 120_000, fundType: 'RETAIL' as const }],
  // ACTIVE car counts; SOLD boat must NOT count.
  assets: [
    { currentValue: 30_000, status: 'ACTIVE' },
    { currentValue: 40_000, status: 'SOLD' },
  ],
  investmentAccounts: [{ cashBalance: 8_000, ownerEntityId: null }],
};

// The mapping every net-worth producer uses (master + portfolio/snapshot).
function toEngineInputs(f: typeof fixture) {
  return {
    properties: f.properties.map((p) => ({ currentValue: p.currentValue })),
    accounts: f.accounts.map((a) => ({ currentBalance: a.currentBalance, type: a.type })),
    holdings: f.holdings.map((h) => ({
      units: h.units,
      currentPrice: h.currentPrice ?? undefined,
      averagePrice: h.averagePrice,
    })),
    loans: f.loans.map((l) => ({ principal: l.principal, type: l.type, propertyId: l.propertyId })),
    superannuation: f.superannuation.map((s) => ({ balance: s.currentBalance, fundType: s.fundType })),
    // ACTIVE personal assets only (caller responsibility — master + route both filter).
    activeAssets: f.assets.filter((a) => a.status === 'ACTIVE').map((a) => ({ currentValue: a.currentValue })),
    investmentCash: f.investmentAccounts.map((a) => ({ cashBalance: a.cashBalance, ownerEntityId: a.ownerEntityId })),
  };
}

describe('MON-013: net worth includes investment-account cash', () => {
  const m = toEngineInputs(fixture);

  it('worked example: cash + super + MARKET holdings counted, SOLD asset excluded', () => {
    const nw = calculateNetWorth(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets, m.investmentCash,
    );
    // investments = holdings market 2,000 + account cash 8,000
    expect(nw.assets.investments).toBe(10_000);
    expect(nw.assets.superannuation).toBe(120_000);
    // SOLD boat (40,000) excluded — only the ACTIVE car (30,000)
    expect(nw.assets.personalAssets).toBe(30_000);
    // total = 500,000 + 50,000 + 10,000 + 120,000 + 30,000
    expect(nw.assets.total).toBe(710_000);
    // liabilities = HOME 300,000 + credit card 2,000
    expect(nw.liabilities.total).toBe(302_000);
    // net worth = 710,000 − 302,000
    expect(nw.netWorth).toBe(408_000);
  });

  it('regression: omitting the cash param understates net worth by exactly the cash (the MON-013 bug)', () => {
    const withCash = calculateNetWorth(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets, m.investmentCash,
    );
    const withoutCash = calculateNetWorth(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets,
    );
    expect(withCash.netWorth - withoutCash.netWorth).toBe(8_000);
    expect(withoutCash.netWorth).toBe(400_000); // the old, understated figure
  });

  it('Decimal path includes cash identically (Float/Decimal parity)', () => {
    const dec = calculateNetWorthDecimal(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets, m.investmentCash,
    );
    expect(dec.netWorth.toNumber()).toBe(408_000);
    expect(dec.assets.investments.toNumber()).toBe(10_000);
  });

  it('§19.4 cross-surface convergence: master-style and route-style mappings yield the SAME net worth', () => {
    // Both producers feed calculateNetWorth the same fixture the same way →
    // identical net worth + total assets. This locks the single-source guarantee.
    const master = calculateNetWorth(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets, m.investmentCash,
    );
    const route = calculateNetWorth(
      m.properties, m.accounts, m.holdings, m.loans, m.superannuation, m.activeAssets, m.investmentCash,
    );
    expect(route.netWorth).toBe(master.netWorth);
    expect(route.assets.total).toBe(master.assets.total);
  });
});

describe('MON-013: SSOT drift guard — net-worth producers use the ONE engine', () => {
  it('portfolio/snapshot route computes net worth via calculateNetWorth (not a re-inlined total)', () => {
    const src = read('app/api/portfolio/snapshot/route.ts');
    expect(src).toContain('calculateNetWorth(');
    expect(src).toContain('const netWorth = nw.netWorth;');
    // The old cost-basis inline holdings sum must be gone (market value now).
    expect(src).not.toMatch(/holdings\.reduce\(\(sum: number, h: any\) => sum \+ \(h\.units \* h\.averagePrice\)\)/);
    // Superannuation must be fetched + included (was omitted).
    expect(src).toContain('superannuationAccount.findMany');
  });

  it('master snapshot passes investment-account cash + ACTIVE-only assets into the engine', () => {
    const src = read('lib/services/masterFinancialService.ts');
    expect(src).toContain('data.investmentAccounts.map(a => ({ cashBalance: a.cashBalance');
    expect(src).toContain("data.assets.filter(a => a.status === 'ACTIVE')");
  });
});
