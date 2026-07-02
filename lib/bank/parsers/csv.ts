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
  // More specific formats first (with more unique patterns)
  {
    name: 'CBA Transaction Export',
    patterns: ['BSB Number', 'Account Number', 'Transaction Date', 'Narration', 'Debit', 'Credit'],
    dateColumn: 'Transaction Date',
    descriptionColumn: 'Narration',
    creditColumn: 'Credit',
    debitColumn: 'Debit',
    balanceColumn: 'Balance',
    dateFormat: 'DD/MM/YYYY',
  },
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
      normalizedHeaders.some(h => headerMatches(h, p))
    ).length;

    // Require at least 60% match
    if (matchCount >= Math.ceil(normalizedPatterns.length * 0.6)) {
      return mapping;
    }
  }

  return null;
}

/**
 * True when header `h` corresponds to the target name `p`. CRITICAL: an EMPTY
 * header never matches — otherwise `p.includes('')` (always true) lets a blank
 * column (common in AMEX/Qantas exports) satisfy EVERY pattern, so any bank
 * "matches" 100% and every column lookup collapses onto the blank column
 * (2026-07-02: "Missing or invalid amount"). The reverse direction
 * (`p.includes(h)`) is only allowed for headers ≥3 chars so a stray 1-2 char
 * header can't capture unrelated targets.
 */
function headerMatches(h: string, p: string): boolean {
  const hh = h.trim().toLowerCase();
  const pp = p.trim().toLowerCase();
  if (!hh || !pp) return false;
  if (hh.includes(pp)) return true;
  if (hh.length >= 3 && pp.includes(hh)) return true;
  return false;
}

/**
 * Find column index by name (case-insensitive, partial match)
 */
