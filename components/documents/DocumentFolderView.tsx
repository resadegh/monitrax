'use client';

/**
 * DocumentFolderView Component (Phase 19 & 26; restyled Phase 38 PR 3)
 *
 * Displays documents in a grid/folder view with icons and AI analysis
 * status. Phase 38 PR 3 (2026-05-01 evening) restyled the grid tiles +
 * list rows to match the Apple-typography hero on /dashboard/documents.
 * No behavioural changes — same callbacks, same dropdowns, same dialogs.
 * Just typography + glass surfaces + framer-motion entrances.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  ExternalLink,
  Folder,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DocumentCategory } from '@/lib/documents/types';

// Phase 26: Analysis summary
interface AnalysisSummary {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType: string;
  typeConfidence: number;
  overallConfidence: number;
  extractedData: Record<string, unknown> | null;
  suggestedActions: Array<{
    type: string;
    confidence: number;
    description: string;
  }> | null;
  userVerified: boolean;
  createdEntityType: string | null;
  createdEntityId: string | null;
}

interface DocumentItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  description: string | null;
  uploadedAt: string;
  analysis?: AnalysisSummary | null; // Phase 26
}

interface SubFolder {
  name: string;
  path: string;
  count: number;
}

interface DocumentFolderViewProps {
  documents: DocumentItem[];
  subFolders?: SubFolder[];
  onView: (id: string) => Promise<{ signedUrl: string } | null>;
  onDelete: (id: string) => Promise<void>;
  onNavigateFolder?: (path: string) => void;
  onAnalyze?: (id: string) => Promise<void>; // Phase 26
  onConfirmAnalysis?: (analysisId: string, action: string, data: Record<string, unknown>) => Promise<boolean>; // Phase 26
  loading?: boolean;
  viewMode?: 'grid' | 'list';
}

// Get icon based on MIME type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return FileSpreadsheet;
  if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType.includes('word'))
    return FileText;
  return File;
}

// Get color based on file type
function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'text-green-500';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return 'text-emerald-600';
  if (mimeType === 'application/pdf') return 'text-red-500';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'text-blue-500';
  return 'text-gray-500';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
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

// Phase 26: Get analysis status badge
function getAnalysisStatusBadge(analysis: AnalysisSummary | null | undefined) {
  if (!analysis) return null;

  const statusConfig = {
    PENDING: { icon: Clock, label: 'Pending', variant: 'secondary' as const },
    PROCESSING: { icon: Loader2, label: 'Analyzing...', variant: 'secondary' as const },
    COMPLETED: { icon: CheckCircle2, label: 'Analyzed', variant: 'default' as const },
    FAILED: { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const },
  };

  const config = statusConfig[analysis.status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="text-xs gap-1">
      <Icon className={cn('h-3 w-3', analysis.status === 'PROCESSING' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

// Phase 26: Format document type for display
function formatDocumentType(type: string): string {
  const typeLabels: Record<string, string> = {
    RECEIPT: 'Receipt',
    INVOICE: 'Invoice',
    BANK_STATEMENT: 'Bank Statement',
    UTILITY_BILL: 'Utility Bill',
    RATE_NOTICE: 'Rate Notice',
    INSURANCE_POLICY: 'Insurance',
    LOAN_STATEMENT: 'Loan Statement',
    LOAN_CONTRACT: 'Loan Contract',
    LEASE_AGREEMENT: 'Lease Agreement',
    VALUATION_REPORT: 'Valuation',
    TAX_DOCUMENT: 'Tax Document',
    UNKNOWN: 'Unknown',
  };
  return typeLabels[type] || type;
}

// Phase 38 PR 3 — design tokens lifted from Home TRAIL banner v3 +
// Phase 37/38 heroes. Zero new deps, zero new tokens.
const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function DocumentFolderView({
  documents,
  subFolders = [],
  onView,
  onDelete,
  onNavigateFolder,
  onAnalyze,
  onConfirmAnalysis,
  loading = false,
  viewMode = 'grid',
}: DocumentFolderViewProps) {
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null); // Phase 26
  const reduced = useReducedMotion();

  const handleView = async (doc: DocumentItem) => {
    setLoadingId(doc.id);
    const result = await onView(doc.id);
    setLoadingId(null);

    if (result?.signedUrl) {
      // For PDFs and images, show preview
      if (doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/')) {
        setPreviewDoc({ url: result.signedUrl, name: doc.originalFilename });
      } else {
        // For other files, open in new tab
        window.open(result.signedUrl, '_blank');
      }
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    setLoadingId(doc.id);
    const result = await onView(doc.id);
    setLoadingId(null);

    if (result?.signedUrl) {
      const link = document.createElement('a');
      link.href = result.signedUrl;
      link.download = doc.originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Phase 26: Handle analyze document
  const handleAnalyze = async (doc: DocumentItem) => {
    if (!onAnalyze) return;
    setAnalyzingId(doc.id);
    await onAnalyze(doc.id);
    setAnalyzingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  if (documents.length === 0 && subFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <Folder className="h-6 w-6" />
        </div>
        <h3 className="text-base font-medium tracking-[-0.01em] mb-1">
          This folder is empty
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Upload a receipt, statement, or contract to see it here.
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <>
        <ul className="divide-y divide-border/30">
          {/* Sub-folders first */}
          {subFolders.map((folder, idx) => (
            <motion.li
              key={folder.path}
              initial={reduced ? false : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.3, ease: appleEase, delay: idx * 0.025 }
              }
            >
              <button
                onClick={() => onNavigateFolder?.(folder.path)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium tracking-[-0.01em] truncate">
                    {folder.name}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 tabular-nums">
                  {folder.count} {folder.count === 1 ? 'item' : 'items'}
                </span>
              </button>
            </motion.li>
          ))}

          {/* Documents */}
          {documents.map((doc, idx) => {
            const Icon = getFileIcon(doc.mimeType);
            const color = getFileColor(doc.mimeType);
            const isAnalyzing = analyzingId === doc.id;
            const hasAnalysis = doc.analysis?.status === 'COMPLETED';
            const canAnalyze = !doc.analysis || doc.analysis.status === 'FAILED';

            return (
              <motion.li
                key={doc.id}
                initial={reduced ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        duration: 0.3,
                        ease: appleEase,
                        delay: (subFolders.length + idx) * 0.025,
                      }
                }
                className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60',
                    color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium tracking-[-0.01em] truncate">
                      {doc.originalFilename}
                    </p>
                    {getAnalysisStatusBadge(doc.analysis)}
                    {doc.analysis?.userVerified && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium tracking-[0.06em] border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      >
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatFileSize(doc.size)} · {formatDate(doc.uploadedAt)}
                    {hasAnalysis && doc.analysis && (
                      <> · {formatDocumentType(doc.analysis.documentType)}</>
                    )}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={loadingId === doc.id || isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(doc)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    {/* Phase 26: Analysis options */}
                    {onAnalyze && (
                      <>
                        <DropdownMenuSeparator />
                        {canAnalyze && (
                          <DropdownMenuItem onClick={() => handleAnalyze(doc)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {doc.analysis?.status === 'FAILED' ? 'Re-analyze' : 'Analyze'}
                          </DropdownMenuItem>
                        )}
                        {hasAnalysis && !doc.analysis?.userVerified && (
                          <DropdownMenuItem onClick={() => handleView(doc)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Review & Confirm
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(doc.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.li>
            );
          })}
        </ul>

        {/* Preview Dialog */}
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate">{previewDoc?.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewDoc?.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="h-[70vh] overflow-auto">
              {previewDoc?.url && (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full border-0"
                  title={previewDoc.name}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Grid view — Phase 38 PR 3 Apple-glass tiles
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Sub-folders first */}
        {subFolders.map((folder, idx) => (
          <motion.button
            key={folder.path}
            onClick={() => onNavigateFolder?.(folder.path)}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.35, ease: appleEase, delay: idx * 0.025 }
            }
            whileHover={reduced ? undefined : { y: -2 }}
            className="group flex flex-col items-center p-4 rounded-2xl border border-border/40 bg-card/40 hover:bg-card/70 backdrop-blur-md transition-colors"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-105 transition-transform">
              <Folder className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-center truncate w-full tracking-[-0.01em]">
              {folder.name}
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 tabular-nums mt-0.5">
              {folder.count} {folder.count === 1 ? 'item' : 'items'}
            </p>
          </motion.button>
        ))}

        {/* Documents */}
        {documents.map((doc, idx) => {
          const Icon = getFileIcon(doc.mimeType);
          const color = getFileColor(doc.mimeType);
          const isAnalyzing = analyzingId === doc.id;
          const hasAnalysis = doc.analysis?.status === 'COMPLETED';
          const canAnalyze = !doc.analysis || doc.analysis.status === 'FAILED';

          return (
            <motion.div
              key={doc.id}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      duration: 0.35,
                      ease: appleEase,
                      delay: (subFolders.length + idx) * 0.025,
                    }
              }
              whileHover={reduced ? undefined : { y: -2 }}
              className="group relative flex flex-col items-center p-4 rounded-2xl border border-border/40 bg-card/40 hover:bg-card/70 backdrop-blur-md transition-colors"
            >
              <button
                onClick={() => handleView(doc)}
                className="flex flex-col items-center w-full"
                disabled={loadingId === doc.id || isAnalyzing}
              >
                <div className="relative">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 mb-2 group-hover:scale-105 transition-transform',
                      color,
                      (loadingId === doc.id || isAnalyzing) && 'animate-pulse'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {/* Phase 26 — analysis indicator */}
                  {hasAnalysis && (
                    <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 shadow-sm">
                      <Sparkles className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute -bottom-1 -right-1 bg-secondary rounded-full p-0.5 shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-center truncate w-full tracking-[-0.01em]">
                  {doc.originalFilename}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {formatFileSize(doc.size)}
                  {hasAnalysis && doc.analysis && (
                    <span className="block text-primary/80 font-medium">
                      {formatDocumentType(doc.analysis.documentType)}
                    </span>
                  )}
                </p>
              </button>

              {/* Actions dropdown */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(doc)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    {/* Phase 26: Analysis options */}
                    {onAnalyze && (
                      <>
                        <DropdownMenuSeparator />
                        {canAnalyze && (
                          <DropdownMenuItem onClick={() => handleAnalyze(doc)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {doc.analysis?.status === 'FAILED' ? 'Re-analyze' : 'Analyze'}
                          </DropdownMenuItem>
                        )}
                        {hasAnalysis && !doc.analysis?.userVerified && (
                          <DropdownMenuItem onClick={() => handleView(doc)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Review & Confirm
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(doc.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{previewDoc?.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewDoc?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] overflow-auto">
            {previewDoc?.url && (
              <iframe
                src={previewDoc.url}
                className="w-full h-full border-0"
                title={previewDoc.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentFolderView;
