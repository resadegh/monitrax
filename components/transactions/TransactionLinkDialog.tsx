'use client';

/**
 * Transaction Link Dialog
 * Allows linking transactions to existing Income/Expense entries
 * or creating new ones from transactions
 */

import { useState, useEffect } from 'react';
import { Link2, Plus, RefreshCw, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
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

interface CurrentLink {
  type: 'income' | 'expense' | 'loan';
  id: string;
  name: string;
}

interface TransactionLinkDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

export function TransactionLinkDialog({
  transaction,
  open,
  onOpenChange,
  onLinked,
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

  // Create new form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newFrequency, setNewFrequency] = useState('MONTHLY');

  // Load matches when dialog opens
  useEffect(() => {
    if (open && transaction) {
      loadMatches();
      setNewName(transaction.merchantStandardised || transaction.description);
      setNewCategory('');
      setSuccess(null);
      setError(null);
    }
  }, [open, transaction]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (targetId: string, type: 'income' | 'expense' | 'loan') => {
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
        body: JSON.stringify({ action: 'link', type, targetId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(`Linked to ${type}`);
      setCurrentLink({ type, id: targetId, name: data.message });
      onLinked?.();
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
    if (!transaction || !newName || !newCategory) return;
    setSaving(true);
    setError(null);

    const type = transaction.direction === 'IN' ? 'income' : 'expense';

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create',
          type,
          name: newName,
          category: newCategory,
          frequency: newFrequency,
          isRecurring: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess(data.message);
      onLinked?.();
      loadMatches();
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

        {/* Current Link */}
        {currentLink && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  Linked to: <strong>{currentLink.name}</strong>
                </span>
                <Badge variant="outline">{currentLink.type}</Badge>
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLink(match.id, match.type)}
                        disabled={saving}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                      {!match.amountMatch && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateAmount(match.id, match.type)}
                          disabled={saving}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Update Amount
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* All Entries */}
            <TabsContent value="all" className="space-y-2 max-h-64 overflow-auto">
              {isIncome ? (
                availableIncome.map((income) => (
                  <div
                    key={income.id}
                    className="p-3 border rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{income.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {income.type} • {income.frequency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency(income.amount)}</span>
                      <Button
                        size="sm"
                        onClick={() => handleLink(income.id, 'income')}
                        disabled={saving}
                      >
                        Link
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {/* Expenses */}
                  {availableExpenses.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Expenses</p>
                  )}
                  {availableExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-3 border rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium">{expense.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.category} • {expense.frequency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                        <Button
                          size="sm"
                          onClick={() => handleLink(expense.id, 'expense')}
                          disabled={saving}
                        >
                          Link
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Loan Repayments */}
                  {availableLoans.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Loan Repayments</p>
                  )}
                  {availableLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-3 border rounded-lg flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/20"
                    >
                      <div>
                        <p className="font-medium">{loan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {loan.type} • {loan.repaymentFrequency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatCurrency(loan.minRepayment)}</span>
                        <Button
                          size="sm"
                          onClick={() => handleLink(loan.id, 'loan')}
                          disabled={saving}
                        >
                          Link
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* Create New */}
            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={isIncome ? 'Income name' : 'Expense name'}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryLabels[cat as keyof typeof categoryLabels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
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
              </Button>
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
