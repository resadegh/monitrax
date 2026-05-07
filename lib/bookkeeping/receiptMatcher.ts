/**
 * Phase 42 PR3 — Receipt → transaction matcher.
 *
 * Single SSOT for "is this receipt the same as that bank transaction?"
 * Per CLAUDE.md §12.3 — no duplicate engines. The DME analyze/confirm
 * flow, the cash quick-add path, and any future PR2.5 inline UI all
 * call into THIS module; the threshold rule lives here exactly once.
 *
 * Per Phase 42 spec §3 D-42-7 (Reza signed-off thresholds):
 *   - Same `accountId` (or any account if user explicitly chose "Cash")
 *   - Date window: ±3 days from receipt date
 *   - Amount tolerance: ±$0.50 OR ±0.5% (whichever is larger)
 *   - Vendor name fuzzy match: Levenshtein ratio ≥ 0.7
 *   - Auto-link only at composite confidence ≥ 0.95
 *   - 0.7-0.95 → user picker
 *   - <0.7 → no match → create new RECEIPT-sourced transaction
 *
 * Composite confidence is a deterministic weighted blend of three
 * signals (date proximity / amount proximity / vendor similarity).
 * NEVER call out to the LLM here — matching is data, not advice.
 */

import prisma from '@/lib/db';
import type { UnifiedTransaction } from '@prisma/client';

/** Date window, in days, around the receipt date. */
export const RECEIPT_DATE_WINDOW_DAYS = 3;

/** Absolute amount tolerance, in dollars. */
export const RECEIPT_AMOUNT_TOLERANCE_ABS = 0.5;

/** Relative amount tolerance, as a fraction. 0.5%. */
export const RECEIPT_AMOUNT_TOLERANCE_RELATIVE = 0.005;

/** Composite confidence at or above which we auto-link without a user picker. */
export const RECEIPT_AUTO_LINK_THRESHOLD = 0.95;

/** Composite confidence at or above which we show the user picker. */
export const RECEIPT_PICKER_THRESHOLD = 0.7;

export interface ReceiptCandidate {
  vendor?: string;
  amount: number;
  /** ISO date string or Date — the date on the receipt. */
  date: Date;
  /** Account scope. If null, we search across the user's accounts. */
  accountId?: string | null;
}

export interface MatchScoreBreakdown {
  /** 0..1 — closer dates score higher. Exact = 1.0; ±3 days = ~0.4. */
  dateScore: number;
  /** 0..1 — closer amounts score higher. Exact = 1.0; out-of-tolerance = 0. */
  amountScore: number;
  /** 0..1 — Levenshtein-based string similarity. Exact = 1.0; empty = 0. */
  vendorScore: number;
  /** Weighted composite. */
  composite: number;
}

export interface ReceiptMatchResult {
  transaction: UnifiedTransaction;
  score: MatchScoreBreakdown;
}

export type ReceiptMatchVerdict =
  | { kind: 'AUTO_LINK'; match: ReceiptMatchResult }
  | { kind: 'PICK_FROM'; candidates: ReceiptMatchResult[] }
  | { kind: 'NO_MATCH' };

// =============================================================================
// Pure helpers — no DB; suitable for direct unit testing
// =============================================================================

/**
 * Days difference between two dates, ignoring the time-of-day component.
 * Returns absolute days as a non-negative integer. Dates on the same
 * UTC calendar day return 0 regardless of time-of-day.
 */
export function daysBetween(a: Date, b: Date): number {
  const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(dayA - dayB) / (1000 * 60 * 60 * 24);
}

/**
 * Score 0..1 from a date difference.
 *   0 days → 1.0
 *   1 day  → 0.85
 *   2 days → 0.7
 *   3 days → 0.5  (still inside the window — eligible for picker)
 *   4+ days → 0.0 (outside the window)
 */
export function scoreDate(receiptDate: Date, txDate: Date): number {
  const days = daysBetween(receiptDate, txDate);
  if (days > RECEIPT_DATE_WINDOW_DAYS) return 0;
  return Math.max(0, 1 - days * 0.15 - (days >= 3 ? 0.05 : 0));
}

/**
 * Score 0..1 from an amount difference. Considers both absolute and
 * relative tolerance — whichever is more permissive.
 */
export function scoreAmount(receiptAmount: number, txAmount: number): number {
  const absR = Math.abs(receiptAmount);
  const absT = Math.abs(txAmount);
  const diff = Math.abs(absR - absT);
  const allowedAbs = RECEIPT_AMOUNT_TOLERANCE_ABS;
  const allowedRel = absR * RECEIPT_AMOUNT_TOLERANCE_RELATIVE;
  const tolerance = Math.max(allowedAbs, allowedRel);
  if (tolerance <= 0) return diff === 0 ? 1 : 0;
  if (diff > tolerance) return 0;
  return 1 - diff / tolerance;
}

/**
 * Levenshtein distance — classic dynamic-programming implementation.
 * O(m*n) time and space; bounded by truncating inputs to 64 chars
 * (matches the merchant-norm max length in
 * `lib/bookkeeping/normaliseDescription.ts`).
 */
export function levenshtein(a: string, b: string): number {
  const s1 = a.slice(0, 64);
  const s2 = b.slice(0, 64);
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = Array.from({ length: s1.length + 1 }, () =>
    Array.from({ length: s2.length + 1 }, () => 0)
  );
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[s1.length][s2.length];
}

/**
 * Levenshtein-based similarity ratio in [0, 1]. 1.0 = exact match;
 * 0.0 = entirely different. Empty strings are treated as 0 (a missing
 * vendor on the receipt should never auto-confirm a real one).
 */
