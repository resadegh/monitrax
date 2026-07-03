/**
 * MON-009 — canonical monthly resolver (§19.2 worked examples).
 *
 * Proves the universal rule: any money line (rent / expense / loan repayment)
 * resolves to a TRUE monthly figure read from the transaction DATES, correct
 * for any cadence — fortnightly, twice-a-month, quarterly — and falling back to
 * the declared frequency when the cadence can't be read (0 or 1 tx).
 */

import { describe, it, expect } from 'vitest';
import {
  resolveMonthly,
  daySpanMonthlyAverage,
  detectFrequency,
  DAYS_PER_MONTH,
} from '../../lib/calculations/monthlyResolver';

// Build N transactions `intervalDays` apart, each `amount`, starting 2026-01-01.
function stream(amount: number, intervalDays: number, count: number) {
  const start = Date.parse('2026-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(start + i * intervalDays * 86_400_000),
    amount,
  }));
}

describe('resolveMonthly — cadence read from dates', () => {
  it('FORTNIGHTLY rent → true monthly rate (~$2,598 for $1,195/14d)', () => {
    const r = resolveMonthly({ declaredMonthly: 1195, transactions: stream(1195, 14, 6) });
    // 1195 / 14 × 30.4375 = 2598.0
    expect(r.monthly).toBeCloseTo((1195 / 14) * DAYS_PER_MONTH, 1);
    expect(r.monthly).toBeGreaterThan(2500);
    expect(r.basis).toBe('actual');
    expect(r.detectedFrequency).toBe('FORTNIGHTLY');
  });

  it('TWO repayments in a month (~15d apart) → ~2× the single payment', () => {
    const r = resolveMonthly({ declaredMonthly: 500, transactions: stream(500, 15, 6) });
    // 500 / 15 × 30.4375 ≈ 1014.6 — i.e. roughly two $500 payments per month
    expect(r.monthly).toBeCloseTo((500 / 15) * DAYS_PER_MONTH, 1);
    expect(r.monthly).toBeGreaterThan(950);
    expect(r.detectedFrequency).toBe('FORTNIGHTLY');
  });

  it('QUARTERLY water rate (~91d apart) → ~1/3 of the payment per month', () => {
    const r = resolveMonthly({ declaredMonthly: 100, transactions: stream(300, 91, 4) });
    // 300 / 91 × 30.4375 ≈ 100.3
    expect(r.monthly).toBeCloseTo((300 / 91) * DAYS_PER_MONTH, 1);
    expect(r.monthly).toBeGreaterThan(95);
    expect(r.monthly).toBeLessThan(105);
    expect(r.detectedFrequency).toBe('QUARTERLY');
  });

  it('rent paid in ADVANCE drops the trailing part-period, same rate', () => {
    const arrears = resolveMonthly({ declaredMonthly: 1195, transactions: stream(1195, 14, 6) });
    const advance = resolveMonthly({ declaredMonthly: 1195, transactions: stream(1195, 14, 6), isAdvance: true });
    expect(advance.monthly).toBeCloseTo(arrears.monthly, 1);
  });
});

describe('resolveMonthly — fallbacks when cadence is unknowable', () => {
  it('ONE quarterly payment → normalise the ACTUAL amount by the DECLARED freq (not monthly)', () => {
    const r = resolveMonthly({
      declaredMonthly: 100,
      cadenceHintFrequency: 'QUARTERLY',
      transactions: stream(300, 0, 1),
    });
    expect(r.monthly).toBeCloseTo(100, 2); // 300 × 4 / 12, NOT 300
    expect(r.basis).toBe('actual');
    expect(r.txCount).toBe(1);
  });

  it('ZERO transactions → the declared monthly plan', () => {
    const r = resolveMonthly({ declaredMonthly: 250, transactions: [] });
    expect(r.monthly).toBe(250);
    expect(r.basis).toBe('declared');
    expect(r.usedActuals).toBe(false);
  });
});

describe('daySpanMonthlyAverage / detectFrequency primitives', () => {
  it('returns null when fewer than 2 usable payments', () => {
    expect(daySpanMonthlyAverage(stream(100, 0, 1))).toBeNull();
    expect(daySpanMonthlyAverage([])).toBeNull();
  });

  it('labels cadence bands', () => {
    expect(detectFrequency(7)).toBe('WEEKLY');
    expect(detectFrequency(14)).toBe('FORTNIGHTLY');
    expect(detectFrequency(30)).toBe('MONTHLY');
    expect(detectFrequency(91)).toBe('QUARTERLY');
    expect(detectFrequency(182)).toBe('HALF_YEARLY');
    expect(detectFrequency(365)).toBe('ANNUAL');
    expect(detectFrequency(null)).toBeNull();
  });
});
