/**
 * Phase 18: CSV Parser for Bank Statements
 * Parses CSV files from various Australian banks
 */

import {
  ParsedFile,
  RawTransaction,
  ParseOptions,
  TransactionDirection,
} from '../types';

// =============================================================================
// BANK-SPECIFIC COLUMN MAPPINGS
// =============================================================================

interface BankMapping {
  name: string;
  patterns: string[]; // Header patterns to identify this bank
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  creditColumn?: string;
  debitColumn?: string;
  balanceColumn?: string;
  referenceColumn?: string;
  dateFormat: string;
}

const BANK_MAPPINGS: BankMapping[] = [
  {
    name: 'Commonwealth Bank',
    patterns: ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    creditColumn: 'Credit',
    debitColumn: 'Debit',
    balanceColumn: 'Balance',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'ANZ',
    patterns: ['Date', 'Details', 'Amount', 'Type'],
    dateColumn: 'Date',
    descriptionColumn: 'Details',
    amountColumn: 'Amount',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Westpac',
    patterns: ['Date', 'Narrative', 'Debit Amount', 'Credit Amount'],
    dateColumn: 'Date',
    descriptionColumn: 'Narrative',
    creditColumn: 'Credit Amount',
    debitColumn: 'Debit Amount',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'NAB',
    patterns: ['Date', 'Transaction Details', 'Debits', 'Credits'],
    dateColumn: 'Date',
    descriptionColumn: 'Transaction Details',
    creditColumn: 'Credits',
    debitColumn: 'Debits',
    dateFormat: 'DD MMM YY',
  },
  {
    name: 'ING',
    patterns: ['Date', 'Description', 'Credit', 'Debit'],
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    creditColumn: 'Credit',
    debitColumn: 'Debit',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Up Bank',
    patterns: ['Date', 'Time', 'Description', 'Amount'],
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    amountColumn: 'Amount',
    dateFormat: 'YYYY-MM-DD',
  },
  {
    name: 'Generic',
    patterns: ['date', 'description', 'amount'],
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    dateFormat: 'DD/MM/YYYY',
  },
];

// =============================================================================
// CSV PARSING
// =============================================================================

/**
 * Parse a CSV string into rows
 */
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      if (char === '\r') i++; // Skip \n in \r\n
    } else if (char !== '\r') {
      currentField += char;
    }
  }

  // Handle last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detect the bank format from headers
 */
function detectBankMapping(headers: string[]): BankMapping | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const mapping of BANK_MAPPINGS) {
    const normalizedPatterns = mapping.patterns.map(p => p.toLowerCase());
    const matchCount = normalizedPatterns.filter(p =>
      normalizedHeaders.some(h => h.includes(p) || p.includes(h))
    ).length;

    // Require at least 60% match
    if (matchCount >= Math.ceil(normalizedPatterns.length * 0.6)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Find column index by name (case-insensitive, partial match)
 */
function findColumnIndex(headers: string[], columnName: string): number {
  const normalized = columnName.toLowerCase();
  return headers.findIndex(h =>
    h.toLowerCase().includes(normalized) || normalized.includes(h.toLowerCase())
  );
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string, format: string): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try common formats
  const formats = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: 'DMY' },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, order: 'DMY2' },
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: 'YMD' },
    { regex: /^(\d{1,2})\s+(\w{3})\s+(\d{2,4})$/, order: 'DMthY' },
  ];

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  for (const fmt of formats) {
    const match = cleaned.match(fmt.regex);
    if (match) {
      let day: number, month: number, year: number;

      switch (fmt.order) {
        case 'DMY':
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1;
          year = parseInt(match[3], 10);
          break;
        case 'DMY2':
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1;
          year = 2000 + parseInt(match[3], 10);
          break;
        case 'YMD':
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1;
          day = parseInt(match[3], 10);
          break;
        case 'DMthY':
          day = parseInt(match[1], 10);
          month = months[match[2].toLowerCase()] ?? 0;
          year = parseInt(match[3], 10);
          if (year < 100) year += 2000;
          break;
        default:
          continue;
      }

      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback to native parsing
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string | undefined): number | undefined {
  if (!amountStr) return undefined;

  // Remove currency symbols, spaces, and handle negatives
  const cleaned = amountStr
    .replace(/[$AUD\s,]/gi, '')
    .replace(/\(([^)]+)\)/, '-$1') // Convert (100) to -100
    .trim();

  if (!cleaned) return undefined;

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? undefined : amount;
}

/**
 * Main CSV parsing function
 */
