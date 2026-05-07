/**
 * Phase 18: QIF Parser for Bank Statements
 * Parses QIF (Quicken Interchange Format) files from Australian banks
 *
 * QIF Format Specification:
 * - !Type:Bank - Account type header
 * - D - Date
 * - T - Amount (positive = credit, negative = debit)
 * - N - Check number / Reference
 * - P - Payee / Description
 * - M - Memo
 * - C - Cleared status
 * - A - Address (multi-line)
 * - L - Category
 * - S - Split category
 * - $ - Split amount
 * - ^ - End of record
 */

import {
  ParsedFile,
  RawTransaction,
  TransactionDirection,
} from '../types';

// =============================================================================
// QIF ACCOUNT TYPES
// =============================================================================

export type QIFAccountType =
  | 'Bank'       // Bank account
  | 'Cash'       // Cash account
  | 'CCard'      // Credit Card
  | 'Invst'      // Investment account
  | 'Oth A'      // Asset account
  | 'Oth L'      // Liability account
  | 'Invoice'    // Invoice account (business)
  | 'Memorized'; // Memorized transactions list

const ACCOUNT_TYPE_MAP: Record<string, QIFAccountType> = {
  'bank': 'Bank',
  'cash': 'Cash',
  'ccard': 'CCard',
  'credit': 'CCard',
  'invst': 'Invst',
  'investment': 'Invst',
  'oth a': 'Oth A',
  'oth l': 'Oth L',
  'invoice': 'Invoice',
  'memorized': 'Memorized',
};

// =============================================================================
// QIF TRANSACTION INTERFACE
// =============================================================================

interface QIFTransaction {
  date?: string;
  amount?: number;
  reference?: string;
  payee?: string;
  memo?: string;
  cleared?: string;
  category?: string;
  address?: string[];
  splits?: Array<{
    category?: string;
    memo?: string;
    amount?: number;
  }>;
}

interface QIFParseResult {
  accountType: QIFAccountType;
  accountName?: string;
  transactions: QIFTransaction[];
  openingBalance?: number;
}

// =============================================================================
// DATE PARSING
// =============================================================================

/**
 * Parse QIF date formats
 * Common formats:
 * - DD/MM/YY (Australian)
 * - DD/MM/YYYY
 * - MM/DD/YY (US)
 * - D/M'YY (Quicken format with apostrophe)
 * - DD-MM-YYYY
 */
function parseQIFDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;

  const cleaned = dateStr.trim();

  // Try common formats
  const formats = [
    // DD/MM/YY (Australian - most common)
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      parse: (m: RegExpMatchArray) => ({
        day: parseInt(m[1], 10),
        month: parseInt(m[2], 10) - 1,
        year: 2000 + parseInt(m[3], 10),
      }),
    },
    // DD/MM/YYYY
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parse: (m: RegExpMatchArray) => ({
        day: parseInt(m[1], 10),
        month: parseInt(m[2], 10) - 1,
        year: parseInt(m[3], 10),
      }),
    },
    // DD-MM-YYYY
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      parse: (m: RegExpMatchArray) => ({
        day: parseInt(m[1], 10),
        month: parseInt(m[2], 10) - 1,
        year: parseInt(m[3], 10),
      }),
    },
    // D/M'YY (Quicken apostrophe format)
    {
      regex: /^(\d{1,2})\/(\d{1,2})'(\d{2})$/,
      parse: (m: RegExpMatchArray) => ({
        day: parseInt(m[1], 10),
        month: parseInt(m[2], 10) - 1,
        year: 2000 + parseInt(m[3], 10),
      }),
    },
    // YYYY-MM-DD (ISO)
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      parse: (m: RegExpMatchArray) => ({
        year: parseInt(m[1], 10),
        month: parseInt(m[2], 10) - 1,
        day: parseInt(m[3], 10),
      }),
    },
  ];

  for (const fmt of formats) {
    const match = cleaned.match(fmt.regex);
    if (match) {
      const { day, month, year } = fmt.parse(match);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback to native parsing
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Parse QIF amount
 * QIF amounts can have:
 * - Commas as thousands separator
 * - Negative values with minus sign
 */
function parseQIFAmount(amountStr: string): number | undefined {
  if (!amountStr) return undefined;

  // Remove commas and whitespace
  const cleaned = amountStr.replace(/,/g, '').trim();

  if (!cleaned) return undefined;

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? undefined : amount;
}

// =============================================================================
// QIF PARSING
// =============================================================================

/**
 * Parse QIF file content into structured data
 */
function parseQIFContent(content: string): QIFParseResult {
  const lines = content.split(/\r?\n/);
  const result: QIFParseResult = {
    accountType: 'Bank',
    transactions: [],
  };

  let currentTransaction: QIFTransaction = {};
  let currentSplit: { category?: string; memo?: string; amount?: number } = {};
  let inSplit = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Account type header
    if (line.startsWith('!Type:')) {
      const typeStr = line.substring(6).toLowerCase();
      result.accountType = ACCOUNT_TYPE_MAP[typeStr] || 'Bank';
      continue;
    }

    // Account name header
    if (line.startsWith('!Account')) {
      // Next non-empty line should be N for account name
      for (let j = i + 1; j < lines.length && j < i + 10; j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('N')) {
          result.accountName = nextLine.substring(1);
          break;
        }
        if (nextLine === '^') break;
      }
      continue;
    }

    // Opening balance (B record at start of file)
    if (line.startsWith('B') && result.transactions.length === 0) {
      const balance = parseQIFAmount(line.substring(1));
      if (balance !== undefined) {
        result.openingBalance = balance;
      }
      continue;
    }

    // Skip other header lines
    if (line.startsWith('!')) continue;

    const fieldType = line[0];
    const fieldValue = line.substring(1);

    switch (fieldType) {
      case 'D': // Date
        currentTransaction.date = fieldValue;
        break;

      case 'T': // Amount
        currentTransaction.amount = parseQIFAmount(fieldValue);
        break;

      case 'N': // Reference/Check number
        currentTransaction.reference = fieldValue;
        break;

      case 'P': // Payee
        currentTransaction.payee = fieldValue;
        break;

      case 'M': // Memo
        if (inSplit) {
          currentSplit.memo = fieldValue;
        } else {
          currentTransaction.memo = fieldValue;
        }
        break;

      case 'C': // Cleared status (X = cleared, * = reconciled)
        currentTransaction.cleared = fieldValue;
        break;

      case 'L': // Category
        if (inSplit) {
          currentSplit.category = fieldValue;
        } else {
          currentTransaction.category = fieldValue;
        }
        break;

      case 'A': // Address line
        if (!currentTransaction.address) {
          currentTransaction.address = [];
        }
        currentTransaction.address.push(fieldValue);
        break;

      case 'S': // Split category
        if (inSplit && Object.keys(currentSplit).length > 0) {
          if (!currentTransaction.splits) {
            currentTransaction.splits = [];
          }
          currentTransaction.splits.push(currentSplit);
        }
        inSplit = true;
        currentSplit = { category: fieldValue };
        break;

      case '$': // Split amount
        if (inSplit) {
          currentSplit.amount = parseQIFAmount(fieldValue);
        }
        break;

      case '^': // End of record
        // Save any pending split
        if (inSplit && Object.keys(currentSplit).length > 0) {
          if (!currentTransaction.splits) {
            currentTransaction.splits = [];
          }
          currentTransaction.splits.push(currentSplit);
        }

        // Save transaction if it has data
        if (currentTransaction.date || currentTransaction.amount !== undefined) {
          result.transactions.push(currentTransaction);
        }

        // Reset for next transaction
        currentTransaction = {};
        currentSplit = {};
        inSplit = false;
        break;
    }
  }

  // Handle last transaction if no trailing ^
  if (currentTransaction.date || currentTransaction.amount !== undefined) {
    if (inSplit && Object.keys(currentSplit).length > 0) {
      if (!currentTransaction.splits) {
        currentTransaction.splits = [];
      }
      currentTransaction.splits.push(currentSplit);
    }
    result.transactions.push(currentTransaction);
  }

  return result;
}

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

/**
 * Parse a QIF file into standardized transaction format
 */
