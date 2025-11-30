'use client';

/**
 * Phase 19: Document List Component
 * Displays a list of documents with preview, metadata, and linked entity chips
 */

import { useState } from 'react';
import {
  FileText,
  File,
  Image,
  Table,
  Download,
  Trash2,
  Eye,
  ExternalLink,
  Link as LinkIcon,
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
}

interface DocumentListProps {
  documents: DocumentListItem[];
  onView: (id: string) => Promise<{ signedUrl: string } | null>;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
  showEntityLinks?: boolean;
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

export function DocumentList({
  documents,
  onView,
  onDelete,
  loading = false,
  emptyMessage = 'No documents found',
  showEntityLinks = true,
}: DocumentListProps) {
  const [previewDoc, setPreviewDoc] = useState<{ url: string; doc: DocumentListItem } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
          const FileIcon = getFileIcon(doc.mimeType);

          return (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.originalFilename}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(doc)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleting === doc.id}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
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
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
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
                              // Navigate to entity
                              const basePath = link.entityType.toLowerCase().replace('_', '-');
                              window.location.href = `/dashboard/${basePath}/${link.entityId}`;
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
    </>
  );
}
