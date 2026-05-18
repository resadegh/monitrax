'use client';

/**
 * Phase 42 PR 5.6 + PR 5.5 — Tax Pack export button.
 *
 * Wraps `GET /api/bookkeeping/tax-pack/export?fy=…&format=…` (route
 * shipped Phase 42 PR5; PDF + ZIP added in PR5.5). Lives on
 * `/dashboard/reports`. Lets the user pick FY + format → triggers
 * download.
 *
 * Format support:
 *   - csv  — Xero bank-statement-import format (load-bearing)
 *   - xlsx — Per-property P&L workbook + ATO labels + summary
 *   - json — Full structured summary
 *   - pdf  — Printable human-readable summary (PR5.5)
 *   - zip  — Receipt bundle for the FY: every Document with category
 *            IN (RECEIPT, INVOICE, TAX), foldered (PR5.5)
 *
 * Per CLAUDE.md §0 architect lens: thin UI wrapper over the
 * existing service. No new export logic; consumes the canonical
 * `buildTaxPackSummary` aggregator + the Document bundle builder.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

type TaxPackFormat = 'csv' | 'xlsx' | 'json' | 'pdf' | 'zip';

interface FormatOption {
  value: TaxPackFormat;
  label: string;
  description: string;
}

const FORMAT_OPTIONS: ReadonlyArray<FormatOption> = [
  { value: 'pdf', label: 'PDF — printable summary', description: 'Human-readable handoff for your accountant' },
  { value: 'xlsx', label: 'XLSX — Per-property workbook', description: 'P&L per property + ATO labels + summary' },
  { value: 'csv', label: 'CSV — Xero import', description: 'Bank-statement-import format' },
  { value: 'zip', label: 'ZIP — receipt bundle', description: 'Receipts / invoices / tax docs for the FY' },
  { value: 'json', label: 'JSON — programmatic', description: 'Full structured summary' },
];

const EXTENSION_BY_FORMAT: Record<TaxPackFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  json: 'json',
  pdf: 'pdf',
  zip: 'zip',
};

const DOWNLOAD_BASENAME_BY_FORMAT: Record<TaxPackFormat, string> = {
  csv: 'monitrax-tax-pack',
  xlsx: 'monitrax-tax-pack',
  json: 'monitrax-tax-pack',
  pdf: 'monitrax-tax-pack',
  zip: 'monitrax-receipts',
};

/**
 * AU FY label helper — builds `FY2025-26` from a starting calendar
 * year. The list shows the current FY + the 3 previous FYs.
 */
function buildFyOptions(): string[] {
  const now = new Date();
  // AU FY starts 1 July; if we're before 1 July, current FY started last year.
  const currentFyStartYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [0, 1, 2, 3].map((offset) => {
    const start = currentFyStartYear - offset;
    const endShort = String(start + 1).slice(-2);
    return `FY${start}-${endShort}`;
  });
}

export function TaxPackExportButton() {
  const { token } = useAuth();
  const fyOptions = buildFyOptions();
  const [fy, setFy] = useState<string>(fyOptions[0]);
  const [format, setFormat] = useState<TaxPackFormat>('pdf');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setDownloading(true);
    try {
      const url = `/api/bookkeeping/tax-pack/export?fy=${encodeURIComponent(fy)}&format=${format}`;
      // The endpoint streams a file. Trigger via fetch → blob → anchor click
      // so we can surface 4xx/5xx errors instead of silently navigating away.
      // Hotfix 2026-05-18: MUST pass Authorization header — otherwise
      // 401 → SessionExpiryHandler logs the user out.
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const ext = EXTENSION_BY_FORMAT[format];
      const basename = DOWNLOAD_BASENAME_BY_FORMAT[format];
      const filename = `${basename}-${fy.toLowerCase()}.${ext}`;

      const anchorUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = anchorUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(anchorUrl);
    } catch (err) {
      console.error('Tax Pack export error:', err);
      setError('Network error. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2">
          <FileSpreadsheet aria-hidden className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tax Pack export</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Categorised P&amp;L + ATO labels + per-property breakdown. Hand to your accountant.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="tax-pack-fy" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Financial year
          </label>
          <select
            id="tax-pack-fy"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            disabled={downloading}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {fyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tax-pack-format" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Format
          </label>
          <select
            id="tax-pack-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as TaxPackFormat)}
            disabled={downloading}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {FORMAT_OPTIONS.find((o) => o.value === format)?.description}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleExport}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-sm font-medium text-white transition-colors"
      >
        <Download aria-hidden className="h-3.5 w-3.5" />
        {downloading ? 'Preparing…' : `Export ${fy}`}
      </button>
    </div>
  );
}
