/**
 * Phase 41f.3 — snapshotPuller pure-logic tests.
 *
 * Tests the unit-testable surface — fiscal period resolution + the
 * simplified s109Y distributable-surplus formula. The full
 * `pullSnapshot` orchestration touches the DB + the Xero API; it's
 * smoke-tested manually after deploy with a Xero sandbox.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveFiscalPeriod,
  currentAustralianFY,
  computeSimplifiedDistributableSurplus,
} from '@/lib/integrations/xero';
import type { XeroBalanceSheet, XeroProfitAndLoss } from '@/lib/integrations/xero';

describe('Phase 41f.3 — fiscal period resolution', () => {
  it('parses "FY24-25" → 2024-07-01 → 2025-06-30', () => {
    const p = resolveFiscalPeriod('FY24-25');
    expect(p.label).toBe('FY24-25');
    expect(p.fromDate).toBe('2024-07-01');
    expect(p.toDate).toBe('2025-06-30');
  });

  it('parses ISO range "2024-07-01..2025-06-30"', () => {
    const p = resolveFiscalPeriod('2024-07-01..2025-06-30');
    expect(p.fromDate).toBe('2024-07-01');
    expect(p.toDate).toBe('2025-06-30');
  });

  it('falls back to current AU FY when label omitted', () => {
    const p = resolveFiscalPeriod();
    expect(p.label).toMatch(/^FY\d{2}-\d{2}$/);
    expect(p.fromDate.endsWith('-07-01')).toBe(true);
    expect(p.toDate.endsWith('-06-30')).toBe(true);
  });

  it('AU FY for July anchors to current calendar year', () => {
    const fy = currentAustralianFY(new Date('2025-07-15'));
    expect(fy.label).toBe('FY25-26');
    expect(fy.fromDate).toBe('2025-07-01');
    expect(fy.toDate).toBe('2026-06-30');
  });

  it('AU FY for June anchors to PREVIOUS calendar year', () => {
    const fy = currentAustralianFY(new Date('2026-06-15'));
    expect(fy.label).toBe('FY25-26');
    expect(fy.fromDate).toBe('2025-07-01');
    expect(fy.toDate).toBe('2026-06-30');
  });
});

describe('Phase 41f.3 — simplified s109Y distributable surplus', () => {
  const baseBs: XeroBalanceSheet = {
    reportDate: '2025-06-30',
    totalAssets: 500_000,
    totalLiabilities: 200_000,
    totalEquity: 300_000,
  };
  const basePl: XeroProfitAndLoss = {
    fromDate: '2024-07-01',
    toDate: '2025-06-30',
    revenue: 1_000_000,
    operatingExpenses: 800_000,
    netProfitBeforeTax: 200_000,
    netProfitAfterTax: 140_000,
  };

  it('computes (retainedEarnings + netProfitAfterTax) when both present', () => {
    const surplus = computeSimplifiedDistributableSurplus(
      { ...baseBs, retainedEarnings: 250_000 },
      { ...basePl, netProfitAfterTax: 140_000 },
    );
    expect(surplus).toBe(390_000);
  });

  it('falls back to netProfitAfterTax alone when retainedEarnings missing', () => {
    const surplus = computeSimplifiedDistributableSurplus(baseBs, {
      ...basePl,
      netProfitAfterTax: 140_000,
    });
    expect(surplus).toBe(140_000);
  });

  it('floors at 0 when retained earnings + net profit is negative (net loss carry-forward)', () => {
    const surplus = computeSimplifiedDistributableSurplus(
      { ...baseBs, retainedEarnings: -100_000 },
      { ...basePl, netProfitAfterTax: -50_000 },
    );
    expect(surplus).toBe(0);
  });

  it('returns 0 when both are zero', () => {
    const surplus = computeSimplifiedDistributableSurplus(
      { ...baseBs, retainedEarnings: 0 },
      { ...basePl, netProfitAfterTax: 0 },
    );
    expect(surplus).toBe(0);
  });

  it('handles a positive retained earnings + negative current-year loss correctly', () => {
    // Retained 200k from prior years, lost 50k this year → 150k surplus
    const surplus = computeSimplifiedDistributableSurplus(
      { ...baseBs, retainedEarnings: 200_000 },
      { ...basePl, netProfitAfterTax: -50_000 },
    );
    expect(surplus).toBe(150_000);
  });
});
