/**
 * TRANSACTION EXPLORER
 * Phase 13 - Transactional Intelligence
 *
 * Features:
 * - Global search
 * - Category pivoting
 * - Merchant drill-down
 * - Tagging
 * - Anomaly flags displayed
 * - Category correction UI
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.5.1-2
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Tag,
  ChevronRight,
  X,
  Check,
  Edit3,
  Calendar,
  Building,
  Repeat,
  TrendingUp,
  TrendingDown,
  Upload,
} from 'lucide-react';
import { ImportWizard } from '@/components/bank/ImportWizard';

// =============================================================================
// TYPES
// =============================================================================

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  merchantRaw: string | null;
  merchantStandardised: string | null;
  description: string;
  categoryLevel1: string | null;
  categoryLevel2: string | null;
  tags: string[];
  confidenceScore: number | null;
  isRecurring: boolean;
  anomalyFlags: string[];
  account: {
    id: string;
    name: string;
    institution: string;
  };
}

interface AnalyticsSummary {
  totalSpend: number;
  totalIncome: number;
  netCashflow: number;
  transactionCount: number;
  topCategories: { category: string; amount: number; count: number }[];
}

interface CategoryOption {
  level1: string;
  level2?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_OPTIONS: CategoryOption[] = [
  { level1: 'HOUSING', level2: ['Rent', 'Mortgage', 'Utilities', 'Insurance', 'Maintenance', 'Rates'] },
  { level1: 'TRANSPORT', level2: ['Fuel', 'Public Transport', 'Rideshare', 'Parking', 'Tolls', 'Insurance', 'Maintenance'] },
  { level1: 'FOOD', level2: ['Groceries', 'Dining Out', 'Takeaway', 'Coffee', 'Alcohol'] },
  { level1: 'UTILITIES', level2: ['Electricity', 'Gas', 'Water', 'Internet', 'Mobile', 'TV'] },
  { level1: 'HEALTH', level2: ['Medical', 'Pharmacy', 'Dental', 'Insurance', 'Gym'] },
  { level1: 'ENTERTAINMENT', level2: ['Streaming', 'Events', 'Hobbies', 'Gaming', 'Sports'] },
  { level1: 'SHOPPING', level2: ['Clothing', 'Electronics', 'Home', 'Online', 'General'] },
  { level1: 'FINANCIAL', level2: ['Fees', 'Interest', 'Investments', 'Transfers'] },
  { level1: 'PERSONAL', level2: ['Beauty', 'Education', 'Gifts', 'Pet', 'Charity'] },
  { level1: 'INCOME', level2: ['Salary', 'Rental', 'Dividends', 'Refunds', 'Other'] },
  { level1: 'TRANSFER', level2: ['Internal', 'External'] },
  { level1: 'UNCATEGORISED' },
];

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    HOUSING: 'bg-blue-100 text-blue-800',
    TRANSPORT: 'bg-purple-100 text-purple-800',
    FOOD: 'bg-orange-100 text-orange-800',
    UTILITIES: 'bg-cyan-100 text-cyan-800',
    HEALTH: 'bg-red-100 text-red-800',
    ENTERTAINMENT: 'bg-pink-100 text-pink-800',
    SHOPPING: 'bg-yellow-100 text-yellow-800',
    FINANCIAL: 'bg-green-100 text-green-800',
    PERSONAL: 'bg-indigo-100 text-indigo-800',
    INCOME: 'bg-emerald-100 text-emerald-800',
    TRANSFER: 'bg-gray-100 text-gray-800',
    UNCATEGORISED: 'bg-slate-100 text-slate-600',
  };
  return colors[category || 'UNCATEGORISED'] || colors.UNCATEGORISED;
}

function getConfidenceBadge(score: number | null): React.ReactNode {
  if (score === null) return null;
  if (score >= 0.9) {
    return <span className="text-xs text-green-600">High confidence</span>;
  } else if (score >= 0.7) {
    return <span className="text-xs text-yellow-600">Medium confidence</span>;
  } else {
    return <span className="text-xs text-red-600">Low confidence</span>;
  }
}

// =============================================================================
// SUB COMPONENTS
// =============================================================================

function TransactionRow({
  transaction,
  onEdit,
}: {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 border-b hover:bg-gray-50 cursor-pointer"
      onClick={() => onEdit(transaction)}
    >
      {/* Direction Icon */}
      <div
        className={`p-2 rounded-full ${
          transaction.direction === 'IN' ? 'bg-green-100' : 'bg-red-100'
        }`}
      >
        {transaction.direction === 'IN' ? (
          <ArrowDownLeft className="h-4 w-4 text-green-600" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-red-600" />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {transaction.merchantStandardised || transaction.description}
          </span>
          {transaction.isRecurring && (
            <span title="Recurring">
              <Repeat className="h-4 w-4 text-blue-500" />
            </span>
          )}
          {transaction.anomalyFlags.length > 0 && (
            <span title={transaction.anomalyFlags.join(', ')}>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(transaction.date)}</span>
          <span className="text-gray-300">|</span>
          <Building className="h-3 w-3" />
          <span className="truncate">{transaction.account.name}</span>
        </div>
      </div>

      {/* Category */}
      <div className="hidden md:flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
            transaction.categoryLevel1
          )}`}
        >
          {transaction.categoryLevel1 || 'Uncategorised'}
        </span>
        {getConfidenceBadge(transaction.confidenceScore)}
      </div>

      {/* Tags */}
      {transaction.tags.length > 0 && (
        <div className="hidden lg:flex items-center gap-1">
          {transaction.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
            >
              {tag}
            </span>
          ))}
          {transaction.tags.length > 2 && (
            <span className="text-xs text-gray-400">+{transaction.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Amount */}
      <div
        className={`text-right font-semibold ${
          transaction.direction === 'IN' ? 'text-green-600' : 'text-gray-900'
        }`}
      >
        {transaction.direction === 'IN' ? '+' : '-'}
        {formatCurrency(transaction.amount, transaction.currency)}
      </div>

      <ChevronRight className="h-4 w-4 text-gray-400" />
    </div>
  );
}

function CategoryCorrectionPanel({
  transaction,
  onClose,
  onSave,
}: {
  transaction: Transaction;
  onClose: () => void;
  onSave: (updates: { categoryLevel1: string; categoryLevel2?: string; tags?: string[] }) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(transaction.categoryLevel1 || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(transaction.categoryLevel2 || '');
  const [tags, setTags] = useState<string[]>(transaction.tags);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const subcategories = CATEGORY_OPTIONS.find((c) => c.level1 === selectedCategory)?.level2 || [];

  async function handleSave() {
    setSaving(true);
    await onSave({
      categoryLevel1: selectedCategory,
      categoryLevel2: selectedSubcategory || undefined,
      tags,
    });
    setSaving(false);
  }

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold">Edit Transaction</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Transaction Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="font-medium">
            {transaction.merchantStandardised || transaction.description}
          </div>
          <div className="text-sm text-gray-500 mt-1">{transaction.description}</div>
          <div
            className={`text-xl font-bold mt-2 ${
              transaction.direction === 'IN' ? 'text-green-600' : 'text-gray-900'
            }`}
          >
            {transaction.direction === 'IN' ? '+' : '-'}
            {formatCurrency(transaction.amount)}
          </div>
          <div className="text-sm text-gray-500 mt-1">{formatDate(transaction.date)}</div>
        </div>

        {/* Current Categorisation */}
        {transaction.confidenceScore !== null && (
          <div className="text-sm">
            <span className="text-gray-500">AI Confidence: </span>
            <span
              className={
                transaction.confidenceScore >= 0.9
                  ? 'text-green-600'
                  : transaction.confidenceScore >= 0.7
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }
            >
              {Math.round(transaction.confidenceScore * 100)}%
            </span>
          </div>
        )}

        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedSubcategory('');
            }}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select category</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.level1} value={cat.level1}>
                {cat.level1}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory Selection */}
        {subcategories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subcategory
            </label>
            <select
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select subcategory</option>
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="h-4 w-4 inline mr-1" />
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={addTag}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Add
            </button>
          </div>
        </div>

        {/* Anomaly Flags */}
        {transaction.anomalyFlags.length > 0 && (
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-orange-800 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Anomalies Detected
            </div>
            <ul className="text-sm text-orange-700 list-disc list-inside">
              {transaction.anomalyFlags.map((flag) => (
                <li key={flag}>{flag.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !selectedCategory}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save Changes
        </button>

        <p className="text-xs text-gray-500 text-center">
          Your correction will improve future categorisation for similar transactions.
        </p>
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Total Spend</div>
        <div className="text-xl font-bold text-red-600">
          {formatCurrency(summary.totalSpend)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Total Income</div>
        <div className="text-xl font-bold text-green-600">
          {formatCurrency(summary.totalIncome)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Net Cashflow</div>
        <div
          className={`text-xl font-bold flex items-center gap-1 ${
            summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {summary.netCashflow >= 0 ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
          {formatCurrency(Math.abs(summary.netCashflow))}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">Transactions</div>
        <div className="text-xl font-bold">{summary.transactionCount}</div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ImportAccount {
  id: string;
  name: string;
  type: string;
}

export default function TransactionExplorer() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import wizard state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Edit panel
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (showRecurringOnly) params.append('recurring', 'true');
      if (showAnomaliesOnly) params.append('hasAnomalies', 'true');

      const response = await fetch(`/api/unified-transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setTransactions(json.data);
        setTotalPages(json.pagination.totalPages);
      } else {
        setError(json.error || 'Failed to load transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, categoryFilter, dateRange, showRecurringOnly, showAnomaliesOnly]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/unified-transactions/analytics?months=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (response.ok && json.success) {
        setSummary(json.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [token]);

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.data) {
        // Map accounts to ImportAccount format
        const mappedAccounts: ImportAccount[] = (json.data || []).map((acc: { id: string; name: string; type?: string; institution?: string }) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type || acc.institution || 'Bank',
        }));
        setAccounts(mappedAccounts);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
    fetchAccounts();
  }, [fetchTransactions, fetchSummary, fetchAccounts]);

  async function handleSaveCorrection(updates: {
    categoryLevel1: string;
    categoryLevel2?: string;
    tags?: string[];
  }) {
    if (!editingTransaction || !token) return;

    try {
      const response = await fetch(`/api/unified-transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const json = await response.json();

      if (response.ok && json.success) {
        // Update local state
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === editingTransaction.id
              ? {
                  ...tx,
                  categoryLevel1: updates.categoryLevel1,
                  categoryLevel2: updates.categoryLevel2 || null,
                  tags: updates.tags || tx.tags,
                  confidenceScore: 1.0,
                }
              : tx
          )
        );
        setEditingTransaction(null);
      } else {
        alert(json.error || 'Failed to save changes');
      }
    } catch (err) {
      alert('Network error');
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Transaction Explorer</h1>
            <p className="text-gray-500 text-sm">
              Search, filter, and categorise your transactions
            </p>
          </div>
          <button
            onClick={() => setShowImportWizard(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Transactions
          </button>
        </div>

        {/* Summary Cards */}
        {summary && <SummaryCards summary={summary} />}

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <form onSubmit={handleSearch} className="p-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                  showFilters ? 'bg-blue-50 border-blue-500' : ''
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Search
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">All Categories</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.level1} value={cat.level1}>
                        {cat.level1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, start: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRecurringOnly}
                      onChange={(e) => setShowRecurringOnly(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Recurring only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAnomaliesOnly}
                      onChange={(e) => setShowAnomaliesOnly(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Anomalies</span>
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-red-400" />
              <p className="text-red-600 mt-2">{error}</p>
              <button
                onClick={fetchTransactions}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="h-8 w-8 mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="divide-y">
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    onEdit={setEditingTransaction}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Correction Panel */}
      {editingTransaction && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setEditingTransaction(null)}
          />
          <CategoryCorrectionPanel
            transaction={editingTransaction}
            onClose={() => setEditingTransaction(null)}
            onSave={handleSaveCorrection}
          />
        </>
      )}

      {/* Import Wizard Modal */}
      {showImportWizard && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowImportWizard(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <ImportWizard
                accounts={accounts}
                onComplete={() => {
                  setShowImportWizard(false);
                  fetchTransactions();
                  fetchSummary();
                }}
                onClose={() => setShowImportWizard(false)}
              />
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
