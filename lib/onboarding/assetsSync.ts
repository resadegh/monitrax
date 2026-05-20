/**
 * assetsSync — Phase 12 Track F.7: onboarding ⇄ real-table two-way sync for
 * the ASSETS domain (`Asset` + its `Expense`s).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model. F.7 makes the assets
 * domain read + write the real tables directly. The wizard's asset card is
 * an **aggregate** — an `Asset` plus its `Expense`s — so F.7 syncs the
 * whole thing, mirroring the F.2 property aggregate (simpler: just
 * expenses, no loan/income).
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new assets/expenses (no real id) — POST. Never upsert.
 *  2. UPDATE / DELETE only for entities with a real-table `id`, via the
 *     ownership-guarded per-id API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffAssets()` is pure; a no-edit re-entry
 *     diffs to zero ops.
 *  4. AUDIT — the asset routes audit every state-changing write
 *     (`ASSET_*`), added in F.7; asset-expense writes go through the
 *     already-audited `/api/expenses` routes.
 *
 * `Expense.asset` is `onDelete: SetNull` — deleting an `Asset` alone would
 * orphan its expense rows. So a delete op hard-deletes the asset's
 * expenses FIRST, then the asset (same pattern as F.2's property→loan).
 *
 * ============================================================================
 * QUALITY GUARDS
 * ============================================================================
 * An expense with `amount <= 0` is dropped (matches `bulk-create`'s skip).
 * An unpersisted asset with no `purchaseDate` is dropped — `purchaseDate`
 * is the one genuinely required `Asset` date; an incomplete in-session card
 * is left in-session. A persisted asset is always kept.
 *
 * `diffAssets()` is PURE — the unit-testable idempotency core.
 * `readAssets()` / `syncAssets()` do the network I/O.
 */

import type {
  AssetType,
  ExpenseCategory,
  Frequency,
  AssetInput,
  AssetExpenseInput,
} from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape
// ============================================================================

/** An asset expense as it exists in the real `Expense` table. */
export interface AssetExpenseRecord {
  /** Real-table `Expense` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

/** An asset as it exists in the real `Asset` table, plus its expenses. */
export interface AssetRecord {
  /** Real-table `Asset` id once persisted; `undefined` for not-yet-saved. */
  id?: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  /** ISO date string (yyyy-mm-dd). Required by the entity API on write. */
  purchaseDate?: string;
  description?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  expenses: AssetExpenseRecord[];
}

export interface AssetsSnapshot {
  assets: AssetRecord[];
}

export const EMPTY_ASSETS_SNAPSHOT: AssetsSnapshot = { assets: [] };

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
// READ — `readAssets()`
// ============================================================================

interface RawAssetExpense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}
interface RawAsset {
  id: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string | null;
  description: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  expenses?: RawAssetExpense[];
}

function toDateInput(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return String(value).split('T')[0];
}

/**
 * Read the user's assets from the real `Asset` table.
 *
 * GET `/api/assets` `include`s `expenses`. The endpoint returns
 * `{ data: [...] }` (no `success` envelope) and an empty array for a user
 * with no assets.
 */
export async function readAssets(token: string | null): Promise<AssetsSnapshot> {
  const res = await fetch('/api/assets', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your assets. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawAsset[] = Array.isArray(json?.data) ? json.data : [];

  return {
    assets: rows.map((a): AssetRecord => ({
      id: a.id,
      name: a.name,
      type: a.type,
      purchasePrice: typeof a.purchasePrice === 'number' ? a.purchasePrice : 0,
      currentValue: typeof a.currentValue === 'number' ? a.currentValue : 0,
      purchaseDate: toDateInput(a.purchaseDate),
      description: a.description ?? undefined,
      vehicleMake: a.vehicleMake ?? undefined,
      vehicleModel: a.vehicleModel ?? undefined,
      vehicleYear: a.vehicleYear ?? undefined,
      expenses: (a.expenses ?? []).map((e): AssetExpenseRecord => ({
        id: e.id,
        name: e.name,
        category: e.category,
        amount: e.amount,
        frequency: e.frequency,
      })),
    })),
  };
}

// ============================================================================
// DIFF — `diffAssets()` — the PURE idempotency core
// ============================================================================

export interface ChildOp<T> {
  op: 'create' | 'update' | 'delete';
  id?: string;
  record: T;
}

export interface AssetOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table `Asset` id — present for update/delete. */
  id?: string;
  record: AssetRecord;
  /** For `update`: whether any `Asset` scalar field changed (→ PUT).
   *  Always `true` for `create`/`delete`. */
  coreChanged: boolean;
  expenseOps: ChildOp<AssetExpenseRecord>[];
}

export interface AssetsDiff {
  assetOps: AssetOp[];
}

