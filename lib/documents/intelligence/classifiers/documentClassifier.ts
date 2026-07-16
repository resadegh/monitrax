/**
 * Phase 26: Document Type Classifier
 *
 * Classifies uploaded documents into specific types based on:
 * - OCR text content analysis
 * - Keyword matching
 * - Document structure patterns
 * - Vision API labels
 */

import { DocumentAnalysisType } from '../types';

// ============================================================================
// Classification Rules
// ============================================================================

interface ClassificationRule {
  type: DocumentAnalysisType;
  priority: number;
  requiredKeywords?: string[];           // Must contain ALL of these
  optionalKeywords?: string[];           // Bonus score for each match
  excludeKeywords?: string[];            // Must NOT contain these
  patterns?: RegExp[];                   // Regex patterns to match
  labels?: string[];                     // Vision API labels that suggest this type
}

/**
 * Classification rules ordered by specificity
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // === High Priority: Specific Document Types ===

  {
    type: DocumentAnalysisType.RATE_NOTICE,
    priority: 100,
    requiredKeywords: ['council', 'rates'],
    optionalKeywords: ['property', 'levy', 'general rate', 'waste', 'valuation', 'land value'],
    patterns: [
      /rate\s*notice/i,
      /council\s*rates/i,
      /property\s*rates/i,
      /general\s*rate/i,
    ],
  },

  {
    type: DocumentAnalysisType.INSURANCE_POLICY,
    priority: 95,
    requiredKeywords: ['insurance', 'policy'],
    optionalKeywords: ['premium', 'cover', 'excess', 'insured', 'underwriting', 'certificate', 'renewal'],
    patterns: [
      /insurance\s*policy/i,
      /certificate\s*of\s*insurance/i,
      /policy\s*schedule/i,
      /policy\s*number/i,
    ],
    labels: ['insurance', 'document', 'policy'],
  },

  {
    type: DocumentAnalysisType.LOAN_CONTRACT,
    priority: 95,
    requiredKeywords: ['loan', 'contract'],
    optionalKeywords: ['principal', 'interest rate', 'term', 'repayment', 'borrower', 'lender', 'mortgage', 'security'],
    patterns: [
      /loan\s*contract/i,
      /loan\s*agreement/i,
      /mortgage\s*contract/i,
      /credit\s*contract/i,
    ],
  },

  {
    type: DocumentAnalysisType.LOAN_STATEMENT,
    priority: 90,
    requiredKeywords: ['loan'],
    optionalKeywords: ['statement', 'balance', 'repayment', 'interest charged', 'principal', 'account'],
    excludeKeywords: ['contract', 'agreement'],
    patterns: [
      /loan\s*statement/i,
      /home\s*loan\s*statement/i,
      /mortgage\s*statement/i,
    ],
  },

  {
    // Phase 59: agent owner/rental statement — gross rent, itemised agent
    // costs, net disbursement. Higher priority than LEASE_AGREEMENT so
    // "rental statement" never classifies as a lease.
    type: DocumentAnalysisType.RENTAL_STATEMENT,
    priority: 92,
    requiredKeywords: ['statement'],
    optionalKeywords: ['rent', 'rental', 'owner', 'landlord', 'disbursement', 'management fee', 'letting fee', 'remittance', 'agent'],
    excludeKeywords: ['loan', 'lease agreement', 'tenancy agreement'],
    patterns: [
      /rent(al)?\s*statement/i,
      /owner\s*statement/i,
      /landlord\s*statement/i,
      /statement\s*of\s*disbursement/i,
      /management\s*fee/i,
    ],
  },

  {
    type: DocumentAnalysisType.LEASE_AGREEMENT,
    priority: 90,
    requiredKeywords: ['lease'],
    optionalKeywords: ['tenant', 'landlord', 'rent', 'premises', 'term', 'bond', 'residential tenancy'],
    patterns: [
      /lease\s*agreement/i,
      /tenancy\s*agreement/i,
      /residential\s*tenancy/i,
      /rental\s*agreement/i,
    ],
  },

  {
    type: DocumentAnalysisType.VALUATION_REPORT,
    priority: 90,
    requiredKeywords: ['valuation'],
    optionalKeywords: ['property', 'market value', 'valuer', 'assessment', 'appraisal'],
    patterns: [
      /valuation\s*report/i,
      /property\s*valuation/i,
      /market\s*value/i,
      /certified\s*valuer/i,
    ],
  },

  {
    type: DocumentAnalysisType.TAX_DOCUMENT,
    priority: 85,
    requiredKeywords: ['tax'],
    optionalKeywords: ['ato', 'assessment', 'return', 'taxable income', 'deduction', 'refund', 'offset', 'payg'],
    patterns: [
      /tax\s*return/i,
      /notice\s*of\s*assessment/i,
      /ato/i,
      /australian\s*taxation\s*office/i,
      /payment\s*summary/i,
      /income\s*statement/i,
    ],
  },

  // === Medium Priority: Common Financial Documents ===

  {
    type: DocumentAnalysisType.BANK_STATEMENT,
    priority: 80,
    requiredKeywords: ['statement'],
    optionalKeywords: ['bank', 'account', 'transaction', 'balance', 'credit', 'debit', 'bsb'],
    patterns: [
      /bank\s*statement/i,
      /account\s*statement/i,
      /transaction\s*history/i,
      /opening\s*balance/i,
      /closing\s*balance/i,
    ],
    labels: ['bank statement', 'financial document', 'statement'],
  },

  {
    type: DocumentAnalysisType.UTILITY_BILL,
    priority: 75,
    optionalKeywords: ['electricity', 'gas', 'water', 'power', 'energy', 'usage', 'consumption', 'kwh', 'mj', 'utility', 'account'],
    patterns: [
      /electricity\s*bill/i,
      /gas\s*bill/i,
      /water\s*bill/i,
      /energy\s*bill/i,
      /usage\s*summary/i,
      /your\s*account\s*summary/i,
    ],
    labels: ['utility bill', 'bill', 'electricity', 'gas', 'water'],
  },

  {
    type: DocumentAnalysisType.INVOICE,
    priority: 70,
    requiredKeywords: ['invoice'],
    optionalKeywords: ['amount due', 'payment', 'total', 'tax', 'gst', 'subtotal', 'due date', 'invoice number'],
    excludeKeywords: ['receipt', 'paid'],
    patterns: [
      /invoice\s*(number|#|no)/i,
      /tax\s*invoice/i,
      /amount\s*due/i,
      /payment\s*due/i,
    ],
    labels: ['invoice', 'document', 'bill'],
  },

  {
    type: DocumentAnalysisType.RECEIPT,
    priority: 65,
    optionalKeywords: ['receipt', 'paid', 'thank you', 'total', 'change', 'eftpos', 'cash', 'card'],
    patterns: [
      /tax\s*invoice\s*receipt/i,
      /receipt\s*(number|#|no)/i,
      /total\s*paid/i,
      /payment\s*received/i,
      /thank\s*you\s*for\s*(your\s*)?(purchase|shopping|payment)/i,
    ],
    labels: ['receipt', 'document', 'shopping'],
  },
];

// ============================================================================
// Classifier
// ============================================================================

export interface ClassificationResult {
  documentType: DocumentAnalysisType;
  confidence: number;
  matchedPatterns: string[];
  matchedKeywords: string[];
  reason: string;
}

/**
 * Classify a document based on its text content
 */
