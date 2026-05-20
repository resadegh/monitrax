/**
 * debtsSync — Phase 12 Track F.4: onboarding ⇄ real-table two-way sync
 * for the DEBTS domain (non-property loans: car / student / personal /
 * business).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.4 makes the debts
 * domain read + write the real `Loan` table directly. Mirrors the F.1–F.3
 * `*Sync.ts` pattern.
 *
 * Scope boundary (vs F.2): a "debt" here is a `Loan` whose `type` is one of
 * `CAR` / `STUDENT` / `PERSONAL` / `BUSINESS` — a STANDALONE, non-property
 * loan captured on the wizard's Debts step. Property mortgages
 * (`type` HOME / INVESTMENT, `propertyId` set) are F.2's domain — written
 * by the properties step, NOT here. `readDebts()` filters by `type` so the
 * two domains never collide.
 *
 * ============================================================================
 * NO SCHEMA CHANGE — the loan routes were already prepared by F.2
 * ============================================================================
 * F.2 already added `createAuditLog()` to `/api/loans` (POST + `[id]`
 * PUT/DELETE — generic `CREATE/UPDATE/DELETE`, `entityType: 'Loan'`) and
 * relaxed the numeric validation (`minRepayment` / `termMonthsRemaining`
 * accept 0 — HECS has a 0 minimum). F.4 reuses that route surface as-is:
 * no new `AuditAction` values, no migration.
 *
 * ============================================================================
 * THE CAR → VEHICLE LINK IS NOT F.4's
 * ============================================================================
 * A CAR debt can carry `linkedAssetId` (a link to a vehicle `Asset`). F.4
 * deliberately does NOT write it: the Assets step comes AFTER Debts and is
 * not migrated until F.7, so during the Debts step the vehicle has no real
 * `Asset` row — sending a synthetic id would fail the loan API's
 * related-ownership check. F.4 writes the debt's core fields only; the
 * CAR↔Asset link is wired by `bulk-create`'s post-Assets pass (and, once
 * F.7 ships, by the Assets step). See `PHASE_12_ONBOARDING_TWO_WAY_SYNC.md`
 * §6.4.
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new debts (no real id) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for debts with a real-table `id`, via the
 *     ownership-guarded per-id loan API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffDebts()` is pure; a no-edit re-entry
 *     diffs to zero ops.
 *  4. AUDIT — the loan routes audit every state-changing write (F.2).
 *
 * `diffDebts()` is PURE — the unit-testable idempotency core.
 * `readDebts()` / `syncDebts()` do the network I/O.
 */

import type { DebtLoanType, RepaymentFrequency, DebtInput } from '@/components/onboarding/wizard/types';

/** The `Loan.type` values the Debts step owns. */
const DEBT_TYPES: readonly DebtLoanType[] = ['CAR', 'STUDENT', 'PERSONAL', 'BUSINESS'];

// ============================================================================
// Snapshot shape
// ============================================================================

/** A debt as it exists in the real `Loan` table. */
export interface DebtRecord {
  /** Real-table `Loan` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  type: DebtLoanType;
  /** Wizard-only UI sugar — the real `Loan` table has no lender column, so
   *  this does NOT round-trip (blank on re-read). Carried so the wizard
   *  step can hold it for the session; excluded from the change-diff. */
  lender: string;
  principal: number;
  /** PERCENTAGE — e.g. 6.5 means 6.5% p.a. (the real table stores a decimal). */
  interestRateAnnual: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  termMonthsRemaining: number;
  /** Derived from `type === 'STUDENT'`; not a real column. */
  isHecsHelp: boolean;
}

export interface DebtsSnapshot {
  debts: DebtRecord[];
}

export const EMPTY_DEBTS_SNAPSHOT: DebtsSnapshot = { debts: [] };

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real `Loan` id is a uuid. The wizard mints synthetic ids — `temp_…`
 * (`generateId()`) and `chat-…` (chat mode). `isPersistedId` distinguishes
 * them so the diff classifies a synthetic-id debt as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

// ============================================================================
// READ — `readDebts()`
// ============================================================================

