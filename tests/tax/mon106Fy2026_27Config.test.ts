/**
 * MON-106 — the FY2026-27 tax year config exists, applies the legislated
 * 15% band, and a missing-config FY ANNOUNCES itself instead of silently
 * substituting a neighbouring year (VR-037 finding 3: header said
 * "Financial Year 2026-27" while the brackets were FY25-26's — a ≈$268
 * overstatement live).
 *
 * Four locks:
 *  1. THE CI GUARD (durable prevention) — the CURRENT Australian FY,
 *     derived from the clock (never hardcoded), must have a config entry.
 *     This converts "someone remembers next year's brackets" into a red
 *     build every 1 July (next trip: 1 Jul 2027 without a FY27-28 config).
 *  2. RING-0 BRACKET WALK (§19.2 worked example, Reza's live taxable
 *     income $145,426):
 *       FY25-26: 31,288 + (145,426 − 135,001 + 1) × 0.37 = 35,145.62
 *       FY26-27: 31,020 + 10,426 × 0.37             = 34,877.62
 *       movement: exactly −268.00 (the 16% → 15% band, More Cost of
 *       Living in Every Pocket Act 2025), Medicare unchanged.
 *  3. BRACKET-TABLE INTEGRITY — every FY26-27 baseAmount re-derives from
 *     the brackets below it (no hand-typo can survive).
 *  4. STALE-CONFIG SURFACING — both twins state configFinancialYear /
 *     configStale; an unconfigured requested FY flags stale=true (announce),
 *     the configured current FY flags false.
 *
 * Coverage (precise): verifies the config values, the engine walk, and the
 * flag contract. Does NOT verify the rendered banner or the live position
 * (the Matrix's Ring-3 on PR-B owns the ≈$268 movement on screen).
 */
import { describe, it, expect } from 'vitest';
import {
  getCurrentTaxYearConfig,
  getTaxYearConfig,
  isTaxYearConfigured,
} from '@/lib/tax-engine/config/taxYearConfig';
import { calculateIncomeTax } from '@/lib/tax-engine/core/incomeTaxCalculator';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '@/lib/tax-engine/position/taxPositionCalculator';

/** The engine's own July-1 convention, derived from the clock. */
function currentAuFy(now = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 6
    ? `${y}-${String(y + 1).slice(-2)}`
    : `${y - 1}-${String(y).slice(-2)}`;
}

describe('MON-106 · the current-FY config CI guard (clock-derived, never hardcoded)', () => {
  it('the current Australian FY has a config entry — a missing next-year config is a red build from 1 July', () => {
    const fy = currentAuFy();
    expect(isTaxYearConfigured(fy), `No tax year config for the current FY ${fy} — add TAX_YEAR_${fy.replace('-', '_')} (MON-106 guard)`).toBe(true);
    expect(getCurrentTaxYearConfig().financialYear).toBe(fy);
  });
});

describe('MON-106 · Ring-0 bracket walk on $145,426 (the live taxable income)', () => {
  const TAXABLE = 145_426;

  it('FY25-26: 31,288 + 10,426 × 37% = $35,145.62 (ties the VR-037 baseline $35,146)', () => {
    const r = calculateIncomeTax(TAXABLE, getTaxYearConfig('2025-26'));
    expect(r.taxPayable).toBeCloseTo(35_145.62, 2);
    expect(Math.round(r.taxPayable)).toBe(35_146);
  });

  it('FY26-27: 31,020 + 10,426 × 37% = $34,877.62 — the legislated 15% band', () => {
    const r = calculateIncomeTax(TAXABLE, getTaxYearConfig('2026-27'));
    expect(r.taxPayable).toBeCloseTo(34_877.62, 2);
    expect(r.marginalRate).toBe(37); // IncomeTaxResult.marginalRate is a percentage
  });

  it('the movement is exactly −$268.00 — the 16% → 15% band and nothing else', () => {
    const before = calculateIncomeTax(TAXABLE, getTaxYearConfig('2025-26')).taxPayable;
    const after = calculateIncomeTax(TAXABLE, getTaxYearConfig('2026-27')).taxPayable;
    expect(before - after).toBeCloseTo(268.0, 2);
  });

  it('the $268 is the full-band saving: 26,800 × (16% − 15%) = $268 for every income ≥ $45,000', () => {
    const before = calculateIncomeTax(60_000, getTaxYearConfig('2025-26')).taxPayable;
    const after = calculateIncomeTax(60_000, getTaxYearConfig('2026-27')).taxPayable;
    expect(before - after).toBeCloseTo(268.0, 2);
  });
});

describe('MON-106 · FY26-27 bracket-table integrity (base amounts re-derive)', () => {
  it('every baseAmount equals the cumulative tax of the brackets below it', () => {
    const { brackets } = getTaxYearConfig('2026-27');
    let cumulative = 0;
    for (let i = 0; i < brackets.length; i++) {
      expect(brackets[i].baseAmount).toBeCloseTo(cumulative, 2);
      const max = brackets[i].max;
      if (max !== null) {
        // The engine's inclusive-bound convention: (max − min + 1) × rate.
        cumulative += (max - brackets[i].min + 1) * brackets[i].rate;
      }
    }
    // The legislated change and only the legislated change:
    expect(brackets[1].rate).toBe(0.15);
    expect(brackets.map((b) => b.rate)).toEqual([0, 0.15, 0.3, 0.37, 0.45]);
  });

  it('Medicare and the carried-forward settings did not move (only the bracket did)', () => {
    const prev = getTaxYearConfig('2025-26');
    const next = getTaxYearConfig('2026-27');
    expect(next.medicareRate).toBe(prev.medicareRate);
    expect(next.medicareThresholds).toEqual(prev.medicareThresholds);
    expect(next.concessionalCap).toBe(prev.concessionalCap);
    expect(next.superGuaranteeRate).toBe(prev.superGuaranteeRate);
    expect(next.transferBalanceCap).toBe(prev.transferBalanceCap);
  });
});

describe('MON-106 · stale-config surfacing (announce, never substitute silently)', () => {
  const EMPTY = { incomes: [], expenses: [], depreciations: [] };

  it('the configured current FY → configStale false, both twins', () => {
    for (const calc of [calculateTaxPosition, calculateTaxPositionDecimal]) {
      const r = calc(EMPTY);
      expect(r.configStale).toBe(false);
      expect(r.configFinancialYear).toBe(r.financialYear);
    }
  });

  it('an unconfigured requested FY → configStale true + the fallback FY named, both twins', () => {
    for (const calc of [calculateTaxPosition, calculateTaxPositionDecimal]) {
      const r = calc({ ...EMPTY, financialYear: '2031-32' });
      expect(r.financialYear).toBe('2031-32');
      expect(r.configStale).toBe(true);
      expect(r.configFinancialYear).toBe(getCurrentTaxYearConfig().financialYear);
    }
  });
});
