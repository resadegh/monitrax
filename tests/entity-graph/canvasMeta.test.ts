/**
 * Phase 44 Part 1c — entity-structure canvas pure-logic tests (§11A).
 *
 * The canvas is presentational, but its pure pieces — lens edge-filter,
 * dagre layout adapter, API-error extraction — are unit-testable and
 * worth pinning so a future refactor can't silently break the lens
 * toggle or the layout.
 */

import { describe, it, expect } from 'vitest';
import type { EntityRelationshipType } from '@prisma/client';
import {
  lensShowsEdge,
  ENTITY_TYPE_META,
  RELATIONSHIP_TYPE_META,
  entityTypeMeta,
  relationshipTypeMeta,
  ALL_RELATIONSHIP_TYPES,
} from '@/components/entities/canvas/graphMeta';
import { extractApiError } from '@/components/entities/canvas/entityGraphClient';

describe('Phase 44 Part 1c — canvas lens edge-filter', () => {
  it('Control lens shows the determinative + indicator control edges', () => {
    const shown: EntityRelationshipType[] = [
      'TRUSTEE_OF',
      'DIRECTOR_OF',
      'APPOINTOR_OF',
      'GUARDIAN_OF',
      'POWER_HOLDER_OF',
      'SHAREHOLDER_OF',
      'MEMBER_OF',
    ];
    for (const t of shown) {
      expect(lensShowsEdge('control', t)).toBe(true);
    }
  });

  it('Control lens hides pure-eligibility / family / office edges', () => {
    const hidden: EntityRelationshipType[] = [
      'BENEFICIARY_OF',
      'FAMILY_MEMBER_OF',
      'SECRETARY_OF',
      'UNITHOLDER_OF',
    ];
    for (const t of hidden) {
      expect(lensShowsEdge('control', t)).toBe(false);
    }
  });

  it('Ownership lens shows exactly the equity edges', () => {
    expect(lensShowsEdge('ownership', 'SHAREHOLDER_OF')).toBe(true);
    expect(lensShowsEdge('ownership', 'UNITHOLDER_OF')).toBe(true);
    expect(lensShowsEdge('ownership', 'PARTNER_OF')).toBe(true);
    expect(lensShowsEdge('ownership', 'TRUSTEE_OF')).toBe(false);
    expect(lensShowsEdge('ownership', 'DIRECTOR_OF')).toBe(false);
  });

  it('All lens shows every relationship type', () => {
    for (const t of ALL_RELATIONSHIP_TYPES) {
      expect(lensShowsEdge('all', t)).toBe(true);
    }
  });
});

describe('Phase 44 Part 1c — canvas metadata coverage', () => {
  it('every relationship type has metadata', () => {
    for (const t of ALL_RELATIONSHIP_TYPES) {
      const meta = relationshipTypeMeta(t);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(['control', 'ownership', 'eligibility', 'office', 'family']).toContain(meta.category);
    }
    expect(Object.keys(RELATIONSHIP_TYPE_META)).toHaveLength(19);
  });

  it('every entity type has an icon + labels', () => {
    // 19 LegalEntityType values across the Phase 44 widened taxonomy.
    expect(Object.keys(ENTITY_TYPE_META)).toHaveLength(19);
    const meta = entityTypeMeta('SMSF');
    expect(meta.short).toBe('SMSF');
    expect(meta.icon).toBeTruthy();
  });
});

// Phase 44 Part 1c dagre auto-layout adapter tests removed in Phase 6
// (2026-05-31) — the legacy EntityCanvas + canvas/layout.ts were
// retired when the new Wealth Universe canvas reached desktop + mobile
// parity. The layout function is now in
// `lib/data/wealthExplorerLayout.ts` (spatial, not dagre).

describe('Phase 44 Part 1c — API error extraction', () => {
  it('reads the canonical { error: { code, message } } shape', () => {
    const msg = extractApiError({ error: { code: 'DUPLICATE_EDGE', message: 'Already exists' } }, 409, 'fb');
    expect(msg).toContain('Already exists');
    expect(msg).toContain('409');
  });

  it('reads the simple { error: "string" } shape', () => {
    const msg = extractApiError({ error: 'Something broke' }, 500, 'fb');
    expect(msg).toContain('Something broke');
  });

  it('falls back when the body has no usable error', () => {
    expect(extractApiError({}, 503, 'Fallback text')).toBe('503 Fallback text');
    expect(extractApiError(null, 404, 'Not found')).toBe('404 Not found');
  });
});
