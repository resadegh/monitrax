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
import { normalizeFrequency } from '@/lib/intake/classifyIntake';

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
