/**
 * Phase 16: Report Generators
 * Functions to generate different report types from context data
 */

import type {
  Report,
  ReportType,
  ReportContext,
  ReportConfig,
  ReportMetadata,
  AnyReportSection,
  MetricSection,
  TableSection,
} from '../types';
import { generateFinancialOverviewReport } from './financialOverview';
import { generateIncomeExpenseReport } from './incomeExpense';
import { generatePropertyPortfolioReport } from './propertyPortfolio';
import { generateInvestmentReport } from './investment';
import { generateTaxTimeReport } from './taxTime';
import { generateLoanDebtReport } from './loanDebt';

// ============================================================================
// Main Report Generator
// ============================================================================

export async function generateReport(
  context: ReportContext,
  config: ReportConfig
): Promise<Report> {
  const metadata = createReportMetadata(config, context);

  let sections: AnyReportSection[];

  switch (config.type) {
    case 'financial-overview':
      sections = generateFinancialOverviewReport(context, config);
      break;
    case 'income-expense':
      sections = generateIncomeExpenseReport(context, config);
      break;
    case 'loan-debt':
      sections = generateLoanDebtReport(context, config);
      break;
    case 'property-portfolio':
      sections = generatePropertyPortfolioReport(context, config);
      break;
    case 'investment':
      sections = generateInvestmentReport(context, config);
      break;
    case 'tax-time':
      sections = generateTaxTimeReport(context, config);
      break;
    default:
      sections = [];
  }

  // Filter sections if specific ones requested
  if (config.sections && config.sections.length > 0) {
    sections = sections.filter((s) => config.sections!.includes(s.id));
  }

  // Generate AI summary if requested
  const summary = config.includeAiAnnotations
    ? generateReportSummary(context, config.type)
    : undefined;

  return {
    metadata,
    sections,
    summary,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createReportMetadata(config: ReportConfig, context: ReportContext): ReportMetadata {
  const reportTitles: Record<ReportType, string> = {
    'financial-overview': 'Financial Overview Report',
    'income-expense': 'Income & Expense Report',
    'loan-debt': 'Loan & Debt Report',
    'property-portfolio': 'Property Portfolio Report',
    'investment': 'Investment Report',
    'tax-time': 'Tax-Time Report',
  };

  const reportDescriptions: Record<ReportType, string> = {
    'financial-overview': 'Comprehensive overview of your financial position including net worth, assets, and liabilities.',
    'income-expense': 'Detailed breakdown of all income sources and expenses.',
    'loan-debt': 'Summary of all loans and debt obligations.',
    'property-portfolio': 'Complete analysis of your property portfolio including valuations and depreciation.',
    'investment': 'Investment holdings, performance, and sector allocation.',
    'tax-time': 'Tax-relevant information including deductible expenses and depreciation schedules.',
  };

  return {
    id: generateReportId(),
    type: config.type,
    title: config.title || reportTitles[config.type],
    description: reportDescriptions[config.type],
    generatedAt: new Date(),
    generatedBy: context.userId,
    version: '1.0.0',
    periodStart: config.periodStart || context.periodStart,
    periodEnd: config.periodEnd || context.periodEnd,
  };
}

function generateReportId(): string {
  return `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function generateReportSummary(context: ReportContext, type: ReportType): string {
  // Basic AI-style summary generation
  const summaries: Record<ReportType, () => string> = {
    'financial-overview': () => {
      const netWorthFormatted = formatCurrency(context.netWorth);
      const healthStatus = context.healthScore >= 70 ? 'healthy' : context.healthScore >= 50 ? 'moderate' : 'needs attention';
      return `Your current net worth is ${netWorthFormatted} with a financial health score of ${context.healthScore}/100 (${healthStatus}). ` +
        `You have ${context.counts.properties} properties, ${context.counts.loans} loans, and ${context.counts.investments} investment accounts. ` +
        `Your cashflow runway is approximately ${context.cashflowRunway} months.`;
    },
    'income-expense': () => {
      return `This report covers ${context.counts.incomes} income sources and ${context.counts.expenses} expense categories. ` +
        `Review the breakdown below to understand your cash flow patterns.`;
    },
    'loan-debt': () => {
      return `You have ${context.counts.loans} active loans with a total liability of ${formatCurrency(context.totalLiabilities)}. ` +
        `Focus on high-interest debt first for optimal financial outcomes.`;
    },
    'property-portfolio': () => {
      return `Your property portfolio consists of ${context.counts.properties} properties. ` +
        `This report includes current valuations, equity positions, and depreciation schedules.`;
    },
    'investment': () => {
      return `Your investment portfolio spans ${context.counts.investments} accounts. ` +
        `Review holdings, performance, and consider rebalancing if needed.`;
    },
    'tax-time': () => {
      return `This tax-time report compiles all tax-relevant data including ${context.counts.depreciationSchedules} depreciation schedules. ` +
        `Deductible expenses and income sources are categorized for easy tax filing.`;
    },
  };

  return summaries[type]();
}

// ============================================================================
// Formatting Helpers (exported for use by individual generators)
// ============================================================================

export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function createMetricSection(
  id: string,
  title: string,
  order: number,
  metrics: MetricSection['metrics']
): MetricSection {
  return {
    id,
    title,
    order,
    visible: true,
    type: 'metrics',
    metrics,
  };
}

export function createTableSection(
  id: string,
  title: string,
  order: number,
  columns: TableSection['columns'],
  rows: TableSection['rows'],
  totals?: TableSection['totals']
): TableSection {
  return {
    id,
    title,
    order,
    visible: true,
    type: 'table',
    columns,
    rows,
    totals,
  };
}
