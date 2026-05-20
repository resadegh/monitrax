/**
 * accountsSync — Phase 12 Track F.3: onboarding ⇄ real-table two-way sync
 * for the ACCOUNTS domain (bank / transaction / savings / offset / credit).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.3 makes the accounts
 * domain read + write the real `Account` table directly, replacing the
 * draft-staged + `/api/onboarding/bulk-create` model for MANUAL accounts.
 * Mirrors the F.1 (`householdSync.ts`) / F.2 (`propertiesSync.ts`) pattern —
 * the `Account` entity is flat, so this is the simplest domain layer yet.
 *
 * ============================================================================
 * THREE DATA SOURCES — F.3 syncs ONLY the MANUAL ones
 * ============================================================================
 * A bank account in the wizard has one of three provenances:
 *   - MANUAL — the user typed the balance in the wizard. Pre-F.3 these were
 *     draft-staged and written once at bulk-create. **F.3 makes these
 *     read/write the real `Account` table directly.**
 *   - BASIQ  — imported via the Basiq Open Banking consent flow. The real
 *     `Account` row already exists (written by the Basiq sync).
 *   - IMPORT — created by the Phase 18 CSV/OFX/QIF file-import flow. The
 *     real `Account` row already exists.
 *
 * **F.3's diff/write operates ONLY on MANUAL accounts.** BASIQ / IMPORT
 * accounts are read + displayed so the user sees their full picture, but
 * they are NEVER created, updated or deleted by this sync — they are owned
 * by their source (the Basiq connection / the import flow). This matches
 * the pre-F.3 behaviour exactly (bulk-create skipped BASIQ/IMPORT) and is
 * data-safe: the wizard can never destroy an externally-sourced account.
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new MANUAL accounts (no real id) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for MANUAL accounts that ALREADY have a
 *     real-table `id`, routed through the ownership-guarded per-id API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffAccounts()` compares current state
 *     against the step-open snapshot; a no-edit re-entry diffs to zero ops.
 *  4. AUDIT — the account entity routes audit every state-changing write
 *     via `createAuditLog()` (added in F.3).
 *
 * ============================================================================
 * OFFSET → LOAN LINK
 * ============================================================================
 * An OFFSET account points at a mortgage. The link is stored on the loan
 * (`Loan.offsetAccountId`). F.3 carries `linkedLoanId` on the account record
 * and passes it to `/api/accounts` POST/PUT — the route sets
 * `Loan.offsetAccountId` server-side (ownership-verified). Property loans
 * carry real ids after F.2, so `linkedLoanId` is a real `Loan` id by the
 * time the accounts step runs (the properties step precedes it).
 *
 * ============================================================================
 * PURE vs IMPURE
 * ============================================================================
 * `diffAccounts()` is PURE — the unit-testable idempotency core.
 * `readAccounts()` / `syncAccounts()` do the network I/O.
 */

import type { AccountType, AccountInput, AccountDataSource } from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape
// ============================================================================

/** An account as it exists in the real `Account` table. */
export interface AccountRecord {
  /** Real-table `Account` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  type: AccountType;
  institution: string;
  currentBalance: number;
  /** Annual interest rate as a decimal (e.g. 0.025 for 2.5%), or undefined. */
  interestRate?: number;
  /** For an OFFSET account — the real `Loan` id it offsets, or undefined. */
  linkedLoanId?: string;
  /** Provenance. F.3 only ever writes `MANUAL` accounts. */
  source: AccountDataSource;
}

export interface AccountsSnapshot {
  accounts: AccountRecord[];
}

export const EMPTY_ACCOUNTS_SNAPSHOT: AccountsSnapshot = { accounts: [] };

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real `Account` id is a uuid. The wizard mints synthetic ids — `temp_…`
 * (`generateId()`) and `chat-…` (chat mode). `isPersistedId` distinguishes
 * them so the diff classifies a synthetic-id account as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

/**
 * The real `Account` id behind a wizard `AccountInput`. A MANUAL account
 * once synced carries its real id as `id`. A BASIQ / IMPORT account carries
 * a synthetic `id` but the real id in the legacy `existingAccountId` field —
 * resolve either. Returns `undefined` for a never-persisted MANUAL account.
 */
export function accountRealId(a: AccountInput): string | undefined {
  if (isPersistedId(a.id)) return a.id;
  if (a.existingAccountId && isPersistedId(a.existingAccountId)) {
    return a.existingAccountId;
  }
  return undefined;
}

