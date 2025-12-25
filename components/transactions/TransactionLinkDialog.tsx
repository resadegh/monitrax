'use client';

/**
 * Transaction Link Dialog
 * Allows linking transactions to existing Income/Expense entries
 * or creating new ones from transactions
 */

import { useState, useEffect } from 'react';
import { Link2, Plus, RefreshCw, X, Check, AlertTriangle, Loader2, Home, Landmark, Briefcase, DollarSign, Package, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_TYPES,
  INCOME_TYPE_LABELS,
} from '@/lib/categories/unified';
import { CategorySelect } from '@/components/categories/CategorySelect';

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchantStandardised?: string | null;
  amount: number;
  direction: 'IN' | 'OUT';
  categoryLevel1?: string | null;
  isRecurring?: boolean;
}

interface MatchResult {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'loan';
  category: string;
  amount: number;
  frequency: string;
  confidence: number;
  amountMatch: boolean;
  amountDiff: number;
}

interface SameVendorTransaction {
  id: string;
  date: string;
  description: string;
  merchantStandardised?: string | null;
  amount: number;
  direction: 'IN' | 'OUT';
}

interface CurrentLink {
  type: 'income' | 'expense' | 'loan' | 'transfer';
  id: string;
  name: string;
}

interface TransactionLinkDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => Promise<void> | void; // Returns Promise to wait for refresh before navigation
  onNavigateNext?: () => void; // Called to navigate to next uncategorized transaction
  hasMoreTransactions?: boolean; // Whether there are more uncategorized transactions
}

