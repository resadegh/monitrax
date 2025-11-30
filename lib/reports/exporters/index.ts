/**
 * Phase 16: Export Pipelines
 * Unified export interface for all formats
 */

import type { Report, ExportOptions, ExportFormat, GeneratedReport } from '../types';
import { exportToCSV } from './csv';
import { exportToJSON, exportToFlatJSON } from './json';
import { exportToXLSX } from './xlsx';

// Re-export individual exporters
export { exportToCSV } from './csv';
export { exportToJSON, exportToFlatJSON } from './json';
export { exportToXLSX } from './xlsx';

/**
 * Export a report to the specified format
 */
export function exportReport(
  report: Report,
  options: ExportOptions
): GeneratedReport {
  let exportData: { filename: string; mimeType: string; data: string | Buffer };

  switch (options.format) {
    case 'csv':
      exportData = exportToCSV(report, options);
      break;

    case 'json':
      exportData = exportToJSON(report, options);
      break;

    case 'xlsx':
      exportData = exportToXLSX(report, options);
      break;

    case 'pdf':
      // PDF export - placeholder for now
      // Will require @react-pdf/renderer or jspdf
      exportData = {
        filename: `${report.metadata.type}_${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        data: 'PDF export not yet implemented',
      };
      break;

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  return {
    report,
    exportData: {
      format: options.format,
      mimeType: exportData.mimeType,
      filename: exportData.filename,
      data: typeof exportData.data === 'string' ? Buffer.from(exportData.data) : exportData.data,
    },
  };
}

/**
 * Get MIME type for a format
 */
export function getMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
  };
  return mimeTypes[format];
}

/**
 * Get file extension for a format
 */
export function getFileExtension(format: ExportFormat): string {
  return `.${format}`;
}

/**
 * Check if a format is supported
 */
export function isFormatSupported(format: string): format is ExportFormat {
  return ['csv', 'json', 'xlsx', 'pdf'].includes(format);
}
