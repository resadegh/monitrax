/**
 * entitiesSync — Phase 12 Track G.3a: onboarding ⇄ real-table two-way sync
 * for the LEGAL ENTITIES domain (`LegalEntity`).
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * The last domain migration. G.3a makes the Entities step read + write the
 * real `LegalEntity` table directly via `/api/entities`, retiring the
 * draft-blob + `bulk-create` §41b path. It follows the Track F `*Sync.ts`
 * pattern (`superSync.ts` is the closest template) plus two entity-specific
 * wrinkles:
 *
 *  - TWO-PASS PARENT LINKING. `LegalEntity.parentEntityId` is a
 *    self-referential FK — a trust's corporate trustee. `syncEntities()`
 *    creates every entity first (no parent), building a wizardId→realId
 *    map, then a second pass PUTs `parentEntityId`. Mirrors the proven
 *    `bulk-create` §41b algorithm.
 *  - ENCRYPTED-TFN ASYMMETRY. GET `/api/entities` returns `hasTfn:boolean`,
 *    never the TFN value (CDR §13). So `diffEntities()` compares `hasTfn`,
 *    not the value, and the write payload OMITS `tfn` when the wizard
 *    field is empty (`undefined` leaves a stored TFN untouched).
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT
 * ============================================================================
 *  1. CREATE for new entities (no real id) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for entities with a real-table `id`, via the
 *     ownership-guarded per-id API.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffEntities()` is pure; a no-edit
 *     re-entry diffs to zero ops, and the parent reconcile writes nothing.
 *  4. AUDIT — the entity routes audit every state-changing write
 *     (`logCRUD`, `entityType:'LegalEntity'`).
 *
 * `diffEntities()` is PURE — the unit-testable idempotency core.
 * `readEntities()` / `syncEntities()` do the network I/O.
 */

import type { EntityInput } from '@/components/onboarding/wizard/types';

type EntityType = EntityInput['type'];
type EntityRole = EntityInput['role'];
type EntityTrustType = NonNullable<EntityInput['trustType']>;

// ============================================================================
// Snapshot shape
// ============================================================================

/** A legal entity as it exists in the real `LegalEntity` table. */
export interface EntityRecord {
  /** The wizard-local id — always present. Equals the real id once saved.
   *  Used to resolve trust → trustee parent links across the sync batch. */
  wizardId: string;
  /** Real-table id once persisted; `undefined` for a not-yet-saved entity. */
  id?: string;
  name: string;
  type: EntityType;
  role: EntityRole;
  abn: string;
  acn: string;
  tradingName: string;
  /** `YYYY-MM-DD` or `''`. */
  establishedDate: string;
  trustType: EntityTrustType | null;
  isForeignResident: boolean;
  /** Whether a TFN is stored. The GET API returns this, never the value. */
  hasTfn: boolean;
  /** Raw TFN — only ever populated from the wizard side (the API never
   *  returns it). Used solely to build a write payload; `''` from a read. */
  tfn: string;
  /** The PARENT entity's `wizardId` (real id from a DB read; a wizard id
   *  from the wizard mapping). `undefined` = no trustee parent. */
  parentRef?: string;
}

export interface EntitiesSnapshot {
  entities: EntityRecord[];
}

export const EMPTY_ENTITIES_SNAPSHOT: EntitiesSnapshot = { entities: [] };

// ============================================================================
// id helpers
// ============================================================================

/**
 * A real id is a uuid. The wizard mints synthetic ids — `temp_…` and
 * `chat-…`. `isPersistedId` distinguishes them so the diff classifies a
 * synthetic-id entity as CREATE.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !id.startsWith('temp_') && !id.startsWith('chat-');
}

function isTrustType(type: EntityType): boolean {
  return type === 'DISCRETIONARY_TRUST' || type === 'UNIT_TRUST';
}

// ============================================================================
// READ — `readEntities()`
// ============================================================================

interface RawEntity {
  id: string;
  name: string;
  type: EntityType;
  role: EntityRole;
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
  tradingName: string | null;
  establishedDate: string | null;
  parentEntityId: string | null;
  trustType: EntityTrustType | null;
  isForeignResident: boolean | null;
}

function toDateInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Read the user's legal entities from the real table.
 * GET `/api/entities` returns `{ data: LegalEntitySummary[] }`.
 */
export async function readEntities(
  token: string | null,
): Promise<EntitiesSnapshot> {
  const res = await fetch('/api/entities', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not load your entities. Please try again.');
  }
  const json = await res.json().catch(() => null);
  const rows: RawEntity[] = Array.isArray(json?.data) ? json.data : [];

  return {
    entities: rows.map((e): EntityRecord => ({
      wizardId: e.id,
      id: e.id,
      name: e.name,
      type: e.type,
      role: e.role,
      abn: e.abn ?? '',
      acn: e.acn ?? '',
      tradingName: e.tradingName ?? '',
      establishedDate: toDateInput(e.establishedDate),
      trustType: e.trustType ?? null,
      isForeignResident: e.isForeignResident ?? false,
      hasTfn: !!e.hasTfn,
      tfn: '',
      parentRef: e.parentEntityId ?? undefined,
    })),
  };
}

