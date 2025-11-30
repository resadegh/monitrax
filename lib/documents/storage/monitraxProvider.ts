/**
 * Phase 19: Monitrax Storage Provider
 * Default storage provider using local filesystem or S3-compatible storage
 *
 * In production, this would use S3, Supabase Storage, or similar.
 * For development, it uses local filesystem with signed URL simulation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IStorageProvider } from './interface';
import {
  StorageUploadParams,
  StorageUploadResult,
  StorageDeleteResult,
  SignedUrlResult,
  StorageProviderConfig,
} from '../types';

// Storage root directory (configurable via env)
const STORAGE_ROOT = process.env.DOCUMENT_STORAGE_PATH || './uploads/documents';

// Signed URL secret for HMAC generation
const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || 'monitrax-dev-secret-key';

// Default signed URL expiry (5 minutes)
const DEFAULT_EXPIRY_SECONDS = 300;

export class MonitraxStorageProvider implements IStorageProvider {
  readonly name = 'monitrax';
  private initialized = false;

  async initialize(_config?: StorageProviderConfig): Promise<void> {
    // Ensure storage root exists
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    this.initialized = true;
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const fullPath = path.join(STORAGE_ROOT, params.path);
      const directory = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, params.file);

      return {
        success: true,
        storagePath: params.path,
      };
    } catch (error) {
      return {
        success: false,
        storagePath: '',
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async delete(storagePath: string): Promise<StorageDeleteResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const fullPath = path.join(STORAGE_ROOT, storagePath);
      await fs.unlink(fullPath);

      // Try to clean up empty parent directories
      const directory = path.dirname(fullPath);
      try {
        const files = await fs.readdir(directory);
        if (files.length === 0) {
          await fs.rmdir(directory);
        }
      } catch {
        // Ignore cleanup errors
      }

      return { success: true };
    } catch (error) {
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
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Check if file exists
      const fullPath = path.join(STORAGE_ROOT, storagePath);
      await fs.access(fullPath);

      // Generate expiry timestamp
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

      // Generate signature
      const signature = this.generateSignature(storagePath, expiresTimestamp);

      // Build signed URL
      // In production, this would be an S3/Supabase signed URL
      // For development, we use a local API endpoint
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const encodedPath = encodeURIComponent(storagePath);
      const url = `${baseUrl}/api/documents/download?path=${encodedPath}&expires=${expiresTimestamp}&signature=${signature}`;

      return {
        success: true,
        url,
        expiresAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate signed URL',
      };
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const fullPath = path.join(STORAGE_ROOT, storagePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(storagePath: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  } | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const fullPath = path.join(STORAGE_ROOT, storagePath);
      const stats = await fs.stat(fullPath);

      // Guess content type from extension
      const ext = path.extname(storagePath).toLowerCase();
      const contentType = this.getContentType(ext);

      return {
        size: stats.size,
        lastModified: stats.mtime,
        contentType,
      };
    } catch {
      return null;
    }
  }

  async listFiles(pathPrefix: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: string[] = [];
    const fullPath = path.join(STORAGE_ROOT, pathPrefix);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(pathPrefix, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.listFiles(entryPath);
          results.push(...subFiles);
        } else {
          results.push(entryPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Try to create and delete a test file
      const testPath = path.join(STORAGE_ROOT, '.health-check');
      await fs.writeFile(testPath, 'ok');
      await fs.unlink(testPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify a signed URL signature
   */
  verifySignature(storagePath: string, expiresTimestamp: number, signature: string): boolean {
    const expectedSignature = this.generateSignature(storagePath, expiresTimestamp);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Read file contents (for serving via signed URL)
   */
  async readFile(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(STORAGE_ROOT, storagePath);
    return fs.readFile(fullPath);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateSignature(storagePath: string, expiresTimestamp: number): string {
    const data = `${storagePath}:${expiresTimestamp}`;
    return crypto
      .createHmac('sha256', SIGNED_URL_SECRET)
      .update(data)
      .digest('hex');
  }

  private getContentType(ext: string): string {
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Singleton instance
let providerInstance: MonitraxStorageProvider | null = null;

export function getMonitraxStorageProvider(): MonitraxStorageProvider {
  if (!providerInstance) {
    providerInstance = new MonitraxStorageProvider();
  }
  return providerInstance;
}
