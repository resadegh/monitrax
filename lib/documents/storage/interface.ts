/**
 * Phase 19: Storage Provider Interface
 * Abstract interface for storage providers
 */

import {
  StorageUploadParams,
  StorageUploadResult,
  StorageDeleteResult,
  SignedUrlResult,
  StorageProviderConfig,
} from '../types';

/**
 * Storage Provider Interface
 * All storage providers (Monitrax, Google Drive, etc.) must implement this interface
 */
export interface IStorageProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Initialize the provider with configuration
   */
  initialize(config?: StorageProviderConfig): Promise<void>;

  /**
   * Upload a file to storage
   */
  upload(params: StorageUploadParams): Promise<StorageUploadResult>;

  /**
   * Delete a file from storage
   */
  delete(storagePath: string): Promise<StorageDeleteResult>;

  /**
   * Generate a signed URL for secure file access
   * URLs should expire within 5 minutes for security
   */
  getSignedUrl(storagePath: string, expiresInSeconds?: number): Promise<SignedUrlResult>;

  /**
   * Check if a file exists in storage
   */
  exists(storagePath: string): Promise<boolean>;

  /**
   * Get file metadata from storage (size, last modified, etc.)
   */
  getMetadata(storagePath: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  } | null>;

  /**
   * List files in a path (for debugging/admin)
   */
  listFiles(pathPrefix: string): Promise<string[]>;

  /**
   * Health check for the storage provider
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Storage Provider Factory
 * Creates appropriate storage provider based on type
 */
export interface IStorageProviderFactory {
  /**
   * Get storage provider for a user
   * Returns Monitrax provider by default, or user's configured provider
   */
  getProvider(userId: string): Promise<IStorageProvider>;

  /**
   * Get the default Monitrax storage provider
   */
  getDefaultProvider(): IStorageProvider;
}
