/**
 * Phase 19: Document Management Types
 * Type definitions for the document management system
 */

import { DocumentCategory, StorageProviderType, LinkedEntityType } from '@prisma/client';

// ============================================================================
// Core Document Types
// ============================================================================

export interface DocumentMetadata {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  storageProvider: StorageProviderType;
  storagePath: string;
  storageUrl: string | null;
  description: string | null;
  tags: string[];
  uploadedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DocumentWithLinks extends DocumentMetadata {
  links: DocumentLinkInfo[];
}

export interface DocumentLinkInfo {
  id: string;
  entityType: LinkedEntityType;
  entityId: string;
  entityName?: string; // Resolved entity name for display
  createdAt: Date;
}

// ============================================================================
// Upload Types
// ============================================================================

export interface UploadRequest {
  file: Blob | Buffer;
  filename: string;
  mimeType: string;
  category: DocumentCategory;
  description?: string;
  tags?: string[];
  // Entity links to create
  links?: EntityLinkRequest[];
}

export interface EntityLinkRequest {
  entityType: LinkedEntityType;
  entityId: string;
}

export interface UploadResult {
  success: boolean;
  document?: DocumentWithLinks;
  error?: string;
  signedUrl?: string; // For immediate preview
}

// ============================================================================
// Storage Provider Types
// ============================================================================

export interface StorageUploadParams {
  userId: string;
  file: Buffer;
  filename: string;
  mimeType: string;
  path: string; // Hierarchical path (e.g., properties/{id}/...)
}

export interface StorageUploadResult {
  success: boolean;
  storagePath: string;
  storageUrl?: string;
  error?: string;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

export interface StorageProviderConfig {
  provider: StorageProviderType;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  config?: Record<string, unknown>;
}

// ============================================================================
// Query Types
// ============================================================================

export interface DocumentQuery {
  userId: string;
  category?: DocumentCategory;
  entityType?: LinkedEntityType;
  entityId?: string;
  tags?: string[];
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'uploadedAt' | 'filename' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentListResult {
  documents: DocumentWithLinks[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Auto-Link Types
// ============================================================================

export interface AutoLinkContext {
  // Primary entity being uploaded to
  primaryEntityType: LinkedEntityType;
  primaryEntityId: string;
  // Additional context for auto-linking
  propertyId?: string;
  loanId?: string;
  accountId?: string;
  investmentAccountId?: string;
}

export interface ResolvedLinks {
  links: EntityLinkRequest[];
  autoLinkedEntities: string[]; // Human-readable description of auto-links
}

// ============================================================================
// Path Generation Types
// ============================================================================

export interface PathContext {
  userId: string;
  entityType: LinkedEntityType;
  entityId: string;
  filename: string;
  // Optional parent entity for hierarchical paths
  parentEntityType?: LinkedEntityType;
  parentEntityId?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DocumentResponse {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  description: string | null;
  tags: string[];
  uploadedAt: string;
  links: {
    entityType: LinkedEntityType;
    entityId: string;
    entityName?: string;
  }[];
}

export interface DocumentDetailResponse extends DocumentResponse {
  signedUrl: string;
  expiresAt: string;
}

// ============================================================================
// Supported MIME Types
// ============================================================================

export const SUPPORTED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// MIME Type to Extension Mapping
// ============================================================================

export const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

// ============================================================================
// Re-export Prisma enums for convenience
// ============================================================================

export { DocumentCategory, StorageProviderType, LinkedEntityType };
