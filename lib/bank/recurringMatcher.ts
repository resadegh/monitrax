/**
 * Phase 18: Recurring Transaction Matcher
 * Matches imported transactions against existing Income and Expense entries
 */

export interface RecurringMatch {
  type: 'income' | 'expense';
  id: string;
  name: string;
  category?: string;
  amount: number;
  frequency: string;
  confidence: number; // 0-1 confidence score
  amountMatch: boolean;
  amountDifference?: number;
  warning?: string;
}

export interface IncomeEntry {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  netAmount?: number | null;
}

export interface ExpenseEntry {
  id: string;
  name: string;
  vendorName?: string | null;
  category: string;
  amount: number;
  frequency: string;
}

export interface TransactionToMatch {
  description: string;
  merchantStandardised?: string;
  amount: number;
  direction: 'IN' | 'OUT';
}

/**
 * Normalize text for matching (lowercase, remove special chars)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses simple word overlap + substring matching
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    return shorter.length / longer.length * 0.9;
  }

  // Word overlap
  const words1 = norm1.split(' ').filter(w => w.length > 2);
  const words2 = norm2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matchCount = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
        break;
      }
    }
  }

  const maxWords = Math.max(words1.length, words2.length);
  return (matchCount / maxWords) * 0.8;
}

/**
 * Convert frequency to monthly multiplier for amount comparison
 */
function frequencyToMonthly(frequency: string): number {
  const multipliers: Record<string, number> = {
    'WEEKLY': 52 / 12,
    'FORTNIGHTLY': 26 / 12,
    'MONTHLY': 1,
    'QUARTERLY': 1 / 3,
    'ANNUAL': 1 / 12,
    'ANNUALLY': 1 / 12,
  };
  return multipliers[frequency.toUpperCase()] || 1;
}

/**
 * Compare amounts considering frequency differences
 */
function compareAmounts(
  txAmount: number,
  recurringAmount: number,
  recurringFrequency: string
): { match: boolean; difference: number } {
  // Convert recurring amount to equivalent of single transaction
  // Assuming transaction is a single occurrence
  const monthlyRecurring = recurringAmount * frequencyToMonthly(recurringFrequency);

  // For weekly/fortnightly, the transaction might be the single occurrence
  const singleOccurrence = recurringAmount;

  // Check both possibilities
  const diffFromSingle = Math.abs(txAmount - singleOccurrence);
  const diffPercent = diffFromSingle / singleOccurrence;

  return {
    match: diffPercent < 0.1, // Within 10%
    difference: txAmount - singleOccurrence,
  };
}

/**
 * Match a transaction against income entries
 */
function matchAgainstIncome(
  transaction: TransactionToMatch,
  incomeEntries: IncomeEntry[]
): RecurringMatch | null {
  if (transaction.direction !== 'IN') return null;

  let bestMatch: RecurringMatch | null = null;
  let bestScore = 0.5; // Minimum threshold

  for (const income of incomeEntries) {
    // Compare against name
    const textToMatch = transaction.merchantStandardised || transaction.description;
    const similarity = Math.max(
      calculateSimilarity(textToMatch, income.name),
      calculateSimilarity(textToMatch, income.type)
    );

    if (similarity > bestScore) {
      const effectiveAmount = income.netAmount || income.amount;
      const amountComparison = compareAmounts(
        transaction.amount,
        effectiveAmount,
        income.frequency
      );

      let warning: string | undefined;
      if (!amountComparison.match && amountComparison.difference !== 0) {
        const diff = amountComparison.difference;
        warning = diff > 0
          ? `Amount is $${diff.toFixed(2)} MORE than expected`
          : `Amount is $${Math.abs(diff).toFixed(2)} LESS than expected`;
      }

      bestMatch = {
        type: 'income',
        id: income.id,
        name: income.name,
        category: income.type,
        amount: effectiveAmount,
        frequency: income.frequency,
        confidence: similarity,
        amountMatch: amountComparison.match,
        amountDifference: amountComparison.difference,
        warning,
      };
      bestScore = similarity;
    }
  }

  return bestMatch;
}

/**
 * Match a transaction against expense entries
 */
function matchAgainstExpenses(
  transaction: TransactionToMatch,
  expenseEntries: ExpenseEntry[]
): RecurringMatch | null {
  if (transaction.direction !== 'OUT') return null;

  let bestMatch: RecurringMatch | null = null;
  let bestScore = 0.5; // Minimum threshold

  for (const expense of expenseEntries) {
    const textToMatch = transaction.merchantStandardised || transaction.description;

    // Compare against name and vendorName
    const similarity = Math.max(
      calculateSimilarity(textToMatch, expense.name),
      expense.vendorName ? calculateSimilarity(textToMatch, expense.vendorName) : 0
    );

    if (similarity > bestScore) {
      const amountComparison = compareAmounts(
        transaction.amount,
        expense.amount,
        expense.frequency
      );

      let warning: string | undefined;
      if (!amountComparison.match && amountComparison.difference !== 0) {
        const diff = amountComparison.difference;
        warning = diff > 0
          ? `Amount is $${diff.toFixed(2)} MORE than usual (${expense.name})`
          : `Amount is $${Math.abs(diff).toFixed(2)} LESS than usual (${expense.name})`;
      }

      bestMatch = {
        type: 'expense',
        id: expense.id,
        name: expense.name,
        category: expense.category,
        amount: expense.amount,
        frequency: expense.frequency,
        confidence: similarity,
        amountMatch: amountComparison.match,
        amountDifference: amountComparison.difference,
        warning,
      };
      bestScore = similarity;
    }
  }

  return bestMatch;
}

/**
 * Find potential matches for a transaction
 */
export function findRecurringMatches(
  transaction: TransactionToMatch,
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[]
): RecurringMatch | null {
  if (transaction.direction === 'IN') {
    return matchAgainstIncome(transaction, incomeEntries);
  } else {
    return matchAgainstExpenses(transaction, expenseEntries);
  }
}

/**
 * Batch match transactions against recurring entries
 */
export function batchFindMatches(
  transactions: TransactionToMatch[],
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[]
): Map<number, RecurringMatch> {
  const matches = new Map<number, RecurringMatch>();

  transactions.forEach((tx, index) => {
    const match = findRecurringMatches(tx, incomeEntries, expenseEntries);
    if (match) {
      matches.set(index, match);
    }
  });

  return matches;
}

/**
 * Get match summary statistics
 */
export function getMatchSummary(matches: Map<number, RecurringMatch>): {
  totalMatches: number;
  incomeMatches: number;
  expenseMatches: number;
  amountMismatches: number;
  highConfidenceMatches: number;
} {
  let incomeMatches = 0;
  let expenseMatches = 0;
  let amountMismatches = 0;
  let highConfidenceMatches = 0;

  matches.forEach((match) => {
    if (match.type === 'income') incomeMatches++;
    else expenseMatches++;

    if (!match.amountMatch) amountMismatches++;
    if (match.confidence >= 0.8) highConfidenceMatches++;
  });

  return {
    totalMatches: matches.size,
    incomeMatches,
    expenseMatches,
    amountMismatches,
    highConfidenceMatches,
  };
}
