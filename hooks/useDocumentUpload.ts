'use client';

/**
 * Unified Document Upload Hook
 * Handles uploading documents to either local drive or server storage
 * based on user's configured preference.
 *
 * Phase 38 PR 2.5 (2026-05-01): migrated from legacy `POST /api/documents`
 * to canonical `POST /api/documents/upload` (Phase 25 Document Management
 * Engine). All uploads now go through the RuleEngine for storage routing,
 * category inference, auto-linking, and path generation. Translation
 * helper `buildDmeFormData` converts the hook's `links: { entityType,
 * entityId }[]` shape into DME's individual entity form fields
 * (`propertyId`, `expenseId`, `loanId`, etc.).
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useLocalDriveStorage } from './useLocalDriveStorage';
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';

interface UploadOptions {
  category: DocumentCategory;
  description?: string;
  tags?: string[];
  links?: { entityType: LinkedEntityType; entityId: string }[];
  entityName?: string; // For folder organization (e.g., property name)
  financialYear?: string;
}

interface UploadResult {
  success: boolean;
  documentId?: string;
  localPath?: string;
  error?: string;
}

interface UseDocumentUploadReturn {
  upload: (file: File, options: UploadOptions) => Promise<UploadResult>;
  isUploading: boolean;
  error: string | null;
  storageMode: 'local' | 'server';
  isLocalDriveConfigured: boolean;
}

/**
 * Phase 38 PR 2.5 — translation map from `LinkedEntityType` (the polymorphic
 * enum used throughout the app) to the DME upload endpoint's per-entity
 * form-field names. The DME endpoint (`app/api/documents/upload/route.ts`)
 * reads each field individually and forwards them to the RuleEngine for
 * cascade auto-linking. Single source of truth — keep in sync if the
 * upload endpoint adds new entity types.
 */
const LINK_FIELD_BY_ENTITY: Record<string, string> = {
  PROPERTY: 'propertyId',
  LOAN: 'loanId',
  EXPENSE: 'expenseId',
  INCOME: 'incomeId',
  ACCOUNT: 'accountId',
  OFFSET_ACCOUNT: 'offsetAccountId',
  INVESTMENT_ACCOUNT: 'investmentAccountId',
  INVESTMENT_HOLDING: 'investmentHoldingId',
  TRANSACTION: 'transactionId',
};

/**
 * Build the FormData payload for `POST /api/documents/upload` (Phase 25 DME)
 * from the legacy `UploadOptions` shape. Centralised so both the
 * LOCAL_DRIVE path and the server-storage path build identical request
 * bodies (modulo `storagePreference` + `localPath`).
 */
function buildDmeFormData(
  file: File,
  options: UploadOptions,
  extras?: { storagePreference?: 'LOCAL_DRIVE' | 'MONITRAX' | 'GOOGLE_CLOUD_STORAGE' }
): FormData {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('category', options.category);
  if (options.description) {
    fd.append('description', options.description);
  }
  if (options.tags && options.tags.length > 0) {
    fd.append('tags', options.tags.join(','));
  }
  if (extras?.storagePreference) {
    fd.append('storagePreference', extras.storagePreference);
  }

  // Translate each link → its DME entity field. Multiple links of the
  // same type are uncommon but supported (FormData allows duplicate keys).
  if (options.links && options.links.length > 0) {
    for (const link of options.links) {
      const fieldName = LINK_FIELD_BY_ENTITY[link.entityType];
      if (fieldName) {
        fd.append(fieldName, link.entityId);
      }
    }
  }

  return fd;
}

export function useDocumentUpload(): UseDocumentUploadReturn {
  const { token } = useAuth();
  const localDrive = useLocalDriveStorage();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine storage mode based on configuration
  const storageMode = localDrive.isConfigured ? 'local' : 'server';

  const upload = useCallback(async (file: File, options: UploadOptions): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);

    // Phase 38 PR 2.5 (2026-05-01) — universal upload migration.
    //
    // Until now this hook POSTed to `/api/documents` (the legacy Phase 19
    // path that calls `documentService.uploadDocument()` directly) which
    // bypasses the Phase 25 Document Management Engine — so uploads from
    // ExpenseDialog and the expenses page didn't get RuleEngine-driven
    // storage routing, category inference, auto-linking, or path
    // generation.
    //
    // This commit migrates the hook to the canonical `/api/documents/upload`
    // endpoint (DME). The DME endpoint expects entity links as INDIVIDUAL
    // form fields (`propertyId`, `expenseId`, etc.) rather than a JSON
    // `links` array, so we translate via `appendEntityLinks` below.
    // Result: every document uploaded anywhere in the app — including from
    // ExpenseDialog and the expenses page — now flows through the same
    // canonical engine and lands in My Vault correctly tagged.

    try {
      // If local drive is configured, save to local drive first
      if (localDrive.isConfigured) {
        const localResult = await localDrive.saveDocument(
          file,
          file.name,
          options.category,
          {
            financialYear: options.financialYear,
            entityName: options.entityName,
          }
        );

        if (!localResult.success) {
          setError(localResult.error || 'Failed to save to local drive');
          return { success: false, error: localResult.error };
        }

        // Also save metadata to server for tracking/linking
        const formData = buildDmeFormData(file, options, {
          storagePreference: 'LOCAL_DRIVE',
        });
        // LOCAL_DRIVE path is supplied via the legacy field name —
        // /api/documents/upload routes through DME which honours it.
        formData.append('localPath', localResult.path);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            documentId: result.document?.id,
            localPath: localResult.path,
          };
        } else {
          // File is saved locally but server metadata failed - still consider it a success
          console.warn('File saved to local drive but server metadata failed');
          return {
            success: true,
            localPath: localResult.path,
          };
        }
      } else {
        // Use server storage (Monitrax database / GCS — DME picks per RuleEngine)
        const formData = buildDmeFormData(file, options);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            documentId: result.document?.id,
          };
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to upload document');
          return { success: false, error: errorData.error };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsUploading(false);
    }
  }, [token, localDrive]);

  return {
    upload,
    isUploading,
    error,
    storageMode,
    isLocalDriveConfigured: localDrive.isConfigured,
  };
}

/**
 * Hook for reading documents from either local drive or server
 */
export function useDocumentReader() {
  const { token } = useAuth();
  const localDrive = useLocalDriveStorage();

  const readDocument = useCallback(async (
    documentId: string,
    localPath?: string | null,
    storageProvider?: string
  ): Promise<{ url: string; blob?: Blob } | null> => {
    try {
      // If it's a local drive document, read from local drive
      if (storageProvider === 'LOCAL_DRIVE' && localPath && localDrive.isConfigured) {
        const file = await localDrive.readDocument(localPath);
        if (file) {
          const url = URL.createObjectURL(file);
          return { url, blob: file };
        }
        return null;
      }

      // Otherwise, fetch from server
      const response = await fetch(`/api/documents/${documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return { url, blob };
      }

      return null;
    } catch (error) {
      console.error('Failed to read document:', error);
      return null;
    }
  }, [token, localDrive]);

  return { readDocument };
}
