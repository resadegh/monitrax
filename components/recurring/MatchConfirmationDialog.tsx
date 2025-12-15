/**
 * Match Confirmation Dialog
 * Phase 29 - Expense Linking
 *
 * Shows a suggested expense match for a recurring payment
 * and allows the user to confirm, dismiss, or create a new expense.
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Plus,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Calendar,
  Building,
} from 'lucide-react';

interface RecurringPayment {
  id: string;
  merchantStandardised: string;
  pattern: string;
  expectedAmount: number;
  nextExpected: string | null;
  occurrenceCount: number;
  account: {
    id: string;
    name: string;
  };
}

interface ExpenseMatch {
  id: string;
  name: string;
  vendorName: string | null;
  category: string;
  amount: number;
  frequency: string;
}

interface MatchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringPayment: RecurringPayment;
  suggestedExpense: ExpenseMatch | null;
  confidence: number;
  amountMatch: boolean;
  frequencyMatch: boolean;
  amountDifference: number;
  matchReason: string;
  onConfirm: (paymentId: string, expenseId: string) => Promise<void>;
  onDismiss: (paymentId: string) => Promise<void>;
  onCreateNew: (payment: RecurringPayment) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

function formatPattern(pattern: string): string {
  const patterns: Record<string, string> = {
    WEEKLY: 'Weekly',
    FORTNIGHTLY: 'Fortnightly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    ANNUALLY: 'Annually',
    ANNUAL: 'Annually',
    IRREGULAR: 'Irregular',
  };
  return patterns[pattern] || pattern;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800';
  if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
  return 'bg-orange-100 text-orange-800';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High Confidence';
  if (confidence >= 0.6) return 'Medium Confidence';
  return 'Low Confidence';
}

export function MatchConfirmationDialog({
  open,
  onOpenChange,
  recurringPayment,
  suggestedExpense,
  confidence,
  amountMatch,
  frequencyMatch,
  amountDifference,
  matchReason,
  onConfirm,
  onDismiss,
  onCreateNew,
}: MatchConfirmationDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!suggestedExpense) return;
    setLoading(true);
    try {
      await onConfirm(recurringPayment.id, suggestedExpense.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await onDismiss(recurringPayment.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    onOpenChange(false);
    onCreateNew(recurringPayment);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {suggestedExpense ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                Match Found
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                No Match Found
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {suggestedExpense
              ? 'We found a potential expense that matches this recurring payment.'
              : 'This recurring payment is not currently tracked in your expenses.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Recurring Payment Card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500 mb-2">
              Detected Recurring Payment
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">
                  {recurringPayment.merchantStandardised}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <Building className="h-4 w-4" />
                  <span>{recurringPayment.account.name}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {formatCurrency(recurringPayment.expectedAmount)}
                </div>
                <div className="text-sm text-gray-500">
                  {formatPattern(recurringPayment.pattern)}
                </div>
              </div>
            </div>
          </div>

          {suggestedExpense && (
            <>
              {/* Arrow Connector */}
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-gray-400" />
              </div>

              {/* Suggested Expense Card */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-blue-600">
                    Suggested Expense
                  </div>
                  <Badge className={getConfidenceColor(confidence)}>
                    {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg">{suggestedExpense.name}</div>
                    {suggestedExpense.vendorName && (
                      <div className="text-sm text-gray-500">
                        {suggestedExpense.vendorName}
                      </div>
                    )}
                    <Badge variant="outline" className="mt-1">
                      {suggestedExpense.category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatCurrency(suggestedExpense.amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatPattern(suggestedExpense.frequency)}
                    </div>
                  </div>
                </div>

                {/* Match Details */}
                <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                  <div className="text-sm text-gray-600">{matchReason}</div>
                  <div className="flex items-center gap-4 text-sm">
                    <span
                      className={`flex items-center gap-1 ${
                        amountMatch ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      <DollarSign className="h-4 w-4" />
                      {amountMatch ? 'Amount matches' : `Difference: ${formatCurrency(amountDifference)}`}
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        frequencyMatch ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      <Calendar className="h-4 w-4" />
                      {frequencyMatch ? 'Frequency matches' : 'Different frequency'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!suggestedExpense && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-800">
                    Untracked Payment Detected
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">
                    This recurring payment of{' '}
                    <strong>{formatCurrency(recurringPayment.expectedAmount)}</strong>{' '}
                    {formatPattern(recurringPayment.pattern).toLowerCase()} is not tracked
                    in your expenses. Add it to get accurate budget calculations.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {suggestedExpense ? (
            <>
              <Button
                variant="outline"
                onClick={handleDismiss}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Not a Match
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateNew}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Expense
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {loading ? 'Linking...' : 'Confirm Match'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
              <Button
                onClick={handleCreateNew}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create as Expense
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
