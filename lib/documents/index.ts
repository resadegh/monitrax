/**
 * Phase 19 & 25: Document Management Module
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
  isGoogleCloudStorageConfigured,
} from './storage';

// Document service functions (legacy - use engine for new code)
export {
  uploadDocument,
  getDocumentById,
  getDocumentWithSignedUrl,
  listDocuments,
  getDocumentsForEntity,
  deleteDocument,
  renameDocument,
  updateDocumentMeta,
  addDocumentLink,
  removeDocumentLink,
  resolveAutoLinks,
  getDocumentStats,
} from './documentService';

// Document Management Engine (Phase 25 - recommended for new code)
export {
  DocumentManagementEngine,
  getDocumentManagementEngine,
  createUploadContext,
  UploadSource,
  RuleEngine,
  getRuleEngine,
} from './engine';

export type {
  UploadContext,
  EngineResult,
  ResolvedUploadConfig,
  EntityLink,
  EntityContext,
  UserInput,
} from './engine';
