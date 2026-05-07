/**
 * Phase 42 PR5 — Xero bank-statement-import CSV exporter.
 *
 * The LOAD-BEARING handoff format. The accountant downloads this CSV
 * from Monitrax and imports it directly into Xero via
 * `Bank accounts → Manage Account → Import statement`.
 *
 * Xero's expected column order (Xero help article BS_001 / their
 * generic bank statement importer):
 *   1. Date         — DD/MM/YYYY
 *   2. Amount       — single signed column (negative = OUT)
 *   3. Payee        — merchant
 *   4. Description  — narration
 *   5. Reference    — optional reference number
 *
 * Hard rules:
 *   - Header row exactly matches Xero's expected names
 *   - Amount is signed in ONE column (Xero supports separate Spent/
 *     Received columns too but signed-amount is the canonical and
 *     more compact form)
 *   - Date format DD/MM/YYYY (AU; Xero auto-detects but we always
 *     emit AU since this is a Monitrax + AU-tax pack)
 *   - Quotes around any field that contains comma / quote / newline
 *   - LF line endings (Xero accepts both; LF is canonical)
 *
 * Per CLAUDE.md §12.3 — pure data-in / data-out; no DB; no parallel
 * calc engine. The caller fetches transactions; this module
 * serialises them.
 */

import type { UnifiedTransaction } from '@prisma/client';

export interface XeroCsvRow {
  date: Date;
  amount: number; // signed: OUT negative, IN positive
  payee: string;
  description: string;
  reference?: string | null;
}

const HEADER = ['Date', 'Amount', 'Payee', 'Description', 'Reference'].join(',');

/**
 * Format a Date as DD/MM/YYYY (Xero AU format).
 */
export function formatXeroDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Quote a CSV cell when it needs escaping (contains comma, quote, or newline).
 * Embedded quotes are doubled per RFC 4180.
 */
export function escapeCsv(value: string): string {
  if (value === '') return '';
  if (/[,"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a single signed amount with 2 decimal places. Negative
 * sign in front of the digits (Xero's expected form).
 */
export function formatXeroAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  // Use toFixed which always produces 2 decimal places.
  return amount.toFixed(2);
}

/**
 * Convert one transaction to a Xero-shape row. Pure.
 */
export function transactionToXeroRow(tx: UnifiedTransaction): XeroCsvRow {
  // Sign convention: tx.amount is stored signed in the same direction
  // pgrep already enforces (OUT = negative). Xero wants the same
  // signed convention so we pass it through directly.
  const payee =
    tx.merchantStandardised ?? tx.merchantRaw ?? tx.description ?? '';
  return {
    date: tx.date,
    amount: tx.amount,
    payee,
    description: tx.description ?? '',
    reference: tx.externalId ?? null,
  };
}

/**
 * Render a Xero-shape row as a single CSV line (no trailing newline).
 */
export function renderXeroRow(row: XeroCsvRow): string {
  return [
    formatXeroDate(row.date),
    formatXeroAmount(row.amount),
    escapeCsv(row.payee),
    escapeCsv(row.description),
    escapeCsv(row.reference ?? ''),
  ].join(',');
}

export interface XeroCsvOptions {
  /** Include the header row (default true). */
  header?: boolean;
  /** Trailing newline at end of file (default true; matches RFC 4180). */
  trailingNewline?: boolean;
}

/**
 * Render a sequence of transactions as a Xero-import-ready CSV string.
 *
 * Order: caller-provided. Most accountants want chronological
 * ascending — the API layer should pre-sort.
 */
export function renderXeroCsv(
  transactions: UnifiedTransaction[],
  options: XeroCsvOptions = {}
): string {
  const includeHeader = options.header !== false;
  const includeTrailingNewline = options.trailingNewline !== false;

  const lines: string[] = [];
  if (includeHeader) lines.push(HEADER);
  for (const tx of transactions) {
    lines.push(renderXeroRow(transactionToXeroRow(tx)));
  }
  let csv = lines.join('\n');
  if (includeTrailingNewline) csv += '\n';
  return csv;
}

/**
 * Suggested filename for the Xero CSV download.
 *
 * Form: `monitrax-xero-import-YYYY-MM-DD.csv` (today's date).
 * Phase 42 spec recommends including the FY label in the file name
 * when a tax-year window was applied; see `taxPack/orchestrator.ts`
 * which is responsible for that wrapping.
 */
export function suggestedXeroFilename(): string {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  return `monitrax-xero-import-${yyyy}-${mm}-${dd}.csv`;
}

export const XERO_CSV_HEADER = HEADER;
