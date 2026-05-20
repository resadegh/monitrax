/**
 * householdSync — Phase 12 Track F.1: onboarding ⇄ real-table two-way sync
 * for the HOUSEHOLD domain.
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 * Track F retires the onboarding "draft blob" model in which the wizard
 * staged everything into `UserPreference.onboardingDraft` and only wrote the
 * real entity tables once, at the final `/api/onboarding/bulk-create`. That
 * model meant `/dashboard/household-profile` showed empty while the wizard
 * held a full household — a §12.2 SSOT violation.
 *
 * F.1 makes the household domain (`HouseholdProfile` / `HouseholdMember` /
 * `HouseholdPet`) read + write the REAL tables directly. This module is the
 * household domain's read/write layer. It is the **canonical pattern** that
 * F.2–F.8 (properties, accounts, debts, investments, super, assets,
 * income/expenses) copy — keep it clean, symmetric, and well-documented.
 *
 * ============================================================================
 * WHY IT CALLS THE ENTITY APIs (NOT FRESH PRISMA)
 * ============================================================================
 * The household entity APIs already exist and already power
 * `/dashboard/household-profile`:
 *   - GET/POST  /api/household-profile
 *   - GET/POST  /api/household-members,  GET/PUT/DELETE /api/household-members/[id]
 *   - GET/POST  /api/household-pets,     GET/PUT/DELETE /api/household-pets/[id]
 *
 * Every member/pet write path in those routes is already ownership-guarded:
 * the route loads the row with `findFirst({ where: { id, householdProfile:
 * { userId } } })` and only then `update`/`delete`s it by `id`. A row owned
 * by a different user simply isn't found → 404, never mutated. That is the
 * §12.11 guarantee we need — so this module **calls those APIs** rather than
 * re-implementing writes. It is a rewire, not new write logic.
 *
 * ============================================================================
 * §12.11 / §5 WRITE CONTRACT — how this module satisfies it
 * ============================================================================
 *  1. CREATE for new entities (no `id`) — POST. Never blind upsert.
 *  2. UPDATE / DELETE only for entities that ALREADY have a real-table `id`,
 *     routed through the per-id entity API whose `findFirst({ id, userId })`
 *     guard ensures the caller can only ever touch their own rows.
 *  3. IDEMPOTENT ON RE-ENTRY — `diffHousehold()` compares the wizard step's
 *     current state (each entity carries its real-table `id` once saved)
 *     against the snapshot read on step-open:
 *       - in state, no `id`            → CREATE
 *       - in state with `id`, changed  → UPDATE
 *       - in state with `id`, same     → NO-OP (this is what kills duplicates
 *                                         on "re-open + Continue with no edits")
 *       - had `id`, absent from state  → DELETE (hard-delete — design Q-F2)
 *  4. AUDIT — the household entity API routes audit every state-changing
 *     write via `createAuditLog()` (added in F.1 alongside this module, since
 *     these routes are now the wizard's SSOT write boundary).
 *
 * ============================================================================
 * PURE vs IMPURE
 * ============================================================================
 * `diffHousehold()` is PURE — no fetch, no React — and is the unit-testable
 * core of the idempotency guarantee. `readHousehold()` / `syncHousehold()`
 * do the network I/O. The wizard step + chat topic both consume the same
 * three functions.
 */

import type {
  HouseholdMemberInput,
  HouseholdPetInput,
  HouseholdRelationship,
  HouseholdPetType,
  LifestylePreference,
  DiningFrequency,
} from '@/components/onboarding/wizard/types';

// ============================================================================
// Snapshot shape — what `readHousehold()` returns and what the wizard/chat
// hold so a later `syncHousehold()` can diff against it.
// ============================================================================

/**
 * A household member as it exists in the real `HouseholdMember` table.
 * `id` is the real-table row id (a uuid) — NOT a synthetic `member-<ts>` id.
 * The wizard step seeds its member list from these; new members the user
 * adds in-session get a synthetic id and `id: undefined` is what marks
 * them as "needs CREATE".
 */
export interface HouseholdMemberRecord {
  /** Real-table id once persisted; `undefined` for a not-yet-saved member. */
  id?: string;
  name: string;
  relationship: HouseholdRelationship;
  /** ISO date string (yyyy-mm-dd) or undefined. */
  dateOfBirth?: string;
  isIncomeEarner: boolean;
}

