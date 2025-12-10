/**
 * Phase 19: Storage Provider Factory
 * Creates and manages storage provider instances based on user configuration
 */

import { prisma } from '@/lib/db';
import { IStorageProvider, IStorageProviderFactory } from './interface';
import { StorageProviderType } from '../types';
import { getMonitraxStorageProvider, MonitraxStorageProvider } from './monitraxProvider';
import { getGoogleCloudStorageProvider, GoogleCloudStorageProvider } from './googleCloudStorageProvider';

// Check if GCS is configured (has required env vars)
const isGCSConfigured = !!(process.env.GCS_PROJECT_ID && process.env.GCS_BUCKET_NAME);

export class StorageProviderFactory implements IStorageProviderFactory {
  private monitraxProvider: MonitraxStorageProvider;
  private gcsProvider: GoogleCloudStorageProvider | null = null;

  constructor() {
    this.monitraxProvider = getMonitraxStorageProvider();

    // Initialize GCS provider if configured
    if (isGCSConfigured) {
      this.gcsProvider = getGoogleCloudStorageProvider();
    }
  }

  /**
   * Get storage provider for a user
   * Returns user's configured provider or default provider
   */
  async getProvider(userId: string): Promise<IStorageProvider> {
    try {
      // Check if user has a custom storage provider configured
      const config = await prisma.storageProviderConfig.findUnique({
        where: { userId },
      });

      if (!config || !config.isActive) {
        return await this.getDefaultProvider();
      }

      // Return appropriate provider based on configuration
      switch (config.provider) {
        case StorageProviderType.GOOGLE_CLOUD_STORAGE:
          if (this.gcsProvider) {
            await this.gcsProvider.initialize();
            return this.gcsProvider;
          }
          console.warn('Google Cloud Storage not configured, falling back to default');
          return await this.getDefaultProvider();

        case StorageProviderType.LOCAL_DRIVE:
          // Local drive storage is handled client-side via File System Access API
          // Server-side, we still use the default provider for metadata
          return await this.getDefaultProvider();

        case StorageProviderType.MONITRAX:
        default:
          return this.monitraxProvider;
      }
    } catch (error) {
      console.error('Error getting storage provider for user:', error);
      return await this.getDefaultProvider();
    }
  }

  /**
   * Get the default storage provider
   * Returns GCS if configured, otherwise Monitrax database storage
   */
  async getDefaultProvider(): Promise<IStorageProvider> {
    // Use GCS as default if configured (better for production)
    if (this.gcsProvider) {
      try {
        await this.gcsProvider.initialize();
        return this.gcsProvider;
      } catch (error) {
        console.error('Failed to initialize GCS, falling back to database storage:', error);
        // GCS failed to initialize, fall back to Monitrax
        return this.monitraxProvider;
      }
    }
    return this.monitraxProvider;
  }

  /**
   * Get the Google Cloud Storage provider specifically
   */
  getGCSProvider(): GoogleCloudStorageProvider | null {
    return this.gcsProvider;
  }

  /**
   * Get the Monitrax database provider specifically
   */
  getMonitraxProvider(): MonitraxStorageProvider {
    return this.monitraxProvider;
  }

  /**
   * Check if GCS is available
   */
  isGCSAvailable(): boolean {
    return isGCSConfigured && this.gcsProvider !== null;
  }

  /**
   * Initialize all providers
   */
  async initialize(): Promise<void> {
    await this.monitraxProvider.initialize();
    if (this.gcsProvider) {
      try {
        await this.gcsProvider.initialize();
        console.log('Google Cloud Storage initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize GCS, will use database storage:', error);
        this.gcsProvider = null;
      }
    }
  }
}

// Singleton factory instance
let factoryInstance: StorageProviderFactory | null = null;

export function getStorageProviderFactory(): StorageProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new StorageProviderFactory();
  }
  return factoryInstance;
}

/**
 * Get storage provider for a user (convenience function)
 */
export async function getStorageProvider(userId: string): Promise<IStorageProvider> {
  const factory = getStorageProviderFactory();
  return factory.getProvider(userId);
}

/**
 * Check if Google Cloud Storage is configured
 */
export function isGoogleCloudStorageConfigured(): boolean {
  return isGCSConfigured;
}
