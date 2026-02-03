/**
 * Centralized Calculation Engines
 *
 * Single source of truth for all financial calculations.
 * Blueprint §5.1: Never Duplicate Logic
 * Blueprint §2.3: Canonical Everything
 *
 * These engines replace scattered calculation logic across API routes
 * and ensure consistent results throughout the application.
 */

export {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
  type NetWorthResult,
  type AssetSummary,
  type LiabilitySummary,
} from './netWorthCalculator';

export {
  calculateCashflow,
  calculateMonthlyCashflow,
  calculateAnnualCashflow,
  type CashflowResult,
  type CashflowInput,
} from './cashflowOrchestrator';

export {
  aggregateExpenses,
  aggregateExpensesByCategory,
  type ExpenseAggregation,
  type ExpenseInput,
} from './expenseAggregator';

export {
  aggregateIncome,
  type IncomeAggregation,
  type IncomeInput,
} from './incomeAggregator';

export {
  aggregateLoanRepayments,
  type LoanAggregation,
  type LoanInput,
} from './loanAggregator';
