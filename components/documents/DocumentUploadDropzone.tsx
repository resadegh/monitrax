'use client';

/**
 * Phase 19: Document Upload Dropzone
 * Drag-and-drop file upload component with category selection
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, X, File, FileText, Image, Table, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentCategory, LinkedEntityType, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/documents/types';

interface DocumentUploadDropzoneProps {
  onUpload: (file: File, category: DocumentCategory, description?: string, tags?: string[]) => Promise<void>;
  links?: { entityType: LinkedEntityType; entityId: string }[];
  defaultCategory?: DocumentCategory;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  preview: string | null;
  category: DocumentCategory;
  description: string;
  tags: string;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: 'Contract',
  STATEMENT: 'Statement',
  RECEIPT: 'Receipt',
  TAX: 'Tax Document',
  PDS: 'Product Disclosure',
  VALUATION: 'Valuation',
  INSURANCE: 'Insurance',
  MORTGAGE: 'Mortgage',
  LEASE: 'Lease',
  INVOICE: 'Invoice',
  OTHER: 'Other',
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

export function DocumentUploadDropzone({
  onUpload,
  defaultCategory = 'OTHER',
  maxFiles = 5,
  className = '',
  disabled = false,
}: DocumentUploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, [disabled]);

  const validateFile = (file: File): string | null => {
    if (!SUPPORTED_MIME_TYPES.includes(file.type as typeof SUPPORTED_MIME_TYPES[number])) {
      return `Unsupported file type: ${file.type}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${formatFileSize(file.size)}. Max size is ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(newFiles);

    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: FilePreview[] = [];
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        category: defaultCategory,
        description: '',
        tags: '',
      });
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, [files.length, maxFiles, defaultCategory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [disabled, addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFile = (index: number, updates: Partial<FilePreview>) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], ...updates };
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;

    setUploading(true);
    setError(null);

    try {
      for (const filePreview of files) {
        const tags = filePreview.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        await onUpload(
          filePreview.file,
          filePreview.category,
          filePreview.description || undefined,
          tags.length > 0 ? tags : undefined
        );
      }

      // Clear files on success
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_MIME_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <Upload className={`mx-auto h-10 w-10 mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="text-sm font-medium text-foreground mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse. Max {formatFileSize(MAX_FILE_SIZE)} per file.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word, Excel, Images, CSV, TXT
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((filePreview, index) => {
            const FileIcon = getFileIcon(filePreview.file.type);

            return (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Preview/Icon */}
                    <div className="flex-shrink-0">
                      {filePreview.preview ? (
                        <img
                          src={filePreview.preview}
                          alt={filePreview.file.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                          <FileIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* File Info & Controls */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{filePreview.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(filePreview.file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Category & Description */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={filePreview.category}
                            onValueChange={(value) => updateFile(index, { category: value as DocumentCategory })}
                          >
                            <SelectTrigger className="h-8 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={filePreview.description}
                            onChange={(e) => updateFile(index, { description: e.target.value })}
                            placeholder="Optional"
                            className="h-8 mt-1"
                          />
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-2">
                        <Label className="text-xs">Tags (comma-separated)</Label>
                        <Input
                          value={filePreview.tags}
                          onChange={(e) => updateFile(index, { tags: e.target.value })}
                          placeholder="e.g. 2024, tax, important"
                          className="h-8 mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
