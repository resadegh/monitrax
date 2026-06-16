'use client';

/**
 * Phase 50 — Per-item Documents section.
 *
 * A self-contained "Documents" panel for any wealth item (Property, Investment
 * account, Asset, …). Lets the user **upload, photograph, view and delete**
 * documents attached to that specific item, right on the item's page.
 *
 * Design intent (Reza, 2026-06-17): document/receipt upload must live ON the
 * relevant items, not only in a separate Vault. This is the component that
 * delivers that.
 *
 * IMPORTANT — independent of the AI scan/recognition path. Uploads go straight
 * to `/api/documents/upload` with the entity link field (e.g. propertyId), which
 * stores the bytes + creates the DocumentLink. It does NOT pass `analyze=true`,
 * so it works even while Vision OCR is unavailable. AI recognition is a separate
 * enhancement (the global "Scan a receipt" flow).
 *
 * Glass vocabulary per §18.7.2 (sub-section card recipe). Stitch reference:
 * `.stitch/designs/asset-documents/asset-documents-dark.png` (full light/mobile
 * variants to be backfilled per §18.2.1).
 *
 * @see app/api/documents/upload/route.ts (entity-linked upload)
 * @see app/api/documents/route.ts (GET list-by-entity)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { DocumentList } from './DocumentList';
import {
  DocumentCategory,
  LinkedEntityType,
  SUPPORTED_MIME_TYPES,
} from '@/lib/documents/types';
import { Upload, Camera, Loader2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// The form field `/api/documents/upload` expects per linkable entity type.
// Mirrors hooks/useDocumentUpload.ts LINK_FIELD_BY_ENTITY (kept local so this
// section has no coupling to the form-autofill hook).
const LINK_FIELD: Partial<Record<LinkedEntityType, string>> = {
  [LinkedEntityType.PROPERTY]: 'propertyId',
  [LinkedEntityType.INVESTMENT_ACCOUNT]: 'investmentAccountId',
  [LinkedEntityType.INVESTMENT_HOLDING]: 'investmentHoldingId',
  [LinkedEntityType.ASSET]: 'assetId',
  [LinkedEntityType.LOAN]: 'loanId',
  [LinkedEntityType.INCOME]: 'incomeId',
  [LinkedEntityType.EXPENSE]: 'expenseId',
  [LinkedEntityType.ACCOUNT]: 'accountId',
  [LinkedEntityType.OFFSET_ACCOUNT]: 'offsetAccountId',
  [LinkedEntityType.TRANSACTION]: 'transactionId',
};

interface DocItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  description: string | null;
  tags: string[];
  uploadedAt: string;
  links: { entityType: LinkedEntityType; entityId: string; entityName?: string }[];
}

export interface DocumentsSectionProps {
  /** Which kind of item this section is attached to. */
  entityType: LinkedEntityType;
  /** The item's id. */
  entityId: string;
  /** The item's display name (used in copy + empty state). */
  entityLabel: string;
  /** Default category applied to uploads here. */
  defaultCategory?: DocumentCategory;
  className?: string;
}

const ACCEPT = (SUPPORTED_MIME_TYPES as readonly string[]).join(',');

export function DocumentsSection({
  entityType,
  entityId,
  entityLabel,
  defaultCategory = DocumentCategory.OTHER,
  className,
}: DocumentsSectionProps) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsTouch(
      typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    );
  }, []);

  const fetchDocs = useCallback(async () => {
    if (!token || !entityId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents?entityType=${entityType}&entityId=${encodeURIComponent(
          entityId,
        )}&sortBy=uploadedAt&sortOrder=desc`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setDocuments((data.documents as DocItem[]) || []);
      }
    } catch {
      /* leave the list as-is; the empty state covers it */
    } finally {
      setLoading(false);
    }
  }, [token, entityType, entityId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !token) return;
      const field = LINK_FIELD[entityType];
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append('file', file);
          // Send MIME explicitly — Vercel/Next can drop file.type.
          fd.append('mimeType', file.type);
          fd.append('category', defaultCategory);
          if (field) fd.append(field, entityId);

          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `Upload failed (${res.status})`);
          }
        }
        await fetchDocs();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    },
    [token, entityType, entityId, defaultCategory, fetchDocs],
  );

  const handleView = useCallback(
    async (id: string) => {
      if (!token) return null;
      const res = await fetch(`/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return { signedUrl: data.signedUrl };
    },
    [token],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return;
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDocuments((docs) => docs.filter((d) => d.id !== id));
    },
    [token],
  );

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]',
        'dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Receipts, statements &amp; paperwork for {entityLabel}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
          <FolderOpen className="h-5 w-5" />
        </div>
      </div>

      {/* Upload controls — plain store+link (no AI dependency) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploading…' : 'Upload document'}
        </Button>
        {isTouch && (
          <Button
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Take photo
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <DocumentList
        documents={documents}
        onView={handleView}
        onDelete={handleDelete}
        loading={loading}
        emptyMessage={`No documents yet — upload a receipt, statement or contract for ${entityLabel}.`}
      />
    </section>
  );
}