function assetCoreEqual(a: AssetRecord, b: AssetRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    a.purchasePrice === b.purchasePrice &&
    a.currentValue === b.currentValue &&
    (a.purchaseDate || '') === (b.purchaseDate || '') &&
    (a.description?.trim() || '') === (b.description?.trim() || '') &&
    (a.vehicleMake?.trim() || '') === (b.vehicleMake?.trim() || '') &&
    (a.vehicleModel?.trim() || '') === (b.vehicleModel?.trim() || '') &&
    (a.vehicleYear ?? null) === (b.vehicleYear ?? null)
  );
}

function expenseEqual(a: AssetExpenseRecord, b: AssetExpenseRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.category === b.category &&
    a.amount === b.amount &&
    a.frequency === b.frequency
  );
}

/** Diff an asset's expenses between snapshot + current, keyed by id. */
function diffExpenses(
  prev: AssetExpenseRecord[],
  curr: AssetExpenseRecord[],
): ChildOp<AssetExpenseRecord>[] {
  const prevById = new Map(prev.filter((e) => e.id).map((e) => [e.id as string, e]));
  const currIds = new Set(curr.filter((e) => e.id).map((e) => e.id as string));
  const ops: ChildOp<AssetExpenseRecord>[] = [];
  for (const e of curr) {
    if (!e.id) {
      ops.push({ op: 'create', record: e });
      continue;
    }
    const prevE = prevById.get(e.id);
    if (!prevE) {
      ops.push({ op: 'create', record: { ...e, id: undefined } });
      continue;
    }
    if (!expenseEqual(prevE, e)) ops.push({ op: 'update', id: e.id, record: e });
  }
  for (const prevE of prev) {
    if (prevE.id && !currIds.has(prevE.id)) {
      ops.push({ op: 'delete', id: prevE.id, record: prevE });
    }
  }
  return ops;
}

/**
 * Diff the wizard step's CURRENT assets against the step-open snapshot.
 * Re-opening the step and pressing "Continue" with zero edits produces
 * `assetOps: []` — so `syncAssets()` writes nothing.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 */
export function diffAssets(snapshot: AssetsSnapshot, current: AssetsSnapshot): AssetsDiff {
  const snapshotById = new Map(
    snapshot.assets.filter((a) => a.id).map((a) => [a.id as string, a]),
  );
  const currentIds = new Set(
    current.assets.filter((a) => a.id).map((a) => a.id as string),
  );

  const assetOps: AssetOp[] = [];

  for (const a of current.assets) {
    if (!a.id || !snapshotById.has(a.id)) {
      assetOps.push({
        op: 'create',
        record: { ...a, id: undefined },
        coreChanged: true,
        expenseOps: a.expenses.map((e) => ({
          op: 'create' as const,
          record: { ...e, id: undefined },
        })),
      });
      continue;
    }
    const prev = snapshotById.get(a.id) as AssetRecord;
    const coreChanged = !assetCoreEqual(prev, a);
    const expenseOps = diffExpenses(prev.expenses, a.expenses);
    if (coreChanged || expenseOps.length) {
      assetOps.push({ op: 'update', id: a.id, record: a, coreChanged, expenseOps });
    }
    // else: nothing changed → NO-OP (idempotency §5.3).
  }

  for (const prev of snapshot.assets) {
    if (prev.id && !currentIds.has(prev.id)) {
      // `Expense.asset` is onDelete:SetNull — delete the expenses first so
      // no orphan rows are left behind, then the asset.
      assetOps.push({
        op: 'delete',
        id: prev.id,
        record: prev,
        coreChanged: true,
        expenseOps: prev.expenses
          .filter((e) => e.id)
          .map((e) => ({ op: 'delete' as const, id: e.id, record: e })),
      });
    }
  }

  return { assetOps };
}

// ============================================================================
// WRITE — `syncAssets()`
// ============================================================================

export interface AssetsSyncResult {
  snapshot: AssetsSnapshot;
}

function assetPayload(a: AssetRecord): Record<string, unknown> {
  return {
    name: a.name.trim() || a.type,
    type: a.type,
    description: a.description?.trim() || undefined,
    purchasePrice: a.purchasePrice,
    purchaseDate: a.purchaseDate || new Date().toISOString().slice(0, 10),
    currentValue: a.currentValue,
    ...(a.type === 'VEHICLE'
      ? {
          vehicleMake: a.vehicleMake?.trim() || undefined,
          vehicleModel: a.vehicleModel?.trim() || undefined,
          vehicleYear: a.vehicleYear ?? undefined,
        }
      : {}),
  };
}

function expensePayload(
  e: AssetExpenseRecord,
  assetId: string,
): Record<string, unknown> {
  return {
    name: e.name.trim() || e.category,
    category: e.category,
    amount: e.amount,
    frequency: e.frequency,
    assetId,
    sourceType: 'ASSET',
  };
}

