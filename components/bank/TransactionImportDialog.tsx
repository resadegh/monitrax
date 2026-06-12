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
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

/** Short AU date, e.g. "28 Apr 2026". */
const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Tells the user exactly what date range to export from their bank, based on
 * the last transaction already held for the target account — so they don't
 * have to remember it (Phase 21.5 R7-PR2). Advisory only; the import's
 * duplicate detection absorbs any overlap, so a little extra range is safe.
 */
function ImportDateHint({
  lastTransactionDate,
  accountName,
}: {
  lastTransactionDate: string | null;
  accountName: string;
}) {
  const today = new Date();
  let range: { from: Date; lead: string };
  if (lastTransactionDate) {
    const last = new Date(lastTransactionDate);
    const from = new Date(last.getTime() + 24 * 60 * 60 * 1000); // day after last
    range = {
      from,
      lead: `Your last ${accountName} transaction was ${fmtDate(last)}.`,
    };
  } else {
    // No history yet — suggest the last ~2 years (most banks' export limit).
    const from = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
    range = { from, lead: `${accountName} has no transactions yet.` };
  }

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-sky-700 dark:text-sky-300">
        <Calendar className="h-4 w-4 shrink-0" />
        What to download from your bank
      </div>
      <p className="mt-1 text-muted-foreground">{range.lead}</p>
      <p className="mt-1">
        Export transactions from{' '}
        <strong className="tabular-nums">{fmtDate(range.from)}</strong> to{' '}
        <strong className="tabular-nums">{fmtDate(today)}</strong> (today), then upload the file.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        A little date overlap is fine — duplicates are skipped automatically. QIF (if your bank
        offers it) imports most reliably.
      </p>
    </div>
  );
}

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

