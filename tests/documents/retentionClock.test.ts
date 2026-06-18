/**
 * Phase 50 D.5b — retentionClock unit tests.
 *
 * Pins the ATO 5-year clock (5 years after the END of the document's financial
 * year), the conservative category gating, and the advisory-only contract.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRetentionStatus,
  extractDocumentDate,
  ATO_RETENTION_YEARS,
} from '@/lib/documents/intelligence/retentionClock';

const NOW = new Date('2026-06-18T00:00:00Z');

describe('computeRetentionStatus', () => {
  it('gives NO_CLOCK for non-tax-substantiation categories', () => {
    for (const cat of ['CONTRACT', 'LEASE', 'INSURANCE', 'MORTGAGE', 'PDS', 'VALUATION', 'OTHER']) {
      const v = computeRetentionStatus('2010-01-01', cat, NOW);
      expect(v.status).toBe('NO_CLOCK');
      expect(v.retainUntil).toBeUndefined();
    }
  });

  it('RETAINs a recent receipt and reports the close date (5y after FY end)', () => {
    // 2025-08-10 → FY ends 30 Jun 2026 → retainUntil 30 Jun 2031.
    const v = computeRetentionStatus('2025-08-10', 'RECEIPT', NOW);
    expect(v.status).toBe('RETAIN');
    expect(v.retainUntil?.slice(0, 10)).toBe('2031-06-30');
  });

  it('marks an old invoice ARCHIVE_SAFE once the window has closed', () => {
    // 2018-03-01 → FY ends 30 Jun 2018 → retainUntil 30 Jun 2023 (past NOW).
    const v = computeRetentionStatus('2018-03-01', 'INVOICE', NOW);
    expect(v.status).toBe('ARCHIVE_SAFE');
    expect(v.retainUntil?.slice(0, 10)).toBe('2023-06-30');
    expect(v.label).toBe('Safe to archive');
  });

  it('puts a Jul–Dec date in the NEXT financial year', () => {
    // 2017-12-01 → FY ends 30 Jun 2018 → retainUntil 30 Jun 2023.
    const v = computeRetentionStatus('2017-12-01', 'TAX', NOW);
    expect(v.retainUntil?.slice(0, 10)).toBe('2023-06-30');
  });

  it('is exactly on the boundary: the close date itself still RETAINs', () => {
    // retainUntil 30 Jun 2026; NOW 18 Jun 2026 → not past → RETAIN.
    const v = computeRetentionStatus('2020-09-01', 'STATEMENT', NOW);
    expect(v.retainUntil?.slice(0, 10)).toBe('2026-06-30');
    expect(v.status).toBe('RETAIN');
  });

  it('NO_CLOCK when the date is missing or invalid (never guesses)', () => {
    expect(computeRetentionStatus(null, 'RECEIPT', NOW).status).toBe('NO_CLOCK');
    expect(computeRetentionStatus('not-a-date', 'RECEIPT', NOW).status).toBe('NO_CLOCK');
  });

  it('exposes the canonical retention window', () => {
    expect(ATO_RETENTION_YEARS).toBe(5);
  });
});

describe('extractDocumentDate', () => {
  it('unwraps the {value, confidence} ExtractedField shape', () => {
    const d = extractDocumentDate({ date: { value: '2024-05-01', confidence: 0.9 } });
    expect(d?.toISOString().slice(0, 10)).toBe('2024-05-01');
  });

  it('reads plain string dates and the alternate keys', () => {
    expect(extractDocumentDate({ issueDate: '2023-01-15' })?.toISOString().slice(0, 10)).toBe(
      '2023-01-15',
    );
    expect(extractDocumentDate({ invoiceDate: '2022-11-30' })?.toISOString().slice(0, 10)).toBe(
      '2022-11-30',
    );
  });

  it('returns null when nothing usable is present', () => {
    expect(extractDocumentDate({ amount: 10 })).toBeNull();
    expect(extractDocumentDate(null)).toBeNull();
    expect(extractDocumentDate({ date: 'nope' })).toBeNull();
  });
});