// ============================================================================
// DIFF — `diffEntities()` — the PURE idempotency core
// ============================================================================

export interface EntityOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  /** The wizard-local id — always present; used for parent resolution. */
  wizardId: string;
  record: EntityRecord;
}

export interface EntitiesDiff {
  /** Only entities that need a CORE write appear here. Parent-link
   *  reconciliation is handled separately in `syncEntities()`. */
  entityOps: EntityOp[];
}

function digits(s: string): string {
  return s.replace(/\D+/g, '');
}

/**
 * Compare the CORE fields of two entities. Excludes `parentRef` (the
 * parent link is reconciled in its own pass).
 *
 * TFN: compares the raw `tfn` VALUE, not `hasTfn`. The GET API never
 * returns the TFN, so a snapshot read from the DB has `tfn: ''` and the
 * wizard side also has `tfn: ''` until the user types one — both empty,
 * so a no-touch re-entry diffs to zero ops (idempotent). A newly-typed
 * TFN makes `current.tfn` non-empty → an UPDATE op → `entityCorePayload`
 * sends it. (Comparing `hasTfn` instead would flip true→false on every
 * re-entry and spuriously re-write.)
 */
function entityCoreEqual(a: EntityRecord, b: EntityRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    a.role === b.role &&
    digits(a.abn) === digits(b.abn) &&
    digits(a.acn) === digits(b.acn) &&
    a.tradingName.trim() === b.tradingName.trim() &&
    a.establishedDate === b.establishedDate &&
    (a.trustType ?? null) === (b.trustType ?? null) &&
    a.isForeignResident === b.isForeignResident &&
    a.tfn.trim() === b.tfn.trim()
  );
}

/**
 * Diff the wizard step's CURRENT entities against the step-open snapshot.
 * Re-opening the step and pressing "Continue" with zero edits produces
 * `entityOps: []` — so `syncEntities()` writes nothing.
 *
 * PURE — no fetch, no React. The unit-testable contract.
 */
export function diffEntities(
  snapshot: EntitiesSnapshot,
  current: EntitiesSnapshot,
): EntitiesDiff {
  const snapById = new Map(
    snapshot.entities.filter((e) => e.id).map((e) => [e.id as string, e]),
  );
  const currentIds = new Set(
    current.entities.filter((e) => e.id).map((e) => e.id as string),
  );

  const entityOps: EntityOp[] = [];

  for (const e of current.entities) {
    if (!e.id || !snapById.has(e.id)) {
      entityOps.push({ op: 'create', wizardId: e.wizardId, record: e });
      continue;
    }
    const prev = snapById.get(e.id) as EntityRecord;
    if (!entityCoreEqual(prev, e)) {
      entityOps.push({ op: 'update', id: e.id, wizardId: e.wizardId, record: e });
    }
    // else: core unchanged → NO-OP (idempotency §5.3).
  }

  for (const prev of snapshot.entities) {
    if (prev.id && !currentIds.has(prev.id)) {
      entityOps.push({
        op: 'delete',
        id: prev.id,
        wizardId: prev.wizardId,
        record: prev,
      });
    }
  }

  return { entityOps };
}

// ============================================================================
// WRITE — `syncEntities()`
// ============================================================================

export interface EntitiesSyncResult {
  snapshot: EntitiesSnapshot;
}

/** The core-field payload — never includes `parentEntityId` (pass 2 owns
 *  that) and omits `tfn` when empty so a PUT never clobbers a stored TFN. */
function entityCorePayload(r: EntityRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: r.name.trim(),
    type: r.type,
    role: r.role,
    abn: r.abn.trim() || null,
    acn: r.acn.trim() || null,
    tradingName: r.tradingName.trim() || null,
    establishedDate: r.establishedDate || null,
    trustType: isTrustType(r.type) ? r.trustType ?? null : null,
    isForeignResident: r.isForeignResident,
  };
  if (r.tfn.trim()) {
    payload.tfn = r.tfn.trim();
  }
  return payload;
}

/**
 * Persist the wizard step's entities to the real `LegalEntity` table.
 *
 *   1. Diff `current` vs `snapshot` (pure — see `diffEntities`).
 *   2. CREATE pass — POST each new entity WITHOUT a parent; capture the
 *      real id into `idMap` (wizardId → realId).
 *   3. UPDATE pass — PUT core fields for changed entities.
 *   4. PARENT pass — for every current entity, resolve its desired
 *      trustee via `idMap`; PUT `parentEntityId` only when it differs
 *      from the DB (idempotent — a no-change re-entry writes nothing).
 *   5. DELETE pass — remove entities the user dropped.
 *   6. Re-read and return the fresh snapshot.
 *
 * @throws if any individual write fails — the caller surfaces the error.
 */