function findColumnIndex(headers: string[], columnName: string): number {
  return headers.findIndex(h => headerMatches(h, columnName));
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
 * A row "looks like data" (not a header) if any cell parses as a date. Header
 * rows are labels ("Date", "Amount") which never parse as dates. Used to
 * auto-detect headerless CSVs (common for NAB / some AU banks).
 */
function rowLooksLikeData(row: string[]): boolean {
  return row.some((cell) => parseDate(cell, 'DD/MM/YYYY') !== null);
}

/**
 * Infer the date / amount / description columns from the DATA when a CSV has no
 * header and no recognised bank format. Samples up to 20 rows and classifies
 * each column by content:
 *   - dateCol   = the column with the most parseable dates.
 *   - amountCol = a money column, PREFERRING one that carries negatives (real
 *     spend) and the smallest typical magnitude — so a running "balance" column
 *     (large, mostly one sign) is not mistaken for the transaction amount.
 *   - descCol   = the most text-like column (fewest date/number parses).
 * Returns -1 for a column it can't infer (caller leaves it absent). Conservative
 * by design (§19): a wrong amount column mis-states every transaction, so the
 * negatives-first + smallest-magnitude heuristic avoids grabbing the balance.
 */
function inferColumns(dataRows: string[][]): { dateCol: number; amountCol: number; descCol: number } {
  const sample = dataRows.filter((r) => r.length > 0).slice(0, 20);
  const colCount = sample.reduce((m, r) => Math.max(m, r.length), 0);

  let dateCol = -1;
  let bestDateHits = 0;
  const numericStats: Array<{ col: number; hasNegative: boolean; avgMag: number; numericRate: number }> = [];
  const textScore: number[] = [];

  for (let c = 0; c < colCount; c++) {
    let dateHits = 0;
    let numericHits = 0;
    let negatives = 0;
    let magSum = 0;
    let nonEmpty = 0;
    for (const row of sample) {
      const cell = (row[c] ?? '').trim();
      if (!cell) continue;
      nonEmpty++;
      if (parseDate(cell, 'DD/MM/YYYY') !== null) dateHits++;
      const amt = parseAmount(cell);
      if (amt !== undefined) {
        numericHits++;
        if (amt < 0) negatives++;
        magSum += Math.abs(amt);
      }
    }
    if (dateHits > bestDateHits) {
      bestDateHits = dateHits;
      dateCol = c;
    }
    const numericRate = nonEmpty > 0 ? numericHits / nonEmpty : 0;
    numericStats.push({ col: c, hasNegative: negatives > 0, avgMag: numericHits > 0 ? magSum / numericHits : Infinity, numericRate });
    // text-like = non-empty cells that are neither a date nor a number
    textScore[c] = nonEmpty > 0 ? (nonEmpty - dateHits - numericHits) / nonEmpty : 0;
  }

  // Amount: numeric columns (rate ≥ 0.6) that aren't the date column, preferring
  // ones with negatives, then smallest average magnitude (amount not balance).
  const amountCandidates = numericStats
    .filter((s) => s.col !== dateCol && s.numericRate >= 0.6)
    .sort((a, b) => (Number(b.hasNegative) - Number(a.hasNegative)) || (a.avgMag - b.avgMag));
  const amountCol = amountCandidates.length > 0 ? amountCandidates[0].col : -1;

  // Description: most text-like column that isn't date or amount.
  let descCol = -1;
  let bestText = -1;
  for (let c = 0; c < colCount; c++) {
    if (c === dateCol || c === amountCol) continue;
    if (textScore[c] > bestText) {
      bestText = textScore[c];
      descCol = c;
    }
  }

  return { dateCol: dateCol >= 0 ? dateCol : 0, amountCol, descCol: descCol >= 0 ? descCol : 1 };
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

  // Determine if first row is a header. Many AU banks (NAB, some ING exports)
  // export HEADERLESS CSVs — the first row is already a transaction. If the
  // caller didn't say, auto-detect: a header row has no cell that parses as a
  // date, whereas a data row does. Without this, a headerless file loses its
  // first row to a phantom "header" and every remaining row fails column
  // detection → 0 transactions → the import route used to 500 (2026-07-02).
  const skipRows = options?.skipRows ?? 0;
  const firstRow = rows[skipRows] ?? [];
  const hasHeader = options?.hasHeader ?? !rowLooksLikeData(firstRow);

  const dataStartRow = skipRows + (hasHeader ? 1 : 0);
  const headers = hasHeader ? rows[skipRows] : [];
  const dataRows = rows.slice(dataStartRow);

  // Detect bank format or use provided options
  const bankMapping = headers.length > 0 ? detectBankMapping(headers) : null;

  // Unknown-format fallback: infer the date, amount and description columns from
  // the DATA itself (which column parses as dates, which as a signed money value,
  // which is text). Runs whenever NO known bank matched — headerless OR a headed
  // CSV from a bank we don't have a mapping for (Reza 2026-07-02: "CSV files can
  // be different formats from different banks"). A headed known-bank CSV keeps its
  // named mapping. Only ever supplies FALLBACKS (via resolveCol) — never overrides
  // a column a mapping/option resolved successfully.
  const inferred = !bankMapping ? inferColumns(dataRows) : null;

  // Resolve a column: explicit option → detected-bank column → positional
  // fallback. CRITICAL: when the explicit/mapping column NAME isn't found in the
  // actual headers (findColumnIndex → -1), fall THROUGH to the fallback rather
  // than returning -1. Without this, a generic "date,description,amount" CSV that
  // fuzzy-matches a bank whose column is named differently (e.g. ANZ's "Details")
  // silently dropped the description → blank merchants. `fallback` is -1 for
  // optional columns (amount/credit/debit/balance/ref) so those stay truly absent.
  const resolveCol = (explicit: string | undefined, mappingCol: string | undefined, fallback: number): number => {
    if (explicit) {
      const i = findColumnIndex(headers, explicit);
      if (i >= 0) return i;
    }
    if (mappingCol) {
      const i = findColumnIndex(headers, mappingCol);
      if (i >= 0) return i;
    }
    return fallback;
  };

  const dateCol = resolveCol(options?.dateColumn, bankMapping?.dateColumn, inferred?.dateCol ?? 0);
  const descCol = resolveCol(options?.descriptionColumn, bankMapping?.descriptionColumn, inferred?.descCol ?? 1);
  const amountCol = resolveCol(options?.amountColumn, bankMapping?.amountColumn, inferred?.amountCol ?? -1);
  const creditCol = resolveCol(options?.creditColumn, bankMapping?.creditColumn, -1);
  const debitCol = resolveCol(options?.debitColumn, bankMapping?.debitColumn, -1);
  const balanceCol = resolveCol(options?.balanceColumn, bankMapping?.balanceColumn, -1);
  const refCol = resolveCol(options?.referenceColumn, bankMapping?.referenceColumn, -1);

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

  // Extract opening and closing balances
  const balances = transactions
    .map(t => t.balance)
    .filter((b): b is number => b !== undefined && !isNaN(b));

  const openingBalance = balances.length > 0 ? balances[0] : undefined;
  const closingBalance = balances.length > 0 ? balances[balances.length - 1] : undefined;

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
    openingBalance,
    closingBalance,
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
