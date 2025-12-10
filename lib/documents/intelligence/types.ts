/**
 * Phase 26: Document Intelligence Engine Types
 *
 * This module extends the Document Management Engine (Phase 25) with AI-powered
 * document analysis capabilities. It does NOT duplicate DME functionality.
 *
 * Integration with Phase 25:
 * - Uses Document model from DME for storage
 * - Extends upload flow with optional analysis
 * - Adds DocumentAnalysis as a related model to Document
 */

// Document analysis enums (matches Prisma schema)
// Defined locally to avoid dependency on Prisma client regeneration timing

export enum DocumentAnalysisType {
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  BANK_STATEMENT = 'BANK_STATEMENT',
  UTILITY_BILL = 'UTILITY_BILL',
  RATE_NOTICE = 'RATE_NOTICE',
  INSURANCE_POLICY = 'INSURANCE_POLICY',
  LOAN_STATEMENT = 'LOAN_STATEMENT',
  LOAN_CONTRACT = 'LOAN_CONTRACT',
  LEASE_AGREEMENT = 'LEASE_AGREEMENT',
  VALUATION_REPORT = 'VALUATION_REPORT',
  TAX_DOCUMENT = 'TAX_DOCUMENT',
  UNKNOWN = 'UNKNOWN',
}

export enum DocumentAnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ============================================================================
// Extracted Field Types
// ============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedField<T> {
  value: T;
  confidence: number;      // 0.0 - 1.0
  source?: 'ocr' | 'docai' | 'ai' | 'inferred';
  boundingBox?: BoundingBox;
  raw?: string;            // Original text before parsing
}

// ============================================================================
// Line Item Types
// ============================================================================

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  confidence: number;
}

export interface BankDetails {
  bsb?: string;
  accountNumber?: string;
  accountName?: string;
}

// ============================================================================
// Document-Specific Extraction Schemas
// ============================================================================

export interface ReceiptExtraction {
  vendor: ExtractedField<string>;
  abn?: ExtractedField<string> & { valid?: boolean };
  date: ExtractedField<string>;           // ISO date
  total: ExtractedField<number>;
  subtotal?: ExtractedField<number>;
  gst?: ExtractedField<number>;
  paymentMethod?: ExtractedField<'CASH' | 'CARD' | 'EFTPOS' | 'OTHER'>;
  items?: ExtractedField<LineItem[]>;
  receiptNumber?: ExtractedField<string>;
  currency?: ExtractedField<string>;
}

export interface InvoiceExtraction {
  vendor: ExtractedField<string>;
  abn?: ExtractedField<string> & { valid?: boolean };
  invoiceNumber: ExtractedField<string>;
  invoiceDate: ExtractedField<string>;
  dueDate?: ExtractedField<string>;
  total: ExtractedField<number>;
  subtotal?: ExtractedField<number>;
  gst?: ExtractedField<number>;
  items?: ExtractedField<LineItem[]>;
  paymentTerms?: ExtractedField<string>;
  bankDetails?: ExtractedField<BankDetails>;
  currency?: ExtractedField<string>;
}

export interface BankStatementExtraction {
  bankName: ExtractedField<string>;
  accountNumber?: ExtractedField<string>;
  accountName?: ExtractedField<string>;
  bsb?: ExtractedField<string>;
  statementPeriod: ExtractedField<{ from: string; to: string }>;
  openingBalance?: ExtractedField<number>;
  closingBalance?: ExtractedField<number>;
  transactionCount?: ExtractedField<number>;
}

export interface UtilityBillExtraction {
  provider: ExtractedField<string>;
  accountNumber?: ExtractedField<string>;
  serviceAddress?: ExtractedField<string>;
  servicePeriod: ExtractedField<{ from: string; to: string }>;
  total: ExtractedField<number>;
  dueDate?: ExtractedField<string>;
  usageAmount?: ExtractedField<string>;   // e.g., "150 kWh"
  usageUnit?: ExtractedField<string>;     // e.g., "kWh", "L", "MJ"
}

export interface RateNoticeExtraction {
  council: ExtractedField<string>;
  propertyAddress: ExtractedField<string>;
  ratePeriod: ExtractedField<{ from: string; to: string }>;
  total: ExtractedField<number>;
  dueDate?: ExtractedField<string>;
  valuationAmount?: ExtractedField<number>;
}

export interface InsurancePolicyExtraction {
  insurer: ExtractedField<string>;
  policyNumber: ExtractedField<string>;
  policyType: ExtractedField<'BUILDING' | 'CONTENTS' | 'LANDLORD' | 'CAR' | 'HEALTH' | 'LIFE' | 'OTHER'>;
  premium: ExtractedField<number>;
  premiumFrequency: ExtractedField<'MONTHLY' | 'ANNUAL'>;
  coverAmount?: ExtractedField<number>;
  excessAmount?: ExtractedField<number>;
  policyStart: ExtractedField<string>;
  policyEnd: ExtractedField<string>;
  insuredProperty?: ExtractedField<string>;
  insuredItems?: ExtractedField<string[]>;
}

export interface LoanDocumentExtraction {
  lender: ExtractedField<string>;
  loanType: ExtractedField<'HOME_LOAN' | 'INVESTMENT_LOAN' | 'PERSONAL' | 'CAR' | 'OTHER'>;
  principalAmount: ExtractedField<number>;
  interestRate: ExtractedField<number>;
  rateType: ExtractedField<'VARIABLE' | 'FIXED'>;
  loanTerm?: ExtractedField<number>;          // months
  repaymentType?: ExtractedField<'PRINCIPAL_AND_INTEREST' | 'INTEREST_ONLY'>;
  repaymentFrequency?: ExtractedField<'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'>;
  repaymentAmount?: ExtractedField<number>;
  settlementDate?: ExtractedField<string>;
  propertyAddress?: ExtractedField<string>;
  accountNumber?: ExtractedField<string>;
  bsb?: ExtractedField<string>;
}

