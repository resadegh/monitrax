/**
 * Trust Engine · Tranche D.2 — the canonical frequency converters
 * (`lib/utils/frequencies`).
 *
 * Frequency conversion is the single most-duplicated formula in the app — the
 * `× 12` / `/ 12` / `× 52` shapes the surface linter flags everywhere are all
 * meant to route through this ONE home (CLAUDE.md §6.2 / §12.2). Getting a
 * surface to read `toMonthly`/`toAnnual` instead of inlining `× 12` is a core
 * W2–W7 dedup move, so the home must be proven.
 *
 * The DEFINITIONAL consistency + round-trip laws are already locked in
 * `trustEngine.invariants.test.ts` (L2 — toAnnual === x × periodsPerYear,
 * toMonthly === toAnnual / 12, annualise→de-annualise round-trip). This file
 * adds only the coverage that was MISSING (no duplication — §12.2.1):
 *   • L0 golden — the documented per-frequency multipliers (×52 / ×26 / ×12 /
 *     ×4 / ×2 / ×1) read straight from the ATO-style period table.
 *   • Float ⇄ Decimal parity — `toAnnualDecimal`/`toMonthlyDecimal` must agree
 *     with their Float twins, so the SSOT's two siblings can't silently diverge.
 *
 * Models the frequency-converter engine nodes the Neomatrix now carries (D.2).
 */

import { describe, it, expect } from 'vitest';
import {
  toAnnual,
  toMonthly,
  periodsPerYear,
  toAnnualDecimal,
  toMonthlyDecimal,
} from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

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

const FREQS: Array<{ f: Frequency; perYear: number }> = [
  { f: 'WEEKLY' as Frequency, perYear: 52 },
  { f: 'FORTNIGHTLY' as Frequency, perYear: 26 },
  { f: 'MONTHLY' as Frequency, perYear: 12 },
  { f: 'QUARTERLY' as Frequency, perYear: 4 },
  { f: 'HALF_YEARLY' as Frequency, perYear: 2 },
  { f: 'ANNUAL' as Frequency, perYear: 1 },
];

// =============================================================================
// L0 golden — the documented per-frequency multipliers.
// =============================================================================

describe('Trust Engine D.2 · frequency converters — L0 golden', () => {
  it.each(FREQS)('periodsPerYear($f) === $perYear and toAnnual($100, $f) === 100 × $perYear', ({ f, perYear }) => {
    expect(periodsPerYear(f)).toBe(perYear);
    expect(toAnnual(100, f)).toBeCloseTo(100 * perYear, 6);
  });

  it('golden — $500/week annualises to $26,000; monthly equivalent is $2,166.67', () => {
    expect(toAnnual(500, 'WEEKLY' as Frequency)).toBeCloseTo(26_000, 6);
    expect(toMonthly(500, 'WEEKLY' as Frequency)).toBeCloseTo(26_000 / 12, 6);
  });
});

// =============================================================================
// Float ⇄ Decimal parity — the SSOT keeps two sibling sets; never diverge.
// =============================================================================

describe('Trust Engine D.2 · frequency converters — Float ⇄ Decimal parity', () => {
  it('toAnnualDecimal / toMonthlyDecimal agree with their Float twins across every frequency', () => {
    const rand = rng(0xf2eb);
    for (let i = 0; i < 50; i++) {
      const amount = Math.round(rand() * 1_000_000) / 100;
      const { f } = FREQS[Math.floor(rand() * FREQS.length)]!;
      expect(toAnnualDecimal(amount, f).toNumber()).toBeCloseTo(toAnnual(amount, f), 6);
      expect(toMonthlyDecimal(amount, f).toNumber()).toBeCloseTo(toMonthly(amount, f), 6);
    }
  });

  it('null/undefined amounts resolve to 0 in the Decimal path (documented guard)', () => {
    expect(toAnnualDecimal(null, 'MONTHLY' as Frequency).toNumber()).toBe(0);
    expect(toAnnualDecimal(undefined, 'WEEKLY' as Frequency).toNumber()).toBe(0);
  });
});
