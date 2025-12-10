/**
 * Phase 25: Storage Rules
 * Determine which storage provider to use based on context
 */

import { StorageRule, UploadContext, UploadSource } from '../types';
import { StorageProviderType, DocumentCategory } from '../../types';
import { isGoogleCloudStorageConfigured } from '../../storage';

// 5MB threshold for large files
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

export const StorageRules: StorageRule[] = [
  // Priority 100: User explicitly specified storage preference
  {
    name: 'user_preference',
    priority: 100,
    matches: (ctx: UploadContext) => !!ctx.userInput?.storagePreference,
    getProvider: (ctx: UploadContext) => ctx.userInput.storagePreference!,
  },

  // Priority 95: Local drive preference for expense receipts (if configured)
  {
    name: 'local_drive_receipts',
    priority: 95,
    matches: (ctx: UploadContext) =>
      ctx.userInput?.storagePreference === StorageProviderType.LOCAL_DRIVE &&
      (ctx.source === UploadSource.EXPENSE_FORM ||
        ctx.source === UploadSource.EXPENSE_DIALOG),
    getProvider: () => StorageProviderType.LOCAL_DRIVE,
  },

  // Priority 90: Tax documents always to cloud (compliance requirement)
  {
    name: 'tax_documents_cloud',
    priority: 90,
    matches: (ctx: UploadContext) =>
      ctx.userInput?.category === DocumentCategory.TAX,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 88: Contracts and legal documents to cloud (important documents)
  {
    name: 'contracts_cloud',
    priority: 88,
    matches: (ctx: UploadContext) =>
      ctx.userInput?.category === DocumentCategory.CONTRACT ||
      ctx.userInput?.category === DocumentCategory.MORTGAGE ||
      ctx.userInput?.category === DocumentCategory.LEASE,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 85: Insurance documents to cloud
  {
    name: 'insurance_cloud',
    priority: 85,
    matches: (ctx: UploadContext) =>
      ctx.userInput?.category === DocumentCategory.INSURANCE,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 80: Large files (>5MB) to cloud storage
  {
    name: 'large_files_cloud',
    priority: 80,
    matches: (ctx: UploadContext) => ctx.size > LARGE_FILE_THRESHOLD,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 75: Bank imports to cloud (statements are important)
  {
    name: 'bank_imports_cloud',
    priority: 75,
    matches: (ctx: UploadContext) => ctx.source === UploadSource.BANK_IMPORT,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 70: Expense receipts with property link to cloud
  {
    name: 'expense_receipts_cloud',
    priority: 70,
    matches: (ctx: UploadContext) =>
      (ctx.source === UploadSource.EXPENSE_FORM ||
        ctx.source === UploadSource.EXPENSE_DIALOG) &&
      !!ctx.entities?.propertyId,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },

  // Priority 0: Default - use GCS if configured, else database
  {
    name: 'default_provider',
    priority: 0,
    matches: () => true,
    getProvider: () =>
      isGoogleCloudStorageConfigured()
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX,
  },
];

/**
 * Apply storage rules to context and return the selected provider
 */
export function resolveStorageProvider(context: UploadContext): StorageProviderType {
  const sortedRules = [...StorageRules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const matches = rule.matches(context);
    if (matches) {
      console.log(`[StorageRules] Matched rule: ${rule.name} (priority: ${rule.priority})`);
      return rule.getProvider(context);
    }
  }

  // Fallback (should never reach here due to default rule)
  return StorageProviderType.MONITRAX;
}
