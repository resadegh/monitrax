/**
 * Phase 42 PR5 — Per-property P&L XLSX exporter.
 *
 * Renders the Tax Pack summary as an Excel workbook:
 *   - Sheet 1: "Summary" — overall totals + ATO label rollup +
 *              data-source disclosure + the disclaimer
 *   - Sheet 2: "ATO Labels" — flat list (atoLabel, schedule,
 *              lineItem, totalAmount, transactionCount, notes)
 *   - Sheet 3+: "Property: <name>" — one sheet per property with
 *               income / expense / category-rollup / net rows
 *
 * Per CLAUDE.md §12.7 (GCP-First / minimal-deps) — uses the existing
 * `xlsx` dep (already in `package.json` for Phase 16 reports). No
 * new packages.
 *
 * Returns a Node Buffer suitable for `Content-Type:
 * application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
 * download.
 */

import * as XLSX from 'xlsx';
import type { TaxPackSummary, AtoLabelTotals, PerPropertyPL } from './summary';

export interface XlsxExportOptions {
  /** Pretty-format currency cells (default true). */
  formatCurrency?: boolean;
}

/**
 * Build the Tax Pack XLSX workbook. Returns a Node Buffer.
 *
 * Sheet ordering chosen for accountant workflow:
 *   1. Summary    — eyeballable overview
 *   2. ATO Labels — copy-paste-friendly for tax software
 *   3..N. Property: <name> — investor-by-investor drill-in
 */
export function buildTaxPackXlsx(
  summary: TaxPackSummary,
  options: XlsxExportOptions = {}
): Buffer {
  const wb = XLSX.utils.book_new();

  // ---- Summary sheet ----
  const summaryRows: (string | number)[][] = [
    ['Monitrax Tax Pack — Summary'],
    [],
    ['Window', summary.window.label],
    ['Generated', summary.generatedAt.toISOString()],
    [],
    ['Totals'],
    ['Income (gross)', summary.totals.incomeGross],
    ['Expenses', summary.totals.expenseTotal],
    ['Net cashflow', summary.totals.netCashflow],
    ['Transactions', summary.totals.transactionCount],
    [],
    ['Data sources'],
    ...Object.entries(summary.dataSources.sources).map(([k, v]) => [k, v]),
    [],
    ['BASIQ months', summary.dataSources.basiqMonths.join(', ') || '(none)'],
    ['Imported months', summary.dataSources.importedMonths.join(', ') || '(none)'],
    ['Manual-only months', summary.dataSources.manualOnlyMonths.join(', ') || '(none)'],
    [],
    ['Disclaimer'],
    [summary.disclaimer],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // ---- ATO Labels sheet ----
  XLSX.utils.book_append_sheet(wb, buildAtoLabelsSheet(summary.atoLabels), 'ATO Labels');

  // ---- One sheet per property ----
  for (const property of summary.perProperty) {
    XLSX.utils.book_append_sheet(
      wb,
      buildPropertySheet(property),
      sanitiseSheetName(`Property: ${property.propertyName}`)
    );
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function buildAtoLabelsSheet(atoLabels: AtoLabelTotals[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ATO Label', 'Schedule', 'Line item', 'Total amount', 'Transaction count', 'Notes'],
  ];
  for (const row of atoLabels) {
    rows.push([
      row.atoLabel,
      row.schedule ?? '',
      row.lineItem ?? '',
      row.totalAmount,
      row.transactionCount,
      row.notes ?? '',
    ]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildPropertySheet(property: PerPropertyPL): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [`P&L — ${property.propertyName}`],
    [],
    ['Income'],
    ['Total income', property.income.total],
    ['Income transaction count', property.income.count],
    [],
    ['Expenses'],
    ['Total expenses', property.expenses.total],
    ['Expense transaction count', property.expenses.count],
    [],
    ['Expense by category'],
    ['Category', 'Total', 'Count'],
  ];
  for (const cat of property.expenses.byCategory.sort((a, b) => b.total - a.total)) {
    rows.push([cat.category, cat.total, cat.count]);
  }
  rows.push([]);
  rows.push(['Net (income − expenses)', property.net]);
  return XLSX.utils.aoa_to_sheet(rows);
}

/**
 * Excel sheet names cannot exceed 31 chars and cannot contain
 * `\ / ? * [ ]` — sanitise so we don't bork the workbook on a
 * property named e.g. "60 King St / Apt 4".
 */
export function sanitiseSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]]/g, '-');
  return cleaned.slice(0, 31);
}

/**
 * Suggested filename for the XLSX download. Includes the FY label
 * to make the downloaded file self-describing.
 */
export function suggestedXlsxFilename(fyLabel: string): string {
  return `monitrax-tax-pack-${fyLabel.toLowerCase()}.xlsx`;
}