/**
 * Persist the wizard step's assets to the real tables.
 *
 *   1. Diff `current` against `snapshot` (pure — see `diffAssets`).
 *   2. CREATE — POST the asset, capture its real id, POST every expense.
 *      UPDATE — PUT the asset if its core changed, apply each expense op.
 *      DELETE — delete every expense first, then DELETE the asset.
 *   3. Re-read and return the fresh snapshot.
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncAssets(
  token: string | null,
  snapshot: AssetsSnapshot,
  current: AssetsSnapshot,
): Promise<AssetsSyncResult> {
  const diff = diffAssets(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const op of diff.assetOps) {
    if (op.op === 'delete') {
      for (const expenseOp of op.expenseOps) {
        await applyExpenseOp(headers, expenseOp, op.id as string);
      }
      const res = await fetch(`/api/assets/${op.id}`, { method: 'DELETE', headers });
      if (!res.ok && res.status !== 404) {
        throw new Error(
          `Could not remove the asset "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
      continue;
    }

    let assetId = op.id as string;
    if (op.op === 'create') {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers,
        body: JSON.stringify(assetPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not save the asset "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
      const created = (await res.json().catch(() => null)) as { id?: string } | null;
      if (!created?.id) {
        throw new Error('The asset was saved but returned no id — please retry.');
      }
      assetId = created.id;
    } else if (op.coreChanged) {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(assetPayload(op.record)),
      });
      if (!res.ok) {
        throw new Error(
          `Could not update the asset "${op.record.name || 'unnamed'}". Please try again.`,
        );
      }
    }

    for (const expenseOp of op.expenseOps) {
      await applyExpenseOp(headers, expenseOp, assetId);
    }
  }

  const fresh = await readAssets(token);
  return { snapshot: fresh };
}

async function applyExpenseOp(
  headers: Record<string, string>,
  expenseOp: ChildOp<AssetExpenseRecord>,
  assetId: string,
): Promise<void> {
  if (expenseOp.op === 'delete') {
    const res = await fetch(`/api/expenses/${expenseOp.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error('Could not remove an asset expense. Please try again.');
    }
    return;
  }
  if (expenseOp.op === 'create') {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(expensePayload(expenseOp.record, assetId)),
    });
    if (!res.ok) throw new Error('Could not save an asset expense. Please try again.');
  } else {
    const res = await fetch(`/api/expenses/${expenseOp.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(expensePayload(expenseOp.record, assetId)),
    });
    if (!res.ok) throw new Error('Could not update an asset expense. Please try again.');
  }
}

// ============================================================================
// MAPPERS — bridge `AssetsSnapshot` ⇄ wizard `WizardData.assets`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(prefix: string): string {
  syntheticCounter += 1;
  return `temp_${prefix}_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `AssetInput[]`. Real ids
 * become the wizard ids; a not-yet-saved entity gets a synthetic `temp_…`
 * id for React keys.
 */
export function snapshotToWizardAssets(snapshot: AssetsSnapshot): AssetInput[] {
  return snapshot.assets.map((a): AssetInput => ({
    id: a.id ?? syntheticId('asset'),
    name: a.name,
    type: a.type,
    purchasePrice: a.purchasePrice,
    currentValue: a.currentValue,
    purchaseDate: a.purchaseDate,
    description: a.description,
    vehicleMake: a.vehicleMake,
    vehicleModel: a.vehicleModel,
    vehicleYear: a.vehicleYear,
    expenses: a.expenses.map((e): AssetExpenseInput => ({
      id: e.id ?? syntheticId('exp'),
      name: e.name,
      category: e.category,
      amount: e.amount,
      frequency: e.frequency,
    })),
  }));
}

/**
 * Map the wizard step's `AssetInput[]` → an `AssetsSnapshot` for
 * `diffAssets` / `syncAssets`.
 *
 * - Synthetic ids drop to `undefined` so the diff classifies them as CREATE.
 * - An expense with `amount <= 0` is dropped.
 * - An unpersisted asset with no `purchaseDate` is dropped (incomplete
 *   in-session card). A persisted asset is always kept.
 */
export function wizardAssetsToSnapshot(assets: AssetInput[]): AssetsSnapshot {
  return {
    assets: assets
      .filter((a) => isPersistedId(a.id) || !!a.purchaseDate?.trim())
      .map((a): AssetRecord => ({
        id: isPersistedId(a.id) ? a.id : undefined,
        name: a.name,
        type: a.type,
        purchasePrice: a.purchasePrice,
        currentValue: a.currentValue,
        purchaseDate: a.purchaseDate,
        description: a.description,
        vehicleMake: a.vehicleMake,
        vehicleModel: a.vehicleModel,
        vehicleYear: a.vehicleYear,
        expenses: a.expenses
          .filter((e) => e.amount > 0)
          .map((e): AssetExpenseRecord => ({
            id: isPersistedId(e.id) ? e.id : undefined,
            name: e.name,
            category: e.category,
            amount: e.amount,
            frequency: e.frequency,
          })),
      })),
  };
}
