/**
 * Trust Engine · Layer 2 — invariant / property checks (the laws whose ABSENCE
 * let real bugs ship). Reza directive 2026-06-25: a system to be "100% sure the
 * results are valid, correct and trustworthy" — not a human eyeballing numbers.
 *
 * This file EXTENDS the Phase 4 invariant suite (`invariants.test.ts`) with the
 * properties that were missing when two production bugs shipped:
 *
 *   • the income-tax "$0 at every bracket boundary" cliff (P0, fixed 2026-06-23
 *     `incomeTaxCalculator.ts` strict-`<`): a MONOTONICITY violation — tax must
 *     never DROP as income rises. A fine income sweep + every bracket boundary
 *     now locks it permanently.
 *   • the "dropped uncategorised spend" cliff (cashflow-SSOT, 2026-06-23): the
 *     category breakdown must SUM EXACTLY to the total — uncategorised OUT is
 *     real money out and is bucketed under `Uncategorised`, never dropped.
 *
 * Plus the converter-consistency law (catches the divergent-frequency class —
 * e.g. a `4.33`-weekly approximation drifting from the canonical `×52`).
 *
 * These are laws of the engines, checked over fine deterministic sweeps — not
 * snapshots. They run in the vitest CI rail (`test:regression`) → the L5 build
 * gate. No financial logic is changed here; this only PROVES it.
 */

import { describe, it, expect } from 'vitest';
import { calculateIncomeTax } from '@/lib/tax-engine/core/incomeTaxCalculator';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import {
  computeActualCashflow,
  UNCATEGORISED_LABEL,
  type ActualCashflowTransaction,
} from '@/lib/calculations/actualCashflow';
import { toAnnual, toMonthly, periodsPerYear } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

const CONFIG = getCurrentTaxYearConfig();
const TOP_RATE = Math.max(...CONFIG.brackets.map((b) => b.rate)); // 0.45

// deterministic PRNG (mulberry32) — reproducible "property" inputs, no new dep.
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

const isFinite2 = (n: number) => Number.isFinite(n) && !Number.isNaN(n);

// =============================================================================
// L2.1 — Income tax: monotone, continuous, progressive (the $0-cliff lock)
// =============================================================================

