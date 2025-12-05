'use client';

/**
 * Hook for managing local drive document storage
 * Uses the File System Access API for saving documents to user's computer
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isLocalDriveSupported,
  isLocalDriveConfigured,
  selectLocalFolder,
  getLocalDriveInfo,
  clearFolderHandle,
  saveToLocalDrive,
  readFromLocalDrive,
  deleteFromLocalDrive,
  listLocalFiles,
  getCurrentFinancialYear,
  getFinancialYearOptions,
} from '@/lib/documents/storage/localDriveService';
import { DocumentCategory } from '@/lib/documents/types';

interface LocalDriveInfo {
  configured: boolean;
  folderName?: string;
  fileCount?: number;
  financialYears?: string[];
}

interface UseLocalDriveStorageReturn {
  // Status
  isSupported: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;

  // Info
  driveInfo: LocalDriveInfo | null;
  currentFinancialYear: string;
  financialYearOptions: string[];

  // Actions
  selectFolder: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  saveDocument: (
    file: File | Blob,
    filename: string,
    category: DocumentCategory,
    options?: {
      financialYear?: string;
      entityName?: string;
      subfolder?: string;
    }
  ) => Promise<{ success: boolean; path: string; error?: string }>;
  readDocument: (path: string) => Promise<File | null>;
  deleteDocument: (path: string) => Promise<boolean>;
  listDocuments: (financialYear?: string, category?: DocumentCategory) => Promise<string[]>;
  refresh: () => Promise<void>;
}

export function useLocalDriveStorage(): UseLocalDriveStorageReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driveInfo, setDriveInfo] = useState<LocalDriveInfo | null>(null);

  // Check support and configuration on mount
  useEffect(() => {
    const checkStatus = async () => {
      setIsLoading(true);
      try {
        const supported = isLocalDriveSupported();
        setIsSupported(supported);

        if (supported) {
          const configured = await isLocalDriveConfigured();
          setIsConfigured(configured);

          if (configured) {
            const info = await getLocalDriveInfo();
            setDriveInfo(info);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check local drive status');
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, []);

  // Select folder for storage
  const selectFolder = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const handle = await selectLocalFolder();

      if (handle) {
        setIsConfigured(true);
        const info = await getLocalDriveInfo();
        setDriveInfo(info);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select folder';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect local drive
  const disconnect = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      await clearFolderHandle();
      setIsConfigured(false);
      setDriveInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save document
  const saveDocument = useCallback(
    async (
      file: File | Blob,
      filename: string,
      category: DocumentCategory,
      options?: {
        financialYear?: string;
        entityName?: string;
        subfolder?: string;
      }
    ) => {
      return saveToLocalDrive(file, filename, category, options);
    },
    []
  );

  // Read document
  const readDocument = useCallback(async (path: string): Promise<File | null> => {
    return readFromLocalDrive(path);
  }, []);

  // Delete document
  const deleteDocument = useCallback(async (path: string): Promise<boolean> => {
    return deleteFromLocalDrive(path);
  }, []);

  // List documents
  const listDocuments = useCallback(
    async (financialYear?: string, category?: DocumentCategory): Promise<string[]> => {
      return listLocalFiles(financialYear, category);
    },
    []
  );

  // Refresh drive info
  const refresh = useCallback(async (): Promise<void> => {
    if (!isConfigured) return;

    setIsLoading(true);
    try {
      const info = await getLocalDriveInfo();
      setDriveInfo(info);
      setIsConfigured(info?.configured ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  return {
    isSupported,
    isConfigured,
    isLoading,
    error,
    driveInfo,
    currentFinancialYear: getCurrentFinancialYear(),
    financialYearOptions: getFinancialYearOptions(),
    selectFolder,
    disconnect,
    saveDocument,
    readDocument,
    deleteDocument,
    listDocuments,
    refresh,
  };
}
