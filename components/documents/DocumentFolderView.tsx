'use client';

/**
 * DocumentFolderView Component (Phase 19 & 26)
 * Displays documents in a grid/folder view with icons and AI analysis status
 */

import { useState, useEffect } from 'react';
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
  token?: string; // Auth token for serve endpoint (fixes X-Frame-Options)
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
  token,
}: DocumentFolderViewProps) {
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; id: string; mimeType: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null); // Phase 26

  const handleView = async (doc: DocumentItem) => {
    setLoadingId(doc.id);
    const result = await onView(doc.id);
    setLoadingId(null);

    if (result?.signedUrl) {
      // For PDFs and images, show preview
      if (doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/')) {
        setPreviewDoc({ url: result.signedUrl, name: doc.originalFilename, id: doc.id, mimeType: doc.mimeType });
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
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (documents.length === 0 && subFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Folder className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">This folder is empty</p>
        <p className="text-sm text-muted-foreground/70">
          Upload documents to see them here
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <>
        <div className="divide-y">
          {/* Sub-folders first */}
          {subFolders.map((folder) => (
            <button
              key={folder.path}
              onClick={() => onNavigateFolder?.(folder.path)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <Folder className="h-5 w-5 text-yellow-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{folder.name}</p>
              </div>
              <span className="text-sm text-muted-foreground">{folder.count} items</span>
            </button>
          ))}

          {/* Documents */}
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mimeType);
            const color = getFileColor(doc.mimeType);
            const isAnalyzing = analyzingId === doc.id;
            const hasAnalysis = doc.analysis?.status === 'COMPLETED';
            const canAnalyze = !doc.analysis || doc.analysis.status === 'FAILED';

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{doc.originalFilename}</p>
                    {/* Phase 26: Analysis status badge */}
                    {getAnalysisStatusBadge(doc.analysis)}
                    {doc.analysis?.userVerified && (
                      <Badge variant="outline" className="text-xs">Verified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                    {hasAnalysis && doc.analysis && (
                      <> • {formatDocumentType(doc.analysis.documentType)}</>
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
              </div>
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
              {previewDoc && (
                previewDoc.mimeType.startsWith('image/') ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-w-full h-auto"
                  />
                ) : (
                  <DocumentPreviewFrame
                    docId={previewDoc.id}
                    token={token}
                    fallbackUrl={previewDoc.url}
                    filename={previewDoc.name}
                  />
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Grid view
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {/* Sub-folders first */}
        {subFolders.map((folder) => (
          <button
            key={folder.path}
            onClick={() => onNavigateFolder?.(folder.path)}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-muted transition-colors group"
          >
            <Folder className="h-12 w-12 text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-medium text-center truncate w-full">{folder.name}</p>
            <p className="text-xs text-muted-foreground">{folder.count} items</p>
          </button>
        ))}

        {/* Documents */}
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.mimeType);
          const color = getFileColor(doc.mimeType);
          const isAnalyzing = analyzingId === doc.id;
          const hasAnalysis = doc.analysis?.status === 'COMPLETED';
          const canAnalyze = !doc.analysis || doc.analysis.status === 'FAILED';

          return (
            <div
              key={doc.id}
              className="relative flex flex-col items-center p-4 rounded-lg hover:bg-muted transition-colors group"
            >
              <button
                onClick={() => handleView(doc)}
                className="flex flex-col items-center w-full"
                disabled={loadingId === doc.id || isAnalyzing}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      'h-12 w-12 mb-2 group-hover:scale-110 transition-transform',
                      color,
                      (loadingId === doc.id || isAnalyzing) && 'animate-pulse'
                    )}
                  />
                  {/* Phase 26: Analysis indicator */}
                  {hasAnalysis && (
                    <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                      <Sparkles className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute -bottom-1 -right-1 bg-secondary rounded-full p-0.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-center truncate w-full">
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.size)}
                  {hasAnalysis && doc.analysis && (
                    <span className="block text-primary">
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
            </div>
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
            {previewDoc && (
              previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-w-full h-auto"
                />
              ) : (
                <DocumentPreviewFrame
                  docId={previewDoc.id}
                  token={token}
                  fallbackUrl={previewDoc.url}
                  filename={previewDoc.name}
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Document Preview Frame component that fetches content via serve endpoint
 * This avoids X-Frame-Options restrictions from GCS signed URLs
 */
function DocumentPreviewFrame({
  docId,
  token,
  fallbackUrl,
  filename,
}: {
  docId: string;
  token?: string;
  fallbackUrl: string;
  filename: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchDocument = async () => {
      if (!token) {
        // No token, use fallback URL directly
        setBlobUrl(fallbackUrl);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/documents/${docId}/serve`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }

        const blob = await response.blob();
        if (mounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Document preview error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
          setLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      mounted = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [docId, token, fallbackUrl]);

  if (loading) {
    return (
      <div className="w-full h-[70vh] flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[70vh] flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.open(fallbackUrl, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl || fallbackUrl}
      className="w-full h-full border-0"
      title={filename}
    />
  );
}

export default DocumentFolderView;
