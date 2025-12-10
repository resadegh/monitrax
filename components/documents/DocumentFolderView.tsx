'use client';

/**
 * DocumentFolderView Component
 * Displays documents in a grid/folder view with icons
 */

import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface DocumentItem {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  description: string | null;
  uploadedAt: string;
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

export function DocumentFolderView({
  documents,
  subFolders = [],
  onView,
  onDelete,
  onNavigateFolder,
  loading = false,
  viewMode = 'grid',
}: DocumentFolderViewProps) {
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', color)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={loadingId === doc.id}
                    >
                      <MoreVertical className="h-4 w-4" />
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

          return (
            <div
              key={doc.id}
              className="relative flex flex-col items-center p-4 rounded-lg hover:bg-muted transition-colors group"
            >
              <button
                onClick={() => handleView(doc)}
                className="flex flex-col items-center w-full"
                disabled={loadingId === doc.id}
              >
                <Icon
                  className={cn(
                    'h-12 w-12 mb-2 group-hover:scale-110 transition-transform',
                    color,
                    loadingId === doc.id && 'animate-pulse'
                  )}
                />
                <p className="text-sm font-medium text-center truncate w-full">
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
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
