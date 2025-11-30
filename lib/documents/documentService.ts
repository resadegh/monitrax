/**
 * Phase 19: Document Service
 * Core service for document management operations
 */

import { prisma } from '@/lib/db';
import { DocumentCategory, LinkedEntityType, StorageProviderType } from '@prisma/client';
import { getStorageProvider } from './storage';
import {
  DocumentMetadata,
  DocumentWithLinks,
  DocumentQuery,
  DocumentListResult,
  UploadRequest,
  UploadResult,
  EntityLinkRequest,
  AutoLinkContext,
  ResolvedLinks,
  PathContext,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  MIME_TO_EXTENSION,
} from './types';

// ============================================================================
// Document Upload
// ============================================================================

export async function uploadDocument(
  userId: string,
  request: UploadRequest
): Promise<UploadResult> {
  // Validate file
  const validation = validateUpload(request);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Get storage provider
    const storage = await getStorageProvider(userId);

    // Generate storage path
    const storagePath = generateStoragePath(userId, request);

    // Convert file to buffer if needed
    let fileBuffer: Buffer;
    if (Buffer.isBuffer(request.file)) {
      fileBuffer = request.file;
    } else {
      // Handle Web API File/Blob type
      const blob = request.file as Blob;
      fileBuffer = Buffer.from(await blob.arrayBuffer());
    }

    // Upload to storage
    const uploadResult = await storage.upload({
      userId,
      file: fileBuffer,
      filename: request.filename,
      mimeType: request.mimeType,
      path: storagePath,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        userId,
        filename: generateFilename(request.filename, request.mimeType),
        originalFilename: request.filename,
        mimeType: request.mimeType,
        size: fileBuffer.length,
        category: request.category,
        storageProvider: StorageProviderType.MONITRAX,
        storagePath: uploadResult.storagePath,
        storageUrl: uploadResult.storageUrl || null,
        description: request.description || null,
        tags: request.tags || [],
      },
    });

    // Create document links
    if (request.links && request.links.length > 0) {
      await prisma.documentLink.createMany({
        data: request.links.map(link => ({
          documentId: document.id,
          entityType: link.entityType,
          entityId: link.entityId,
        })),
      });
    }

    // Fetch full document with links
    const fullDocument = await getDocumentById(document.id, userId);

    // Generate signed URL for immediate preview
    const signedUrlResult = await storage.getSignedUrl(uploadResult.storagePath);

    return {
      success: true,
      document: fullDocument!,
      signedUrl: signedUrlResult.url,
    };
  } catch (error) {
    console.error('Document upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// ============================================================================
// Document Retrieval
// ============================================================================

export async function getDocumentById(
  documentId: string,
  userId: string
): Promise<DocumentWithLinks | null> {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      deletedAt: null,
    },
    include: {
      links: true,
    },
  });

  if (!document) {
    return null;
  }

  return {
    ...document,
    links: document.links.map(link => ({
      id: link.id,
      entityType: link.entityType,
      entityId: link.entityId,
      createdAt: link.createdAt,
    })),
  };
}

export async function getDocumentWithSignedUrl(
  documentId: string,
  userId: string
): Promise<{ document: DocumentWithLinks; signedUrl: string; expiresAt: Date } | null> {
  const document = await getDocumentById(documentId, userId);

  if (!document) {
    return null;
  }

  const storage = await getStorageProvider(userId);
  const signedUrlResult = await storage.getSignedUrl(document.storagePath);

  if (!signedUrlResult.success) {
    return null;
  }

  return {
    document,
    signedUrl: signedUrlResult.url!,
    expiresAt: signedUrlResult.expiresAt!,
  };
}

