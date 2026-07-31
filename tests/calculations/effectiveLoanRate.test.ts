/**
 * MON-142 — the effective-loan-rate resolver.
 *
 * COVERAGE, stated precisely (§22.2.4): these prove the resolution HIERARCHY
 * (charged ledger > IO repayment > stored), the D21 offset rule, the
 * staleness threshold, the P&I guard, and Float ≡ Decimal parity — on the
 * REAL originating figures from Reza's account.
 *
 * They do NOT prove that any surface renders the result (nothing consumes it
 * yet — wiring is a separate number-moving PR), and they do NOT prove which
 * of stored-vs-implied is factually correct; the engine reports divergence,
 * it does not adjudicate it.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveLoanRate,
  resolveEffectiveLoanRateDecimal,
  RATE_STALE_THRESHOLD_PP,
} from '@/lib/calculations/effectiveLoanRate';

// The originating defect, read live at 3cdaa8c4.
const BROADBEACH = { principal: 228_000, storedRateAnnual: 0.0669, isInterestOnly: true };
const LOT2 = { principal: 482_000, storedRateAnnual: 0.0669, isInterestOnly: true };

describe('MON-142 — the stale stored rate is detected on the real figures', () => {
  it('Broadbeach: an IO repayment of $1,191/mo implies 6.268%, not the stored 6.690%', () => {
    const r = resolveEffectiveLoanRate({ ...BROADBEACH, resolvedMonthlyRepayment: 1191 });
    expect(r.basis).toBe('DERIVED_IO_REPAYMENT');
    // 1191 × 12 / 228,000
    expect(r.annualRate).toBeCloseTo(0.0626842, 7);
    expect(r.divergencePp).toBeCloseTo(-0.4216, 3);
    expect(r.flags).toContain('RATE_STALE');
  });

  it('Thornland Lot 2: a different balance implies the SAME rate — one lender, one change', () => {
    const a = resolveEffectiveLoanRate({ ...BROADBEACH, resolvedMonthlyRepayment: 1191 });
    const b = resolveEffectiveLoanRate({ ...LOT2, resolvedMonthlyRepayment: 2518 });
    expect(b.flags).toContain('RATE_STALE');
    // The load-bearing observation: two balances, one implied rate. A per-loan
    // data error could not produce this; a lender rate change does.
    expect(Math.abs(a.annualRate - b.annualRate)).toBeLessThan(0.0001);
  });
});

describe('the resolution hierarchy — evidence beats a typed input', () => {
  it('the charged-interest ledger WINS over the IO-repayment inference', () => {
    const r = resolveEffectiveLoanRate({
      ...BROADBEACH,
      chargedInterestAnnual: 14_292,
      resolvedMonthlyRepayment: 1191, // both available; the ledger must win
    });
    expect(r.basis).toBe('DERIVED_CHARGED');
    expect(r.annualRate).toBeCloseTo(14_292 / 228_000, 10);
  });

  it('no evidence → the stored rate stands, flagged UNVERIFIED (never mistaken for checked)', () => {
    const r = resolveEffectiveLoanRate(BROADBEACH);
    expect(r.basis).toBe('STORED');
    expect(r.annualRate).toBe(0.0669);
    expect(r.impliedRateAnnual).toBeNull();
    expect(r.divergencePp).toBeNull();
    expect(r.flags).toEqual(['RATE_UNVERIFIED']);
  });

  it('a P&I repayment is NOT rate evidence — it mixes principal in', () => {
    // Thornland Lot 1: $6,197/mo on $947,076 would imply 7.85% if misused.
    const r = resolveEffectiveLoanRate({
      principal: 947_076,
      storedRateAnnual: 0.0649,
      isInterestOnly: false,
      resolvedMonthlyRepayment: 6197,
    });
    expect(r.basis).toBe('STORED');
    expect(r.flags).toContain('RATE_UNVERIFIED');
  });
});

describe('D21 — interest accrues on the balance NET of the offset', () => {
  it('Guildford: the implied rate divides by principal − offset, not by principal', () => {
    // 377,822 − 303,890 = 73,932 interest-bearing.
    const r = resolveEffectiveLoanRate({
      principal: 377_822,
      storedRateAnnual: 0.0624,
      offsetBalance: 303_890,
      isInterestOnly: true,
      resolvedMonthlyRepayment: 384.45,
    });
    expect(r.interestBearingBalance).toBeCloseTo(73_932, 6);
    expect(r.annualRate).toBeCloseTo((384.45 * 12) / 73_932, 10);
    // Dividing by the GROSS balance would imply ~1.22% — a 5x understatement.
    expect(r.annualRate).toBeGreaterThan(0.05);
  });

  it('a fully-offset loan derives no rate and never divides by zero', () => {
    const r = resolveEffectiveLoanRate({
      principal: 100_000,
      storedRateAnnual: 0.06,
      offsetBalance: 100_000,
      isInterestOnly: true,
      resolvedMonthlyRepayment: 500,
    });
    expect(r.basis).toBe('STORED');
    expect(r.flags).toContain('NO_INTEREST_BEARING_BALANCE');
    expect(Number.isFinite(r.annualRate)).toBe(true);
  });
});

describe('the staleness threshold', () => {
  it('divergence at or below the threshold is NOT flagged stale', () => {
    // Choose charged interest implying exactly threshold/2 above stored.
    const stored = 0.0669;
    const implied = stored + RATE_STALE_THRESHOLD_PP / 100 / 2;
    const r = resolveEffectiveLoanRate({
      principal: 228_000,
      storedRateAnnual: stored,
      chargedInterestAnnual: implied * 228_000,
    });
    expect(r.flags).not.toContain('RATE_STALE');
  });

  it('a real 0.25pp lender move clears the threshold', () => {
    const stored = 0.0669;
    const implied = stored - 0.0025;
    const r = resolveEffectiveLoanRate({
      principal: 228_000,
      storedRateAnnual: stored,
      chargedInterestAnnual: implied * 228_000,
    });
    expect(r.flags).toContain('RATE_STALE');
  });
});

describe('Float ≡ Decimal parity — basis and flags must never diverge', () => {
  const cases = [
    { ...BROADBEACH, resolvedMonthlyRepayment: 1191 },
    { ...LOT2, resolvedMonthlyRepayment: 2518 },
    { ...BROADBEACH, chargedInterestAnnual: 14_292 },
    BROADBEACH,
    { principal: 377_822, storedRateAnnual: 0.0624, offsetBalance: 303_890, isInterestOnly: true, resolvedMonthlyRepayment: 384.45 },
    { principal: 100_000, storedRateAnnual: 0.06, offsetBalance: 100_000, isInterestOnly: true, resolvedMonthlyRepayment: 500 },
    { principal: 947_076, storedRateAnnual: 0.0649, isInterestOnly: false, resolvedMonthlyRepayment: 6197 },
  ];

  it.each(cases)('parity on %o', (input) => {
    const f = resolveEffectiveLoanRate(input);
    const d = resolveEffectiveLoanRateDecimal(input);
    expect(d.basis).toBe(f.basis);
    expect(d.flags).toEqual(f.flags);
    expect(d.annualRate.toNumber()).toBeCloseTo(f.annualRate, 10);
    expect(d.interestBearingBalance.toNumber()).toBeCloseTo(f.interestBearingBalance, 6);
    if (f.impliedRateAnnual === null) {
      expect(d.impliedRateAnnual).toBeNull();
      expect(d.divergencePp).toBeNull();
    } else {
      expect(d.impliedRateAnnual!.toNumber()).toBeCloseTo(f.impliedRateAnnual, 10);
      expect(d.divergencePp!.toNumber()).toBeCloseTo(f.divergencePp!, 8);
    }
  });
});
