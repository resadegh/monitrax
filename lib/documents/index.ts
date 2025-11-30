/**
 * Phase 19: Document Management Module
 * Public API exports for the document management system
 */

// Types
export * from './types';

// Storage providers
export type { IStorageProvider, IStorageProviderFactory } from './storage';
export {
  MonitraxStorageProvider,
  getMonitraxStorageProvider,
  StorageProviderFactory,
  getStorageProviderFactory,
  getStorageProvider,
} from './storage';

// Document service functions
export {
  uploadDocument,
  getDocumentById,
  getDocumentWithSignedUrl,
  listDocuments,
  getDocumentsForEntity,
  deleteDocument,
  addDocumentLink,
  removeDocumentLink,
  resolveAutoLinks,
  getDocumentStats,
} from './documentService';
