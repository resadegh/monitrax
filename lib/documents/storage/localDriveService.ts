/**
 * Phase 19.2: Local Drive Storage Service
 * Uses the File System Access API to save documents to user's local drive
 * Organizes files by Australian Financial Year for easy tax preparation
 *
 * Browser Support: Chrome 86+, Edge 86+, Opera 72+
 * Safari and Firefox have limited support
 */

import { DocumentCategory } from '../types';

// IndexedDB database name for storing folder handles
const DB_NAME = 'monitrax-local-storage';
const DB_VERSION = 1;
const STORE_NAME = 'folder-handles';

// Australian Financial Year runs July 1 - June 30
function getAustralianFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, so July = 6

  // If July or later, we're in the FY that ends next year
  // If before July, we're in the FY that ends this year
  if (month >= 6) {
    return `FY${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `FY${year - 1}-${year.toString().slice(-2)}`;
  }
}

// Map document categories to folder names
function getCategoryFolder(category: DocumentCategory): string {
  const folderMap: Record<DocumentCategory, string> = {
    [DocumentCategory.RECEIPT]: 'Receipts',
    [DocumentCategory.STATEMENT]: 'Statements',
    [DocumentCategory.TAX]: 'Tax Documents',
    [DocumentCategory.CONTRACT]: 'Contracts',
    [DocumentCategory.INSURANCE]: 'Insurance',
    [DocumentCategory.MORTGAGE]: 'Mortgage',
    [DocumentCategory.LEASE]: 'Leases',
    [DocumentCategory.INVOICE]: 'Invoices',
    [DocumentCategory.PDS]: 'Product Disclosures',
    [DocumentCategory.VALUATION]: 'Valuations',
    [DocumentCategory.OTHER]: 'Other',
  };
  return folderMap[category] || 'Other';
}

// Check if File System Access API is supported
export function isLocalDriveSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Open IndexedDB connection
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save folder handle to IndexedDB
async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: 'root', handle });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

// Get saved folder handle from IndexedDB
async function getSavedFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('root');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.handle || null);
      };

      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

// Clear saved folder handle
export async function clearFolderHandle(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('root');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Request user to select a folder for document storage
 * Returns the selected folder handle
 */
export async function selectLocalFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isLocalDriveSupported()) {
    throw new Error('Local drive storage is not supported in this browser. Please use Chrome, Edge, or Opera.');
  }

  try {
    // @ts-expect-error - showDirectoryPicker is not in TypeScript types yet
    const handle = await window.showDirectoryPicker({
      id: 'monitrax-documents',
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Save the handle for future sessions
    await saveFolderHandle(handle);

    // Create the initial folder structure
    await createFolderStructure(handle);

    return handle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled the picker
      return null;
    }
    throw error;
  }
}

/**
 * Get the currently configured folder handle
 * Will request permission if needed
 */
export async function getLocalFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getSavedFolderHandle();

  if (!handle) {
    return null;
  }

  // Verify we still have permission
  try {
    // @ts-expect-error - queryPermission is not in TypeScript types yet
    const permission = await handle.queryPermission({ mode: 'readwrite' });

    if (permission === 'granted') {
      return handle;
    }

    // Request permission again
    // @ts-expect-error - requestPermission is not in TypeScript types yet
    const newPermission = await handle.requestPermission({ mode: 'readwrite' });

    if (newPermission === 'granted') {
      return handle;
    }

    // Permission denied, clear the saved handle
    await clearFolderHandle();
    return null;
  } catch {
    // Handle no longer valid (folder moved/deleted)
    await clearFolderHandle();
    return null;
  }
}

/**
 * Check if local drive storage is configured and accessible
 */
export async function isLocalDriveConfigured(): Promise<boolean> {
  const handle = await getLocalFolderHandle();
  return handle !== null;
}

/**
 * Create the folder structure for organizing documents
 */
async function createFolderStructure(rootHandle: FileSystemDirectoryHandle): Promise<void> {
  // Create Monitrax root folder
  const monitraxFolder = await rootHandle.getDirectoryHandle('Monitrax', { create: true });

  // Create current and previous financial year folders
  const currentFY = getAustralianFinancialYear();
  const previousFY = getAustralianFinancialYear(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

  for (const fy of [currentFY, previousFY]) {
    const fyFolder = await monitraxFolder.getDirectoryHandle(fy, { create: true });

    // Create category subfolders
    const categories = [
      'Receipts',
      'Statements',
      'Tax Documents',
      'Contracts',
      'Insurance',
      'Mortgage',
      'Leases',
      'Invoices',
      'Product Disclosures',
      'Valuations',
      'Other',
    ];

    for (const category of categories) {
      await fyFolder.getDirectoryHandle(category, { create: true });
    }
  }
}

/**
 * Save a document to the local drive
 * Organizes by financial year and category
 */
export async function saveToLocalDrive(
  file: File | Blob,
  filename: string,
  category: DocumentCategory,
  options?: {
    financialYear?: string;
    subfolder?: string;
    entityName?: string;
  }
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    const rootHandle = await getLocalFolderHandle();

    if (!rootHandle) {
      return {
        success: false,
        path: '',
        error: 'Local drive not configured. Please select a folder first.',
      };
    }

    // Navigate to the correct folder
    const monitraxFolder = await rootHandle.getDirectoryHandle('Monitrax', { create: true });
    const fy = options?.financialYear || getAustralianFinancialYear();
    const fyFolder = await monitraxFolder.getDirectoryHandle(fy, { create: true });
    const categoryFolder = await fyFolder.getDirectoryHandle(getCategoryFolder(category), { create: true });

    // If there's an entity name (e.g., property name), create a subfolder
    let targetFolder = categoryFolder;
    if (options?.entityName) {
      const sanitizedName = options.entityName.replace(/[<>:"/\\|?*]/g, '_');
      targetFolder = await categoryFolder.getDirectoryHandle(sanitizedName, { create: true });
    }

    // If there's a custom subfolder, create it
    if (options?.subfolder) {
      const sanitizedSubfolder = options.subfolder.replace(/[<>:"/\\|?*]/g, '_');
      targetFolder = await targetFolder.getDirectoryHandle(sanitizedSubfolder, { create: true });
    }

    // Create the file
    const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const fileHandle = await targetFolder.getFileHandle(sanitizedFilename, { create: true });

    // Write the content - using File System Access API
    // @ts-ignore - createWritable is part of newer File System Access API
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Build the path for display
    const pathParts = ['Monitrax', fy, getCategoryFolder(category)];
    if (options?.entityName) pathParts.push(options.entityName);
    if (options?.subfolder) pathParts.push(options.subfolder);
    pathParts.push(sanitizedFilename);

    return {
      success: true,
      path: pathParts.join('/'),
    };
  } catch (error) {
    console.error('Failed to save to local drive:', error);
    return {
      success: false,
      path: '',
      error: error instanceof Error ? error.message : 'Failed to save file',
    };
  }
}

/**
 * Read a file from the local drive
 */
export async function readFromLocalDrive(path: string): Promise<File | null> {
  try {
    const rootHandle = await getLocalFolderHandle();

    if (!rootHandle) {
      return null;
    }

    // Parse the path and navigate to the file
    const parts = path.split('/');
    const filename = parts.pop()!;

    let currentFolder: FileSystemDirectoryHandle = rootHandle;
    for (const part of parts) {
      currentFolder = await currentFolder.getDirectoryHandle(part);
    }

    const fileHandle = await currentFolder.getFileHandle(filename);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Delete a file from the local drive
 */
export async function deleteFromLocalDrive(path: string): Promise<boolean> {
  try {
    const rootHandle = await getLocalFolderHandle();

    if (!rootHandle) {
      return false;
    }

    // Parse the path and navigate to the parent folder
    const parts = path.split('/');
    const filename = parts.pop()!;

    let currentFolder: FileSystemDirectoryHandle = rootHandle;
    for (const part of parts) {
      currentFolder = await currentFolder.getDirectoryHandle(part);
    }

    await currentFolder.removeEntry(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all files in a specific financial year and category
 */
export async function listLocalFiles(
  financialYear?: string,
  category?: DocumentCategory
): Promise<string[]> {
  try {
    const rootHandle = await getLocalFolderHandle();

    if (!rootHandle) {
      return [];
    }

    const monitraxFolder = await rootHandle.getDirectoryHandle('Monitrax');
    const files: string[] = [];

    // If no FY specified, list all
    const fyFolders: string[] = [];
    if (financialYear) {
      fyFolders.push(financialYear);
    } else {
      // @ts-ignore - values() is part of newer File System Access API
      for await (const entry of monitraxFolder.values()) {
        if (entry.kind === 'directory' && entry.name.startsWith('FY')) {
          fyFolders.push(entry.name);
        }
      }
    }

    for (const fy of fyFolders) {
      const fyFolder = await monitraxFolder.getDirectoryHandle(fy);

      // If no category specified, list all
      const categoryFolders: string[] = [];
      if (category) {
        categoryFolders.push(getCategoryFolder(category));
      } else {
        // @ts-ignore - values() is part of newer File System Access API
        for await (const entry of fyFolder.values()) {
          if (entry.kind === 'directory') {
            categoryFolders.push(entry.name);
          }
        }
      }

      for (const cat of categoryFolders) {
        try {
          const catFolder = await fyFolder.getDirectoryHandle(cat);
          await listFilesRecursive(catFolder, `Monitrax/${fy}/${cat}`, files);
        } catch {
          // Folder doesn't exist, skip
        }
      }
    }

    return files;
  } catch {
    return [];
  }
}

async function listFilesRecursive(
  folder: FileSystemDirectoryHandle,
  currentPath: string,
  files: string[]
): Promise<void> {
  // @ts-ignore - values() is part of newer File System Access API
  for await (const entry of folder.values()) {
    const entryPath = `${currentPath}/${entry.name}`;
    if (entry.kind === 'file') {
      files.push(entryPath);
    } else {
      await listFilesRecursive(entry as FileSystemDirectoryHandle, entryPath, files);
    }
  }
}

/**
 * Get folder information for display
 */
export async function getLocalDriveInfo(): Promise<{
  configured: boolean;
  folderName?: string;
  fileCount?: number;
  financialYears?: string[];
} | null> {
  try {
    const rootHandle = await getLocalFolderHandle();

    if (!rootHandle) {
      return { configured: false };
    }

    const monitraxFolder = await rootHandle.getDirectoryHandle('Monitrax');
    const financialYears: string[] = [];
    let fileCount = 0;

    // @ts-ignore - values() is part of newer File System Access API
    for await (const entry of monitraxFolder.values()) {
      if (entry.kind === 'directory' && entry.name.startsWith('FY')) {
        financialYears.push(entry.name);
        // Count files in this FY
        const files = await listLocalFiles(entry.name);
        fileCount += files.length;
      }
    }

    return {
      configured: true,
      folderName: rootHandle.name,
      fileCount,
      financialYears: financialYears.sort().reverse(),
    };
  } catch {
    return { configured: false };
  }
}

/**
 * Get the current Australian Financial Year string
 */
export function getCurrentFinancialYear(): string {
  return getAustralianFinancialYear();
}

/**
 * Get a list of recent financial years for selection
 */
export function getFinancialYearOptions(count: number = 5): string[] {
  const options: string[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() - i * 365 * 24 * 60 * 60 * 1000);
    options.push(getAustralianFinancialYear(date));
  }

  // Remove duplicates and sort
  return [...new Set(options)].sort().reverse();
}
