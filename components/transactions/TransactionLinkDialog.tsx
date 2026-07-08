'use client';

/**
 * Transaction Link Dialog
 * Allows linking transactions to existing Income/Expense entries
 * or creating new ones from transactions
 */

import { useState, useEffect } from 'react';
import { Link2, Plus, X, Check, AlertTriangle, Loader2, Home, Landmark, Briefcase, DollarSign, Package, ArrowRightLeft, TrendingUp, ChevronRight, ChevronLeft, Sparkles, Scissors } from 'lucide-react';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
import { VendorCardDrawer } from '@/components/bookkeeping/VendorCardDrawer';
import { TransactionSplitEditor } from '@/components/transactions/TransactionSplitEditor';
import { FormDocumentUpload, type FieldMapping } from '@/components/documents/FormDocumentUpload';
import { formatCurrency } from '@/lib/utils/formatters';

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
  // Budget vs Actual: Entry amount is budget, transactions provide actual
  propertyId?: string | null;
  propertyName?: string | null;
  budgetedAmount?: number | null;
  categoryMatch?: boolean;
}

interface TransactionPattern {
  count: number;
  detectedFrequency: string;
  averageAmount: number;
  averageIntervalDays: number;
  // New fields for accurate monthly calculation
  trueMonthlyAverage?: number;
  totalAmount?: number;
  sumForAverage?: number;
  monthsCovered?: number;
  paymentTiming?: 'ADVANCE' | 'ARREARS'; // ADVANCE = rent (exclude last), ARREARS = salary (include all)
  dateRange: {
    first: string;
    last: string;
  };
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
  type: 'income' | 'expense' | 'loan' | 'transfer' | 'investment';
  id: string;
  name: string;
}

// Phase 51.2 — Transaction Resolution Precedence. Structural matches surfaced
// BEFORE merchant categorisation: a txn that is really a loan repayment or an
// internal transfer, recognised against the user's own ledgers/accounts.
interface LoanRepaymentMatch {
  kind: 'LOAN_REPAYMENT';
  loanTransactionId: string;
  loanId: string;
  loanName: string;
  amount: number;
  date: string;
  interestPortion: number | null;
  confidence: number;
}
interface TransferMatch {
  kind: 'TRANSFER';
  transactionId: string;
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  confidence: number;
}
interface Resolution {
  loanRepayments: LoanRepaymentMatch[];
  transfers: TransferMatch[];
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
  // Neobrain auto-apply (2026-06-27) — when a confirm sweeps other
  // uncategorised same-merchant rows, hold the swept ids so the user can Undo.
  const [autoApplied, setAutoApplied] = useState<{ count: number; appliedIds: string[] }>({
    count: 0,
    appliedIds: [],
  });
  // Phase 42 PR 5.6 — Vendor card drawer state.
  const [showVendorDrawer, setShowVendorDrawer] = useState(false);

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

  // Phase 30: Transaction pattern for reconciliation
  const [transactionPattern, setTransactionPattern] = useState<TransactionPattern | null>(null);

  // Phase 51.2 — structural resolution (loan repayment / transfer) surfaced first.
  const [resolution, setResolution] = useState<Resolution>({ loanRepayments: [], transfers: [] });
  // Phase 51 redesign — progressive disclosure. At rest the dialog shows the
  // transaction + ONE recommended action; the full tabbed UI (All / Create /
  // Split / batch) reveals under "More options". Reset closed on each open.
  const [showMore, setShowMore] = useState(false);
  // Phase 51 redesign — within "More options", a single focused sub-view at a
  // time (slim-row menu → one section), replacing the old 4-tab wall.
  const [moreView, setMoreView] = useState<'menu' | 'match' | 'all' | 'create' | 'split'>('menu');

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

  // Investment contribution state
  const [isInvestmentContribution, setIsInvestmentContribution] = useState(false);
  const [investmentContributionAccountId, setInvestmentContributionAccountId] = useState<string | null>(null);
  const [isRecurringInvestment, setIsRecurringInvestment] = useState(false);
  const [investmentFrequency, setInvestmentFrequency] = useState('MONTHLY');

