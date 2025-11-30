/**
 * Phase 16: Excel (XLSX) Exporter
 * Converts report data to Excel format using xlsx library
 */

import * as XLSX from 'xlsx';
import type { Report, TableSection, MetricSection, ExportOptions } from '../types';

export interface XLSXExportResult {
  filename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Export a report to Excel format
 */
export function exportToXLSX(report: Report, options: ExportOptions): XLSXExportResult {
  const timestamp = options.includeTimestamp !== false
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';
  const filename = options.filename || `${report.metadata.type}${timestamp}.xlsx`;

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add summary sheet
  addSummarySheet(workbook, report, options);

  // Add data sheets for each table section
  let sheetIndex = 1;
  for (const section of report.sections) {
    if (!section.visible) continue;

    if (section.type === 'table') {
      const sheetName = sanitizeSheetName(section.title, sheetIndex);
      addTableSheet(workbook, section as TableSection, sheetName, options);
      sheetIndex++;
    } else if (section.type === 'metrics') {
      const sheetName = sanitizeSheetName(section.title, sheetIndex);
      addMetricsSheet(workbook, section as MetricSection, sheetName, options);
      sheetIndex++;
    }
  }

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return {
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    data: Buffer.from(buffer),
  };
}

/**
 * Add summary sheet with report metadata
 */
function addSummarySheet(
  workbook: XLSX.WorkBook,
  report: Report,
  options: ExportOptions
): void {
  const data: (string | number | Date)[][] = [
    ['Report Summary'],
    [],
    ['Title', report.metadata.title],
    ['Type', report.metadata.type],
    ['Generated', report.metadata.generatedAt.toISOString()],
    ['Report ID', report.metadata.id],
  ];

  if (report.metadata.periodStart && report.metadata.periodEnd) {
    data.push(['Period Start', formatDate(report.metadata.periodStart)]);
    data.push(['Period End', formatDate(report.metadata.periodEnd)]);
  }

  if (report.summary) {
    data.push([]);
    data.push(['Summary']);
    data.push([report.summary]);
  }

  // Add section overview
  data.push([]);
  data.push(['Sections Included']);
  for (const section of report.sections) {
    if (section.visible) {
      data.push([`• ${section.title}`]);
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [{ wch: 20 }, { wch: 50 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
}

/**
 * Add a table section as a worksheet
 */
function addTableSheet(
  workbook: XLSX.WorkBook,
  section: TableSection,
  sheetName: string,
  options: ExportOptions
): void {
  // Header row
  const headers = section.columns.map((col) => col.label);

  // Data rows
  const rows = section.rows.map((row) =>
    section.columns.map((col) => {
      const value = row[col.key];
      return formatCellValue(value, col.format, options);
    })
  );

  // Add totals row if present
  if (section.totals) {
    const totalsRow = section.columns.map((col) => {
      if (col.key in section.totals!) {
        return formatCellValue(section.totals![col.key], col.format, options);
      }
      return col.key === section.columns[0]?.key ? 'Total' : '';
    });
    rows.push(totalsRow);
  }

  // Create worksheet
  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths based on content
  const colWidths = section.columns.map((col, i) => {
    const maxLength = Math.max(
      col.label.length,
      ...rows.map((row) => String(row[i] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 40) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Add a metrics section as a worksheet
 */
function addMetricsSheet(
  workbook: XLSX.WorkBook,
  section: MetricSection,
  sheetName: string,
  options: ExportOptions
): void {
  const data: (string | number)[][] = [
    ['Metric', 'Value', 'Description'],
  ];

  for (const metric of section.metrics) {
    const value = formatMetricValue(metric.value, metric.format, options);
    data.push([metric.label, value, metric.description || '']);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Sanitize sheet name (Excel has restrictions)
 */
function sanitizeSheetName(name: string, index: number): string {
  // Excel sheet names: max 31 chars, no special chars: \ / ? * [ ]
  let sanitized = name
    .replace(/[\\/?*[\]]/g, '')
    .substring(0, 28);

  // Ensure unique name by adding index if needed
  if (!sanitized) {
    sanitized = `Sheet${index}`;
  }

  return sanitized;
}

/**
 * Format cell value based on column format
 */
function formatCellValue(
  value: unknown,
  format: string | undefined,
  options: ExportOptions
): string | number {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    switch (format) {
      case 'currency':
        // Return number for Excel to format (or formatted string)
        return formatCurrency(value, options.currency || 'AUD');
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value;
      default:
        return value;
    }
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
}

/**
 * Format metric value
 */
function formatMetricValue(
  value: string | number,
  format: string | undefined,
  options: ExportOptions
): string | number {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return formatCurrency(value, options.currency || 'AUD');
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return value;
    default:
      return value;
  }
}

/**
 * Format currency value
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date value
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