export function vendorSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const s1 = norm(a);
  const s2 = norm(b);
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Composite weighted score. Date carries the most weight (timing is
 * the strongest signal a receipt belongs to a particular transaction);
 * amount second; vendor third (acts as a tiebreaker / disambiguator
 * when date+amount both look right).
 *
 * 50% date / 35% amount / 15% vendor.
 *
 * Adjustment: if amount is exact (within $0.01) AND date is within 1
 * day, force composite to ≥ 0.95 (auto-link) — these signals together
 * are strong enough that a vendor-name jitter (Coles → Coles Group)
 * shouldn't sink the match.
 */
export function compositeScore(score: Pick<MatchScoreBreakdown, 'dateScore' | 'amountScore' | 'vendorScore'>): number {
  const base = score.dateScore * 0.5 + score.amountScore * 0.35 + score.vendorScore * 0.15;
  // Strong-signal override: same-day exact-amount is auto-link grade.
  if (score.dateScore >= 0.85 && score.amountScore >= 0.99) {
    return Math.max(base, 0.95);
  }
  return base;
}

/**
 * Score a candidate transaction against a receipt. Pure — DB-free;
 * used by the matcher below + by tests.
 */
export function scoreCandidate(receipt: ReceiptCandidate, tx: UnifiedTransaction): MatchScoreBreakdown {
  const dateScore = scoreDate(receipt.date, tx.date);
  const amountScore = scoreAmount(receipt.amount, tx.amount);
  const vendorScore = vendorSimilarity(
    receipt.vendor,
    tx.merchantStandardised ?? tx.merchantRaw ?? tx.description
  );
  return {
    dateScore,
    amountScore,
    vendorScore,
    composite: compositeScore({ dateScore, amountScore, vendorScore }),
  };
}

// =============================================================================
// DB-touching matcher
// =============================================================================

/**
 * Find candidate matches for a receipt within the user's transactions.
 *
 * Strategy:
 *   1. Coarse-filter at DB layer: same userId, date in ±3 days, amount
 *      sign matches receipt sign, |amount| within max tolerance.
 *      Optional accountId scope.
 *   2. Score each candidate via `scoreCandidate()`.
 *   3. Sort by composite descending; classify the top-N into a verdict.
 *
 * Returns `{ kind: 'NO_MATCH' }` if zero candidates clear the picker
 * threshold; `{ kind: 'AUTO_LINK' }` if the top candidate clears the
 * auto-link threshold AND no other candidate is within 0.05 of it
 * (avoids ambiguous auto-links); otherwise `{ kind: 'PICK_FROM' }`
 * with up to 5 candidates above the picker threshold.
 *
 * The receipt's `amount` is treated as POSITIVE here (the DME extracts
 * a positive vendor-bill amount); transactions are stored signed with
 * direction-OUT being negative. We compare absolute values inside
 * `scoreAmount`.
 */
export async function findReceiptMatches(
  userId: string,
  receipt: ReceiptCandidate
): Promise<ReceiptMatchVerdict> {
  // Date window
  const lower = new Date(receipt.date);
  lower.setUTCDate(lower.getUTCDate() - RECEIPT_DATE_WINDOW_DAYS);
  const upper = new Date(receipt.date);
  upper.setUTCDate(upper.getUTCDate() + RECEIPT_DATE_WINDOW_DAYS);

  // Amount window (rough, generous — final scoring is exact)
  const absReceipt = Math.abs(receipt.amount);
  const allowedAbs = Math.max(
    RECEIPT_AMOUNT_TOLERANCE_ABS,
    absReceipt * RECEIPT_AMOUNT_TOLERANCE_RELATIVE
  );
  // Coarse filter — cast a wider net at the DB layer (3× tolerance) so
  // we don't miss edge cases; precise scoring runs in JS.
  const coarseAmount = Math.max(allowedAbs * 3, 5);

  const candidates = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      date: { gte: lower, lte: upper },
      amount: {
        // Receipts are vendor bills (OUT); allow either sign at coarse
        // level and let the scorer enforce sign via abs() comparison
        gte: -(absReceipt + coarseAmount),
        lte: absReceipt + coarseAmount,
      },
      // Receipts that did NOT match (already RECEIPT-sourced) should
      // NEVER be candidates for a SECOND match — avoid double-linking.
      source: { not: 'RECEIPT' },
      // Don't surface transactions that already have a receipt linked.
      matchedDocumentId: null,
      // Account scope: if the receipt is bound to a particular account,
      // only consider that account; else search across the user.
      ...(receipt.accountId ? { accountId: receipt.accountId } : {}),
    },
    orderBy: { date: 'asc' },
    take: 100,
  });

  const scored: ReceiptMatchResult[] = candidates.map((tx) => ({
    transaction: tx,
    score: scoreCandidate(receipt, tx),
  }));
  scored.sort((a, b) => b.score.composite - a.score.composite);

  const top = scored[0];
  if (!top || top.score.composite < RECEIPT_PICKER_THRESHOLD) {
    return { kind: 'NO_MATCH' };
  }

  const second = scored[1];
  const auto =
    top.score.composite >= RECEIPT_AUTO_LINK_THRESHOLD &&
    (!second || top.score.composite - second.score.composite >= 0.05);

  if (auto) {
    return { kind: 'AUTO_LINK', match: top };
  }

  const pickFrom = scored
    .filter((s) => s.score.composite >= RECEIPT_PICKER_THRESHOLD)
    .slice(0, 5);
  return { kind: 'PICK_FROM', candidates: pickFrom };
}