export function TransactionLinkDialog({
  transaction,
  open,
  onOpenChange,
  onLinked,
  onNavigateNext,
  hasMoreTransactions = false,
}: TransactionLinkDialogProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentLink, setCurrentLink] = useState<CurrentLink | null>(null);
  const [suggestedMatches, setSuggestedMatches] = useState<MatchResult[]>([]);
  const [availableIncome, setAvailableIncome] = useState<Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    frequency: string;
  }>>([]);
  const [availableExpenses, setAvailableExpenses] = useState<Array<{
    id: string;
    name: string;
    vendorName?: string | null;
    category: string;
    amount: number;
    frequency: string;
  }>>([]);
  const [availableLoans, setAvailableLoans] = useState<Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
    minRepayment: number;
    repaymentFrequency: string;
  }>>([]);

  // Source linking data
  const [properties, setProperties] = useState<Array<{
    id: string;
    name: string;
    type: string;
  }>>([]);
  const [sourceLoansList, setSourceLoansList] = useState<Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
  }>>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<Array<{
    id: string;
    name: string;
    type: string;
    platform: string | null;
  }>>([]);
  const [assets, setAssets] = useState<Array<{
    id: string;
    name: string;
    type: string;
  }>>([]);

  // Bank accounts for transfer targeting
  const [bankAccounts, setBankAccounts] = useState<Array<{
    id: string;
    name: string;
    type: string;
  }>>([]);

  // Same-vendor transactions for batch categorization
  const [sameVendorTransactions, setSameVendorTransactions] = useState<SameVendorTransaction[]>([]);
  const [selectedVendorTransactions, setSelectedVendorTransactions] = useState<Set<string>>(new Set());
  const [learnedCategory, setLearnedCategory] = useState<string | null>(null);
  const [learnMerchant, setLearnMerchant] = useState(true); // Default to learning

  // Create new form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false); // Track if category is custom
  const [newFrequency, setNewFrequency] = useState('MONTHLY');
  const [sourceType, setSourceType] = useState<'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET'>('GENERAL');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedInvestmentAccountId, setSelectedInvestmentAccountId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isEssential, setIsEssential] = useState(true);
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [isRecurringExpense, setIsRecurringExpense] = useState(false);

  // Transfer state
  const [isTransfer, setIsTransfer] = useState(false);
  const [transferToAccountId, setTransferToAccountId] = useState<string | null>(null);

  // Link options
  const [updateAmountOnLink, setUpdateAmountOnLink] = useState(false);

  // Load matches when dialog opens
  useEffect(() => {
    if (open && transaction) {
      loadMatches();
      loadBankAccounts();
      setNewName(transaction.merchantStandardised || transaction.description);
      setNewCategory('');
      setIsCustomCategory(false);
      setNewFrequency('MONTHLY');
      setSourceType('GENERAL');
      setSelectedPropertyId(null);
      setSelectedLoanId(null);
      setSelectedInvestmentAccountId(null);
      setSelectedAssetId(null);
      setIsEssential(true);
      setIsTaxDeductible(false);
      setIsRecurringExpense(false);
      setIsTransfer(false);
      setTransferToAccountId(null);
      setUpdateAmountOnLink(false);
      setSameVendorTransactions([]);
      setSelectedVendorTransactions(new Set());
      setLearnedCategory(null);
      setLearnMerchant(true);
      setSuccess(null);
      setError(null);
    }
  }, [open, transaction]);

  // Load bank accounts for transfer targeting
  const loadBankAccounts = async () => {
    try {
      const response = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        // API returns { data: [...accounts], _meta: {...} }
        setBankAccounts(data.data || []);
      }
    } catch {
      // Silently fail - bank accounts are optional
    }
  };

  const loadMatches = async () => {
    if (!transaction) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCurrentLink(data.currentLink);
      setSuggestedMatches(data.suggestedMatches || []);
      setAvailableIncome(data.availableEntries?.income || []);
      setAvailableExpenses(data.availableEntries?.expenses || []);
      setAvailableLoans(data.availableEntries?.loans || []);
      // Load source linking data
      setProperties(data.availableSources?.properties || []);
      setSourceLoansList(data.availableSources?.loans || []);
      setInvestmentAccounts(data.availableSources?.investmentAccounts || []);
      setAssets(data.availableSources?.assets || []);
      // Pre-fill category from transaction prediction or learned mapping if available
      if (data.suggestedCategory && !isIncome) {
        setNewCategory(data.suggestedCategory);
      }
      // Load same-vendor transactions for batch categorization
      setSameVendorTransactions(data.sameVendorTransactions || []);
      // Pre-select all same-vendor transactions by default
      if (data.sameVendorTransactions && data.sameVendorTransactions.length > 0) {
        setSelectedVendorTransactions(new Set(data.sameVendorTransactions.map((t: SameVendorTransaction) => t.id)));
      }
      // Store learned category for display
      setLearnedCategory(data.learnedCategory || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (targetId: string, type: 'income' | 'expense' | 'loan', shouldUpdateAmount: boolean = false) => {
    if (!transaction) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'link',
          type,
          targetId,
          updateAmount: shouldUpdateAmount,
          additionalTransactionIds: Array.from(selectedVendorTransactions),
          learnMerchant,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(data.message || `Linked to ${type}`);
      setCurrentLink({ type, id: targetId, name: data.message });

      // Wait for refresh to complete before navigating
      await onLinked?.();

      // Auto-navigate to next transaction after a brief delay to show success
      setTimeout(() => {
        if (hasMoreTransactions && onNavigateNext) {
          onNavigateNext();
        } else {
          onOpenChange(false);
        }
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAmount = async (targetId: string, type: 'income' | 'expense' | 'loan') => {
    if (!transaction) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'update', type, targetId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(data.message);
      onLinked?.();
      loadMatches(); // Refresh to show updated amounts
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!transaction || !newName || (!newCategory && !isTransfer)) return;
    setSaving(true);
    setError(null);

    // Handle transfer transactions
    if (isTransfer) {
      try {
        const response = await fetch(`/api/transactions/${transaction.id}/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'transfer',
            transferToAccountId,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setSuccess(data.message || 'Marked as transfer');

        // Wait for refresh to complete before navigating
        await onLinked?.();

        // Auto-navigate to next transaction after a brief delay to show success
        setTimeout(() => {
          if (hasMoreTransactions && onNavigateNext) {
            onNavigateNext();
          } else {
            onOpenChange(false);
          }
        }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark as transfer');
      } finally {
        setSaving(false);
      }
      return;
    }

    const type = transaction.direction === 'IN' ? 'income' : 'expense';

    try {
      // Build request body with source type and entity linking
      const requestBody: Record<string, unknown> = {
        action: 'create',
        type,
        name: newName,
        // Use customCategoryId for custom categories, category for system categories
        ...(isCustomCategory
          ? { customCategoryId: newCategory, category: 'OTHER' }
          : { category: newCategory }),
        frequency: isRecurringExpense ? newFrequency : 'MONTHLY', // Default frequency for non-recurring
        isRecurring: isRecurringExpense,
        additionalTransactionIds: Array.from(selectedVendorTransactions),
        learnMerchant,
      };

      // Add source type and entity linking for expenses
      if (type === 'expense') {
        requestBody.sourceType = sourceType;
        if (sourceType === 'PROPERTY' && selectedPropertyId) {
          requestBody.propertyId = selectedPropertyId;
        } else if (sourceType === 'LOAN' && selectedLoanId) {
          requestBody.loanId = selectedLoanId;
        } else if (sourceType === 'INVESTMENT' && selectedInvestmentAccountId) {
          requestBody.investmentAccountId = selectedInvestmentAccountId;
        } else if (sourceType === 'ASSET' && selectedAssetId) {
          requestBody.assetId = selectedAssetId;
        }
        requestBody.isEssential = isEssential;
        requestBody.isTaxDeductible = isTaxDeductible;
      }

      // Add source type and entity linking for income
      if (type === 'income') {
        const incomeSourceType = sourceType === 'LOAN' ? 'GENERAL' : sourceType;
        requestBody.incomeSourceType = incomeSourceType;
        if (incomeSourceType === 'PROPERTY' && selectedPropertyId) {
          requestBody.propertyId = selectedPropertyId;
        } else if (incomeSourceType === 'INVESTMENT' && selectedInvestmentAccountId) {
          requestBody.investmentAccountId = selectedInvestmentAccountId;
        }
      }

      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(data.message);

      // Wait for refresh to complete before navigating
      await onLinked?.();

      // Auto-navigate to next transaction after a brief delay to show success
      setTimeout(() => {
        if (hasMoreTransactions && onNavigateNext) {
          onNavigateNext();
        } else {
          onOpenChange(false);
        }
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!transaction) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'unlink' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess('Unlinked');
      setCurrentLink(null);
      onLinked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink');
    } finally {
      setSaving(false);
    }
  };

  // Toggle selection of a same-vendor transaction
  const toggleVendorTransaction = (transactionId: string) => {
    setSelectedVendorTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  // Toggle all same-vendor transactions
  const toggleAllVendorTransactions = () => {
    if (selectedVendorTransactions.size === sameVendorTransactions.length) {
      setSelectedVendorTransactions(new Set());
    } else {
      setSelectedVendorTransactions(new Set(sameVendorTransactions.map(t => t.id)));
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (!transaction) return null;

  const isIncome = transaction.direction === 'IN';
  const categoryOptions = isIncome ? INCOME_TYPES : EXPENSE_CATEGORIES;
  const categoryLabels = isIncome ? INCOME_TYPE_LABELS : EXPENSE_CATEGORY_LABELS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Transaction
          </DialogTitle>
          <DialogDescription>
            Link this transaction to an existing {isIncome ? 'income' : 'expense or loan repayment'} entry or create a new one
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">
                {transaction.merchantStandardised || transaction.description}
              </p>
              <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
              {learnedCategory && (
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Previously: {learnedCategory}
                  </Badge>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
              </p>
              <Badge variant={isIncome ? 'default' : 'secondary'}>
                {isIncome ? 'Income' : 'Expense'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Same-Vendor Transactions */}
        {sameVendorTransactions.length > 0 && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Same Vendor ({sameVendorTransactions.length} more)
                </span>
                <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
                  Batch Categorize
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleAllVendorTransactions}
                className="text-xs h-7"
              >
                {selectedVendorTransactions.size === sameVendorTransactions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="max-h-32 overflow-auto space-y-1">
              {sameVendorTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    selectedVendorTransactions.has(tx.id)
                      ? 'bg-purple-100 dark:bg-purple-900/50'
                      : 'hover:bg-purple-100/50 dark:hover:bg-purple-900/30'
                  }`}
                  onClick={() => toggleVendorTransaction(tx.id)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedVendorTransactions.has(tx.id)}
                      onCheckedChange={() => toggleVendorTransaction(tx.id)}
                    />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[180px]">
                        {tx.merchantStandardised || tx.description}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.direction === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.direction === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
            {selectedVendorTransactions.size > 0 && (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                {selectedVendorTransactions.size} transaction{selectedVendorTransactions.size > 1 ? 's' : ''} will be categorized together
              </p>
            )}
          </div>
        )}

        {/* Current Link */}
        {currentLink && (
          <div className={`p-3 rounded-lg border ${
            currentLink.type === 'transfer'
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {currentLink.type === 'transfer' ? (
                  <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                ) : (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm">
                  {currentLink.type === 'transfer' ? 'Marked as: ' : 'Linked to: '}
                  <strong>{currentLink.name}</strong>
                </span>
                <Badge variant="outline" className={
                  currentLink.type === 'transfer' ? 'border-amber-300 text-amber-700' : ''
                }>{currentLink.type}</Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnlink}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="match" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="match">
                Suggested ({suggestedMatches.length})
              </TabsTrigger>
              <TabsTrigger value="all">All Entries</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
            </TabsList>

            {/* Suggested Matches */}
            <TabsContent value="match" className="space-y-2 max-h-64 overflow-auto">
              {suggestedMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matching entries found
                </p>
              ) : (
                suggestedMatches.map((match) => (
                  <div
                    key={match.id}
                    className="p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{match.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{match.category}</Badge>
                          <span>{match.frequency}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(match.amount)}</p>
                        {!match.amountMatch && (
                          <p className="text-xs text-amber-600">
                            Diff: {formatCurrency(match.amountDiff)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLink(match.id, match.type, false)}
                        disabled={saving}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Link{selectedVendorTransactions.size > 0 && ` (${selectedVendorTransactions.size + 1})`}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleLink(match.id, match.type, true)}
                        disabled={saving}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Link & Update
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* All Entries */}
            <TabsContent value="all" className="space-y-2 max-h-64 overflow-auto">
              {isIncome ? (
                availableIncome.map((income) => {
                  const amountDiff = Math.abs(transaction.amount - income.amount);
                  const amountMatch = amountDiff < 1 || (income.amount > 0 && amountDiff / income.amount < 0.05);
                  return (
                    <div
                      key={income.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{income.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {income.type} • {income.frequency}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{formatCurrency(income.amount)}</span>
                          {!amountMatch && (
                            <p className="text-xs text-amber-600">Diff: {formatCurrency(amountDiff)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLink(income.id, 'income', false)}
                          disabled={saving}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Link Only
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleLink(income.id, 'income', true)}
                          disabled={saving}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Link & Update
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {/* Expenses */}
                  {availableExpenses.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Expenses</p>
                  )}
                  {availableExpenses.map((expense) => {
                    const amountDiff = Math.abs(transaction.amount - expense.amount);
                    const amountMatch = amountDiff < 1 || (expense.amount > 0 && amountDiff / expense.amount < 0.05);
                    return (
                      <div
                        key={expense.id}
                        className="p-3 border rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{expense.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {expense.category} • {expense.frequency}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                            {!amountMatch && (
                              <p className="text-xs text-amber-600">Diff: {formatCurrency(amountDiff)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLink(expense.id, 'expense', false)}
                            disabled={saving}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link Only
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleLink(expense.id, 'expense', true)}
                            disabled={saving}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Link & Update
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Loan Repayments */}
                  {availableLoans.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Loan Repayments</p>
                  )}
                  {availableLoans.map((loan) => {
                    const amountDiff = Math.abs(transaction.amount - loan.minRepayment);
                    const amountMatch = amountDiff < 1 || (loan.minRepayment > 0 && amountDiff / loan.minRepayment < 0.1);
                    return (
                      <div
                        key={loan.id}
                        className="p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{loan.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {loan.type} • {loan.repaymentFrequency}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">{formatCurrency(loan.minRepayment)}</span>
                            {!amountMatch && (
                              <p className="text-xs text-amber-600">Diff: {formatCurrency(amountDiff)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLink(loan.id, 'loan', false)}
                            disabled={saving}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link Only
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleLink(loan.id, 'loan', true)}
                            disabled={saving}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Link & Update
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </TabsContent>

            {/* Create New */}
            <TabsContent value="create" className="space-y-4 max-h-80 overflow-auto">
              {/* Transfer Toggle - for both income and expense transactions */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isTransfer"
                    checked={isTransfer}
                    onCheckedChange={(checked) => {
                      setIsTransfer(checked as boolean);
                      if (checked) {
                        setIsRecurringExpense(false);
                        setIsEssential(false);
                      }
                    }}
                  />
                  <Label htmlFor="isTransfer" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                    This is a transfer between accounts
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Transfers are excluded from income/expense calculations
                </p>
              </div>

              {/* Transfer Source/Target Account */}
              {isTransfer && (
                <div className="space-y-2">
                  <Label>{isIncome ? 'Transfer From Account' : 'Transfer To Account'}</Label>
                  <Select
                    value={transferToAccountId || ''}
                    onValueChange={(value) => setTransferToAccountId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isIncome ? 'Select source account' : 'Select target account'} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts
                        .filter(acc => acc.id !== transaction?.id) // Exclude current account
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft className="h-4 w-4" />
                              {account.name} ({account.type})
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isIncome
                      ? 'Select the account this money was transferred from'
                      : 'Select the account this money was transferred to'
                    }
                  </p>
                </div>
              )}

              {/* Regular categorization options - hidden when transfer is selected */}
              {!isTransfer && (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={isIncome ? 'Income name' : 'Expense name'}
                    />
                  </div>

              {/* Source Type Selection */}
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={sourceType}
                  onValueChange={(value: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET') => {
                    setSourceType(value);
                    // Clear entity selections when source type changes
                    setSelectedPropertyId(null);
                    setSelectedLoanId(null);
                    setSelectedInvestmentAccountId(null);
                    setSelectedAssetId(null);
                    // Auto-set tax deductible for property/loan expenses
                    if (!isIncome && (value === 'PROPERTY' || value === 'LOAN')) {
                      setIsTaxDeductible(true);
                    }
                    // Auto-set category for loan expenses
                    if (!isIncome && value === 'LOAN') {
                      setNewCategory('LOAN_INTEREST');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        General
                      </div>
                    </SelectItem>
                    <SelectItem value="PROPERTY">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-blue-500" />
                        Property
                      </div>
                    </SelectItem>
                    {!isIncome && (
                      <SelectItem value="LOAN">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-orange-500" />
                          Loan
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="INVESTMENT">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-purple-500" />
                        Investment
                      </div>
                    </SelectItem>
                    {!isIncome && (
                      <SelectItem value="ASSET">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-teal-500" />
                          Asset
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Property Selector */}
              {sourceType === 'PROPERTY' && (
                <div className="space-y-2">
                  <Label>Linked Property</Label>
                  <Select
                    value={selectedPropertyId || ''}
                    onValueChange={(value) => setSelectedPropertyId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.length === 0 ? (
                        <SelectItem value="" disabled>No properties available</SelectItem>
                      ) : (
                        properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4" />
                              {property.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Loan Selector (expenses only) */}
              {sourceType === 'LOAN' && !isIncome && (
                <div className="space-y-2">
                  <Label>Linked Loan</Label>
                  <Select
                    value={selectedLoanId || ''}
                    onValueChange={(value) => setSelectedLoanId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceLoansList.length === 0 ? (
                        <SelectItem value="" disabled>No loans available</SelectItem>
                      ) : (
                        sourceLoansList.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            <div className="flex items-center gap-2">
                              <Landmark className="h-4 w-4" />
                              {loan.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Investment Account Selector */}
              {sourceType === 'INVESTMENT' && (
                <div className="space-y-2">
                  <Label>Linked Investment Account</Label>
                  <Select
                    value={selectedInvestmentAccountId || ''}
                    onValueChange={(value) => setSelectedInvestmentAccountId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an investment account" />
                    </SelectTrigger>
                    <SelectContent>
                      {investmentAccounts.length === 0 ? (
                        <SelectItem value="" disabled>No investment accounts available</SelectItem>
                      ) : (
                        investmentAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4" />
                              {account.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Asset Selector (expenses only) */}
              {sourceType === 'ASSET' && !isIncome && (
                <div className="space-y-2">
                  <Label>Linked Asset</Label>
                  <Select
                    value={selectedAssetId || ''}
                    onValueChange={(value) => setSelectedAssetId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.length === 0 ? (
                        <SelectItem value="" disabled>No assets available</SelectItem>
                      ) : (
                        assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              {asset.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Category</Label>
                <CategorySelect
                  type={isIncome ? 'INCOME' : 'EXPENSE'}
                  value={newCategory}
                  onChange={(value, isCustom) => {
                    setNewCategory(value);
                    setIsCustomCategory(isCustom);
                  }}
                  placeholder="Select category"
                  allowCustom={true}
                />
              </div>

              {/* Expense-specific options */}
              {!isIncome && (
                <div className="space-y-3 border-t pt-3">
                  {/* Recurring checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isRecurringExpense"
                      checked={isRecurringExpense}
                      onCheckedChange={(checked) => setIsRecurringExpense(checked as boolean)}
                    />
                    <Label htmlFor="isRecurringExpense" className="text-sm font-normal cursor-pointer">
                      Recurring expense
                    </Label>
                  </div>
                  {isRecurringExpense && (
                    <>
                      <p className="text-xs text-muted-foreground ml-6">
                        This will create a recurring expense entry that appears in your regular expenses
                      </p>
                      <div className="space-y-2 ml-6">
                        <Label>Frequency</Label>
                        <Select value={newFrequency} onValueChange={setNewFrequency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            <SelectItem value="ANNUAL">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {/* Essential checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isEssential"
                      checked={isEssential}
                      onCheckedChange={(checked) => setIsEssential(checked as boolean)}
                    />
                    <Label htmlFor="isEssential" className="text-sm font-normal cursor-pointer">
                      Essential expense
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Essential expenses are included in minimum outgoings calculations
                  </p>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isTaxDeductible"
                      checked={isTaxDeductible}
                      onCheckedChange={(checked) => setIsTaxDeductible(checked as boolean)}
                    />
                    <Label htmlFor="isTaxDeductible" className="text-sm font-normal cursor-pointer">
                      Tax deductible
                    </Label>
                  </div>
                </div>
              )}

              {/* Merchant Learning */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="learnMerchant"
                    checked={learnMerchant}
                    onCheckedChange={(checked) => setLearnMerchant(checked as boolean)}
                  />
                  <Label htmlFor="learnMerchant" className="text-sm font-normal cursor-pointer">
                    Remember for future {transaction.merchantStandardised || 'similar'} transactions
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Future transactions from this vendor will be auto-suggested with this category
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Amount: <strong>{formatCurrency(transaction.amount)}</strong>
                </p>
              </div>

              <Button
                onClick={handleCreate}
                disabled={saving || !newName || !newCategory}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create {isIncome ? 'Income' : 'Expense'} Entry
                {selectedVendorTransactions.size > 0 && (
                  <span className="ml-1 text-xs opacity-75">
                    (+{selectedVendorTransactions.size} more)
                  </span>
                )}
              </Button>
              </>
              )}

              {/* Transfer button */}
              {isTransfer && (
                <>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Amount: <strong>{formatCurrency(transaction.amount)}</strong>
                    </p>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={saving}
                    className="w-full"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Mark as {isIncome ? 'Incoming' : 'Outgoing'} Transfer
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Status Messages */}
        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-950/50 text-red-600 rounded text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-2 bg-green-50 dark:bg-green-950/50 text-green-600 rounded text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
