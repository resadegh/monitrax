/**
 * Phase 42 PR5 — Tests for the Vendor service helpers.
 *
 * Covers the pure helpers (name normalisation, cancel-URL registry).
 * DB-touching `lookupVendor` / `resolveOrCreateVendor` /
 * `getVendorAnnualTotals` are integration-tested elsewhere.
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseVendorName,
  lookupCancelUrl,
  CANCEL_URL_REGISTRY,
} from '../../lib/bookkeeping/vendor';

describe('normaliseVendorName', () => {
  it('lowercases', () => {
    expect(normaliseVendorName('NETFLIX')).toBe('netflix');
  });
  it('collapses non-alphanumeric runs to single spaces', () => {
    expect(normaliseVendorName('Coles 1234 / Brunswick')).toBe('coles 1234 brunswick');
  });
  it('trims', () => {
    expect(normaliseVendorName('   spotify   ')).toBe('spotify');
  });
  it('returns empty string for empty input', () => {
    expect(normaliseVendorName('')).toBe('');
  });
});

describe('lookupCancelUrl + CANCEL_URL_REGISTRY', () => {
  it('returns a Netflix URL for the netflix key', () => {
    expect(lookupCancelUrl('netflix')).toContain('netflix.com');
  });
  it('returns null for an unknown key', () => {
    expect(lookupCancelUrl('made-up-vendor-1234')).toBeNull();
  });
  it('every entry in the registry is an https URL', () => {
    for (const [key, url] of Object.entries(CANCEL_URL_REGISTRY)) {
      expect(key).toBe(key.toLowerCase());
      expect(url.startsWith('https://')).toBe(true);
    }
  });
  it('contains at least 10 high-volume AU subscriptions', () => {
    expect(Object.keys(CANCEL_URL_REGISTRY).length).toBeGreaterThanOrEqual(10);
  });
});
