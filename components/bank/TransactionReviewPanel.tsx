'use client';

/**
 * Phase 29: Transaction Review Panel
 * Combined wizard and spreadsheet view for reviewing AI-categorised transactions
 * Supports:
 * - Wizard mode: Step-by-step review of individual transactions
 * - Spreadsheet mode: Bulk review and edit in a table view
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Table,
  List,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import { getCategoryLevel1Options, getCategoryLevel2Options } from '@/lib/bank/categorisation';

// =============================================================================
// TYPES
// =============================================================================

// Extract the non-null type for userValues to fix type errors
type UserValuesFields = {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  isEssential: boolean;
  isRecurring: boolean;
};

interface AICategorizationSettings {
  showConfidenceScores: boolean;
  showAIReasoning: boolean;
  defaultApplyToSimilar: boolean;
}

interface TransactionData {
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  merchantRaw?: string;
  merchantStandardised?: string;
}

interface AIConfidence {
  score: number;
  level: 'AUTO_ACCEPT' | 'NEEDS_REVIEW' | 'MANUAL';
}

interface ReviewItem {
  id: string;
  transaction: TransactionData;
  aiPrediction: {
    categoryLevel1: string | null;
    categoryLevel2: string | null;
    subcategory: string | null;
    isEssential: boolean;
    isRecurring: boolean;
    confidence: number;
    reasoning: string | null;
  };
  userValues: {
    categoryLevel1: string;
    categoryLevel2: string | null;
    subcategory: string | null;
    isEssential: boolean;
    isRecurring: boolean;
  } | null;
  confidenceLevel: string;
  status: 'PENDING' | 'USER_CONFIRMED' | 'USER_EDITED' | 'SKIPPED';
  isDuplicate: boolean;
  duplicateOf: string | null;
  applyToSimilar: boolean;
}

interface BatchInfo {
  id: string;
  fileName: string | null;
  dateRange: {
    start: string;
    end: string;
  };
  status: string;
  account: {
    name: string;
    type: string;
    institution: string | null;
  };
}

interface ReviewStats {
  total: number;
  pending: number;
  needsReview: number;
  requiresManual: number;
  confirmed: number;
  skipped: number;
}

interface TransactionReviewPanelProps {
  accountId: string;
  batchId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

// =============================================================================
// CATEGORY HELPERS - Using existing categorisation service (single source of truth)
// Categories are sourced from lib/bank/categorisation.ts
// =============================================================================

// =============================================================================
// COMPONENT
// =============================================================================

export function TransactionReviewPanel({
  accountId,
  batchId,
  onComplete,
  onCancel,
}: TransactionReviewPanelProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'wizard' | 'spreadsheet'>('wizard');

  // Data
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Edit state
  const [editedItems, setEditedItems] = useState<Map<string, Partial<ReviewItem['userValues']>>>(new Map());
  const [applyToSimilar, setApplyToSimilar] = useState<Map<string, boolean>>(new Map());

  // Settings
  const [settings] = useState<AICategorizationSettings>({
    showConfidenceScores: true,
    showAIReasoning: true,
    defaultApplyToSimilar: true,
  });

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchReviewData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accounts/${accountId}/import/${batchId}/review`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch review data');
      }

      setBatch(data.data.batch);
      setStats(data.data.statistics);
      setItems(data.data.items);

      // Initialize apply to similar
      const similarMap = new Map<string, boolean>();
      data.data.items.forEach((item: ReviewItem) => {
        similarMap.set(item.id, settings.defaultApplyToSimilar);
      });
      setApplyToSimilar(similarMap);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, [accountId, batchId, settings.defaultApplyToSimilar]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleConfirm = async (itemId: string, action: 'CONFIRM' | 'EDIT' | 'SKIP') => {
    const editedValues = editedItems.get(itemId);
    const shouldApplyToSimilar = applyToSimilar.get(itemId) || false;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/accounts/${accountId}/import/${batchId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmations: [{
            itemId,
            action,
            values: action === 'EDIT' ? editedValues : undefined,
            applyToSimilar: shouldApplyToSimilar,
          }],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to confirm');
      }

      // Update local state
      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: action === 'SKIP' ? 'SKIPPED' :
                   action === 'EDIT' ? 'USER_EDITED' : 'USER_CONFIRMED',
            userValues: action !== 'SKIP' ? (editedValues as ReviewItem['userValues'] || {
              categoryLevel1: item.aiPrediction.categoryLevel1 || 'Other',
              categoryLevel2: item.aiPrediction.categoryLevel2,
              subcategory: item.aiPrediction.subcategory,
              isEssential: item.aiPrediction.isEssential,
              isRecurring: item.aiPrediction.isRecurring,
            }) : null,
          };
        }
        return item;
      }));

      // Move to next pending item in wizard mode
      if (viewMode === 'wizard') {
        const nextPending = items.findIndex((item, idx) =>
          idx > currentIndex && item.status === 'PENDING'
        );
        if (nextPending !== -1) {
          setCurrentIndex(nextPending);
        } else {
          // Check if all done
          const remaining = items.filter(i => i.id !== itemId && i.status === 'PENDING').length;
          if (remaining === 0 && onComplete) {
            onComplete();
          }
        }
      }

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          pending: stats.pending - 1,
          confirmed: action !== 'SKIP' ? stats.confirmed + 1 : stats.confirmed,
          skipped: action === 'SKIP' ? stats.skipped + 1 : stats.skipped,
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkConfirmAll = async () => {
    try {
      setSubmitting(true);

      const response = await fetch(`/api/accounts/${accountId}/import/${batchId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmAllPending: true }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to confirm all');
      }

      // Refresh data
      await fetchReviewData();

      if (data.data.remainingPending === 0 && onComplete) {
        onComplete();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm all');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditValue = (itemId: string, field: keyof UserValuesFields, value: string | boolean | null) => {
    setEditedItems(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId) || {};
      newMap.set(itemId, { ...current, [field]: value });
      return newMap;
    });
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-50';
    if (score >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.9) return 'High';
    if (score >= 0.7) return 'Medium';
    return 'Low';
  };

  const getPendingItems = () => items.filter(i => i.status === 'PENDING');
  const currentItem = items[currentIndex];

  // =============================================================================
  // LOADING STATE
  // =============================================================================

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading transactions...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!batch || !stats) {
    return (
      <Alert>
        <AlertDescription>No review data available</AlertDescription>
      </Alert>
    );
  }

  // =============================================================================
  // WIZARD VIEW
  // =============================================================================

  const renderWizardView = () => {
    if (!currentItem) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium">All transactions reviewed!</h3>
            <p className="text-muted-foreground mt-2">
              {stats.confirmed} confirmed, {stats.skipped} skipped
            </p>
            <Button onClick={onComplete} className="mt-4">
              Finish Review
            </Button>
          </CardContent>
        </Card>
      );
    }

    const edited = editedItems.get(currentItem.id) || {};
    const displayValues = {
      categoryLevel1: edited.categoryLevel1 || currentItem.aiPrediction.categoryLevel1 || 'Other',
      categoryLevel2: edited.categoryLevel2 ?? currentItem.aiPrediction.categoryLevel2,
      isEssential: edited.isEssential ?? currentItem.aiPrediction.isEssential,
      isRecurring: edited.isRecurring ?? currentItem.aiPrediction.isRecurring,
    };

    // Get category options from existing categorisation service (single source of truth)
    const categoryLevel1Options = getCategoryLevel1Options();
    const categoryLevel2Options = getCategoryLevel2Options(displayValues.categoryLevel1);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Review Transaction {currentIndex + 1} of {items.length}
              </CardTitle>
              <CardDescription>
                AI has suggested a category. Confirm or edit before saving.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('spreadsheet')}
              >
                <Table className="h-4 w-4 mr-2" />
                Spreadsheet View
              </Button>
            </div>
          </div>
          <Progress
            value={(currentIndex / items.length) * 100}
            className="mt-4"
          />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Transaction Details */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {currentItem.transaction.direction === 'OUT' ? (
                  <ArrowUp className="h-5 w-5 text-red-500" />
                ) : (
                  <ArrowDown className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  {formatCurrency(currentItem.transaction.amount)}
                </span>
              </div>
              <Badge variant="outline">
                {formatDate(currentItem.transaction.date)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {currentItem.transaction.description}
            </p>
            {currentItem.transaction.merchantStandardised && (
              <p className="text-sm font-medium mt-1">
                Merchant: {currentItem.transaction.merchantStandardised}
              </p>
            )}
          </div>

          {/* AI Prediction */}
          {settings.showConfidenceScores && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">AI Confidence:</span>
                <Badge className={getConfidenceColor(currentItem.aiPrediction.confidence)}>
                  {getConfidenceLabel(currentItem.aiPrediction.confidence)} ({Math.round(currentItem.aiPrediction.confidence * 100)}%)
                </Badge>
              </div>
            </div>
          )}

          {settings.showAIReasoning && currentItem.aiPrediction.reasoning && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {currentItem.aiPrediction.reasoning}
              </AlertDescription>
            </Alert>
          )}

          {/* Category Selection - Using existing categorisation service (single source of truth) */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select
                value={displayValues.categoryLevel1}
                onValueChange={(value) => handleEditValue(currentItem.id, 'categoryLevel1', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryLevel1Options.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subcategory</Label>
              <Select
                value={displayValues.categoryLevel2 || ''}
                onValueChange={(value) => handleEditValue(currentItem.id, 'categoryLevel2', value || null)}
                disabled={categoryLevel2Options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={categoryLevel2Options.length === 0 ? 'No subcategories' : 'Select subcategory'} />
                </SelectTrigger>
                <SelectContent>
                  {categoryLevel2Options.map(sub => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="isEssential"
                checked={displayValues.isEssential}
                onCheckedChange={(checked) => handleEditValue(currentItem.id, 'isEssential', checked)}
              />
              <Label htmlFor="isEssential">Essential Expense</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isRecurring"
                checked={displayValues.isRecurring}
                onCheckedChange={(checked) => handleEditValue(currentItem.id, 'isRecurring', checked)}
              />
              <Label htmlFor="isRecurring">Recurring Payment</Label>
            </div>
          </div>

          {/* Apply to Similar */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyToSimilar"
              checked={applyToSimilar.get(currentItem.id) || false}
              onCheckedChange={(checked) => {
                setApplyToSimilar(prev => {
                  const newMap = new Map(prev);
                  newMap.set(currentItem.id, !!checked);
                  return newMap;
                });
              }}
            />
            <Label htmlFor="applyToSimilar" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Apply to all similar transactions from this merchant
            </Label>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentIndex === items.length - 1}
              onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => handleConfirm(currentItem.id, 'SKIP')}
              disabled={submitting}
            >
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConfirm(currentItem.id, 'EDIT')}
              disabled={submitting || !editedItems.has(currentItem.id)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Save Edit
            </Button>
            <Button
              onClick={() => handleConfirm(currentItem.id, 'CONFIRM')}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Confirm
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  };

  // =============================================================================
  // SPREADSHEET VIEW
  // =============================================================================

  const renderSpreadsheetView = () => {
    const pendingItems = getPendingItems();

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review All Transactions</CardTitle>
              <CardDescription>
                {pendingItems.length} transactions pending review
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('wizard')}
              >
                <List className="h-4 w-4 mr-2" />
                Wizard View
              </Button>
              <Button
                onClick={handleBulkConfirmAll}
                disabled={submitting || pendingItems.length === 0}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirm All ({pendingItems.length})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">AI Category</th>
                  <th className="text-center p-3">Confidence</th>
                  <th className="text-center p-3">Essential</th>
                  <th className="text-center p-3">Recurring</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b hover:bg-muted/30',
                      item.status !== 'PENDING' && 'opacity-60'
                    )}
                  >
                    <td className="p-3">
                      {formatDate(item.transaction.date)}
                    </td>
                    <td className="p-3 max-w-[300px] truncate">
                      {item.transaction.description}
                    </td>
                    <td className={cn(
                      'p-3 text-right font-medium',
                      item.transaction.direction === 'OUT' ? 'text-red-600' : 'text-green-600'
                    )}>
                      {item.transaction.direction === 'OUT' ? '-' : '+'}
                      {formatCurrency(item.transaction.amount)}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {item.userValues?.categoryLevel1 || item.aiPrediction.categoryLevel1 || 'Other'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={getConfidenceColor(item.aiPrediction.confidence)}>
                        {Math.round(item.aiPrediction.confidence * 100)}%
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {(item.userValues?.isEssential ?? item.aiPrediction.isEssential) && (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {(item.userValues?.isRecurring ?? item.aiPrediction.isRecurring) && (
                        <RefreshCw className="h-4 w-4 text-blue-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          item.status === 'USER_CONFIRMED' ? 'default' :
                          item.status === 'USER_EDITED' ? 'secondary' :
                          item.status === 'SKIPPED' ? 'outline' : 'destructive'
                        }
                      >
                        {item.status === 'PENDING' ? 'Pending' :
                         item.status === 'USER_CONFIRMED' ? 'Confirmed' :
                         item.status === 'USER_EDITED' ? 'Edited' : 'Skipped'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {item.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfirm(item.id, 'CONFIRM')}
                              disabled={submitting}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCurrentIndex(items.indexOf(item));
                                setViewMode('wizard');
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfirm(item.id, 'SKIP')}
                              disabled={submitting}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>

        <CardFooter className="border-t pt-4 flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onComplete} disabled={getPendingItems().length > 0}>
            Complete Review
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Confirmed</div>
          <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Skipped</div>
          <div className="text-2xl font-bold text-gray-500">{stats.skipped}</div>
        </Card>
      </div>

      {/* Main Content */}
      {viewMode === 'wizard' ? renderWizardView() : renderSpreadsheetView()}
    </div>
  );
}
