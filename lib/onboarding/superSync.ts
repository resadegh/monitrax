/**
 * superSync — Phase 12 Track F.6: onboarding ⇄ real-table two-way sync for
 * the SUPERANNUATION domain (`SuperannuationAccount`).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.6 makes the super
 * domain read + write the real `SuperannuationAccount` table directly.
 * `SuperannuationAccount` is a flat entity — this mirrors the F.3 accounts
 * layer, the simplest shape.
 *
 * The wizard captures the minimum-viable field set (name / fundName /
 * currentBalance — per the Phase 12 plan doc §3 row A); the many other
 * `SuperannuationAccount` columns (member number, tax components,
 * contribution caps, …) keep their schema defaults and are filled from a
 * future Settings → Retirement surface. F.6 reads + writes only the three
 * wizard fields and leaves the rest untouched.
 *
 * ============================================================================
 * THE SUPER API
 * ============================================================================
 * `/api/tax/super` already exists with GET (the user's full super position)
 * and POST (create an account). F.6 adds the missing per-id route —
 * `/api/tax/super/[id]` with PUT + DELETE — and audit logging to all three
 * (`SUPER_CREATED/UPDATED/DELETED`).
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new accounts (no real id) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for accounts with a real-table `id`, via the
 *     ownership-guarded per-id API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffSuper()` is pure; a no-edit re-entry
 *     diffs to zero ops.
 *  4. AUDIT — the super routes audit every state-changing write (F.6).
 *
 * `diffSuper()` is PURE — the unit-testable idempotency core.
 * `readSuper()` / `syncSuper()` do the network I/O.
 */

import type { SuperAccountInput } from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape
// ============================================================================

/** A super account as it exists in the real `SuperannuationAccount` table. */
export interface SuperRecord {
  /** Real-table id once persisted; `undefined` for a not-yet-saved account. */
  id?: string;
  name: string;
  fundName: string;
  currentBalance: number;
}

export interface SuperSnapshot {
  accounts: SuperRecord[];
}

export const EMPTY_SUPER_SNAPSHOT: SuperSnapshot = { accounts: [] };

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real id is a uuid. The wizard mints synthetic ids — `temp_…`
 * (`generateId()`) and `chat-…` (chat mode). `isPersistedId` distinguishes
 * them so the diff classifies a synthetic-id account as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

// ============================================================================
// READ — `readSuper()`
// ============================================================================

interface RawSuperAccount {
  id: string;
  name: string;
  fundName: string | null;
  currentBalance: number;
}

/**
 * Read the user's super accounts from the real table.
 *
 * GET `/api/tax/super` returns the full super position; its `accounts`
 * array carries the per-account summary (id / name / fundName /
 * currentBalance + tax fields F.6 ignores). An empty array for a user
 * with no super.
 */
export async function readSuper(token: string | null): Promise<SuperSnapshot> {
  const res = await fetch('/api/tax/super', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your super. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawSuperAccount[] = Array.isArray(json?.accounts) ? json.accounts : [];

  return {
    accounts: rows.map((s): SuperRecord => ({
      id: s.id,
      name: s.name,
      fundName: s.fundName ?? '',
      currentBalance: typeof s.currentBalance === 'number' ? s.currentBalance : 0,
    })),
  };
}

// ============================================================================
// DIFF — `diffSuper()` — the PURE idempotency core
// ============================================================================

export interface SuperOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  record: SuperRecord;
}

export interface SuperDiff {
  /** Only accounts that need a write appear here. A no-edit re-entry
   *  produces `accountOps: []` → `syncSuper` does nothing. */
  accountOps: SuperOp[];
}

function superFieldsEqual(a: SuperRecord, b: SuperRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.fundName.trim() === b.fundName.trim() &&
    a.currentBalance === b.currentBalance
  );
}

/**
 * Diff the wizard step's CURRENT super accounts against the step-open
 * snapshot. Re-opening the step and pressing "Continue" with zero edits
 * produces `accountOps: []` — so `syncSuper()` writes nothing.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 */