interface RawLoan {
  id: string;
  name: string;
  type: string;
  principal: number;
  interestRateAnnual: number; // decimal in the DB
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  termMonthsRemaining: number;
  propertyId: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Read the user's standalone debts from the real `Loan` table.
 *
 * GET `/api/loans` returns every loan; we keep only the non-property debt
 * types (`CAR` / `STUDENT` / `PERSONAL` / `BUSINESS`). Property mortgages
 * are F.2's domain and are skipped here. The endpoint returns
 * `{ data: [...] }` (no `success` envelope).
 *
 * Loan interest rate is converted DB-decimal → wizard-percentage.
 */
export async function readDebts(token: string | null): Promise<DebtsSnapshot> {
  const res = await fetch('/api/loans', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your debts. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawLoan[] = Array.isArray(json?.data) ? json.data : [];

  return {
    debts: rows
      .filter((l) => DEBT_TYPES.includes(l.type as DebtLoanType))
      .map((l): DebtRecord => ({
        id: l.id,
        name: l.name,
        type: l.type as DebtLoanType,
        // The real table has no lender column — it does not round-trip.
        lender: '',
        principal: l.principal,
        interestRateAnnual: round2(l.interestRateAnnual * 100),
        minRepayment: l.minRepayment,
        repaymentFrequency: l.repaymentFrequency,
        termMonthsRemaining: l.termMonthsRemaining,
        isHecsHelp: l.type === 'STUDENT',
      })),
  };
}

// ============================================================================
// DIFF — `diffDebts()` — the PURE idempotency core
// ============================================================================

export interface DebtOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  record: DebtRecord;
}

export interface DebtsDiff {
  /** Only debts that need a write appear here. A no-edit re-entry produces
   *  `debtOps: []` → `syncDebts` does nothing. */
  debtOps: DebtOp[];
}

function debtFieldsEqual(a: DebtRecord, b: DebtRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    a.principal === b.principal &&
    a.interestRateAnnual === b.interestRateAnnual &&
    a.minRepayment === b.minRepayment &&
    a.repaymentFrequency === b.repaymentFrequency &&
    a.termMonthsRemaining === b.termMonthsRemaining
    // `lender` is excluded — it is not persisted, so comparing it is
    // meaningless. `isHecsHelp` is excluded — it is derived from `type`.
  );
}

/**
 * Diff the wizard step's CURRENT debts against the step-open snapshot.
 *
 * Re-opening the step and clicking "Continue" with zero edits produces
 * `debtOps: []` — so `syncDebts()` performs ZERO writes and no duplicate
 * rows can appear.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 */
export function diffDebts(snapshot: DebtsSnapshot, current: DebtsSnapshot): DebtsDiff {
  const snapshotById = new Map(
    snapshot.debts.filter((d) => d.id).map((d) => [d.id as string, d]),
  );
  const currentIds = new Set(
    current.debts.filter((d) => d.id).map((d) => d.id as string),
  );

  const debtOps: DebtOp[] = [];

  for (const d of current.debts) {
    if (!d.id) {
      debtOps.push({ op: 'create', record: { ...d, id: undefined } });
      continue;
    }
    const prev = snapshotById.get(d.id);
    if (!prev) {
      // Has an id the snapshot doesn't know — treat as create defensively.
      debtOps.push({ op: 'create', record: { ...d, id: undefined } });
      continue;
    }
    if (!debtFieldsEqual(prev, d)) {
      debtOps.push({ op: 'update', id: d.id, record: d });
    }
    // else: unchanged → NO-OP (idempotency §5.3).
  }

  for (const prev of snapshot.debts) {
    if (prev.id && !currentIds.has(prev.id)) {
      debtOps.push({ op: 'delete', id: prev.id, record: prev });
    }
  }

  return { debtOps };
}

// ============================================================================
// WRITE — `syncDebts()`
// ============================================================================

export interface DebtsSyncResult {
  /** The debts as they now exist in the real table (re-read after writes). */
  snapshot: DebtsSnapshot;
}

/** Build the `/api/loans` POST/PUT body for a debt. A debt is always a
 *  VARIABLE-rate, non-interest-only, non-property loan; the CAR→vehicle
 *  link (`linkedAssetId`) is intentionally NOT sent — see the file header. */
