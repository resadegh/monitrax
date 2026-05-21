/**
 * entitiesSync — Phase 12 Track G.3a tests.
 *
 * Covers the PURE idempotency core (`diffEntities`), the wizard ⇄ snapshot
 * mappers, the quality guard, and `isPersistedId`. The two-pass parent
 * linking + network I/O in `syncEntities` are integration-tested via a
 * full wizard run; here we verify the diff never produces spurious ops.
 */

import { describe, it, expect } from 'vitest';
import {
  diffEntities,
  isPersistedId,
  snapshotToWizardEntities,
  wizardEntitiesToSnapshot,
  EMPTY_ENTITIES_SNAPSHOT,
  type EntityRecord,
  type EntitiesSnapshot,
} from '@/lib/onboarding/entitiesSync';
import type { EntityInput } from '@/components/onboarding/wizard/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function entity(over: Partial<EntityRecord> & { wizardId: string }): EntityRecord {
  return {
    name: 'Entity',
    type: 'COMPANY',
    role: 'HOLDING',
    abn: '',
    acn: '',
    tradingName: '',
    establishedDate: '',
    trustType: null,
    isForeignResident: false,
    hasTfn: false,
    tfn: '',
    ...over,
  };
}

const COMPANY = entity({
  wizardId: 'ent-co-1',
  id: 'ent-co-1',
  name: 'Smith Holdings Pty Ltd',
  type: 'COMPANY',
  role: 'HOLDING',
  abn: '51824753556',
  establishedDate: '2020-03-01',
  hasTfn: true,
});

const TRUST = entity({
  wizardId: 'ent-tr-1',
  id: 'ent-tr-1',
  name: 'Smith Family Trust',
  type: 'DISCRETIONARY_TRUST',
  role: 'INVESTMENT',
  establishedDate: '2020-04-01',
  trustType: 'DISCRETIONARY',
  parentRef: 'ent-co-1',
});

const persisted: EntitiesSnapshot = { entities: [COMPANY, TRUST] };

// ---------------------------------------------------------------------------
// diffEntities — idempotency
// ---------------------------------------------------------------------------

describe('diffEntities — idempotency', () => {
  it('produces zero ops on a no-edit re-entry', () => {
    expect(diffEntities(persisted, persisted).entityOps).toEqual([]);
  });

  it('produces zero ops after a mapper round-trip', () => {
    // The TFN read/write asymmetry (GET returns hasTfn, never the value)
    // must NOT cause a spurious op on re-entry — see entityCoreEqual.
    const roundTripped = wizardEntitiesToSnapshot(
      snapshotToWizardEntities(persisted),
    );
    expect(diffEntities(persisted, roundTripped).entityOps).toEqual([]);
  });

  it('produces zero ops for an empty list', () => {
    expect(
      diffEntities(EMPTY_ENTITIES_SNAPSHOT, EMPTY_ENTITIES_SNAPSHOT).entityOps,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// diffEntities — change classification
// ---------------------------------------------------------------------------

describe('diffEntities — change classification', () => {
  it('classifies a brand-new entity as CREATE', () => {
    const fresh = entity({ wizardId: 'temp_x', name: 'New Co' });
    const diff = diffEntities(persisted, {
      entities: [...persisted.entities, fresh],
    });
    expect(diff.entityOps).toHaveLength(1);
    expect(diff.entityOps[0].op).toBe('create');
    expect(diff.entityOps[0].wizardId).toBe('temp_x');
  });

  it('classifies an edited entity as UPDATE', () => {
    const edited = { ...TRUST, name: 'Smith Investment Trust' };
    const diff = diffEntities(persisted, { entities: [COMPANY, edited] });
    expect(diff.entityOps).toHaveLength(1);
    expect(diff.entityOps[0].op).toBe('update');
    expect(diff.entityOps[0].id).toBe('ent-tr-1');
  });

  it('classifies a removed entity as DELETE', () => {
    const diff = diffEntities(persisted, { entities: [COMPANY] });
    expect(diff.entityOps).toHaveLength(1);
    expect(diff.entityOps[0].op).toBe('delete');
    expect(diff.entityOps[0].id).toBe('ent-tr-1');
  });

  it('classifies a newly-typed TFN as UPDATE', () => {
    const withTfn = { ...COMPANY, tfn: '123456789' };
    const diff = diffEntities(persisted, { entities: [withTfn, TRUST] });
    expect(diff.entityOps).toHaveLength(1);
    expect(diff.entityOps[0].op).toBe('update');
  });

  it('classifies a trustType change as UPDATE', () => {
    const edited: EntityRecord = { ...TRUST, trustType: 'FIXED' };
    const diff = diffEntities(persisted, { entities: [COMPANY, edited] });
    expect(diff.entityOps).toHaveLength(1);
    expect(diff.entityOps[0].op).toBe('update');
  });

  it('produces NO core op for a parent-only change (parent reconciled separately)', () => {
    const reparented: EntityRecord = { ...TRUST, parentRef: undefined };
    const diff = diffEntities(persisted, { entities: [COMPANY, reparented] });
    expect(diff.entityOps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// wizardEntitiesToSnapshot — quality guard
// ---------------------------------------------------------------------------

describe('wizardEntitiesToSnapshot — quality guard', () => {
  const wiz = (over: Partial<EntityInput> & { id: string }): EntityInput => ({
    name: '',
    type: 'COMPANY',
    role: 'HOLDING',
    ...over,
  });

  it('drops an unpersisted entity with no name', () => {
    const snap = wizardEntitiesToSnapshot([
      wiz({ id: 'temp_blank', name: '' }),
      wiz({ id: 'temp_named', name: 'Real Co' }),
    ]);
    expect(snap.entities).toHaveLength(1);
    expect(snap.entities[0].name).toBe('Real Co');
  });

  it('keeps a persisted entity even if its name is blanked', () => {
    const snap = wizardEntitiesToSnapshot([
      wiz({ id: 'real-uuid-1', name: '' }),
    ]);
    expect(snap.entities).toHaveLength(1);
    expect(snap.entities[0].id).toBe('real-uuid-1');
  });

  it('drops synthetic ids so the diff classifies them as CREATE', () => {
    const snap = wizardEntitiesToSnapshot([wiz({ id: 'temp_new', name: 'New' })]);
    expect(snap.entities[0].id).toBeUndefined();
    expect(snap.entities[0].wizardId).toBe('temp_new');
  });
});

// ---------------------------------------------------------------------------
// isPersistedId
// ---------------------------------------------------------------------------

describe('isPersistedId', () => {
  it('treats real ids as persisted, synthetic ids as not', () => {
    expect(isPersistedId('a1b2c3-real-uuid')).toBe(true);
    expect(isPersistedId('temp_entity_123')).toBe(false);
    expect(isPersistedId('chat-abc')).toBe(false);
    expect(isPersistedId(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mappers — parent linkage round-trip
// ---------------------------------------------------------------------------

describe('mappers — parent linkage', () => {
  it('preserves the trust → trustee parent link across a round-trip', () => {
    const wizard = snapshotToWizardEntities(persisted);
    const trust = wizard.find((e) => e.name === 'Smith Family Trust');
    expect(trust?.parentEntityTempId).toBe('ent-co-1');

    const back = wizardEntitiesToSnapshot(wizard);
    const trustRec = back.entities.find((e) => e.name === 'Smith Family Trust');
    expect(trustRec?.parentRef).toBe('ent-co-1');
  });
});
