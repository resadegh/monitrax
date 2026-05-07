/**
 * Phase 42 PR4 — Tests for the import sanity-check + dedup-preview
 * helpers. Both are pure data-in / data-out; integration with the
 * batch-import API is tested elsewhere.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBalanceSanityCheck,
  computeDedupPreview,
  BALANCE_SANITY_EPSILON,
  type DedupPreviewCandidate,
  type DedupPreviewExisting,
} from '../../lib/bookkeeping/importSanity';

describe('computeBalanceSanityCheck', () => {
  it('returns ran=false when openingBalance is missing', () => {
    const r = computeBalanceSanityCheck({ openingBalance: null, closingBalance: 1000, importedSum: 0 });
    expect(r.ran).toBe(false);
    expect(r.hasGap).toBe(false);
    expect(r.message).toBeNull();
  });
  it('returns ran=false when closingBalance is missing', () => {
    const r = computeBalanceSanityCheck({ openingBalance: 1000, closingBalance: null, importedSum: 0 });
    expect(r.ran).toBe(false);
  });
  it('returns no-gap when balanced', () => {
    // Started $1000, $200 spent, closed $800
    const r = computeBalanceSanityCheck({ openingBalance: 1000, closingBalance: 800, importedSum: -200 });
    expect(r.ran).toBe(true);
    expect(r.hasGap).toBe(false);
    expect(r.gap).toBe(0);
    expect(r.expectedClosing).toBe(800);
  });
  it('returns no-gap inside the $0.50 tolerance (cents rounding)', () => {
    const r = computeBalanceSanityCheck({ openingBalance: 1000, closingBalance: 800.4, importedSum: -200 });
    expect(r.hasGap).toBe(false);
  });
  it('reports a positive gap (missing transaction)', () => {
    // Started $1000, imported only $-100, closing says $800 → $100 missing OUT
    const r = computeBalanceSanityCheck({ openingBalance: 1000, closingBalance: 800, importedSum: -100 });
    expect(r.hasGap).toBe(true);
    // closing - expected = 800 - (1000 - 100) = 800 - 900 = -100
    expect(r.gap).toBe(-100);
    expect(r.message).toContain('100.00');
    expect(r.message?.toLowerCase()).toContain('duplicate');
  });
  it('reports a negative gap (extra row)', () => {
    // Started $1000, imported $-300, closing says $800 → $100 extra OUT
    const r = computeBalanceSanityCheck({ openingBalance: 1000, closingBalance: 800, importedSum: -300 });
    expect(r.hasGap).toBe(true);
    // closing - expected = 800 - (1000 - 300) = 100 (positive)
    expect(r.gap).toBe(100);
    expect(r.message?.toLowerCase()).toContain("didn't catch");
  });
  it('handles zero-amount imports', () => {
    const r = computeBalanceSanityCheck({ openingBalance: 0, closingBalance: 0, importedSum: 0 });
    expect(r.ran).toBe(true);
    expect(r.hasGap).toBe(false);
  });
});

describe('BALANCE_SANITY_EPSILON', () => {
  it('is $0.50', () => {
    expect(BALANCE_SANITY_EPSILON).toBe(0.5);
  });
});

describe('computeDedupPreview', () => {
  function existing(over: Partial<DedupPreviewExisting>): DedupPreviewExisting {
    return {
      id: 'e-1',
      accountId: 'acc-1',
      date: new Date('2026-10-22'),
      amount: -42.5,
      description: 'COLES BRUNSWICK',
      merchantStandardised: 'Coles',
      source: 'QIF',
      ...over,
    };
  }
  function candidate(over: Partial<DedupPreviewCandidate>): DedupPreviewCandidate {
    return {
      date: new Date('2026-10-22'),
      amount: -42.5,
      description: 'COLES BRUNSWICK',
      merchantStandardised: 'Coles',
      source: 'QIF',
      ...over,
    };
  }

  it('flags exact-match candidates as duplicates', () => {
    const r = computeDedupPreview([candidate({})], [existing({})], 'acc-1');
    expect(r.totalCandidates).toBe(1);
    expect(r.duplicateCount).toBe(1);
    expect(r.newCount).toBe(0);
    expect(r.sample).toHaveLength(1);
  });

  it('flags time-of-day-different but same UTC-day as duplicates', () => {
    const r = computeDedupPreview(
      [candidate({ date: new Date('2026-10-22T18:00:00Z') })],
      [existing({ date: new Date('2026-10-22T08:00:00Z') })],
      'acc-1'
    );
    expect(r.duplicateCount).toBe(1);
  });

  it('does NOT flag rows on a different account', () => {
    const r = computeDedupPreview([candidate({})], [existing({ accountId: 'acc-2' })], 'acc-1');
    expect(r.duplicateCount).toBe(0);
    expect(r.newCount).toBe(1);
  });

  it('does NOT flag rows with different amounts', () => {
    const r = computeDedupPreview([candidate({ amount: -42.49 })], [existing({})], 'acc-1');
    // Amount delta of $0.01 is enough to bust the dedup hash
    expect(r.duplicateCount).toBe(0);
  });

  it('does NOT include BASIQ rows (they have their own canonical key)', () => {
    const r = computeDedupPreview([candidate({})], [existing({ source: 'BASIQ' })], 'acc-1');
    expect(r.duplicateCount).toBe(0);
  });

  it('does NOT include MANUAL candidates (out of dedup scope)', () => {
    const r = computeDedupPreview([candidate({ source: 'MANUAL' })], [existing({})], 'acc-1');
    expect(r.duplicateCount).toBe(0);
  });

  it('limits the sample to 5 matches even at high volumes', () => {
    const candidates = Array.from({ length: 12 }, () => candidate({}));
    const r = computeDedupPreview(candidates, [existing({})], 'acc-1');
    expect(r.duplicateCount).toBe(12);
    expect(r.sample.length).toBe(5);
  });

  it('returns zeros when no existing rows', () => {
    const r = computeDedupPreview([candidate({})], [], 'acc-1');
    expect(r.duplicateCount).toBe(0);
    expect(r.newCount).toBe(1);
  });
});
