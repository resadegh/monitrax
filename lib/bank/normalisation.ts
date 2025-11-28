/**
 * Phase 18: Transaction Normalisation Engine
 * Transforms raw parsed transactions into standardised format
 */

import { createHash, randomUUID } from 'crypto';
import {
  RawTransaction,
  NormalisedTransaction,
  NormalisationResult,
  NormalisationError,
  TransactionDirection,
} from './types';

// =============================================================================
// MERCHANT NORMALISATION
// =============================================================================

/**
 * Common merchant name mappings for Australian banks
 */
const MERCHANT_MAPPINGS: Record<string, string> = {
  // Supermarkets
  'woolworths': 'Woolworths',
  'woolies': 'Woolworths',
  'coles': 'Coles',
  'aldi': 'ALDI',
  'iga': 'IGA',
  'costco': 'Costco',

  // Fast food
  'mcdonald': 'McDonald\'s',
  'mcdonalds': 'McDonald\'s',
  'kfc': 'KFC',
  'hungry jack': 'Hungry Jacks',
  'subway': 'Subway',
  'dominos': 'Domino\'s',
  'pizza hut': 'Pizza Hut',

  // Coffee
  'starbucks': 'Starbucks',
  'gloria jeans': 'Gloria Jeans',

  // Petrol
  'bp': 'BP',
  'shell': 'Shell',
  'caltex': 'Caltex',
  'ampol': 'Ampol',
  '7-eleven': '7-Eleven',
  '7eleven': '7-Eleven',

  // Utilities
  'agl': 'AGL',
  'origin': 'Origin Energy',
  'energy australia': 'Energy Australia',
  'telstra': 'Telstra',
  'optus': 'Optus',
  'vodafone': 'Vodafone',

  // Streaming
  'netflix': 'Netflix',
  'spotify': 'Spotify',
  'apple': 'Apple',
  'google': 'Google',
  'amazon': 'Amazon',
  'disney': 'Disney+',
  'stan': 'Stan',

  // Transport
  'uber': 'Uber',
  'didi': 'DiDi',
  'ola': 'Ola',

  // Insurance
  'nrma': 'NRMA',
  'racv': 'RACV',
  'racq': 'RACQ',
  'suncorp': 'Suncorp',
  'allianz': 'Allianz',

  // Banks
  'commbank': 'Commonwealth Bank',
  'cba': 'Commonwealth Bank',
  'westpac': 'Westpac',
  'anz': 'ANZ',
  'nab': 'NAB',
};

/**
 * Clean and normalise merchant name
 */
function normaliseMerchantName(rawDescription: string): string {
  if (!rawDescription) return 'Unknown';

  // Remove common prefixes
  let cleaned = rawDescription
    .replace(/^(VISA|MASTERCARD|EFTPOS|DEBIT|CREDIT|DIRECT DEBIT|BPAY|OSKO|PAY\/ID)\s*/i, '')
    .replace(/^(PURCHASE|PAYMENT|WITHDRAWAL|DEPOSIT|TRANSFER)\s*/i, '')
    .replace(/\d{2}\/\d{2}\s*/g, '') // Remove dates
    .replace(/\s+\d{4,}$/g, '') // Remove trailing numbers (card numbers, reference)
    .replace(/\s+[A-Z]{2}\s*$/g, '') // Remove state codes
    .replace(/AUS$/i, '')
    .trim();

  // Check against known mappings
  const lowerCleaned = cleaned.toLowerCase();
  for (const [pattern, standardName] of Object.entries(MERCHANT_MAPPINGS)) {
    if (lowerCleaned.includes(pattern)) {
      return standardName;
    }
  }

  // Capitalise properly if no match
  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .substring(0, 100); // Limit length
}

/**
 * Extract merchant from description using patterns
 */
function extractMerchant(description: string): { raw: string; standardised: string } {
  const raw = description.substring(0, 200);
  const standardised = normaliseMerchantName(description);

  return { raw, standardised };
}

// =============================================================================
// DESCRIPTION CLEANING
// =============================================================================

/**
 * Clean transaction description
 */
function cleanDescription(description: string): string {
  if (!description) return '';

  return description
    .replace(/[^\w\s\-\.\/&']/g, ' ') // Remove special chars except common ones
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

// =============================================================================
// HASH GENERATION
// =============================================================================

/**
 * Generate a hash for duplicate detection
 * Uses date + amount + description (first 50 chars)
 */
function generateTransactionHash(
  date: Date,
  amount: number,
  description: string
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountStr = amount.toFixed(2);
  const descStr = description.substring(0, 50).toLowerCase().replace(/\s+/g, '');

  const input = `${dateStr}|${amountStr}|${descStr}`;
  return createHash('sha256').update(input).digest('hex');
}

// =============================================================================
// NORMALISATION
// =============================================================================

/**
 * Normalise a single raw transaction
 */
function normaliseTransaction(
  raw: RawTransaction,
  sourceFileId: string,
  bankAccountId?: string
): { transaction?: NormalisedTransaction; error?: NormalisationError } {
  // Validate required fields
  if (!raw.date) {
    return {
      error: {
        rowNumber: raw.rowNumber,
        field: 'date',
        message: 'Missing or invalid date',
        rawValue: raw.rawData['Date'] ?? raw.rawData['date'] ?? undefined,
      },
    };
  }

  if (raw.amount === undefined || raw.amount === null) {
    return {
      error: {
        rowNumber: raw.rowNumber,
        field: 'amount',
        message: 'Missing or invalid amount',
        rawValue: raw.rawData['Amount'] ?? raw.rawData['amount'] ?? undefined,
      },
    };
  }

  if (!raw.description) {
    return {
      error: {
        rowNumber: raw.rowNumber,
        field: 'description',
        message: 'Missing description',
      },
    };
  }

  // Clean and normalise
  const cleanedDescription = cleanDescription(raw.description);
  const merchant = extractMerchant(raw.description);
  const direction: TransactionDirection = raw.direction ?? (raw.amount >= 0 ? 'IN' : 'OUT');
  const amount = Math.abs(raw.amount);

  const transaction: NormalisedTransaction = {
    id: randomUUID(),
    date: raw.date,
    description: cleanedDescription,
    rawDescription: raw.description,
    amount,
    direction,
    bankAccountId,
    sourceFileId,
    hash: generateTransactionHash(raw.date, amount, raw.description),
    merchantRaw: merchant.raw,
    merchantStandardised: merchant.standardised,
    balance: raw.balance,
    reference: raw.reference,
  };

  return { transaction };
}

/**
 * Normalise multiple transactions
 */
export function normaliseTransactions(
  rawTransactions: RawTransaction[],
  sourceFileId: string,
  bankAccountId?: string
): NormalisationResult {
  const transactions: NormalisedTransaction[] = [];
  const errors: NormalisationError[] = [];

  for (const raw of rawTransactions) {
    const result = normaliseTransaction(raw, sourceFileId, bankAccountId);

    if (result.transaction) {
      transactions.push(result.transaction);
    }

    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    transactions,
    errors,
    statistics: {
      total: rawTransactions.length,
      normalised: transactions.length,
      failed: errors.length,
    },
  };
}

/**
 * Re-normalise merchant name (for user corrections)
 */
export function renormaliseMerchant(rawDescription: string): string {
  return normaliseMerchantName(rawDescription);
}

/**
 * Generate hash for a transaction (for external use)
 */
export function generateHash(date: Date, amount: number, description: string): string {
  return generateTransactionHash(date, amount, description);
}
