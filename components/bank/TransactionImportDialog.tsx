'use client';

/**
 * Phase 29: Transaction Import Dialog
 * Upload QIF/CSV files with AI-powered categorisation
 */

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface TransactionImportDialogProps {
  accountId: string;
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (batchId: string, needsReview: boolean) => void;
}

type ImportStep = 'upload' | 'processing' | 'complete' | 'error';

interface ImportResult {
  batchId: string;
  statistics: {
    total: number;
    imported: number;
    duplicatesSkipped: number;
    autoAccepted: number;
    needsReview: number;
    requiresManual: number;
  };
  duplicateInfo?: {
    count: number;
    message: string;
  };
}

export function TransactionImportDialog({
  accountId,
  accountName,
  open,
  onOpenChange,
  onImportComplete,
}: TransactionImportDialogProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['qif', 'csv'].includes(extension || '')) {
        setError('Please select a QIF or CSV file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setStep('processing');
    setProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setProgress(30);

      const response = await fetch(`/api/accounts/${accountId}/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      setProgress(70);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setProgress(100);
      setResult(data.data);
      setStep('complete');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    // Reset state
    setStep('upload');
    setSelectedFile(null);
    setProgress(0);
    setError(null);
    setResult(null);
    onOpenChange(false);
  };

  const handleReviewTransactions = () => {
    if (result && onImportComplete) {
      onImportComplete(result.batchId, result.statistics.needsReview > 0);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Transactions
          </DialogTitle>
          <DialogDescription>
            Import transactions to {accountName} from a QIF or CSV file
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 pt-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".qif,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Click to select file</p>
                  <p className="text-sm text-muted-foreground">
                    Supports QIF (MYOB, Quicken) and CSV files
                  </p>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>AI will automatically categorise your transactions</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!selectedFile}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div>
                <p className="font-medium">Processing transactions...</p>
                <p className="text-sm text-muted-foreground">
                  AI is categorising your transactions
                </p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'complete' && result && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-medium">Import Complete!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{result.statistics.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.statistics.autoAccepted}</p>
                <p className="text-sm text-muted-foreground">Auto-accepted</p>
              </div>
              {result.statistics.needsReview > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.statistics.needsReview}</p>
                  <p className="text-sm text-muted-foreground">Needs Review</p>
                </div>
              )}
              {result.statistics.duplicatesSkipped > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{result.statistics.duplicatesSkipped}</p>
                  <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
                </div>
              )}
            </div>

            {result.duplicateInfo && result.duplicateInfo.count > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.duplicateInfo.message}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
              {result.statistics.needsReview > 0 && (
                <Button onClick={handleReviewTransactions}>
                  Review Transactions
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="font-medium">Import Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('upload')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
