/**
 * Phase 29: Recurring Payment to Expense Matcher
 *
 * Matches detected recurring payments against existing expense entries
 * to identify which payments are already tracked and which need to be added.
 */

export interface RecurringPaymentForMatch {
  id: string;
  merchantStandardised: string;
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'IRREGULAR';
  expectedAmount: number;
  linkedExpenseId: string | null;
  matchStatus: 'UNMATCHED' | 'SUGGESTED' | 'LINKED' | 'DISMISSED' | 'CREATED';
}

export interface ExpenseForMatch {
  id: string;
  name: string;
  vendorName: string | null;
  category: string;
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
}

export interface ExpenseMatchResult {
  recurringPaymentId: string;
  merchantName: string;
  suggestedExpense: ExpenseForMatch | null;
  confidence: number;
  amountMatch: boolean;
  frequencyMatch: boolean;
  amountDifference: number;
  matchReason: string;
}

// =============================================================================
// TEXT MATCHING UTILITIES
// =============================================================================

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
 * Uses word overlap + substring matching
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // Empty strings
  if (!norm1 || !norm2) return 0;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    return (shorter.length / longer.length) * 0.9;
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

// =============================================================================
// FREQUENCY CONVERSION
// =============================================================================

/**
 * Convert frequency to monthly multiplier
 */
function frequencyToMonthly(frequency: string): number {
  const multipliers: Record<string, number> = {
    'WEEKLY': 52 / 12,
    'FORTNIGHTLY': 26 / 12,
    'MONTHLY': 1,
    'QUARTERLY': 1 / 3,
    'ANNUAL': 1 / 12,
    'ANNUALLY': 1 / 12,
    'IRREGULAR': 1,
  };
  return multipliers[frequency.toUpperCase()] || 1;
}

/**
 * Check if two frequencies are compatible
 */
function frequenciesMatch(freq1: string, freq2: string): boolean {
  const normalize = (f: string) => f.toUpperCase().replace('ANNUALLY', 'ANNUAL');
  return normalize(freq1) === normalize(freq2);
}

// =============================================================================
// AMOUNT COMPARISON
// =============================================================================

/**
 * Compare amounts considering variance tolerance (10%)
 */
function compareAmounts(
  recurringAmount: number,
  expenseAmount: number
): { match: boolean; difference: number; percentDiff: number } {
  const difference = Math.abs(recurringAmount - expenseAmount);
  const percentDiff = difference / Math.max(recurringAmount, expenseAmount);

  return {
    match: percentDiff <= 0.1, // Within 10%
    difference: recurringAmount - expenseAmount,
    percentDiff,
  };
}

// =============================================================================
// MAIN MATCHING FUNCTIONS
// =============================================================================

/**
 * Find the best matching expense for a recurring payment
 */
export function findBestExpenseMatch(
  recurringPayment: RecurringPaymentForMatch,
  expenses: ExpenseForMatch[]
): ExpenseMatchResult {
  let bestMatch: ExpenseForMatch | null = null;
  let bestScore = 0.5; // Minimum threshold (50%)
  let bestAmountComparison = { match: false, difference: 0, percentDiff: 1 };
  let bestFrequencyMatch = false;
  let matchReason = '';

  for (const expense of expenses) {
    // Calculate text similarity
    const nameScore = calculateSimilarity(recurringPayment.merchantStandardised, expense.name);
    const vendorScore = expense.vendorName
      ? calculateSimilarity(recurringPayment.merchantStandardised, expense.vendorName)
      : 0;

    const textScore = Math.max(nameScore, vendorScore);

    // Check frequency match
    const freqMatch = frequenciesMatch(recurringPayment.pattern, expense.frequency);

    // Check amount match
    const amountComparison = compareAmounts(recurringPayment.expectedAmount, expense.amount);

    // Calculate composite score
    // Weight: 50% text, 25% amount, 25% frequency
    let compositeScore = textScore * 0.5;
    if (amountComparison.match) compositeScore += 0.25;
    if (freqMatch) compositeScore += 0.25;

    // Boost score if all criteria match
    if (textScore > 0.6 && amountComparison.match && freqMatch) {
      compositeScore = Math.min(compositeScore * 1.2, 1.0);
    }

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestMatch = expense;
      bestAmountComparison = amountComparison;
      bestFrequencyMatch = freqMatch;

      // Build match reason
      const reasons: string[] = [];
      if (nameScore > vendorScore) {
        reasons.push(`Name match (${Math.round(nameScore * 100)}%)`);
      } else if (vendorScore > 0) {
        reasons.push(`Vendor match (${Math.round(vendorScore * 100)}%)`);
      }
      if (amountComparison.match) {
        reasons.push('Amount matches');
      }
      if (freqMatch) {
        reasons.push('Frequency matches');
      }
      matchReason = reasons.join(', ');
    }
  }

  return {
    recurringPaymentId: recurringPayment.id,
    merchantName: recurringPayment.merchantStandardised,
    suggestedExpense: bestMatch,
    confidence: bestScore,
    amountMatch: bestAmountComparison.match,
    frequencyMatch: bestFrequencyMatch,
    amountDifference: bestAmountComparison.difference,
    matchReason: matchReason || 'No strong matches found',
  };
}

