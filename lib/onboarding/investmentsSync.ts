/**
 * investmentsSync — Phase 12 Track F.5: onboarding ⇄ real-table two-way
 * sync for the INVESTMENTS domain (`InvestmentAccount` + `InvestmentHolding`).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.5 makes the
 * investments domain read + write the real tables directly. Per the wizard's
 * shape the unit is the **investment-account aggregate** — an
 * `InvestmentAccount` plus its `InvestmentHolding`s — mirroring the F.2
 * property aggregate. Replicates the F.1–F.4 `*Sync.ts` pattern.
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new accounts/holdings (no real id) — POST. Never upsert.
 *  2. UPDATE / DELETE only for entities with a real-table `id`, via the
 *     ownership-guarded per-id API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffInvestments()` is pure; a no-edit
 *     re-entry diffs to zero ops.
 *  4. AUDIT — the investment routes audit every state-changing write
 *     (`INVESTMENT_*` for the account; generic `CREATE/UPDATE/DELETE` for
 *     holdings), added in F.5.
 *
 * Deleting an `InvestmentAccount` cascade-deletes its holdings
 * (`InvestmentHolding.investmentAccount` is `onDelete: Cascade`), so a
 * delete op only needs to DELETE the account.
 *
 * ============================================================================
 * QUALITY GUARDS (financial-adviser lens)
 * ============================================================================
 * A holding with no ticker, 0 units or a $0 average price is false
 * precision — `wizardInvestmentsToSnapshot()` drops it (the holding API
 * also requires positive units + averagePrice). An unpersisted account
 * with no name is dropped (incomplete in-session card; the account API
 * requires a name). A persisted account is always kept, so blanking a
 * field can never silently DELETE it.
 *
 * `diffInvestments()` is PURE — the unit-testable idempotency core.
 * `readInvestments()` / `syncInvestments()` do the network I/O.
 */

import type {
  InvestmentAccountType,
  HoldingType,
  InvestmentAccountInput,
  HoldingInput,
} from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape
// ============================================================================

/** A holding as it exists in the real `InvestmentHolding` table. */
export interface HoldingRecord {
  /** Real-table id once persisted; `undefined` for a not-yet-saved holding. */
  id?: string;
  ticker: string;
  name?: string;
  units: number;
  averagePrice: number;
  type: HoldingType;
}

/** An investment account as it exists in the real `InvestmentAccount` table. */
export interface InvestmentRecord {
  /** Real-table id once persisted; `undefined` for a not-yet-saved account. */
  id?: string;
  name: string;
  platform: string;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings: HoldingRecord[];
}

export interface InvestmentsSnapshot {
  investments: InvestmentRecord[];
}

export const EMPTY_INVESTMENTS_SNAPSHOT: InvestmentsSnapshot = { investments: [] };

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real id is a uuid. The wizard mints synthetic ids — `temp_…`
 * (`generateId()`) and `chat-…` (chat mode). `isPersistedId` distinguishes
 * them so the diff classifies a synthetic-id entity as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

// ============================================================================
// READ — `readInvestments()`
// ============================================================================

interface RawHolding {
  id: string;
  ticker: string;
  name: string | null;
  units: number;
  averagePrice: number;
  type: HoldingType;
}
interface RawInvestmentAccount {
  id: string;
  name: string;
  platform: string | null;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings?: RawHolding[];
}

/**
 * Read the user's investment accounts from the real tables.
 *
 * GET `/api/investments/accounts` `include`s `holdings`. The endpoint
 * returns `{ data: [...] }` (no `success` envelope) and an empty array for
 * a user with no investments.
 */
export async function readInvestments(token: string | null): Promise<InvestmentsSnapshot> {
  const res = await fetch('/api/investments/accounts', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your investments. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawInvestmentAccount[] = Array.isArray(json?.data) ? json.data : [];

  return {
    investments: rows.map((a): InvestmentRecord => ({
      id: a.id,
      name: a.name,
      platform: a.platform ?? '',
      type: a.type,
      cashBalance: typeof a.cashBalance === 'number' ? a.cashBalance : 0,
      holdings: (a.holdings ?? []).map((h): HoldingRecord => ({
        id: h.id,
        ticker: h.ticker,
        name: h.name ?? undefined,
        units: h.units,
        averagePrice: h.averagePrice,
        type: h.type,
      })),
    })),
  };
}

// ============================================================================
// DIFF — `diffInvestments()` — the PURE idempotency core
// ============================================================================

export interface ChildOp<T> {
  op: 'create' | 'update' | 'delete';
  id?: string;
  record: T;
}

export interface InvestmentOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table `InvestmentAccount` id — present for update/delete. */
  id?: string;
  record: InvestmentRecord;
  /** For `update`: whether any account scalar field changed (→ PUT).
   *  Always `true` for `create`/`delete`. */
  coreChanged: boolean;
  /** Holding ops — populated for create/update. For `delete` it is empty:
   *  deleting the account cascade-deletes its holdings. */
  holdingOps: ChildOp<HoldingRecord>[];
}

