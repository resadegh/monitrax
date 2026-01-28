'use client';

/**
 * Phase 29: Transaction Import Dialog
 * Upload QIF/CSV files with AI-powered categorisation
 * Supports both:
 * - Importing to existing account (accountId provided)
 * - Creating new account from import (no accountId)
 */

import { useState, useRef, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Plus,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface Account {
  id: string;
  name: string;
  type: string;
  institution?: string;
}

interface TransactionImportDialogProps {
  // If provided, import to this account directly
  accountId?: string;
  accountName?: string;
  // List of existing accounts for selection (when accountId not provided)
  accounts?: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (batchId: string, accountId: string, needsReview: boolean) => void;
  onAccountCreated?: (account: Account) => void;
}

type ImportStep = 'select-account' | 'upload' | 'processing' | 'complete' | 'error';
type AccountMode = 'existing' | 'new';

interface ImportResult {
  batchId: string;
  accountId: string;
  accountName?: string;
  accountCreated?: boolean;
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

const ACCOUNT_TYPES = [
  { value: 'TRANSACTIONAL', label: 'Transaction Account' },
  { value: 'SAVINGS', label: 'Savings Account' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'OFFSET', label: 'Offset Account' },
];

export function TransactionImportDialog({
  accountId: initialAccountId,
  accountName: initialAccountName,
  accounts = [],
  open,
  onOpenChange,
  onImportComplete,
  onAccountCreated,
}: TransactionImportDialogProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine initial step based on whether accountId is provided
  const getInitialStep = (): ImportStep => {
    return initialAccountId ? 'upload' : 'select-account';
  };

  const [step, setStep] = useState<ImportStep>(getInitialStep());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Account selection state
  const [accountMode, setAccountMode] = useState<AccountMode>('new');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || '');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('TRANSACTIONAL');
  const [newAccountInstitution, setNewAccountInstitution] = useState('');

  // Reset step when dialog opens/closes or accountId changes
  useEffect(() => {
    if (open) {
      setStep(getInitialStep());
      setSelectedAccountId(initialAccountId || '');
      if (initialAccountId) {
        setAccountMode('existing');
      }
    }
  }, [open, initialAccountId]);

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

      // Auto-populate account name from file name if creating new account
      if (accountMode === 'new' && !newAccountName) {
        const nameFromFile = file.name.replace(/\.(qif|csv)$/i, '').replace(/[_-]/g, ' ');
        setNewAccountName(nameFromFile);
      }
    }
  };

  const handleContinueToUpload = () => {
    if (accountMode === 'existing' && !selectedAccountId) {
      setError('Please select an account');
      return;
    }
    if (accountMode === 'new' && !newAccountName.trim()) {
      setError('Please enter an account name');
      return;
    }
    setError(null);
    setStep('upload');
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setStep('processing');
    setProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // If creating new account, add account details
      if (accountMode === 'new') {
        formData.append('createAccount', 'true');
        formData.append('accountName', newAccountName.trim());
        formData.append('accountType', newAccountType);
        if (newAccountInstitution.trim()) {
          formData.append('accountInstitution', newAccountInstitution.trim());
        }
      }

      setProgress(30);

      // Use selected account ID or 'new' for account creation
      const targetAccountId = accountMode === 'existing' ? selectedAccountId : 'new';
      const response = await fetch(`/api/accounts/${targetAccountId}/import`, {
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

      // Notify parent if account was created
      if (data.data.accountCreated && onAccountCreated) {
        onAccountCreated({
          id: data.data.accountId,
          name: data.data.accountName || newAccountName,
          type: newAccountType,
          institution: newAccountInstitution || undefined,
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    // Reset state
    setStep(getInitialStep());
    setSelectedFile(null);
    setProgress(0);
    setError(null);
    setResult(null);
    setAccountMode(initialAccountId ? 'existing' : 'new');
    setSelectedAccountId(initialAccountId || '');
    setNewAccountName('');
    setNewAccountType('TRANSACTIONAL');
    setNewAccountInstitution('');
    onOpenChange(false);
  };

  const handleReviewTransactions = () => {
    if (result && onImportComplete) {
      onImportComplete(result.batchId, result.accountId, result.statistics.needsReview > 0);
    }
    handleClose();
  };

  const handleDone = () => {
    if (result && onImportComplete) {
      onImportComplete(result.batchId, result.accountId, false);
    }
    handleClose();
  };

  const getDialogDescription = () => {
    if (initialAccountId && initialAccountName) {
      return `Import transactions to ${initialAccountName} from a QIF or CSV file`;
    }
    return 'Import transactions from a QIF or CSV file';
  };

  const getSelectedAccountName = () => {
    if (initialAccountName) return initialAccountName;
    if (accountMode === 'new') return newAccountName || 'New Account';
    const account = accounts.find(a => a.id === selectedAccountId);
    return account?.name || 'Selected Account';
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
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select/Create Account (only if no accountId provided) */}
        {step === 'select-account' && (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              {/* New Account Option */}
              <div
                className={cn(
                  "flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  accountMode === 'new'
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() => setAccountMode('new')}
              >
                <div className={cn(
                  "mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                  accountMode === 'new' ? "border-primary" : "border-muted-foreground"
                )}>
                  {accountMode === 'new' && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Plus className="h-4 w-4" />
                    Create New Account
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create a new account from the imported file
                  </p>
                </div>
              </div>

              {/* Existing Account Option */}
              {accounts.length > 0 && (
                <div
                  className={cn(
                    "flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors",
                    accountMode === 'existing'
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => setAccountMode('existing')}
                >
                  <div className={cn(
                    "mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                    accountMode === 'existing' ? "border-primary" : "border-muted-foreground"
                  )}>
                    {accountMode === 'existing' && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <Wallet className="h-4 w-4" />
                      Import to Existing Account
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Add transactions to an existing account
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* New Account Form */}
            {accountMode === 'new' && (
              <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                <div>
                  <Label htmlFor="accountName">Account Name *</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., ANZ Everyday"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select value={newAccountType} onValueChange={setNewAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="institution">Institution (optional)</Label>
                  <Input
                    id="institution"
                    placeholder="e.g., ANZ, CBA, Westpac"
                    value={newAccountInstitution}
                    onChange={(e) => setNewAccountInstitution(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Existing Account Selection */}
            {accountMode === 'existing' && accounts.length > 0 && (
              <div className="pl-6 border-l-2 border-primary/20">
                <Label>Select Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.institution && `(${account.institution})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleContinueToUpload}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload File */}
        {step === 'upload' && (
          <div className="space-y-4 pt-4">
            {/* Show selected account */}
            {!initialAccountId && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                <Wallet className="h-4 w-4" />
                <span>
                  {accountMode === 'new' ? 'Creating:' : 'Importing to:'}{' '}
                  <strong>{getSelectedAccountName()}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs"
                  onClick={() => setStep('select-account')}
                >
                  Change
                </Button>
              </div>
            )}

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

        {/* Step 3: Processing */}
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

        {/* Step 4: Complete */}
        {step === 'complete' && result && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-medium">Import Complete!</p>
              {result.accountCreated && (
                <p className="text-sm text-muted-foreground">
                  Account "{result.accountName}" created
                </p>
              )}
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
              <Button variant="outline" onClick={handleDone}>
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

        {/* Step 5: Error */}
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
