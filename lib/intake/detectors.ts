/**
 * Intake-integrity standing detectors (INTAKE_INTEGRITY_GUARDRAIL.md §4 R2).
 *
 * D2 — CADENCE MISMATCH (MON-001): a row whose STORED frequency disagrees
 * with the cadence its own linked transactions imply. The type specimen:
 * weekly rent (payments 7 days apart) stored `MONTHLY` → annualised ×12
 * instead of ×52 (~4.3× understated income, wrong tax).
 *
 * PURE (§6.4): callers supply the row's stored cadence + its transaction
 * dates; the cadence itself comes from the ONE canonical detector
 * (lib/utils/reconciliation.ts `detectFrequency` — same producer the
 * classifier's C1 evidence path uses, §12.2.1).
 *
 * Deliberately conservative — a nudge, never an auto-change:
 *   - needs ≥3 transactions (2 dates = 1 interval; too noisy to flag on)
 *   - needs detector confidence ≥ 0.7 (consistent intervals)
 *   - never flags one-off rows (cadence is moot when counted once)
 * The flag is surfaced to the user for review; remediation is the user's
 * edit (the no-blind-mutation precedent), and future intake is already
 * protected by classifyIntake's evidence path.
 */

import { Frequency } from '@/lib/types/prisma-enums';
import { detectFrequency } from '@/lib/utils/reconciliation';
import { periodsPerYear } from '@/lib/utils/frequencies';
import { normalizeFrequency } from '@/lib/intake/classifyIntake';
import { reconcileManagedRental } from '@/lib/calculations/rentalReconciliation';

export interface CadenceMismatchFlag {
  /** The row's stored cadence. */
  stored: Frequency;
  /** The cadence the row's own transactions imply. */
  implied: Frequency;
  /** Detector confidence in the implied cadence (0-1). */
  confidence: number;
  /** How many transactions backed the implication. */
  transactionCount: number;
}

/**
 * D1 — ONE-OFF FINGERPRINT (MON-075, gates MON-053 → CLOSED): a row marked
 * RECURRING whose entire evidence is a SINGLE linked transaction with $0 of
 * in-window actuals — the exact fingerprint of the MON-023→037→053 class
 * (a lone deposit/receipt silently minted as a recurring monthly stream).
 *
 * Review nudge only (Reza decision 2026-07-15: source-aware default, blanket
 * backfill REJECTED): some single-txn recurring rows are legitimate — a real
 * stream whose other payments are out-of-window (the VR-008 Cienna case).
 * The user reviews; nothing auto-changes. Future intake is already
 * source-aware (#1421 + the classifier), so this detector exists to surface
 * the RESIDUAL rows that pre-date the guard.
 */
export interface OneOffFingerprintFlag {
  /** How many transactions back this "recurring" row. */
  transactionCount: 1;
}

export function detectOneOffFingerprint(row: {
  isRecurring?: boolean | null;
  /** Total linked transactions across all time. */
  transactionCount: number;
  /** Actuals inside the current reporting window (e.g. this month). */
  inWindowActual: number;
}): OneOffFingerprintFlag | null {
  if (row.isRecurring === false) return null; // already a one-off
  if (row.transactionCount !== 1) return null; // needs exactly the lone-txn shape
  if (Math.abs(row.inWindowActual) > 0) return null; // active this window → looks live
  return { transactionCount: 1 };
}

/**
 * D4 — RENT GAP (Phase 59 / MON-079, PHASE_59_MANAGED_RENTAL_INCOME.md §7):
 * a rental stream whose observed deposits run MATERIALLY below the declared
 * gross, with NO agent-cost expense captured. The fingerprint of an
 * agent-managed rental that isn't modelled yet — the user is silently
 * missing management-fee deductions. Surface copy: *"you may be missing
 * management-fee deductions — upload your rental statement."*
 *
 * Fires regardless of `rentalMode` — catching the DIRECT-marked stream that
 * is actually agent-managed is the point. All gap arithmetic comes from the
 * ONE engine (`reconcileManagedRental`, §12.2.1 — never re-derived here).
 *
 * Deliberately conservative (a nudge, never an auto-change):
 *   - needs ≥2 linked deposits (one deposit = timing noise, not a pattern)
 *   - uses the MEDIAN deposit (a lone repair month must not skew the base)
 *   - never flags one-off rows, non-rental types, or streams that already
 *     have a derived agent-cost expense
 */
