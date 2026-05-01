/**
 * Phase 38 PR 3 — Share Pass content resolver.
 *
 * Resolves the polymorphic `SharePackage.contentRefs` JSON into actual
 * data the recipient page can render. v1 supports DOCUMENT_BUNDLE; future
 * content types (REPORT, NET_WORTH_SNAPSHOT, …) get their own resolvers
 * here without touching the route handlers.
 *
 * Ownership invariant: every query is filtered by the share owner's
 * userId AND `deletedAt: null`. If the owner soft-deletes a document
 * after creating the share, the recipient sees it disappear from the
 * list — there is no path to access deleted content via a share token.
 */

import { prisma } from '@/lib/db';
import { DocumentCategory } from '@/lib/documents/types';

export type ExportStructure = 'financial-year-first' | 'entity-first' | 'category-first';

export interface DocumentBundleRefs {
  documentIds?: string[];
  structure?: ExportStructure;
}

export interface ShareDocumentSummary {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  uploadedAt: string; // ISO
}

/**
 * Resolve the documents list for a DOCUMENT_BUNDLE share. Re-runs the
 * ownership/non-deleted filter on every call so a revoked document
 * never surfaces, even if the share row was created before the deletion.
 */
export async function documentsForShare(
  ownerId: string,
  refs: DocumentBundleRefs
): Promise<ShareDocumentSummary[]> {
  const ids = Array.isArray(refs.documentIds) ? refs.documentIds : [];
  if (ids.length === 0) return [];

  const docs = await prisma.document.findMany({
    where: {
      id: { in: ids },
      userId: ownerId,
      deletedAt: null,
    },
    orderBy: [{ category: 'asc' }, { uploadedAt: 'desc' }],
    select: {
      id: true,
      filename: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      category: true,
      uploadedAt: true,
    },
  });

  return docs.map((d) => ({
    id: d.id,
    filename: d.filename,
    originalFilename: d.originalFilename,
    mimeType: d.mimeType,
    size: d.size,
    category: d.category as DocumentCategory,
    uploadedAt: d.uploadedAt.toISOString(),
  }));
}
