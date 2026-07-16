/**
 * classifyIntake — the ONE canonical intake classifier (MON-078, the keystone
 * of the Intake-Integrity Wall — docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md).
 *
 * Every producer that creates an Income or Expense row MUST decide
 * `frequency`, `isRecurring`, and stream-reuse THROUGH this function — no
 * producer may default them locally. The R1 build-gate source-lock
 * (tests/intake/intakeSourceLock.test.ts) fails CI on any bypass or any
 * silent `'MONTHLY'` literal at a producer site.
 *
 * Why: the recurring bug families all started here —
 *   - MON-001: weekly rent stored MONTHLY (~4.3× under-annualised)
 *   - MON-023→037→053: one-off deposits stored recurring-MONTHLY (×12 phantom)
 *   - MON-076/037: each import minted a NEW row instead of reusing the stream
 * because every producer carried its own silent defaults.
 *
 * PART-1 CONTRACT (behaviour-preserving): this file centralises the decisions
 * exactly as the producers made them before, with every legacy default named
 * and documented below. The wall's controls then tighten HERE, in one place:
 *   - C1 (MON-001): evidence-derived cadence replaces LEGACY_FALLBACK_FREQUENCY
 *   - C2 (MON-053 class): source-aware recurrence replaces the legacy
 *     recurring-true defaults for import paths
 *   - C3 (MON-076): stream-reuse policies grow richer (user-reviewed merge)
 *
 * PURE (§6.4): no fetching. Callers fetch candidate rows and pass them in.
 * Updates (PUT) are deliberately NOT routed here: an update is a user edit of
 * an existing classification, not intake — injecting defaults into a partial
 * update is the exact unsafe behaviour this wall removes.
 */

import { Frequency } from '@/lib/types/prisma-enums';
import { sameMerchant } from '@/lib/bank/merchantNormalize';
import {
  isNearDuplicateEntry,
  type EntryForDuplicateCheck,
} from '@/lib/utils/reconciliation';

// =============================================================================
// Types
// =============================================================================

/** Where the row is coming from — drives the safe-default table. */
export type IntakeSource =
  | 'MANUAL' // user typed it into a form (income/expense pages, bulk add)
  | 'TRANSACTION_LINK' // user linked a bank transaction (TransactionLinkDialog)
  | 'DOCUMENT_IMPORT' // document-analysis confirm flow (receipts, statements)
  | 'ONBOARDING' // onboarding wizard
  | 'RECURRING_DETECTION'; // bank recurring-payment pattern detection

/** How stream-reuse should be decided for this intake. */
export type StreamPolicy =
  /** The scope itself is the stream identity (MON-009 rental rule): any
   *  existing row on the scope IS the stream — reuse it unconditionally. */
  | 'scope-singleton'
  /** Merchant identity (MON-011/025 + MON-037 RC-B): normalised name equality
   *  → exact; token-containment + ≤10% amount → near-duplicate. */
  | 'merchant'
  | 'none';

export interface IntakeExistingRow extends EntryForDuplicateCheck {
  id: string;
}

export interface IntakeSignal {
  kind: 'income' | 'expense';
  source: IntakeSource;
  /** The explicit cadence supplied by the user/import payload, if any. */
  declaredFrequency?: string | null;
  /** The explicit recurrence choice supplied by the caller, if any. */
  declaredIsRecurring?: boolean | null;
  /** Cadence derived from transaction evidence (recurring-payment patterns
   *  today; C1 promotes per-row transaction cadence here). */
  detectedFrequency?: string | null;
  /** The row about to be created — needed for `merchant` stream matching. */
  candidate?: EntryForDuplicateCheck | null;
  /** Existing rows on the SAME linking scope (caller fetches; this is pure). */
  existingRows?: IntakeExistingRow[];
  streamPolicy?: StreamPolicy;
}

export interface IntakeClassification {
  frequency: Frequency;
  isRecurring: boolean;
  /** Existing row this intake must reuse/update instead of minting a sibling.
   *  `exact` → reuse silently; `near-duplicate` → reuse (link paths) or
   *  surface for user review (C3 tightens this per-path). */
  streamMatch: { id: string; confidence: 'exact' | 'near-duplicate' } | null;
}

// =============================================================================
// Frequency
// =============================================================================

