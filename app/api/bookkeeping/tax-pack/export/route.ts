/**
 * Phase 42 PR5 — Tax Pack export API.
 *
 *   GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=csv|xlsx|json
 *
 * The LOAD-BEARING handoff endpoint. The accountant downloads from
 * here and imports straight into Xero (CSV) or opens the per-property
 * P&L workbook (XLSX) or consumes the structured JSON for further
 * automation.
 *
 * Per CLAUDE.md §1 hard rule (Phase 42 spec):
 *   "Monitrax produces the personal tax pack. Xero stays the
 *    accountant tool."
 *
 * This endpoint is the production artefact of that contract.
 *
 * Format support at v1:
 *   - csv  — Xero bank-statement-import format (LOAD-BEARING)
 *   - xlsx — Per-property P&L workbook + ATO labels + summary
 *   - json — Full structured summary (programmatic consumers)
 *
 * Deferred to PR5.5: pdf (needs `pdfkit`), zip (receipt bundle —
 * needs `archiver`).
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

type Format = 'csv' | 'xlsx' | 'json';

const SUPPORTED: Format[] = ['csv', 'xlsx', 'json'];

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

  // Both XLSX + JSON need the full summary.
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

  // format === 'json'
  return NextResponse.json({ success: true, data: summary });
});
