'use client';

/**
 * Phase 18: Bank Statement Import Wizard
 * Multi-step wizard for importing bank statements
 */

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface PreviewData {
  filename: string;
  fileHash: string;
  format: string;
  alreadyImported: boolean;
  headers?: string[];
  suggestedMappings?: Record<string, string>;
  statistics: {
    totalRows: number;
    validTransactions: number;
    invalidTransactions: number;
    potentialDuplicates: number;
    totalCredit: number;
    totalDebit: number;
    netAmount: number;
  };
  dateRange?: {
    from: string;
    to: string;
  };
  preview: Array<{
    date: string;
    description: string;
    amount: number;
    direction: 'IN' | 'OUT';
    merchantStandardised?: string;
  }>;
  errors: Array<{
    rowNumber: number;
    field: string;
    message: string;
  }>;
}

interface ImportResult {
  success: boolean;
  fileId?: string;
  statistics?: {
    total: number;
    imported: number;
    duplicates: number;
    errors: number;
    categorised: number;
    uncategorised: number;
  };
  errors?: Array<{
    rowNumber: number;
    message: string;
  }>;
  error?: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface ImportWizardProps {
  accounts: Account[];
  onComplete?: () => void;
  onClose?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'settings' | 'importing' | 'complete';

export function ImportWizard({ accounts, onComplete, onClose }: ImportWizardProps) {
  const { token } = useAuth();
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [duplicatePolicy, setDuplicatePolicy] = useState<string>('REJECT');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file drop/selection
  const handleFileDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);

    let selectedFile: File | null = null;

    if ('dataTransfer' in e) {
      selectedFile = e.dataTransfer.files[0];
    } else if (e.target.files) {
      selectedFile = e.target.files[0];
    }

    if (!selectedFile) return;

    // Validate file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'ofx', 'qfx', 'qif'].includes(ext ?? '')) {
      setError('Please upload a CSV, OFX, QFX, or QIF file');
      return;
    }

    setFile(selectedFile);

    // Get preview
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/bank/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview file');
      }

      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file');
    }
  }, []);

  // Handle import
  const handleImport = async () => {
    if (!file || !preview) return;

    setStep('importing');
    setImporting(true);
    setImportProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('duplicatePolicy', duplicatePolicy);
      if (selectedAccount) {
        formData.append('accountId', selectedAccount);
      }
      if (preview.suggestedMappings) {
        formData.append('mappings', JSON.stringify(preview.suggestedMappings));
      }

      setImportProgress(30);

      const response = await fetch('/api/bank/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setImportProgress(80);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportProgress(100);
      setResult(data);
      setStep('complete');
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Import failed',
      });
      setStep('complete');
    } finally {
      setImporting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Import Bank Statement</CardTitle>
          <CardDescription>
            Upload your bank statement to import transactions
          </CardDescription>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Step: Upload */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              type="file"
              accept=".csv,.ofx,.qfx,.qif"
              onChange={handleFileDrop}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium mb-2">
                Drop your bank statement here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports CSV, OFX, QFX, and QIF files
              </p>
            </label>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">{preview.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {preview.statistics.totalRows} rows • {preview.format}
                </p>
              </div>
            </div>

            {/* Already imported warning */}
            {preview.alreadyImported && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This file has already been imported.
                </AlertDescription>
              </Alert>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-muted-foreground">Money In</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(preview.statistics.totalCredit)}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-sm text-muted-foreground">Money Out</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(preview.statistics.totalDebit)}
                </p>
              </div>
            </div>

            {/* Date range */}
            {preview.dateRange && (
              <p className="text-sm text-muted-foreground">
                Date range: {formatDate(preview.dateRange.from)} - {formatDate(preview.dateRange.to)}
              </p>
            )}

            {/* Warnings */}
            {preview.statistics.potentialDuplicates > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {preview.statistics.potentialDuplicates} potential duplicate transactions detected
                </AlertDescription>
              </Alert>
            )}

            {/* Transaction preview */}
            <div>
              <h4 className="font-medium mb-2">Preview</h4>
              <div className="max-h-48 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.slice(0, 10).map((tx, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{formatDate(tx.date)}</td>
                        <td className="p-2 truncate max-w-[200px]">
                          {tx.merchantStandardised || tx.description}
                        </td>
                        <td className={`p-2 text-right ${tx.direction === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.direction === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label>Link to Account (Optional)</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Duplicate Handling</Label>
                <Select value={duplicatePolicy} onValueChange={setDuplicatePolicy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REJECT">Skip duplicates</SelectItem>
                    <SelectItem value="MARK_DUPLICATE">Import and mark as duplicate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={preview.alreadyImported}>
                Import {preview.statistics.validTransactions} Transactions
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-lg font-medium mb-2">Importing transactions...</p>
            <Progress value={importProgress} className="w-full max-w-xs mx-auto" />
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && result && (
          <div className="py-8 text-center">
            {result.success ? (
              <>
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium mb-2">Import Complete!</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{result.statistics?.imported} transactions imported</p>
                  <p>{result.statistics?.categorised} automatically categorised</p>
                  {(result.statistics?.duplicates ?? 0) > 0 && (
                    <p>{result.statistics?.duplicates} duplicates skipped</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-lg font-medium mb-2">Import Failed</p>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </>
            )}

            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreview(null);
                  setResult(null);
                }}
              >
                Import Another
              </Button>
              <Button onClick={() => onComplete?.()}>Done</Button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
