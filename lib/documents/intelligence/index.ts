/**
 * Phase 26: Document Intelligence Engine
 *
 * Main entry point for document intelligence capabilities.
 * Extends the Document Management Engine (Phase 25) with AI-powered analysis.
 *
 * Usage:
 * import {
 *   getDocumentIntelligenceEngine,
 *   analyzeDocument,
 *   classifyDocument,
 * } from '@/lib/documents/intelligence';
 */

// Main Engine
export {
  DocumentIntelligenceEngine,
  getDocumentIntelligenceEngine,
} from './DocumentIntelligenceEngine';

// Types
export type {
  AnalysisResult,
  AnalysisRequest,
  AnalysisResponse,
  ConfirmActionRequest,
  ConfirmActionResponse,
  SuggestedAction,
  SuggestedActionType,
  ExtractedField,
  ReceiptExtraction,
  InvoiceExtraction,
  BankStatementExtraction,
  UtilityBillExtraction,
  RateNoticeExtraction,
  InsurancePolicyExtraction,
  LoanDocumentExtraction,
  LeaseAgreementExtraction,
  DocumentExtraction,
  LineItem,
  BankDetails,
} from './types';

export {
  CONFIDENCE_THRESHOLDS,
  getConfidenceLevel,
  calculateOverallConfidence,
  getLowConfidenceFields,
  DocumentAnalysisType,
  DocumentAnalysisStatus,
} from './types';

// Classifiers
export {
  classifyDocument,
  classifyByFilename,
  getDocumentTypeName,
} from './classifiers/documentClassifier';

// Australian Parsers
export {
  validateABN,
  extractABN,
  extractGST,
  calculateGSTFromTotal,
  calculateGSTFromSubtotal,
  parseAustralianDate,
  extractDates,
  parseAustralianCurrency,
  extractCurrencyValues,
  getAustralianFinancialYear,
  extractFinancialYear,
  GST_RATE,
} from './parsers/australian';

// Category Inference
export {
  inferExpenseCategory,
  inferTaxDeductibility,
  inferIsEssential,
  normaliseVendor,
} from './parsers/categoryInference';

// Vision Service
export {
  getVisionService,
  VisionService,
  type OCRResult,
  type TextBlock,
  type LabelResult,
} from './services/visionService';

// AI Analyzer (uses existing OpenAI integration)
export {
  analyzeDocumentWithAI,
  isAIAnalysisAvailable,
  explainExtraction,
} from './analyzers/aiDocumentAnalyzer';

// Individual Analyzers
export { analyzeReceipt } from './analyzers/receiptAnalyzer';
export { analyzeInvoice } from './analyzers/invoiceAnalyzer';

// Engine Version
export const INTELLIGENCE_ENGINE_VERSION = '1.0.0';
