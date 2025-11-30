import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import {
  buildReportContext,
  generateReport,
  exportReport,
  isFormatSupported,
} from '@/lib/reports';
import type { ReportType, ExportFormat, ReportConfig } from '@/lib/reports';

/**
 * GET /api/reports
 * List available report types
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const reportTypes = [
      {
        id: 'financial-overview',
        name: 'Financial Overview',
        description: 'Comprehensive overview of your financial position including net worth, assets, and liabilities.',
      },
      {
        id: 'income-expense',
        name: 'Income & Expense',
        description: 'Detailed breakdown of all income sources and expenses.',
      },
      {
        id: 'loan-debt',
        name: 'Loan & Debt',
        description: 'Summary of all loans and debt obligations.',
      },
      {
        id: 'property-portfolio',
        name: 'Property Portfolio',
        description: 'Complete analysis of your property portfolio including valuations and depreciation.',
      },
      {
        id: 'investment',
        name: 'Investment',
        description: 'Investment holdings, performance, and sector allocation.',
      },
      {
        id: 'tax-time',
        name: 'Tax-Time',
        description: 'Tax-relevant information including deductible expenses and depreciation schedules.',
      },
    ];

    const exportFormats = [
      { id: 'csv', name: 'CSV', description: 'Comma-separated values, compatible with Excel' },
      { id: 'json', name: 'JSON', description: 'Structured data format for integrations' },
      { id: 'xlsx', name: 'Excel', description: 'Microsoft Excel format (coming soon)', available: false },
      { id: 'pdf', name: 'PDF', description: 'Printable document format (coming soon)', available: false },
    ];

    return NextResponse.json({
      reportTypes,
      exportFormats,
    });
  });
}

/**
 * POST /api/reports
 * Generate and export a report
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const {
        type,
        format = 'json',
        periodStart,
        periodEnd,
        includeAiAnnotations = false,
      } = body;

      // Validate report type
      const validTypes: ReportType[] = [
        'financial-overview',
        'income-expense',
        'loan-debt',
        'property-portfolio',
        'investment',
        'tax-time',
      ];

      if (!type || !validTypes.includes(type)) {
        return NextResponse.json(
          { error: 'Invalid report type', validTypes },
          { status: 400 }
        );
      }

      // Validate export format
      if (!isFormatSupported(format)) {
        return NextResponse.json(
          { error: 'Invalid export format', validFormats: ['csv', 'json', 'xlsx', 'pdf'] },
          { status: 400 }
        );
      }

      // Parse dates if provided
      const startDate = periodStart ? new Date(periodStart) : undefined;
      const endDate = periodEnd ? new Date(periodEnd) : undefined;

      // Build report context
      const context = await buildReportContext(
        authReq.user!.userId,
        type as ReportType,
        startDate,
        endDate
      );

      // Configure report
      const config: ReportConfig = {
        type: type as ReportType,
        periodStart: startDate,
        periodEnd: endDate,
        exportOptions: {
          format: format as ExportFormat,
          includeTimestamp: true,
          currency: 'AUD',
        },
        includeAiAnnotations,
      };

      // Generate report
      const report = await generateReport(context, config);

      // Export to requested format
      const generated = exportReport(report, config.exportOptions);

      // Return based on format
      if (format === 'json') {
        // Return JSON directly
        return NextResponse.json({
          success: true,
          report: generated.report,
          exportInfo: {
            format: generated.exportData.format,
            filename: generated.exportData.filename,
          },
        });
      } else {
        // Return as downloadable file
        const data = generated.exportData.data;
        const bodyData = Buffer.isBuffer(data) ? new Uint8Array(data) : data;
        return new NextResponse(bodyData, {
          headers: {
            'Content-Type': generated.exportData.mimeType,
            'Content-Disposition': `attachment; filename="${generated.exportData.filename}"`,
          },
        });
      }
    } catch (error) {
      console.error('Report generation error:', error);
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }
  });
}
