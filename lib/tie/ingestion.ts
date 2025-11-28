/**
 * TRANSACTION INTELLIGENCE ENGINE (TIE) - INGESTION PIPELINE
 * Phase 13 - Transactional Intelligence
 *
 * Handles:
 * - Raw transaction ingestion from multiple sources
 * - Data normalisation and cleaning
 * - Merchant string standardisation
 * - De-duplication via hashing
 * - Timezone alignment
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.4 Steps 1-2
 */

import { createHash } from 'crypto';
import {
  RawTransactionInput,
  NormalisedTransaction,
  CSVTransactionRow,
  ImportBatchResult,
  ImportError,
  TransactionSource,
  TransactionDirection,
  UnifiedTransaction,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Common merchant name variations to standardise
 */
const MERCHANT_ALIASES: Record<string, string> = {
  // Supermarkets
  'woolworths': 'Woolworths',
  'woolies': 'Woolworths',
  'woolworths marketplace': 'Woolworths',
  'ww metro': 'Woolworths Metro',
  'coles': 'Coles',
  'coles express': 'Coles Express',
  'aldi': 'ALDI',
  'iga': 'IGA',

  // Fast food
  'mcdonald': 'McDonald\'s',
  'mcdonalds': 'McDonald\'s',
  'maccas': 'McDonald\'s',
  'kfc': 'KFC',
  'hungry jacks': 'Hungry Jack\'s',
  'hungry jack': 'Hungry Jack\'s',
  'subway': 'Subway',
  'dominos': 'Domino\'s',
  'domino': 'Domino\'s',

  // Fuel
  'bp': 'BP',
  'shell': 'Shell',
  'caltex': 'Caltex',
  'ampol': 'Ampol',
  '7-eleven': '7-Eleven',
  '7eleven': '7-Eleven',
  'seven eleven': '7-Eleven',

  // Transport
  'uber': 'Uber',
  'uber eats': 'Uber Eats',
  'didi': 'DiDi',
  'ola': 'Ola',

  // Streaming
  'netflix': 'Netflix',
  'spotify': 'Spotify',
  'apple': 'Apple',
  'google': 'Google',
  'amazon': 'Amazon',
  'prime video': 'Amazon Prime Video',

  // Telcos
  'telstra': 'Telstra',
  'optus': 'Optus',
  'vodafone': 'Vodafone',

  // Banks
  'commbank': 'Commonwealth Bank',
  'cba': 'Commonwealth Bank',
  'westpac': 'Westpac',
  'nab': 'NAB',
  'anz': 'ANZ',

  // Retail
  'kmart': 'Kmart',
  'target': 'Target',
  'big w': 'Big W',
  'jb hi-fi': 'JB Hi-Fi',
  'jb hifi': 'JB Hi-Fi',
  'harvey norman': 'Harvey Norman',
  'bunnings': 'Bunnings',
  'officeworks': 'Officeworks',
};

/**
 * Patterns to remove from merchant strings
 */
const MERCHANT_NOISE_PATTERNS = [
  /\b(au|aus|australia)\b/gi,
  /\b(pty|ltd|limited|inc|corp)\b/gi,
  /\b(card|visa|mastercard|mc|eftpos)\b/gi,
  /\b(payment|pmt|purchase|pos)\b/gi,
  /\b(direct debit|dd|transfer|tfr)\b/gi,
  /\d{4,}/g, // Long numbers (card refs, etc)
  /[*#]+/g, // Asterisks and hashes
  /\s{2,}/g, // Multiple spaces
];

/**
 * Common transfer/internal transaction patterns
 */
const TRANSFER_PATTERNS = [
  /^transfer\s+(to|from)/i,
  /^(internal|inter)\s*account/i,
  /^pay\s+anyone/i,
  /^osko/i,
  /^bpay/i,
  /^direct\s+(debit|credit)/i,
];

// =============================================================================
// NORMALISATION FUNCTIONS
// =============================================================================

/**
 * Parse date from various formats
 */
export function parseTransactionDate(input: string | Date): Date {
  if (input instanceof Date) {
    return input;
  }

  // Try common date formats
  const formats = [
    // ISO
    /^(\d{4})-(\d{2})-(\d{2})/,
    // Australian DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // US MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})/,
  ];

  // Try ISO first
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try Australian format (DD/MM/YYYY)
  const auMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (auMatch) {
    const [, day, month, year] = auMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback - throw for invalid
  throw new Error(`Unable to parse date: ${input}`);
}

/**
 * Normalise amount to positive number and determine direction
 */
export function normaliseAmount(
  amount: number,
  explicitDirection?: TransactionDirection
): { amount: number; direction: TransactionDirection } {
  if (explicitDirection) {
    return { amount: Math.abs(amount), direction: explicitDirection };
  }

  // Negative = outgoing, Positive = incoming
  if (amount < 0) {
    return { amount: Math.abs(amount), direction: 'OUT' };
  }
  return { amount, direction: 'IN' };
}

/**
 * Clean and standardise merchant name
 */
export function cleanMerchantName(rawMerchant: string | null | undefined): string | null {
  if (!rawMerchant) return null;

  let cleaned = rawMerchant.trim();

  // Convert to lowercase for matching
  const lower = cleaned.toLowerCase();

  // Check for known aliases
  for (const [alias, standard] of Object.entries(MERCHANT_ALIASES)) {
    if (lower.includes(alias)) {
      return standard;
    }
  }

  // Remove noise patterns
  for (const pattern of MERCHANT_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Title case if all caps or all lower
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return cleaned || null;
}

/**
 * Generate deduplication hash for a transaction
 */
export function generateDeduplicationHash(
  accountId: string,
  date: Date,
  amount: number,
  description: string
): string {
  const normalised = [
    accountId,
    date.toISOString().split('T')[0], // Date only
    amount.toFixed(2),
    description.toLowerCase().replace(/\s+/g, ''),
  ].join('|');

  return createHash('sha256').update(normalised).digest('hex').substring(0, 16);
}

/**
 * Check if transaction is a transfer/internal
 */
export function isTransferTransaction(description: string): boolean {
  return TRANSFER_PATTERNS.some((pattern) => pattern.test(description));
}

// =============================================================================
// MAIN NORMALISATION PIPELINE
// =============================================================================

/**
 * Normalise a raw transaction input into a standard format
 */
export function normaliseTransaction(
  raw: RawTransactionInput,
  accountId: string
): NormalisedTransaction {
  // Parse and validate date
  const date = parseTransactionDate(raw.date);
  const postDate = raw.postDate ? parseTransactionDate(raw.postDate) : null;

  // Normalise amount and direction
  const { amount, direction } = normaliseAmount(raw.amount, raw.direction);

  // Clean merchant name
  const merchantRaw = raw.merchantRaw || raw.description;
  const merchantCleaned = cleanMerchantName(merchantRaw);

  // Generate deduplication hash
  const deduplicationHash = generateDeduplicationHash(
    accountId,
    date,
    amount,
    raw.description
  );

  return {
    date,
    postDate,
    amount,
    direction,
    currency: 'AUD',
    description: raw.description.trim(),
    merchantRaw: merchantRaw || null,
    merchantCleaned,
    merchantCategoryCode: raw.merchantCategoryCode || null,
    source: raw.source,
    externalId: raw.externalId || null,
    importBatchId: raw.importBatchId || null,
    deduplicationHash,
  };
}

// =============================================================================
// CSV IMPORT
// =============================================================================

/**
 * Parse CSV content into transaction rows
 */
export function parseCSVContent(
  content: string,
  hasHeader: boolean = true
): CSVTransactionRow[] {
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return [];
  }

  // Skip header if present
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Simple CSV parsing (doesn't handle quoted fields with commas)
    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));

    return {
      date: parts[0] || '',
      amount: parts[1] || '',
      description: parts[2] || '',
      reference: parts[3],
      balance: parts[4],
      category: parts[5],
    };
  });
}

