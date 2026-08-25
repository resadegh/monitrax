/**
 * Phase 26: Receipt Analyzer
 *
 * Extracts structured data from receipts including:
 * - Vendor name and ABN
 * - Date of transaction
 * - Total amount, subtotal, and GST
 * - Line items (if available)
 * - Payment method
 */

import {
  ReceiptExtraction,
  ExtractedField,
  LineItem,
  SuggestedAction,
  AnalysisResult,
  calculateOverallConfidence,
  getLowConfidenceFields,
} from '../types';
import {
  extractABN,
  validateABN,
  extractGST,
  parseAustralianDate,
  extractDates,
  extractCurrencyValues,
  parseAustralianCurrency,
} from '../parsers/australian';
import { inferExpenseCategory, normaliseVendor } from '../parsers/categoryInference';

// ============================================================================
// Vendor Extraction
// ============================================================================

/**
 * MON-191 — document-type vocabulary a vendor can NEVER be, including fuzzy
 * OCR garblings of it ("Invnice" from "** TAX INVOICE **" was chosen as the
 * vendor on a live Bunnings receipt while BUNNINGS was the largest text on
 * the page — P-9 finding F5). Matching is per-word with a small edit
 * distance, so mis-transcriptions are caught without a dictionary.
 */
const DOC_TYPE_WORDS = ['invoice', 'receipt', 'statement', 'estimate', 'quote', 'docket', 'tax'];

/** Levenshtein distance, early-exit above `max` (tiny inputs only). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/** True when the candidate is document-type vocabulary (incl. OCR garblings)
 *  rather than a merchant — e.g. "TAX INVOICE", "Invnice", "Reciept". */
function isDocTypeText(candidate: string): boolean {
  const words = candidate.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  // EVERY word must be (a fuzzy match of) doc-type vocabulary for the whole
  // candidate to be rejected — "BUNNINGS TAX INVOICE" is still a merchant line.
  return words.every((w) =>
    DOC_TYPE_WORDS.some((d) => {
      if (w === d) return true;
      if (w.length < 5 || d.length < 5) return false;
      return editDistance(w, d, 2) <= 2;
    })
  );
}

/** Receipt-body boilerplate a vendor line never is (exact word matches). */
const RECEIPT_BOILERPLATE = new Set([
  'total', 'subtotal', 'change', 'cash', 'card', 'visa', 'mastercard',
  'eftpos', 'due', 'paid', 'savings', 'rounding', 'tender',
]);

/** Lines that can never be a vendor regardless of position. */
function isNonVendorLine(trimmed: string): boolean {
  if (trimmed.length < 3 || trimmed.length >= 100) return true;
  if (/^[\d\s.,\-*#=]+$/.test(trimmed)) return true; // numbers / rules / dividers
  if (/[$]\s*\d/.test(trimmed)) return true; // carries a currency figure — a money line, not a masthead
  if (/^\d+\s+\w+\s+(st|street|rd|road|ave|avenue)/i.test(trimmed)) return true; // address
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) return true; // date
  if (/\bABN\b|\bGST\b|\bEFTPOS\b/i.test(trimmed)) return true; // fiscal boilerplate
  const words = trimmed.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => RECEIPT_BOILERPLATE.has(w))) return true;
  return isDocTypeText(trimmed);
}

/**
 * Extract vendor name from receipt text.
 *
 * MON-191 refinement: the old first-plausible-line fallback let a garbled
 * document-type header win over the merchant. Candidates are now scored by
 * merchant-prominence signals available in plain OCR text — how often the
 * line's dominant token repeats across the whole document (merchant names
 * recur: header, footer, website) and whether the line is upper-case
 * business-shaped text — and document-type vocabulary (with fuzzy OCR
 * garblings) is rejected outright. When nothing plausible survives, return
 * null: the field stays honestly empty for the user (never invent).
 */