/** Normalise a wizard `AccountInput.source` to a definite provenance. */
function normaliseSource(a: AccountInput): AccountDataSource {
  return a.source === 'BASIQ' || a.source === 'IMPORT' ? a.source : 'MANUAL';
}

// ============================================================================
// READ — `readAccounts()`
// ============================================================================

interface RawAccount {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  currentBalance: number;
  interestRate: number | null;
  balanceSource: string | null;
  /** Reverse relation — the `Loan` this account is the offset for. */
  linkedLoan?: { id: string } | null;
}

/** Classify a real `Account.balanceSource` into the wizard's 3-source model.
 *  MANUAL / USER_VERIFIED / null all count as user-entered → `MANUAL`. */
function classifySource(balanceSource: string | null | undefined): AccountDataSource {
  if (balanceSource === 'BASIQ') return 'BASIQ';
  if (balanceSource === 'IMPORT') return 'IMPORT';
  return 'MANUAL';
}

/**
 * Read the user's accounts from the real `Account` table.
 *
 * Mirrors the call `/dashboard/balances` makes: a single GET to
 * `/api/accounts`, which `include`s `linkedLoan`. The endpoint returns
 * `{ data: [...] }` (no `success` envelope) and an empty array for a user
 * with no accounts (NOT a 404).
 */
export async function readAccounts(token: string | null): Promise<AccountsSnapshot> {
  const res = await fetch('/api/accounts', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your accounts. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawAccount[] = Array.isArray(json?.data) ? json.data : [];

  return {
    accounts: rows.map((a): AccountRecord => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution ?? '',
      currentBalance: typeof a.currentBalance === 'number' ? a.currentBalance : 0,
      interestRate: typeof a.interestRate === 'number' ? a.interestRate : undefined,
      linkedLoanId: a.linkedLoan?.id ?? undefined,
      source: classifySource(a.balanceSource),
    })),
  };
}

// ============================================================================
// DIFF — `diffAccounts()` — the PURE idempotency core
// ============================================================================

export interface AccountOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  record: AccountRecord;
}

export interface AccountsDiff {
  /** Only MANUAL accounts that need a write appear here. A no-edit re-entry
   *  produces `accountOps: []` → `syncAccounts` does nothing. */
  accountOps: AccountOp[];
}

function accountFieldsEqual(a: AccountRecord, b: AccountRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    a.institution.trim() === b.institution.trim() &&
    a.currentBalance === b.currentBalance &&
    (a.interestRate ?? null) === (b.interestRate ?? null) &&
    (a.linkedLoanId || '') === (b.linkedLoanId || '')
  );
}

/**
 * Diff the wizard step's CURRENT accounts against the step-open snapshot.
 *
 * **Only MANUAL accounts produce ops.** BASIQ / IMPORT accounts are
 * passthrough — never created, updated or deleted (they are owned by their
 * source). A BASIQ account the user "removed" in the wizard simply produces
 * no op, exactly as pre-F.3 (bulk-create skipped it).
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 *
 * @param snapshot  the accounts as they were when the step opened
 * @param current   the accounts as the user has them now
 */
export function diffAccounts(
  snapshot: AccountsSnapshot,
  current: AccountsSnapshot,
): AccountsDiff {
  const snapshotById = new Map(
    snapshot.accounts
      .filter((a) => a.id && a.source === 'MANUAL')
      .map((a) => [a.id as string, a]),
  );
  const currentManualIds = new Set(
    current.accounts
      .filter((a) => a.id && a.source === 'MANUAL')
      .map((a) => a.id as string),
  );

  const accountOps: AccountOp[] = [];

  for (const a of current.accounts) {
    // BASIQ / IMPORT — externally owned, never written by the wizard sync.
    if (a.source !== 'MANUAL') continue;
    if (!a.id) {
      accountOps.push({ op: 'create', record: { ...a, id: undefined } });
      continue;
    }
    const prev = snapshotById.get(a.id);
    if (!prev) {
      // Has an id the snapshot doesn't know — treat as create defensively.
      accountOps.push({ op: 'create', record: { ...a, id: undefined } });
      continue;
    }
    if (!accountFieldsEqual(prev, a)) {
      accountOps.push({ op: 'update', id: a.id, record: a });
    }
    // else: unchanged → NO-OP (idempotency §5.3).
  }

  // MANUAL accounts in the snapshot the user removed → DELETE. BASIQ/IMPORT
  // removals are intentionally ignored (the wizard never deletes them).
  for (const prev of snapshot.accounts) {
    if (prev.source === 'MANUAL' && prev.id && !currentManualIds.has(prev.id)) {
      accountOps.push({ op: 'delete', id: prev.id, record: prev });
    }
  }

  return { accountOps };
}

