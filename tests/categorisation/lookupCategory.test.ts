/**
 * Phase 52 — shared-KB lookup gating tests. Pins that ONLY graduated
 * (`isGlobal`), confident-enough patterns are ever used as a prior, and that the
 * read path is OFF by default.
 */

import { describe, it, expect } from 'vitest';
import {
  interpretSignature,
  lookupSharedCategory,
  KB_READ_ENABLED,
  KB_MIN_CONFIDENCE,
} from '@/lib/categorisation/kb/lookupCategory';

const sig = (over: Partial<Parameters<typeof interpretSignature>[0] & object> = {}) => ({
  pattern: 'WOOLWORTHS',
  topCategory: 'Groceries',
  confidence: 0.92,
  distinctUserCount: 40,
  isGlobal: true,
  ...over,
});

describe('interpretSignature — gating', () => {
  it('returns a match for a graduated, confident signature', () => {
    expect(interpretSignature(sig())).toEqual({
      pattern: 'WOOLWORTHS',
      category: 'Groceries',
      confidence: 0.92,
      distinctUserCount: 40,
    });
  });
  it('rejects a NON-graduated pattern (below k → not shared)', () => {
    expect(interpretSignature(sig({ isGlobal: false }))).toBeNull();
  });
  it('rejects a low-confidence pattern (community disagreement)', () => {
    expect(interpretSignature(sig({ confidence: KB_MIN_CONFIDENCE - 0.05 }))).toBeNull();
  });
  it('rejects a signature with no topCategory', () => {
    expect(interpretSignature(sig({ topCategory: null }))).toBeNull();
  });
  it('rejects null (no signature found)', () => {
    expect(interpretSignature(null)).toBeNull();
  });
  it('respects a custom confidence floor', () => {
    expect(interpretSignature(sig({ confidence: 0.7 }), 0.8)).toBeNull();
    expect(interpretSignature(sig({ confidence: 0.85 }), 0.8)).not.toBeNull();
  });
});

describe('lookupSharedCategory — read gate', () => {
  it('is OFF by default (returns null without a DB hit)', async () => {
    expect(KB_READ_ENABLED).toBe(false);
    expect(await lookupSharedCategory('WOOLWORTHS 1234')).toBeNull();
  });
});