/**
 * Import transactions from CSV
 */
export function importFromCSV(
  content: string,
  accountId: string,
  userId: string,
  options: {
    hasHeader?: boolean;
    dateColumn?: number;
    amountColumn?: number;
    descriptionColumn?: number;
  } = {}
): ImportBatchResult {
  const batchId = `csv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const errors: ImportError[] = [];
  const transactions: UnifiedTransaction[] = [];

  const rows = parseCSVContent(content, options.hasHeader ?? true);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = options.hasHeader ? i + 2 : i + 1;

    try {
      // Validate required fields
      if (!row.date) {
        errors.push({ row: rowNum, field: 'date', message: 'Missing date' });
        continue;
      }
      if (!row.amount) {
        errors.push({ row: rowNum, field: 'amount', message: 'Missing amount' });
        continue;
      }
      if (!row.description) {
        errors.push({ row: rowNum, field: 'description', message: 'Missing description' });
        continue;
      }

      const amount = parseFloat(row.amount.replace(/[$,]/g, ''));
      if (isNaN(amount)) {
        errors.push({ row: rowNum, field: 'amount', message: 'Invalid amount format' });
        continue;
      }

      // Normalise
      const normalised = normaliseTransaction(
        {
          date: row.date,
          amount,
          description: row.description,
          source: 'CSV',
          importBatchId: batchId,
        },
        accountId
      );

      // Create UnifiedTransaction
      const transaction: UnifiedTransaction = {
        id: `pending_${batchId}_${i}`, // Temporary ID until saved
        userId,
        accountId,
        date: normalised.date,
        postDate: normalised.postDate,
        amount: normalised.amount,
        currency: normalised.currency,
        direction: normalised.direction,
        merchantRaw: normalised.merchantRaw,
        merchantStandardised: normalised.merchantCleaned,
        merchantCategoryCode: normalised.merchantCategoryCode,
        description: normalised.description,
        categoryLevel1: null,
        categoryLevel2: null,
        subcategory: null,
        tags: [],
        userCorrectedCategory: false,
        confidenceScore: null,
        isRecurring: false,
        recurrencePattern: null,
        recurrenceGroupId: null,
        anomalyFlags: [],
        source: 'CSV',
        externalId: normalised.externalId,
        importBatchId: batchId,
        propertyId: null,
        loanId: null,
        incomeId: null,
        expenseId: null,
        investmentAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        processedAt: null,
      };

      transactions.push(transaction);
    } catch (err) {
      errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : 'Unknown error',
        rawData: row as unknown as Record<string, unknown>,
      });
    }
  }

  return {
    batchId,
    source: 'CSV',
    totalRows: rows.length,
    imported: transactions.length,
    duplicates: 0, // Will be set after DB check
    errors: errors.length,
    errorDetails: errors,
    transactions,
  };
}

// =============================================================================
// MANUAL ENTRY
// =============================================================================

/**
 * Create a transaction from manual entry
 */
export function createManualTransaction(
  input: {
    date: Date;
    amount: number;
    description: string;
    direction?: TransactionDirection;
    merchantRaw?: string;
    categoryLevel1?: string;
    categoryLevel2?: string;
  },
  accountId: string,
  userId: string
): UnifiedTransaction {
  const { amount, direction } = normaliseAmount(input.amount, input.direction);
  const merchantCleaned = cleanMerchantName(input.merchantRaw || input.description);

  return {
    id: `pending_manual_${Date.now()}`,
    userId,
    accountId,
    date: input.date,
    postDate: null,
    amount,
    currency: 'AUD',
    direction,
    merchantRaw: input.merchantRaw || input.description,
    merchantStandardised: merchantCleaned,
    merchantCategoryCode: null,
    description: input.description,
    categoryLevel1: input.categoryLevel1 || null,
    categoryLevel2: input.categoryLevel2 || null,
    subcategory: null,
    tags: [],
    userCorrectedCategory: !!input.categoryLevel1,
    confidenceScore: input.categoryLevel1 ? 1.0 : null,
    isRecurring: false,
    recurrencePattern: null,
    recurrenceGroupId: null,
    anomalyFlags: [],
    source: 'MANUAL',
    externalId: null,
    importBatchId: null,
    propertyId: null,
    loanId: null,
    incomeId: null,
    expenseId: null,
    investmentAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
  };
}

// =============================================================================
// DEDUPLICATION
// =============================================================================

/**
 * Check for potential duplicates in a batch
 */
export function findDuplicatesInBatch(
  transactions: UnifiedTransaction[]
): Map<string, UnifiedTransaction[]> {
  const hashMap = new Map<string, UnifiedTransaction[]>();

  for (const tx of transactions) {
    const hash = generateDeduplicationHash(
      tx.accountId,
      tx.date,
      tx.amount,
      tx.description
    );

    const existing = hashMap.get(hash) || [];
    existing.push(tx);
    hashMap.set(hash, existing);
  }

  // Return only groups with duplicates
  const duplicates = new Map<string, UnifiedTransaction[]>();
  hashMap.forEach((txs, hash) => {
    if (txs.length > 1) {
      duplicates.set(hash, txs);
    }
  });

  return duplicates;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  MERCHANT_ALIASES,
  TRANSFER_PATTERNS,
};
