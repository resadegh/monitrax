/**
 * Phase 19: Storage Provider Factory
 * Creates and manages storage provider instances based on user configuration
 */

import { prisma } from '@/lib/db';
import { IStorageProvider, IStorageProviderFactory } from './interface';
import { StorageProviderType } from '../types';
import { getMonitraxStorageProvider, MonitraxStorageProvider } from './monitraxProvider';

export class StorageProviderFactory implements IStorageProviderFactory {
  private defaultProvider: MonitraxStorageProvider;

  constructor() {
    this.defaultProvider = getMonitraxStorageProvider();
  }

  /**
   * Get storage provider for a user
   * Returns user's configured provider or default Monitrax provider
   */
  async getProvider(userId: string): Promise<IStorageProvider> {
    try {
      // Check if user has a custom storage provider configured
      const config = await prisma.storageProviderConfig.findUnique({
        where: { userId },
      });

      if (!config || !config.isActive) {
        return this.defaultProvider;
      }

      // Return appropriate provider based on configuration
      switch (config.provider) {
        case StorageProviderType.GOOGLE_DRIVE:
          // TODO: Implement Google Drive provider in Phase 19B
          console.warn('Google Drive provider not yet implemented, falling back to Monitrax');
          return this.defaultProvider;

        case StorageProviderType.MONITRAX:
        default:
          return this.defaultProvider;
      }
    } catch (error) {
      console.error('Error getting storage provider for user:', error);
      return this.defaultProvider;
    }
  }

  /**
   * Get the default Monitrax storage provider
   */
  getDefaultProvider(): IStorageProvider {
    return this.defaultProvider;
  }

  /**
   * Initialize the default provider
   */
  async initialize(): Promise<void> {
    await this.defaultProvider.initialize();
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
