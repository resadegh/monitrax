/**
 * Phase 50 (Unified Accountant Pack) — 2026-06-19.
 *
 * The "everything my accountant needs, in one download" bundle. Today the
 * tax-pack export ships the *summary* (PDF/XLSX) and the *receipts* (ZIP) as
 * SEPARATE downloads; this marries them into ONE ZIP so the user forwards a
 * single file.
 *
 *   monitrax-tax-pack-fy<label>/
 *     Summary/
 *       Tax-Summary-FY<label>.pdf     (human-readable handoff)
 *       Tax-Summary-FY<label>.xlsx    (per-property P&L + ATO labels)
 *     Receipts/        <date>_<file>  (category RECEIPT)
 *     Invoices/        <date>_<file>  (category INVOICE)
 *     Tax_Documents/   <date>_<file>  (category TAX)
 *     README.txt       (what's inside + the not-tax-advice disclaimer)
 *
 * Per CLAUDE.md §12.1/§12.2/§12.7 — this is an ORCHESTRATION layer only. It
 * reuses the canonical builders verbatim: `buildTaxPackSummary` (aggregation),
 * `buildTaxPackPdf` / `buildTaxPackXlsx` (the same exporters the per-format
 * downloads use), and `addReceiptDocuments` (the shared receipt-foldering
 * helper extracted from `zipBundleBuilder`). No new aggregation, no new export
 * logic, no new ZIP infrastructure (`jszip` is the single approved ZIP lib).
 */

import JSZip from 'jszip';
import {
  buildAuFyWindow,
  buildTaxPackSummary,
  type TaxPackWindow,
} from './summary';
import { buildTaxPackPdf } from './pdfExporter';
import { buildTaxPackXlsx } from './xlsxExporter';
import { addReceiptDocuments } from './zipBundleBuilder';

export interface AccountantPackResult {
  /** The ZIP bytes — caller wraps as Blob + NextResponse. */
  bytes: Uint8Array;
  /** Receipt/invoice/tax documents bundled (excludes missing-content). */
  documentCount: number;
  /** Documents in the window whose bytes could not be fetched. */
  missingCount: number;
  /** Per-property P&L blocks in the summary (surfaced as a response header). */
  propertyCount: number;
}

/** `monitrax-tax-pack-fy2025-26.zip` */
export function suggestedPackFilename(fyLabel: string): string {
  return `monitrax-tax-pack-${fyLabel.toLowerCase()}.zip`;
}

/**
 * Build the unified accountant pack for a user + FY window.
 *
 * Tolerant of individual unfetchable documents (reported via `missingCount`) —
 * the pack still ships with the summary + the rest of the receipts.
 */
export async function buildAccountantPack(
  userId: string,
  window: TaxPackWindow
): Promise<AccountantPackResult> {
  // 1. Aggregate once, then render both summary artefacts from it.
  const summary = await buildTaxPackSummary(userId, window);
  const [pdf, xlsx] = await Promise.all([
    buildTaxPackPdf(summary),
    Promise.resolve(buildTaxPackXlsx(summary)),
  ]);

  const zip = new JSZip();
  const root = zip.folder(`monitrax-tax-pack-${window.label.toLowerCase()}`);
  if (!root) {
    throw new Error('Failed to create root folder in ZIP archive');
  }

  // 2. Summary artefacts.
  root.file(`Summary/Tax-Summary-${window.label}.pdf`, pdf);
  root.file(`Summary/Tax-Summary-${window.label}.xlsx`, xlsx);

  // 3. Supporting receipts (shared foldering helper — SSOT).
  const gather = await addReceiptDocuments(root, userId, window);

  // 4. Plain-text index for the accountant.
  root.file('README.txt', buildPackReadme(window, summary.perProperty.length, gather));

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    bytes,
    documentCount: gather.total - gather.missingCount,
    missingCount: gather.missingCount,
    propertyCount: summary.perProperty.length,
  };
}

/** Convenience: build straight from an FY string (or current FY when omitted). */
export async function buildAccountantPackForFy(
  userId: string,
  fy?: string
): Promise<{ result: AccountantPackResult; window: TaxPackWindow }> {
  const window = buildAuFyWindow(fy);
  const result = await buildAccountantPack(userId, window);
  return { result, window };
}

function buildPackReadme(
  window: TaxPackWindow,
  propertyCount: number,
  gather: { total: number; countByFolder: Record<string, number>; missingCount: number }
): string {
  const generated = new Date().toISOString();
  const folderLines = Object.entries(gather.countByFolder)
    .map(([folder, count]) => `  ${folder}: ${count}`)
    .join('\n');
  return [
    'Monitrax Tax Pack — Accountant bundle',
    `FY: ${window.label}`,
    `Window: ${window.start.toISOString().slice(0, 10)} -> ${window.end.toISOString().slice(0, 10)}`,
    `Generated: ${generated}`,
    '',
    'Inside this bundle:',
    '  Summary/',
    `    Tax-Summary-${window.label}.pdf   - human-readable summary (income, expenses, ATO labels)`,
    `    Tax-Summary-${window.label}.xlsx  - per-property P&L workbook (${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'})`,
    '  Supporting documents:',
    folderLines,
    '',
    `Documents in window: ${gather.total} (bundled ${gather.total - gather.missingCount}, unavailable ${gather.missingCount})`,
    '',
    'This bundle is a data summary produced by Monitrax. It is NOT tax advice.',
    'Your registered tax agent confirms deductibility, applies depreciation',
    'rates, and reconciles against statutory records. Monitrax is the user-side',
    'tool; Xero / your accountant remain the authoritative bookkeeping system.',
    '',
  ].join('\n');
}
