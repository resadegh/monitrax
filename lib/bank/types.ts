/**
 * Phase 18: Bank Transaction Import Types
 * Type definitions for bank transaction import, parsing, and categorisation
 */

// =============================================================================
// FILE PARSING TYPES
// =============================================================================

export type ImportFileFormat = 'CSV' | 'OFX' | 'QIF' | 'JSON';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
export type DuplicatePolicy = 'REJECT' | 'MARK_DUPLICATE' | 'MERGE' | 'SKIP';
export type TransactionDirection = 'IN' | 'OUT';

export interface RawTransaction {
  rowNumber: number;
  rawData: Record<string, string>;
  date?: Date;
  description?: string;
  amount?: number;
  direction?: TransactionDirection;
  balance?: number;
  reference?: string;
}

export interface ParsedFile {
  format: ImportFileFormat;
  transactions: RawTransaction[];
  totalRows: number;
  headers?: string[];
  metadata?: Record<string, unknown>;
  closingBalance?: number; // Last balance value from file
  openingBalance?: number; // First balance value from file
}

export interface ParseOptions {
  dateFormat?: string;
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  balanceColumn?: string;
  referenceColumn?: string;
  skipRows?: number;
  hasHeader?: boolean;
}

// =============================================================================
// NORMALISATION TYPES
// =============================================================================

export interface NormalisedTransaction {
  id: string;
  date: Date;
  description: string;
  rawDescription: string;
  amount: number;
  direction: TransactionDirection;
  bankAccountId?: string;
  sourceFileId: string;
  hash: string;
  merchantRaw?: string;
  merchantStandardised?: string;
  balance?: number;
  reference?: string;
}

export interface NormalisationResult {
  transactions: NormalisedTransaction[];
  errors: NormalisationError[];
  statistics: {
    total: number;
    normalised: number;
    failed: number;
  };
}

export interface NormalisationError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
}

// =============================================================================
// CATEGORISATION TYPES
// =============================================================================

export type CategoryType =
  | 'PROPERTY_EXPENSE'
  | 'PERSONAL_EXPENSE'
  | 'INVESTMENT_EXPENSE'
  | 'INCOME'
  | 'TRANSFER'
  | 'UNKNOWN';

export type RuleType = 'MERCHANT' | 'KEYWORD' | 'MCC' | 'BPAY' | 'AMOUNT_RANGE';

export interface CategoryRule {
  id: string;
  userId?: string | null;
  ruleType: RuleType;
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  categoryLevel1: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  linkToPropertyId?: string | null;
  linkToLoanId?: string | null;
  linkToExpenseId?: string | null;
  priority: number;
  isActive: boolean;
}

export interface CategorisedTransaction extends NormalisedTransaction {
  categoryType: CategoryType;
  categoryLevel1: string;
  categoryLevel2?: string;
  subcategory?: string;
  confidenceScore: number;
  matchedRuleId?: string;
  linkedPropertyId?: string;
  linkedLoanId?: string;
  linkedExpenseId?: string;
}

export interface CategorisationResult {
  transactions: CategorisedTransaction[];
  statistics: {
    total: number;
    categorised: number;
    uncategorised: number;
    byCategory: Record<string, number>;
  };
}

// =============================================================================
// DUPLICATE DETECTION TYPES
// =============================================================================

export interface DuplicateCheckResult {
  transaction: NormalisedTransaction;
  isDuplicate: boolean;
  duplicateOf?: string; // ID of the duplicate transaction
  similarityScore?: number;
  reason?: string;
}

export interface DuplicateDetectionResult {
  unique: NormalisedTransaction[];
  duplicates: DuplicateCheckResult[];
  statistics: {
    total: number;
    unique: number;
    duplicates: number;
  };
}

// =============================================================================
// BUDGET COMPARISON TYPES
// =============================================================================

export type BudgetStatus = 'UNDER' | 'OVER' | 'ON_TRACK' | 'WARNING';

export interface BudgetTarget {
  id: string;
  userId: string;
  categoryLevel1: string;
  categoryLevel2?: string | null;
  monthlyTarget: number;
  warningThreshold: number;
  isEssential: boolean;
}

export interface BudgetComparisonResult {
  category: string;
  subcategory?: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
  status: BudgetStatus;
  isEssential: boolean;
  transactions: number;
}

export interface MonthlyBudgetReport {
  month: string; // YYYY-MM
  results: BudgetComparisonResult[];
  summary: {
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    savingsAchieved: number;
    savingsTarget: number;
    savingsRate: number;
    categoriesOverBudget: number;
    categoriesUnderBudget: number;
  };
  insights: BudgetInsight[];
}

export interface BudgetInsight {
  type: 'WARNING' | 'INFO' | 'SUCCESS' | 'ALERT';
  category: string;
  message: string;
  value?: number;
}

// =============================================================================
// IMPORT WIZARD TYPES
// =============================================================================

export interface ImportWizardStep {
  step: number;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface ImportPreview {
  fileId: string;
  filename: string;
  format: ImportFileFormat;
  transactions: RawTransaction[];
  suggestedMappings: ParseOptions;
  duplicateCount: number;
  dateRange?: { from: Date; to: Date };
}

export interface ImportResult {
  fileId: string;
  status: ImportStatus;
  statistics: {
    total: number;
    imported: number;
    duplicates: number;
    errors: number;
  };
  errors?: ImportError[];
}

export interface ImportError {
  rowNumber: number;
  message: string;
  field?: string;
}

// =============================================================================
// MERCHANT MAPPING TYPES
// =============================================================================

export interface MerchantMapping {
  id: string;
  userId?: string | null;
  merchantRaw: string;
  merchantStandardised: string;
  merchantCategoryCode?: string | null;
  categoryLevel1: string;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  confidence: number;
  source: 'RULE' | 'USER' | 'AI';
  usageCount: number;
}

// =============================================================================
// FINANCIAL HEALTH REPORT TYPES
// =============================================================================

export interface MonthlyHealthReport {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;
  savingsTarget: number;
  categoryBreakdown: CategoryBreakdown[];
  insights: HealthInsight[];
  comparisonToPrevious?: {
    incomeChange: number;
    expenseChange: number;
    savingsChange: number;
  };
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  changeFromPrevious?: number;
}

export interface HealthInsight {
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'ACTION';
  message: string;
  category?: string;
  value?: number;
}
