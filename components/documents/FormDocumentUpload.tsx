'use client';

/**
 * Phase 26.6: Form Document Upload Component
 *
 * Allows users to attach documents to forms and auto-fill fields
 * using AI-powered document analysis.
 */

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Upload,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Camera,
  FileImage,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type FormType = 'expense' | 'income' | 'loan' | 'property';

export interface FormFieldDefinition {
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  label: string;
  options?: string[];
}

export interface FieldMapping {
  value: unknown;
  confidence: number;
  source: 'ocr' | 'ai_inference' | 'ai_generated';
  reason?: string;
}

export interface AnalyzeForFormResult {
  success: boolean;
  documentId?: string;
  storageUrl?: string;
  fieldMappings?: Record<string, FieldMapping>;
  lowConfidenceFields?: string[];
  documentType?: string;
  rawText?: string;
  error?: string;
}

export interface FormDocumentUploadProps {
  formType: FormType;
  formFields?: Record<string, FormFieldDefinition>;
  onFieldsExtracted: (mappings: Record<string, FieldMapping>) => void;
  onDocumentAttached?: (documentId: string) => void;
  onError?: (error: string) => void;
  propertyId?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function FormDocumentUpload({
  formType,
  formFields,
  onFieldsExtracted,
  onDocumentAttached,
  onError,
  propertyId,
  disabled = false,
  className,
  compact = false,
}: FormDocumentUploadProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'analyzing' | 'done' | 'error'>('idle');
  const [attachedDocument, setAttachedDocument] = useState<{
    id: string;
    name: string;
    type: string;
  } | null>(null);
  const [extractedFieldsCount, setExtractedFieldsCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    console.log('[FormDocumentUpload] handleFileSelect called', { fileName: file.name, fileType: file.type, fileSize: file.size });

    if (!token) {
      console.log('[FormDocumentUpload] No token available');
      setErrorMessage('Not authenticated');
      onError?.('Not authenticated');
      return;
    }

    // Validate file type
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!supportedTypes.includes(file.type)) {
      console.log('[FormDocumentUpload] Invalid file type:', file.type);
      const error = 'Please upload a PDF or image file (JPEG, PNG, GIF, WebP)';
      setErrorMessage(error);
      onError?.(error);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      const error = 'File too large. Maximum size is 10MB.';
      setErrorMessage(error);
      onError?.(error);
      return;
    }

    setIsUploading(true);
    setUploadProgress('uploading');
    setErrorMessage(null);

    try {
      // Build form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('formType', formType);
      if (formFields) {
        formData.append('formFields', JSON.stringify(formFields));
      }
      if (propertyId) {
        formData.append('propertyId', propertyId);
      }

      setUploadProgress('analyzing');

      // Call the API
      const response = await fetch('/api/documents/analyze-for-form', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result: AnalyzeForFormResult = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Store attached document info
      if (result.documentId) {
        setAttachedDocument({
          id: result.documentId,
          name: file.name,
          type: result.documentType || 'UNKNOWN',
        });
        onDocumentAttached?.(result.documentId);
      }

      // Pass field mappings to parent
      if (result.fieldMappings) {
        const fieldsCount = Object.keys(result.fieldMappings).length;
        setExtractedFieldsCount(fieldsCount);
        onFieldsExtracted(result.fieldMappings);
      }

      setUploadProgress('done');

      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress('idle');
      }, 3000);
    } catch (error) {
      console.error('[FormDocumentUpload] Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to analyze document';
      setErrorMessage(message);
      setUploadProgress('error');
      onError?.(message);

      // Reset after delay
      setTimeout(() => {
        setUploadProgress('idle');
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  }, [token, formType, formFields, propertyId, onFieldsExtracted, onDocumentAttached, onError]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[FormDocumentUpload] handleInputChange triggered');
    const file = event.target.files?.[0];
    if (file) {
      console.log('[FormDocumentUpload] File selected via input:', file.name);
      handleFileSelect(file);
    } else {
      console.log('[FormDocumentUpload] No file in input event');
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    console.log('[FormDocumentUpload] handleDrop triggered');
    const file = event.dataTransfer.files?.[0];
    if (file) {
      console.log('[FormDocumentUpload] File dropped:', file.name);
      handleFileSelect(file);
    } else {
      console.log('[FormDocumentUpload] No file in drop event');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const removeDocument = () => {
    setAttachedDocument(null);
    setExtractedFieldsCount(0);
    setErrorMessage(null);
    setUploadProgress('idle');
  };

  // Compact version for inline use
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {attachedDocument ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium truncate max-w-[150px]">
              {attachedDocument.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {extractedFieldsCount} fields
            </Badge>
            <button
              onClick={removeDocument}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Scan Document
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload a receipt or invoice to auto-fill the form</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Full version with drop zone
  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {attachedDocument ? (
        // Document attached state
        <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium truncate max-w-[200px]">
                {attachedDocument.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">
                  {attachedDocument.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {extractedFieldsCount} fields extracted
                </span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeDocument}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Upload drop zone
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
            'hover:border-primary/50 hover:bg-primary/5',
            isUploading && 'pointer-events-none opacity-70',
            errorMessage && 'border-destructive/50 bg-destructive/5',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {uploadProgress === 'uploading' && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading document...</p>
            </div>
          )}

          {uploadProgress === 'analyzing' && (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <Badge variant="outline" className="gap-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
                <Sparkles className="h-3 w-3" />
                Powered by Gemini AI
              </Badge>
              <p className="text-sm text-muted-foreground">Analyzing document...</p>
              <p className="text-xs text-muted-foreground">Extracting form fields</p>
            </div>
          )}

          {uploadProgress === 'done' && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-600">
                {extractedFieldsCount} fields extracted!
              </p>
            </div>
          )}

          {uploadProgress === 'error' && (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <p className="text-xs text-muted-foreground">Click to try again</p>
            </div>
          )}

          {uploadProgress === 'idle' && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <FileImage className="h-6 w-6 text-muted-foreground" />
                <Camera className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  <Sparkles className="inline h-4 w-4 mr-1 text-primary" />
                  Attach document to auto-fill
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drop a receipt, invoice, or statement here
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="mt-2">
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                <Sparkles className="h-2.5 w-2.5" />
                Powered by Gemini AI
              </span>
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      {!attachedDocument && uploadProgress === 'idle' && (
        <p className="text-xs text-muted-foreground text-center">
          Supports PDF, JPEG, PNG, GIF, WebP (max 10MB)
        </p>
      )}
    </div>
  );
}

export default FormDocumentUpload;