export async function syncEntities(
  token: string | null,
  snapshot: EntitiesSnapshot,
  current: EntitiesSnapshot,
): Promise<EntitiesSyncResult> {
  const diff = diffEntities(snapshot, current);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // wizardId → realId. Pre-fill with already-persisted entities so the
  // parent pass can resolve a trustee that was saved on a prior visit.
  const idMap = new Map<string, string>();
  for (const e of current.entities) {
    if (e.id && isPersistedId(e.id)) {
      idMap.set(e.wizardId, e.id);
    }
  }

  // 1. CREATE — POST core fields only (no parent yet).
  for (const op of diff.entityOps) {
    if (op.op !== 'create') continue;
    const res = await fetch('/api/entities', {
      method: 'POST',
      headers,
      body: JSON.stringify(entityCorePayload(op.record)),
    });
    if (!res.ok) {
      throw new Error(
        `Could not save the entity "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
    const json = await res.json().catch(() => null);
    const realId = json?.id;
    if (typeof realId !== 'string') {
      throw new Error(
        `Saved "${op.record.name || 'unnamed'}" but no id came back. Please try again.`,
      );
    }
    idMap.set(op.wizardId, realId);
  }

  // 2. UPDATE — PUT core fields.
  for (const op of diff.entityOps) {
    if (op.op !== 'update') continue;
    const res = await fetch(`/api/entities/${op.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(entityCorePayload(op.record)),
    });
    if (!res.ok) {
      throw new Error(
        `Could not update the entity "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
  }

  // 3. PARENT pass — wire trust → trustee links. Only PUTs when the
  //    resolved parent differs from what the DB already had.
  const snapByRealId = new Map(
    snapshot.entities.filter((e) => e.id).map((e) => [e.id as string, e]),
  );
  for (const e of current.entities) {
    const thisRealId = idMap.get(e.wizardId);
    if (!thisRealId) continue;
    const desiredParent = e.parentRef ? idMap.get(e.parentRef) ?? null : null;
    const prevParent = snapByRealId.get(thisRealId)?.parentRef ?? null;
    if (desiredParent !== prevParent) {
      const res = await fetch(`/api/entities/${thisRealId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ parentEntityId: desiredParent }),
      });
      if (!res.ok) {
        throw new Error(
          `Could not link "${e.name || 'unnamed'}" to its trustee. Please try again.`,
        );
      }
    }
  }

  // 4. DELETE — 404 = already gone (retry after partial success) → success.
  for (const op of diff.entityOps) {
    if (op.op !== 'delete') continue;
    const res = await fetch(`/api/entities/${op.id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Could not remove the entity "${op.record.name || 'unnamed'}". Please try again.`,
      );
    }
  }

  const fresh = await readEntities(token);
  return { snapshot: fresh };
}

// ============================================================================
// MAPPERS — bridge `EntitiesSnapshot` ⇄ wizard `WizardData.entities`.
// ============================================================================

let syntheticCounter = 0;
function syntheticId(): string {
  syntheticCounter += 1;
  return `temp_entity_${Date.now()}_${syntheticCounter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Map a real-table snapshot → the wizard step's `EntityInput[]`. The real
 * id becomes the wizard `id`; `parentRef` (a real parent id) becomes
 * `parentEntityTempId` (which the wizard resolves against entity `id`s).
 * TFN is never restored — the API does not return it.
 */
export function snapshotToWizardEntities(
  snapshot: EntitiesSnapshot,
): EntityInput[] {
  return snapshot.entities.map((e): EntityInput => ({
    id: e.id ?? syntheticId(),
    name: e.name,
    type: e.type,
    role: e.role,
    abn: e.abn || undefined,
    acn: e.acn || undefined,
    tfn: undefined,
    tradingName: e.tradingName || undefined,
    establishedDate: e.establishedDate || undefined,
    trustType: e.trustType ?? undefined,
    isForeignResident: e.isForeignResident,
    parentEntityTempId: e.parentRef || undefined,
  }));
}

/**
 * Map the wizard step's `EntityInput[]` → an `EntitiesSnapshot` for
 * `diffEntities` / `syncEntities`.
 *
 * - Synthetic ids drop `id` to `undefined` so the diff classifies them as
 *   CREATE; `wizardId` retains the synthetic id for parent resolution.
 * - An unpersisted entity with no name is dropped (an incomplete card;
 *   matches `bulk-create`'s `if (!entity.name?.trim()) continue`). A
 *   persisted entity is always kept — blanking a field never silently
 *   DELETEs it.
 */
export function wizardEntitiesToSnapshot(
  entities: EntityInput[],
): EntitiesSnapshot {
  return {
    entities: entities
      .filter((e) => isPersistedId(e.id) || !!e.name?.trim())
      .map((e): EntityRecord => ({
        wizardId: e.id,
        id: isPersistedId(e.id) ? e.id : undefined,
        name: e.name,
        type: e.type,
        role: e.role,
        abn: e.abn ?? '',
        acn: e.acn ?? '',
        tradingName: e.tradingName ?? '',
        establishedDate: e.establishedDate ?? '',
        trustType: e.trustType ?? null,
        isForeignResident: e.isForeignResident ?? false,
        hasTfn: !!e.tfn?.trim(),
        tfn: e.tfn ?? '',
        parentRef: e.parentEntityTempId || undefined,
      })),
  };
}