export interface HouseholdPetRecord {
  /** Real-table id once persisted; `undefined` for a not-yet-saved pet. */
  id?: string;
  name: string;
  type: HouseholdPetType;
  breed?: string;
}

/**
 * The full household snapshot — the wizard step's source of truth.
 * `profileExists` distinguishes "user has a HouseholdProfile row" from
 * "fresh user, nothing in the table" — used for resume-point derivation
 * (design Q-F1: resume = first domain whose real tables are empty).
 */
export interface HouseholdSnapshot {
  profileExists: boolean;
  members: HouseholdMemberRecord[];
  pets: HouseholdPetRecord[];
  carsCount: number;
  lifestylePreference: LifestylePreference | null;
  diningOutFrequency: DiningFrequency | null;
  hobbiesWithCosts: string;
}

/** Empty snapshot — used when the user has no HouseholdProfile yet. */
export const EMPTY_HOUSEHOLD_SNAPSHOT: HouseholdSnapshot = {
  profileExists: false,
  members: [],
  pets: [],
  carsCount: 0,
  lifestylePreference: null,
  diningOutFrequency: null,
  hobbiesWithCosts: '',
};

// ============================================================================
// READ — `readHousehold()`
// ============================================================================

/**
 * Read the user's household from the real tables.
 *
 * Mirrors the call `/dashboard/household-profile` makes: a single GET to
 * `/api/household-profile`, which `include`s members + pets. A 404 means
 * the user has no HouseholdProfile row yet → returns the empty snapshot
 * (NOT an error — a fresh user legitimately has nothing).
 *
 * The returned member/pet records carry their real-table `id`s, so the
 * caller can hand them straight to the wizard step state. A later
 * `syncHousehold()` call diffs the (possibly edited) state against a
 * snapshot taken from this read.
 */
export async function readHousehold(token: string | null): Promise<HouseholdSnapshot> {
  const res = await fetch('/api/household-profile', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // 404 = no profile yet. Any other non-OK is a genuine failure.
  if (res.status === 404) {
    return { ...EMPTY_HOUSEHOLD_SNAPSHOT };
  }
  if (!res.ok) {
    throw new Error('Could not load your household. Please try again.');
  }

  const json = await res.json().catch(() => null);
  const data = json?.data;
  if (!json?.success || !data) {
    return { ...EMPTY_HOUSEHOLD_SNAPSHOT };
  }

  return {
    profileExists: true,
    members: (data.members ?? []).map(
      (m: {
        id: string;
        name: string;
        relationship: HouseholdRelationship;
        dateOfBirth: string | null;
        isIncomeEarner: boolean;
      }): HouseholdMemberRecord => ({
        id: m.id,
        name: m.name,
        relationship: m.relationship,
        // Real table stores a full DateTime; the wizard form uses yyyy-mm-dd.
        dateOfBirth: m.dateOfBirth ? String(m.dateOfBirth).split('T')[0] : undefined,
        isIncomeEarner: m.isIncomeEarner,
      }),
    ),
    pets: (data.pets ?? []).map(
      (p: {
        id: string;
        name: string;
        type: HouseholdPetType;
        breed: string | null;
      }): HouseholdPetRecord => ({
        id: p.id,
        name: p.name,
        type: p.type,
        breed: p.breed ?? undefined,
      }),
    ),
    carsCount: typeof data.carsCount === 'number' ? data.carsCount : 0,
    lifestylePreference: data.lifestylePreference ?? null,
    diningOutFrequency: data.diningOutFrequency ?? null,
    hobbiesWithCosts: data.hobbiesWithCosts ?? '',
  };
}

// ============================================================================
// DIFF — `diffHousehold()` — the PURE idempotency core
// ============================================================================

/**
 * One member/pet write operation the sync must perform.
 * `create` has no id; `update`/`delete` carry the real-table id.
 */
export interface HouseholdMemberOp {
  op: 'create' | 'update' | 'delete';
  /** Real-table id — present for update/delete, absent for create. */
  id?: string;
  record: HouseholdMemberRecord;
}
export interface HouseholdPetOp {
  op: 'create' | 'update' | 'delete';
  id?: string;
  record: HouseholdPetRecord;
}

export interface HouseholdDiff {
  memberOps: HouseholdMemberOp[];
  petOps: HouseholdPetOp[];
  /** True if any profile-level field (cars / lifestyle / dining / hobbies)
   *  differs from the snapshot, OR the profile doesn't exist yet. */
  profileChanged: boolean;
}

function memberFieldsEqual(a: HouseholdMemberRecord, b: HouseholdMemberRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.relationship === b.relationship &&
    (a.dateOfBirth || '') === (b.dateOfBirth || '') &&
    a.isIncomeEarner === b.isIncomeEarner
  );
}

