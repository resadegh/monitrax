/**
 * Phase 42 PR4 — Tests for the MCC catalog.
 *
 * The catalog is the self-hosted substitute for BASIQ's MCC
 * enrichment. ~50 AU merchants. Lookup is substring-on-normalised-
 * merchant; this file pins the most-trafficked patterns so a
 * regression in normalisation OR pattern wording surfaces here.
 */

import { describe, it, expect } from 'vitest';
import {
  lookupMCC,
  getMccEntry,
  normaliseMerchantForMcc,
  MCC_CATALOG_READONLY,
} from '../../lib/bank/mccCatalog';

describe('normaliseMerchantForMcc', () => {
  it('lowercases', () => {
    expect(normaliseMerchantForMcc('COLES')).toBe('coles');
  });
  it('collapses non-alphanumeric runs', () => {
    expect(normaliseMerchantForMcc('Coles 1234 BRUNSWICK')).toBe('coles 1234 brunswick');
  });
  it('handles null + empty + undefined', () => {
    expect(normaliseMerchantForMcc(null)).toBe('');
    expect(normaliseMerchantForMcc(undefined)).toBe('');
    expect(normaliseMerchantForMcc('')).toBe('');
  });
});

describe('lookupMCC — high-volume AU merchants', () => {
  it('Coles → 5411 (grocery)', () => {
    expect(lookupMCC('COLES BRUNSWICK')?.mcc).toBe('5411');
    expect(lookupMCC('Coles 1234')?.mcc).toBe('5411');
    expect(lookupMCC('coles supermarkets pty ltd')?.mcc).toBe('5411');
  });
  it('Woolworths → 5411 (grocery)', () => {
    expect(lookupMCC('WOOLWORTHS')?.mcc).toBe('5411');
    expect(lookupMCC('Woolies Carlton')?.mcc).toBe('5411');
  });
  it('Bunnings → 5200 (hardware)', () => {
    expect(lookupMCC('BUNNINGS WAREHOUSE')?.mcc).toBe('5200');
  });
  it('Officeworks → 5943 (office supplies)', () => {
    expect(lookupMCC('Officeworks Carlton')?.mcc).toBe('5943');
  });
  it('AGL → 4900 (utilities)', () => {
    expect(lookupMCC('AGL Energy')?.mcc).toBe('4900');
  });
  it('Telstra → 4814 (telecom)', () => {
    expect(lookupMCC('TELSTRA POSTPAID')?.mcc).toBe('4814');
  });
  it('Netflix → 4899 (streaming)', () => {
    expect(lookupMCC('Netflix')?.mcc).toBe('4899');
  });
  it('Uber → 4121 (rideshare)', () => {
    expect(lookupMCC('UBER BV')?.mcc).toBe('4121');
    expect(lookupMCC('uber au')?.mcc).toBe('4121');
  });
  it('Uber Eats → 5814 (food delivery; NOT 4121)', () => {
    // The "uber eats" pattern must come BEFORE plain "uber " in the
    // catalog so this case doesn't get mis-categorised.
    expect(lookupMCC('UBER EATS')?.mcc).toBe('5814');
  });
  it('Chemist Warehouse → 5912 (pharmacy)', () => {
    expect(lookupMCC('CHEMIST WAREHOUSE Carlton')?.mcc).toBe('5912');
  });
  it('ATO → 9311 (tax / government)', () => {
    expect(lookupMCC('ATO refund')?.mcc).toBe('9311');
  });
});

describe('lookupMCC — misses', () => {
  it('returns null for unknown merchants', () => {
    expect(lookupMCC('BOB SMITH PAYMENT REFERENCE 1234')).toBeNull();
    expect(lookupMCC('TRANSFER FROM SAV-1234')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(lookupMCC('')).toBeNull();
    expect(lookupMCC(null)).toBeNull();
    expect(lookupMCC(undefined)).toBeNull();
  });
});

describe('getMccEntry — direct key lookup', () => {
  it('finds by canonical key', () => {
    expect(getMccEntry('coles')?.label).toBe('Coles');
    expect(getMccEntry('bunnings')?.label).toBe('Bunnings');
  });
  it('returns null for unknown key', () => {
    expect(getMccEntry('not-a-real-merchant')).toBeNull();
  });
});

describe('catalog hygiene', () => {
  it('every entry has a non-empty key + at least one pattern + 4-digit MCC + label', () => {
    for (const entry of MCC_CATALOG_READONLY) {
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.patterns.length).toBeGreaterThan(0);
      expect(entry.mcc).toMatch(/^\d{4}$/);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
  it('all patterns are lowercase', () => {
    for (const entry of MCC_CATALOG_READONLY) {
      for (const pattern of entry.patterns) {
        expect(pattern).toBe(pattern.toLowerCase());
      }
    }
  });
  it('keys are unique', () => {
    const seen = new Set<string>();
    for (const entry of MCC_CATALOG_READONLY) {
      expect(seen.has(entry.key)).toBe(false);
      seen.add(entry.key);
    }
  });
  it('contains at least 40 entries (per spec §4 PR4 target ~50)', () => {
    expect(MCC_CATALOG_READONLY.length).toBeGreaterThanOrEqual(40);
  });
});
