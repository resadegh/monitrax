/**
 * Phase 25: Document Management Engine Types
 * Central type definitions for the DME
 */

import { DocumentCategory, StorageProviderType, LinkedEntityType } from '../types';

// ============================================================================
// Upload Source Types
// ============================================================================

export enum UploadSource {
  // Library uploads
  DOCUMENTS_LIBRARY = 'documents_library',

  // Entity form uploads
  EXPENSE_FORM = 'expense_form',
  EXPENSE_DIALOG = 'expense_dialog',
  PROPERTY_FORM = 'property_form',
  LOAN_FORM = 'loan_form',
  INCOME_FORM = 'income_form',

  // Import operations
  BANK_IMPORT = 'bank_import',
  BULK_IMPORT = 'bulk_import',

  // API uploads
  API_DIRECT = 'api_direct',
}

// ============================================================================
// Upload Context
// ============================================================================

export interface EntityContext {
  propertyId?: string;
  expenseId?: string;
  loanId?: string;
  incomeId?: string;
  accountId?: string;
  offsetAccountId?: string;
  investmentAccountId?: string;
  investmentHoldingId?: string;
  transactionId?: string;
  assetId?: string;
}

export interface UserInput {
  category?: DocumentCategory;
  description?: string;
  tags?: string[];
  storagePreference?: StorageProviderType;
}

export interface UploadContext {
  // Source identification
  source: UploadSource;

  // File information
  file: File | Buffer;
  filename: string;
  mimeType: string;
  size: number;

  // Entity context (optional based on source)
  entities: EntityContext;

  // User input (optional)
  userInput: UserInput;

  // Request metadata
  userId: string;
  timestamp: Date;

  // Additional context data (populated by rule engine)
  _resolvedData?: {
    expense?: {
      id: string;
      category: string;
      propertyId?: string;
      loanId?: string;
    };
    property?: {
      id: string;
      name: string;
    };
    loan?: {
      id: string;
      lender: string;
    };
  };
}

// ============================================================================
// Entity Link
// ============================================================================

export interface EntityLink {
  entityType: LinkedEntityType;
  entityId: string;
}

// ============================================================================
// Rule Interfaces
// ============================================================================

export interface StorageRule {
  name: string;
  priority: number;
  matches(context: UploadContext): boolean | Promise<boolean>;
  getProvider(context: UploadContext): StorageProviderType;
}

export interface CategoryRule {
  name: string;
  priority: number;
  matches(context: UploadContext): boolean | Promise<boolean>;
  getCategory(context: UploadContext): DocumentCategory;
}

export interface LinkingRule {
  name: string;
  priority: number;
  matches(context: UploadContext): boolean;
  getLinks(context: UploadContext): Promise<EntityLink[]>;
}

export interface PathRule {
  name: string;
  priority: number;
  matches(context: UploadContext, resolvedLinks: EntityLink[]): boolean;
  generatePath(context: UploadContext, resolvedLinks: EntityLink[]): string;
}

export interface RetentionRule {
  name: string;
  priority: number;
  matches(context: UploadContext, category: DocumentCategory): boolean;
  getRetentionDays(): number;
}

// ============================================================================
// Resolved Configuration
// ============================================================================

export interface ResolvedUploadConfig {
  // Storage decision
  storageProvider: StorageProviderType;
  storagePath: string;

  // Categorization
  category: DocumentCategory;
  suggestedTags: string[];

  // Entity linking
  links: EntityLink[];

  // Retention (optional)
  retentionDays?: number;
}

// ============================================================================
// Engine Result
// ============================================================================

export interface EngineResult {
  success: boolean;
  document?: {
    id: string;
    filename: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    category: DocumentCategory;
    storageProvider: StorageProviderType;
    storagePath: string;
    storageUrl: string | null;
    description: string | null;
    tags: string[];
    uploadedAt: Date;
    links: {
      id: string;
      entityType: LinkedEntityType;
      entityId: string;
    }[];
  };
  storagePath?: string;
  storageUrl?: string | null;
  error?: string;
  /** Machine-readable failure reason (e.g. 'STORAGE_QUOTA_EXCEEDED') for precise HTTP mapping. */
  errorCode?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createUploadContext(
  partial: Partial<UploadContext> & {
    file: File | Buffer;
    filename: string;
    mimeType: string;
    size: number;
    userId: string;
  }
): UploadContext {
  return {
    source: partial.source || UploadSource.API_DIRECT,
    file: partial.file,
    filename: partial.filename,
    mimeType: partial.mimeType,
    size: partial.size,
    entities: partial.entities || {},
    userInput: partial.userInput || {},
    userId: partial.userId,
    timestamp: partial.timestamp || new Date(),
  };
}
