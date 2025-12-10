/**
 * Phase 25: Document Engine Hook
 * React hook for uploading documents through the Document Management Engine
 */

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { DocumentCategory, StorageProviderType } from '@/lib/documents/types';

// Upload source types
export enum UploadSource {
  DOCUMENTS_LIBRARY = 'documents_library',
  EXPENSE_FORM = 'expense_form',
  EXPENSE_DIALOG = 'expense_dialog',
  PROPERTY_FORM = 'property_form',
  LOAN_FORM = 'loan_form',
  INCOME_FORM = 'income_form',
  BANK_IMPORT = 'bank_import',
  BULK_IMPORT = 'bulk_import',
  API_DIRECT = 'api_direct',
}

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
}

export interface UploadOptions {
  source: UploadSource;
  entities?: EntityContext;
  category?: DocumentCategory;
  description?: string;
  tags?: string[];
  storagePreference?: StorageProviderType;
  localPath?: string; // For LOCAL_DRIVE uploads
}

export interface UploadedDocument {
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
    entityType: string;
    entityId: string;
  }[];
}

export interface UseDocumentEngineReturn {
  upload: (file: File, options: UploadOptions) => Promise<UploadedDocument | null>;
  uploadMultiple: (files: File[], options: UploadOptions) => Promise<UploadedDocument[]>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for uploading documents through the Document Management Engine
 */
export function useDocumentEngine(): UseDocumentEngineReturn {
  const { token } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a single file through the engine
   */
  const upload = useCallback(
    async (file: File, options: UploadOptions): Promise<UploadedDocument | null> => {
      if (!token) {
        setError('Not authenticated');
        return null;
      }

      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', options.source);

        // Add entity context
        if (options.entities) {
          Object.entries(options.entities).forEach(([key, value]) => {
            if (value) formData.append(key, value);
          });
        }

        // Add user input
        if (options.category) formData.append('category', options.category);
        if (options.description) formData.append('description', options.description);
        if (options.tags?.length) formData.append('tags', options.tags.join(','));
        if (options.storagePreference) formData.append('storagePreference', options.storagePreference);
        if (options.localPath) formData.append('localPath', options.localPath);

        setProgress(30);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        setProgress(70);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const result = await response.json();
        setProgress(100);

        return result.document;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        console.error('[useDocumentEngine] Upload error:', err);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [token]
  );

  /**
   * Upload multiple files through the engine
   */
  const uploadMultiple = useCallback(
    async (files: File[], options: UploadOptions): Promise<UploadedDocument[]> => {
      if (!token) {
        setError('Not authenticated');
        return [];
      }

      setIsUploading(true);
      setProgress(0);
      setError(null);

      const results: UploadedDocument[] = [];
      const totalFiles = files.length;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(Math.round(((i + 0.5) / totalFiles) * 100));

          const result = await upload(file, options);
          if (result) {
            results.push(result);
          }

          setProgress(Math.round(((i + 1) / totalFiles) * 100));
        }

        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        return results;
      } finally {
        setIsUploading(false);
      }
    },
    [token, upload]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    upload,
    uploadMultiple,
    isUploading,
    progress,
    error,
    clearError,
  };
}

/**
 * Create upload options for expense form uploads
 */
export function createExpenseUploadOptions(
  expenseId: string,
  propertyId?: string,
  loanId?: string,
  expenseCategory?: string
): UploadOptions {
  return {
    source: UploadSource.EXPENSE_FORM,
    entities: {
      expenseId,
      propertyId,
      loanId,
    },
    // Category will be auto-detected by the engine based on expense category
  };
}

/**
 * Create upload options for property form uploads
 */
export function createPropertyUploadOptions(
  propertyId: string,
  category?: DocumentCategory
): UploadOptions {
  return {
    source: UploadSource.PROPERTY_FORM,
    entities: { propertyId },
    category,
  };
}

/**
 * Create upload options for loan form uploads
 */
export function createLoanUploadOptions(
  loanId: string,
  propertyId?: string
): UploadOptions {
  return {
    source: UploadSource.LOAN_FORM,
    entities: { loanId, propertyId },
    category: DocumentCategory.MORTGAGE,
  };
}

/**
 * Create upload options for documents library uploads
 */
export function createLibraryUploadOptions(
  category: DocumentCategory,
  description?: string,
  tags?: string[]
): UploadOptions {
  return {
    source: UploadSource.DOCUMENTS_LIBRARY,
    category,
    description,
    tags,
  };
}

/**
 * Create upload options for bank import
 */
export function createBankImportUploadOptions(accountId: string): UploadOptions {
  return {
    source: UploadSource.BANK_IMPORT,
    entities: { accountId },
    category: DocumentCategory.STATEMENT,
  };
}

export default useDocumentEngine;
