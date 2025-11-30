/**
 * Phase 16: CSV Exporter
 * Converts report data to CSV format
 */

import type { Report, TableSection, MetricSection, ExportOptions } from '../types';

export interface CSVExportResult {
  filename: string;
  mimeType: string;
  data: string;
}

/**
 * Export a report to CSV format
 */
export function exportToCSV(report: Report, options: ExportOptions): CSVExportResult {
  const lines: string[] = [];
  const timestamp = options.includeTimestamp !== false
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';
  const filename = options.filename || `${report.metadata.type}${timestamp}.csv`;

  // Add report header
  lines.push(`"${report.metadata.title}"`);
  lines.push(`"Generated: ${report.metadata.generatedAt.toISOString()}"`);
  if (report.metadata.periodStart && report.metadata.periodEnd) {
    lines.push(`"Period: ${formatDate(report.metadata.periodStart)} - ${formatDate(report.metadata.periodEnd)}"`);
  }
  lines.push(''); // Empty line

  // Process each section
  for (const section of report.sections) {
    if (!section.visible) continue;

    lines.push(`"${section.title}"`);

    if (section.type === 'metrics') {
      exportMetricsSection(section as MetricSection, lines, options);
    } else if (section.type === 'table') {
      exportTableSection(section as TableSection, lines, options);
    } else if (section.type === 'text') {
      lines.push(`"${escapeCSV(section.content)}"`);
    }

    lines.push(''); // Empty line between sections
  }

  // Add summary if present
  if (report.summary) {
    lines.push('"Summary"');
    lines.push(`"${escapeCSV(report.summary)}"`);
  }

  return {
    filename,
    mimeType: 'text/csv',
    data: lines.join('\n'),
  };
}

/**
 * Export metrics section to CSV
 */
function exportMetricsSection(
  section: MetricSection,
  lines: string[],
  options: ExportOptions
): void {
  lines.push('"Metric","Value","Description"');

  for (const metric of section.metrics) {
    const value = formatMetricValue(metric.value, metric.format, options);
    const description = metric.description || '';
    lines.push(`"${escapeCSV(metric.label)}","${escapeCSV(value)}","${escapeCSV(description)}"`);
  }
}

/**
 * Export table section to CSV
 */
function exportTableSection(
  section: TableSection,
  lines: string[],
  options: ExportOptions
): void {
  // Header row
  const headers = section.columns.map((col) => `"${escapeCSV(col.label)}"`);
  lines.push(headers.join(','));

  // Data rows
  for (const row of section.rows) {
    const cells = section.columns.map((col) => {
      const value = row[col.key];
      const formatted = formatCellValue(value, col.format, options);
      return `"${escapeCSV(formatted)}"`;
    });
    lines.push(cells.join(','));
  }

  // Totals row if present
  if (section.totals) {
    const totalCells = section.columns.map((col) => {
      if (col.key in section.totals!) {
        const value = section.totals![col.key];
        const formatted = formatCellValue(value, col.format, options);
        return `"${escapeCSV(formatted)}"`;
      }
      return col.key === section.columns[0]?.key ? '"Total"' : '""';
    });
    lines.push(totalCells.join(','));
  }
}

/**
 * Format a metric value based on its format type
 */
function formatMetricValue(
  value: string | number,
  format: string | undefined,
  options: ExportOptions
): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return formatCurrency(value, options.currency || 'AUD');
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return value.toLocaleString('en-AU');
    default:
      return String(value);
  }
}

/**
 * Format a cell value based on column format
 */
function formatCellValue(
  value: unknown,
  format: string | undefined,
  options: ExportOptions
): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    switch (format) {
      case 'currency':
        return formatCurrency(value, options.currency || 'AUD');
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toLocaleString('en-AU');
      default:
        return String(value);
    }
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
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

/**
 * Escape special characters for CSV
 */
function escapeCSV(value: string): string {
  // Replace double quotes with two double quotes
  return value.replace(/"/g, '""');
}

/**
 * Export multiple tables to a single CSV with sheets (separated by headers)
 */
export function exportMultipleTablesToCSV(
  tables: Array<{ title: string; section: TableSection }>,
  options: ExportOptions
): CSVExportResult {
  const lines: string[] = [];
  const timestamp = options.includeTimestamp !== false
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';
  const filename = options.filename || `export${timestamp}.csv`;

  for (let i = 0; i < tables.length; i++) {
    const { title, section } = tables[i];

    if (i > 0) {
      lines.push(''); // Empty line between tables
    }

    lines.push(`"${title}"`);
    exportTableSection(section, lines, options);
  }

  return {
    filename,
    mimeType: 'text/csv',
    data: lines.join('\n'),
  };
}
