/**
 * Phase 52.5c — legacy-code ↔ canonical-hierarchy bridge tests.
 *
 * The Link / reconciliation dialog speaks legacy flat codes (GROCERIES, SALARY);
 * the KB + canonical registry speak the 3-level hierarchy (Food & Dining > Groceries).
 * The bridge must map codes → triples deterministically (so KB votes don't fragment)
 * and map canonical answers back to a code the dialog's CategorySelect understands.
 */

import { describe, it, expect } from 'vitest';
import {
  legacyCodeToCanonical,
  canonicalToLegacyCode,
} from '@/lib/categorisation/kb/categoryBridge';

describe('categoryBridge — legacyCodeToCanonical', () => {
  it('maps a two-level expense code', () => {
    expect(legacyCodeToCanonical('GROCERIES', 'OUT')).toEqual({
      level1: 'Food & Dining',
      level2: 'Groceries',
      subcategory: null,
    });
  });

  it('maps a level1-only expense code', () => {
    expect(legacyCodeToCanonical('TRANSPORT', 'OUT')).toEqual({
      level1: 'Transport',
      level2: null,
      subcategory: null,
    });
  });

  it('maps income codes under the Income level1', () => {
    expect(legacyCodeToCanonical('SALARY', 'IN')).toEqual({
      level1: 'Income',
      level2: 'Salary',
      subcategory: null,
    });
  });

  it('is case/whitespace tolerant', () => {
    expect(legacyCodeToCanonical(' groceries ', 'OUT')?.level2).toBe('Groceries');
  });

  it('returns null for unknown / custom codes (kept out of the shared KB)', () => {
    expect(legacyCodeToCanonical('PET_CARE_CUSTOM_UUID', 'OUT')).toBeNull();
    expect(legacyCodeToCanonical(null, 'OUT')).toBeNull();
    expect(legacyCodeToCanonical('', 'OUT')).toBeNull();
  });

  it('uses the direction-correct table (OTHER differs by direction)', () => {
    expect(legacyCodeToCanonical('OTHER', 'OUT')).toEqual({
      level1: 'Other',
      level2: null,
      subcategory: null,
    });
    expect(legacyCodeToCanonical('OTHER', 'IN')).toEqual({
      level1: 'Income',
      level2: 'Other Income',
      subcategory: null,
    });
  });
});

describe('categoryBridge — canonicalToLegacyCode (read path)', () => {
  it('exact (level1, level2) match wins', () => {
    expect(canonicalToLegacyCode('Food & Dining', 'Groceries', 'OUT')).toBe('GROCERIES');
  });

  it('falls back to level1-only when the pair is unknown', () => {
    // Food & Dining > Restaurants has no dedicated code → coarser FOOD.
    expect(canonicalToLegacyCode('Food & Dining', 'Restaurants', 'OUT')).toBe('FOOD');
  });

  it('falls back to OTHER for an unknown level1', () => {
    expect(canonicalToLegacyCode('Nonexistent', 'Whatever', 'OUT')).toBe('OTHER');
    expect(canonicalToLegacyCode(null, null, 'OUT')).toBe('OTHER');
  });

  it('maps income canonical back to an income code', () => {
    expect(canonicalToLegacyCode('Income', 'Salary', 'IN')).toBe('SALARY');
  });

  it('round-trips the common two-level expense codes', () => {
    for (const code of ['GROCERIES', 'LOAN_INTEREST', 'STRATA', 'RATES']) {
      const c = legacyCodeToCanonical(code, 'OUT')!;
      expect(canonicalToLegacyCode(c.level1, c.level2, 'OUT')).toBe(code);
    }
  });
});