export function parseQIF(content: string): ParsedFile {
  const qifResult = parseQIFContent(content);

  if (qifResult.transactions.length === 0) {
    return {
      format: 'QIF',
      transactions: [],
      totalRows: 0,
      metadata: {
        accountType: qifResult.accountType,
        accountName: qifResult.accountName,
      },
    };
  }

  // Convert to RawTransaction format
  const transactions: RawTransaction[] = qifResult.transactions.map((tx, index) => {
    const date = tx.date ? parseQIFDate(tx.date) : undefined;
    const amount = tx.amount;

    // Determine direction from amount sign
    let direction: TransactionDirection | undefined;
    let absAmount: number | undefined;

    if (amount !== undefined) {
      direction = amount >= 0 ? 'IN' : 'OUT';
      absAmount = Math.abs(amount);
    }

    // Build description from payee and memo
    let description = tx.payee || '';
    if (tx.memo && tx.memo !== tx.payee) {
      description = description ? `${description} - ${tx.memo}` : tx.memo;
    }

    // Create raw data object for reference
    const rawData: Record<string, string> = {};
    if (tx.date) rawData.date = tx.date;
    if (tx.amount !== undefined) rawData.amount = tx.amount.toString();
    if (tx.payee) rawData.payee = tx.payee;
    if (tx.memo) rawData.memo = tx.memo;
    if (tx.reference) rawData.reference = tx.reference;
    if (tx.category) rawData.category = tx.category;
    if (tx.cleared) rawData.cleared = tx.cleared;

    // Phase 42 PR2 — propagate QIF `S`/`$` splits onto RawTransaction.splits.
    // The import path (lib/bank/ingestion or its caller) resolves each
    // split's `category` string to a CanonicalCategoryRegistry row before
    // creating TransactionSplit rows. Sum-validation (sum === amount) runs
    // in `lib/bookkeeping/splits.ts:assertSplitsBalance`.
    //
    // QIF split amounts are SIGNED in the source format (debits negative,
    // credits positive); we keep them signed here so the parent
    // transaction.amount sign-convention match works the same way as the
    // top-level `T` line.
    const rawSplits =
      tx.splits && tx.splits.length > 0
        ? tx.splits
            .filter((s) => s.amount !== undefined)
            .map((s) => ({
              amount: s.amount as number,
              category: s.category,
              memo: s.memo,
            }))
        : undefined;

    return {
      rowNumber: index + 1,
      rawData,
      date,
      description: description || undefined,
      amount: absAmount,
      direction,
      reference: tx.reference,
      splits: rawSplits,
    };
  });

  // Calculate opening and closing balances
  // QIF files typically list transactions from newest to oldest
  // We'll calculate a running balance if no explicit balance is provided
  let openingBalance = qifResult.openingBalance;
  let closingBalance: number | undefined;

  if (transactions.length > 0) {
    // Calculate the sum of all transactions
    let transactionSum = 0;
    for (const tx of qifResult.transactions) {
      if (tx.amount !== undefined) {
        transactionSum += tx.amount;
      }
    }

    if (openingBalance !== undefined) {
      // If we have opening balance, calculate closing from it
      closingBalance = openingBalance + transactionSum;
    } else {
      // Without opening balance, use transaction sum as relative closing balance
      // This represents the net change - useful for showing current position
      // Note: For accurate balance, user should manually verify/adjust after import
      closingBalance = transactionSum;
    }
  }

  return {
    format: 'QIF',
    transactions,
    totalRows: transactions.length,
    metadata: {
      accountType: qifResult.accountType,
      accountName: qifResult.accountName,
      detectedBank: detectBankFromTransactions(transactions),
    },
    openingBalance,
    closingBalance,
  };
}

/**
 * Try to detect bank from transaction patterns
 */
function detectBankFromTransactions(transactions: RawTransaction[]): string | undefined {
  // Look for common patterns in descriptions
  const descriptions = transactions
    .map(t => t.description?.toLowerCase() || '')
    .filter(d => d);

  if (descriptions.length === 0) return undefined;

  // NAB patterns
  const nabPatterns = ['nabatm', 'nab ', 'pv9037', 'pv9110', 'eftpos'];
  if (descriptions.some(d => nabPatterns.some(p => d.includes(p)))) {
    return 'NAB';
  }

  // CBA patterns
  const cbaPatterns = ['commbank', 'netbank', 'cba '];
  if (descriptions.some(d => cbaPatterns.some(p => d.includes(p)))) {
    return 'Commonwealth Bank';
  }

  // ANZ patterns
  const anzPatterns = ['anz ', 'anz-'];
  if (descriptions.some(d => anzPatterns.some(p => d.includes(p)))) {
    return 'ANZ';
  }

  // Westpac patterns
  const westpacPatterns = ['westpac', 'wbc '];
  if (descriptions.some(d => westpacPatterns.some(p => d.includes(p)))) {
    return 'Westpac';
  }

  return undefined;
}

/**
 * Validate QIF content before parsing
 */
export function isValidQIF(content: string): boolean {
  const trimmed = content.trim();

  // Must start with !Type: header or have recognizable QIF structure
  if (trimmed.startsWith('!Type:') || trimmed.startsWith('!Account')) {
    return true;
  }

  // Check for QIF field markers
  const lines = trimmed.split(/\r?\n/).slice(0, 20);
  let hasDate = false;
  let hasAmount = false;
  let hasRecordSeparator = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('D')) hasDate = true;
    if (trimmedLine.startsWith('T')) hasAmount = true;
    if (trimmedLine === '^') hasRecordSeparator = true;
  }

  return hasDate && hasAmount && hasRecordSeparator;
}