export interface LeaseAgreementExtraction {
  landlord: ExtractedField<string>;
  tenant: ExtractedField<string>;
  propertyAddress: ExtractedField<string>;
  rentAmount: ExtractedField<number>;
  rentFrequency: ExtractedField<'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'>;
  leaseStart: ExtractedField<string>;
  leaseEnd: ExtractedField<string>;
  bond?: ExtractedField<number>;
}

export interface ValuationReportExtraction {
  propertyAddress: ExtractedField<string>;
  valuer: ExtractedField<string>;
  valuationDate: ExtractedField<string>;
  marketValue: ExtractedField<number>;
  landValue?: ExtractedField<number>;
  improvementsValue?: ExtractedField<number>;
}

export interface TaxDocumentExtraction {
  documentType: ExtractedField<'TAX_RETURN' | 'NOTICE_OF_ASSESSMENT' | 'PAYMENT_SUMMARY' | 'BAS' | 'OTHER'>;
  financialYear: ExtractedField<string>;      // e.g., "2024-25"
  taxableIncome?: ExtractedField<number>;
  taxPayable?: ExtractedField<number>;
  taxRefund?: ExtractedField<number>;
  gstCollected?: ExtractedField<number>;
  gstPaid?: ExtractedField<number>;
}

// Union type for all extractions
export type DocumentExtraction =
  | { type: 'RECEIPT'; data: ReceiptExtraction }
  | { type: 'INVOICE'; data: InvoiceExtraction }
  | { type: 'BANK_STATEMENT'; data: BankStatementExtraction }
  | { type: 'UTILITY_BILL'; data: UtilityBillExtraction }
  | { type: 'RATE_NOTICE'; data: RateNoticeExtraction }
  | { type: 'INSURANCE_POLICY'; data: InsurancePolicyExtraction }
  | { type: 'LOAN_STATEMENT'; data: LoanDocumentExtraction }
  | { type: 'LOAN_CONTRACT'; data: LoanDocumentExtraction }
  | { type: 'LEASE_AGREEMENT'; data: LeaseAgreementExtraction }
  | { type: 'VALUATION_REPORT'; data: ValuationReportExtraction }
  | { type: 'TAX_DOCUMENT'; data: TaxDocumentExtraction }
  | { type: 'UNKNOWN'; data: Record<string, unknown> };

// ============================================================================
// Suggested Actions
// ============================================================================

export type SuggestedActionType =
  | 'CREATE_EXPENSE'
  | 'CREATE_INCOME'
  | 'UPDATE_LOAN'
  | 'CREATE_LOAN'
  | 'UPDATE_PROPERTY_VALUE'
  | 'LINK_TO_PROPERTY'
  | 'LINK_TO_ACCOUNT'
  | 'SET_REMINDER'
  | 'VERIFY_TRANSACTION';

export interface SuggestedAction {
  action: SuggestedActionType;
  label: string;
  description?: string;
  prefilled: Record<string, unknown>;   // Pre-filled form data
  confidence: number;
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface AnalysisResult {
  // Document classification
  documentType: string;   // DocumentAnalysisType
  typeConfidence: number;

  // Extraction result
  extractedData: Record<string, unknown>;
  rawText?: string;

  // Confidence metrics
  overallConfidence: number;
  lowConfidenceFields: string[];

  // Suggested actions
  suggestedActions: SuggestedAction[];

  // Processing metadata
  analyzerVersion: string;
  processingTimeMs: number;
}

export interface AnalysisRequest {
  documentId: string;
  forceReanalyze?: boolean;
}

export interface AnalysisResponse {
  success: boolean;
  analysis?: {
    id: string;
    documentId: string;
    documentType: string;
    typeConfidence: number;
    overallConfidence: number;
    extractedData: Record<string, unknown>;
    lowConfidenceFields: string[];
    suggestedActions: SuggestedAction[];
    rawText?: string;
    status: string;
    analyzedAt?: Date;
    userVerified: boolean;
  };
  error?: string;
}

// ============================================================================
// Confirm Action Types
// ============================================================================

export interface ConfirmActionRequest {
  analysisId: string;
  action: SuggestedActionType;
  data: Record<string, unknown>;
  corrections?: Record<string, boolean>;   // Fields user modified
}

export interface ConfirmActionResponse {
  success: boolean;
  entity?: {
    type: string;
    id: string;
    data: Record<string, unknown>;
  };
  error?: string;
}

// ============================================================================
// Analyzer Interface
// ============================================================================

export interface DocumentAnalyzer {
  name: string;
  supportedTypes: string[];   // MIME types

  /**
   * Analyze a document and extract structured data
   */
  analyze(
    fileBuffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<AnalysisResult>;
}

// ============================================================================
// Confidence Thresholds
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9,      // >90% - auto-fill with high confidence
  MEDIUM: 0.7,    // 70-90% - show warning indicator
  LOW: 0.5,       // 50-70% - requires review
  REJECT: 0.3,    // <30% - don't show, too unreliable
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'reject' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'reject';
}

export function calculateOverallConfidence(
  fields: Record<string, { confidence: number } | undefined>
): number {
  const values = Object.values(fields)
    .filter((f): f is { confidence: number } => f !== undefined)
    .map(f => f.confidence);

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getLowConfidenceFields(
  fields: Record<string, { confidence: number } | undefined>,
  threshold = CONFIDENCE_THRESHOLDS.MEDIUM
): string[] {
  return Object.entries(fields)
    .filter(([, field]) => field && field.confidence < threshold)
    .map(([name]) => name);
}