// ============================================================================
// WRITE — `syncAccounts()`
// ============================================================================

export interface AccountsSyncResult {
  /** The accounts as they now exist in the real table (re-read after writes). */
  snapshot: AccountsSnapshot;
}

/** Build the `/api/accounts` POST/PUT body. `linkedLoanId` is only sent for
 *  an OFFSET account — the route sets `Loan.offsetAccountId` from it. */
function accountPayload(a: AccountRecord): Record<string, unknown> {
  return {
    name: a.name.trim() || 'Account',
    type: a.type,
    institution: a.institution.trim() || null,
    currentBalance: a.currentBalance,
    interestRate: a.interestRate ?? null,
    linkedLoanId: a.type === 'OFFSET' ? (a.linkedLoanId ?? null) : null,
  };
}

/**
 * Persist the wizard step's MANUAL accounts to the real `Account` table.
 *
 * Algorithm:
 *   1. Diff `current` against `snapshot` (pure — see `diffAccounts`).
 *   2. Apply each op via the ownership-guarded entity API (POST create /
 *      PUT update / DELETE delete).
 *   3. Re-read and return the fresh snapshot so the caller can re-seed the
 *      step state with real-table ids (making the NEXT Continue idempotent).
 *
 * @throws if any individual write fails — the caller surfaces the error and
 *         the user can retry.
 */
export async function syncAccounts(
  token: string | null,
  snapshot: AccountsSnapshot,
  current: AccountsSnapshot,
): Promise<AccountsSyncResult> {
  const diff = diffAccounts(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.accountOps) {
    if (op.op === 'create') {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers,
        body: JSON.stringify(accountPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not save the account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else if (op.op === 'update') {
      const res = await fetch(`/api/accounts/${op.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(accountPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not update the account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else {
      const res = await fetch(`/api/accounts/${op.id}`, { method: 'DELETE', headers });
      // 404 = already gone (retry after a partial success) — treat as success.
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Could not remove the account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    }
  }

  const fresh = await readAccounts(token);
  return { snapshot: fresh };
}

// ============================================================================
// MAPPERS — bridge `AccountsSnapshot` ⇄ wizard `WizardData.accounts`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(): string {
  syntheticCounter += 1;
  return `temp_acct_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `AccountInput[]`. The real
 * `Account` id becomes the wizard `id` for every account; a BASIQ / IMPORT
 * account also keeps it in the legacy `existingAccountId` field (so other
 * code paths that still read that field — e.g. the ImportWizard — keep
 * working).
 */
export function snapshotToWizardAccounts(snapshot: AccountsSnapshot): AccountInput[] {
  return snapshot.accounts.map((a): AccountInput => ({
    id: a.id ?? syntheticId(),
    name: a.name,
    type: a.type,
    institution: a.institution || undefined,
    currentBalance: a.currentBalance,
    interestRate: a.interestRate,
    linkedLoanId: a.linkedLoanId,
    source: a.source,
    existingAccountId: a.source !== 'MANUAL' ? a.id : undefined,
  }));
}

/**
 * Map the wizard step's `AccountInput[]` → an `AccountsSnapshot` for
 * `diffAccounts` / `syncAccounts`.
 *
 * - Synthetic (not-yet-saved) ids drop to `undefined` so the diff
 *   classifies them as CREATE. A BASIQ/IMPORT account's real id is
 *   recovered from `existingAccountId`.
 * - An unpersisted MANUAL account with no name is dropped — `name` is the
 *   one genuinely required `Account` field, so an incomplete in-session
 *   card is left in-session (not persisted as a blank row). A persisted
 *   account is always kept, so blanking a field never silently deletes it.
 */
export function wizardAccountsToSnapshot(accounts: AccountInput[]): AccountsSnapshot {
  return {
    accounts: accounts
      .filter((a) => {
        const realId = accountRealId(a);
        return !!realId || !!a.name.trim();
      })
      .map((a): AccountRecord => ({
        id: accountRealId(a),
        name: a.name,
        type: a.type,
        institution: a.institution ?? '',
        currentBalance: a.currentBalance,
        interestRate: a.interestRate,
        linkedLoanId: a.linkedLoanId,
        source: normaliseSource(a),
      })),
  };
}
