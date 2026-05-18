/**
 * Phase 42 PR5 + PR5.5 — Tax Pack export API.
 *
 *   GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=csv|xlsx|json|pdf|zip
 *
 * The LOAD-BEARING handoff endpoint. The accountant downloads from
 * here and imports straight into Xero (CSV) or opens the per-property
 * P&L workbook (XLSX) or consumes the structured JSON for further
 * automation. End-of-FY, the user grabs the PDF summary + the receipt
 * ZIP and forwards both to the accountant.
 *
 * Per CLAUDE.md §1 hard rule (Phase 42 spec):
 *   "Monitrax produces the personal tax pack. Xero stays the
 *    accountant tool."
 *
 * This endpoint is the production artefact of that contract.
 *
 * Format support:
 *   - csv  — Xero bank-statement-import format (LOAD-BEARING)
 *   - xlsx — Per-property P&L workbook + ATO labels + summary
 *   - json — Full structured summary (programmatic consumers)
 *   - pdf  — Human-readable printable summary (PR5.5 — `pdfkit`)
 *   - zip  — Receipt bundle: every Document in the FY window with
 *            category IN (RECEIPT, INVOICE, TAX), foldered by category
 *            (PR5.5 — reuses already-installed `jszip`)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  buildAuFyWindow,
  buildTaxPackSummary,
  fetchTaxPackTransactions,
} from '@/lib/bookkeeping/taxPack/summary';
import {
  renderXeroCsv,
  suggestedXeroFilename,
} from '@/lib/bookkeeping/taxPack/csvExporter';
import {
  buildTaxPackXlsx,
  suggestedXlsxFilename,
} from '@/lib/bookkeeping/taxPack/xlsxExporter';
import {
  buildTaxPackPdf,
  suggestedPdfFilename,
} from '@/lib/bookkeeping/taxPack/pdfExporter';
import {
  buildReceiptZipBundle,
  suggestedZipFilename,
} from '@/lib/bookkeeping/taxPack/zipBundleBuilder';

type Format = 'csv' | 'xlsx' | 'json' | 'pdf' | 'zip';

const SUPPORTED: Format[] = ['csv', 'xlsx', 'json', 'pdf', 'zip'];

export const GET = withPermission('transaction.read', async (request: NextRequest, auth) => {
  const url = new URL(request.url);
  const fy = url.searchParams.get('fy') ?? undefined;
  const formatRaw = (url.searchParams.get('format') ?? 'csv').toLowerCase();
  if (!SUPPORTED.includes(formatRaw as Format)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `format must be one of: ${SUPPORTED.join(', ')}`,
        },
      },
      { status: 400 }
    );
  }
  const format = formatRaw as Format;

  let window;
  try {
    window = buildAuFyWindow(fy);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FY',
          message: err instanceof Error ? err.message : 'Invalid FY',
        },
      },
      { status: 400 }
    );
  }

  // CSV path is cheap — just transactions; no summary aggregation.
  if (format === 'csv') {
    const transactions = await fetchTaxPackTransactions(auth.userId, window);
    const csv = renderXeroCsv(transactions);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${suggestedXeroFilename().replace('.csv', `-${window.label.toLowerCase()}.csv`)}"`,
        'X-Monitrax-FY': window.label,
        'X-Monitrax-Tx-Count': String(transactions.length),
      },
    });
  }

  // ZIP path doesn't need the financial summary — just documents.
  if (format === 'zip') {
    const bundle = await buildReceiptZipBundle(auth.userId, window);
    const ab = new ArrayBuffer(bundle.bytes.byteLength);
    new Uint8Array(ab).set(bundle.bytes);
    const blob = new Blob([ab], { type: 'application/zip' });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${suggestedZipFilename(window.label)}"`,
        'X-Monitrax-FY': window.label,
        'X-Monitrax-Doc-Count': String(bundle.documentCount),
        'X-Monitrax-Doc-Missing': String(bundle.missingCount),
      },
    });
  }

  // XLSX + JSON + PDF all need the full summary.
  const summary = await buildTaxPackSummary(auth.userId, window);

  if (format === 'xlsx') {
    const buffer = buildTaxPackXlsx(summary);
    // Copy Buffer into a fresh ArrayBuffer (typed-array compat) +
    // wrap as a Blob — this is the canonical BodyInit shape for
    // NextResponse and matches how `lib/reports/exporters/xlsx.ts`
    // (Phase 16) feeds binary downloads.
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    const blob = new Blob([ab], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${suggestedXlsxFilename(window.label)}"`,
        'X-Monitrax-FY': window.label,
        'X-Monitrax-Property-Count': String(summary.perProperty.length),
      },
    });
  }

  if (format === 'pdf') {
    const buffer = await buildTaxPackPdf(summary);
    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);
    const blob = new Blob([ab], { type: 'application/pdf' });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${suggestedPdfFilename(window.label)}"`,
        'X-Monitrax-FY': window.label,
        'X-Monitrax-Property-Count': String(summary.perProperty.length),
      },
    });
  }

  // format === 'json'
  return NextResponse.json({ success: true, data: summary });
});
