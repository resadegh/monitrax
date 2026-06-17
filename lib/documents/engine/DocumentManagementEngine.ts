/**
 * Phase 25: Document Management Engine
 * Central orchestrator for all document operations
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import {
  UploadContext,
  ResolvedUploadConfig,
  EngineResult,
  EntityLink,
  createUploadContext,
  UploadSource,
} from './types';
import { RuleEngine, getRuleEngine } from './RuleEngine';
import { getStorageProvider, assertWithinQuota, StorageQuotaExceededError } from '../storage';
import { DocumentCategory, StorageProviderType } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Type for document links from Prisma
interface DocumentLinkData {
  id: string;
  entityType: string;
  entityId: string;
}

/**
 * Generate a unique filename with UUID prefix
 */
function generateUniqueFilename(originalFilename: string, mimeType: string): string {
  const ext = originalFilename.split('.').pop() || getExtensionFromMimeType(mimeType);
  const baseName = originalFilename.replace(/\.[^/.]+$/, '').slice(0, 50);
  const uuid = uuidv4().slice(0, 8);
  return `${baseName}_${uuid}.${ext}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/csv': 'csv',
    'text/plain': 'txt',
  };
  return mimeToExt[mimeType] || 'bin';
}

export class DocumentManagementEngine {
  private ruleEngine: RuleEngine;
  private static instance: DocumentManagementEngine;

  private constructor() {
    this.ruleEngine = getRuleEngine();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DocumentManagementEngine {
    if (!DocumentManagementEngine.instance) {
      DocumentManagementEngine.instance = new DocumentManagementEngine();
    }
    return DocumentManagementEngine.instance;
  }

  /**
   * Process a document upload through the engine
   */
  async processUpload(context: UploadContext): Promise<EngineResult> {
    console.log('[DME] Processing upload:', {
      source: context.source,
      filename: context.filename,
      size: context.size,
      mimeType: context.mimeType,
      entities: context.entities,
      userInput: context.userInput,
    });

    try {
      // Step 0: Enforce the per-user storage quota BEFORE any byte is written
      // (SSOT: lib/documents/storage/storageQuota.ts). Computed from live
      // Document.size — drift-free, and backend-independent (DB or GCS).
      await assertWithinQuota(context.userId, context.size);

      // Step 1: Resolve configuration through rules
      const config = await this.ruleEngine.resolve(context);

      console.log('[DME] Resolved config:', {
        storageProvider: config.storageProvider,
        category: config.category,
        storagePath: config.storagePath,
        linksCount: config.links.length,
        tags: config.suggestedTags,
      });

      // Step 2: Convert file to buffer
      const fileBuffer = await this.getFileBuffer(context.file);

      // Step 2.5 (Phase 50 D.1): document-level dedup. If this user already has a
      // byte-identical, non-deleted document, DON'T store it again — add any new
      // entity links this upload resolved to the existing one and return it
      // flagged `duplicate`. This is the SINGLE canonical place document dedup
      // lives (inside the one DME chokepoint), so every path — scan, per-item,
      // drag-drop — inherits it. Stops the "same receipt twice" at the source,
      // not just the downstream expense.
      const contentHash = createHash('sha256').update(fileBuffer).digest('hex');
      const existingDoc = await prisma.document.findFirst({
        where: { userId: context.userId, contentHash, deletedAt: null },
        include: { links: true },
      });
      if (existingDoc) {
        console.log('[DME] Duplicate upload — reusing existing document:', existingDoc.id);
        if (config.links.length > 0) {
          await prisma.documentLink.createMany({
            data: config.links.map(link => ({
              documentId: existingDoc.id,
              entityType: link.entityType,
              entityId: link.entityId,
            })),
            skipDuplicates: true,
          });
        }
        const refreshed = await prisma.document.findUnique({
          where: { id: existingDoc.id },
          include: { links: true },
        });
        return {
          success: true,
          duplicate: true,
          document: this.toEngineDocument(refreshed!),
          storagePath: refreshed!.storagePath,
          storageUrl: refreshed!.storageUrl,
        };
      }

      // Step 3: Handle LOCAL_DRIVE special case
      if (config.storageProvider === StorageProviderType.LOCAL_DRIVE) {
        return this.handleLocalDriveUpload(context, config, fileBuffer);
      }

      // Step 4: Get storage provider and upload
      const storage = await getStorageProvider(context.userId);

      console.log('[DME] Using storage provider:', storage.name);

      const uploadResult = await storage.upload({
        userId: context.userId,
        file: fileBuffer,
        filename: context.filename,
        mimeType: context.mimeType,
        path: config.storagePath,
      });

      if (!uploadResult.success) {
        console.error('[DME] Upload failed:', uploadResult.error);
        return {
          success: false,
          error: uploadResult.error || 'Upload failed',
        };
      }

      console.log('[DME] Storage upload successful:', {
        storagePath: uploadResult.storagePath,
        storageUrl: uploadResult.storageUrl,
      });

      // Step 5: Determine actual storage provider type
      const isGCSProvider = storage.name === 'google_cloud_storage';
      const actualProvider = isGCSProvider
        ? StorageProviderType.GOOGLE_CLOUD_STORAGE
        : StorageProviderType.MONITRAX;

      // Step 6: Create document record
      const document = await prisma.document.create({
        data: {
          userId: context.userId,
          filename: generateUniqueFilename(context.filename, context.mimeType),
          originalFilename: context.filename,
          mimeType: context.mimeType,
          size: context.size,
          category: config.category,
          storageProvider: actualProvider,
          storagePath: uploadResult.storagePath,
          storageUrl: uploadResult.storageUrl || null,
          description: context.userInput?.description || null,
          tags: config.suggestedTags,
          contentHash, // Phase 50 D.1 — enables future dedup of this file
          // Only store file content in database for Monitrax provider
          fileContent: actualProvider === StorageProviderType.MONITRAX ? fileBuffer : null,
        },
      });

      console.log('[DME] Document record created:', document.id);

      // Step 7: Create entity links
      if (config.links.length > 0) {
        await prisma.documentLink.createMany({
          data: config.links.map(link => ({
            documentId: document.id,
            entityType: link.entityType,
            entityId: link.entityId,
          })),
        });
        console.log('[DME] Created', config.links.length, 'entity links');
      }

      // Step 8: Fetch complete document with links
      const completeDocument = await prisma.document.findUnique({
        where: { id: document.id },
        include: { links: true },
      });

      console.log('[DME] Upload complete:', {
        documentId: document.id,
        storagePath: uploadResult.storagePath,
        linksCreated: config.links.length,
      });

      return {
        success: true,
        document: this.toEngineDocument(completeDocument!),
        storagePath: uploadResult.storagePath,
        storageUrl: uploadResult.storageUrl,
      };
    } catch (error) {
      console.error('[DME] Upload error:', error);
      if (error instanceof StorageQuotaExceededError) {
        return {
          success: false,
          error: 'Storage limit reached. Free up space by deleting documents you no longer need.',
          errorCode: error.code,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Map a persisted Prisma document (with links) to the EngineResult shape.
   * Single mapper used by both the normal and the dedup return paths (§12.1).
   */
  private toEngineDocument(doc: {
    id: string;
    filename: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    category: string;
    storageProvider: string;
    storagePath: string;
    storageUrl: string | null;
    description: string | null;
    tags: string[];
    uploadedAt: Date;
    links: DocumentLinkData[];
  }): NonNullable<EngineResult['document']> {
    return {
      id: doc.id,
      filename: doc.filename,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      size: doc.size,
      category: doc.category as DocumentCategory,
      storageProvider: doc.storageProvider as StorageProviderType,
      storagePath: doc.storagePath,
      storageUrl: doc.storageUrl,
      description: doc.description,
      tags: doc.tags,
      uploadedAt: doc.uploadedAt,
      links: doc.links.map((l: DocumentLinkData) => ({
        id: l.id,
        entityType: l.entityType as EntityLink['entityType'],
        entityId: l.entityId,
      })),
    };
  }

  /**
   * Handle LOCAL_DRIVE uploads (metadata only, file saved client-side)
   */
  private async handleLocalDriveUpload(
    context: UploadContext,
    config: ResolvedUploadConfig,
    _fileBuffer: Buffer
  ): Promise<EngineResult> {
    console.log('[DME] Handling LOCAL_DRIVE upload');

    // For local drive, we only store metadata
    // The file is saved on the user's computer by the client
    const localPath = context.userInput?.description || config.storagePath;

    const document = await prisma.document.create({
      data: {
        userId: context.userId,
        filename: generateUniqueFilename(context.filename, context.mimeType),
        originalFilename: context.filename,
        mimeType: context.mimeType,
        size: context.size,
        category: config.category,
        storageProvider: StorageProviderType.LOCAL_DRIVE,
        storagePath: localPath,
        storageUrl: null,
        description: context.userInput?.description || null,
        tags: config.suggestedTags,
        fileContent: null, // No file content for local drive
      },
    });

    // Create entity links
    if (config.links.length > 0) {
      await prisma.documentLink.createMany({
        data: config.links.map(link => ({
          documentId: document.id,
          entityType: link.entityType,
          entityId: link.entityId,
        })),
      });
    }

    const completeDocument = await prisma.document.findUnique({
      where: { id: document.id },
      include: { links: true },
    });

    return {
      success: true,
      document: {
        id: completeDocument!.id,
        filename: completeDocument!.filename,
        originalFilename: completeDocument!.originalFilename,
        mimeType: completeDocument!.mimeType,
        size: completeDocument!.size,
        category: completeDocument!.category as DocumentCategory,
        storageProvider: completeDocument!.storageProvider as StorageProviderType,
        storagePath: completeDocument!.storagePath,
        storageUrl: completeDocument!.storageUrl,
        description: completeDocument!.description,
        tags: completeDocument!.tags,
        uploadedAt: completeDocument!.uploadedAt,
        links: (completeDocument!.links as DocumentLinkData[]).map((l: DocumentLinkData) => ({
          id: l.id,
          entityType: l.entityType as EntityLink['entityType'],
          entityId: l.entityId,
        })),
      },
      storagePath: localPath,
    };
  }

  /**
   * Convert file to buffer
   */
  private async getFileBuffer(file: File | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }
    // Handle Web API File/Blob type
    const blob = file as Blob;
    return Buffer.from(await blob.arrayBuffer());
  }

  /**
   * Preview what the engine would do without actually uploading
   */
  async previewUpload(context: UploadContext): Promise<ResolvedUploadConfig> {
    return this.ruleEngine.resolve(context);
  }

  /**
   * Get detailed rule matching info (for debugging)
   */
  async debugUpload(context: UploadContext) {
    return this.ruleEngine.preview(context);
  }
}

/**
 * Get singleton instance of Document Management Engine
 */
export function getDocumentManagementEngine(): DocumentManagementEngine {
  return DocumentManagementEngine.getInstance();
}

// Re-export types and helpers
export { createUploadContext, UploadSource };
export type { UploadContext, EngineResult, ResolvedUploadConfig, EntityLink };
