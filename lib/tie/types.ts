/**
 * TRANSACTION INTELLIGENCE ENGINE (TIE) - TYPES
 * Phase 13 - Transactional Intelligence
 *
 * TypeScript types for the TIE engine, matching Prisma schema.
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.3
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type TransactionSource = 'BANK' | 'CSV' | 'OFX' | 'MANUAL';

export type RecurrencePattern =
  | 'WEEKLY'
  | 'FORTNIGHTLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUALLY'
  | 'IRREGULAR';

export type AnomalyType =
  | 'DUPLICATE'
  | 'UNUSUAL_AMOUNT'
  | 'NEW_MERCHANT'
  | 'PRICE_INCREASE'
  | 'UNEXPECTED_CATEGORY'
  | 'TIMING_ANOMALY';

export type TransactionDirection = 'IN' | 'OUT';

// =============================================================================
// UNIFIED TRANSACTION RECORD (UTR)
// =============================================================================

/**
 * UnifiedTransaction represents the enriched transaction record
 * after processing through the TIE pipeline.
 */
export interface UnifiedTransaction {
  id: string;
  userId: string;
  accountId: string;

  // Core transaction data
  date: Date;
  postDate?: Date | null;
  amount: number;
  currency: string;
  direction: TransactionDirection;

  // Merchant data
  merchantRaw?: string | null;
  merchantStandardised?: string | null;
  merchantCategoryCode?: string | null;
  description: string;

  // Category hierarchy
  categoryLevel1?: string | null;
  categoryLevel2?: string | null;
  subcategory?: string | null;

  // User interaction
  tags: string[];
  userCorrectedCategory: boolean;
  confidenceScore?: number | null;

  // Recurring detection
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern | null;
  recurrenceGroupId?: string | null;

  // Anomaly detection
  anomalyFlags: AnomalyType[];

  // Source tracking
  source: TransactionSource;
  externalId?: string | null;
  importBatchId?: string | null;

  // Entity linking (GRDCS)
  propertyId?: string | null;
  loanId?: string | null;
  incomeId?: string | null;
  expenseId?: string | null;
  investmentAccountId?: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
}

// =============================================================================
// INGESTION TYPES
// =============================================================================

/**
 * Raw transaction input before normalisation
 */
export interface RawTransactionInput {
  // Required fields
  date: string | Date;
  amount: number;
  description: string;

  // Optional identification
  externalId?: string;
  accountId?: string;

  // Optional merchant info
  merchantRaw?: string;
  merchantCategoryCode?: string;

  // Optional settlement
  postDate?: string | Date;

  // Optional direction (if not inferrable from amount sign)
  direction?: TransactionDirection;

  // Source metadata
  source: TransactionSource;
  importBatchId?: string;
}

/**
 * Result of the normalisation step
 */
export interface NormalisedTransaction {
  // Core data (validated)
  date: Date;
  postDate: Date | null;
  amount: number; // Always positive
  direction: TransactionDirection;
  currency: string;
  description: string;

  // Merchant (cleaned)
  merchantRaw: string | null;
  merchantCleaned: string | null;
  merchantCategoryCode: string | null;

  // Source tracking
  source: TransactionSource;
  externalId: string | null;
  importBatchId: string | null;

  // Duplicate detection hash
  deduplicationHash: string;
}

/**
 * CSV import row format
 */
export interface CSVTransactionRow {
  date: string;
  amount: string;
  description: string;
  reference?: string;
  balance?: string;
  category?: string;
}

/**
 * Import batch result
 */
