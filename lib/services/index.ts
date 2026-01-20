/**
 * Services Index
 *
 * Centralized services that provide business logic and calculations.
 * These services are the single source of truth for data operations.
 */

export {
  getFinancialSnapshot,
  getMonthlyExpenseTotal,
  getMonthlyIncomeTotal,
  getMonthlyCashflow,
  type FinancialSnapshot,
  type ExpenseBreakdown,
  type IncomeBreakdown,
  type AccountSummary,
  type LoanSummary,
} from './financialSnapshot';