export interface RentGapFlag {
  /** Declared gross normalised to the observed disbursement period. */
  grossPerPeriod: number;
  /** The median observed deposit for that period. */
  netPerPeriod: number;
  /** The likely missing deduction, per period + annualised. */
  gapPerPeriod: number;
  gapAnnual: number;
  disbursementFrequency: Frequency;
}

export function detectRentGap(row: {
  incomeType: string | null | undefined;
  isRecurring?: boolean | null;
  /** Declared gross — Income.amount + Income.frequency. */
  declaredAmount: number;
  declaredFrequency: string | null | undefined;
  /** The stream's linked deposits (date + absolute amount). */
  transactions: Array<{ date: Date | string; amount: number }>;
  /** True when a derived agent-cost expense already exists for the stream. */
  hasAgentCostExpense: boolean;
}): RentGapFlag | null {
  const type = row.incomeType?.toUpperCase();
  if (type !== 'RENT' && type !== 'RENTAL') return null;
  if (row.isRecurring === false) return null; // one-offs have no run-rate
  if (row.hasAgentCostExpense) return null; // already captured
  if (!(row.declaredAmount > 0)) return null;

  const declaredFrequency = normalizeFrequency(row.declaredFrequency);
  if (!declaredFrequency) return null;

  const txs = row.transactions.filter((t) => Number.isFinite(t.amount) && t.amount > 0);
  if (txs.length < 2) return null; // one deposit is noise, not a pattern

  // Median deposit — robust against a lone anomalous month.
  const amounts = txs.map((t) => t.amount).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 1 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;

  const r = reconcileManagedRental({
    declaredGrossAmount: row.declaredAmount,
    declaredGrossFrequency: declaredFrequency,
    netDisbursementAmount: median,
    disbursementDates: txs.map((t) => t.date),
  });

  if (!r.material) return null;

  return {
    grossPerPeriod: r.grossPerDisbursementPeriod,
    netPerPeriod: median,
    gapPerPeriod: r.gap,
    gapAnnual: r.gapAnnual,
    disbursementFrequency: r.disbursementFrequency,
  };
}

export function detectCadenceMismatch(row: {
  frequency: string | null | undefined;
  isRecurring?: boolean | null;
  transactionDates: Array<Date | string>;
}): CadenceMismatchFlag | null {
  // One-offs are counted once — a cadence disagreement is meaningless.
  if (row.isRecurring === false) return null;

  const stored = normalizeFrequency(row.frequency);
  if (!stored) return null;

  const dates = row.transactionDates
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length < 3) return null;

  const { frequency: implied, confidence } = detectFrequency(dates);
  if (confidence < 0.7) return null;
  if (implied === stored) return null;

  return { stored, implied, confidence, transactionCount: dates.length };
}

// =============================================================================
// MON-090 — stale-stream detector (date + frequency awareness, Reza 2026-07-20)
// =============================================================================

export interface StaleStreamFlag {
  /** ISO date of the newest linked payment. */
  lastPaymentAt: string;
  /** Whole days since that payment (at detection time). */
  daysSince: number;
  /** The cadence interval (days) the threshold was derived from. */
  expectedIntervalDays: number;
}

/**
 * A RECURRING row whose newest linked payment is older than ~1.5× its own
 * cadence interval — the stream has gone quiet, so its cadence average must
 * not masquerade as current income/spend ("Nothing since 12 Jun"). Pure
 * display nudge; nothing auto-changes. ONE producer for every surface
 * (income / expenses / loans routes) — §12.2.1.
 */
export function detectStaleStream(row: {
  frequency: string | null | undefined;
  isRecurring?: boolean | null;
  lastTransactionAt: Date | string | null | undefined;
  now?: Date;
}): StaleStreamFlag | null {
  if (row.isRecurring === false) return null; // one-off: staleness is meaningless
  if (!row.lastTransactionAt) return null; // no payments linked → nothing to date

  const stored = normalizeFrequency(row.frequency);
  if (!stored) return null;

  const last =
    row.lastTransactionAt instanceof Date
      ? row.lastTransactionAt
      : new Date(row.lastTransactionAt);
  if (Number.isNaN(last.getTime())) return null;

  const expectedIntervalDays = 365.25 / periodsPerYear(stored as Frequency);
  const now = row.now ?? new Date();
  const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= expectedIntervalDays * 1.5) return null;

  return {
    lastPaymentAt: last.toISOString(),
    daysSince: Math.floor(daysSince),
    expectedIntervalDays: Math.round(expectedIntervalDays * 100) / 100,
  };
}