function extractVendor(text: string): ExtractedField<string> | null {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  // Pattern: "TAX INVOICE - Vendor Name" — the explicit label form. The
  // captured name still runs through the doc-type rejection.
  const labelled = text.match(/^(?:TAX\s*)?(?:INVOICE|RECEIPT)[:\s-]+(.+)/i);
  if (labelled && labelled[1]) {
    const vendor = labelled[1].trim();
    if (vendor.length > 2 && vendor.length < 100 && !isDocTypeText(vendor)) {
      return {
        value: normaliseVendor(vendor),
        confidence: 0.85,
        source: 'ocr',
      };
    }
  }

  // Score the early candidate lines by merchant-prominence.
  const lower = text.toLowerCase();
  let best: { line: string; score: number } | null = null;
  for (const line of lines.slice(0, 8)) {
    const trimmed = line.trim();
    if (isNonVendorLine(trimmed)) continue;

    // Dominant token = the longest alphabetic word on the line.
    const tokens = trimmed.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 4);
    const dominant = tokens.sort((a, b) => b.length - a.length)[0];
    let score = 1;
    if (dominant) {
      // Repetition across the whole document (merchant names recur).
      const occurrences = lower.split(dominant).length - 1;
      score += Math.min(occurrences - 1, 3) * 2;
    }
    // Upper-case business-shaped text reads as a masthead.
    const letters = trimmed.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 4 && letters === letters.toUpperCase()) score += 1;

    if (!best || score > best.score) best = { line: trimmed, score };
  }

  if (best) {
    return {
      value: normaliseVendor(best.line),
      confidence: best.score > 2 ? 0.75 : 0.7,
      source: 'inferred',
    };
  }

  return null;
}

/**
 * Extract payment method from receipt
 */
function extractPaymentMethod(text: string): ExtractedField<'CASH' | 'CARD' | 'EFTPOS' | 'OTHER'> | null {
  const textLower = text.toLowerCase();

  if (/eftpos|debit\s*card|savings/i.test(text)) {
    return { value: 'EFTPOS', confidence: 0.9, source: 'ocr' };
  }
  if (/visa|mastercard|amex|credit\s*card/i.test(text)) {
    return { value: 'CARD', confidence: 0.9, source: 'ocr' };
  }
  if (/\bcash\b/i.test(text) || /cash\s*tendered/i.test(text)) {
    return { value: 'CASH', confidence: 0.9, source: 'ocr' };
  }

  // Check for change given (indicates cash payment)
  if (/change\s*[:\s]\s*\$?\d+\.\d{2}/i.test(text)) {
    return { value: 'CASH', confidence: 0.7, source: 'inferred' };
  }

  return null;
}

/**
 * Extract line items from receipt
 */
function extractLineItems(text: string): ExtractedField<LineItem[]> | null {
  const items: LineItem[] = [];
  const lines = text.split('\n');

  // Pattern: Description followed by price
  const itemPattern = /^(.+?)\s+(\d+(?:\.\d{2})?)\s*$/;
  // Pattern: Quantity x Price format
  const qtyPattern = /^(.+?)\s+(\d+)\s*[xX@]\s*\$?([\d.]+)\s+\$?([\d.]+)\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headers, totals, and empty lines
    if (trimmed.length < 5) continue;
    if (/^(sub)?total|^gst|^tax|^change|^cash|^card|^eftpos/i.test(trimmed)) continue;
    if (/thank\s*you/i.test(trimmed)) continue;

    // Try quantity x price format first
    let match = trimmed.match(qtyPattern);
    if (match) {
      items.push({
        description: match[1].trim(),
        quantity: parseInt(match[2]),
        unitPrice: parseFloat(match[3]),
        total: parseFloat(match[4]),
        confidence: 0.85,
      });
      continue;
    }

    // Try simple format
    match = trimmed.match(itemPattern);
    if (match) {
      const total = parseFloat(match[2]);
      if (total > 0 && total < 10000) {  // Reasonable item price range
        items.push({
          description: match[1].trim(),
          total,
          confidence: 0.7,
        });
      }
    }
  }

  if (items.length === 0) {
    return null;
  }

  return {
    value: items,
    confidence: items.reduce((sum, i) => sum + i.confidence, 0) / items.length,
    source: 'ocr',
  };
}

// ============================================================================
// Main Analyzer
// ============================================================================