function debtPayload(d: DebtRecord): Record<string, unknown> {
  return {
    name: d.name.trim() || d.type,
    type: d.type,
    principal: d.principal,
    // Wizard works in percent; the real table stores a decimal.
    interestRateAnnual: d.interestRateAnnual / 100,
    rateType: 'VARIABLE',
    isInterestOnly: false,
    termMonthsRemaining: d.termMonthsRemaining || 60,
    // HECS / HELP is income-contingent — no fixed minimum repayment.
    minRepayment: d.isHecsHelp ? 0 : d.minRepayment,
    repaymentFrequency: d.repaymentFrequency || 'MONTHLY',
  };
}

/**
 * Persist the wizard step's debts to the real `Loan` table.
 *
 * Algorithm:
 *   1. Diff `current` against `snapshot` (pure — see `diffDebts`).
 *   2. Apply each op via the ownership-guarded loan API (POST / PUT /
 *      DELETE).
 *   3. Re-read and return the fresh snapshot so the caller can re-seed the
 *      step state with real-table ids (making the NEXT Continue idempotent).
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncDebts(
  token: string | null,
  snapshot: DebtsSnapshot,
  current: DebtsSnapshot,
): Promise<DebtsSyncResult> {
  const diff = diffDebts(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.debtOps) {
    if (op.op === 'create') {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers,
        body: JSON.stringify(debtPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not save the debt "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else if (op.op === 'update') {
      const res = await fetch(`/api/loans/${op.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(debtPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not update the debt "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else {
      const res = await fetch(`/api/loans/${op.id}`, { method: 'DELETE', headers });
      // 404 = already gone (retry after a partial success) — treat as success.
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Could not remove the debt "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    }
  }

  const fresh = await readDebts(token);
  return { snapshot: fresh };
}

// ============================================================================
// MAPPERS — bridge `DebtsSnapshot` ⇄ wizard `WizardData.debts`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(): string {
  syntheticCounter += 1;
  return `temp_debt_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `DebtInput[]`. The real
 * `Loan` id becomes the wizard `id` (so the step's edit/delete logic and
 * the diff on Continue can tell saved rows from new ones).
 */
export function snapshotToWizardDebts(snapshot: DebtsSnapshot): DebtInput[] {
  return snapshot.debts.map((d): DebtInput => ({
    id: d.id ?? syntheticId(),
    name: d.name,
    type: d.type,
    lender: d.lender,
    principal: d.principal,
    interestRateAnnual: d.interestRateAnnual,
    minRepayment: d.minRepayment,
    repaymentFrequency: d.repaymentFrequency,
    termMonthsRemaining: d.termMonthsRemaining,
    isHecsHelp: d.isHecsHelp,
  }));
}

/**
 * Map the wizard step's `DebtInput[]` → a `DebtsSnapshot` for `diffDebts` /
 * `syncDebts`. Synthetic ids drop to `undefined` so the diff classifies
 * them as CREATE.
 *
 * An unpersisted debt with `principal <= 0` is dropped — an outstanding
 * balance is what defines a debt, so an incomplete in-session card is left
 * in-session (matches `bulk-create`'s `principal <= 0` skip). A persisted
 * debt is always kept, so blanking the balance can never silently DELETE a
 * persisted debt.
 */
export function wizardDebtsToSnapshot(debts: DebtInput[]): DebtsSnapshot {
  return {
    debts: debts
      .filter((d) => isPersistedId(d.id) || d.principal > 0)
      .map((d): DebtRecord => ({
        id: isPersistedId(d.id) ? d.id : undefined,
        name: d.name,
        type: d.type,
        lender: d.lender ?? '',
        principal: d.principal,
        interestRateAnnual: d.interestRateAnnual,
        minRepayment: d.minRepayment,
        repaymentFrequency: d.repaymentFrequency,
        termMonthsRemaining: d.termMonthsRemaining ?? 60,
        isHecsHelp: d.isHecsHelp ?? d.type === 'STUDENT',
      })),
  };
}