export function classifyDocument(
  text: string,
  labels?: Array<{ description: string; score: number }>
): ClassificationResult {
  const textLower = text.toLowerCase();
  const labelDescriptions = (labels || []).map(l => l.description.toLowerCase());

  let bestMatch: ClassificationResult | null = null;

  for (const rule of CLASSIFICATION_RULES) {
    let score = 0;
    const matchedPatterns: string[] = [];
    const matchedKeywords: string[] = [];

    // Check exclude keywords first
    if (rule.excludeKeywords?.some(kw => textLower.includes(kw.toLowerCase()))) {
      continue;
    }

    // Check required keywords
    if (rule.requiredKeywords) {
      const allRequired = rule.requiredKeywords.every(kw =>
        textLower.includes(kw.toLowerCase())
      );
      if (!allRequired) {
        continue;  // Skip this rule if required keywords not found
      }
      score += rule.requiredKeywords.length * 20;
      matchedKeywords.push(...rule.requiredKeywords);
    }

    // Check optional keywords
    if (rule.optionalKeywords) {
      for (const kw of rule.optionalKeywords) {
        if (textLower.includes(kw.toLowerCase())) {
          score += 5;
          matchedKeywords.push(kw);
        }
      }
    }

    // Check patterns
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          score += 15;
          matchedPatterns.push(pattern.source);
        }
      }
    }

    // Check Vision API labels
    if (rule.labels) {
      for (const label of rule.labels) {
        if (labelDescriptions.includes(label.toLowerCase())) {
          score += 10;
        }
      }
    }

    // Apply priority as a multiplier
    score = score * (1 + rule.priority / 200);

    // Calculate confidence (normalize to 0-1)
    const confidence = Math.min(score / 100, 1);

    if (!bestMatch || confidence > bestMatch.confidence) {
      const reasons: string[] = [];
      if (matchedPatterns.length > 0) {
        reasons.push(`patterns matched: ${matchedPatterns.length}`);
      }
      if (matchedKeywords.length > 0) {
        reasons.push(`keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
      }

      bestMatch = {
        documentType: rule.type,
        confidence,
        matchedPatterns,
        matchedKeywords: [...new Set(matchedKeywords)],
        reason: reasons.join('; ') || 'Best match based on content analysis',
      };
    }
  }

  // Default to UNKNOWN if no good match
  if (!bestMatch || bestMatch.confidence < 0.2) {
    return {
      documentType: DocumentAnalysisType.UNKNOWN,
      confidence: 0.1,
      matchedPatterns: [],
      matchedKeywords: [],
      reason: 'Unable to classify document type',
    };
  }

  return bestMatch;
}

/**
 * Quick classification based on filename only
 */
export function classifyByFilename(filename: string): {
  suggestedType: DocumentAnalysisType | null;
  confidence: number;
} {
  const lower = filename.toLowerCase();

  const filenamePatterns: Array<{ pattern: RegExp; type: DocumentAnalysisType; confidence: number }> = [
    { pattern: /rate.*notice/i, type: DocumentAnalysisType.RATE_NOTICE, confidence: 0.7 },
    { pattern: /insurance.*policy/i, type: DocumentAnalysisType.INSURANCE_POLICY, confidence: 0.7 },
    { pattern: /bank.*statement/i, type: DocumentAnalysisType.BANK_STATEMENT, confidence: 0.7 },
    { pattern: /loan.*statement/i, type: DocumentAnalysisType.LOAN_STATEMENT, confidence: 0.7 },
    { pattern: /loan.*contract/i, type: DocumentAnalysisType.LOAN_CONTRACT, confidence: 0.7 },
    { pattern: /lease.*agreement/i, type: DocumentAnalysisType.LEASE_AGREEMENT, confidence: 0.7 },
    { pattern: /valuation/i, type: DocumentAnalysisType.VALUATION_REPORT, confidence: 0.6 },
    { pattern: /tax.*return/i, type: DocumentAnalysisType.TAX_DOCUMENT, confidence: 0.7 },
    { pattern: /invoice/i, type: DocumentAnalysisType.INVOICE, confidence: 0.6 },
    { pattern: /receipt/i, type: DocumentAnalysisType.RECEIPT, confidence: 0.6 },
    { pattern: /electricity|gas|water|utility/i, type: DocumentAnalysisType.UTILITY_BILL, confidence: 0.6 },
  ];

  for (const { pattern, type, confidence } of filenamePatterns) {
    if (pattern.test(lower)) {
      return { suggestedType: type, confidence };
    }
  }

  return { suggestedType: null, confidence: 0 };
}

/**
 * Get the display name for a document type
 */
export function getDocumentTypeName(type: DocumentAnalysisType): string {
  const names: Record<DocumentAnalysisType, string> = {
    [DocumentAnalysisType.RECEIPT]: 'Receipt',
    [DocumentAnalysisType.INVOICE]: 'Invoice',
    [DocumentAnalysisType.BANK_STATEMENT]: 'Bank Statement',
    [DocumentAnalysisType.UTILITY_BILL]: 'Utility Bill',
    [DocumentAnalysisType.RATE_NOTICE]: 'Rate Notice',
    [DocumentAnalysisType.INSURANCE_POLICY]: 'Insurance Policy',
    [DocumentAnalysisType.LOAN_STATEMENT]: 'Loan Statement',
    [DocumentAnalysisType.LOAN_CONTRACT]: 'Loan Contract',
    [DocumentAnalysisType.LEASE_AGREEMENT]: 'Lease Agreement',
    [DocumentAnalysisType.VALUATION_REPORT]: 'Valuation Report',
    [DocumentAnalysisType.TAX_DOCUMENT]: 'Tax Document',
    [DocumentAnalysisType.RENTAL_STATEMENT]: 'Rental Statement', // Phase 59
    [DocumentAnalysisType.UNKNOWN]: 'Unknown Document',
  };

  return names[type] || type;
}
