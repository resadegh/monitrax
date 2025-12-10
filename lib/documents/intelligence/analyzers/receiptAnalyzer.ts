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
 * Extract vendor name from receipt text
 * Usually the vendor is at the top of the receipt
 */
function extractVendor(text: string): ExtractedField<string> | null {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  // Common patterns for vendor names
  const vendorPatterns = [
    // Pattern: "TAX INVOICE - Vendor Name" or similar
    /^(?:TAX\s*)?(?:INVOICE|RECEIPT)[:\s-]+(.+)/i,
    // Pattern: Look for ABN line and take the line before it
    /^(.+?)\n.*ABN/im,
  ];

  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim();
      if (vendor.length > 2 && vendor.length < 100) {
        return {
          value: normaliseVendor(vendor),
          confidence: 0.85,
          source: 'ocr',
        };
      }
    }
  }

  // Fallback: Use first non-empty line that looks like a business name
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    // Skip lines that are just numbers or short
    if (trimmed.length < 3 || /^[\d\s.,-]+$/.test(trimmed)) {
      continue;
    }
    // Skip lines that look like addresses or dates
    if (/^\d+\s+\w+\s+(st|street|rd|road|ave|avenue)/i.test(trimmed)) {
      continue;
    }
    if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) {
      continue;
    }

    return {
      value: normaliseVendor(trimmed),
      confidence: 0.7,
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
