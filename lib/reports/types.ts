/**
 * Phase 16: Reporting Engine Types
 * Core type definitions for the Monitrax reporting system
 */

// ============================================================================
// Export Format Types
// ============================================================================

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeTimestamp?: boolean;
  locale?: string;
  currency?: 'AUD' | 'NZD' | 'USD';
  timezone?: string;
}

// ============================================================================
// Report Types
// ============================================================================

export type ReportType =
  | 'financial-overview'
  | 'income-expense'
  | 'loan-debt'
  | 'property-portfolio'
  | 'investment'
  | 'tax-time';

export interface ReportMetadata {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  generatedAt: Date;
  generatedBy: string;
  version: string;
  checksum?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

// ============================================================================
// Report Section Types
// ============================================================================

export interface ReportSection {
  id: string;
  title: string;
  order: number;
  visible: boolean;
}

export interface MetricSection extends ReportSection {
  type: 'metrics';
  metrics: ReportMetric[];
}

export interface TableSection extends ReportSection {
  type: 'table';
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

export interface ChartSection extends ReportSection {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'area';
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface TextSection extends ReportSection {
  type: 'text';
  content: string;
  annotations?: string[];
}

export type AnyReportSection = MetricSection | TableSection | ChartSection | TextSection;

// ============================================================================
// Report Data Types
// ============================================================================

export interface ReportMetric {
  label: string;
  value: number | string;
  format?: 'currency' | 'percentage' | 'number' | 'text';
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  description?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  format?: 'currency' | 'percentage' | 'number' | 'date' | 'text';
  align?: 'left' | 'center' | 'right';
  width?: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
  date?: Date;
}

// ============================================================================
// Report Context (GRDCS-based data)
// ============================================================================

export interface ReportContext {
  userId: string;
  periodStart: Date;
  periodEnd: Date;

  // Financial summary
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashflowRunway: number;
  healthScore: number;

  // Entity counts
  counts: {
    properties: number;
    loans: number;
    accounts: number;
    investments: number;
    incomes: number;
    expenses: number;
    depreciationSchedules: number;
  };

  // Detailed data (loaded on demand based on report type)
  properties?: PropertyReportData[];
  loans?: LoanReportData[];
  accounts?: AccountReportData[];
  investments?: InvestmentReportData[];
  incomes?: IncomeReportData[];
  expenses?: ExpenseReportData[];
  depreciationSchedules?: DepreciationReportData[];
  transactions?: TransactionReportData[];
}

// ============================================================================
// Entity Report Data Types
// ============================================================================

export interface PropertyReportData {
  id: string;
  name: string;
  address: string | null;
  type: string;
  purchasePrice: number;
  purchaseDate: Date | null;
  currentValue: number;
  equity: number;
  lvr: number;
  linkedLoansCount: number;
  linkedIncomesCount: number;
  linkedExpensesCount: number;
  annualDepreciation: number;
  rentalYield: number | null;
}

export interface LoanReportData {
  id: string;
  name: string;
  type: string;
  lender: string | null;
  principal: number;
  currentBalance: number;
  interestRate: number;
  rateType: string;
  monthlyRepayment: number;
  remainingTerm: number | null;
  linkedPropertyName: string | null;
}

export interface AccountReportData {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  interestRate: number | null;
}

export interface InvestmentReportData {
  id: string;
  accountName: string;
  symbol: string;
  name: string;
  units: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  sector?: string;
}

export interface IncomeReportData {
  id: string;
  source: string;
  category: string;
  amount: number;
  frequency: string;
  annualAmount: number;
  linkedPropertyName: string | null;
  isTaxable: boolean;
}

export interface ExpenseReportData {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: string;
  annualAmount: number;
  linkedPropertyName: string | null;
  isDeductible: boolean;
}

export interface DepreciationReportData {
  id: string;
  assetName: string;
  propertyName: string;
  category: string;
  method: string;
  cost: number;
  rate: number;
  startDate: Date;
  annualDeduction: number;
  remainingYears: number;
  remainingValue: number;
}

export interface TransactionReportData {
  id: string;
  date: Date;
  description: string;
  amount: number;
  category: string;
  accountName: string;
  type: 'income' | 'expense' | 'transfer';
}

// ============================================================================
// Report Output Types
// ============================================================================

export interface Report {
  metadata: ReportMetadata;
  sections: AnyReportSection[];
  summary?: string;
  aiAnnotations?: string[];
}

export interface GeneratedReport {
  report: Report;
  exportData: {
    format: ExportFormat;
    mimeType: string;
    filename: string;
    data: Buffer | string;
  };
}

// ============================================================================
// Report Configuration
// ============================================================================

export interface ReportConfig {
  type: ReportType;
  title?: string;
  sections?: string[]; // Section IDs to include
  periodStart?: Date;
  periodEnd?: Date;
  exportOptions: ExportOptions;
  includeCharts?: boolean;
  includeAiAnnotations?: boolean;
}

// ============================================================================
// Report Template Types
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  defaultSections: string[];
  createdAt: Date;
  updatedAt: Date;
  isSystem: boolean;
  userId?: string;
}
