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
 * IMPORTANT — AI recognition is OPT-IN per surface via `analyzeOnUpload`.
 * Uploads go to `/api/documents/upload` with the entity link field (e.g.
 * assetId), which stores the bytes + creates the DocumentLink. When
 * `analyzeOnUpload` is set, the upload also passes `analyze=true` so Vision OCR
 * runs and the recognised vendor/amount/date are surfaced inline with a one-tap
 * "Add as expense" (linked to this item). On a successful recognition the file is
 * also auto-renamed to a meaningful AI-derived name (e.g. "QBE Insurance -
 * 2026-06-18.jpg") so the Vault is organised by what the document is, not
 * "IMG_6615.JPG". When unset it works even while Vision is unavailable — pure
 * filing, no OCR.
 *
 * Glass vocabulary per §18.7.2 (sub-section card recipe). Stitch reference:
 * `.stitch/designs/asset-documents/asset-documents-dark.png` (full light/mobile
 * variants to be backfilled per §18.2.1).
 *
 * @see app/api/documents/upload/route.ts (entity-linked upload + analyze)
 * @see app/api/documents/route.ts (GET list-by-entity)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { DocumentList } from './DocumentList';
import { CameraCaptureDialog } from './CameraCaptureDialog';
import {
  DocumentCategory,
  LinkedEntityType,
  SUPPORTED_MIME_TYPES,
} from '@/lib/documents/types';
import { Upload, Camera, Loader2, FolderOpen, Sparkles, Plus, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
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
  /**
   * When true, uploads also run AI recognition (Vision OCR) and surface the
   * recognised vendor/amount/date inline with a one-tap "Add as expense"
   * (linked to this item). Off by default (pure filing).
   */
  analyzeOnUpload?: boolean;
  className?: string;
}

const ACCEPT = (SUPPORTED_MIME_TYPES as readonly string[]).join(',');

/** A recognised receipt surfaced after an analyzed upload. */
interface Recognised {
  documentId: string;
  vendor?: string;
  amount?: number;
  date?: string;
  documentType?: string;
  confidence?: number;
}

/** First present key from a loose extractedData bag (resilient to key drift).
 * Unwraps the engine's `ExtractedField` shape — `{ value, confidence }` — to its
 * `.value`, so callers never receive (and never render) a raw object. Without
 * this, rendering a recognised field crashes with React error #31 ("Objects are
 * not valid as a React child"). */
function pickField(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    let v = data[k];
    if (v != null && typeof v === 'object' && 'value' in (v as object)) {
      v = (v as { value: unknown }).value;
    }
    // Never return an object/array — only primitives are safe to render.
    if (v != null && v !== '' && typeof v !== 'object') return v;
  }
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Title-case a raw documentType enum (e.g. "TAX_RETURN" → "Tax Return"). */
function prettyType(t?: string): string | undefined {
  if (!t) return undefined;
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build a meaningful filename from the AI-recognised fields, e.g.
 * "QBE Insurance - 2026-06-18.jpg" — so the Vault is organised by what the
 * document IS, not "IMG_6615.JPG". Keeps the original extension; strips
 * filesystem-illegal characters; returns null when there's nothing useful to
 * name it (so we leave the original name alone).
 */
function buildSuggestedName(
  r: { vendor?: string; date?: string; documentType?: string },
  originalFilename: string,
): string | null {
  const dot = originalFilename.lastIndexOf('.');
  const ext = dot > 0 ? originalFilename.slice(dot) : '';
  const clean = (s: string) =>
    s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

  const parts: string[] = [];
  const label = r.vendor ? clean(r.vendor).slice(0, 60) : prettyType(r.documentType);
  if (label) parts.push(label);
  if (r.date) parts.push(clean(r.date));
  if (parts.length === 0) return null;
  return parts.join(' - ') + ext;
}

export function DocumentsSection({
  entityType,
  entityId,
  entityLabel,
  defaultCategory = DocumentCategory.OTHER,
  analyzeOnUpload = false,
  className,
}: DocumentsSectionProps) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recognised, setRecognised] = useState<Recognised | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  // Only assets + properties can carry a linked expense from this surface.
  const canAddExpense =
    entityType === LinkedEntityType.ASSET || entityType === LinkedEntityType.PROPERTY;
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

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0 || !token) return;
      const field = LINK_FIELD[entityType];
      setUploading(true);
      setError(null);
      setRecognised(null);
      setAddNotice(null);
      try {
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          // Send MIME explicitly — Vercel/Next can drop file.type.
          fd.append('mimeType', file.type);
          fd.append('category', defaultCategory);
          if (field) fd.append(field, entityId);
          if (analyzeOnUpload) fd.append('analyze', 'true');

          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          if (!res.ok) {
            throw new Error((json?.error as string) || `Upload failed (${res.status})`);
          }

          // Phase 50 D.1: the DME de-duplicated this upload — a byte-identical
          // file was already stored. Tell the user and skip recognition / rename
          // / add-expense (there's no new document to act on).
          if (json?.duplicate) {
            setAddNotice('You already uploaded this document — linked it here (no duplicate created).');
            continue;
          }

          // Surface the AI-recognised fields (last analyzed file wins — receipts
          // are uploaded one at a time). The doc is already filed under this item.
          if (analyzeOnUpload) {
            const a = json?.analysis as
              | { documentType?: string; overallConfidence?: number; extractedData?: Record<string, unknown> }
              | null;
            const doc = json?.document as { id?: string; originalFilename?: string } | undefined;
            const docId = doc?.id;
            const originalFilename = doc?.originalFilename || file.name;
            if (a && docId) {
              const ed = a.extractedData ?? {};
              const rec: Recognised = {
                documentId: docId,
                vendor: (pickField(ed, ['vendor', 'vendorName', 'merchant', 'payee', 'name']) as string) || undefined,
                amount: asNumber(pickField(ed, ['amount', 'total', 'totalAmount', 'amountDue'])),
                date: (pickField(ed, ['date', 'issueDate', 'transactionDate']) as string) || undefined,
                documentType: a.documentType,
                confidence: a.overallConfidence,
              };
              setRecognised(rec);

              // Auto-rename the document to a meaningful, AI-derived name so the
              // Vault is organised by what the document is (e.g. "QBE Insurance
              // - 2026-06-18.jpg") instead of "IMG_6615.JPG". Best-effort: a
              // rename failure must not break the upload.
              const suggested = buildSuggestedName(rec, originalFilename);
              if (suggested && suggested !== originalFilename) {
                try {
                  await fetch(`/api/documents/${docId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ action: 'rename', name: suggested }),
                  });
                } catch {
                  /* non-fatal — the original filename stays */
                }
              }
            }
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
    [token, entityType, entityId, defaultCategory, analyzeOnUpload, fetchDocs],
  );

  // Canonical "create an expense from a recognised receipt, linked to this item".
  // Dedup is enforced server-side (dedupeReceipt) so several photos of the same
  // receipt can't create duplicate expenses; the created (or existing) expense is
  // linked to the document so the receipt ↔ expense relationship is tracked (SSOT).
  // Shared by the post-upload banner AND the per-document "$" action (so a receipt
  // can become an expense at any time, not just in the fleeting banner).
  const createExpenseFrom = useCallback(
    async (rec: Recognised) => {
      if (!token) return;
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: rec.vendor || entityLabel,
          vendorName: rec.vendor || entityLabel,
          amount: rec.amount ?? 0,
          // A scanned receipt is a one-off purchase. The Frequency enum has no
          // ONE_OFF, so ANNUAL is the least-distorting default (MONTHLY would
          // 12× the amount in cashflow). True one-off support is a follow-up.
          frequency: 'ANNUAL',
          category: 'OTHER',
          sourceType: 'GENERAL',
          dedupeReceipt: true,
          ...(entityType === LinkedEntityType.ASSET ? { assetId: entityId } : {}),
          ...(entityType === LinkedEntityType.PROPERTY ? { propertyId: entityId } : {}),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || `Could not add expense (${res.status})`);
      }
      const created = (await res.json().catch(() => ({}))) as { id?: string; duplicate?: boolean };

      // Link the document to the (created or existing) expense. Best-effort.
      if (created?.id && rec.documentId) {
        try {
          await fetch(`/api/documents/${rec.documentId}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ entityType: 'EXPENSE', entityId: created.id }),
          });
        } catch {
          /* non-fatal */
        }
      }
      setAddNotice(
        created?.duplicate
          ? 'That expense already exists — linked this receipt to it (no duplicate created).'
          : `Added "${rec.vendor || entityLabel}" as an expense for ${entityLabel}.`,
      );
    },
    [token, entityType, entityId, entityLabel],
  );

  const addExpenseFromRecognised = useCallback(async () => {
    if (!token || !recognised) return;
    setAddingExpense(true);
    setError(null);
    try {
      await createExpenseFrom(recognised);
      setRecognised(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add expense');
    } finally {
      setAddingExpense(false);
    }
  }, [token, recognised, createExpenseFrom]);

  // Per-document "$ Add as expense" — works at any time by reading the document's
  // saved analysis (DocumentAnalysis), so it survives leaving the post-upload
  // banner. Only offered on assets/properties (canAddExpense).
  const handleAddExpenseForDoc = useCallback(
    async (docId: string) => {
      if (!token) return;
      setError(null);
      try {
        const res = await fetch(`/api/documents/analyze?documentId=${encodeURIComponent(docId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => ({}))) as {
          analysis?: { extractedData?: Record<string, unknown> } | null;
        };
        const ed = json?.analysis?.extractedData;
        if (!ed) {
          setError("We couldn't read this document's details — open it and add the expense manually.");
          return;
        }
        await createExpenseFrom({
          documentId: docId,
          vendor: (pickField(ed, ['vendor', 'vendorName', 'merchant', 'payee', 'name']) as string) || undefined,
          amount: asNumber(pickField(ed, ['amount', 'total', 'totalAmount', 'amountDue'])),
          date: (pickField(ed, ['date', 'issueDate', 'transactionDate']) as string) || undefined,
        });
        await fetchDocs();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add expense');
      }
    },
    [token, createExpenseFrom, fetchDocs],
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

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      if (!token) return;
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'rename', name: newName }),
      });
      if (res.ok) {
        setDocuments((docs) =>
          docs.map((d) => (d.id === id ? { ...d, originalFilename: newName } : d)),
        );
      }
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

      {/* Upload controls — store+link; runs AI recognition when analyzeOnUpload */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files ? Array.from(e.target.files) : [])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files ? Array.from(e.target.files) : [])}
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
          {uploading ? (analyzeOnUpload ? 'Reading…' : 'Uploading…') : 'Upload document'}
        </Button>
        <Button
          variant="outline"
          // Touch devices: the native camera input is the best UX. Desktop (and
          // anything non-touch): open the in-browser webcam capture dialog.
          onClick={() => (isTouch ? cameraInputRef.current?.click() : setCameraOpen(true))}
          disabled={uploading}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
      </div>

      {/* AI-recognised receipt — shown after an analyzed upload. */}
      {recognised && (
        <div className="mb-4 rounded-[14px] border border-sky-400/25 bg-sky-500/[0.06] p-3.5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                AI recognised this
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setRecognised(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {recognised.vendor && (
              <span className="text-[15px] font-semibold text-foreground">{recognised.vendor}</span>
            )}
            {recognised.amount != null && (
              <span className="text-[15px] font-semibold tabular-nums text-foreground">
                {formatCurrency(recognised.amount, { showCents: true })}
              </span>
            )}
            {recognised.date && (
              <span className="text-[12px] text-muted-foreground">{recognised.date}</span>
            )}
          </div>
          {canAddExpense && (
            <Button
              onClick={addExpenseFromRecognised}
              disabled={addingExpense}
              size="sm"
              className="mt-3 gap-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white"
            >
              {addingExpense ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add as expense for {entityLabel}
            </Button>
          )}
        </div>
      )}

      {addNotice && (
        <p className="mb-3 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-sm text-sky-700 dark:text-sky-300">
          {addNotice}
        </p>
      )}

      {error && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <DocumentList
        documents={documents}
        onView={handleView}
        onDelete={handleDelete}
        onRename={handleRename}
        onAddExpense={canAddExpense ? handleAddExpenseForDoc : undefined}
        loading={loading}
        emptyMessage={`No documents yet — upload a receipt, statement or contract for ${entityLabel}.`}
      />

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => uploadFiles([file])}
      />
    </section>
  );
}
