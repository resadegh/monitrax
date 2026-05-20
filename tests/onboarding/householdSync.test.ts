/**
 * Phase 12 Track F.1 — household two-way sync: idempotency tests.
 *
 * The §5.3 / §7 contract the design doc demands proof of:
 *   "Re-opening a step and clicking Continue without changes must NOT
 *    duplicate rows."
 *
 * `diffHousehold` is the pure core that guarantees this — re-entry with
 * no edits must diff to an empty op set. `chatStagedToSnapshot` is the
 * chat-side bridge that recovers real-table ids by name so the chat
 * household topic is idempotent on re-entry too.
 *
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest';
import {
  diffHousehold,
  chatStagedToSnapshot,
  wizardSliceToSnapshot,
  snapshotToWizardSlice,
  isPersistedId,
  EMPTY_HOUSEHOLD_SNAPSHOT,
  type HouseholdSnapshot,
} from '@/lib/onboarding/householdSync';

// A realistic real-table snapshot — what `readHousehold()` returns for a
// user who already has a household (Reza's repro: spouse + self + 3 pets).
const persistedSnapshot: HouseholdSnapshot = {
  profileExists: true,
  members: [
    { id: 'uuid-self', name: 'Reza', relationship: 'SELF', isIncomeEarner: true },
    { id: 'uuid-spouse', name: 'Newsha', relationship: 'SPOUSE', isIncomeEarner: true },
  ],
  pets: [
    { id: 'uuid-moti', name: 'Moti', type: 'CAT' },
    { id: 'uuid-asal', name: 'Asal', type: 'DOG' },
    { id: 'uuid-fandogh', name: 'Fandogh', type: 'DOG' },
  ],
  carsCount: 2,
  lifestylePreference: 'MODERATE',
  diningOutFrequency: 'SOMETIMES',
  hobbiesWithCosts: '',
};

describe('diffHousehold — re-entry idempotency (§5.3)', () => {
  it('produces ZERO ops when current === snapshot (re-open + Continue, no edits)', () => {
    const diff = diffHousehold(persistedSnapshot, persistedSnapshot);
    expect(diff.memberOps).toEqual([]);
    expect(diff.petOps).toEqual([]);
    expect(diff.profileChanged).toBe(false);
  });

  it('produces ZERO ops after a round-trip through wizard mappers (the real re-entry path)', () => {
    // This is exactly what the wizard step does: snapshot → WizardData
    // slice (on open) → back to a snapshot (on Continue). A no-edit
    // round-trip must still diff to nothing — otherwise re-entering the
    // household step and pressing Continue would duplicate every row.
    const wizardSlice = snapshotToWizardSlice(persistedSnapshot);
    const current = wizardSliceToSnapshot(wizardSlice);
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toEqual([]);
    expect(diff.petOps).toEqual([]);
    expect(diff.profileChanged).toBe(false);
  });

  it('classifies a brand-new member (no id) as CREATE', () => {
    const current: HouseholdSnapshot = {
      ...persistedSnapshot,
      members: [
        ...persistedSnapshot.members,
        // No id → never persisted.
        { name: 'Ava', relationship: 'CHILD', isIncomeEarner: false },
      ],
    };
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toHaveLength(1);
    expect(diff.memberOps[0].op).toBe('create');
    expect(diff.memberOps[0].id).toBeUndefined();
    expect(diff.memberOps[0].record.name).toBe('Ava');
  });

  it('classifies an edited persisted member as UPDATE (keeps the id)', () => {
    const current: HouseholdSnapshot = {
      ...persistedSnapshot,
      members: persistedSnapshot.members.map((m) =>
        m.id === 'uuid-spouse' ? { ...m, isIncomeEarner: false } : m,
      ),
    };
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toHaveLength(1);
    expect(diff.memberOps[0]).toMatchObject({ op: 'update', id: 'uuid-spouse' });
  });

  it('classifies a removed persisted member as DELETE (hard-delete, Q-F2)', () => {
    const current: HouseholdSnapshot = {
      ...persistedSnapshot,
      members: persistedSnapshot.members.filter((m) => m.id !== 'uuid-spouse'),
    };
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toHaveLength(1);
    expect(diff.memberOps[0]).toMatchObject({ op: 'delete', id: 'uuid-spouse' });
  });

  it('handles a mixed pet diff — create + update + delete in one pass', () => {
    const current: HouseholdSnapshot = {
      ...persistedSnapshot,
      pets: [
        { id: 'uuid-moti', name: 'Moti', type: 'CAT' }, // unchanged → no-op
        { id: 'uuid-asal', name: 'Asal', type: 'CAT' }, // type changed → update
        // uuid-fandogh removed → delete
        { name: 'Pishi', type: 'CAT' }, // new → create
      ],
    };
    const diff = diffHousehold(persistedSnapshot, current);
    const byOp = (op: string) => diff.petOps.filter((o) => o.op === op);
    expect(byOp('create')).toHaveLength(1);
    expect(byOp('update')).toHaveLength(1);
    expect(byOp('update')[0].id).toBe('uuid-asal');
    expect(byOp('delete')).toHaveLength(1);
    expect(byOp('delete')[0].id).toBe('uuid-fandogh');
  });

  it('flags profileChanged when carsCount differs', () => {
    const diff = diffHousehold(persistedSnapshot, {
      ...persistedSnapshot,
      carsCount: 3,
    });
    expect(diff.profileChanged).toBe(true);
    expect(diff.memberOps).toEqual([]);
  });

  it('flags profileChanged when no profile exists yet (first-ever save)', () => {
    const fresh: HouseholdSnapshot = {
      ...EMPTY_HOUSEHOLD_SNAPSHOT,
      members: [{ name: 'Reza', relationship: 'SELF', isIncomeEarner: true }],
    };
    const diff = diffHousehold(EMPTY_HOUSEHOLD_SNAPSHOT, fresh);
    expect(diff.profileChanged).toBe(true);
    expect(diff.memberOps).toHaveLength(1);
    expect(diff.memberOps[0].op).toBe('create');
  });
});

describe('chatStagedToSnapshot — chat re-entry idempotency', () => {
  it('reconciles id-less chat members against the baseline by name → no duplicates', () => {
    // Chat re-entry: the LLM re-extracts the full member list with NO ids.
    // Reconciliation by name must recover the real-table ids so the diff
    // sees UPDATE/no-op, not CREATE.
    const current = chatStagedToSnapshot(persistedSnapshot, {
      householdMembers: [
        { name: 'Reza', relationship: 'SELF', isIncomeEarner: true },
        { name: 'newsha', relationship: 'SPOUSE', isIncomeEarner: true }, // case-insensitive
      ],
      householdPets: [
        { name: 'Moti', type: 'CAT' },
        { name: 'Asal', type: 'DOG' },
        { name: 'Fandogh', type: 'DOG' },
      ],
      carsCount: 2,
    });
    const diff = diffHousehold(persistedSnapshot, current);
    // Re-confirming the same household in chat must write nothing.
    expect(diff.memberOps).toEqual([]);
    expect(diff.petOps).toEqual([]);
    expect(diff.profileChanged).toBe(false);
  });

  it('preserves the baseline date-of-birth the chat never captures', () => {
    const baselineWithDob: HouseholdSnapshot = {
      ...persistedSnapshot,
      members: [
        { id: 'uuid-child', name: 'Ava', relationship: 'CHILD', dateOfBirth: '2018-03-01', isIncomeEarner: false },
      ],
    };
    const current = chatStagedToSnapshot(baselineWithDob, {
      householdMembers: [{ name: 'Ava', relationship: 'CHILD', isIncomeEarner: false }],
    });
    // DoB carried through → diff sees no change (chat would otherwise wipe it).
    expect(current.members[0].dateOfBirth).toBe('2018-03-01');
    const diff = diffHousehold(baselineWithDob, current);
    expect(diff.memberOps).toEqual([]);
  });

  it('falls back to the baseline when the chat never extracted members/pets', () => {
    const current = chatStagedToSnapshot(persistedSnapshot, { carsCount: 2 });
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toEqual([]);
    expect(diff.petOps).toEqual([]);
    expect(diff.profileChanged).toBe(false);
  });

  it('classifies a member the user removed in chat as DELETE', () => {
    const current = chatStagedToSnapshot(persistedSnapshot, {
      householdMembers: [{ name: 'Reza', relationship: 'SELF', isIncomeEarner: true }],
    });
    const diff = diffHousehold(persistedSnapshot, current);
    expect(diff.memberOps).toHaveLength(1);
    expect(diff.memberOps[0]).toMatchObject({ op: 'delete', id: 'uuid-spouse' });
  });
});

describe('isPersistedId — distinguishes real uuids from synthetic wizard ids', () => {
  it('treats real uuids as persisted', () => {
    expect(isPersistedId('3f1a8c2e-0000-4444-8888-abcdef012345')).toBe(true);
  });
  it('treats synthetic wizard/chat ids as NOT persisted', () => {
    expect(isPersistedId('member-1716100000000')).toBe(false);
    expect(isPersistedId('pet-1716100000000')).toBe(false);
    expect(isPersistedId('new-member-abc')).toBe(false);
    expect(isPersistedId('new-pet-abc')).toBe(false);
    expect(isPersistedId('chat-0-1716100000000')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});