/**
 * Batch find matches for all unlinked recurring payments
 */
export function findAllExpenseMatches(
  recurringPayments: RecurringPaymentForMatch[],
  expenses: ExpenseForMatch[]
): ExpenseMatchResult[] {
  const results: ExpenseMatchResult[] = [];

  for (const payment of recurringPayments) {
    // Skip already linked or dismissed payments
    if (payment.matchStatus === 'LINKED' ||
        payment.matchStatus === 'DISMISSED' ||
        payment.matchStatus === 'CREATED') {
      continue;
    }

    const matchResult = findBestExpenseMatch(payment, expenses);

    // Only include if confidence is above threshold
    if (matchResult.confidence >= 0.5) {
      results.push(matchResult);
    } else {
      // Include with null suggestion for untracked payments
      results.push({
        ...matchResult,
        suggestedExpense: null,
        matchReason: 'No matching expense found',
      });
    }
  }

  return results;
}

/**
 * Get match summary statistics
 */
export function getMatchSummary(results: ExpenseMatchResult[]): {
  total: number;
  matched: number;
  unmatched: number;
  highConfidence: number;
  lowConfidence: number;
} {
  const matched = results.filter(r => r.suggestedExpense !== null);
  const highConfidence = matched.filter(r => r.confidence >= 0.7);
  const lowConfidence = matched.filter(r => r.confidence >= 0.5 && r.confidence < 0.7);

  return {
    total: results.length,
    matched: matched.length,
    unmatched: results.length - matched.length,
    highConfidence: highConfidence.length,
    lowConfidence: lowConfidence.length,
  };
}

/**
 * Map recurring payment pattern to expense frequency
 */
export function mapPatternToFrequency(
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'IRREGULAR'
): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' {
  if (pattern === 'ANNUALLY') return 'ANNUAL';
  if (pattern === 'IRREGULAR') return 'MONTHLY'; // Default irregular to monthly
  return pattern as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY';
}

/**
 * Suggest a category based on merchant name
 */
export function suggestCategory(merchantName: string): string {
  const name = merchantName.toLowerCase();

  // Subscription services
  if (name.includes('netflix') || name.includes('spotify') || name.includes('disney') ||
      name.includes('amazon prime') || name.includes('apple') || name.includes('google')) {
    return 'SUBSCRIPTION';
  }

  // Insurance
  if (name.includes('insurance') || name.includes('allianz') || name.includes('nrma') ||
      name.includes('suncorp') || name.includes('qbe')) {
    return 'INSURANCE';
  }

  // Utilities
  if (name.includes('energy') || name.includes('water') || name.includes('gas') ||
      name.includes('electricity') || name.includes('agl') || name.includes('origin')) {
    return 'UTILITIES';
  }

  // Transport
  if (name.includes('opal') || name.includes('myki') || name.includes('uber') ||
      name.includes('transport') || name.includes('toll')) {
    return 'TRANSPORT';
  }

  // Housing
  if (name.includes('rent') || name.includes('strata') || name.includes('body corp')) {
    return 'HOUSING';
  }

  // Rates/Council
  if (name.includes('council') || name.includes('rates')) {
    return 'RATES';
  }

  // Default
  return 'OTHER';
}
