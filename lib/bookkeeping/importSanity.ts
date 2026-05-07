/**
 * Phase 42 PR4 — Import sanity-check helpers.
 *
 * Two pure helpers used by the batch-import API:
 *
 *  1. `computeBalanceSanityCheck()` — given the source file's stated
 *     opening + closing balance and the imported transaction sum,
 *     surface any gap. NOT formal bank reconciliation (Xero owns
 *     that); it is a *user-facing nudge* — "we imported 47 rows that
 *     net to $1,210; your statement closes at $1,240; there's a $30
 *     gap. Likely a missing transaction near the start of the period".
 *
 *  2. `computeDedupPreview()` — given a candidate set and the
 *     existing `unified_transactions` rows for the same account,
 *     report the count and sample of duplicates the cross-batch
 *     dedup index (`ut_dedup_qif_csv_ofx`) would catch. Used by the
 *     re-import preview / merge-mode UI.
 *
 * Both functions are pure data-in / data-out. Per CLAUDE.md §12.3 —
 * no calculation duplication; the helpers compose existing utilities
 * (`computeDescriptionHash` from PR1's normaliser).
 *
 * Per CLAUDE.md §12.2 SSOT — there is exactly one definition of "what
 * is the gap?" and "what counts as a duplicate?", and both live here
 * (sharing PR1's `computeDescriptionHash`).
 */

import { computeDescriptionHash, isDedupSource, type DedupSource } from './normaliseDescription';

/** Tolerance for the sanity-check gap (cents-level rounding). $0.50. */
export const BALANCE_SANITY_EPSILON = 0.5;

export interface BalanceSanityInput {
  /** Source file's stated opening balance, if present. */
  openingBalance?: number | null;
  /** Source file's stated closing balance, if present. */
  closingBalance?: number | null;
  /** Sum of all SIGNED imported transaction amounts (OUT negative, IN positive). */
  importedSum: number;
}

export interface BalanceSanityResult {
  /** Did we have enough data to run the check? */
  ran: boolean;
  /** Computed expected closing = opening + importedSum. */
  expectedClosing: number | null;
  /** Difference (statedClosing - expectedClosing). 0 = balanced. */
  gap: number;
  /** True when |gap| > epsilon — surface a banner. */
  hasGap: boolean;
  /** Human-friendly message for the banner. */
  message: string | null;
}

/**
 * Compare opening + sum vs stated closing balance from the source file.
 * Returns a structured result the API surfaces in its response so the
 * Activity / Import wizard UI can render a single sanity banner.
 *
 * Skips silently when the source file didn't include both balances.
 * Many AU bank QIFs omit them — that's not an error.
 */
export function computeBalanceSanityCheck(input: BalanceSanityInput): BalanceSanityResult {
  if (
    input.openingBalance == null ||
    input.closingBalance == null ||
    !Number.isFinite(input.openingBalance) ||
    !Number.isFinite(input.closingBalance) ||
    !Number.isFinite(input.importedSum)
  ) {
    return {
      ran: false,
      expectedClosing: null,
      gap: 0,
      hasGap: false,
      message: null,
    };
  }
  const expectedClosing = input.openingBalance + input.importedSum;
  const gap = input.closingBalance - expectedClosing;
  const hasGap = Math.abs(gap) > BALANCE_SANITY_EPSILON;
  if (!hasGap) {
    return { ran: true, expectedClosing, gap: 0, hasGap: false, message: null };
  }
  const sign = gap > 0 ? '+' : '−';
  const absGap = Math.abs(gap).toFixed(2);
  const message =
    gap > 0
      ? `${sign}$${absGap} between imported transactions and the closing balance — likely a transaction we didn't catch.`
      : `${sign}$${absGap} between imported transactions and the closing balance — likely a duplicate or extra row in the import.`;
  return { ran: true, expectedClosing, gap, hasGap: true, message };
}

// =============================================================================
// Dedup preview
// =============================================================================

export interface DedupPreviewCandidate {
  /** Source-file row index (1-based, for user-facing messages). */
  rowNumber?: number;
  date: Date;
  amount: number;
  description: string;
  merchantStandardised?: string | null;
  source: string;
}

export interface DedupPreviewExisting {
  id: string;
  accountId: string;
  date: Date;
  amount: number;
  description: string;
  merchantStandardised?: string | null;
  source: string;
}

export interface DedupPreviewMatch {
  candidate: DedupPreviewCandidate;
  existing: DedupPreviewExisting;
}

export interface DedupPreviewResult {
  /** Total candidates seen. */
  totalCandidates: number;
  /** Candidates whose (accountId, date, amount, hash) collide with an existing row. */
  duplicateCount: number;
  /** Sample of up to 5 collisions for user-facing display. */
  sample: DedupPreviewMatch[];
  /** Candidates that don't collide — would be NEW rows. */
  newCount: number;
}

/**
 * Detect collisions before commit. The hash function is identical to
 * the one PR1's migration backfill applied + the one a future PR1.1
 * unique constraint would enforce — so the preview's `duplicateCount`
 * is exactly what a real import would skip / reject.
 *
 * Pure — DB-free. The caller fetches the existing rows for the target
 * account (typically last 90 days for performance) and passes them in.
 *
 * Sources outside QIF / CSV / OFX (BASIQ, MANUAL, RECEIPT) are NEVER
 * matched against — those have their own canonical keys.
 */
export function computeDedupPreview(
  candidates: DedupPreviewCandidate[],
  existing: DedupPreviewExisting[],
  accountId: string
): DedupPreviewResult {
  const existingIndex = new Map<string, DedupPreviewExisting>();
  for (const row of existing) {
    if (!isDedupSource(row.source)) continue;
    if (row.accountId !== accountId) continue;
    const hash = computeDescriptionHash({
      merchantStandardised: row.merchantStandardised,
      description: row.description,
    });
    const key = makeKey(row.accountId, row.date, row.amount, hash);
    existingIndex.set(key, row);
  }

  const matches: DedupPreviewMatch[] = [];
  let duplicateCount = 0;

  for (const c of candidates) {
    if (!isDedupSource(c.source)) continue; // candidate not in dedup scope
    const hash = computeDescriptionHash({
      merchantStandardised: c.merchantStandardised,
      description: c.description,
    });
    const key = makeKey(accountId, c.date, c.amount, hash);
    const hit = existingIndex.get(key);
    if (hit) {
      duplicateCount++;
      if (matches.length < 5) {
        matches.push({ candidate: c, existing: hit });
      }
    }
  }

  return {
    totalCandidates: candidates.length,
    duplicateCount,
    sample: matches,
    newCount: candidates.length - duplicateCount,
  };
}

function makeKey(
  accountId: string,
  date: Date,
  amount: number,
  hash: string
): string {
  // Normalise the date to UTC midnight so QIF rows imported with
  // different time-of-day still collide on the same day.
  const dayKey = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // Round amount to 2 decimal places to defend against float jitter.
  const amountKey = Math.round(amount * 100) / 100;
  return `${accountId}::${dayKey}::${amountKey}::${hash}`;
}

export type { DedupSource };