const FREQUENCIES: readonly Frequency[] = [
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'HALF_YEARLY',
];

/**
 * THE legacy silent default, now living in exactly ONE named place instead of
 * scattered `|| 'MONTHLY'` literals. C1 (MON-001) replaces this with
 * evidence-derived cadence; until then, import paths that historically
 * defaulted to monthly keep doing so HERE, visibly.
 */
const LEGACY_FALLBACK_FREQUENCY: Frequency = 'MONTHLY';

/** Normalise a raw cadence string to the Frequency enum (ANNUALLY → ANNUAL).
 *  WEEKLY/FORTNIGHTLY are preserved as themselves — never coerced (C1 rule,
 *  in force from day one for explicit input). */
export function normalizeFrequency(raw: string | null | undefined): Frequency | null {
  if (!raw) return null;
  const up = String(raw).toUpperCase().trim();
  const mapped = up === 'ANNUALLY' ? 'ANNUAL' : up;
  return (FREQUENCIES as readonly string[]).includes(mapped) ? (mapped as Frequency) : null;
}

// =============================================================================
// The classifier
// =============================================================================

export function classifyIntake(signal: IntakeSignal): IntakeClassification {
  return {
    frequency: resolveFrequency(signal),
    isRecurring: resolveIsRecurring(signal),
    streamMatch: resolveStreamMatch(signal),
  };
}

function resolveFrequency(signal: IntakeSignal): Frequency {
  const declared = normalizeFrequency(signal.declaredFrequency);
  if (declared) return declared;

  const detected = normalizeFrequency(signal.detectedFrequency);
  if (detected) return detected;

  // MANUAL/ONBOARDING intake carries the user's explicit choice — a missing
  // cadence there is a caller bug, never something to paper over with a
  // silent default (the MON-001 mechanism).
  if (signal.source === 'MANUAL' || signal.source === 'ONBOARDING') {
    throw new Error(
      `classifyIntake: ${signal.source} ${signal.kind} intake requires an explicit frequency (got ${JSON.stringify(signal.declaredFrequency)})`,
    );
  }

  // LEGACY (C1 target): import paths historically defaulted to MONTHLY.
  return LEGACY_FALLBACK_FREQUENCY;
}

/**
 * The source-default table (spec §3). `declaredIsRecurring` always wins.
 * Rows marked LEGACY are the C2 targets — they keep today's behaviour until
 * the C2 control lands, but the default now lives here, named, in one place.
 */
function resolveIsRecurring(signal: IntakeSignal): boolean {
  if (signal.declaredIsRecurring != null) return signal.declaredIsRecurring;

  switch (signal.source) {
    case 'MANUAL':
    case 'ONBOARDING':
      // A user declaring an income/expense declares a stream (Reza decision
      // 2026-07-15: manual/declared = recurring).
      return true;
    case 'RECURRING_DETECTION':
      // The evidence IS a recurring pattern.
      return true;
    case 'TRANSACTION_LINK':
      // The link dialog sends an explicit choice (count≤1 → one-off, MON-053);
      // the server-side fallback differs by kind today:
      // income → true (LEGACY — C2 target), expense → false (#1421).
      return signal.kind === 'income';
    case 'DOCUMENT_IMPORT':
      // LEGACY (C2 target): a lone invoice/receipt should classify one-off;
      // today the analyzer's flag wins and absent means recurring.
      return true;
  }
}

function resolveStreamMatch(
  signal: IntakeSignal,
): IntakeClassification['streamMatch'] {
  const rows = signal.existingRows ?? [];
  if (!rows.length) return null;

  switch (signal.streamPolicy ?? 'none') {
    case 'scope-singleton':
      // MON-009: the scope (e.g. property + RENT) admits ONE stream — the
      // first existing row IS it, regardless of name/amount drift.
      return { id: rows[0].id, confidence: 'exact' };
    case 'merchant': {
      if (!signal.candidate) return null;
      const exact = rows.find((r) => sameMerchant(r.name, signal.candidate!.name));
      if (exact) return { id: exact.id, confidence: 'exact' };
      const near = rows.find((r) => isNearDuplicateEntry(signal.candidate!, r));
      return near ? { id: near.id, confidence: 'near-duplicate' } : null;
    }
    case 'none':
      return null;
  }
}