describe('Trust Engine L2 · income tax — monotone + continuous + progressive', () => {
  // A fine, deterministic income sweep PLUS every bracket boundary ±1 — the
  // exact points where the $0-cliff bug lived.
  const incomes: number[] = [];
  for (let x = 0; x <= 400_000; x += 137) incomes.push(x); // odd step → off-boundary values
  for (const b of CONFIG.brackets) {
    incomes.push(b.min - 1, b.min, b.min + 1);
    if (b.max != null) incomes.push(b.max - 1, b.max, b.max + 1);
  }
  const sweep = [...new Set(incomes.filter((x) => x >= 0))].sort((a, b) => a - b);

  it('tax is NON-DECREASING as income rises (locks the $0-at-every-bracket-boundary cliff)', () => {
    let prevTax = -1;
    let prevIncome = -1;
    for (const income of sweep) {
      const tax = calculateIncomeTax(income, CONFIG).taxPayable;
      expect(isFinite2(tax)).toBe(true);
      // The bug: tax(45000)=$4,288 → tax(45001)=$0. A non-decreasing sweep
      // makes that impossible. Tolerance covers cent-rounding only.
      expect(tax).toBeGreaterThanOrEqual(prevTax - 0.01);
      prevTax = tax;
      prevIncome = income;
    }
    expect(prevIncome).toBeGreaterThan(390_000); // sweep actually ran into the top bracket
  });

  it('tax is POSITIVE for every dollar above the tax-free threshold', () => {
    const tft = CONFIG.taxFreeThreshold; // 18,200
    for (const income of sweep.filter((x) => x > tft)) {
      const tax = calculateIncomeTax(income, CONFIG).taxPayable;
      expect(tax).toBeGreaterThan(0); // never $0 once income is taxable
    }
  });

  it('tax never exceeds income, and the effective rate stays within [0, top marginal]', () => {
    for (const income of sweep.filter((x) => x > 0)) {
      const r = calculateIncomeTax(income, CONFIG);
      expect(r.taxPayable).toBeLessThanOrEqual(income);
      expect(r.effectiveRate).toBeGreaterThanOrEqual(0);
      // effective rate can never exceed the top marginal rate (as a %)
      expect(r.effectiveRate).toBeLessThanOrEqual(TOP_RATE * 100 + 0.01);
    }
  });

  it('tax is CONTINUOUS — no step bigger than the top marginal rate × the income step', () => {
    for (let i = 1; i < sweep.length; i++) {
      const x1 = sweep[i - 1];
      const x2 = sweep[i];
      const t1 = calculateIncomeTax(x1, CONFIG).taxPayable;
      const t2 = calculateIncomeTax(x2, CONFIG).taxPayable;
      const delta = t2 - t1;
      // No downward cliff …
      expect(delta).toBeGreaterThanOrEqual(-0.01);
      // … and no upward jump beyond the top marginal rate over the step
      // (+$1 absorbs the engine's `incomeInBracket + 1` convention + rounding).
      expect(delta).toBeLessThanOrEqual(TOP_RATE * (x2 - x1) + 1.0);
    }
  });

  it('marginal rate is progressive (non-decreasing) and equals the bracket rate AT each boundary', () => {
    // progressive across the sweep
    let prevMarginal = -1;
    for (const income of sweep.filter((x) => x > 0)) {
      const m = calculateIncomeTax(income, CONFIG).marginalRate; // as a %
      expect(isFinite2(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(prevMarginal - 0.001);
      prevMarginal = m;
    }
    // income exactly AT a bracket minimum must sit IN that bracket (the cliff fix)
    for (const b of CONFIG.brackets) {
      if (b.min <= 0) continue;
      const m = calculateIncomeTax(b.min, CONFIG).marginalRate;
      expect(m).toBeCloseTo(b.rate * 100, 6);
    }
  });
});

// =============================================================================
// L2.2 — Actual cashflow: category breakdown sums to the total (the dropped-
//         uncategorised lock). Σ outflowByCategory MUST equal currentMonthOutflow.
// =============================================================================

describe('Trust Engine L2 · actual cashflow — category breakdown sums to the total', () => {
  const NOW = new Date('2026-06-15T00:00:00Z');
  const thisMonth = (day: number, hour = 0) =>
    new Date(Date.UTC(2026, 5, day, hour)); // June 2026 = current month
  const lastMonth = (day: number) => new Date(Date.UTC(2026, 4, day)); // May 2026

  it('Σ outflowByCategory === currentMonthOutflow, and Uncategorised is never dropped', () => {
    const txns: ActualCashflowTransaction[] = [
      { date: thisMonth(2), amount: -120.5, direction: 'OUT', categoryLevel1: 'Groceries' },
      { date: thisMonth(3), amount: -80, direction: 'OUT', categoryLevel1: 'Transport' },
      { date: thisMonth(4), amount: -45.25, direction: 'OUT', categoryLevel1: null }, // uncategorised
      { date: thisMonth(5), amount: -45.25, direction: 'OUT', categoryLevel1: '' }, // empty → uncategorised
      { date: thisMonth(6), amount: 5000, direction: 'IN', categoryLevel1: 'Salary' }, // income, not spend
      { date: thisMonth(7), amount: -999, direction: 'OUT', categoryLevel1: 'Rent', isTransfer: true }, // transfer excluded
      { date: lastMonth(20), amount: -300, direction: 'OUT', categoryLevel1: 'Groceries' }, // prior month excluded
    ];

    const r = computeActualCashflow(txns, { now: NOW });
    const categorySum = Object.values(r.outflowByCategory).reduce((s, v) => s + v, 0);

    // THE invariant: nothing created, nothing dropped.
    expect(categorySum).toBeCloseTo(r.currentMonthOutflow, 6);
    // The two uncategorised OUT (null + empty) are bucketed, not dropped.
    expect(r.outflowByCategory[UNCATEGORISED_LABEL]).toBeCloseTo(90.5, 6);
    // The current-month total is exactly the four real OUT magnitudes.
    expect(r.currentMonthOutflow).toBeCloseTo(120.5 + 80 + 45.25 + 45.25, 6);
    // The transfer never entered spend.
    expect(Object.values(r.outflowByCategory)).not.toContain(999);
  });

  it('holds over a deterministic random sweep of current-month spend (incl. uncategorised + transfers)', () => {
    const rand = rng(0xc0ffee);
    const cats = ['Groceries', 'Transport', 'Dining', 'Utilities', null, '', undefined];
    for (let trial = 0; trial < 40; trial++) {
      const n = 1 + Math.floor(rand() * 30);
      const txns: ActualCashflowTransaction[] = [];
      for (let i = 0; i < n; i++) {
        const day = 1 + Math.floor(rand() * 14); // within current month, before NOW
        const isOut = rand() < 0.7;
        const isTransfer = rand() < 0.15;
        const amt = Math.round(rand() * 500_00) / 100; // up to $500.00
        txns.push({
          date: thisMonth(day),
          amount: isOut ? -amt : amt,
          direction: isOut ? 'OUT' : 'IN',
          categoryLevel1: cats[Math.floor(rand() * cats.length)] as string | null,
          isTransfer,
        });
      }
      const r = computeActualCashflow(txns, { now: NOW });
      const categorySum = Object.values(r.outflowByCategory).reduce((s, v) => s + v, 0);
      // No matter the mix, the breakdown reconciles to the total to the cent.
      expect(categorySum).toBeCloseTo(r.currentMonthOutflow, 6);
      expect(isFinite2(r.currentMonthOutflow)).toBe(true);
      expect(isFinite2(r.currentMonthNet)).toBe(true);
      expect(isFinite2(r.avgMonthlyOutflow)).toBe(true);
    }
  });
});

// =============================================================================
// L2.3 — Frequency converters: internally consistent with periodsPerYear
//         (catches the divergent-converter class — e.g. 4.33-weekly drift).
// =============================================================================

describe('Trust Engine L2 · frequency converters — definitional consistency', () => {
  const FREQS: Frequency[] = [
    'WEEKLY',
    'FORTNIGHTLY',
    'MONTHLY',
    'QUARTERLY',
    'HALF_YEARLY',
    'ANNUAL',
  ] as Frequency[];

  it('toAnnual(x, f) === x × periodsPerYear(f) and toMonthly(x, f) === toAnnual(x, f) / 12', () => {
    const rand = rng(42);
    for (const f of FREQS) {
      for (let i = 0; i < 20; i++) {
        const x = Math.round(rand() * 10_000_00) / 100;
        const annual = toAnnual(x, f);
        // The canonical relationship — a 4.33-weekly approximation would break this.
        expect(annual).toBeCloseTo(x * periodsPerYear(f), 6);
        expect(toMonthly(x, f)).toBeCloseTo(annual / 12, 9);
      }
    }
  });

  it('annualise → de-annualise round-trips (toMonthly is the exact inverse via ANNUAL)', () => {
    const rand = rng(7);
    for (let i = 0; i < 50; i++) {
      const monthly = Math.round(rand() * 20_000_00) / 100;
      // a monthly amount → annual → back to monthly is identity
      expect(toMonthly(toAnnual(monthly, 'MONTHLY' as Frequency), 'ANNUAL' as Frequency)).toBeCloseTo(
        monthly,
        9,
      );
    }
  });
});
