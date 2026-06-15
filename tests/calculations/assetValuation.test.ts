/**
 * Phase 3 fix PR1 — canonical asset-value / loan-balance helpers.
 *
 * The whole point of the helpers is that read-models (wealthGraphService,
 * reports/contextBuilder, ai/financialAdvisor) value assets by the SAME basis
 * as the canonical net-worth engine. These tests pin that contract: for the
 * same input, the helper output EQUALS `calculateTotalAssets` /
 * `calculateTotalLiabilities` from `netWorthCalculator` (the SSOT, untouched).
 *
 * Audit: docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md (L1-1/2/3).
 */

import { describe, it, expect } from 'vitest';
import {
  holdingMarketValue,
  sumHoldingsMarketValue,
  loanBalance,
  sumLoanBalances,
} from '@/lib/calculations/assetValuation';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
} from '@/lib/calculations/netWorthCalculator';

describe('holdingMarketValue — unit behaviour', () => {
  it('uses live currentPrice when present', () => {
    expect(holdingMarketValue({ units: 10, currentPrice: 25, averagePrice: 20 })).toBe(250);
  });
  it('falls back to averagePrice when currentPrice is null/0', () => {
    expect(holdingMarketValue({ units: 10, currentPrice: null, averagePrice: 20 })).toBe(200);
    expect(holdingMarketValue({ units: 10, currentPrice: 0, averagePrice: 20 })).toBe(200);
  });
  it('is 0 when no price or no units', () => {
    expect(holdingMarketValue({ units: 10, currentPrice: null, averagePrice: null })).toBe(0);
    expect(holdingMarketValue({ units: null, currentPrice: 25, averagePrice: 20 })).toBe(0);
    expect(holdingMarketValue({})).toBe(0);
  });
});

describe('loanBalance — unit behaviour', () => {
  it('uses principal (the canonical current-balance field)', () => {
    expect(loanBalance({ principal: 320_000 })).toBe(320_000);
  });
  it('supports mapped read-model field names without changing the result', () => {
    expect(loanBalance({ currentBalance: 12_345 })).toBe(12_345);
    expect(loanBalance({ balance: 6_789 })).toBe(6_789); // financialAdvisor shape
  });
  it('is 0 when nothing is set', () => {
    expect(loanBalance({})).toBe(0);
    expect(loanBalance({ principal: null })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The contract that matters: read-path basis == canonical engine, same input.
// ---------------------------------------------------------------------------

describe('sumHoldingsMarketValue EQUALS canonical investments total', () => {
  const cases: Array<{ name: string; holdings: Array<{ units: number; currentPrice: number | null; averagePrice: number }> }> = [
    {
      name: 'all live prices',
      holdings: [
        { units: 100, currentPrice: 30.5, averagePrice: 25 },
        { units: 50, currentPrice: 12, averagePrice: 10 },
      ],
    },
    {
      name: 'mixed — one holding has no live price (cost-basis fallback)',
      holdings: [
        { units: 100, currentPrice: 30.5, averagePrice: 25 },
        { units: 40, currentPrice: null, averagePrice: 18 },
      ],
    },
    {
      name: 'fractional units + odd prices (no rounding drift)',
      holdings: [
        { units: 3.27, currentPrice: 411.19, averagePrice: 390 },
        { units: 0.5, currentPrice: null, averagePrice: 1000.01 },
      ],
    },
    { name: 'empty', holdings: [] },
  ];

  it.each(cases)('$name', ({ holdings }) => {
    // Canonical treats each holding as an InvestmentInput; the investments
    // sub-total is the canonical investment valuation for the same rows.
    const canonical = calculateTotalAssets([], [], holdings as any).investments;
    expect(sumHoldingsMarketValue(holdings)).toBe(canonical);
  });
});

describe('sumLoanBalances EQUALS canonical liabilities total', () => {
  const cases: Array<{ name: string; loans: Array<{ principal: number; type?: string; propertyId?: string }> }> = [
    {
      name: 'mortgage + personal + credit card (all classes counted once)',
      loans: [
        { principal: 540_000, type: 'HOME' },
        { principal: 18_000, type: 'PERSONAL' },
        { principal: 4_250, type: 'CREDIT_CARD' },
      ],
    },
    {
      name: 'property-linked loan (classified by propertyId)',
      loans: [
        { principal: 612_345.67, type: 'INVESTMENT', propertyId: 'prop-1' },
        { principal: 0, type: 'PERSONAL' },
      ],
    },
    { name: 'empty', loans: [] },
  ];

  it.each(cases)('$name', ({ loans }) => {
    const canonical = calculateTotalLiabilities(loans as any).total;
    expect(sumLoanBalances(loans)).toBe(canonical);
  });
});

describe('financialAdvisor loan shape ({ balance }) sums identically', () => {
  it('sumLoanBalances over advisor-mapped loans equals the naive balance sum', () => {
    const advisorLoans = [{ balance: 320_000 }, { balance: 15_500 }, { balance: 0 }];
    const naive = advisorLoans.reduce((s, l) => s + l.balance, 0);
    expect(sumLoanBalances(advisorLoans)).toBe(naive);
  });
});
