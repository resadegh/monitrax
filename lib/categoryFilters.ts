/**
 * Smart Category Filtering
 *
 * Maps source types and entity types to relevant categories
 * for expenses and income to show only contextually appropriate options.
 */

// =============================================================================
// EXPENSE CATEGORIES
// =============================================================================

export type ExpenseCategory =
  | 'HOUSING'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'OTHER';

export type ExpenseSourceType = 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';

export type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'FURNITURE' | 'EQUIPMENT' | 'COLLECTIBLE' | 'OTHER';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOUSING: 'Housing',
  RATES: 'Rates',
  INSURANCE: 'Insurance',
  MAINTENANCE: 'Maintenance',
  PERSONAL: 'Personal',
  UTILITIES: 'Utilities',
  FOOD: 'Food',
  TRANSPORT: 'Transport',
  ENTERTAINMENT: 'Entertainment',
  STRATA: 'Strata',
  LAND_TAX: 'Land Tax',
  LOAN_INTEREST: 'Loan Interest',
  OTHER: 'Other',
};

// Categories allowed for each source type
const EXPENSE_CATEGORIES_BY_SOURCE: Record<ExpenseSourceType, ExpenseCategory[]> = {
  GENERAL: [
    'HOUSING', 'RATES', 'INSURANCE', 'MAINTENANCE', 'PERSONAL',
    'UTILITIES', 'FOOD', 'TRANSPORT', 'ENTERTAINMENT', 'STRATA',
    'LAND_TAX', 'LOAN_INTEREST', 'OTHER'
  ],
  PROPERTY: [
    'HOUSING', 'RATES', 'INSURANCE', 'MAINTENANCE', 'UTILITIES',
    'STRATA', 'LAND_TAX', 'OTHER'
  ],
  LOAN: [
    'LOAN_INTEREST', 'OTHER'
  ],
  INVESTMENT: [
    'PERSONAL', 'OTHER' // Account fees, brokerage fees, etc.
  ],
  ASSET: [
    // This is overridden by asset type - see below
    'INSURANCE', 'MAINTENANCE', 'PERSONAL', 'TRANSPORT', 'OTHER'
  ],
};

// Categories allowed for each asset type
const EXPENSE_CATEGORIES_BY_ASSET_TYPE: Record<AssetType, ExpenseCategory[]> = {
  VEHICLE: [
    'TRANSPORT',    // Fuel, tolls, registration
    'INSURANCE',    // Vehicle insurance
    'MAINTENANCE',  // Servicing, repairs
    'OTHER'
  ],
  ELECTRONICS: [
    'PERSONAL',     // Accessories, subscriptions
    'INSURANCE',    // Device insurance
    'MAINTENANCE',  // Repairs
    'OTHER'
  ],
  FURNITURE: [
    'PERSONAL',     // Cleaning, care products
    'MAINTENANCE',  // Repairs, restoration
    'OTHER'
  ],
  EQUIPMENT: [
    'MAINTENANCE',  // Servicing, repairs
    'INSURANCE',    // Equipment insurance
    'OTHER'
  ],
  COLLECTIBLE: [
    'INSURANCE',    // Collectible insurance
    'MAINTENANCE',  // Conservation, restoration
    'OTHER'
  ],
  OTHER: [
    'INSURANCE', 'MAINTENANCE', 'PERSONAL', 'OTHER'
  ],
};

/**
 * Get allowed expense categories based on source type and optionally asset type
 */
export function getExpenseCategories(
  sourceType: ExpenseSourceType,
  assetType?: AssetType | null
): ExpenseCategory[] {
  if (sourceType === 'ASSET' && assetType) {
    return EXPENSE_CATEGORIES_BY_ASSET_TYPE[assetType] || EXPENSE_CATEGORIES_BY_ASSET_TYPE.OTHER;
  }
  return EXPENSE_CATEGORIES_BY_SOURCE[sourceType];
}

/**
 * Get expense category options for select dropdown
 */
export function getExpenseCategoryOptions(
  sourceType: ExpenseSourceType,
  assetType?: AssetType | null
): Array<{ value: ExpenseCategory; label: string }> {
  const categories = getExpenseCategories(sourceType, assetType);
  return categories.map(cat => ({
    value: cat,
    label: EXPENSE_CATEGORY_LABELS[cat],
  }));
}

/**
 * Check if a category is valid for a given source type and asset type
 */
export function isValidExpenseCategory(
  category: ExpenseCategory,
  sourceType: ExpenseSourceType,
  assetType?: AssetType | null
): boolean {
  const validCategories = getExpenseCategories(sourceType, assetType);
  return validCategories.includes(category);
}

/**
 * Get the default category for a source type and asset type
 */
export function getDefaultExpenseCategory(
  sourceType: ExpenseSourceType,
  assetType?: AssetType | null
): ExpenseCategory {
  const categories = getExpenseCategories(sourceType, assetType);

  // Return sensible defaults based on source
  switch (sourceType) {
    case 'PROPERTY':
      return 'HOUSING';
    case 'LOAN':
      return 'LOAN_INTEREST';
    case 'INVESTMENT':
      return 'PERSONAL';
    case 'ASSET':
      if (assetType === 'VEHICLE') return 'TRANSPORT';
      return 'MAINTENANCE';
    default:
      return 'OTHER';
  }
}

// =============================================================================
// INCOME TYPES
// =============================================================================

export type IncomeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';

export type IncomeSourceType = 'GENERAL' | 'PROPERTY' | 'INVESTMENT';

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  SALARY: 'Salary',
  RENT: 'Rent',
  RENTAL: 'Rental',
  INVESTMENT: 'Investment',
  OTHER: 'Other',
};

// Income types allowed for each source type
const INCOME_TYPES_BY_SOURCE: Record<IncomeSourceType, IncomeType[]> = {
  GENERAL: ['SALARY', 'RENT', 'RENTAL', 'INVESTMENT', 'OTHER'],
  PROPERTY: ['RENT', 'RENTAL', 'OTHER'],
  INVESTMENT: ['INVESTMENT', 'OTHER'],
};

/**
 * Get allowed income types based on source type
 */
export function getIncomeTypes(sourceType: IncomeSourceType): IncomeType[] {
  return INCOME_TYPES_BY_SOURCE[sourceType] || INCOME_TYPES_BY_SOURCE.GENERAL;
}

/**
 * Get income type options for select dropdown
 */
export function getIncomeTypeOptions(
  sourceType: IncomeSourceType
): Array<{ value: IncomeType; label: string }> {
  const types = getIncomeTypes(sourceType);
  return types.map(type => ({
    value: type,
    label: INCOME_TYPE_LABELS[type],
  }));
}

/**
 * Check if an income type is valid for a given source type
 */
export function isValidIncomeType(
  incomeType: IncomeType,
  sourceType: IncomeSourceType
): boolean {
  const validTypes = getIncomeTypes(sourceType);
  return validTypes.includes(incomeType);
}

/**
 * Get the default income type for a source type
 */
export function getDefaultIncomeType(sourceType: IncomeSourceType): IncomeType {
  switch (sourceType) {
    case 'PROPERTY':
      return 'RENTAL';
    case 'INVESTMENT':
      return 'INVESTMENT';
    default:
      return 'OTHER';
  }
}
