/**
 * Phase 26: Invoice Analyzer
 *
 * Extracts structured data from invoices including:
 * - Vendor name and ABN
 * - Invoice number and dates
 * - Total amount, subtotal, and GST
 * - Line items
 * - Payment terms and bank details
 */

import {
  InvoiceExtraction,
  ExtractedField,
  LineItem,
  BankDetails,
  SuggestedAction,
  AnalysisResult,
  calculateOverallConfidence,
  getLowConfidenceFields,
} from '../types';
import {
  extractABN,
  validateABN,
  extractGST,
  extractDates,
  extractCurrencyValues,
} from '../parsers/australian';
import { inferExpenseCategory, normaliseVendor } from '../parsers/categoryInference';

// ============================================================================
// Invoice-Specific Extractors
// ============================================================================

/**
 * Extract invoice number from text
 */
function extractInvoiceNumber(text: string): ExtractedField<string> | null {
  const patterns = [
    /Invoice\s*(?:Number|No\.?|#)[:\s]*([A-Z0-9-]+)/i,
    /Inv(?:oice)?\s*(?:Number|No\.?|#)[:\s]*([A-Z0-9-]+)/i,
    /Invoice[:\s]+([A-Z0-9-]+)/i,
    /Ref(?:erence)?[:\s]+([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return {
        value: match[1].trim(),
        confidence: 0.9,
        source: 'ocr',
      };
    }
  }

  return null;
}

/**
 * Extract vendor name from invoice
 */
function extractVendor(text: string): ExtractedField<string> | null {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Look for "From:" or "Issued by:" patterns
  const fromPatterns = [
    /From[:\s]+(.+)/i,
    /Issued\s*by[:\s]+(.+)/i,
    /Seller[:\s]+(.+)/i,
  ];

  for (const pattern of fromPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim();
      if (vendor.length > 2 && vendor.length < 100) {
        return {
          value: normaliseVendor(vendor),
          confidence: 0.9,
          source: 'ocr',
        };
      }
    }
  }

  // Similar to receipt: first meaningful line is often the vendor
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || /^[\d\s.,-]+$/.test(trimmed)) continue;
    if (/^\d+\s+\w+\s+(st|street|rd|road)/i.test(trimmed)) continue;
    if (/invoice|tax|date|abn/i.test(trimmed)) continue;

    return {
      value: normaliseVendor(trimmed),
      confidence: 0.7,
      source: 'inferred',
    };
  }

  return null;
}

/**
 * Extract due date from invoice
 */
function extractDueDate(text: string): ExtractedField<string> | null {
  const patterns = [
    /Due\s*Date[:\s]+([^\n]+)/i,
    /Payment\s*Due[:\s]+([^\n]+)/i,
    /Pay\s*by[:\s]+([^\n]+)/i,
    /Due[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const { parseAustralianDate } = require('../parsers/australian');
      const parsed = parseAustralianDate(match[1]);
      if (parsed) {
        return {
          value: parsed.date,
          confidence: parsed.confidence,
          source: 'ocr',
          raw: parsed.original,
        };
      }
    }
  }

  return null;
}

/**
 * Extract payment terms from invoice
 */
function extractPaymentTerms(text: string): ExtractedField<string> | null {
  const patterns = [
    /Payment\s*Terms?[:\s]+(.+)/i,
    /Terms?[:\s]+(Net\s*\d+|Due\s*on\s*receipt|.+?(?=\n|$))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const terms = match[1].trim();
      if (terms.length > 0 && terms.length < 100) {
        return {
          value: terms,
          confidence: 0.85,
          source: 'ocr',
        };
      }
    }
  }

  return null;
}

/**
 * Extract bank details from invoice
 */
function extractBankDetails(text: string): ExtractedField<BankDetails> | null {
  const details: BankDetails = {};
  let found = false;

  // BSB pattern (XXX-XXX or XXXXXX)
  const bsbMatch = text.match(/BSB[:\s]*(\d{3}[-\s]?\d{3})/i);
  if (bsbMatch) {
    details.bsb = bsbMatch[1].replace(/[-\s]/g, '-');
    if (details.bsb.length === 6) {
      details.bsb = `${details.bsb.slice(0, 3)}-${details.bsb.slice(3)}`;
    }
    found = true;
  }

  // Account number pattern
  const accountMatch = text.match(/Account\s*(?:No\.?|Number)?[:\s]*(\d{6,12})/i);
  if (accountMatch) {
    details.accountNumber = accountMatch[1];
    found = true;
  }

  // Account name pattern
  const nameMatch = text.match(/Account\s*Name[:\s]+(.+)/i);
  if (nameMatch) {
    details.accountName = nameMatch[1].trim();
    found = true;
  }

  if (!found) {
    return null;
  }

  return {
    value: details,
    confidence: 0.85,
    source: 'ocr',
  };
}

/**
 * Extract line items from invoice
 */