function petFieldsEqual(a: HouseholdPetRecord, b: HouseholdPetRecord): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.type === b.type &&
    (a.breed?.trim() || '') === (b.breed?.trim() || '')
  );
}

/**
 * Diff the wizard step's CURRENT state against the snapshot read on
 * step-open. This is the function that makes re-entry idempotent:
 * re-opening the step and clicking "Continue" with zero edits produces a
 * diff with `memberOps: []`, `petOps: []`, `profileChanged: false` — so
 * `syncHousehold()` performs ZERO writes and no duplicate rows can appear.
 *
 * PURE — no fetch, no React. This is the unit-testable contract.
 *
 * @param snapshot  the household as it was when the step opened
 * @param current   the household as the user has it now in the step
 */
export function diffHousehold(
  snapshot: HouseholdSnapshot,
  current: HouseholdSnapshot,
): HouseholdDiff {
  // ---- Members --------------------------------------------------------
  const snapshotMemberById = new Map(
    snapshot.members.filter((m) => m.id).map((m) => [m.id as string, m]),
  );
  const currentMemberIds = new Set(
    current.members.filter((m) => m.id).map((m) => m.id as string),
  );

  const memberOps: HouseholdMemberOp[] = [];
  for (const m of current.members) {
    if (!m.id) {
      // No real-table id → never persisted → CREATE.
      memberOps.push({ op: 'create', record: m });
      continue;
    }
    const prev = snapshotMemberById.get(m.id);
    if (!prev) {
      // Has an id the snapshot doesn't know — treat as create defensively.
      memberOps.push({ op: 'create', record: { ...m, id: undefined } });
      continue;
    }
    if (!memberFieldsEqual(prev, m)) {
      memberOps.push({ op: 'update', id: m.id, record: m });
    }
    // else: unchanged → NO-OP (idempotency).
  }
  // Rows that were in the snapshot but the user removed → DELETE.
  for (const prev of snapshot.members) {
    if (prev.id && !currentMemberIds.has(prev.id)) {
      memberOps.push({ op: 'delete', id: prev.id, record: prev });
    }
  }

  // ---- Pets -----------------------------------------------------------
  const snapshotPetById = new Map(
    snapshot.pets.filter((p) => p.id).map((p) => [p.id as string, p]),
  );
  const currentPetIds = new Set(
    current.pets.filter((p) => p.id).map((p) => p.id as string),
  );

  const petOps: HouseholdPetOp[] = [];
  for (const p of current.pets) {
    if (!p.id) {
      petOps.push({ op: 'create', record: p });
      continue;
    }
    const prev = snapshotPetById.get(p.id);
    if (!prev) {
      petOps.push({ op: 'create', record: { ...p, id: undefined } });
      continue;
    }
    if (!petFieldsEqual(prev, p)) {
      petOps.push({ op: 'update', id: p.id, record: p });
    }
  }
  for (const prev of snapshot.pets) {
    if (prev.id && !currentPetIds.has(prev.id)) {
      petOps.push({ op: 'delete', id: prev.id, record: prev });
    }
  }

  // ---- Profile-level fields ------------------------------------------
  const profileChanged =
    !snapshot.profileExists ||
    snapshot.carsCount !== current.carsCount ||
    snapshot.lifestylePreference !== current.lifestylePreference ||
    snapshot.diningOutFrequency !== current.diningOutFrequency ||
    (snapshot.hobbiesWithCosts || '') !== (current.hobbiesWithCosts || '');

  return { memberOps, petOps, profileChanged };
}

// ============================================================================
// WRITE — `syncHousehold()`
// ============================================================================

/**
 * Result of a sync — the caller uses `members`/`pets` to refresh the
 * wizard step's state so every entity now carries its real-table id
 * (which makes the NEXT Continue idempotent).
 */
export interface HouseholdSyncResult {
  /** The household as it now exists in the real tables (re-read after writes). */
  snapshot: HouseholdSnapshot;
}

interface MemberApiResponse {
  success: boolean;
  data?: { id: string };
  error?: string;
}

