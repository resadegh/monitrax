/**
 * Shared Type Definitions for Recurring Payments
 * Phase 29 - Expense Linking
 *
 * These types are used across multiple components to ensure consistency.
 */

export type RecurringPattern = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'IRREGULAR';

export type ExpenseMatchStatus = 'UNMATCHED' | 'SUGGESTED' | 'LINKED' | 'DISMISSED' | 'CREATED';

export interface LinkedExpense {
  id: string;
  name: string;
  vendorName: string | null;
  category: string;
  amount: number;
  frequency: string;
}

export interface RecurringPaymentAccount {
  id: string;
  name: string;
  institution: string;
}

export interface RecurringPayment {
  id: string;
  merchantStandardised: string;
  pattern: RecurringPattern;
  expectedAmount: number;
  amountVariance: number;
  lastOccurrence: string;
  nextExpected: string;
  occurrenceCount: number;
  priceIncreaseAlert: boolean;
  isActive: boolean;
  isPaused: boolean;
  matchStatus: ExpenseMatchStatus;
  matchConfidence: number | null;
  linkedExpenseId: string | null;
  linkedExpense: LinkedExpense | null;
  account: RecurringPaymentAccount;
}

export interface MatchResult {
  recurringPaymentId: string;
  merchantName: string;
  suggestedExpense: LinkedExpense | null;
  confidence: number;
  amountMatch: boolean;
  frequencyMatch: boolean;
  amountDifference: number;
  matchReason: string;
  recurringPayment: RecurringPayment | null;
}

export interface RecurringSummary {
  total: number;
  active: number;
  paused: number;
  monthlyTotal: number;
  priceAlerts: number;
}
