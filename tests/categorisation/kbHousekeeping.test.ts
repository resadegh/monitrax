/**
 * Phase 52 — KB housekeeping predicate tests. Pins that graduated/near-k/recent
 * patterns are NEVER pruned and only stale low-value provisionals are.
 */

import { describe, it, expect } from 'vitest';
import { isStaleProvisional, KB_STALE_PROVISIONAL_MONTHS } from '@/lib/categorisation/kb/housekeeping';
import { KB_GRADUATION_K } from '@/lib/categorisation/kb/recordContribution';

const NOW = new Date('2026-06-22T00:00:00Z');
const monthsAgo = (n: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - n);
  return d;
};

describe('isStaleProvisional', () => {
  it('prunes a stale, sub-k, never-reinforced provisional', () => {
    expect(
      isStaleProvisional({ isGlobal: false, distinctUserCount: 1, lastConfirmedAt: monthsAgo(KB_STALE_PROVISIONAL_MONTHS + 1) }, NOW)
    ).toBe(true);
  });
  it('KEEPS a graduated (global) pattern however old', () => {
    expect(
      isStaleProvisional({ isGlobal: true, distinctUserCount: 50, lastConfirmedAt: monthsAgo(36) }, NOW)
    ).toBe(false);
  });
  it('KEEPS a provisional at/over the k threshold (about to graduate)', () => {
    expect(
      isStaleProvisional({ isGlobal: false, distinctUserCount: KB_GRADUATION_K, lastConfirmedAt: monthsAgo(36) }, NOW)
    ).toBe(false);
  });
  it('KEEPS a recently-reinforced provisional', () => {
    expect(
      isStaleProvisional({ isGlobal: false, distinctUserCount: 2, lastConfirmedAt: monthsAgo(1) }, NOW)
    ).toBe(false);
  });
});
