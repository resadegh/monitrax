/**
 * Phase 42 PR5 — Tests for the Tax Pack summary builder helpers.
 *
 * Covers the pure helpers (FY-window math, sheet-name sanitisation).
 * The DB-touching `buildTaxPackSummary()` is integration-tested
 * elsewhere (would need a DB fixture; stubbed for now).
 */

import { describe, it, expect } from 'vitest';
import { buildAuFyWindow, TAX_PACK_DISCLAIMER } from '../../lib/bookkeeping/taxPack/summary';
import { sanitiseSheetName, suggestedXlsxFilename } from '../../lib/bookkeeping/taxPack/xlsxExporter';

describe('buildAuFyWindow', () => {
  it('FY2025-26 is 1 July 2025 → 30 June 2026', () => {
    const w = buildAuFyWindow('FY2025-26');
    expect(w.label).toBe('FY2025-26');
    expect(w.start.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    // 30 June 2026 23:59:59.999
    expect(w.end.getUTCFullYear()).toBe(2026);
    expect(w.end.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(w.end.getUTCDate()).toBe(30);
  });

  it('accepts plain "2025-26"', () => {
    const w = buildAuFyWindow('2025-26');
    expect(w.label).toBe('FY2025-26');
  });

  it('accepts a single year and maps it as the START year', () => {
    const w = buildAuFyWindow('2025');
    expect(w.label).toBe('FY2025-26');
    expect(w.start.getUTCFullYear()).toBe(2025);
    expect(w.end.getUTCFullYear()).toBe(2026);
  });

  it('throws on garbage input', () => {
    expect(() => buildAuFyWindow('not-a-fy')).toThrow();
  });

  it('default (no input) maps the current AU FY based on today', () => {
    const w = buildAuFyWindow();
    // Smoke check: window.start should be 1 July of some year and
    // window.end should be 30 June of the next year.
    expect(w.start.getUTCMonth()).toBe(6);
    expect(w.start.getUTCDate()).toBe(1);
    expect(w.end.getUTCMonth()).toBe(5);
    expect(w.end.getUTCDate()).toBe(30);
    expect(w.end.getUTCFullYear() - w.start.getUTCFullYear()).toBe(1);
  });
});

describe('TAX_PACK_DISCLAIMER', () => {
  it('explicitly distinguishes Monitrax from the accountant + Xero', () => {
    expect(TAX_PACK_DISCLAIMER.toLowerCase()).toContain('not tax advice');
    expect(TAX_PACK_DISCLAIMER.toLowerCase()).toContain('xero');
    expect(TAX_PACK_DISCLAIMER.toLowerCase()).toContain('tax agent');
  });
});

describe('sanitiseSheetName', () => {
  it('strips Excel-banned characters', () => {
    expect(sanitiseSheetName('60 King St / Apt 4')).toBe('60 King St - Apt 4');
    expect(sanitiseSheetName('Property: Foo*Bar')).toBe('Property: Foo-Bar');
    expect(sanitiseSheetName('A?B[C]D')).toBe('A-B-C-D');
  });
  it('truncates to 31 chars (Excel limit)', () => {
    const long = 'a'.repeat(60);
    expect(sanitiseSheetName(long).length).toBe(31);
  });
});

describe('suggestedXlsxFilename', () => {
  it('embeds the FY label in lowercase', () => {
    expect(suggestedXlsxFilename('FY2025-26')).toBe('monitrax-tax-pack-fy2025-26.xlsx');
  });
});
