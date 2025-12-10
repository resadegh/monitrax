/**
 * Phase 19 & 25: Document Management Constants
 * Centralized constants for document handling
 */

// Supported MIME types for document uploads
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Large file threshold (5MB - triggers cloud storage preference)
export const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

// Signed URL expiry time in seconds (5 minutes)
export const SIGNED_URL_EXPIRY = 5 * 60;

// File extension to MIME type mapping
export const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

// MIME type to file extension mapping
export const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

// Category display names
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  CONTRACT: 'Contracts',
  STATEMENT: 'Statements',
  RECEIPT: 'Receipts',
  TAX: 'Tax Documents',
  PDS: 'Product Disclosures',
  VALUATION: 'Valuations',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Leases',
  INVOICE: 'Invoices',
  OTHER: 'Other',
};

// Category folder names (for storage paths)
export const CATEGORY_FOLDERS: Record<string, string> = {
  CONTRACT: 'contracts',
  STATEMENT: 'statements',
  RECEIPT: 'receipts',
  TAX: 'tax-documents',
  PDS: 'product-disclosures',
  VALUATION: 'valuations',
  INSURANCE: 'insurance',
  MORTGAGE: 'mortgage',
  LEASE: 'leases',
  INVOICE: 'invoices',
  OTHER: 'other',
};

// Entity type display names
export const ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  PROPERTY: 'Property',
  LOAN: 'Loan',
  EXPENSE: 'Expense',
  INCOME: 'Income',
  ACCOUNT: 'Bank Account',
  OFFSET_ACCOUNT: 'Offset Account',
  INVESTMENT_ACCOUNT: 'Investment Account',
  INVESTMENT_HOLDING: 'Investment Holding',
  TRANSACTION: 'Transaction',
};
