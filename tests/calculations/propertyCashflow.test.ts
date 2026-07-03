/**
 * MON-002 + MON-009 — canonical per-property cashflow (§19.2 worked examples +
 * §19.4 cross-surface one-source proof).
 *
 * Verifies: actuals-first via the monthly resolver, RENT resolved at the
 * property-STREAM level (fragmented records counted once), loan cost NEVER
 * silently $0, P&I-vs-interest split, and that BOTH property surfaces read this
 * one engine.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { computePropertyCashflow } from '../../lib/calculations/propertyCashflow';

const day = 86_400_000;
const start = Date.parse('2026-01-01T00:00:00Z');
const at = (i: number, intervalDays: number) => new Date(start + i * intervalDays * day);

describe('computePropertyCashflow', () => {
  // ── Lot 2 (declared, minRepayment = 0): loan cost floors to interest ──
  it('Lot 2: loan cost is never $0 (floors to interest) — declared', () => {
    const cf = computePropertyCashflow({
      income: [{ type: 'RENTAL', amount: 650, frequency: 'WEEKLY' }],
      loans: [{ principal: 482000, interestRateAnnual: 0.0649, minRepayment: 0 }],
    });
    expect(cf.annualRent).toBeCloseTo(33800, 2); // 650 × 52
    expect(cf.annualLoanInterest).toBeCloseTo(31281.8, 2); // 482000 × 0.0649
    expect(cf.annualLoanRepayment).toBeCloseTo(31281.8, 2); // floored to interest
    expect(cf.annualLoanRepayment).not.toBe(0);
    expect(cf.annualCashflow).toBeCloseTo(2518.2, 2);
    expect(cf.basis).toBe('declared');
  });

  // ── Lot 1 (declared, manual P&I): headline P&I, tax interest-only ──
  it('Lot 1: manual P&I repayment; headline uses P&I, tax uses interest', () => {
    const cf = computePropertyCashflow({
      income: [{ type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' }],
      expenses: [{ amount: 43546, frequency: 'ANNUAL' }],
      loans: [{ principal: 947076, interestRateAnnual: 0.0649, minRepayment: 5975.38, repaymentFrequency: 'MONTHLY' }],
    });
    expect(cf.annualRent).toBeCloseTo(14340, 2);
    expect(cf.annualLoanRepayment).toBeCloseTo(71704.56, 2);
    expect(cf.annualLoanInterest).toBeCloseTo(61465.23, 2);
    expect(cf.annualCashflow).toBeCloseTo(-100910.56, 2);
    expect(cf.annualTaxCashflow).toBeCloseTo(-90671.23, 2);
    expect(cf.annualTaxCashflow).toBeGreaterThan(cf.annualCashflow);
  });

  // ── MON-009: ONE fortnightly rental fragmented across 4 Income records ──
  // The exact bug: 4 records each declared MONTHLY, but the reconciled payments
  // are one fortnightly stream. Rent must be counted ONCE from the pooled
  // transactions (~$2,598/mo), NOT 4 × $1,195.
  it('rent is resolved at the property-stream level (fragmented records counted once)', () => {
    const income = [
      { id: 'i1', type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' },
      { id: 'i2', type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' },
      { id: 'i3', type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' },
      { id: 'i4', type: 'RENTAL', amount: 1195, frequency: 'MONTHLY' },
    ];
    // 8 fortnightly payments spread across the 4 records (as reconciliation did)
    const transactions = Array.from({ length: 8 }, (_, k) => ({
      incomeId: `i${(k % 4) + 1}`,
      date: at(k, 14),
      amount: 1195,
    }));
    const cf = computePropertyCashflow({ income, transactions });
    // one stream: 1195 / 14 × 30.4375 ≈ 2598/mo → ~31,176/yr
    expect(cf.monthlyRent).toBeCloseTo((1195 / 14) * 30.4375, 0);
    expect(cf.annualRent).toBeGreaterThan(30000);
    // NOT the fragmented over-count (4 × 1195 × 12 = 57,360)
    expect(cf.annualRent).toBeLessThan(40000);
    expect(cf.detectedRentFrequency).toBe('FORTNIGHTLY');
    expect(cf.usedActuals.income).toBe(true);
  });

  it('actual loan repayment (captured) drives the P&I from transaction dates', () => {
    const transactions = Array.from({ length: 6 }, (_, k) => ({
      loanId: 'l1', date: at(k, 30), amount: 3000,
    }));
    const cf = computePropertyCashflow({
      loans: [{ id: 'l1', principal: 500000, interestRateAnnual: 0.06, minRepayment: 1, repaymentFrequency: 'MONTHLY' }],
      transactions,
    });
    expect(cf.monthlyLoanRepayment).toBeCloseTo((3000 / 30) * 30.4375, 0); // ~3044/mo
    expect(cf.annualLoanRepayment).toBeGreaterThan(35000);
    expect(cf.usedActuals.loans).toBe(true);
  });

  it('empty property is all zeros, declared basis', () => {
    const cf = computePropertyCashflow({});
    expect(cf.annualCashflow).toBe(0);
    expect(cf.basis).toBe('declared');
  });
});

// ── §19.4 ONE-SOURCE proof: every property surface reads this engine. ──
describe('property cashflow — single source (§19.4)', () => {
  const ROOT = resolve(__dirname, '../..');
  // Property list, property detail, AND the master snapshot (dashboard /
  // net-worth / health) all read the ONE engine → same number everywhere.
  const surfaces = [
    'app/dashboard/properties/[id]/page.tsx',
    'app/dashboard/properties/page.tsx',
    'lib/services/masterFinancialService.ts',
  ];
  for (const rel of surfaces) {
    it(`${rel} reads the canonical engine and has no inline cashflow producer`, () => {
      const src = readFileSync(resolve(ROOT, rel), 'utf8');
      expect(src).toMatch(/computePropertyCashflow/);
      expect(src).not.toMatch(/function\s+computeCashflow\b/);
    });
  }
});