function extractLineItems(text: string): ExtractedField<LineItem[]> | null {
  const items: LineItem[] = [];
  const lines = text.split('\n');

  // Common invoice line item patterns
  // Description | Qty | Unit Price | Amount
  const linePatterns = [
    // Full format: Description Qty @ Price = Total
    /^(.+?)\s+(\d+)\s*[@xX]\s*\$?([\d,.]+)\s*[=\s]*\$?([\d,.]+)\s*$/,
    // Simple format: Description Amount
    /^(.+?)\s+\$?([\d,]+\.\d{2})\s*$/,
  ];

  let inItemsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of items section
    if (/^(Description|Item|Product|Service)/i.test(trimmed)) {
      inItemsSection = true;
      continue;
    }

    // Detect end of items section
    if (/^(Sub\s*)?Total|^GST|^Amount\s*Due/i.test(trimmed)) {
      inItemsSection = false;
      continue;
    }

    if (!inItemsSection && lines.indexOf(line) > 20) continue;
    if (trimmed.length < 5) continue;

    for (const pattern of linePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        if (match.length === 5) {
          // Full format
          items.push({
            description: match[1].trim(),
            quantity: parseInt(match[2]),
            unitPrice: parseFloat(match[3].replace(/,/g, '')),
            total: parseFloat(match[4].replace(/,/g, '')),
            confidence: 0.85,
          });
        } else if (match.length === 3) {
          // Simple format
          const total = parseFloat(match[2].replace(/,/g, ''));
          if (total > 0 && total < 100000) {
            items.push({
              description: match[1].trim(),
              total,
              confidence: 0.7,
            });
          }
        }
        break;
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

export async function analyzeInvoice(
  text: string,
  _filename?: string
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Extract all fields
  const vendor = extractVendor(text);
  const invoiceNumber = extractInvoiceNumber(text);
  const abnResult = extractABN(text);
  const dates = extractDates(text);
  const dueDate = extractDueDate(text);
  const currencyValues = extractCurrencyValues(text);
  const gstResult = extractGST(text);
  const paymentTerms = extractPaymentTerms(text);
  const bankDetails = extractBankDetails(text);
  const items = extractLineItems(text);

  // Build extraction result
  const extraction: InvoiceExtraction = {} as InvoiceExtraction;

  if (vendor) {
    extraction.vendor = vendor;
  }

  if (invoiceNumber) {
    extraction.invoiceNumber = invoiceNumber;
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

  // Invoice date (usually the first/most prominent date)
  if (dates.length > 0) {
    extraction.invoiceDate = {
      value: dates[0].date,
      confidence: dates[0].confidence,
      source: 'ocr',
      raw: dates[0].original,
    };
  }

  if (dueDate) {
    extraction.dueDate = dueDate;
  }

  // Extract amounts
  const totalValue = currencyValues.find(v => v.context === 'total');
  if (totalValue) {
    extraction.total = {
      value: totalValue.value,
      confidence: totalValue.confidence,
      source: 'ocr',
    };
  } else if (currencyValues.length > 0) {
    const largest = currencyValues.reduce((max, v) => v.value > max.value ? v : max);
    extraction.total = {
      value: largest.value,
      confidence: largest.confidence * 0.7,
      source: 'inferred',
    };
  }

  const subtotalValue = currencyValues.find(v => v.context === 'subtotal');
  if (subtotalValue) {
    extraction.subtotal = {
      value: subtotalValue.value,
      confidence: subtotalValue.confidence,
      source: 'ocr',
    };
  }

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

  if (paymentTerms) {
    extraction.paymentTerms = paymentTerms;
  }

  if (bankDetails) {
    extraction.bankDetails = bankDetails;
  }

  if (items) {
    extraction.items = items;
  }

  extraction.currency = {
    value: 'AUD',
    confidence: 0.95,
    source: 'inferred',
  };

  // Calculate confidence
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
    documentType: 'INVOICE',
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
        date: extraction.invoiceDate?.value || new Date().toISOString().split('T')[0],
        category: categoryInference.category,
        taxDeductible: false,
        gstAmount: extraction.gst?.value,
        invoiceNumber: extraction.invoiceNumber?.value,
        dueDate: extraction.dueDate?.value,
      },
      confidence: Math.min(
        extraction.total.confidence,
        extraction.vendor.confidence,
        categoryInference.confidence
      ),
    });

    // If there's a due date, suggest setting a reminder
    if (extraction.dueDate?.value) {
      suggestedActions.push({
        action: 'SET_REMINDER',
        label: 'Set Payment Reminder',
        description: `Set a reminder for the due date: ${extraction.dueDate.value}`,
        prefilled: {
          date: extraction.dueDate.value,
          description: `Pay invoice ${extraction.invoiceNumber?.value || ''} to ${extraction.vendor.value}`,
          amount: extraction.total.value,
        },
        confidence: extraction.dueDate.confidence * 0.8,
      });
    }
  }

  return {
    documentType: 'INVOICE',
    typeConfidence: 0.9,
    extractedData: extraction as unknown as Record<string, unknown>,
    rawText: text,
    overallConfidence,
    lowConfidenceFields,
    suggestedActions,
    analyzerVersion: 'invoice-v1',
    processingTimeMs: Date.now() - startTime,
  };
}
