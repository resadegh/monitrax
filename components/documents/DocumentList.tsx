'use client';

/**
 * Phase 19: Document List Component
 * Displays a list of documents with preview, metadata, and linked entity chips
 */

import { useState, useEffect } from 'react';
import {
  FileText,
  File,
  Image,
  Table,
  Download,
  Trash2,
  Pencil,
  Eye,
  ExternalLink,
  Link as LinkIcon,
  DollarSign,
  Archive,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';

interface DocumentListItem {
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
  /** Phase 50 D.5b — retention clock (advisory). Surfaced as a quiet pill. */
  retention?: {
    status: 'RETAIN' | 'ARCHIVE_SAFE' | 'NO_CLOCK';
    label: string;
    reason: string;
    retainUntil?: string;
  };
}

interface DocumentListProps {
  documents: DocumentListItem[];
  onView: (id: string) => Promise<{ signedUrl: string } | null>;
  onDelete: (id: string) => Promise<void>;
  /** Optional — when provided, a rename action appears on each document. */
  onRename?: (id: string, newName: string) => Promise<void>;
  /** Optional — when provided, the edit action opens a full edit dialog (name +
   *  category) instead of a bare rename prompt. */
  onUpdate?: (id: string, patch: { name?: string; category?: string }) => Promise<void>;
  /** Optional — when provided, a "$ Add as expense" action appears on RECEIPT /
   *  INVOICE documents (so a receipt can become an expense at any time, not only
   *  in the fleeting post-upload banner). */
  onAddExpense?: (id: string) => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
  showEntityLinks?: boolean;
}

/** Upload-source tags (UploadSource enum, `_`→`-`) — internal provenance, never
 *  shown to the user. */
const SOURCE_TAGS = new Set([
  'documents-library', 'expense-form', 'expense-dialog', 'property-form',
  'loan-form', 'income-form', 'bank-import', 'bulk-import', 'api-direct',
  'scan', 'manual', 'onboarding',
]);

/** Tags worth showing: drop the auto-generated noise that just duplicates the
 *  category badge, the linked-entity badges, or the upload source. */
function visibleTags(doc: DocumentListItem): string[] {
  const categoryTag = doc.category.toLowerCase().replace(/_/g, '-');
  const entityTags = new Set(doc.links.map((l) => l.entityType.toLowerCase().replace(/_/g, '-')));
  return doc.tags.filter(
    (t) => t !== categoryTag && !entityTags.has(t) && !SOURCE_TAGS.has(t),
  );
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contract',
  STATEMENT: 'Statement',
  RECEIPT: 'Receipt',
  TAX: 'Tax',
  PDS: 'PDS',
  VALUATION: 'Valuation',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Lease',
  INVOICE: 'Invoice',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  CONTRACT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  STATEMENT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  RECEIPT: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  TAX: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  PDS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  VALUATION: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  INSURANCE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  MORTGAGE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  LEASE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
  INVOICE: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Map a linked entity to a real dashboard route. Only PROPERTY, LOAN and
 * INVESTMENT_ACCOUNT have per-id detail pages; everything else (ASSET, EXPENSE,
 * INCOME, ACCOUNT, …) routes to its LIST page — assets in particular have NO
 * per-id route (they use a list + dialog), which is what produced the 404 when
 * the old code blindly built `/dashboard/asset/<id>`.
 */
function entityHref(entityType: LinkedEntityType, entityId: string): string {
  switch (entityType) {
    case LinkedEntityType.PROPERTY:
      return `/dashboard/properties/${entityId}`;
    case LinkedEntityType.LOAN:
      return `/dashboard/loans/${entityId}`;
    case LinkedEntityType.INVESTMENT_ACCOUNT:
      return `/dashboard/investments/accounts/${entityId}`;
    case LinkedEntityType.ASSET:
      // Assets have no per-id route — deep-link the list page to open the
      // detail dialog for this specific asset (handled in assets/page.tsx).
      return `/dashboard/assets?view=${entityId}`;
    case LinkedEntityType.EXPENSE:
      return '/dashboard/expenses';
    case LinkedEntityType.INCOME:
      return '/dashboard/income';
    case LinkedEntityType.ACCOUNT:
    case LinkedEntityType.OFFSET_ACCOUNT:
      return '/dashboard/accounts';
    case LinkedEntityType.INVESTMENT_HOLDING:
      return '/dashboard/investments';
    case LinkedEntityType.TRANSACTION:
      return '/dashboard/activity';
    default:
      return '/dashboard';
  }
}

const ENTITY_TYPE_LABELS: Record<LinkedEntityType, string> = {
  PROPERTY: 'Property',
  LOAN: 'Loan',
  EXPENSE: 'Expense',
  INCOME: 'Income',
  ACCOUNT: 'Account',
  OFFSET_ACCOUNT: 'Offset Account',
  INVESTMENT_ACCOUNT: 'Investment Account',
  INVESTMENT_HOLDING: 'Holding',
  TRANSACTION: 'Transaction',
  ASSET: 'Asset',
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return Table;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Row thumbnail — renders the actual image for image documents (a small preview
 * of the receipt/statement), falling back to the file-type icon for PDFs/other
 * or if the image can't load. The signed URL is fetched lazily via `onView`.
 */
function RowThumb({
  doc,
  onView,
}: {
  doc: DocumentListItem;
  onView: (id: string) => Promise<{ signedUrl: string } | null>;
}) {
  const isImage = doc.mimeType.startsWith('image/');
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let active = true;
    onView(doc.id)
      .then((r) => {
        if (active && r?.signedUrl) setUrl(r.signedUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [doc.id, isImage, onView]);

  if (isImage && url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived + auth-scoped; next/image can't optimise them
    return (
      <img
        src={url}
        alt={doc.originalFilename}
        className="h-12 w-12 flex-shrink-0 rounded-lg border border-foreground/10 object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  const FileIcon = getFileIcon(doc.mimeType);
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
      <FileIcon className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

export function DocumentList({
  documents,
  onView,
  onDelete,
  onRename,
  onUpdate,
  onAddExpense,
  loading = false,
  emptyMessage = 'No documents found',
  showEntityLinks = true,
}: DocumentListProps) {
  const [previewDoc, setPreviewDoc] = useState<{ url: string; doc: DocumentListItem } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState<string | null>(null);
  // Edit dialog (name + category).
  const [editDoc, setEditDoc] = useState<DocumentListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (doc: DocumentListItem) => {
    setEditName(doc.originalFilename);
    setEditCategory(doc.category);
    setEditDoc(doc);
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    setSavingEdit(true);
    try {
      const name = editName.trim();
      const patch: { name?: string; category?: string } = {};
      if (name && name !== editDoc.originalFilename) patch.name = name;
      if (editCategory !== editDoc.category) patch.category = editCategory;
      if (Object.keys(patch).length > 0) {
        if (onUpdate) await onUpdate(editDoc.id, patch);
        else if (onRename && patch.name) await onRename(editDoc.id, patch.name);
      }
      setEditDoc(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddExpense = async (id: string) => {
    if (!onAddExpense) return;
    setAddingExpense(id);
    try {
      await onAddExpense(id);
    } finally {
      setAddingExpense(null);
    }
  };

  const handleRename = async (doc: DocumentListItem) => {
    if (!onRename) return;
    const next = window.prompt('Rename document', doc.originalFilename);
    const trimmed = next?.trim();
    if (!trimmed || trimmed === doc.originalFilename) return;
    setRenaming(doc.id);
    try {
      await onRename(doc.id, trimmed);
    } finally {
      setRenaming(null);
    }
  };

  const handleView = async (doc: DocumentListItem) => {
    const result = await onView(doc.id);
    if (result?.signedUrl) {
      setPreviewDoc({ url: result.signedUrl, doc });
    }
  };

  const handleDownload = async (doc: DocumentListItem) => {
    const result = await onView(doc.id);
    if (result?.signedUrl) {
      // Open in new tab for download
      window.open(result.signedUrl, '_blank');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => {
          return (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail (real image preview for image docs, icon otherwise) */}
                  <RowThumb doc={doc} onView={onView} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Filename gets its OWN full-width line so it isn't squeezed
                        to a single character by the action buttons on mobile. */}
                    <p className="font-medium truncate" title={doc.originalFilename}>
                      {doc.originalFilename}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">{formatFileSize(doc.size)}</span>
                        <span className="shrink-0">•</span>
                        <span className="truncate">{formatDate(doc.uploadedAt)}</span>
                      </div>

                      {/* Actions — compact icon buttons so they share the
                          metadata line without crowding out the filename. */}
                      <div className="flex flex-shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleView(doc)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {onAddExpense && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleAddExpense(doc.id)}
                            disabled={addingExpense === doc.id}
                            title="Add as expense"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        {(onUpdate || onRename) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => (onUpdate ? openEdit(doc) : handleRename(doc))}
                            disabled={renaming === doc.id}
                            title={onUpdate ? 'Edit' : 'Rename'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleting === doc.id}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {doc.description}
                      </p>
                    )}

                    {/* Category & Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge className={CATEGORY_COLORS[doc.category]}>
                        {CATEGORY_LABELS[doc.category]}
                      </Badge>
                      {visibleTags(doc).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {/* D.5b retention clock — only the actionable, calm cue
                          ("Safe to archive") is surfaced; RETAIN/NO_CLOCK stay
                          quiet to avoid noise. Advice only — never auto-archives. */}
                      {doc.retention?.status === 'ARCHIVE_SAFE' && (
                        <Badge
                          variant="outline"
                          title={doc.retention.reason}
                          className="text-xs gap-1 border-slate-400/40 text-slate-500 dark:text-slate-400"
                        >
                          <Archive className="h-3 w-3" />
                          {doc.retention.label}
                        </Badge>
                      )}
                    </div>

                    {/* Entity Links */}
                    {showEntityLinks && doc.links.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                        {doc.links.map((link, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-muted"
                            onClick={() => {
                              window.location.href = entityHref(link.entityType, link.entityId);
                            }}
                          >
                            {ENTITY_TYPE_LABELS[link.entityType]}
                            {link.entityName && `: ${link.entityName}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{previewDoc?.doc.originalFilename}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewDoc?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[70vh] overflow-auto">
            {previewDoc?.doc.mimeType.startsWith('image/') ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.doc.originalFilename}
                className="max-w-full h-auto"
              />
            ) : previewDoc?.doc.mimeType === 'application/pdf' ? (
              <iframe
                src={previewDoc.url}
                className="w-full h-[70vh]"
                title={previewDoc.doc.originalFilename}
              />
            ) : (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Preview not available for this file type
                </p>
                <Button
                  className="mt-4"
                  onClick={() => window.open(previewDoc?.url, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download to view
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — name + category */}
      <Dialog open={!!editDoc} onOpenChange={(open) => !open && setEditDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                {Object.values(DocumentCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDoc(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
