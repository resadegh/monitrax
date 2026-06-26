/**
 * Trust Engine · Tranche D — the canonical SSOT primitives (`lib/utils/calculations`).
 *
 * These six functions are the ONE home for LVR, equity, rental yield, offset
 * effective-principal, periodic interest, and the P&I repayment (CLAUDE.md §6.2
 * / §12.2). Every property/loan surface in the app is meant to read from here
 * rather than re-deriving the formula inline — so the W2–W7 SSOT dedup points
 * surfaces AT these functions. That makes verifying them load-bearing: once a
 * surface reads the canonical engine and the engine is proven, the Neomatrix A3
 * convergence check turns any re-introduced duplicate into a build failure.
 *
 * Locked three ways (no production logic changed — this PROVES it):
 *   • L0 golden — hand-derived from the documented formula (LVR = loan/value×100,
 *     equity = max(0, value−loan), yield = rent/value×100, effective principal =
 *     max(0, principal−offset), interest = principal×rate/periods, P&I annuity).
 *   • L2 invariant — domain laws (non-negativity floors, divide-by-zero → 0,
 *     linearity, the inverse identities) over a deterministic sweep.
 *   • Float ⇄ Decimal parity — each Float primitive agrees with its Decimal
 *     sibling, so the SSOT's two twins can never silently diverge.
 *
 * Models the canonical-primitive engine nodes the Neomatrix now carries (Tranche D).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLVR,
  calculateEquity,
  calculateRentalYield,
  calculateEffectivePrincipal,
  calculateInterestForPeriod,
  calculatePIRepayment,
  calculateEffectivePrincipalDecimal,
  calculateInterestForPeriodDecimal,
  calculatePIRepaymentDecimal,
} from '@/lib/utils/calculations';

// deterministic PRNG (mulberry32) — reproducible inputs, no new dep.
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

// =============================================================================
// L0 golden — hand-derived from each documented formula.
// =============================================================================

describe('Trust Engine D · canonical primitives — L0 golden', () => {
  it('calculateLVR — $400k loan on a $500k property = 80%', () => {
    expect(calculateLVR(400_000, 500_000)).toBeCloseTo(80, 6);
  });
  it('calculateEquity — $500k value − $400k loan = $100k', () => {
    expect(calculateEquity(500_000, 400_000)).toBeCloseTo(100_000, 6);
  });
  it('calculateRentalYield — $26k rent on a $500k property = 5.2%', () => {
    expect(calculateRentalYield(26_000, 500_000)).toBeCloseTo(5.2, 6);
  });
  it('calculateEffectivePrincipal — $500k principal − $80k offset = $420k', () => {
    expect(calculateEffectivePrincipal(500_000, 80_000)).toBeCloseTo(420_000, 6);
  });
  it('calculateInterestForPeriod — $500k @6% monthly = $2,500', () => {
    expect(calculateInterestForPeriod(500_000, 0.06, 12)).toBeCloseTo(2_500, 6);
  });
  it('calculatePIRepayment — $500k @6% over 360mo = $2,997.75', () => {
    expect(calculatePIRepayment(500_000, 0.06, 360)).toBeCloseTo(2997.7526, 2);
  });
});

// =============================================================================
// L2 invariant — the domain laws + the documented degenerate-case handling.
// =============================================================================

describe('Trust Engine D · canonical primitives — L2 invariants', () => {
  it('LVR — divide-by-zero guard (value 0 → 0) + the inverse identity loan = LVR/100 × value', () => {
    expect(calculateLVR(123_456, 0)).toBe(0); // documented guard
    const rand = rng(0x111);
    for (let i = 0; i < 50; i++) {
      const loan = Math.round(rand() * 2_000_000);
      const value = 1 + Math.round(rand() * 2_000_000);
      const lvr = calculateLVR(loan, value);
      expect((lvr / 100) * value).toBeCloseTo(loan, 4); // inverse identity
      expect(lvr).toBeGreaterThanOrEqual(0);
    }
  });

  it('equity — floored at 0 (underwater → 0); equals value − loan when solvent', () => {
    expect(calculateEquity(300_000, 500_000)).toBe(0); // underwater floor
    const rand = rng(0x222);
    for (let i = 0; i < 50; i++) {
      const value = Math.round(rand() * 2_000_000);
      const loan = Math.round(rand() * 2_000_000);
      const eq = calculateEquity(value, loan);
      expect(eq).toBeGreaterThanOrEqual(0);
      if (value >= loan) expect(eq).toBeCloseTo(value - loan, 4);
      else expect(eq).toBe(0);
    }
  });

  it('rental yield — divide-by-zero guard + linearity in rent', () => {
    expect(calculateRentalYield(26_000, 0)).toBe(0);
    const value = 750_000;
    // doubling the rent doubles the yield (pure linearity)
    expect(calculateRentalYield(40_000, value)).toBeCloseTo(2 * calculateRentalYield(20_000, value), 6);
  });

  it('effective principal — floored at 0 when fully offset, never negative', () => {
    expect(calculateEffectivePrincipal(100_000, 250_000)).toBe(0); // over-offset floor
    const rand = rng(0x333);
    for (let i = 0; i < 50; i++) {
      const principal = Math.round(rand() * 1_000_000);
      const offset = Math.round(rand() * 1_000_000);
      const eff = calculateEffectivePrincipal(principal, offset);
      expect(eff).toBeGreaterThanOrEqual(0);
      expect(eff).toBeCloseTo(Math.max(0, principal - offset), 4);
    }
  });

  it('interest for period — linear in principal; zero principal → zero interest', () => {
    expect(calculateInterestForPeriod(0, 0.06, 12)).toBe(0);
    // periodic rate = annual / periods, applied to principal
    expect(calculateInterestForPeriod(1_000_000, 0.05, 26)).toBeCloseTo(1_000_000 * (0.05 / 26), 6);
  });

  it('P&I repayment — zero-rate degenerates to straight-line principal/term; total paid ≥ principal', () => {
    // documented degenerate path
    expect(calculatePIRepayment(360_000, 0, 360)).toBeCloseTo(1_000, 6);
    const rand = rng(0x444);
    for (let i = 0; i < 40; i++) {
      const principal = 50_000 + Math.round(rand() * 1_500_000);
      const rate = 0.01 + rand() * 0.08;
      const term = 60 + Math.floor(rand() * 360);
      const m = calculatePIRepayment(principal, rate, term);
      // an amortising payment × term must at least repay the principal (interest ≥ 0)
      expect(m * term).toBeGreaterThanOrEqual(principal - 1e-6);
      expect(m).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Float ⇄ Decimal parity — the SSOT keeps two twins; they must never diverge.
// =============================================================================

describe('Trust Engine D · canonical primitives — Float ⇄ Decimal parity', () => {
  it('effective principal, interest, and P&I agree across the Float and Decimal siblings', () => {
    const rand = rng(0x555);
    for (let i = 0; i < 50; i++) {
      const principal = Math.round(rand() * 1_500_000);
      const offset = Math.round(rand() * 1_500_000);
      const rate = 0.01 + rand() * 0.08;
      const term = 60 + Math.floor(rand() * 360);

      expect(calculateEffectivePrincipalDecimal(principal, offset).toNumber())
        .toBeCloseTo(calculateEffectivePrincipal(principal, offset), 6);
      expect(calculateInterestForPeriodDecimal(principal, rate, 12).toNumber())
        .toBeCloseTo(calculateInterestForPeriod(principal, rate, 12), 6);
      expect(calculatePIRepaymentDecimal(principal || 1, rate, term).toNumber())
        .toBeCloseTo(calculatePIRepayment(principal || 1, rate, term), 4);
    }
  });
});