export async function analyzeReceipt(
  text: string,
  _filename?: string
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Extract all fields
  const vendor = extractVendor(text);
  const abnResult = extractABN(text);
  const dates = extractDates(text);
  const currencyValues = extractCurrencyValues(text);
  const gstResult = extractGST(text);
  const paymentMethod = extractPaymentMethod(text);
  const items = extractLineItems(text);

  // Build extraction result
  const extraction: ReceiptExtraction = {} as ReceiptExtraction;

  if (vendor) {
    extraction.vendor = vendor;
  }

  if (abnResult) {
    const validation = validateABN(abnResult.abn);
    extraction.abn = {
      value: validation.formatted,
      confidence: abnResult.confidence,
      valid: validation.valid,
      source: 'ocr',
    };
  }

  // Get the most likely transaction date
  if (dates.length > 0) {
    extraction.date = {
      value: dates[0].date,
      confidence: dates[0].confidence,
      source: 'ocr',
      raw: dates[0].original,
    };
  }

  // Extract total amount
  const totalValue = currencyValues.find(v => v.context === 'total');
  if (totalValue) {
    extraction.total = {
      value: totalValue.value,
      confidence: totalValue.confidence,
      source: 'ocr',
    };
  } else if (currencyValues.length > 0) {
    // Take the largest value as the total
    const largest = currencyValues.reduce((max, v) =>
      v.value > max.value ? v : max
    );
    extraction.total = {
      value: largest.value,
      confidence: largest.confidence * 0.7,  // Lower confidence when inferred
      source: 'inferred',
    };
  }

  // Extract subtotal
  const subtotalValue = currencyValues.find(v => v.context === 'subtotal');
  if (subtotalValue) {
    extraction.subtotal = {
      value: subtotalValue.value,
      confidence: subtotalValue.confidence,
      source: 'ocr',
    };
  }

  // Extract GST
  const gstValue = currencyValues.find(v => v.context === 'gst');
  if (gstValue) {
    extraction.gst = {
      value: gstValue.value,
      confidence: gstValue.confidence,
      source: 'ocr',
    };
  } else if (gstResult && extraction.total) {
    extraction.gst = {
      value: gstResult.gst,
      confidence: gstResult.confidence,
      source: gstResult.isGSTInclusive ? 'inferred' : 'ocr',
    };
  }

  if (paymentMethod) {
    extraction.paymentMethod = paymentMethod;
  }

  if (items) {
    extraction.items = items;
  }

  extraction.currency = {
    value: 'AUD',
    confidence: 0.95,
    source: 'inferred',
  };

  // Calculate confidence and identify low-confidence fields
  const fieldConfidences: Record<string, { confidence: number }> = {};
  for (const [key, field] of Object.entries(extraction)) {
    if (field && typeof field === 'object' && 'confidence' in field) {
      fieldConfidences[key] = { confidence: (field as ExtractedField<unknown>).confidence };
    }
  }

  const overallConfidence = calculateOverallConfidence(fieldConfidences);
  const lowConfidenceFields = getLowConfidenceFields(fieldConfidences);

  // Infer expense category
  const categoryInference = inferExpenseCategory({
    text,
    vendor: extraction.vendor?.value,
    documentType: 'RECEIPT',
  });

  // Build suggested actions
  const suggestedActions: SuggestedAction[] = [];

  if (extraction.total?.value && extraction.vendor?.value) {
    suggestedActions.push({
      action: 'CREATE_EXPENSE',
      label: 'Create Expense',
      description: `Create an expense of $${extraction.total.value.toFixed(2)} from ${extraction.vendor.value}`,
      prefilled: {
        vendor: extraction.vendor.value,
        amount: extraction.total.value,
        date: extraction.date?.value || new Date().toISOString().split('T')[0],
        category: categoryInference.category,
        taxDeductible: false,  // Will be determined based on property link
        gstAmount: extraction.gst?.value,
      },
      confidence: Math.min(
        extraction.total.confidence,
        extraction.vendor.confidence,
        categoryInference.confidence
      ),
    });
  }

  return {
    documentType: 'RECEIPT',
    typeConfidence: 0.85,
    extractedData: extraction as unknown as Record<string, unknown>,
    rawText: text,
    overallConfidence,
    lowConfidenceFields,
    suggestedActions,
    analyzerVersion: 'receipt-v1',
    processingTimeMs: Date.now() - startTime,
  };
}