export async function listDocuments(query: DocumentQuery): Promise<DocumentListResult> {
  const where: Parameters<typeof prisma.document.findMany>[0]['where'] = {
    userId: query.userId,
  };

  // Apply filters
  if (!query.includeDeleted) {
    where.deletedAt = null;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.tags && query.tags.length > 0) {
    where.tags = { hasSome: query.tags };
  }

  if (query.search) {
    where.OR = [
      { originalFilename: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Entity filtering via links
  if (query.entityType || query.entityId) {
    const linkWhere: { entityType?: LinkedEntityType; entityId?: string } = {};
    if (query.entityType) linkWhere.entityType = query.entityType;
    if (query.entityId) linkWhere.entityId = query.entityId;

    where.links = { some: linkWhere };
  }

  // Count total
  const total = await prisma.document.count({ where });

  // Get documents with pagination
  const documents = await prisma.document.findMany({
    where,
    include: { links: true },
    orderBy: {
      [query.sortBy || 'uploadedAt']: query.sortOrder || 'desc',
    },
    take: query.limit || 50,
    skip: query.offset || 0,
  });

  const documentsWithLinks: DocumentWithLinks[] = documents.map(doc => ({
    ...doc,
    links: doc.links.map(link => ({
      id: link.id,
      entityType: link.entityType,
      entityId: link.entityId,
      createdAt: link.createdAt,
    })),
  }));

  return {
    documents: documentsWithLinks,
    total,
    hasMore: (query.offset || 0) + documents.length < total,
  };
}

export async function getDocumentsForEntity(
  userId: string,
  entityType: LinkedEntityType,
  entityId: string
): Promise<DocumentWithLinks[]> {
  const result = await listDocuments({
    userId,
    entityType,
    entityId,
    sortBy: 'uploadedAt',
    sortOrder: 'desc',
  });

  return result.documents;
}

// ============================================================================
// Document Deletion
// ============================================================================

export async function deleteDocument(
  documentId: string,
  userId: string,
  hardDelete: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    if (hardDelete) {
      // Delete from storage
      const storage = await getStorageProvider(userId);
      await storage.delete(document.storagePath);

      // Delete from database (cascades to links)
      await prisma.document.delete({
        where: { id: documentId },
      });
    } else {
      // Soft delete
      await prisma.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Document delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

// ============================================================================
// Document Links
// ============================================================================

export async function addDocumentLink(
  documentId: string,
  userId: string,
  link: EntityLinkRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    // Create link (unique constraint prevents duplicates)
    await prisma.documentLink.create({
      data: {
        documentId,
        entityType: link.entityType,
        entityId: link.entityId,
      },
    });

    return { success: true };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return { success: false, error: 'Link already exists' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add link',
    };
  }
}

export async function removeDocumentLink(
  documentId: string,
  userId: string,
  entityType: LinkedEntityType,
  entityId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    await prisma.documentLink.delete({
      where: {
        documentId_entityType_entityId: {
          documentId,
          entityType,
          entityId,
        },
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove link',
    };
  }
}

// ============================================================================
// Auto-Linking Logic
// ============================================================================

export async function resolveAutoLinks(
  userId: string,
  context: AutoLinkContext
): Promise<ResolvedLinks> {
  const links: EntityLinkRequest[] = [];
  const autoLinkedEntities: string[] = [];

  // Always link to primary entity
  links.push({
    entityType: context.primaryEntityType,
    entityId: context.primaryEntityId,
  });

  // Auto-link based on entity relationships
  switch (context.primaryEntityType) {
    case LinkedEntityType.EXPENSE:
      // If expense has a property, link to property too
      if (context.propertyId) {
        links.push({
          entityType: LinkedEntityType.PROPERTY,
          entityId: context.propertyId,
        });
        autoLinkedEntities.push('Property');
      }
      // If expense has a loan, link to loan too
      if (context.loanId) {
        links.push({
          entityType: LinkedEntityType.LOAN,
          entityId: context.loanId,
        });
        autoLinkedEntities.push('Loan');
      }
      break;

    case LinkedEntityType.INCOME:
      // If income has a property, link to property too
      if (context.propertyId) {
        links.push({
          entityType: LinkedEntityType.PROPERTY,
          entityId: context.propertyId,
        });
        autoLinkedEntities.push('Property');
      }
      break;

    case LinkedEntityType.LOAN:
      // If loan has a property, link to property too
      if (context.propertyId) {
        links.push({
          entityType: LinkedEntityType.PROPERTY,
          entityId: context.propertyId,
        });
        autoLinkedEntities.push('Property');
      }
      break;

    case LinkedEntityType.INVESTMENT_HOLDING:
      // Link to parent investment account
      if (context.investmentAccountId) {
        links.push({
          entityType: LinkedEntityType.INVESTMENT_ACCOUNT,
          entityId: context.investmentAccountId,
        });
        autoLinkedEntities.push('Investment Account');
      }
      break;
  }

  return { links, autoLinkedEntities };
}

// ============================================================================
// Path Generation
// ============================================================================

function generateStoragePath(userId: string, request: UploadRequest): string {
  const timestamp = Date.now();
  const sanitizedFilename = sanitizeFilename(request.filename);

  // If we have entity links, use hierarchical path
  if (request.links && request.links.length > 0) {
    // Use most specific entity for path
    const primaryLink = request.links[0];
    const entityFolder = primaryLink.entityType.toLowerCase();
    return `${userId}/${entityFolder}/${primaryLink.entityId}/${timestamp}_${sanitizedFilename}`;
  }

  // Default to flat user folder
  return `${userId}/general/${timestamp}_${sanitizedFilename}`;
}

function generateFilename(originalFilename: string, mimeType: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const extension = MIME_TO_EXTENSION[mimeType] || getExtension(originalFilename);
  const baseName = sanitizeFilename(originalFilename.replace(/\.[^/.]+$/, ''));

  return `${baseName}_${timestamp}_${randomSuffix}${extension}`;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^/.]+$/);
  return match ? match[0].toLowerCase() : '';
}

// ============================================================================
// Validation
// ============================================================================

function validateUpload(request: UploadRequest): { valid: boolean; error?: string } {
  // Check MIME type
  if (!SUPPORTED_MIME_TYPES.includes(request.mimeType as typeof SUPPORTED_MIME_TYPES[number])) {
    return { valid: false, error: `Unsupported file type: ${request.mimeType}` };
  }

  // Check file size
  const fileSize = Buffer.isBuffer(request.file)
    ? request.file.length
    : (request.file as Blob).size;

  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check filename
  if (!request.filename || request.filename.trim().length === 0) {
    return { valid: false, error: 'Filename is required' };
  }

  return { valid: true };
}

// ============================================================================
// Statistics
// ============================================================================

export async function getDocumentStats(userId: string): Promise<{
  totalDocuments: number;
  totalSize: number;
  byCategory: Record<DocumentCategory, number>;
}> {
  const documents = await prisma.document.findMany({
    where: { userId, deletedAt: null },
    select: { size: true, category: true },
  });

  const byCategory = documents.reduce((acc, doc) => {
    acc[doc.category] = (acc[doc.category] || 0) + 1;
    return acc;
  }, {} as Record<DocumentCategory, number>);

  return {
    totalDocuments: documents.length,
    totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
    byCategory,
  };
}
