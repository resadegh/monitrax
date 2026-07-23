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
import { sameMerchant, hasDisjointIdentifiers } from '@/lib/bank/merchantNormalize';
import {
  detectFrequency,
  isNearDuplicateEntry,
  DUPLICATE_AMOUNT_TOLERANCE,
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
   *  → exact; token-containment + ≤10% amount → near-duplicate. Candidates are
   *  pre-filtered to ONE scope by the caller. */
  | 'merchant'
  /** Mechanism A keystone (MON-084/085/074/076, Calc-SSOT Wall): SOURCE
   *  SIGNATURE identity = (kind, type, normalised name, ownerEntityId) — the
   *  caller supplies USER-WIDE candidates of the same kind/type/owner (NOT
   *  pre-filtered to a propertyId/loanId/assetId scope), and the classifier
   *  applies the scope-compatibility rule:
   *
   *    a candidate row and the intake row may converge when they are on the
   *    SAME scope, or when AT LEAST ONE of them is scopeless (General) —
   *    NEVER across two DIFFERENT non-null scopes.
   *
   *  Why: the live duplicates this kills are the SAME real source minted with
   *  and without a scope ("Battery" on HOME vs "Battery" on General; an
   *  Ingeus salary declared row vs its scopeless reconciled twin). Two rows
   *  on two DIFFERENT scopes (QBE insurance on property A vs property B;
   *  Cienna PM Trust rent for Lot 1 vs Lot 2) are DISTINCT real streams that
   *  merely share a payer — Reza has corrected an over-merge here before, so
   *  the guard lives in the classifier, not in caller discipline. */
  | 'source-signature'
  | 'none';

export interface IntakeExistingRow extends EntryForDuplicateCheck {
  id: string;
  /** The row's linking scope for the `source-signature` compatibility rule —
   *  `propertyId ?? loanId ?? assetId ?? investmentAccountId ?? null`.
   *  Only consulted by the `source-signature` policy. */
  scopeKey?: string | null;
}

export interface IntakeSignal {
  kind: 'income' | 'expense';
  source: IntakeSource;
  /** The explicit cadence supplied by the user/import payload, if any. */
  declaredFrequency?: string | null;
  /** The explicit recurrence choice supplied by the caller, if any. */
  declaredIsRecurring?: boolean | null;
  /** Cadence derived from transaction evidence by an upstream detector
   *  (e.g. recurring-payment patterns). */
  detectedFrequency?: string | null;
  /** C1 (MON-001): the raw evidence — dates of the same-source transactions
   *  backing this row. With ≥2 dates the classifier derives the cadence
   *  itself via the ONE canonical detector (lib/utils/reconciliation.ts
   *  `detectFrequency`), so weekly/fortnightly streams are stored as
   *  WEEKLY/FORTNIGHTLY — never silently monthly. */
  transactionDates?: Array<Date | string>;
  /** The row about to be created — needed for `merchant` / `source-signature`
   *  stream matching. `scopeKey` carries the intake row's linking scope for
   *  the `source-signature` compatibility rule. */
  candidate?: (EntryForDuplicateCheck & { scopeKey?: string | null }) | null;
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

  // C1 (MON-001): derive the cadence from the transaction evidence itself —
  // ≥2 dated same-source transactions → the ONE canonical detector. This is
  // what stops a weekly rent stream being stored MONTHLY (~4.3× understated)
  // when the caller supplied no explicit cadence.
  const dates = (signal.transactionDates ?? [])
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length >= 2) {
    return detectFrequency(dates).frequency;
  }

  // MANUAL/ONBOARDING intake carries the user's explicit choice — a missing
  // cadence there is a caller bug, never something to paper over with a
  // silent default (the MON-001 mechanism).
  if (signal.source === 'MANUAL' || signal.source === 'ONBOARDING') {
    throw new Error(
      `classifyIntake: ${signal.source} ${signal.kind} intake requires an explicit frequency (got ${JSON.stringify(signal.declaredFrequency)})`,
    );
  }

  // LEGACY (C2/C1 residual): an import with NO cadence evidence at all —
  // a lone receipt/deposit. Kept until every such path classifies one-off
  // (where cadence is moot); named here so it can never hide in a producer.
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

/**
 * MON-095 — the EXPENSE duplicate-compatibility guard (the AIA class,
 * Reza live review 2026-07-23). `normalizeMerchant` strips policy/account
 * numbers before names compare, so "Aia … 68718123" ($131) and
 * "Aia … 68718100" ($158) — two DIFFERENT policies — normalised to the
 * same name and grouped as exact duplicates; merging would delete a real
 * policy. Two rules, applied to the exact AND near paths of both
 * name-matching policies, in this ONE decision layer (§12.2.1 — the
 * intake guardrail and the Housekeeping duplicates preview both read it):
 *
 *   1. AMOUNT GUARD: same-name expenses only converge inside the ONE
 *      near-duplicate band (`DUPLICATE_AMOUNT_TOLERANCE`, ≤10%) — a
 *      20%-different premium is a different policy, not a duplicate.
 *   2. IDENTIFIER FAIL-SAFE: when both raw names carry policy/account
 *      identifier tokens (long digit runs, ABN/ACN excluded) and they
 *      share NONE, the rows are distinct sources — never auto-merged,
 *      whatever the amounts. Fail safe: a wrongly-split duplicate merely
 *      waits for Reza's review; a wrongly-merged policy loses data.
 *
 * EXPENSE-SCOPED by pinned doctrine: INCOME deliberately converges across
 * amount drift (a declared salary and its reconciled twin differ — the
 * Mechanism A rule, locked by ring2.mechanismA.intakeDedup), and income
 * deposit descriptors carry per-payment reference numbers — an identifier
 * veto there would re-fragment salaries (the MON-076 class).
 */
function expenseDuplicateCompatible(
  signal: IntakeSignal,
  row: IntakeExistingRow,
): boolean {
  if (signal.kind !== 'expense' || !signal.candidate) return true;
  if (hasDisjointIdentifiers(signal.candidate.name, row.name)) return false;
  const a = Math.abs(signal.candidate.amount);
  const b = Math.abs(row.amount);
  if (a > 0 && b > 0 && Math.abs(a - b) > Math.max(a, b) * DUPLICATE_AMOUNT_TOLERANCE) {
    return false;
  }
  return true;
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
      const exact = rows.find(
        (r) => sameMerchant(r.name, signal.candidate!.name) && expenseDuplicateCompatible(signal, r),
      );
      if (exact) return { id: exact.id, confidence: 'exact' };
      const near = rows.find(
        (r) => isNearDuplicateEntry(signal.candidate!, r) && expenseDuplicateCompatible(signal, r),
      );
      return near ? { id: near.id, confidence: 'near-duplicate' } : null;
    }
    case 'source-signature': {
      // Mechanism A: merchant identity over USER-WIDE candidates, gated by
      // scope compatibility (same scope, or at least one side scopeless).
      // Same-scope matches are preferred over cross-scope ones so an
      // established same-scope stream always wins.
      if (!signal.candidate) return null;
      const candScope = signal.candidate.scopeKey ?? null;
      const compatible = rows.filter((r) => {
        const rowScope = r.scopeKey ?? null;
        return rowScope === candScope || rowScope === null || candScope === null;
      });
      const ranked = [
        ...compatible.filter((r) => (r.scopeKey ?? null) === candScope),
        ...compatible.filter((r) => (r.scopeKey ?? null) !== candScope),
      ];
      const exact = ranked.find(
        (r) => sameMerchant(r.name, signal.candidate!.name) && expenseDuplicateCompatible(signal, r),
      );
      if (exact) return { id: exact.id, confidence: 'exact' };
      const near = ranked.find(
        (r) => isNearDuplicateEntry(signal.candidate!, r) && expenseDuplicateCompatible(signal, r),
      );
      return near ? { id: near.id, confidence: 'near-duplicate' } : null;
    }
    case 'none':
      return null;
  }
}

