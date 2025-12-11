/**
 * Phase 26: Australian-Specific Document Parsers
 *
 * Utilities for parsing Australian financial document formats:
 * - ABN (Australian Business Number) validation
 * - GST (Goods and Services Tax) extraction
 * - Australian date format parsing
 * - Currency parsing (AUD)
 */

// ============================================================================
// ABN Validation
// ============================================================================

export interface ABNValidationResult {
  valid: boolean;
  formatted: string;
  digits: string;
  error?: string;
}

/**
 * Validate an Australian Business Number (ABN)
 *
 * ABN is an 11-digit identifier. Validation uses a weighted sum algorithm:
 * 1. Subtract 1 from the first digit
 * 2. Multiply each digit by its weight
 * 3. Sum all products
 * 4. If sum % 89 === 0, ABN is valid
 *
 * @param abn - The ABN string (may include spaces)
 * @returns Validation result with formatted ABN
 */
export function validateABN(abn: string): ABNValidationResult {
  // Remove spaces and non-digit characters
  const digits = abn.replace(/\D/g, '');

  // Must be exactly 11 digits
  if (digits.length !== 11) {
    return {
      valid: false,
      formatted: abn,
      digits,
      error: 'ABN must be exactly 11 digits',
    };
  }

  // ABN validation weights
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

  // Subtract 1 from first digit, keep rest as-is
  const adjusted = [
    parseInt(digits[0]) - 1,
    ...digits.slice(1).split('').map(Number),
  ];

  // Calculate weighted sum
  const sum = adjusted.reduce((acc, digit, index) => acc + digit * weights[index], 0);

  // Valid if divisible by 89
  const valid = sum % 89 === 0;

  // Format as XX XXX XXX XXX
  const formatted = `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;

  return {
    valid,
    formatted,
    digits,
    error: valid ? undefined : 'Invalid ABN checksum',
  };
}

/**
 * Extract ABN from text
 */
export function extractABN(text: string): { abn: string; confidence: number } | null {
  // Pattern: 11 digits, optionally with spaces
  const patterns = [
    /ABN[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})/i,
    /A\.?B\.?N\.?[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})/i,
    /Australian Business Number[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})/i,
    /(\d{2}\s\d{3}\s\d{3}\s\d{3})/,  // Formatted without label
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const validation = validateABN(match[1]);
      if (validation.valid) {
        return {
          abn: validation.formatted,
          confidence: 0.95,
        };
      }
    }
  }

  // Try finding any 11-digit sequence
  const rawMatch = text.match(/(\d{11})/);
  if (rawMatch) {
    const validation = validateABN(rawMatch[1]);
    if (validation.valid) {
      return {
        abn: validation.formatted,
        confidence: 0.7,  // Lower confidence without ABN label
      };
    }
  }

  return null;
}

// ============================================================================
// GST Extraction
// ============================================================================

export interface GSTResult {
  gst: number;
  isGSTInclusive: boolean;
  confidence: number;
}

/**
 * Australian GST rate (10%)
 */
export const GST_RATE = 0.1;

/**
 * Calculate GST from a total amount (GST-inclusive)
 * GST = Total / 11
 */
export function calculateGSTFromTotal(total: number): number {
  return Math.round((total / 11) * 100) / 100;
}

/**
 * Calculate GST to add to a subtotal (GST-exclusive)
 * GST = Subtotal * 0.10
 */
export function calculateGSTFromSubtotal(subtotal: number): number {
  return Math.round(subtotal * GST_RATE * 100) / 100;
}

/**
 * Extract GST information from text
 */
export function extractGST(text: string, totalAmount?: number): GSTResult | null {
  // Patterns for explicit GST amounts
  const gstPatterns = [
    /GST[:\s]*\$?([\d,]+\.?\d*)/i,
    /G\.?S\.?T\.?[:\s]*\$?([\d,]+\.?\d*)/i,
    /Goods\s*(?:and|&)\s*Services\s*Tax[:\s]*\$?([\d,]+\.?\d*)/i,
    /Tax[:\s]*\$?([\d,]+\.?\d*)/i,
  ];

  for (const pattern of gstPatterns) {
    const match = text.match(pattern);
    if (match) {
      const gst = parseAustralianCurrency(match[1]);
      if (gst !== null && gst > 0) {
        return {
          gst,
          isGSTInclusive: true,
          confidence: 0.9,
        };
      }
    }
  }

  // Check for GST-inclusive indicators
  const inclusivePatterns = [
    /inc(?:l(?:udes?)?)?\.?\s*GST/i,
    /GST\s*inc(?:l(?:uded)?)?/i,
    /Total\s*\(inc(?:l)?\.?\s*GST\)/i,
    /price\s*includes?\s*GST/i,
  ];

  const isInclusive = inclusivePatterns.some(p => p.test(text));

  // If we have a total and indicators suggest GST is included, calculate it
  if (totalAmount && isInclusive) {
    return {
      gst: calculateGSTFromTotal(totalAmount),
      isGSTInclusive: true,
      confidence: 0.8,
    };
  }

  // Check for GST-free indicators
  const gstFreePatterns = [
    /GST[\s-]*free/i,
    /exempt\s*(?:from)?\s*GST/i,
    /no\s*GST/i,
    /GST\s*N\/A/i,
  ];

  if (gstFreePatterns.some(p => p.test(text))) {
    return {
      gst: 0,
      isGSTInclusive: false,
      confidence: 0.85,
    };
  }

  return null;
}

// ============================================================================
// Date Parsing
// ============================================================================

/**
 * Australian date formats in order of preference
 */
const AU_DATE_FORMATS = [
  // DD/MM/YYYY variants
  { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, dayIdx: 1, monthIdx: 2, yearIdx: 3 },
  { regex: /(\d{1,2})-(\d{1,2})-(\d{4})/, dayIdx: 1, monthIdx: 2, yearIdx: 3 },
  { regex: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, dayIdx: 1, monthIdx: 2, yearIdx: 3 },

  // DD/MM/YY variants (2-digit year)
  { regex: /(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/, dayIdx: 1, monthIdx: 2, yearIdx: 3, shortYear: true },
  { regex: /(\d{1,2})-(\d{1,2})-(\d{2})(?!\d)/, dayIdx: 1, monthIdx: 2, yearIdx: 3, shortYear: true },

  // Written formats
  { regex: /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i, dayIdx: 1, monthIdx: 2, yearIdx: 3, monthName: true },
  { regex: /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i, dayIdx: 2, monthIdx: 1, yearIdx: 3, monthName: true },

  // ISO format (fallback)
  { regex: /(\d{4})-(\d{2})-(\d{2})/, dayIdx: 3, monthIdx: 2, yearIdx: 1 },
];

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export interface DateParseResult {
  date: string;         // ISO format YYYY-MM-DD
  confidence: number;
  original: string;
}

/**
 * Parse a date string in Australian format and return ISO format
 */
export function parseAustralianDate(text: string): DateParseResult | null {
  for (const format of AU_DATE_FORMATS) {
    const match = text.match(format.regex);
    if (match) {
      let day: number, month: number, year: number;

      day = parseInt(match[format.dayIdx]);

      if (format.monthName) {
        const monthStr = match[format.monthIdx].toLowerCase().slice(0, 3);
        month = MONTH_NAMES[monthStr] || 0;
      } else {
        month = parseInt(match[format.monthIdx]);
      }

      year = parseInt(match[format.yearIdx]);

      // Handle 2-digit years
      if (format.shortYear && year < 100) {
        year = year >= 50 ? 1900 + year : 2000 + year;
      }

      // Validate ranges
      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
        continue;
      }

      // Additional validation: check if day is valid for month
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day > daysInMonth) {
        continue;
      }

      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Higher confidence for explicit formats
      const confidence = format.monthName ? 0.95 : 0.9;

      return {
        date: isoDate,
        confidence,
        original: match[0],
      };
    }
  }

  return null;
}

/**
 * Extract dates from text, returning all found dates
 */
export function extractDates(text: string): DateParseResult[] {
  const results: DateParseResult[] = [];
  const seen = new Set<string>();

  // Look for date patterns with context
  const contextPatterns = [
    { regex: /Date[:\s]+([^\n]+)/gi, priority: 1 },
    { regex: /Dated?[:\s]+([^\n]+)/gi, priority: 1 },
    { regex: /Invoice\s+Date[:\s]+([^\n]+)/gi, priority: 1 },
    { regex: /Due\s+Date[:\s]+([^\n]+)/gi, priority: 0.9 },
    { regex: /Issue\s+Date[:\s]+([^\n]+)/gi, priority: 1 },
    { regex: /Transaction\s+Date[:\s]+([^\n]+)/gi, priority: 1 },
    { regex: /([^\n]+)/g, priority: 0.5 },  // Any line
  ];

  for (const { regex, priority } of contextPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const parsed = parseAustralianDate(match[1]);
      if (parsed && !seen.has(parsed.date)) {
        seen.add(parsed.date);
        results.push({
          ...parsed,
          confidence: parsed.confidence * priority,
        });
      }
    }
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// Currency Parsing
// ============================================================================

/**
 * Parse an Australian currency value from text
 * Handles formats: $1,234.56, $1234.56, 1,234.56, 1234.56
 */
export function parseAustralianCurrency(text: string): number | null {
  // Remove currency symbol and whitespace
  const cleaned = text.replace(/[$\s]/g, '');

  // Handle negative values
  const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(') || text.includes('CR');
  const absValue = cleaned.replace(/[-()]/g, '');

  // Parse with comma as thousands separator
  const match = absValue.match(/^([\d,]+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const wholePart = match[1].replace(/,/g, '');
  const decimalPart = match[2] || '00';

  const value = parseFloat(`${wholePart}.${decimalPart}`);
  if (isNaN(value)) return null;

  return isNegative ? -value : value;
}

/**
 * Extract currency values from text with context
 */
export function extractCurrencyValues(text: string): Array<{
  value: number;
  context: string;
  confidence: number;
}> {
  const results: Array<{ value: number; context: string; confidence: number }> = [];

  // Patterns with context (label before amount)
  const patterns = [
    { regex: /Total[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'total', confidence: 0.95 },
    { regex: /Grand\s+Total[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'total', confidence: 0.98 },
    { regex: /Amount\s+Due[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'total', confidence: 0.95 },
    { regex: /Subtotal[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'subtotal', confidence: 0.9 },
    { regex: /Sub[\s-]?Total[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'subtotal', confidence: 0.9 },
    { regex: /GST[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'gst', confidence: 0.9 },
    { regex: /Tax[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'gst', confidence: 0.8 },
    { regex: /Balance[:\s]*\$?([\d,]+\.?\d*)/gi, context: 'balance', confidence: 0.85 },
    { regex: /\$\s*([\d,]+\.?\d*)/gi, context: 'amount', confidence: 0.7 },
  ];

  for (const { regex, context, confidence } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = parseAustralianCurrency(match[1]);
      if (value !== null && value > 0) {
        results.push({ value, context, confidence });
      }
    }
  }

  return results;
}

// ============================================================================
// Australian Financial Year Helpers
// ============================================================================

/**
 * Get the Australian financial year for a given date
 * Financial year runs from 1 July to 30 June
 * e.g., FY 2024-25 is 1 July 2024 to 30 June 2025
 */
export function getAustralianFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;  // 1-indexed

  // If July-December, FY is current year - next year
  // If January-June, FY is previous year - current year
  if (month >= 7) {
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
}

/**
 * Extract financial year reference from text
 */
export function extractFinancialYear(text: string): string | null {
  // Patterns like "FY2024-25", "2024-25", "FY 24/25"
  const patterns = [
    /FY\s*(\d{4})[\s-]?(\d{2})/i,
    /(?:Financial|Tax)\s*Year\s*(\d{4})[\s-]?(\d{2})/i,
    /(\d{4})[\s-\/](\d{2})\s*(?:Financial|Tax)\s*Year/i,
    /(\d{4})[\s-\/](\d{2})/,  // Fallback: any year-year pattern
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const startYear = match[1];
      const endYear = match[2];
      return `${startYear}-${endYear}`;
    }
  }

  return null;
}
