/**
 * Phase 42 PR3 — Tests for the receipt matcher.
 *
 * The matcher is the single source of truth for "is this receipt the
 * same as that bank transaction?". The thresholds (signed off in spec
 * §3 D-42-7) are pinned here. If any threshold weakens, these tests
 * fire — and the user-facing UX changes (auto-link vs picker vs
 * synthesize) shift in step.
 *
 * Pure helpers only — DB-touching `findReceiptMatches()` is integration-
 * tested elsewhere.
 */

import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  scoreDate,
  scoreAmount,
  levenshtein,
  vendorSimilarity,
  compositeScore,
  scoreCandidate,
  RECEIPT_DATE_WINDOW_DAYS,
  RECEIPT_AMOUNT_TOLERANCE_ABS,
  RECEIPT_AMOUNT_TOLERANCE_RELATIVE,
  RECEIPT_AUTO_LINK_THRESHOLD,
  RECEIPT_PICKER_THRESHOLD,
} from '../../lib/bookkeeping/receiptMatcher';

describe('thresholds (signed off in spec §3 D-42-7)', () => {
  it('date window is 3 days', () => {
    expect(RECEIPT_DATE_WINDOW_DAYS).toBe(3);
  });
  it('absolute amount tolerance is $0.50', () => {
    expect(RECEIPT_AMOUNT_TOLERANCE_ABS).toBe(0.5);
  });
  it('relative amount tolerance is 0.5%', () => {
    expect(RECEIPT_AMOUNT_TOLERANCE_RELATIVE).toBe(0.005);
  });
  it('auto-link threshold is 0.95', () => {
    expect(RECEIPT_AUTO_LINK_THRESHOLD).toBe(0.95);
  });
  it('picker threshold is 0.7', () => {
    expect(RECEIPT_PICKER_THRESHOLD).toBe(0.7);
  });
});

describe('daysBetween', () => {
  it('returns 0 for same day (any time-of-day)', () => {
    const morning = new Date('2026-10-22T08:00:00Z');
    const evening = new Date('2026-10-22T20:00:00Z');
    expect(daysBetween(morning, evening)).toBe(0);
  });
  it('returns 1 for consecutive days', () => {
    expect(daysBetween(new Date('2026-10-22'), new Date('2026-10-23'))).toBe(1);
  });
  it('is symmetric', () => {
    const a = new Date('2026-10-22');
    const b = new Date('2026-10-25');
    expect(daysBetween(a, b)).toBe(daysBetween(b, a));
  });
});

describe('scoreDate', () => {
  it('returns 1 for same day', () => {
    const d = new Date('2026-10-22');
    expect(scoreDate(d, d)).toBe(1);
  });
  it('decays with distance, reaches 0 outside window', () => {
    const d = new Date('2026-10-22');
    expect(scoreDate(d, new Date('2026-10-23'))).toBeGreaterThan(0.7);
    expect(scoreDate(d, new Date('2026-10-25'))).toBeGreaterThan(0);
    expect(scoreDate(d, new Date('2026-10-26'))).toBe(0);
    expect(scoreDate(d, new Date('2026-10-30'))).toBe(0);
  });
});

describe('scoreAmount', () => {
  it('scores 1 for exact match', () => {
    expect(scoreAmount(42.5, 42.5)).toBe(1);
  });
  it('scores within absolute tolerance', () => {
    expect(scoreAmount(100, 100.4)).toBeGreaterThan(0);
    expect(scoreAmount(100, 100.4)).toBeLessThan(1);
  });
  it('scores 0 outside tolerance', () => {
    // $100 ± max($0.50, 0.5%) = ±$0.50; $101 is way outside
    expect(scoreAmount(100, 101)).toBe(0);
  });
  it('uses the relative tolerance for large amounts', () => {
    // $5000 × 0.5% = $25 — both should score within tolerance
    expect(scoreAmount(5000, 5024)).toBeGreaterThan(0);
    expect(scoreAmount(5000, 5026)).toBe(0);
  });
  it('compares absolute values (sign-agnostic)', () => {
    expect(scoreAmount(100, -100)).toBe(1);
    expect(scoreAmount(-100, 100)).toBe(1);
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('coles', 'coles')).toBe(0);
  });
  it('returns the length of one when other is empty', () => {
    expect(levenshtein('', 'coles')).toBe(5);
    expect(levenshtein('coles', '')).toBe(5);
  });
  it('handles single-character edits', () => {
    expect(levenshtein('coles', 'colas')).toBe(1);
    expect(levenshtein('coles', 'cole')).toBe(1);
    expect(levenshtein('coles', 'colees')).toBe(1);
  });
  it('truncates inputs to 64 chars', () => {
    const a = 'a'.repeat(120);
    const b = 'a'.repeat(120);
    expect(levenshtein(a, b)).toBe(0);
  });
});