// =============================================================================
// MON-094 — non-assessable receipt detection (Reza rule 2026-07-21:
// "assessable-only, exclude all non-assessable — auto")
// =============================================================================

export interface NonAssessableDetection {
  /** The TaxCategory to store on the row (Prisma enum value). */
  taxCategory: 'TAX_EXEMPT';
  /** Which rule matched — for taxNotes + the review surface. */
  kind: 'ATO_REFUND' | 'INTERNAL_TRANSFER' | 'LOAN_DRAWDOWN';
  /** Plain-English reason, stored as Income.taxNotes. */
  reason: string;
}

/**
 * Detect a NON-ASSESSABLE receipt from its descriptor, at intake.
 *
 * The tax gross is assessable income only (ITAA 1997 s6-5): an ATO tax
 * refund is a return of tax already paid, an internal transfer is your own
 * money moving between accounts, and a loan drawdown is borrowing — none of
 * them are income. A detected row is stored with `taxCategory: TAX_EXEMPT`
 * (+ the reason as `taxNotes`) so the ONE taxability engine
 * (`determineTaxability`, NON_ASSESSABLE_TAX_CATEGORIES) counts it at $0 —
 * assessability is decided in the engine, never re-derived per surface.
 *
 * DELIBERATELY CONSERVATIVE (§10 never-guess): patterns match the bank
 * descriptor shapes verified live (VR-019/VR-020: "Ato Ato002000023189359",
 * "Ato Ato001100022493651") plus the unambiguous transfer/drawdown wordings.
 * A miss stays taxable-for-safety and can be reclassified on the review
 * surface with Reza's per-row confirm (§12.11) — a false negative costs a
 * click; a false positive would silently understate tax, so the list stays
 * tight. Extending the list = editing THIS function (one source), surfaced
 * in the PR for Reza's confirmation.
 */
export function detectNonAssessable(name: string | null | undefined): NonAssessableDetection | null {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();

  // ATO tax refunds — "Ato Ato00…" descriptor shape, or explicit wording.
  if (/^ato\b/.test(n) || /\baustralian taxation office\b/.test(n) || /\btax (?:return )?refund\b/.test(n)) {
    return {
      taxCategory: 'TAX_EXEMPT',
      kind: 'ATO_REFUND',
      reason:
        'ATO tax refund — a return of tax already paid, not assessable income (ITAA 1997 s6-5). Auto-classified non-assessable (MON-094).',
    };
  }

  // Internal transfers — own-account movements are not income.
  if (/\binternal transfer\b/.test(n) || /\btransfer (?:to|from|between) (?:own |my )?(?:acct|account)/.test(n)) {
    return {
      taxCategory: 'TAX_EXEMPT',
      kind: 'INTERNAL_TRANSFER',
      reason:
        'Internal transfer between your own accounts — not income. Auto-classified non-assessable (MON-094).',
    };
  }

  // Loan / director-loan drawdowns — borrowings are not income.
  if (/\b(?:loan|director'?s? loan) (?:drawdown|advance)\b/.test(n) || /\bredraw\b/.test(n) || /\bdrawdown\b/.test(n)) {
    return {
      taxCategory: 'TAX_EXEMPT',
      kind: 'LOAN_DRAWDOWN',
      reason:
        'Loan drawdown/redraw — borrowed money is not income. Auto-classified non-assessable (MON-094).',
    };
  }

  return null;
}
