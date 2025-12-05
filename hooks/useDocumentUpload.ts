'use client';

/**
 * Unified Document Upload Hook
 * Handles uploading documents to either local drive or server storage
 * based on user's configured preference
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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', options.category);
        formData.append('storageProvider', 'LOCAL_DRIVE');
        formData.append('localPath', localResult.path);
        if (options.description) {
          formData.append('description', options.description);
        }
        if (options.tags && options.tags.length > 0) {
          formData.append('tags', options.tags.join(','));
        }
        if (options.links && options.links.length > 0) {
          formData.append('links', JSON.stringify(options.links));
        }

        const response = await fetch('/api/documents', {
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
        // Use server storage (Monitrax database)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', options.category);
        if (options.description) {
          formData.append('description', options.description);
        }
        if (options.tags && options.tags.length > 0) {
          formData.append('tags', options.tags.join(','));
        }
        if (options.links && options.links.length > 0) {
          formData.append('links', JSON.stringify(options.links));
        }

        const response = await fetch('/api/documents', {
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