type ImportStep = 'select-account' | 'upload' | 'processing' | 'confirm-balance' | 'complete' | 'error';
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
  balanceInfo?: {
    previousBalance: number;
    netChange: number;
    calculatedBalance: number;
    fileClosingBalance: number | null;
    needsVerification: boolean;
  };
  // True when AI categorisation was unavailable/failed for this import —
  // affected transactions were held for manual categorisation instead of
  // being imported, so the completion screen must say so honestly.
  aiDegraded?: boolean;
  aiDegradedReason?: string | null;
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

  // Balance verification state
  const [verifiedBalance, setVerifiedBalance] = useState<string>('');
  const [isVerifyingBalance, setIsVerifyingBalance] = useState(false);

  // R7-PR2: last transaction date for the target existing account (drives the
  // "export from X to today" hint). undefined = unknown/loading; null = none.
  const [lastTxnDate, setLastTxnDate] = useState<string | null | undefined>(undefined);
  const targetExistingAccountId = initialAccountId || (accountMode === 'existing' ? selectedAccountId : '');

  useEffect(() => {
    if (!open || !targetExistingAccountId || !token) {
      setLastTxnDate(undefined);
      return;
    }
    let active = true;
    setLastTxnDate(undefined);
    fetch(`/api/accounts/${targetExistingAccountId}/last-transaction`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (active) setLastTxnDate(body?.data?.lastTransactionDate ?? null);
      })
      .catch(() => {
        if (active) setLastTxnDate(null);
      });
    return () => {
      active = false;
    };
  }, [open, targetExistingAccountId, token]);

  // Reset step when dialog opens/closes or accountId changes
  useEffect(() => {
    if (open) {
      setStep(getInitialStep());
      setSelectedAccountId(initialAccountId || '');
      // Pre-targeted (account row) → existing mode, skip the choice;
      // general open → reset to 'new' so a prior per-account open doesn't
      // leave the choice step stuck on 'existing'.
      setAccountMode(initialAccountId ? 'existing' : 'new');
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

      // Infrastructure errors (e.g. a 504 function timeout) return Vercel's
      // plain-text error page, not JSON — parse defensively so the user sees
      // a real message instead of "Unexpected token 'A' … is not valid JSON".
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        if (response.status === 504) {
          throw new Error(
            'The import took too long and timed out. Try splitting the file into smaller date ranges and importing each part.'
          );
        }
        throw new Error(
          `The server returned an unexpected response (HTTP ${response.status}). Please try again — if it persists, contact support.`
        );
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Import failed');
      }

      setProgress(100);
      setResult(data.data);

      // Go to balance confirmation step if balance info is available
      if (data.data.balanceInfo?.needsVerification) {
        // Pre-fill with calculated balance
        setVerifiedBalance(data.data.balanceInfo.calculatedBalance.toFixed(2));
        setStep('confirm-balance');
      } else {
        setStep('complete');
      }

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
    setVerifiedBalance('');
    setIsVerifyingBalance(false);
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

  const handleVerifyBalance = async () => {
    if (!result || !token) return;

    const balanceValue = parseFloat(verifiedBalance);
    if (isNaN(balanceValue)) {
      setError('Please enter a valid balance amount');
      return;
    }

    setIsVerifyingBalance(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${result.accountId}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verifiedBalance: balanceValue,
          batchId: result.batchId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify balance');
      }

      // Move to complete step
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify balance');
    } finally {
      setIsVerifyingBalance(false);
    }
  };

  const handleSkipVerification = () => {
    // Skip balance verification and go to complete
    setStep('complete');
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

            {/* R7-PR2: tell the user exactly what date range to export, based on
                the account's last transaction — only for existing-account imports
                (a brand-new account from a file has no prior history to gap-fill). */}
            {targetExistingAccountId && lastTxnDate !== undefined && (
              <ImportDateHint lastTransactionDate={lastTxnDate} accountName={getSelectedAccountName()} />
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

        {/* Step 4: Confirm Balance */}
        {step === 'confirm-balance' && result && result.balanceInfo && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <Wallet className="h-12 w-12 mx-auto text-primary" />
              <p className="font-medium">Verify Account Balance</p>
              <p className="text-sm text-muted-foreground">
                Please confirm your current bank balance
              </p>
            </div>

            {/* Balance Calculation Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Previous Balance</span>
                <span className="font-medium">
                  ${result.balanceInfo.previousBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Net Change ({result.statistics.imported - result.statistics.duplicatesSkipped} transactions)
                </span>
                <span className={cn(
                  "font-medium",
                  result.balanceInfo.netChange >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {result.balanceInfo.netChange >= 0 ? '+' : ''}
                  ${result.balanceInfo.netChange.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Calculated Balance</span>
                <span className="font-bold">
                  ${result.balanceInfo.calculatedBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {result.balanceInfo.fileClosingBalance !== null && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Balance from file</span>
                  <span>
                    ${result.balanceInfo.fileClosingBalance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Actual Balance Input */}
            <div className="space-y-2">
              <Label htmlFor="verifiedBalance">
                Actual Bank Balance
                <span className="text-muted-foreground font-normal ml-1">(as shown in your bank)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="verifiedBalance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={verifiedBalance}
                  onChange={(e) => setVerifiedBalance(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the current balance shown in your bank app or statement
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={handleSkipVerification}
                disabled={isVerifyingBalance}
              >
                Skip
              </Button>
              <Button
                onClick={handleVerifyBalance}
                disabled={isVerifyingBalance || !verifiedBalance}
              >
                {isVerifyingBalance ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Balance
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && result && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              {result.aiDegraded && result.statistics.imported === 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
                  <p className="font-medium">Import received — action needed</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                  <p className="font-medium">Import Complete!</p>
                </>
              )}
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
              {/* Previously hidden — when AI was down, every transaction landed
                  here and the screen claimed success with nothing imported. */}
              {result.statistics.requiresManual > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.statistics.requiresManual}</p>
                  <p className="text-sm text-muted-foreground">Needs Categorising</p>
                </div>
              )}
              {result.statistics.duplicatesSkipped > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{result.statistics.duplicatesSkipped}</p>
                  <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
                </div>
              )}
            </div>

            {result.aiDegraded && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Smart categorisation was unavailable for this import
                  {result.statistics.requiresManual > 0 &&
                    ` — ${result.statistics.requiresManual} transaction${result.statistics.requiresManual === 1 ? ' was' : 's were'} held and won't appear in your accounts yet`}
                  . Try importing the same file again shortly; duplicates are skipped automatically.
                </AlertDescription>
              </Alert>
            )}

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

        {/* Step 6: Error */}
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