export function diffSuper(snapshot: SuperSnapshot, current: SuperSnapshot): SuperDiff {
  const snapshotById = new Map(
    snapshot.accounts.filter((s) => s.id).map((s) => [s.id as string, s]),
  );
  const currentIds = new Set(
    current.accounts.filter((s) => s.id).map((s) => s.id as string),
  );

  const accountOps: SuperOp[] = [];

  for (const s of current.accounts) {
    if (!s.id) {
      accountOps.push({ op: 'create', record: { ...s, id: undefined } });
      continue;
    }
    const prev = snapshotById.get(s.id);
    if (!prev) {
      accountOps.push({ op: 'create', record: { ...s, id: undefined } });
      continue;
    }
    if (!superFieldsEqual(prev, s)) {
      accountOps.push({ op: 'update', id: s.id, record: s });
    }
    // else: unchanged → NO-OP (idempotency §5.3).
  }

  for (const prev of snapshot.accounts) {
    if (prev.id && !currentIds.has(prev.id)) {
      accountOps.push({ op: 'delete', id: prev.id, record: prev });
    }
  }

  return { accountOps };
}

// ============================================================================
// WRITE — `syncSuper()`
// ============================================================================

export interface SuperSyncResult {
  snapshot: SuperSnapshot;
}

function superPayload(s: SuperRecord): Record<string, unknown> {
  return {
    name: s.name.trim() || 'My Super',
    fundName: s.fundName.trim() || null,
    currentBalance: s.currentBalance,
  };
}

/**
 * Persist the wizard step's super accounts to the real table.
 *
 *   1. Diff `current` against `snapshot` (pure — see `diffSuper`).
 *   2. Apply each op via the ownership-guarded super API (POST create /
 *      PUT update / DELETE delete).
 *   3. Re-read and return the fresh snapshot.
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncSuper(
  token: string | null,
  snapshot: SuperSnapshot,
  current: SuperSnapshot,
): Promise<SuperSyncResult> {
  const diff = diffSuper(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.accountOps) {
    if (op.op === 'create') {
      const res = await fetch('/api/tax/super', {
        method: 'POST',
        headers,
        body: JSON.stringify(superPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not save the super account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else if (op.op === 'update') {
      const res = await fetch(`/api/tax/super/${op.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(superPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not update the super account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    } else {
      const res = await fetch(`/api/tax/super/${op.id}`, { method: 'DELETE', headers });
      // 404 = already gone (retry after a partial success) — treat as success.
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Could not remove the super account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    }
  }

  const fresh = await readSuper(token);
  return { snapshot: fresh };
}

// ============================================================================
// MAPPERS — bridge `SuperSnapshot` ⇄ wizard `WizardData.superAccounts`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(): string {
  syntheticCounter += 1;
  return `temp_super_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `SuperAccountInput[]`. The
 * real id becomes the wizard `id`; a not-yet-saved account gets a synthetic
 * `temp_…` id for React keys.
 */
export function snapshotToWizardSuper(snapshot: SuperSnapshot): SuperAccountInput[] {
  return snapshot.accounts.map((s): SuperAccountInput => ({
    id: s.id ?? syntheticId(),
    name: s.name,
    fundName: s.fundName,
    currentBalance: s.currentBalance,
  }));
}

/**
 * Map the wizard step's `SuperAccountInput[]` → a `SuperSnapshot` for
 * `diffSuper` / `syncSuper`.
 *
 * - Synthetic ids drop to `undefined` so the diff classifies them as CREATE.
 * - An unpersisted account with no fund name AND a 0 balance is dropped
 *   (an incomplete in-session card; matches `bulk-create`'s skip). A
 *   persisted account is always kept, so blanking a field can never
 *   silently DELETE it.
 */
export function wizardSuperToSnapshot(accounts: SuperAccountInput[]): SuperSnapshot {
  return {
    accounts: accounts
      .filter(
        (s) => isPersistedId(s.id) || !!s.fundName.trim() || s.currentBalance > 0,
      )
      .map((s): SuperRecord => ({
        id: isPersistedId(s.id) ? s.id : undefined,
        name: s.name,
        fundName: s.fundName,
        currentBalance: s.currentBalance,
      })),
  };
}