export interface InvestmentsDiff {
  investmentOps: InvestmentOp[];
}

function accountCoreEqual(a: InvestmentRecord, b: InvestmentRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.platform.trim() === b.platform.trim() &&
    a.type === b.type &&
    a.cashBalance === b.cashBalance
  );
}

function holdingEqual(a: HoldingRecord, b: HoldingRecord): boolean {
  return (
    a.ticker.trim().toUpperCase() === b.ticker.trim().toUpperCase() &&
    (a.name?.trim() || '') === (b.name?.trim() || '') &&
    a.units === b.units &&
    a.averagePrice === b.averagePrice &&
    a.type === b.type
  );
}

/** Diff an account's holdings between snapshot + current, keyed by id. */
function diffHoldings(prev: HoldingRecord[], curr: HoldingRecord[]): ChildOp<HoldingRecord>[] {
  const prevById = new Map(prev.filter((h) => h.id).map((h) => [h.id as string, h]));
  const currIds = new Set(curr.filter((h) => h.id).map((h) => h.id as string));
  const ops: ChildOp<HoldingRecord>[] = [];
  for (const h of curr) {
    if (!h.id) {
      ops.push({ op: 'create', record: h });
      continue;
    }
    const prevH = prevById.get(h.id);
    if (!prevH) {
      ops.push({ op: 'create', record: { ...h, id: undefined } });
      continue;
    }
    if (!holdingEqual(prevH, h)) ops.push({ op: 'update', id: h.id, record: h });
  }
  for (const prevH of prev) {
    if (prevH.id && !currIds.has(prevH.id)) {
      ops.push({ op: 'delete', id: prevH.id, record: prevH });
    }
  }
  return ops;
}

/**
 * Diff the wizard step's CURRENT investments against the step-open
 * snapshot. Re-opening the step and pressing "Continue" with zero edits
 * produces `investmentOps: []` — so `syncInvestments()` writes nothing.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 */
export function diffInvestments(
  snapshot: InvestmentsSnapshot,
  current: InvestmentsSnapshot,
): InvestmentsDiff {
  const snapshotById = new Map(
    snapshot.investments.filter((a) => a.id).map((a) => [a.id as string, a]),
  );
  const currentIds = new Set(
    current.investments.filter((a) => a.id).map((a) => a.id as string),
  );

  const investmentOps: InvestmentOp[] = [];

  for (const a of current.investments) {
    if (!a.id || !snapshotById.has(a.id)) {
      investmentOps.push({
        op: 'create',
        record: { ...a, id: undefined },
        coreChanged: true,
        holdingOps: a.holdings.map((h) => ({
          op: 'create' as const,
          record: { ...h, id: undefined },
        })),
      });
      continue;
    }
    const prev = snapshotById.get(a.id) as InvestmentRecord;
    const coreChanged = !accountCoreEqual(prev, a);
    const holdingOps = diffHoldings(prev.holdings, a.holdings);
    if (coreChanged || holdingOps.length) {
      investmentOps.push({ op: 'update', id: a.id, record: a, coreChanged, holdingOps });
    }
    // else: nothing changed → NO-OP (idempotency §5.3).
  }

  for (const prev of snapshot.investments) {
    if (prev.id && !currentIds.has(prev.id)) {
      // Holdings cascade-delete with the account — no holding ops needed.
      investmentOps.push({
        op: 'delete',
        id: prev.id,
        record: prev,
        coreChanged: true,
        holdingOps: [],
      });
    }
  }

  return { investmentOps };
}

// ============================================================================
// WRITE — `syncInvestments()`
// ============================================================================

export interface InvestmentsSyncResult {
  snapshot: InvestmentsSnapshot;
}

function accountPayload(a: InvestmentRecord): Record<string, unknown> {
  return {
    name: a.name.trim() || 'Investment account',
    type: a.type,
    platform: a.platform.trim() || undefined,
    cashBalance: a.cashBalance,
  };
}

function holdingPayload(h: HoldingRecord, investmentAccountId: string): Record<string, unknown> {
  return {
    investmentAccountId,
    ticker: h.ticker.trim().toUpperCase(),
    name: h.name?.trim() || undefined,
    units: h.units,
    averagePrice: h.averagePrice,
    type: h.type,
  };
}