export interface ImportBatchResult {
  batchId: string;
  source: TransactionSource;
  totalRows: number;
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails: ImportError[];
  transactions: UnifiedTransaction[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
}

// =============================================================================
// MERCHANT MAPPING TYPES
// =============================================================================

export interface MerchantMapping {
  id: string;
  userId: string | null; // Null = global
  merchantRaw: string;
  merchantStandardised: string;
  merchantCategoryCode: string | null;
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  confidence: number;
  source: 'RULE' | 'USER' | 'AI';
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// RECURRING PAYMENT TYPES
// =============================================================================

export interface RecurringPayment {
  id: string;
  userId: string;
  merchantStandardised: string;
  accountId: string;
  pattern: RecurrencePattern;
  expectedAmount: number;
  amountVariance: number;
  lastOccurrence: Date;
  nextExpected: Date | null;
  occurrenceCount: number;
  priceIncreaseAlert: boolean;
  lastPriceChange: number | null;
  lastPriceChangeDate: Date | null;
  isActive: boolean;
  isPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SPENDING PROFILE TYPES
// =============================================================================

export interface CategoryAverage {
  avgMonthly: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  volatility: number; // 0-1
  transactionCount: number;
}

export interface MonthlyPattern {
  totalSpend: number;
  categories: Record<string, number>;
}

export interface SpendingCluster {
  name: string;
  merchants: string[];
  avgMonthly: number;
}

export interface SpendingProfile {
  id: string;
  userId: string;
  categoryAverages: Record<string, CategoryAverage>;
  monthlyPatterns: Record<string, MonthlyPattern> | null;
  seasonalityFactors: Record<string, Record<string, number>> | null;
  spendingClusters: SpendingCluster[] | null;
  overallVolatility: number;
  categoryVolatility: Record<string, number> | null;
  predictedMonthlySpend: number | null;
  predictionConfidence: number | null;
  dataPointCount: number;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// CATEGORY TYPES (Standard Australian categories)
// =============================================================================

/**
 * Standard category hierarchy for Australian consumers
 * Based on common banking categories
 */
export const CATEGORY_HIERARCHY: Record<string, string[]> = {
  'Food & Dining': [
    'Groceries',
    'Restaurants',
    'Fast Food',
    'Coffee & Cafes',
    'Alcohol & Bars',
    'Food Delivery',
  ],
  'Transport': [
    'Fuel',
    'Public Transport',
    'Rideshare',
    'Parking',
    'Car Maintenance',
    'Registration & Insurance',
    'Tolls',
  ],
  'Shopping': [
    'Clothing',
    'Electronics',
    'Home & Garden',
    'Department Stores',
    'Online Shopping',
    'Gifts',
  ],
  'Bills & Utilities': [
    'Electricity',
    'Gas',
    'Water',
    'Internet',
    'Mobile Phone',
    'Council Rates',
    'Body Corporate',
  ],
  'Housing': [
    'Rent',
    'Mortgage',
    'Home Insurance',
    'Repairs & Maintenance',
    'Furniture',
  ],
  'Health': [
    'Medical',
    'Dental',
    'Pharmacy',
    'Health Insurance',
    'Fitness & Gym',
    'Optical',
  ],
  'Entertainment': [
    'Streaming Services',
    'Movies & Shows',
    'Gaming',
    'Sports & Events',
    'Hobbies',
    'Books & Magazines',
  ],
  'Personal Care': [
    'Hair & Beauty',
    'Skincare',
    'Spa & Wellness',
  ],
  'Education': [
    'Tuition',
    'Books & Supplies',
    'Courses & Training',
    'Student Loans',
  ],
  'Travel': [
    'Flights',
    'Hotels',
    'Car Rental',
    'Travel Insurance',
    'Activities & Tours',
  ],
  'Financial': [
    'Bank Fees',
    'Interest Payments',
    'Investment Fees',
    'Insurance Premiums',
    'Tax Payments',
    'Superannuation',
  ],
  'Income': [
    'Salary',
    'Rental Income',
    'Dividends',
    'Interest Earned',
    'Refunds',
    'Government Benefits',
    'Other Income',
  ],
  'Transfers': [
    'Internal Transfer',
    'External Transfer',
    'Pay Someone',
    'BPAY',
  ],
  'Cash & ATM': [
    'ATM Withdrawal',
    'Cash Deposit',
  ],
  'Other': [
    'Uncategorised',
    'Miscellaneous',
  ],
};

/**
 * Flattened list of all categories
 */
export const ALL_CATEGORIES = Object.entries(CATEGORY_HIERARCHY).flatMap(
  ([level1, level2s]) => level2s.map((level2) => ({ level1, level2 }))
);

// =============================================================================
// PROCESSING TYPES
// =============================================================================

export interface TIEProcessingResult {
  transaction: UnifiedTransaction;
  categorisationApplied: boolean;
  anomaliesDetected: AnomalyType[];
  recurringDetected: boolean;
  merchantMapped: boolean;
  confidenceScore: number;
}

export interface TIEBatchProcessingResult {
  processed: number;
  categorised: number;
  anomaliesFound: number;
  recurringFound: number;
  errors: number;
  results: TIEProcessingResult[];
}
