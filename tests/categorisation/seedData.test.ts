/**
 * Phase 52 — seed-data integrity tests. Guards against typos that would create
 * an invalid category or a signature that never matches a real transaction.
 */

import { describe, it, expect } from 'vitest';
import { AU_MERCHANT_SEEDS } from '@/lib/categorisation/kb/seedData';
import { CATEGORY_HIERARCHY } from '@/lib/tie/types';
import { scrubToSignature } from '@/lib/categorisation/kb/scrubSignature';

describe('AU_MERCHANT_SEEDS integrity', () => {
  it('has a meaningful number of seeds', () => {
    expect(AU_MERCHANT_SEEDS.length).toBeGreaterThan(40);
  });

  it('every seed uses a valid level1 + level2 from CATEGORY_HIERARCHY', () => {
    const bad = AU_MERCHANT_SEEDS.filter(
      (s) => !CATEGORY_HIERARCHY[s.level1] || !CATEGORY_HIERARCHY[s.level1].includes(s.level2)
    );
    expect(bad.map((b) => `${b.merchant}:${b.level1}>${b.level2}`)).toEqual([]);
  });

  it('every seed scrubs to a usable signature (none rejected)', () => {
    const rejected = AU_MERCHANT_SEEDS.filter((s) => !scrubToSignature(s.merchant).ok);
    expect(rejected.map((r) => r.merchant)).toEqual([]);
  });

  it('has no duplicate scrubbed patterns', () => {
    const patterns = AU_MERCHANT_SEEDS.map((s) => {
      const r = scrubToSignature(s.merchant);
      return r.ok ? r.pattern : s.merchant;
    });
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});