/**
 * Persist the wizard step's household state to the real tables.
 *
 * Algorithm:
 *   1. Diff `current` against `snapshot` (pure — see `diffHousehold`).
 *   2. If `profileChanged`, POST `/api/household-profile` first. This is an
 *      `upsert` server-side, but it is §12.11-SAFE here because:
 *        - the `where` is `{ userId }` — only ever the current user's row;
 *        - the columns written (cars / lifestyle / dining / hobbies /
 *          derived counts) are the SAME columns the dashboard's own
 *          "Save Preferences" button writes. There is exactly ONE
 *          HouseholdProfile per user; we are not choosing between rows.
 *      It must run first so member/pet POSTs (which lazily create a
 *      profile if missing) attach to a profile with the right fields.
 *   3. Apply member ops, then pet ops, each via the ownership-guarded
 *      entity API (POST for create, PUT for update, DELETE for delete).
 *   4. Re-read and return the fresh snapshot so the caller can re-seed
 *      the step state with real-table ids.
 *
 * Ordering note: deletes are issued alongside creates/updates; the entity
 * APIs recompute `HouseholdProfile` counts after each member/pet write, so
 * the final counts are correct regardless of op order within a domain.
 *
 * @throws if any individual write fails — the caller surfaces the error
 *         and the user can retry (already-applied writes are idempotent on
 *         retry because the step state now holds their new ids).
 */
