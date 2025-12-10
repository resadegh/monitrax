/**
 * Phase 19B: Google Cloud Storage Provider
 * Stores documents in Google Cloud Storage bucket
 *
 * Benefits over database storage:
 * - Scalable to large files (up to 5TB per object)
 * - Cost-effective for large volumes
 * - Native signed URLs with fine-grained access control
 * - CDN integration for faster delivery
 */

import { Storage, Bucket } from '@google-cloud/storage';
import { IStorageProvider } from './interface';
import {
  StorageUploadParams,
  StorageUploadResult,
  StorageDeleteResult,
  SignedUrlResult,
  StorageProviderConfig,
} from '../types';

// Default signed URL expiry (5 minutes)
const DEFAULT_EXPIRY_SECONDS = 300;

// Maximum file size for GCS (100MB - can be increased if needed)
const MAX_GCS_FILE_SIZE = 100 * 1024 * 1024;

export class GoogleCloudStorageProvider implements IStorageProvider {
  readonly name = 'google_cloud_storage';
  private storage: Storage | null = null;
  private bucket: Bucket | null = null;
  private bucketName: string;
  private initialized = false;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'monitrax-documents';
  }

  async initialize(_config?: StorageProviderConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const projectId = process.env.GCS_PROJECT_ID;
      const serviceAccountKey = process.env.GCS_SERVICE_ACCOUNT_KEY;

      if (!projectId) {
        throw new Error('GCS_PROJECT_ID environment variable is not set');
      }

      if (serviceAccountKey) {
        // Parse base64-encoded service account key
        const credentials = JSON.parse(
          Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
        );

        this.storage = new Storage({
          projectId,
          credentials,
        });
      } else {
        // Fall back to default credentials (for local development with gcloud CLI)
        this.storage = new Storage({
          projectId,
        });
      }

      this.bucket = this.storage.bucket(this.bucketName);

      // Verify bucket exists
      const [exists] = await this.bucket.exists();
      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist`);
      }

      this.initialized = true;
      console.log(`Google Cloud Storage initialized with bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('Failed to initialize Google Cloud Storage:', error);
      throw error;
    }
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return {
        success: false,
        storagePath: '',
        error: 'Storage not initialized',
      };
    }

    try {
      // Check file size limit
      if (params.file.length > MAX_GCS_FILE_SIZE) {
        return {
          success: false,
          storagePath: '',
          error: `File too large. Maximum size is ${MAX_GCS_FILE_SIZE / 1024 / 1024}MB`,
        };
      }

      const file = this.bucket.file(params.path);

      // Upload file to GCS
      await file.save(params.file, {
        metadata: {
          contentType: params.mimeType,
          metadata: {
            userId: params.userId,
            originalFilename: params.filename,
            uploadedAt: new Date().toISOString(),
          },
        },
        resumable: params.file.length > 5 * 1024 * 1024, // Use resumable upload for files > 5MB
      });

      // Generate the storage URL (public URL format, not for direct access)
      const storageUrl = `gs://${this.bucketName}/${params.path}`;

      return {
        success: true,
        storagePath: params.path,
        storageUrl,
      };
    } catch (error) {
      console.error('GCS upload error:', error);
      return {
        success: false,
        storagePath: '',
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async delete(storagePath: string): Promise<StorageDeleteResult> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return {
        success: false,
        error: 'Storage not initialized',
      };
    }

    try {
      const file = this.bucket.file(storagePath);

      // Check if file exists before deleting
      const [exists] = await file.exists();
      if (!exists) {
        // File doesn't exist, consider it a success
        return { success: true };
      }

      await file.delete();
      return { success: true };
    } catch (error) {
      console.error('GCS delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  async getSignedUrl(
    storagePath: string,
    expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<SignedUrlResult> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return {
        success: false,
        error: 'Storage not initialized',
      };
    }

    try {
      const file = this.bucket.file(storagePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Generate signed URL for reading
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
      });

      return {
        success: true,
        url,
        expiresAt,
      };
    } catch (error) {
      console.error('GCS signed URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate signed URL',
      };
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return false;
    }

    try {
      const file = this.bucket.file(storagePath);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  async getMetadata(storagePath: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  } | null> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return null;
    }

    try {
      const file = this.bucket.file(storagePath);
      const [metadata] = await file.getMetadata();

      return {
        size: Number(metadata.size) || 0,
        lastModified: metadata.updated ? new Date(metadata.updated) : new Date(),
        contentType: metadata.contentType || 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async listFiles(pathPrefix: string): Promise<string[]> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return [];
    }

    try {
      const [files] = await this.bucket.getFiles({
        prefix: pathPrefix,
        maxResults: 1000,
      });

      return files.map(file => file.name);
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized || !this.bucket) {
        await this.initialize();
      }

      if (!this.bucket) {
        return false;
      }

      // Check bucket accessibility
      const [exists] = await this.bucket.exists();
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Download file contents from GCS
   */
  async downloadFile(storagePath: string): Promise<Buffer> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      throw new Error('Storage not initialized');
    }

    const file = this.bucket.file(storagePath);
    const [contents] = await file.download();
    return contents;
  }

  /**
   * Copy file within GCS (useful for migrations)
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return false;
    }

    try {
      const sourceFile = this.bucket.file(sourcePath);
      const destFile = this.bucket.file(destinationPath);
      await sourceFile.copy(destFile);
      return true;
    } catch (error) {
      console.error('GCS copy error:', error);
      return false;
    }
  }

  /**
   * Get bucket information
   */
  async getBucketInfo(): Promise<{
    name: string;
    location: string;
    storageClass: string;
  } | null> {
    if (!this.initialized || !this.bucket) {
      await this.initialize();
    }

    if (!this.bucket) {
      return null;
    }

    try {
      const [metadata] = await this.bucket.getMetadata();
      return {
        name: metadata.name || this.bucketName,
        location: metadata.location || 'unknown',
        storageClass: metadata.storageClass || 'STANDARD',
      };
    } catch {
      return null;
    }
  }
}

// Singleton instance
let providerInstance: GoogleCloudStorageProvider | null = null;

export function getGoogleCloudStorageProvider(): GoogleCloudStorageProvider {
  if (!providerInstance) {
    providerInstance = new GoogleCloudStorageProvider();
  }
  return providerInstance;
}