  // Document attachment (Phase 38 follow-up 2026-05-02).
  // FormDocumentUpload uploads via the canonical /api/documents/analyze-for-form
  // endpoint (Phase 25 DME-backed), which:
  //   • creates the Document row (so the receipt lands in My Vault)
  //   • runs Phase 26 OCR + Gemini analysis
  //   • returns extracted field mappings we can use to auto-fill the form
  // After the user submits the Create form and the new expense/income exists,
  // we link the document to that entity via /api/documents/[id]/link
  // (entityType: EXPENSE / INCOME). Net effect: receipt is in the Vault,
  // tagged + linked correctly, and visible from both surfaces.
  const [attachedDocumentId, setAttachedDocumentId] = useState<string | null>(null);

  // Link options removed - linking now only tags transactions (budget vs actual model)

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
      setIsInvestmentContribution(false);
      setInvestmentContributionAccountId(null);
      setIsRecurringInvestment(false);
      setInvestmentFrequency('MONTHLY');
      // Reset doc attachment per-transaction — never carry a stale doc ID
      // into the next transaction's create flow (would link the wrong receipt).
      setAttachedDocumentId(null);
      setSameVendorTransactions([]);
      setSelectedVendorTransactions(new Set());
      setLearnedCategory(null);
      setLearnMerchant(true);
      setTransactionPattern(null);
      setResolution({ loanRepayments: [], transfers: [] });
      setShowMore(false);
      setMoreView('menu');
      setSuccess(null);
      setError(null);
      setAutoApplied({ count: 0, appliedIds: [] });
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
      // Phase 30: Store transaction pattern for reconciliation
      setTransactionPattern(data.transactionPattern || null);
      // MON-025: suggest-and-confirm — pre-fill the frequency from the cadence
      // detected in the transaction dates (≥2 same-vendor payments), and
      // pre-tick "recurring". The user still confirms/overrides. This stops the
      // MONTHLY default from mislabelling an annual payment (e.g. QBE) as monthly.
      const tp = data.transactionPattern;
      if (tp?.detectedFrequency && (tp.count ?? 0) >= 2) {
        setNewFrequency(tp.detectedFrequency);
        setIsRecurringExpense(true);
      }
      // Phase 51.2: structural resolution matches (loan repayment / transfer)
      setResolution(data.resolution ?? { loanRepayments: [], transfers: [] });
      // Phase 51 redesign — start collapsed (one clear action) on every open.
      setShowMore(false);
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
        body: JSON.stringify({
          action: 'link',
          type,
          targetId,
          // updateAmount removed - linking only tags transactions (budget vs actual model)
          additionalTransactionIds: Array.from(selectedVendorTransactions),
          learnMerchant,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const sweptLink = (data.autoApplied?.count ?? 0) as number;
      setAutoApplied(data.autoApplied ?? { count: 0, appliedIds: [] });
      setSuccess(
        sweptLink > 0
          ? `${data.message || `Linked to ${type}`} · applied to ${sweptLink} similar`
          : data.message || `Linked to ${type}`
      );
      setCurrentLink({ type, id: targetId, name: data.message });

      // Wait for refresh to complete before navigating
      await onLinked?.();

      // Hold open for Undo when Neobrain swept similar rows; otherwise advance.
      if (sweptLink === 0) {
        setTimeout(() => {
          if (hasMoreTransactions && onNavigateNext) {
            onNavigateNext();
          } else {
            onOpenChange(false);
          }
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link');
    } finally {
      setSaving(false);
    }
  };


  // Phase 51.2 — confirm a resolution-surfaced loan-repayment match. Links this
  // funding transaction to the imported ledger row (isTransfer + loanId set).
  const handleLinkLoanRepayment = async (loanTransactionId: string) => {
    if (!transaction) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'linkLoanRepayment', loanTransactionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(data.message || 'Linked to loan repayment');
      await onLinked?.();
      setTimeout(() => {
        if (hasMoreTransactions && onNavigateNext) onNavigateNext();
        else onOpenChange(false);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link');
    } finally {
      setSaving(false);
    }
  };

  // Phase 51.2 — confirm a resolution-surfaced transfer match (reuses the
  // existing 'transfer' action with the matched counterpart account).
  const handleMarkTransferTo = async (accountId: string) => {
    if (!transaction) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'transfer',
          transferToAccountId: accountId,
          // Batch path (§12.2.1) — apply to all selected same-vendor rows too.
          additionalTransactionIds: Array.from(selectedVendorTransactions),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(data.message || 'Marked as transfer');
      await onLinked?.();
      setTimeout(() => {
        if (hasMoreTransactions && onNavigateNext) onNavigateNext();
        else onOpenChange(false);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as transfer');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!transaction || !newName || (!newCategory && !isTransfer && !isInvestmentContribution)) return;
    setSaving(true);
    setError(null);

    // Handle investment contribution transactions
    if (isInvestmentContribution) {
      if (!investmentContributionAccountId) {
        setError('Please select an investment account');
        setSaving(false);
        return;
      }

      try {
        const response = await fetch(`/api/transactions/${transaction.id}/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'investment',
            investmentContributionAccountId,
            investmentIsRecurring: isRecurringInvestment,
            investmentFrequency: isRecurringInvestment ? investmentFrequency : undefined,
            // Batch path (§12.2.1) — apply to all selected same-vendor rows too.
            additionalTransactionIds: Array.from(selectedVendorTransactions),
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setSuccess(data.message || 'Investment contribution recorded');

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
        setError(err instanceof Error ? err.message : 'Failed to record investment contribution');
      } finally {
        setSaving(false);
      }
      return;
    }

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
            // Batch path (§12.2.1) — apply to all selected same-vendor rows too.
            additionalTransactionIds: Array.from(selectedVendorTransactions),
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

      // Phase 38 follow-up — if the user attached a receipt via
      // FormDocumentUpload, link it to the newly-created expense/income now
      // that we have the entity ID. The Document row already exists in the
      // Vault (created during upload); this only adds the DocumentLink so it
      // appears under the right entity. Failure is non-fatal — the doc is
      // still in the Vault, we just surface a soft error to the user.
      if (attachedDocumentId && data?.created?.id && data?.created?.type) {
        const linkedEntityType =
          data.created.type === 'expense' ? 'EXPENSE' : 'INCOME';
        try {
          await fetch(`/api/documents/${attachedDocumentId}/link`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              entityType: linkedEntityType,
              entityId: data.created.id,
            }),
          });
        } catch (linkErr) {
          // Non-blocking — log but don't reverse the create
          console.warn(
            '[TransactionLinkDialog] Document link to entity failed (doc still in Vault):',
            linkErr
          );
        }
      }

      const swept = (data.autoApplied?.count ?? 0) as number;
      setAutoApplied(data.autoApplied ?? { count: 0, appliedIds: [] });
      setSuccess(
        swept > 0 ? `${data.message} · applied to ${swept} similar` : data.message
      );

      // Wait for refresh to complete before navigating
      await onLinked?.();

      // Auto-navigate to next transaction after a brief delay to show success.
      // When Neobrain swept similar rows, hold the dialog open so the user can
      // Undo before moving on.
      if (swept === 0) {
        setTimeout(() => {
          if (hasMoreTransactions && onNavigateNext) {
            onNavigateNext();
          } else {
            onOpenChange(false);
          }
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  // Undo a Neobrain auto-apply sweep — clears the swept sibling rows only
  // (the user's own categorisation on the source row is left intact). Batch
  // unlink: first id is the URL target, the rest ride additionalTransactionIds.
  const handleUndoAutoApply = async () => {
    if (!transaction || autoApplied.appliedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const [first, ...rest] = autoApplied.appliedIds;
      const response = await fetch(`/api/transactions/${first}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'unlink', additionalTransactionIds: rest }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(`Undone — ${autoApplied.count} similar reverted`);
      setAutoApplied({ count: 0, appliedIds: [] });
      await onLinked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
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

  // Phase 51 redesign — the structural "recommended action" cards (loan
  // repayment / transfer), reused by BOTH the collapsed one-clear-action view
  // and (when expanded) the Suggested tab. Defined once to avoid duplication.
  const hasResolution =
    resolution.loanRepayments.length > 0 || resolution.transfers.length > 0;

  // Render resolution cards from a given set of matches. The resolver already
  // sorts each list by confidence DESC (resolveTransaction.ts), so the first of
  // each is the best.
  const renderResolutionCards = (
    loanReps: LoanRepaymentMatch[],
    txfers: TransferMatch[],
  ) => (
    <div className="space-y-2">
      {loanReps.map((m) => (
        <div
          key={m.loanTransactionId}
          className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-emerald-600 shrink-0" />
                Loan repayment — {m.loanName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Matches your statement: {formatCurrency(m.amount)} · {formatDate(m.date)}
                {m.interestPortion != null && ` · ${formatCurrency(m.interestPortion)} interest (deductible)`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleLinkLoanRepayment(m.loanTransactionId)}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
            >
              <Link2 className="h-3 w-3 mr-1" />
              Link as repayment
            </Button>
          </div>
        </div>
      ))}
      {txfers.map((m) => (
        <div
          key={m.transactionId}
          className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4 text-amber-600 shrink-0" />
                Transfer {isIncome ? 'from' : 'to'} {m.accountName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Matches {formatCurrency(m.amount)} · {formatDate(m.date)} in {m.accountName}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMarkTransferTo(m.accountId)}
              disabled={saving}
              className="shrink-0"
            >
              <ArrowRightLeft className="h-3 w-3 mr-1" />
              Mark as transfer
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  // How many candidates are demoted to "More options" (identical-amount recurring
  // transfers produce several same-account matches; the auto-pairer won't guess,
  // and stacking equal-looking cards reads as a duplicate — Reza 2026-06-29).
  // Show only the single highest-confidence match up front (One Clear Action);
  // the rest stay available under "More options".
  const extraResolutionCount =
    Math.max(0, resolution.loanRepayments.length - 1) +
    Math.max(0, resolution.transfers.length - 1);

  // Primary (collapsed) view: the best of each kind only.
  const resolutionCards = hasResolution ? (
    <div className="space-y-2">
      {renderResolutionCards(
        resolution.loanRepayments.slice(0, 1),
        resolution.transfers.slice(0, 1),
      )}
      {extraResolutionCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setMoreView('menu');
            setShowMore(true);
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-1"
        >
          +{extraResolutionCount} other possible match{extraResolutionCount > 1 ? 'es' : ''} — see More options
        </button>
      )}
    </div>
  ) : null;

  // Full set — every candidate, shown inside the "More options" views.
  const allResolutionCards = hasResolution
    ? renderResolutionCards(resolution.loanRepayments, resolution.transfers)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-400">
            Link transaction
          </p>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Transaction
          </DialogTitle>
          <DialogDescription>
            {hasResolution
              ? 'We think we know what this is.'
              : `How would you like to handle this ${isIncome ? 'income' : 'transaction'}?`}
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
              {/* Phase 42 PR 5.6 — vendor card link. Only when we
                  have a standardised merchant to resolve against. */}
              {transaction.merchantStandardised && (
                <button
                  type="button"
                  onClick={() => setShowVendorDrawer(true)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300 hover:underline"
                >
                  View vendor card →
                </button>
              )}
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold tabular-nums tracking-tight ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
              </p>
              <Badge variant={isIncome ? 'default' : 'secondary'}>
                {isIncome ? 'Income' : 'Expense'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Same-Vendor Transactions — Phase 51 redesign: batch lives under
            "More options" (showMore), so the collapsed view stays one-action. */}
        {showMore && sameVendorTransactions.length > 0 && (
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
                      className="pointer-events-none"
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
              : currentLink.type === 'investment'
              ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
              : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {currentLink.type === 'transfer' ? (
                  <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                ) : currentLink.type === 'investment' ? (
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                ) : (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm">
                  {currentLink.type === 'transfer' ? 'Marked as: ' : currentLink.type === 'investment' ? 'Invested to: ' : 'Linked to: '}
                  <strong>{currentLink.name}</strong>
                </span>
                <Badge variant="outline" className={
                  currentLink.type === 'transfer' ? 'border-amber-300 text-amber-700' :
                  currentLink.type === 'investment' ? 'border-purple-300 text-purple-700' : ''
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
        ) : !showMore && !currentLink ? (
          /* Phase 51 redesign — collapsed ONE clear action. The recommended
             structural action (loan repayment / transfer) leads; if none, a
             single primary "Categorise" CTA. Everything else is one tap away
             under "More options" (which reveals the full tabbed UI below). */
          <div className="mt-2 space-y-3">
            {resolutionCards}
            {!hasResolution && (
              <Button
                onClick={() => {
                  setMoreView('create');
                  setShowMore(true);
                }}
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white border-0"
                disabled={saving}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isIncome ? 'Categorise this income' : 'Categorise this transaction'}
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                setMoreView('menu');
                setShowMore(true);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5"
            >
              {hasResolution ? 'Not a repayment? More options' : 'More options'} ▾
            </button>
          </div>
        ) : (
          <Tabs
            value={moreView}
            onValueChange={(v) => setMoreView(v as typeof moreView)}
            className="mt-2"
          >
            {/* Phase 51 redesign — "More options" is a calm slim-row menu that
                navigates to ONE focused section at a time (not a 4-tab wall).
                The menu has no matching TabsContent, so only it renders; each
                row sets moreView to the section, shown with a Back affordance. */}
            {moreView === 'menu' ? (
              <div className="space-y-3">
                {allResolutionCards}
                <div className="space-y-1.5">
                  {([
                    { v: 'create', icon: Plus, label: isIncome ? 'Categorise as income' : 'Categorise as an expense' },
                    { v: 'match', icon: Sparkles, label: `Suggested matches${suggestedMatches.length ? ` (${suggestedMatches.length})` : ''}` },
                    { v: 'all', icon: Link2, label: 'Link to an existing entry' },
                    { v: 'split', icon: Scissors, label: 'Split this transaction' },
                  ] as const).map(({ v, icon: Icon, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMoreView(v)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent hover:border-foreground/20 transition-colors text-left"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMoreView('menu')}
                className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back to options
              </button>
            )}

            {/* Suggested Matches */}
            <TabsContent value="match" className="space-y-2 max-h-64 overflow-auto">
              {/* Phase 51.2 resolution cards — the FULL candidate set here in the
                  expanded tab (the collapsed view above shows only the best). */}
              {allResolutionCards}
              {/* Transaction Pattern Alert */}
              {transactionPattern && transactionPattern.count >= 3 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mb-2">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Pattern Detected
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {transactionPattern.count} transactions over {transactionPattern.monthsCovered?.toFixed(1) || '?'} months
                    {transactionPattern.paymentTiming === 'ADVANCE' && ' (paid in advance)'}
                  </p>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mt-1">
                    Monthly Average: {formatCurrency(transactionPattern.trueMonthlyAverage || transactionPattern.averageAmount)}
                  </p>
                  {transactionPattern.paymentTiming === 'ADVANCE' && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      (Last payment excluded - covers future period)
                    </p>
                  )}
                  {transactionPattern.trueMonthlyAverage && transactionPattern.averageAmount &&
                   Math.abs(transactionPattern.trueMonthlyAverage - transactionPattern.averageAmount) > 100 && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      (Amounts vary: fees or costs may be deducted)
                    </p>
                  )}
                </div>
              )}
              {suggestedMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matching entries found
                </p>
              ) : (
                suggestedMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      match.propertyName ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{match.name}</p>
                          {match.propertyName && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300">
                              <Home className="h-3 w-3 mr-1" />
                              {match.propertyName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{match.category}</Badge>
                          <span>{match.frequency}</span>
                          {match.categoryMatch && (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Category match
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(match.amount)}</p>
                        {!match.amountMatch && (
                          <p className="text-xs text-amber-600">
                            Diff: {formatCurrency(match.amountDiff)} ({match.amount > 0 ? Math.round((match.amountDiff / match.amount) * 100) : 0}%)
                          </p>
                        )}
                        {match.budgetedAmount && match.budgetedAmount !== match.amount && (
                          <p className="text-xs text-slate-500">
                            Budget: {formatCurrency(match.budgetedAmount)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleLink(match.id, match.type)}
                        disabled={saving}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Link{selectedVendorTransactions.size > 0 && ` (${selectedVendorTransactions.size + 1})`}
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
                          onClick={() => handleLink(income.id, 'income')}
                          disabled={saving}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Link
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
                            onClick={() => handleLink(expense.id, 'expense')}
                            disabled={saving}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link
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
                            onClick={() => handleLink(loan.id, 'loan')}
                            disabled={saving}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link
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
                        setIsInvestmentContribution(false);
                      }
                    }}
                  />
                  <Label htmlFor="isTransfer" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                    Transfer / Credit Card Repayment
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Internal transfers and credit card payments are excluded from income/expense calculations
                </p>
              </div>

              {/* Investment Contribution Toggle - for outgoing transactions going to investment accounts */}
              {!isIncome && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isInvestmentContribution"
                      checked={isInvestmentContribution}
                      onCheckedChange={(checked) => {
                        setIsInvestmentContribution(checked as boolean);
                        if (checked) {
                          setIsTransfer(false);
                          setIsRecurringExpense(false);
                          setIsEssential(false);
                        }
                      }}
                    />
                    <Label htmlFor="isInvestmentContribution" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      This is an investment contribution
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    Money deposited into an investment account (shares, crypto, etc.)
                  </p>
                </div>
              )}

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

              {/* Investment Account Selector for Investment Contributions */}
              {isInvestmentContribution && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Investment Account</Label>
                    <Select
                      value={investmentContributionAccountId || ''}
                      onValueChange={(value) => setInvestmentContributionAccountId(value || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select investment account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.length === 0 ? (
                          <SelectItem value="" disabled>No investment accounts available</SelectItem>
                        ) : (
                          investmentAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-purple-500" />
                                {account.name}
                                {account.platform && (
                                  <span className="text-xs text-muted-foreground">({account.platform})</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This will record a deposit in your investment account and track the contribution
                    </p>
                  </div>

                  {/* Recurring Investment Option */}
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isRecurringInvestment"
                        checked={isRecurringInvestment}
                        onCheckedChange={(checked) => setIsRecurringInvestment(checked as boolean)}
                      />
                      <Label htmlFor="isRecurringInvestment" className="text-sm font-normal cursor-pointer">
                        Recurring investment contribution
                      </Label>
                    </div>
                    {isRecurringInvestment && (
                      <>
                        <p className="text-xs text-muted-foreground ml-6">
                          Future transactions from this source will be auto-suggested as investment contributions
                        </p>
                        <div className="space-y-2 ml-6">
                          <Label>Frequency</Label>
                          <Select value={investmentFrequency} onValueChange={setInvestmentFrequency}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WEEKLY">Weekly</SelectItem>
                              <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                              <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                              <SelectItem value="ANNUAL">Annual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Regular categorization options - hidden when transfer or investment contribution is selected */}
              {!isTransfer && !isInvestmentContribution && (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={isIncome ? 'Income name' : 'Expense name'}
                    />
                  </div>

                  {/* Phase 38 follow-up (2026-05-02) — Receipt attachment.
                      Drop a file here, the canonical Phase 25 DME upload
                      runs (storage routing, category inference, auto-link)
                      and Phase 26 OCR + Gemini analysis returns extracted
                      fields we use to auto-fill name/category/etc below.
                      The Document row lands in My Vault immediately;
                      after submit, we link it to the newly-created
                      expense/income via /api/documents/[id]/link. */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Receipt or document
                      <span className="text-xs font-normal text-muted-foreground">
                        Optional — drop one and we&apos;ll auto-fill below
                      </span>
                    </Label>
                    <FormDocumentUpload
                      formType={isIncome ? 'income' : 'expense'}
                      onFieldsExtracted={(mappings: Record<string, FieldMapping>) => {
                        // Auto-fill the form with extracted values. Each
                        // call setter only fires if the user hasn't already
                        // typed something — we don't overwrite their input.
                        const get = (k: string) => mappings[k]?.value;
                        const vendor = get('vendor') ?? get('payee') ?? get('source');
                        if (typeof vendor === 'string' && !newName) {
                          setNewName(vendor);
                        }
                        const cat = get('category');
                        if (typeof cat === 'string' && !newCategory) {
                          setNewCategory(cat);
                          setIsCustomCategory(false);
                        }
                        // FormDocumentUpload also returns isTaxDeductible
                        // and isEssential heuristics for receipts; trust
                        // them only when the user is on the GENERAL source
                        // (otherwise the source-type defaults take priority).
                        if (sourceType === 'GENERAL' && !isIncome) {
                          const taxFlag = get('isTaxDeductible');
                          if (typeof taxFlag === 'boolean') setIsTaxDeductible(taxFlag);
                          const essentialFlag = get('isEssential');
                          if (typeof essentialFlag === 'boolean') setIsEssential(essentialFlag);
                        }
                      }}
                      onDocumentAttached={(documentId: string) => {
                        setAttachedDocumentId(documentId);
                      }}
                      onError={(msg: string) => {
                        // Non-blocking — surface as info; the user can still
                        // submit without an attachment.
                        console.warn('[TransactionLinkDialog] doc upload error:', msg);
                      }}
                      compact
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
                        {/* MON-025: detected-cadence nudge (suggest-and-confirm). We
                            worked out the cadence from the transaction dates; the
                            picker below is pre-filled with it and the user confirms. */}
                        {transactionPattern?.detectedFrequency && (transactionPattern.count ?? 0) >= 2 && (
                          <p className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
                            Detected {transactionPattern.detectedFrequency.toLowerCase().replace('_', '-')} from{' '}
                            {transactionPattern.count} payments — change below if this isn&apos;t right.
                          </p>
                        )}
                        <Select value={newFrequency} onValueChange={setNewFrequency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
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

              {/* Investment contribution button */}
              {isInvestmentContribution && (
                <>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Amount: <strong>{formatCurrency(transaction.amount)}</strong>
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {isRecurringInvestment
                        ? `This will be recorded as a recurring ${investmentFrequency.toLowerCase()} investment`
                        : 'This will be recorded as a deposit in your investment account'}
                    </p>
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={saving || !investmentContributionAccountId}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {isRecurringInvestment
                      ? `Record Recurring Investment`
                      : 'Record Investment Contribution'}
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Phase 42 PR 2.5 — Inline split editor. Splits a single
                transaction across N rows (e.g. Bunnings $850 → $600
                investment + $250 personal). Backend at PUT
                /api/unified-transactions/[id]/splits validates the
                sum (epsilon 0.01) + ownership. */}
            <TabsContent value="split" className="max-h-[26rem] overflow-y-auto">
              <TransactionSplitEditor
                transactionId={transaction.id}
                parentAmount={transaction.direction === 'OUT' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)}
                direction={transaction.direction}
                properties={properties}
                loans={availableLoans.map((l) => ({ id: l.id, name: l.name }))}
                onSaved={() => {
                  setSuccess('Split saved.');
                  if (onLinked) void onLinked();
                }}
              />
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
          <div className="p-2 bg-green-50 dark:bg-green-950/50 text-green-600 rounded text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {success}
            </span>
            {/* Neobrain auto-apply Undo — visible + reversible sweep (never
                silent). Reverts only the swept siblings; the user's own pick
                on this row stays. */}
            {autoApplied.count > 0 && (
              <button
                type="button"
                onClick={handleUndoAutoApply}
                disabled={saving}
                className="shrink-0 text-sky-700 dark:text-sky-300 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </div>
        )}

        {/* Skip button - allows skipping to next transaction */}
        {hasMoreTransactions && onNavigateNext && (
          <div className="flex justify-end border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onNavigateNext();
              }}
              className="text-muted-foreground"
            >
              Skip for now →
            </Button>
          </div>
        )}
      </DialogContent>
      {/* Phase 42 PR 5.6 — vendor card drawer. Self-contained;
          opens from "View vendor card" link in the transaction info
          block. Resolves merchant → vendor via API on open. */}
      <VendorCardDrawer
        open={showVendorDrawer}
        onClose={() => setShowVendorDrawer(false)}
        merchantStandardised={transaction.merchantStandardised ?? undefined}
      />
    </Dialog>
  );
}