describe('vendorSimilarity', () => {
  it('scores 1 for exact match', () => {
    expect(vendorSimilarity('Coles', 'Coles')).toBe(1);
  });
  it('normalises punctuation + casing before comparing', () => {
    expect(vendorSimilarity('COLES SUPERMARKETS', 'coles supermarkets')).toBe(1);
    expect(vendorSimilarity('Coles 1234', 'COLES-1234')).toBe(1);
  });
  it('scores high for near-matches', () => {
    expect(vendorSimilarity('Coles', 'Coles Group')).toBeGreaterThan(0.4);
  });
  it('scores 0 for empty inputs', () => {
    expect(vendorSimilarity(null, 'Coles')).toBe(0);
    expect(vendorSimilarity('Coles', null)).toBe(0);
    expect(vendorSimilarity('', 'Coles')).toBe(0);
    expect(vendorSimilarity(undefined, undefined)).toBe(0);
  });
  it('scores low for unrelated', () => {
    expect(vendorSimilarity('Coles', 'Officeworks')).toBeLessThan(0.5);
  });
});

describe('compositeScore', () => {
  it('weights date most, then amount, then vendor', () => {
    const s = compositeScore({ dateScore: 1, amountScore: 0, vendorScore: 0 });
    expect(s).toBeCloseTo(0.5, 2);
    const a = compositeScore({ dateScore: 0, amountScore: 1, vendorScore: 0 });
    expect(a).toBeCloseTo(0.35, 2);
    const v = compositeScore({ dateScore: 0, amountScore: 0, vendorScore: 1 });
    expect(v).toBeCloseTo(0.15, 2);
  });
  it('forces composite ≥ 0.95 when same-day + exact-amount (override)', () => {
    // Even with vendor 0, the strong-signal override kicks in
    const s = compositeScore({ dateScore: 1, amountScore: 1, vendorScore: 0 });
    expect(s).toBeGreaterThanOrEqual(0.95);
  });
  it('does NOT override when only one signal is strong', () => {
    const s = compositeScore({ dateScore: 1, amountScore: 0, vendorScore: 0 });
    expect(s).toBeLessThan(0.95);
  });
});

describe('scoreCandidate (integration of pure helpers)', () => {
  function tx(over: Partial<{ amount: number; date: Date; merchantStandardised: string | null }>): any {
    return {
      id: 'fake',
      userId: 'u',
      accountId: 'a',
      date: over.date ?? new Date('2026-10-22'),
      amount: over.amount ?? -42.5,
      currency: 'AUD',
      direction: 'OUT',
      merchantStandardised: over.merchantStandardised ?? 'Coles',
      merchantRaw: 'COLES BRUNSWICK',
      description: 'COLES BRUNSWICK',
      // ...other fields irrelevant for scoring
    };
  }

  it('exact same-day, exact-amount, same-vendor → AUTO_LINK grade', () => {
    const score = scoreCandidate(
      { amount: 42.5, date: new Date('2026-10-22'), vendor: 'Coles' },
      tx({})
    );
    expect(score.composite).toBeGreaterThanOrEqual(0.95);
  });

  it('same-day, exact-amount, vendor jitter → still auto-link via override', () => {
    const score = scoreCandidate(
      { amount: 42.5, date: new Date('2026-10-22'), vendor: 'Coles Group Ltd' },
      tx({ merchantStandardised: 'Coles' })
    );
    expect(score.composite).toBeGreaterThanOrEqual(0.95);
  });

  it('+2 days, exact-amount, exact-vendor → picker grade (≥0.7)', () => {
    const score = scoreCandidate(
      { amount: 42.5, date: new Date('2026-10-24'), vendor: 'Coles' },
      tx({ date: new Date('2026-10-22') })
    );
    expect(score.composite).toBeGreaterThanOrEqual(RECEIPT_PICKER_THRESHOLD);
    expect(score.composite).toBeLessThan(RECEIPT_AUTO_LINK_THRESHOLD);
  });

  it('out of window → composite collapses', () => {
    const score = scoreCandidate(
      { amount: 42.5, date: new Date('2026-10-30'), vendor: 'Coles' },
      tx({ date: new Date('2026-10-22') })
    );
    expect(score.composite).toBeLessThan(RECEIPT_PICKER_THRESHOLD);
  });

  it('amount out of tolerance → fails picker threshold', () => {
    const score = scoreCandidate(
      { amount: 100, date: new Date('2026-10-22'), vendor: 'Coles' },
      tx({ amount: -200, date: new Date('2026-10-22') })
    );
    expect(score.composite).toBeLessThan(RECEIPT_PICKER_THRESHOLD);
  });
});
