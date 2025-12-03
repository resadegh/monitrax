'use client';

/**
 * Phase 18: Bank Statement Import Wizard
 * Multi-step wizard for importing bank statements
 */

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Link2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface RecurringMatch {
  type: 'income' | 'expense';
  id: string;
  name: string;
  category?: string;
  amount: number;
  frequency: string;
  confidence: number;
  amountMatch: boolean;
  amountDifference?: number;
  warning?: string;
}

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
  balanceInfo?: {
    openingBalance?: number;
    closingBalance?: number;
    hasBalance: boolean;
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
    recurringMatch?: RecurringMatch | null;
  }>;
  recurringMatches?: {
    summary: {
      totalMatches: number;
      incomeMatches: number;
      expenseMatches: number;
      amountMismatches: number;
      highConfidenceMatches: number;
    };
    matches: Array<{ index: number; match: RecurringMatch }>;
  };
  availableRecurring?: {
    income: Array<{
      id: string;
      name: string;
      type: string;
      amount: number;
      frequency: string;
    }>;
    expenses: Array<{
      id: string;
      name: string;
      vendorName?: string | null;
      category: string;
      amount: number;
      frequency: string;
    }>;
  };
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
    linkedToRecurring?: number;
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
  const [updateAccountBalance, setUpdateAccountBalance] = useState<boolean>(false);
  const [autoLinkRecurring, setAutoLinkRecurring] = useState<boolean>(true);
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
      if (selectedAccount && selectedAccount !== 'none') {
        formData.append('accountId', selectedAccount);
      }
      if (preview.suggestedMappings) {
        formData.append('mappings', JSON.stringify(preview.suggestedMappings));
      }
      if (updateAccountBalance) {
        formData.append('updateAccountBalance', 'true');
      }
      if (autoLinkRecurring) {
        formData.append('autoLinkRecurring', 'true');
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

            {/* Recurring matches summary */}
            {preview.recurringMatches && preview.recurringMatches.summary.totalMatches > 0 && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Link2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <span className="font-medium">{preview.recurringMatches.summary.totalMatches} transactions</span> match your existing income/expense entries
                  {preview.recurringMatches.summary.amountMismatches > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2">
                      ({preview.recurringMatches.summary.amountMismatches} with amount differences)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Transaction preview */}
            <div>
              <h4 className="font-medium mb-2">Preview</h4>
              <div className="max-h-64 overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2 w-10">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.slice(0, 15).map((tx, i) => (
                      <tr key={i} className={`border-t ${tx.recurringMatch?.warning ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                        <td className="p-2">{formatDate(tx.date)}</td>
                        <td className="p-2">
                          <div className="truncate max-w-[200px]">
                            {tx.merchantStandardised || tx.description}
                          </div>
                          {tx.recurringMatch && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              → Matches: <span className="font-medium">{tx.recurringMatch.name}</span>
                              <Badge variant="outline" className="ml-1 text-xs py-0">
                                {tx.recurringMatch.type === 'income' ? 'Income' : 'Expense'}
                              </Badge>
                            </div>
                          )}
                          {tx.recurringMatch?.warning && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              ⚠ {tx.recurringMatch.warning}
                            </div>
                          )}
                        </td>
                        <td className={`p-2 text-right ${tx.direction === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.direction === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="p-2 text-center">
                          {tx.recurringMatch && (
                            <span
                              title={`Matches: ${tx.recurringMatch.name}\nExpected: $${tx.recurringMatch.amount} (${tx.recurringMatch.frequency})`}
                            >
                              {tx.recurringMatch.warning ? (
                                <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                              ) : (
                                <Link2 className="h-4 w-4 text-blue-500 inline" />
                              )}
                            </span>
                          )}
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
                    <SelectItem value="none">None</SelectItem>
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

              {/* Update account balance from file */}
              {selectedAccount && selectedAccount !== 'none' && preview.balanceInfo?.hasBalance && (
                <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Checkbox
                    id="updateBalance"
                    checked={updateAccountBalance}
                    onCheckedChange={(checked) => setUpdateAccountBalance(checked === true)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="updateBalance"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Update account balance from file
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Set account balance to{' '}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(preview.balanceInfo.closingBalance ?? 0)}
                      </span>
                      {' '}(closing balance from file)
                    </p>
                    {preview.balanceInfo.openingBalance !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Opening balance: {formatCurrency(preview.balanceInfo.openingBalance)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Auto-link to recurring income/expenses */}
              {preview.recurringMatches && preview.recurringMatches.summary.totalMatches > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Checkbox
                    id="autoLink"
                    checked={autoLinkRecurring}
                    onCheckedChange={(checked) => setAutoLinkRecurring(checked === true)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="autoLink"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Auto-link to recurring entries
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Automatically link{' '}
                      <span className="font-semibold text-foreground">
                        {preview.recurringMatches.summary.highConfidenceMatches}
                      </span>
                      {' '}transactions to matching Income/Expense entries
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{preview.recurringMatches.summary.incomeMatches} income matches</span>
                      <span>•</span>
                      <span>{preview.recurringMatches.summary.expenseMatches} expense matches</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={preview.statistics.validTransactions === 0}>
                {preview.alreadyImported ? 'Re-import' : 'Import'} {preview.statistics.validTransactions} Transactions
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
                  {(result.statistics?.linkedToRecurring ?? 0) > 0 && (
                    <p className="text-blue-600 dark:text-blue-400">
                      {result.statistics?.linkedToRecurring} linked to income/expense entries
                    </p>
                  )}
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
