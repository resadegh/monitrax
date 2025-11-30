/**
 * Phase 16: Reporting Engine
 * Main entry point for the Monitrax reporting system
 */

// Types
export * from './types';

// Context Builder
export { buildReportContext } from './contextBuilder';

// Report Generators
export { generateReport, formatCurrency, formatPercentage, formatDate } from './generators';

// Export Pipelines
export {
  exportReport,
  exportToCSV,
  exportToJSON,
  exportToFlatJSON,
  getMimeType,
  getFileExtension,
  isFormatSupported,
} from './exporters';

// Re-export individual generators for direct use if needed
export { generateFinancialOverviewReport } from './generators/financialOverview';
export { generateIncomeExpenseReport } from './generators/incomeExpense';
export { generatePropertyPortfolioReport } from './generators/propertyPortfolio';
export { generateInvestmentReport } from './generators/investment';
export { generateLoanDebtReport } from './generators/loanDebt';
export { generateTaxTimeReport } from './generators/taxTime';
