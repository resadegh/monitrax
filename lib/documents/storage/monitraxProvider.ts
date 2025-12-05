/**
 * Phase 19: Monitrax Storage Provider (Database Storage)
 * Stores document content directly in the PostgreSQL database
 * This ensures documents persist across deployments on platforms like Render
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { IStorageProvider } from './interface';
import {
  StorageUploadParams,
  StorageUploadResult,
  StorageDeleteResult,
  SignedUrlResult,
  StorageProviderConfig,
} from '../types';

// Signed URL secret for HMAC generation
const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || 'monitrax-dev-secret-key';

// Default signed URL expiry (5 minutes)
const DEFAULT_EXPIRY_SECONDS = 300;

// Maximum file size for database storage (10MB - reasonable for receipts/documents)
const MAX_DB_FILE_SIZE = 10 * 1024 * 1024;

export class MonitraxStorageProvider implements IStorageProvider {
  readonly name = 'monitrax';
  private initialized = false;

  async initialize(_config?: StorageProviderConfig): Promise<void> {
    // No filesystem initialization needed for database storage
    this.initialized = true;
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Check file size limit for database storage
      if (params.file.length > MAX_DB_FILE_SIZE) {
        return {
          success: false,
          storagePath: '',
          error: `File too large for database storage. Maximum size is ${MAX_DB_FILE_SIZE / 1024 / 1024}MB`,
        };
      }

      // For database storage, we just return the path - the actual file content
      // is stored by the documentService when creating the document record
      return {
        success: true,
        storagePath: params.path,
        // Store file content in memory to be saved by documentService
        fileBuffer: params.file,
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
      // For database storage, the fileContent is deleted when the document record is deleted
      // via Prisma cascade, so this is a no-op
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
      // Generate expiry timestamp
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

      // Generate signature
      const signature = this.generateSignature(storagePath, expiresTimestamp);

      // Build signed URL pointing to our download API
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
      const document = await prisma.document.findFirst({
        where: {
          storagePath,
          deletedAt: null,
          fileContent: { not: null },
        },
        select: { id: true },
      });
      return document !== null;
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
      const document = await prisma.document.findFirst({
        where: {
          storagePath,
          deletedAt: null,
        },
        select: {
          size: true,
          updatedAt: true,
          mimeType: true,
        },
      });

      if (!document) {
        return null;
      }

      return {
        size: document.size,
        lastModified: document.updatedAt,
        contentType: document.mimeType,
      };
    } catch {
      return null;
    }
  }

  async listFiles(pathPrefix: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const documents = await prisma.document.findMany({
        where: {
          storagePath: { startsWith: pathPrefix },
          deletedAt: null,
        },
        select: { storagePath: true },
      });

      return documents.map((d: { storagePath: string }) => d.storagePath);
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;
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
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Read file contents from database
   */
  async readFile(storagePath: string): Promise<Buffer> {
    const document = await prisma.document.findFirst({
      where: {
        storagePath,
        deletedAt: null,
      },
      select: {
        fileContent: true,
      },
    });

    if (!document || !document.fileContent) {
      throw new Error('Document not found or content missing');
    }

    return Buffer.from(document.fileContent);
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
}

// Singleton instance
let providerInstance: MonitraxStorageProvider | null = null;

export function getMonitraxStorageProvider(): MonitraxStorageProvider {
  if (!providerInstance) {
    providerInstance = new MonitraxStorageProvider();
  }
  return providerInstance;
}
