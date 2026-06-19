/**
 * Phase 50 — Unified Accountant Pack builder tests.
 *
 * Proves the ORCHESTRATION (the ZIP structure) without a DB fixture: the four
 * canonical dependencies are mocked, and we assert `buildAccountantPack`
 * assembles them into the documented layout (Summary/ PDF+XLSX, receipt
 * folders, README.txt) with the right diagnostic counts. This guards the §12.1
 * "reuse, don't rebuild" contract — if a future change stops reusing the shared
 * builders, these mocks stop being exercised and the structure assertions fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/bookkeeping/taxPack/summary', async () => {
  const actual = await vi.importActual<typeof import('@/lib/bookkeeping/taxPack/summary')>(
    '@/lib/bookkeeping/taxPack/summary'
  );
  return {
    ...actual,
    buildTaxPackSummary: vi.fn(async () => ({ perProperty: [{ name: 'A' }, { name: 'B' }] })),
  };
});
vi.mock('@/lib/bookkeeping/taxPack/pdfExporter', () => ({
  buildTaxPackPdf: vi.fn(async () => Buffer.from('PDF-BYTES')),
}));
vi.mock('@/lib/bookkeeping/taxPack/xlsxExporter', () => ({
  buildTaxPackXlsx: vi.fn(() => Buffer.from('XLSX-BYTES')),
}));
vi.mock('@/lib/bookkeeping/taxPack/zipBundleBuilder', () => ({
  // Mimic the real helper: drop a couple of files into the root + report counts.
  addReceiptDocuments: vi.fn(async (root: JSZip) => {
    root.file('Receipts/2025-08-01_coles.jpg', Buffer.from('R1'));
    root.file('Invoices/2025-09-02_qbe.pdf', Buffer.from('I1'));
    return {
      total: 3,
      countByFolder: { Receipts: 1, Invoices: 1, Tax_Documents: 0 },
      missingCount: 1,
    };
  }),
}));

import {
  buildAccountantPack,
  suggestedPackFilename,
} from '@/lib/bookkeeping/taxPack/accountantPackBuilder';

const FY = { label: 'FY2025-26', start: new Date('2025-07-01T00:00:00Z'), end: new Date('2026-06-30T23:59:59Z') };

describe('suggestedPackFilename', () => {
  it('lowercases the FY into a stable zip name', () => {
    expect(suggestedPackFilename('FY2025-26')).toBe('monitrax-tax-pack-fy2025-26.zip');
  });
});

describe('buildAccountantPack — ZIP assembly', () => {
  let entries: string[];
  let result: Awaited<ReturnType<typeof buildAccountantPack>>;

  beforeEach(async () => {
    result = await buildAccountantPack('user-1', FY);
    const zip = await JSZip.loadAsync(result.bytes);
    entries = Object.keys(zip.files);
  });

  it('includes BOTH summary artefacts under Summary/', () => {
    expect(entries).toContain('monitrax-tax-pack-fy2025-26/Summary/Tax-Summary-FY2025-26.pdf');
    expect(entries).toContain('monitrax-tax-pack-fy2025-26/Summary/Tax-Summary-FY2025-26.xlsx');
  });

  it('includes the receipt documents from the shared helper', () => {
    expect(entries).toContain('monitrax-tax-pack-fy2025-26/Receipts/2025-08-01_coles.jpg');
    expect(entries).toContain('monitrax-tax-pack-fy2025-26/Invoices/2025-09-02_qbe.pdf');
  });

  it('includes a README index', () => {
    expect(entries).toContain('monitrax-tax-pack-fy2025-26/README.txt');
  });

  it('reports counts: bundled = total - missing, property count from the summary', () => {
    expect(result.documentCount).toBe(2); // total 3 - missing 1
    expect(result.missingCount).toBe(1);
    expect(result.propertyCount).toBe(2);
  });

  it('README carries the not-tax-advice disclaimer', async () => {
    const zip = await JSZip.loadAsync(result.bytes);
    const readme = await zip.file('monitrax-tax-pack-fy2025-26/README.txt')!.async('string');
    expect(readme).toContain('NOT tax advice');
    expect(readme).toContain('FY2025-26');
  });
});