export async function syncHousehold(
  token: string | null,
  snapshot: HouseholdSnapshot,
  current: HouseholdSnapshot,
): Promise<HouseholdSyncResult> {
  const diff = diffHousehold(snapshot, current);
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ---- 1. Profile-level fields (run first; lazily creates the profile) --
  if (diff.profileChanged) {
    // Counts are derived from members/pets by the entity APIs after each
    // member/pet write — but POST /api/household-profile validates a full
    // payload, so we send counts consistent with `current`. The member/pet
    // writes below will re-derive them authoritatively.
    const adultsCount = Math.max(
      1,
      current.members.filter((m) => m.relationship !== 'CHILD').length,
    );
    const childrenCount = current.members.filter(
      (m) => m.relationship === 'CHILD',
    ).length;
    const res = await fetch('/api/household-profile', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        adultsCount,
        childrenCount,
        childrenAges: [],
        petsCount: current.pets.length,
        petTypes: current.pets.map((p) => p.type.toLowerCase()),
        carsCount: current.carsCount,
        // Profile POST validation requires these — fall back to the
        // schema defaults the dashboard also relies on.
        lifestylePreference: current.lifestylePreference ?? 'MODERATE',
        diningOutFrequency: current.diningOutFrequency ?? 'SOMETIMES',
        hobbiesWithCosts: current.hobbiesWithCosts || null,
      }),
    });
    if (!res.ok) {
      throw new Error('Could not save your household details. Please try again.');
    }
  }

  // ---- 2. Member ops --------------------------------------------------
  for (const op of diff.memberOps) {
    if (op.op === 'create') {
      const res = await fetch('/api/household-members', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: op.record.name.trim(),
          relationship: op.record.relationship,
          dateOfBirth: toIsoDateTime(op.record.dateOfBirth),
          isIncomeEarner: op.record.isIncomeEarner,
        }),
      });
      const json = (await res.json().catch(() => null)) as MemberApiResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not add a household member.');
      }
    } else if (op.op === 'update') {
      const res = await fetch(`/api/household-members/${op.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: op.record.name.trim(),
          relationship: op.record.relationship,
          dateOfBirth: toIsoDateTime(op.record.dateOfBirth),
          isIncomeEarner: op.record.isIncomeEarner,
        }),
      });
      if (!res.ok) {
        throw new Error('Could not update a household member.');
      }
    } else {
      const res = await fetch(`/api/household-members/${op.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      // 404 = already gone (e.g. retry after a partial success) — treat as
      // success so re-running the sync is idempotent.
      if (!res.ok && res.status !== 404) {
        throw new Error('Could not remove a household member.');
      }
    }
  }

  // ---- 3. Pet ops -----------------------------------------------------
  for (const op of diff.petOps) {
    if (op.op === 'create') {
      const res = await fetch('/api/household-pets', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: op.record.name.trim(),
          type: op.record.type,
          breed: op.record.breed?.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as MemberApiResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Could not add a pet.');
      }
    } else if (op.op === 'update') {
      const res = await fetch(`/api/household-pets/${op.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: op.record.name.trim(),
          type: op.record.type,
          breed: op.record.breed?.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error('Could not update a pet.');
      }
    } else {
      const res = await fetch(`/api/household-pets/${op.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok && res.status !== 404) {
        throw new Error('Could not remove a pet.');
      }
    }
  }

  // ---- 4. Re-read so the caller can re-seed state with real ids -------
  const fresh = await readHousehold(token);
  return { snapshot: fresh };
}

/**
 * The member entity API's `dateOfBirth` field is `z.string().datetime()` —
 * it wants a full ISO-8601 datetime, not the wizard form's `yyyy-mm-dd`.
 * Convert; pass through `null` for an absent date.
 */
function toIsoDateTime(date: string | undefined): string | null {
  if (!date || !date.trim()) return null;
  // Already a full datetime — pass through.
  if (date.includes('T')) return date;
  // yyyy-mm-dd → midnight UTC.
  return `${date}T00:00:00.000Z`;
}

// ============================================================================
// MAPPERS — bridge `HouseholdSnapshot` ⇄ wizard `WizardData` slices.
// Keeps the wizard step + chat topic free of mapping boilerplate.
// ============================================================================

/**
 * Map a real-table snapshot → the wizard step's `WizardData` household
 * slice. Real-table ids become the wizard's member/pet `id`s, so the
 * step's existing edit/delete logic (keyed on `id`) Just Works AND the
 * diff on Continue can tell saved rows from new ones.
 */
export function snapshotToWizardSlice(snapshot: HouseholdSnapshot): {
  householdMembers: HouseholdMemberInput[];
  householdPets: HouseholdPetInput[];
  carsCount: number;
  lifestylePreference: LifestylePreference | null;
  diningOutFrequency: DiningFrequency | null;
  hobbiesWithCosts: string;
} {
  return {
    householdMembers: snapshot.members.map((m) => ({
      // A persisted member keeps its real id; a not-yet-saved one would
      // have `id: undefined` — give it a synthetic id so React keys work.
      id: m.id ?? `new-member-${Math.random().toString(36).slice(2)}`,
      name: m.name,
      relationship: m.relationship,
      dateOfBirth: m.dateOfBirth,
      isIncomeEarner: m.isIncomeEarner,
    })),
    householdPets: snapshot.pets.map((p) => ({
      id: p.id ?? `new-pet-${Math.random().toString(36).slice(2)}`,
      name: p.name,
      type: p.type,
      breed: p.breed,
    })),
    carsCount: snapshot.carsCount,
    lifestylePreference: snapshot.lifestylePreference,
    diningOutFrequency: snapshot.diningOutFrequency,
    hobbiesWithCosts: snapshot.hobbiesWithCosts,
  };
}

/**
 * Determine whether a wizard member/pet `id` refers to a real persisted
 * row or an in-session-only entity. A real `HouseholdMember`/`HouseholdPet`
 * id is a uuid; the wizard mints synthetic ids prefixed `member-`, `pet-`,
 * `new-member-`, `new-pet-`, `chat-` for not-yet-saved entities.
 */
export function isPersistedId(id: string | undefined): boolean {
  if (!id) return false;
  return !(
    id.startsWith('member-') ||
    id.startsWith('pet-') ||
    id.startsWith('new-member-') ||
    id.startsWith('new-pet-') ||
    id.startsWith('chat-')
  );
}

/**
 * Map the wizard step's `WizardData` household slice → a `HouseholdSnapshot`
 * suitable for `diffHousehold` / `syncHousehold`. Synthetic (not-yet-saved)
 * ids are dropped to `undefined` so the diff classifies them as CREATE.
 */
export function wizardSliceToSnapshot(slice: {
  householdMembers: HouseholdMemberInput[];
  householdPets: HouseholdPetInput[];
  carsCount: number;
  lifestylePreference: LifestylePreference | null;
  diningOutFrequency: DiningFrequency | null;
  hobbiesWithCosts: string;
}): HouseholdSnapshot {
  return {
    profileExists: true,
    members: slice.householdMembers.map((m) => ({
      id: isPersistedId(m.id) ? m.id : undefined,
      name: m.name,
      relationship: m.relationship,
      dateOfBirth: m.dateOfBirth,
      isIncomeEarner: m.isIncomeEarner,
    })),
    pets: slice.householdPets.map((p) => ({
      id: isPersistedId(p.id) ? p.id : undefined,
      name: p.name,
      type: p.type,
      breed: p.breed,
    })),
    carsCount: slice.carsCount,
    lifestylePreference: slice.lifestylePreference,
    diningOutFrequency: slice.diningOutFrequency,
    hobbiesWithCosts: slice.hobbiesWithCosts,
  };
}

// ============================================================================
// CHAT bridge — `chatStagedToSnapshot()`
// ============================================================================

/** The chat household topic's staged member shape (no id, no DoB). */
export interface ChatStagedMember {
  name: string;
  relationship: HouseholdRelationship;
  isIncomeEarner: boolean;
}
/** The chat household topic's staged pet shape (no id, no breed). */
export interface ChatStagedPet {
  name: string;
  type: HouseholdPetType;
}

/**
 * Map the CHAT household topic's staged `HouseholdFields` → a
 * `HouseholdSnapshot` for `diffHousehold` / `syncHousehold`.
 *
 * The chat's LLM extraction re-derives the full member/pet list each turn
 * and carries NO ids and NO date-of-birth / breed. To make a chat
 * household confirm idempotent on re-entry, this function reconciles the
 * staged list against `baseline` (the real-table snapshot captured at
 * topic bootstrap) by **name** — the household domain's natural key:
 *
 *   - staged member whose (trimmed, case-insensitive) name matches a
 *     baseline member → carries that member's real-table `id` AND
 *     preserves the baseline `dateOfBirth` (chat never captures DoB, so
 *     it must NOT wipe a DoB the user set in form mode).
 *   - staged member with no name match → `id: undefined` → CREATE.
 *   - baseline member absent from the staged list → omitted here, so
 *     `diffHousehold` classifies it as DELETE (the user removed them in
 *     chat). Hard-delete — design Q-F2.
 *
 * Pets reconcile the same way, preserving `breed`.
 *
 * `carsCount` falls back to the baseline when the chat didn't capture it
 * (so confirming a chat session that only touched members doesn't reset
 * the user's car count to 0).
 */
export function chatStagedToSnapshot(
  baseline: HouseholdSnapshot,
  staged: {
    householdMembers?: ChatStagedMember[];
    householdPets?: ChatStagedPet[];
    carsCount?: number;
  },
): HouseholdSnapshot {
  const norm = (s: string) => s.trim().toLowerCase();

  // Name → baseline record. If two baseline rows share a name (rare),
  // last wins — acceptable; the diff still only mutates owned rows.
  const baselineMemberByName = new Map(
    baseline.members.filter((m) => m.id).map((m) => [norm(m.name), m]),
  );
  const baselinePetByName = new Map(
    baseline.pets.filter((p) => p.id).map((p) => [norm(p.name), p]),
  );

  // When the chat never extracted a members/pets field at all, fall back
  // to the baseline so a partial chat session doesn't wipe existing rows.
  const stagedMembers = staged.householdMembers;
  const stagedPets = staged.householdPets;

  const members: HouseholdMemberRecord[] =
    stagedMembers === undefined
      ? baseline.members
      : stagedMembers.map((m) => {
          const match = baselineMemberByName.get(norm(m.name));
          return {
            id: match?.id,
            // On a name match, keep the baseline's EXACT name casing.
            // The chat's LLM extraction varies casing turn to turn
            // ("Newsha" vs "newsha"); treating that as a rename would
            // break idempotency. The persisted name is authoritative.
            name: match ? match.name : m.name,
            relationship: m.relationship,
            // Chat never captures DoB — preserve whatever the real table
            // already has for a matched member.
            dateOfBirth: match?.dateOfBirth,
            isIncomeEarner: m.isIncomeEarner,
          };
        });

  const pets: HouseholdPetRecord[] =
    stagedPets === undefined
      ? baseline.pets
      : stagedPets.map((p) => {
          const match = baselinePetByName.get(norm(p.name));
          return {
            id: match?.id,
            // Keep the baseline's exact name casing on a match — see the
            // member reconciliation note above.
            name: match ? match.name : p.name,
            type: p.type,
            // Chat never captures breed — preserve the real table's value.
            breed: match?.breed,
          };
        });

  return {
    profileExists: baseline.profileExists,
    members,
    pets,
    carsCount: typeof staged.carsCount === 'number' ? staged.carsCount : baseline.carsCount,
    // Chat doesn't touch lifestyle fields — always keep the baseline so
    // `diffHousehold`'s `profileChanged` only fires for cars / new profile.
    lifestylePreference: baseline.lifestylePreference,
    diningOutFrequency: baseline.diningOutFrequency,
    hobbiesWithCosts: baseline.hobbiesWithCosts,
  };
}
