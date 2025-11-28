/**
 * Phase 18: Auto-Categorisation Engine
 * Rule-based transaction categorisation (no AI dependency)
 */

import {
  NormalisedTransaction,
  CategorisedTransaction,
  CategorisationResult,
  CategoryRule,
  CategoryType,
  RuleType,
} from './types';

// =============================================================================
// DEFAULT CATEGORY RULES
// =============================================================================

/**
 * Built-in categorisation rules for Australian transactions
 * Higher priority rules are checked first
 */
const DEFAULT_RULES: Omit<CategoryRule, 'id'>[] = [
  // === INCOME ===
  { ruleType: 'KEYWORD', pattern: 'salary', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Salary', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'wages', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Salary', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'payroll', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Salary', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'dividend', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Investment', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'interest', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Interest', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'centrelink', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Government', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'ato refund', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Tax Refund', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'rental income', isRegex: false, caseSensitive: false, categoryLevel1: 'Income', categoryLevel2: 'Rent', priority: 90, isActive: true },

  // === TRANSFERS ===
  { ruleType: 'KEYWORD', pattern: 'transfer from', isRegex: false, caseSensitive: false, categoryLevel1: 'Transfer', categoryLevel2: 'Internal', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'transfer to', isRegex: false, caseSensitive: false, categoryLevel1: 'Transfer', categoryLevel2: 'Internal', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'internal transfer', isRegex: false, caseSensitive: false, categoryLevel1: 'Transfer', categoryLevel2: 'Internal', priority: 100, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'osko', isRegex: false, caseSensitive: false, categoryLevel1: 'Transfer', categoryLevel2: 'External', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'pay/id', isRegex: false, caseSensitive: false, categoryLevel1: 'Transfer', categoryLevel2: 'External', priority: 80, isActive: true },

  // === PROPERTY EXPENSES ===
  { ruleType: 'KEYWORD', pattern: 'council rates', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Rates', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'water rates', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Water', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'strata', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Strata', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'body corporate', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Strata', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'land tax', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Land Tax', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'property management', isRegex: false, caseSensitive: false, categoryLevel1: 'Property', categoryLevel2: 'Management', priority: 90, isActive: true },

  // === UTILITIES ===
  { ruleType: 'MERCHANT', pattern: 'AGL', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Electricity', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Origin Energy', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Gas', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Energy Australia', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Electricity', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Sydney Water', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Water', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Telstra', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Phone', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Optus', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Phone', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Vodafone', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Phone', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'nbn', isRegex: false, caseSensitive: false, categoryLevel1: 'Utilities', categoryLevel2: 'Internet', priority: 85, isActive: true },

  // === GROCERIES ===
  { ruleType: 'MERCHANT', pattern: 'Woolworths', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Groceries', subcategory: 'Supermarket', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Coles', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Groceries', subcategory: 'Supermarket', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'ALDI', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Groceries', subcategory: 'Supermarket', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'IGA', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Groceries', subcategory: 'Supermarket', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Costco', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Groceries', subcategory: 'Wholesale', priority: 85, isActive: true },

  // === DINING ===
  { ruleType: 'MERCHANT', pattern: 'McDonald\'s', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Fast Food', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'KFC', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Fast Food', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Hungry Jacks', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Fast Food', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Subway', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Fast Food', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Domino\'s', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Fast Food', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'restaurant', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Restaurant', priority: 70, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'cafe', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Cafe', priority: 70, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'coffee', isRegex: false, caseSensitive: false, categoryLevel1: 'Food & Dining', categoryLevel2: 'Cafe', priority: 70, isActive: true },

  // === TRANSPORT ===
  { ruleType: 'MERCHANT', pattern: 'BP', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Fuel', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Shell', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Fuel', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Caltex', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Fuel', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Ampol', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Fuel', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: '7-Eleven', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Fuel', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Uber', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Rideshare', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'opal', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Public Transport', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'myki', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Public Transport', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'go card', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Public Transport', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'parking', isRegex: false, caseSensitive: false, categoryLevel1: 'Transport', categoryLevel2: 'Parking', priority: 75, isActive: true },

  // === ENTERTAINMENT & SUBSCRIPTIONS ===
  { ruleType: 'MERCHANT', pattern: 'Netflix', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Streaming', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Spotify', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Streaming', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Stan', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Streaming', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Disney+', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Streaming', priority: 90, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Amazon', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Online', priority: 75, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'cinema', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Cinema', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'hoyts', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Cinema', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'event cinemas', isRegex: false, caseSensitive: false, categoryLevel1: 'Entertainment', categoryLevel2: 'Cinema', priority: 85, isActive: true },

  // === INSURANCE ===
  { ruleType: 'KEYWORD', pattern: 'insurance', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'General', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'NRMA', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'Vehicle', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'RACV', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'Vehicle', priority: 85, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Suncorp', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'General', priority: 80, isActive: true },
  { ruleType: 'MERCHANT', pattern: 'Allianz', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'General', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'health insurance', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'Health', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'medibank', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'Health', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'bupa', isRegex: false, caseSensitive: false, categoryLevel1: 'Insurance', categoryLevel2: 'Health', priority: 85, isActive: true },

  // === HEALTH ===
  { ruleType: 'KEYWORD', pattern: 'pharmacy', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Pharmacy', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'chemist', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Pharmacy', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'doctor', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Medical', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'medical', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Medical', priority: 75, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'dentist', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Dental', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'gym', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Fitness', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'fitness', isRegex: false, caseSensitive: false, categoryLevel1: 'Health', categoryLevel2: 'Fitness', priority: 75, isActive: true },

  // === SHOPPING ===
  { ruleType: 'KEYWORD', pattern: 'kmart', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Department Store', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'target', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Department Store', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'big w', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Department Store', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'myer', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Department Store', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'david jones', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Department Store', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'bunnings', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Hardware', priority: 85, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'officeworks', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Office', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'jb hi-fi', isRegex: false, caseSensitive: false, categoryLevel1: 'Shopping', categoryLevel2: 'Electronics', priority: 85, isActive: true },

  // === LOANS & FINANCE ===
  { ruleType: 'KEYWORD', pattern: 'loan repayment', isRegex: false, caseSensitive: false, categoryLevel1: 'Finance', categoryLevel2: 'Loan Repayment', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'mortgage', isRegex: false, caseSensitive: false, categoryLevel1: 'Finance', categoryLevel2: 'Mortgage', priority: 95, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'home loan', isRegex: false, caseSensitive: false, categoryLevel1: 'Finance', categoryLevel2: 'Mortgage', priority: 95, isActive: true },

  // === EDUCATION ===
  { ruleType: 'KEYWORD', pattern: 'school', isRegex: false, caseSensitive: false, categoryLevel1: 'Education', categoryLevel2: 'School Fees', priority: 75, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'university', isRegex: false, caseSensitive: false, categoryLevel1: 'Education', categoryLevel2: 'University', priority: 80, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'tafe', isRegex: false, caseSensitive: false, categoryLevel1: 'Education', categoryLevel2: 'TAFE', priority: 80, isActive: true },

  // === ATM & CASH ===
  { ruleType: 'KEYWORD', pattern: 'atm', isRegex: false, caseSensitive: false, categoryLevel1: 'Cash', categoryLevel2: 'ATM Withdrawal', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'cash withdrawal', isRegex: false, caseSensitive: false, categoryLevel1: 'Cash', categoryLevel2: 'ATM Withdrawal', priority: 90, isActive: true },

  // === FEES ===
  { ruleType: 'KEYWORD', pattern: 'bank fee', isRegex: false, caseSensitive: false, categoryLevel1: 'Fees', categoryLevel2: 'Bank Fees', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'account fee', isRegex: false, caseSensitive: false, categoryLevel1: 'Fees', categoryLevel2: 'Bank Fees', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'overdrawn fee', isRegex: false, caseSensitive: false, categoryLevel1: 'Fees', categoryLevel2: 'Bank Fees', priority: 90, isActive: true },
  { ruleType: 'KEYWORD', pattern: 'international fee', isRegex: false, caseSensitive: false, categoryLevel1: 'Fees', categoryLevel2: 'Bank Fees', priority: 90, isActive: true },
];

// =============================================================================
// CATEGORISATION ENGINE
// =============================================================================

/**
 * Check if a rule matches a transaction
 */
function matchesRule(
  transaction: NormalisedTransaction,
  rule: CategoryRule | Omit<CategoryRule, 'id'>
): boolean {
  const searchText = rule.ruleType === 'MERCHANT'
    ? transaction.merchantStandardised ?? transaction.description
    : transaction.description;

  if (!searchText) return false;

  const compareText = rule.caseSensitive ? searchText : searchText.toLowerCase();
  const pattern = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();

  if (rule.isRegex) {
    try {
      const regex = new RegExp(pattern, rule.caseSensitive ? '' : 'i');
      return regex.test(searchText);
    } catch {
      return false;
    }
  }

  return compareText.includes(pattern);
}

/**
 * Determine category type from category level 1
 */
function determineCategoryType(
  categoryLevel1: string,
  direction: 'IN' | 'OUT'
): CategoryType {
  const incomeCategories = ['Income'];
  const transferCategories = ['Transfer'];
  const propertyCategories = ['Property'];
  const investmentCategories = ['Investment'];

  if (incomeCategories.includes(categoryLevel1)) return 'INCOME';
  if (transferCategories.includes(categoryLevel1)) return 'TRANSFER';
  if (direction === 'IN') return 'INCOME';
  if (propertyCategories.includes(categoryLevel1)) return 'PROPERTY_EXPENSE';
  if (investmentCategories.includes(categoryLevel1)) return 'INVESTMENT_EXPENSE';

  return 'PERSONAL_EXPENSE';
}

/**
 * Categorise a single transaction
 */
function categoriseTransaction(
  transaction: NormalisedTransaction,
  rules: (CategoryRule | Omit<CategoryRule, 'id'>)[]
): CategorisedTransaction {
  // Sort rules by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (!rule.isActive) continue;

    if (matchesRule(transaction, rule)) {
      return {
        ...transaction,
        categoryType: determineCategoryType(rule.categoryLevel1, transaction.direction),
        categoryLevel1: rule.categoryLevel1,
        categoryLevel2: rule.categoryLevel2 ?? undefined,
        subcategory: rule.subcategory ?? undefined,
        confidenceScore: 0.9, // Rule-based = high confidence
        matchedRuleId: 'id' in rule ? rule.id : undefined,
        linkedPropertyId: rule.linkToPropertyId ?? undefined,
        linkedLoanId: rule.linkToLoanId ?? undefined,
        linkedExpenseId: rule.linkToExpenseId ?? undefined,
      };
    }
  }

  // No rule matched - return as uncategorised
  return {
    ...transaction,
    categoryType: 'UNKNOWN',
    categoryLevel1: 'Uncategorised',
    categoryLevel2: undefined,
    subcategory: undefined,
    confidenceScore: 0,
    matchedRuleId: undefined,
  };
}

/**
 * Categorise multiple transactions
 */
export function categoriseTransactions(
  transactions: NormalisedTransaction[],
  userRules: CategoryRule[] = []
): CategorisationResult {
  // Combine user rules with default rules (user rules take precedence)
  const allRules = [...userRules, ...DEFAULT_RULES];

  const categorised: CategorisedTransaction[] = [];
  const statistics = {
    total: transactions.length,
    categorised: 0,
    uncategorised: 0,
    byCategory: {} as Record<string, number>,
  };

  for (const transaction of transactions) {
    const result = categoriseTransaction(transaction, allRules);
    categorised.push(result);

    if (result.categoryType !== 'UNKNOWN') {
      statistics.categorised++;
      statistics.byCategory[result.categoryLevel1] =
        (statistics.byCategory[result.categoryLevel1] ?? 0) + 1;
    } else {
      statistics.uncategorised++;
    }
  }

  return {
    transactions: categorised,
    statistics,
  };
}

/**
 * Get default category rules
 */
export function getDefaultRules(): Omit<CategoryRule, 'id'>[] {
  return DEFAULT_RULES;
}

/**
 * Get all unique category level 1 values
 */
export function getCategoryLevel1Options(): string[] {
  const categories = new Set<string>();
  for (const rule of DEFAULT_RULES) {
    categories.add(rule.categoryLevel1);
  }
  return Array.from(categories).sort();
}

/**
 * Get category level 2 options for a given level 1
 */
export function getCategoryLevel2Options(categoryLevel1: string): string[] {
  const categories = new Set<string>();
  for (const rule of DEFAULT_RULES) {
    if (rule.categoryLevel1 === categoryLevel1 && rule.categoryLevel2) {
      categories.add(rule.categoryLevel2);
    }
  }
  return Array.from(categories).sort();
}
