/**
 * Unified Category System
 * Provides a single source of truth for categories across
 * Transactions, Expenses, and Income
 */

// ExpenseCategory enum values from Prisma schema
export const EXPENSE_CATEGORIES = [
  'HOUSING',
  'RATES',
  'INSURANCE',
  'MAINTENANCE',
  'PERSONAL',
  'UTILITIES',
  'FOOD',
  'TRANSPORT',
  'ENTERTAINMENT',
  'STRATA',
  'LAND_TAX',
  'LOAN_INTEREST',
  'OTHER',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// IncomeType enum values from Prisma schema
export const INCOME_TYPES = [
  'SALARY',
  'RENT',
  'RENTAL',
  'INVESTMENT',
  'OTHER',
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

// Human-readable labels for expense categories
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOUSING: 'Housing',
  RATES: 'Rates & Taxes',
  INSURANCE: 'Insurance',
  MAINTENANCE: 'Maintenance',
  PERSONAL: 'Personal',
  UTILITIES: 'Utilities',
  FOOD: 'Food & Dining',
  TRANSPORT: 'Transport',
  ENTERTAINMENT: 'Entertainment',
  STRATA: 'Strata',
  LAND_TAX: 'Land Tax',
  LOAN_INTEREST: 'Loan Interest',
  OTHER: 'Other',
};

// Human-readable labels for income types
export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  SALARY: 'Salary',
  RENT: 'Rent',
  RENTAL: 'Rental Income',
  INVESTMENT: 'Investment',
  OTHER: 'Other',
};

// Map transaction categories to expense categories
export const TRANSACTION_TO_EXPENSE_MAP: Record<string, ExpenseCategory> = {
  'Housing': 'HOUSING',
  'Home': 'HOUSING',
  'Rent': 'HOUSING',
  'Mortgage': 'HOUSING',
  'Rates': 'RATES',
  'Council': 'RATES',
  'Insurance': 'INSURANCE',
  'Maintenance': 'MAINTENANCE',
  'Repairs': 'MAINTENANCE',
  'Personal': 'PERSONAL',
  'Shopping': 'PERSONAL',
  'Utilities': 'UTILITIES',
  'Bills': 'UTILITIES',
  'Electricity': 'UTILITIES',
  'Gas': 'UTILITIES',
  'Water': 'UTILITIES',
  'Internet': 'UTILITIES',
  'Phone': 'UTILITIES',
  'Food': 'FOOD',
  'Groceries': 'FOOD',
  'Dining': 'FOOD',
  'Restaurants': 'FOOD',
  'Transport': 'TRANSPORT',
  'Fuel': 'TRANSPORT',
  'Petrol': 'TRANSPORT',
  'Travel': 'TRANSPORT',
  'Entertainment': 'ENTERTAINMENT',
  'Recreation': 'ENTERTAINMENT',
  'Strata': 'STRATA',
  'Body Corporate': 'STRATA',
  'Land Tax': 'LAND_TAX',
  'Loan': 'LOAN_INTEREST',
  'Interest': 'LOAN_INTEREST',
  'Other': 'OTHER',
};

// Map transaction categories to income types
export const TRANSACTION_TO_INCOME_MAP: Record<string, IncomeType> = {
  'Salary': 'SALARY',
  'Wages': 'SALARY',
  'Pay': 'SALARY',
  'Income': 'SALARY',
  'Rent': 'RENT',
  'Rental': 'RENTAL',
  'Investment': 'INVESTMENT',
  'Dividend': 'INVESTMENT',
  'Interest': 'INVESTMENT',
  'Other': 'OTHER',
};

/**
 * Unified category for display in UI
 */
export interface UnifiedCategory {
  id: string;
  label: string;
  type: 'income' | 'expense';
  originalCategory: string;
}

/**
 * Get all unified categories for UI display
 */
export function getAllCategories(): UnifiedCategory[] {
  const categories: UnifiedCategory[] = [];

  // Add income types
  for (const type of INCOME_TYPES) {
    categories.push({
      id: `income:${type}`,
      label: `${INCOME_TYPE_LABELS[type]} (Income)`,
      type: 'income',
      originalCategory: type,
    });
  }

  // Add expense categories
  for (const category of EXPENSE_CATEGORIES) {
    categories.push({
      id: `expense:${category}`,
      label: `${EXPENSE_CATEGORY_LABELS[category]} (Expense)`,
      type: 'expense',
      originalCategory: category,
    });
  }

  return categories;
}

/**
 * Get categories for a specific direction (IN = income, OUT = expense)
 */
export function getCategoriesForDirection(direction: 'IN' | 'OUT'): UnifiedCategory[] {
  if (direction === 'IN') {
    return INCOME_TYPES.map(type => ({
      id: `income:${type}`,
      label: INCOME_TYPE_LABELS[type],
      type: 'income' as const,
      originalCategory: type,
    }));
  } else {
    return EXPENSE_CATEGORIES.map(category => ({
      id: `expense:${category}`,
      label: EXPENSE_CATEGORY_LABELS[category],
      type: 'expense' as const,
      originalCategory: category,
    }));
  }
}

/**
 * Parse a unified category ID
 */
export function parseUnifiedCategoryId(id: string): {
  type: 'income' | 'expense';
  category: string;
} | null {
  const [type, category] = id.split(':');
  if ((type === 'income' || type === 'expense') && category) {
    return { type, category };
  }
  return null;
}

/**
 * Map a transaction category to the appropriate expense/income category
 */
export function mapTransactionCategory(
  categoryLevel1: string | null | undefined,
  direction: 'IN' | 'OUT'
): string | null {
  if (!categoryLevel1) return null;

  if (direction === 'IN') {
    return TRANSACTION_TO_INCOME_MAP[categoryLevel1] || 'OTHER';
  } else {
    return TRANSACTION_TO_EXPENSE_MAP[categoryLevel1] || 'OTHER';
  }
}
