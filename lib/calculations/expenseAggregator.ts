/**
 * Expense Aggregator
 *
 * Single source of truth for expense aggregation.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered expense reduce() calls in:
 * - app/api/financial-health/route.ts
 * - app/api/cashflow/route.ts
 * - app/api/cashflow/summary/route.ts
 * - app/api/portfolio/snapshot/route.ts
 */

import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpenseInput {
  amount: number;
  frequency: string;
  category?: string;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  propertyId?: string | null;
  loanId?: string | null;
  assetId?: string | null;
  /**
   * Phase 41a — `LegalEntity` ownership FK (Phase 41e.0 audit C-3).
   * See `incomeAggregator.IncomeInput.ownerEntityId` for full rationale.
   */
  ownerEntityId?: string | null;
}

export interface ExpenseAggregation {
  total: number;
  essential: number;
  discretionary: number;
  taxDeductible: number;
  byCategory: Record<string, number>;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  isEssential: boolean;
}

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Aggregate expenses to a target frequency (monthly or annual).
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only items
 * whose `ownerEntityId` matches are aggregated. Default = no filter
 * for backward-compat. Per audit doc §6.3.
 */
export function aggregateExpenses(
  expenses: ExpenseInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly',
  ownerEntityId?: string,
): ExpenseAggregation {
  const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;

  let total = 0;
  let essential = 0;
  let discretionary = 0;
  let taxDeductible = 0;
  const byCategory: Record<string, number> = {};

  const filtered = ownerEntityId
    ? expenses.filter((e) => e.ownerEntityId === ownerEntityId)
    : expenses;

  for (const expense of filtered) {
    const amount = converter(expense.amount, expense.frequency as Frequency);

    total += amount;

    if (expense.isEssential) {
      essential += amount;
    } else {
      discretionary += amount;
    }

    if (expense.isTaxDeductible) {
      taxDeductible += amount;
    }

    const category = expense.category || 'Other';
    byCategory[category] = (byCategory[category] || 0) + amount;
  }

  return {
    total,
    essential,
    discretionary,
    taxDeductible,
    byCategory,
  };
}

/**
 * Aggregate expenses with detailed category breakdown
 */
export function aggregateExpensesByCategory(
  expenses: ExpenseInput[],
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): CategoryBreakdown[] {
  const aggregation = aggregateExpenses(expenses, targetFrequency);
  const total = aggregation.total || 1; // Avoid division by zero

  const categoryMap = new Map<string, { amount: number; isEssential: boolean }>();

  for (const expense of expenses) {
    const converter = targetFrequency === 'monthly' ? toMonthly : toAnnual;
    const amount = converter(expense.amount, expense.frequency as Frequency);
    const category = expense.category || 'Other';

    const existing = categoryMap.get(category);
    if (existing) {
      existing.amount += amount;
      // Category is essential if any expense in it is essential
      existing.isEssential = existing.isEssential || expense.isEssential === true;
    } else {
      categoryMap.set(category, {
        amount,
        isEssential: expense.isEssential === true,
      });
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: (data.amount / total) * 100,
      isEssential: data.isEssential,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Filter and aggregate expenses by source (property, loan, asset)
 */
export function aggregateExpensesBySource(
  expenses: ExpenseInput[],
  sourceType: 'property' | 'loan' | 'asset',
  sourceId: string,
  targetFrequency: 'monthly' | 'annual' = 'monthly'
): ExpenseAggregation {
  const filtered = expenses.filter((e) => {
    switch (sourceType) {
      case 'property':
        return e.propertyId === sourceId;
      case 'loan':
        return e.loanId === sourceId;
      case 'asset':
        return e.assetId === sourceId;
      default:
        return false;
    }
  });

  return aggregateExpenses(filtered, targetFrequency);
}
