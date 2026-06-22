/**
 * Phase 52 — category-path codec tests. The write side encodes the 3-level
 * category into one KB key; the read side decodes it back. Must round-trip.
 */

import { describe, it, expect } from 'vitest';
import { encodeCategoryPath, decodeCategoryPath } from '@/lib/categorisation/kb/categoryPath';

describe('category-path codec', () => {
  it('round-trips a full 3-level path', () => {
    const p = encodeCategoryPath('Food & Dining', 'Groceries', 'Supermarket');
    expect(decodeCategoryPath(p)).toEqual({ level1: 'Food & Dining', level2: 'Groceries', subcategory: 'Supermarket' });
  });
  it('round-trips level1 only (nulls preserved)', () => {
    const p = encodeCategoryPath('Transport');
    expect(decodeCategoryPath(p)).toEqual({ level1: 'Transport', level2: null, subcategory: null });
  });
  it('round-trips level1 + level2', () => {
    const p = encodeCategoryPath('Housing', 'Utilities', null);
    expect(decodeCategoryPath(p)).toEqual({ level1: 'Housing', level2: 'Utilities', subcategory: null });
  });
  it('decodes an empty/garbage path to a safe Other', () => {
    expect(decodeCategoryPath('')).toEqual({ level1: 'Other', level2: null, subcategory: null });
  });
});
