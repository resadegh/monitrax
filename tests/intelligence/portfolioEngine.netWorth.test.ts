/**
 * MA.4-002 regression test (2026-06-07).
 *
 * Pins the contract that `lib/intelligence/portfolioEngine.calculateNetWorth`
 * delegates to the canonical `lib/calculations/netWorthCalculator.ts`
 * SSOT — specifically that:
 *   1. Superannuation is included in net worth (was excluded pre-fix).
 *   2. Personal assets are included in net worth (was excluded pre-fix).
 *   3. SMSF member super accounts are excluded per Phase 39.5
 *      double-count guard.
 *   4. Result shape maps canonical → intel `NetWorthAnalysis` cleanly.
 *
 * Without this test, a future refactor could silently reintroduce the
 * divergence — the AI advisor would once again return a net-worth
 * number that differs from the user's dashboard.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNetWorth,
  type PortfolioInput,
} from '@/lib/intelligence/portfolioEngine';

const baseInput: PortfolioInput = {
  properties: [
    { id: 'p1', name: 'Home', type: 'HOME', currentValue: 800_000, purchasePrice: 600_000, purchaseDate: new Date('2020-01-01') },
  ],
  loans: [
    { id: 'l1', name: 'Home loan', type: 'HOME', principal: 400_000, interestRate: 0.065, isInterestOnly: false, propertyId: 'p1' },
  ],
  accounts: [
    { id: 'a1', name: 'Everyday', type: 'TRANSACTIONAL', currentBalance: 25_000 },
  ],
  income: [],
  expenses: [],
  investments: [
    { id: 'i1', ticker: 'VAS', units: 100, averagePrice: 90, currentPrice: 100, type: 'ETF' },
  ],
};

describe('MA.4-002 — intelligence engine net-worth matches canonical SSOT', () => {
  it('includes superannuation in net worth (was excluded pre-fix)', () => {
    const withoutSuper = calculateNetWorth({ ...baseInput, superannuation: [] });
    const withSuper = calculateNetWorth({
      ...baseInput,
      superannuation: [{ balance: 250_000, fundType: 'INDUSTRY' }],
    });

    // Super adds $250k to net worth.
    expect(withSuper.netWorth - withoutSuper.netWorth).toBe(250_000);
    // Super lands in the `other` bucket of the asset breakdown.
    expect(withSuper.assetBreakdown.other - withoutSuper.assetBreakdown.other).toBe(250_000);
  });

  it('includes personal assets in net worth (was excluded pre-fix)', () => {
    const withoutAssets = calculateNetWorth({ ...baseInput, personalAssets: [] });
    const withAssets = calculateNetWorth({
      ...baseInput,
      personalAssets: [{ currentValue: 30_000 }, { currentValue: 5_000 }],
    });

    expect(withAssets.netWorth - withoutAssets.netWorth).toBe(35_000);
    expect(withAssets.assetBreakdown.other - withoutAssets.assetBreakdown.other).toBe(35_000);
  });

  it('excludes SMSF member super accounts (Phase 39.5 double-count guard)', () => {
    // SMSF member balances are represented by the SMSF LegalEntity's owned
    // assets (already summed); counting both double-counts the fund.
    const result = calculateNetWorth({
      ...baseInput,
      superannuation: [
        { balance: 100_000, fundType: 'INDUSTRY' },
        { balance: 500_000, fundType: 'SMSF' }, // EXCLUDED
      ],
    });

    // Only the INDUSTRY $100k contributes; the SMSF $500k is excluded.
    const noSuperBaseline = calculateNetWorth({ ...baseInput, superannuation: [] });
    expect(result.netWorth - noSuperBaseline.netWorth).toBe(100_000);
  });

  it('maps canonical breakdown → intel NetWorthAnalysis shape', () => {
    const result = calculateNetWorth({
      ...baseInput,
      superannuation: [{ balance: 150_000, fundType: 'INDUSTRY' }],
      personalAssets: [{ currentValue: 20_000 }],
    });

    // Assets: $800k property + $25k cash + $10k investments ($100 × 100) +
    // $150k super + $20k personal asset = $1,005,000.
    expect(result.totalAssets).toBe(1_005_000);
    // Liabilities: $400k mortgage.
    expect(result.totalLiabilities).toBe(400_000);
    expect(result.netWorth).toBe(605_000);

    expect(result.assetBreakdown.properties).toBe(800_000);
    expect(result.assetBreakdown.cash).toBe(25_000);
    expect(result.assetBreakdown.investments).toBe(10_000);
    expect(result.assetBreakdown.other).toBe(170_000); // super + personalAsset

    expect(result.liabilityBreakdown.mortgages).toBe(400_000);
    expect(result.liabilityBreakdown.creditCards).toBe(0);
    expect(result.liabilityBreakdown.other).toBe(0);
  });

  it('back-compat — input without superannuation/personalAssets behaves like pre-fix for those fields', () => {
    // Old callers that don't surface super/assets data don't break;
    // they just see $0 in the `other` asset bucket.
    const result = calculateNetWorth(baseInput);
    expect(result.assetBreakdown.other).toBe(0);
    expect(result.totalAssets).toBe(800_000 + 25_000 + 10_000);
  });

  it('investment price falls back to averagePrice when currentPrice is missing', () => {
    // Per canonical netWorthCalculator: `currentPrice || averagePrice`.
    // Pre-MA.4-002 intel had no fallback (only used currentPrice).
    const result = calculateNetWorth({
      ...baseInput,
      investments: [
        // No currentPrice — should fall back to averagePrice ($50)
        { id: 'i2', ticker: 'X', units: 100, averagePrice: 50, currentPrice: 0, type: 'SHARE' },
      ],
    });
    expect(result.assetBreakdown.investments).toBe(5_000); // 100 × 50
  });
});