/**
 * Persist the wizard step's investments to the real tables.
 *
 *   1. Diff `current` against `snapshot` (pure — see `diffInvestments`).
 *   2. CREATE — POST the account, capture its real id, POST every holding.
 *      UPDATE — PUT the account if its core changed, apply each holding op.
 *      DELETE — DELETE the account (holdings cascade-delete).
 *   3. Re-read and return the fresh snapshot.
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncInvestments(
  token: string | null,
  snapshot: InvestmentsSnapshot,
  current: InvestmentsSnapshot,
): Promise<InvestmentsSyncResult> {
  const diff = diffInvestments(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.investmentOps) {
    if (op.op === 'delete') {
      const res = await fetch(`/api/investments/accounts/${op.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Could not remove the investment account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
      continue;
    }

    let accountId = op.id as string;
    if (op.op === 'create') {
      const res = await fetch('/api/investments/accounts', {
        method: 'POST',
        headers,
        body: JSON.stringify(accountPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not save the investment account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
      const created = (await res.json().catch(() => null)) as { id?: string } | null;
      if (!created?.id) {
        throw new Error('The investment account was saved but returned no id — please retry.');
      }
      accountId = created.id;
    } else if (op.coreChanged) {
      const res = await fetch(`/api/investments/accounts/${accountId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(accountPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not update the investment account "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    }

    for (const holdingOp of op.holdingOps) {
      await applyHoldingOp(headers, holdingOp, accountId);
    }
  }

  const fresh = await readInvestments(token);
  return { snapshot: fresh };
}

async function applyHoldingOp(
  headers: Record<string, string>,
  holdingOp: ChildOp<HoldingRecord>,
  investmentAccountId: string,
): Promise<void> {
  if (holdingOp.op === 'delete') {
    const res = await fetch(`/api/investments/holdings/${holdingOp.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error('Could not remove a holding. Please try again.');
    }
    return;
  }
  if (holdingOp.op === 'create') {
    const res = await fetch('/api/investments/holdings', {
      method: 'POST',
      headers,
      body: JSON.stringify(holdingPayload(holdingOp.record, investmentAccountId)),
    });
    if (!res.ok) throw new Error('Could not save a holding. Please try again.');
  } else {
    const res = await fetch(`/api/investments/holdings/${holdingOp.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(holdingPayload(holdingOp.record, investmentAccountId)),
    });
    if (!res.ok) throw new Error('Could not update a holding. Please try again.');
  }
}

// ============================================================================
// MAPPERS — bridge `InvestmentsSnapshot` ⇄ wizard `WizardData.investments`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(prefix: string): string {
  syntheticCounter += 1;
  return `temp_${prefix}_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `InvestmentAccountInput[]`.
 * Real ids become the wizard ids; a not-yet-saved entity gets a synthetic
 * `temp_…` id for React keys.
 */
export function snapshotToWizardInvestments(
  snapshot: InvestmentsSnapshot,
): InvestmentAccountInput[] {
  return snapshot.investments.map((a): InvestmentAccountInput => ({
    id: a.id ?? syntheticId('inv'),
    name: a.name,
    platform: a.platform,
    type: a.type,
    cashBalance: a.cashBalance,
    holdings: a.holdings.map((h): HoldingInput => ({
      id: h.id ?? syntheticId('hold'),
      ticker: h.ticker,
      name: h.name,
      units: h.units,
      averagePrice: h.averagePrice,
      type: h.type,
    })),
  }));
}

/**
 * Map the wizard step's `InvestmentAccountInput[]` → an
 * `InvestmentsSnapshot` for `diffInvestments` / `syncInvestments`.
 *
 * - Synthetic ids drop to `undefined` so the diff classifies them as CREATE.
 * - A holding without a ticker, with `units <= 0`, or with
 *   `averagePrice <= 0` is dropped (false precision; the holding API also
 *   requires positive units + price).
 * - An unpersisted account with no name is dropped (incomplete in-session
 *   card). A persisted account is always kept.
 */
export function wizardInvestmentsToSnapshot(
  investments: InvestmentAccountInput[],
): InvestmentsSnapshot {
  return {
    investments: investments
      .filter((a) => isPersistedId(a.id) || !!a.name.trim())
      .map((a): InvestmentRecord => ({
        id: isPersistedId(a.id) ? a.id : undefined,
        name: a.name,
        platform: a.platform ?? '',
        type: a.type,
        cashBalance: a.cashBalance,
        holdings: a.holdings
          .filter((h) => !!h.ticker.trim() && h.units > 0 && h.averagePrice > 0)
          .map((h): HoldingRecord => ({
            id: isPersistedId(h.id) ? h.id : undefined,
            ticker: h.ticker,
            name: h.name,
            units: h.units,
            averagePrice: h.averagePrice,
            type: h.type,
          })),
      })),
  };
}
