/**
 * Phase 44 Part 1d — relationship-skeleton tests.
 *
 * Covers the two pure-ish pieces of the onboarding relationship step:
 *  - `getStepsForProfile` conditionally shows the `entity-relationships`
 *    step only when the user has a structure to wire.
 *  - `syncRelationships` writes the skeleton idempotently + best-effort.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStepsForProfile } from '@/components/onboarding/wizard/types';
import { syncRelationships } from '@/lib/onboarding/relationshipsSync';
import type { RelationshipInput } from '@/components/onboarding/wizard/types';

describe('Phase 44 Part 1d — getStepsForProfile relationship-step gate', () => {
  const hasStep = (steps: { id: string }[]) =>
    steps.some((s) => s.id === 'entity-relationships');

  // M2.6 #4: entity steps are module-gated fail-closed. These tests exercise
  // the RELATIONSHIP gate, so they enable MODULE_ENTITIES explicitly — the
  // module-gating behaviour itself is covered below.
  const entitiesOn = { enabledModules: { MODULE_ENTITIES: true } };

  it('shows entity-relationships when the user has a structure entity', () => {
    expect(
      hasStep(getStepsForProfile('MIXED', { hasStructureEntities: true, ...entitiesOn }))
    ).toBe(true);
  });

  it('hides entity-relationships when there is no non-personal entity', () => {
    expect(
      hasStep(getStepsForProfile('MIXED', { hasStructureEntities: false, ...entitiesOn }))
    ).toBe(false);
  });

  it('hides entity-relationships in the legacy no-context call', () => {
    expect(hasStep(getStepsForProfile('MIXED'))).toBe(false);
  });

  it('places entity-relationships immediately after the entities step', () => {
    const steps = getStepsForProfile('INVESTOR', { hasStructureEntities: true, ...entitiesOn });
    const entitiesIdx = steps.findIndex((s) => s.id === 'entities');
    const relIdx = steps.findIndex((s) => s.id === 'entity-relationships');
    expect(entitiesIdx).toBeGreaterThanOrEqual(0);
    expect(relIdx).toBe(entitiesIdx + 1);
  });

  it('M2.6 #4: hides entities + entity-relationships when MODULE_ENTITIES is disabled (fail-closed)', () => {
    const steps = getStepsForProfile('MIXED', { hasStructureEntities: true });
    expect(steps.findIndex((s) => s.id === 'entities')).toBe(-1);
    expect(hasStep(steps)).toBe(false);
  });
});

describe('Phase 44 Part 1d — syncRelationships', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rel = (over: Partial<RelationshipInput>): RelationshipInput => ({
    id: 'r1',
    fromEntityTempId: 'ent-real-from',
    toEntityTempId: 'ent-real-to',
    type: 'DIRECTOR_OF',
    ...over,
  });

  it('drops a self-edge without calling the API', async () => {
    const result = await syncRelationships('tok', [
      rel({ fromEntityTempId: 'ent-x', toEntityTempId: 'ent-x' }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 });
  });

  it('drops an edge that still references an unpersisted temp id', async () => {
    const result = await syncRelationships('tok', [
      rel({ fromEntityTempId: 'temp_abc123' }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('POSTs a valid edge and counts it created', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    const result = await syncRelationships('tok', [rel({})]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 });
  });

  it('treats a DUPLICATE_EDGE 409 as skipped (idempotent re-run)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'DUPLICATE_EDGE', message: 'exists' } }),
    });
    const result = await syncRelationships('tok', [rel({})]);
    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 });
  });

  it('counts a genuine error as failed without throwing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'RELATIONSHIP_CREATE_FAILED' } }),
    });
    const result = await syncRelationships('tok', [rel({})]);
    expect(result.failed).toBe(1);
  });
});
