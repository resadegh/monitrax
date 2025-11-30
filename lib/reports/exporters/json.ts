/**
 * Phase 16: JSON Exporter
 * Converts report data to JSON format
 */

import type { Report, ExportOptions } from '../types';

export interface JSONExportResult {
  filename: string;
  mimeType: string;
  data: string;
}

/**
 * Export a report to JSON format
 */
export function exportToJSON(report: Report, options: ExportOptions): JSONExportResult {
  const timestamp = options.includeTimestamp !== false
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';
  const filename = options.filename || `${report.metadata.type}${timestamp}.json`;

  // Create export object with metadata
  const exportData = {
    metadata: {
      ...report.metadata,
      exportedAt: new Date().toISOString(),
      format: 'json',
      version: '1.0',
    },
    sections: report.sections.filter((s) => s.visible),
    summary: report.summary,
    aiAnnotations: report.aiAnnotations,
  };

  return {
    filename,
    mimeType: 'application/json',
    data: JSON.stringify(exportData, null, 2),
  };
}

/**
 * Export report data in a flat structure (for API consumption)
 */
export function exportToFlatJSON(report: Report, options: ExportOptions): JSONExportResult {
  const timestamp = options.includeTimestamp !== false
    ? `_${new Date().toISOString().split('T')[0]}`
    : '';
  const filename = options.filename || `${report.metadata.type}${timestamp}_flat.json`;

  // Flatten sections into data arrays
  const flatData: Record<string, unknown> = {
    reportType: report.metadata.type,
    title: report.metadata.title,
    generatedAt: report.metadata.generatedAt,
    period: {
      start: report.metadata.periodStart,
      end: report.metadata.periodEnd,
    },
  };

  for (const section of report.sections) {
    if (!section.visible) continue;

    const sectionKey = section.id.replace(/-/g, '_');

    if (section.type === 'metrics') {
      flatData[sectionKey] = section.metrics.reduce((acc, m) => {
        const key = m.label.toLowerCase().replace(/\s+/g, '_');
        acc[key] = m.value;
        return acc;
      }, {} as Record<string, unknown>);
    } else if (section.type === 'table') {
      flatData[sectionKey] = section.rows;
    } else if (section.type === 'text') {
      flatData[sectionKey] = section.content;
    }
  }

  return {
    filename,
    mimeType: 'application/json',
    data: JSON.stringify(flatData, null, 2),
  };
}
