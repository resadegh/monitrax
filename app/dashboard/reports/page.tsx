'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useEnabledModules } from '@/lib/featureFlags/ModuleGateContext';
import { filterNavByModules } from '@/lib/navigation/trailNav';
import type { ModuleKey } from '@/lib/featureFlags/moduleRegistry';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { TaxPackExportButton } from '@/components/bookkeeping/TaxPackExportButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileJson,
  Building,
  TrendingUp,
  Wallet,
  Receipt,
  Calculator,
  Loader2,
  CheckCircle,
} from 'lucide-react';

type ReportType =
  | 'financial-overview'
  | 'income-expense'
  | 'loan-debt'
  | 'property-portfolio'
  | 'investment'
  | 'tax-time';

type ExportFormat = 'csv' | 'json' | 'xlsx';

interface ReportTypeInfo {
  id: ReportType;
  name: string;
  description: string;
  /** Longer prose for the help section — SAME list renders both surfaces (no second hardcoded list, §12.2.1). */
  longDescription: string;
  icon: React.ElementType;
  variant: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'pink';
  /**
   * PROD Simplification P2.3: a report tile is visible only while its
   * parent module's flag is ON (registry key — plan §2.2). The v1 kept
   * pack (property-portfolio, tax-time) carries NO key and always shows.
   */
  moduleKey?: ModuleKey;
}

const reportTypes: ReportTypeInfo[] = [
  {
    id: 'financial-overview',
    name: 'Financial Overview',
    description: 'Net worth, assets, liabilities, and health score summary',
    longDescription:
      'A comprehensive snapshot of your financial position including net worth calculation, asset allocation, liability breakdown, and financial health score.',
    icon: Wallet,
    variant: 'blue',
    moduleKey: 'MODULE_HOME', // whole-position overview — the Home dashboard family (returns R4)
  },
  {
    id: 'income-expense',
    name: 'Income & Expense',
    description: 'All income sources and expense categories with tax flags',
    longDescription:
      'Detailed breakdown of all income sources and expense categories, with tax-deductible flags and annual totals for budgeting and tax preparation.',
    icon: Receipt,
    variant: 'green',
    moduleKey: 'MODULE_HOUSEHOLD', // the income/expense list-page family (returns R3)
  },
  {
    id: 'loan-debt',
    name: 'Loan & Debt',
    description: 'Loan balances, interest rates, and repayment schedules',
    longDescription:
      'Loan balances, interest rates, and repayment schedules across every loan, for planning your path out of debt.',
    icon: TrendingUp,
    variant: 'orange',
    moduleKey: 'MODULE_DEBT_PLANNER', // the debt-planning family (returns R3); loan DATA stays live on kept pages
  },
  {
    id: 'property-portfolio',
    name: 'Property Portfolio',
    description: 'Property valuations, equity, and depreciation schedules',
    longDescription:
      'Complete analysis of your property investments including current valuations, equity positions, LVR calculations, and depreciation schedules.',
    icon: Building,
    variant: 'purple',
  },
  {
    id: 'investment',
    name: 'Investment',
    description: 'Holdings, performance, gains/losses by account',
    longDescription:
      'Holdings, performance, and realised/unrealised gains and losses by investment account.',
    icon: TrendingUp,
    variant: 'pink',
    moduleKey: 'MODULE_INVESTMENTS', // returns R5
  },
  {
    id: 'tax-time',
    name: 'Tax-Time Report',
    description: 'Taxable income, deductions, and depreciation for tax filing',
    longDescription:
      'Compiles all tax-relevant data including taxable income, deductible expenses, depreciation claims, and rental property statements for easy tax filing.',
    icon: Calculator,
    variant: 'green',
  },
];

const variantStyles = {
  default: 'border-l-gray-400 hover:border-l-gray-500',
  blue: 'border-l-sky-500 hover:border-l-sky-600',
  green: 'border-l-emerald-500 hover:border-l-emerald-600',
  purple: 'border-l-indigo-500 hover:border-l-indigo-600',
  orange: 'border-l-amber-500 hover:border-l-amber-600',
  pink: 'border-l-pink-500 hover:border-l-pink-600',
};

export default function ReportsPage() {
  const { token } = useAuth();
  // PROD Simplification P2.3: narrow in-page to the v1 pack. Tiles for
  // hidden modules drop out via the SAME registry filter the nav uses.
  const enabledModules = useEnabledModules();
  const visibleReportTypes = filterNavByModules(reportTypes, enabledModules);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!selectedReport || !token) return;

    setIsGenerating(true);
    setError(null);
    setLastGenerated(null);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: selectedReport,
          format: selectedFormat,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate report');
      }

      if (selectedFormat === 'json') {
        // For JSON, download the response as a file
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.report, null, 2)], {
          type: 'application/json',
        });
        downloadBlob(blob, `${selectedReport}_${Date.now()}.json`);
      } else {
        // For other formats, get the blob directly
        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `${selectedReport}_${Date.now()}.${selectedFormat}`;
        downloadBlob(blob, filename);
      }

      setLastGenerated(reportTypes.find((r) => r.id === selectedReport)?.name || selectedReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports"
        description="Generate and export financial reports"
      />

      <div className="space-y-6">
        {/* Phase 42 PR 5.6 — Tax Pack export. Categorised P&L +
            ATO labels + per-property breakdown. Hand to accountant. */}
        <TaxPackExportButton />

        {/* Report Type Selection */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Select Report Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleReportTypes.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;

              return (
                <Card
                  key={report.id}
                  className={`cursor-pointer transition-all duration-200 border-l-4 ${variantStyles[report.variant]} ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedReport(report.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{report.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{report.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Export Options */}
        {selectedReport && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Export Options
              </CardTitle>
              <CardDescription>
                Choose your preferred export format and generate the report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium mb-2 block">
                    Export Format
                  </label>
                  <Select
                    value={selectedFormat}
                    onValueChange={(v) => setSelectedFormat(v as ExportFormat)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel (.xlsx)
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV (Comma separated)
                        </div>
                      </SelectItem>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          JSON (Data format)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Generate & Download
                    </>
                  )}
                </Button>
              </div>

              {/* Status Messages */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}

              {lastGenerated && !error && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Successfully generated: {lastGenerated}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Report Descriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* P2.3: rendered from the SAME filtered list as the tiles —
                the previously-hardcoded second list is gone (§12.2.1). */}
            <div className="grid gap-4 text-sm">
              {visibleReportTypes.map((report) => (
                <div key={report.id}>
                  <h4 className="font-medium">{report.name}</h4>
                  <p className="text-muted-foreground">{report.longDescription}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