export function parseCSV(
  content: string,
  options?: ParseOptions
): ParsedFile {
  const rows = parseCSVRows(content);

  if (rows.length === 0) {
    return {
      format: 'CSV',
      transactions: [],
      totalRows: 0,
    };
  }

  // Determine if first row is header
  const skipRows = options?.skipRows ?? 0;
  const hasHeader = options?.hasHeader ?? true;

  const dataStartRow = skipRows + (hasHeader ? 1 : 0);
  const headers = hasHeader ? rows[skipRows] : [];
  const dataRows = rows.slice(dataStartRow);

  // Detect bank format or use provided options
  const bankMapping = headers.length > 0 ? detectBankMapping(headers) : null;

  const dateCol = options?.dateColumn
    ? findColumnIndex(headers, options.dateColumn)
    : bankMapping?.dateColumn
    ? findColumnIndex(headers, bankMapping.dateColumn)
    : 0;

  const descCol = options?.descriptionColumn
    ? findColumnIndex(headers, options.descriptionColumn)
    : bankMapping?.descriptionColumn
    ? findColumnIndex(headers, bankMapping.descriptionColumn)
    : 1;

  const amountCol = options?.amountColumn
    ? findColumnIndex(headers, options.amountColumn)
    : bankMapping?.amountColumn
    ? findColumnIndex(headers, bankMapping.amountColumn)
    : -1;

  const creditCol = options?.creditColumn
    ? findColumnIndex(headers, options.creditColumn)
    : bankMapping?.creditColumn
    ? findColumnIndex(headers, bankMapping.creditColumn)
    : -1;

  const debitCol = options?.debitColumn
    ? findColumnIndex(headers, options.debitColumn)
    : bankMapping?.debitColumn
    ? findColumnIndex(headers, bankMapping.debitColumn)
    : -1;

  const balanceCol = options?.balanceColumn
    ? findColumnIndex(headers, options.balanceColumn)
    : bankMapping?.balanceColumn
    ? findColumnIndex(headers, bankMapping.balanceColumn)
    : -1;

  const refCol = options?.referenceColumn
    ? findColumnIndex(headers, options.referenceColumn)
    : bankMapping?.referenceColumn
    ? findColumnIndex(headers, bankMapping.referenceColumn)
    : -1;

  const dateFormat = options?.dateFormat ?? bankMapping?.dateFormat ?? 'DD/MM/YYYY';

  // Parse transactions
  const transactions: RawTransaction[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = dataStartRow + i + 1;

    // Create raw data object
    const rawData: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rawData[header] = row[idx] ?? '';
    });

    // Parse fields
    const dateStr = dateCol >= 0 ? row[dateCol] : undefined;
    const date = dateStr ? parseDate(dateStr, dateFormat) : undefined;

    const description = descCol >= 0 ? row[descCol]?.trim() : undefined;

    let amount: number | undefined;
    let direction: TransactionDirection | undefined;

    if (amountCol >= 0) {
      // Single amount column (positive = credit, negative = debit)
      amount = parseAmount(row[amountCol]);
      if (amount !== undefined) {
        direction = amount >= 0 ? 'IN' : 'OUT';
        amount = Math.abs(amount);
      }
    } else if (creditCol >= 0 || debitCol >= 0) {
      // Separate credit/debit columns
      const credit = parseAmount(row[creditCol]);
      const debit = parseAmount(row[debitCol]);

      if (credit && credit > 0) {
        amount = credit;
        direction = 'IN';
      } else if (debit && debit > 0) {
        amount = debit;
        direction = 'OUT';
      } else if (credit !== undefined) {
        amount = Math.abs(credit);
        direction = credit >= 0 ? 'IN' : 'OUT';
      } else if (debit !== undefined) {
        amount = Math.abs(debit);
        direction = 'OUT';
      }
    }

    const balance = balanceCol >= 0 ? parseAmount(row[balanceCol]) : undefined;
    const reference = refCol >= 0 ? row[refCol]?.trim() : undefined;

    transactions.push({
      rowNumber,
      rawData,
      date: date ?? undefined,
      description,
      amount,
      direction,
      balance,
      reference,
    });
  }

  return {
    format: 'CSV',
    transactions,
    totalRows: dataRows.length,
    headers,
    metadata: {
      detectedBank: bankMapping?.name,
      dateFormat,
      columnMappings: {
        date: dateCol,
        description: descCol,
        amount: amountCol,
        credit: creditCol,
        debit: debitCol,
        balance: balanceCol,
        reference: refCol,
      },
    },
  };
}

/**
 * Suggest column mappings based on headers
 */
export function suggestColumnMappings(headers: string[]): ParseOptions {
  const bankMapping = detectBankMapping(headers);

  if (bankMapping) {
    return {
      dateColumn: bankMapping.dateColumn,
      descriptionColumn: bankMapping.descriptionColumn,
      amountColumn: bankMapping.amountColumn,
      creditColumn: bankMapping.creditColumn,
      debitColumn: bankMapping.debitColumn,
      balanceColumn: bankMapping.balanceColumn,
      referenceColumn: bankMapping.referenceColumn,
      dateFormat: bankMapping.dateFormat,
      hasHeader: true,
    };
  }

  // Generic fallback based on common column names
  const lowerHeaders = headers.map(h => h.toLowerCase());

  return {
    dateColumn: headers[lowerHeaders.findIndex(h => h.includes('date'))] ?? headers[0],
    descriptionColumn: headers[lowerHeaders.findIndex(h =>
      h.includes('desc') || h.includes('detail') || h.includes('narrative')
    )] ?? headers[1],
    amountColumn: headers[lowerHeaders.findIndex(h => h.includes('amount'))] ?? undefined,
    creditColumn: headers[lowerHeaders.findIndex(h => h.includes('credit'))] ?? undefined,
    debitColumn: headers[lowerHeaders.findIndex(h => h.includes('debit'))] ?? undefined,
    balanceColumn: headers[lowerHeaders.findIndex(h => h.includes('balance'))] ?? undefined,
    dateFormat: 'DD/MM/YYYY',
    hasHeader: true,
  };
}
