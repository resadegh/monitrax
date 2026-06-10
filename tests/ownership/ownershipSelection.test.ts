/**
 * Phase 47 Stage A — ownership selection parsing + stake building.
 *
 * Pins the §4A personal-tier contract (PHASE_47_ENTITY_OWNERSHIP_FABRIC.md):
 *   - P2 joint = equal shares + survivorship on EVERY stake
 *   - P3 shared = explicit fractions that must total 100%, self included
 *   - malformed payloads are rejected loudly, absent payloads mean sole
 */

import { describe, it, expect } from 'vitest';
import {
  buildStakes,
  parseOwnershipSelection,
  OwnershipSelectionError,
} from '@/lib/services/ownershipSelectionService';

describe('parseOwnershipSelection', () => {
  it('returns null for an absent payload (sole default, zero-friction path)', () => {
    expect(parseOwnershipSelection(undefined)).toBeNull();
    expect(parseOwnershipSelection(null)).toBeNull();
  });

  it('parses sole and entity modes', () => {
    expect(parseOwnershipSelection({ mode: 'sole' })).toEqual({ mode: 'sole' });
    expect(parseOwnershipSelection({ mode: 'entity', entityId: 'e1' })).toEqual({
      mode: 'entity',
      entityId: 'e1',
    });
  });

  it('rejects entity mode without an entityId', () => {
    expect(() => parseOwnershipSelection({ mode: 'entity' })).toThrow(OwnershipSelectionError);
  });

  it('parses joint with named co-owners', () => {
    const sel = parseOwnershipSelection({ mode: 'joint', coOwners: [{ name: 'Sarah' }] });
    expect(sel).toEqual({ mode: 'joint', coOwners: [{ entityId: undefined, name: 'Sarah' }] });
  });

  it('rejects joint with no co-owners', () => {
    expect(() => parseOwnershipSelection({ mode: 'joint', coOwners: [] })).toThrow(
      OwnershipSelectionError,
    );
  });

  it('rejects a co-owner with neither entityId nor name', () => {
    expect(() => parseOwnershipSelection({ mode: 'joint', coOwners: [{}] })).toThrow(
      OwnershipSelectionError,
    );
  });

  it('parses shared with a self stake and shares totalling 100', () => {
    const sel = parseOwnershipSelection({
      mode: 'shared',
      owners: [
        { isSelf: true, sharePct: 70 },
        { name: 'Sarah', sharePct: 30 },
      ],
    });
    expect(sel?.mode).toBe('shared');
    if (sel?.mode === 'shared') {
      expect(sel.owners[0].isSelf).toBe(true);
      expect(sel.owners[1].name).toBe('Sarah');
    }
  });

  it('rejects shared when shares do not total 100%', () => {
    expect(() =>
      parseOwnershipSelection({
        mode: 'shared',
        owners: [
          { isSelf: true, sharePct: 70 },
          { name: 'Sarah', sharePct: 20 },
        ],
      }),
    ).toThrow(/total 100%/);
  });

  it('rejects shared without a self stake', () => {
    expect(() =>
      parseOwnershipSelection({
        mode: 'shared',
        owners: [
          { name: 'A', sharePct: 50 },
          { name: 'B', sharePct: 50 },
        ],
      }),
    ).toThrow(/your own stake/);
  });

  it('rejects unknown modes', () => {
    expect(() => parseOwnershipSelection({ mode: 'partnership' })).toThrow(
      OwnershipSelectionError,
    );
  });
});

describe('buildStakes', () => {
  it('joint → equal shares with survivorship on every stake (P2, TR 93/32)', () => {
    const stakes = buildStakes(
      { mode: 'joint', coOwners: [{ name: 'Sarah' }] },
      'self-entity',
      ['sarah-entity'],
    );
    expect(stakes).toEqual([
      { entityId: 'self-entity', sharePct: 50, survivorshipApplies: true },
      { entityId: 'sarah-entity', sharePct: 50, survivorshipApplies: true },
    ]);
  });

  it('joint with two co-owners → thirds, all with survivorship', () => {
    const stakes = buildStakes(
      { mode: 'joint', coOwners: [{ name: 'A' }, { name: 'B' }] },
      'self',
      ['a', 'b'],
    );
    expect(stakes).toHaveLength(3);
    expect(stakes.every(s => s.survivorshipApplies)).toBe(true);
    expect(stakes.every(s => s.sharePct === 33.33)).toBe(true);
  });

  it('shared → explicit fractions, no survivorship (P3)', () => {
    const stakes = buildStakes(
      {
        mode: 'shared',
        owners: [
          { isSelf: true, sharePct: 70 },
          { name: 'Sarah', sharePct: 30 },
        ],
      },
      'self-entity',
      ['sarah-entity'],
    );
    expect(stakes).toEqual([
      { entityId: 'self-entity', sharePct: 70, survivorshipApplies: false },
      { entityId: 'sarah-entity', sharePct: 30, survivorshipApplies: false },
    ]);
  });
});
