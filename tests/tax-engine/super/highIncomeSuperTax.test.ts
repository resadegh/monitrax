/**
 * Phase 41e.3 — Div 293 / Div 296 / TBC tests.
 */

import { describe, it, expect } from 'vitest';
import { calculateHighIncomeSuperTax } from '@/lib/tax-engine/super/highIncomeSuperTax';
import { TAX_YEAR_2024_25 } from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';

const baseConfig = TAX_YEAR_2024_25;

const configWithDiv296: TaxYearConfig = {
  ...baseConfig,
  div296CommencementVerified: true,
};

describe('Division 293 — high-income concessional surcharge', () => {
  it('income below threshold → does not apply', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 200000,
        concessionalContributions: 25000,
        totalSuperBalance: 500000,
      },
      baseConfig,
    );
    expect(r.div293.applies).toBe(false);
    expect(r.div293.tax).toBe(0);
  });

  it('income above $250k threshold → 15% on lesser of excess + concessional contribs', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 280000, // $30k over
        concessionalContributions: 25000,
        totalSuperBalance: 500000,
      },
      baseConfig,
    );
    expect(r.div293.applies).toBe(true);
    expect(r.div293.excessIncomeOverThreshold).toBe(30000);
    // taxableContributions = min(30000, 25000) = 25000
    expect(r.div293.taxableContributions).toBe(25000);
    expect(r.div293.tax).toBe(25000 * 0.15);
  });

  it('excess income < concessional → tax bounded by excess', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 260000, // $10k over
        concessionalContributions: 30000,
        totalSuperBalance: 500000,
      },
      baseConfig,
    );
    expect(r.div293.taxableContributions).toBe(10000);
    expect(r.div293.tax).toBe(10000 * 0.15);
  });
});

describe('Division 296 — high-balance super (gated)', () => {
  it('TSB > $3M but commencement unverified → tax 0 + UC-DIV-296-PENDING', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 4000000,
        tsbEarnings: 200000,
      },
      baseConfig, // div296CommencementVerified: false
    );
    expect(r.div296.applies).toBe(false);
    expect(r.div296.tax).toBe(0);
    expect(r.div296.isPending).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-296-PENDING')).toBe(true);
  });

  it('TSB > $3M with commencement verified → tax computed on excess proportion', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 4000000, // 25% above $3M threshold
        tsbEarnings: 200000,
      },
      configWithDiv296,
    );
    expect(r.div296.applies).toBe(true);
    expect(r.div296.isPending).toBe(false);
    // Excess proportion = (4M - 3M) / 4M = 0.25
    expect(r.div296.excessTsbProportion).toBe(0.25);
    // Earnings taxed = 200k * 0.25 = 50k
    expect(r.div296.earningsTaxed).toBe(50000);
    expect(r.div296.tax).toBe(50000 * 0.15);
    // Citation now includes Div 296
    expect(r.citations.some((c) => c.reference === 'Div 296')).toBe(true);
  });

  it('TSB ≤ $3M → no Div 296 + no UNCOMPUTED flag', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 2000000,
      },
      configWithDiv296,
    );
    expect(r.div296.applies).toBe(false);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-296-PENDING')).toBe(false);
  });
});

describe('Transfer Balance Cap (s294-35)', () => {
  it('reports cap, used, headroom', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 1500000,
        transferBalanceUsed: 1000000,
      },
      baseConfig,
    );
    expect(r.tbc.cap).toBe(1900000);
    expect(r.tbc.used).toBe(1000000);
    expect(r.tbc.headroom).toBe(900000);
    expect(r.tbc.isExceeded).toBe(false);
  });

  it('exceeded → UC-TBC-EXCESS surfaces', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 2500000,
        transferBalanceUsed: 2100000,
      },
      baseConfig,
    );
    expect(r.tbc.isExceeded).toBe(true);
    expect(r.tbc.headroom).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-TBC-EXCESS')).toBe(true);
  });

  it('always includes Div 293 + s294-35 citations', () => {
    const r = calculateHighIncomeSuperTax(
      {
        div293Income: 100000,
        concessionalContributions: 0,
        totalSuperBalance: 500000,
      },
      baseConfig,
    );
    expect(r.citations.some((c) => c.reference === 'Div 293')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's294-35')).toBe(true);
  });
});
