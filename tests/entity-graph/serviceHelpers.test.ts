/**
 * Phase 44 Part 1b-ii — tests for the pure helpers of the graph-writer
 * services. The DB-touching write paths are integration-tested elsewhere
 * (no database in the unit-test environment, per the repo convention);
 * this file covers the deterministic helpers — the duplicate-edge window
 * overlap and the ownership-stake data-quality check.
 */

import { describe, it, expect } from 'vitest';
import { _windowsOverlapForTest as windowsOverlap } from '../../lib/services/entityRelationshipService';
import { validateOwnershipStakes } from '../../lib/services/ownershipService';

const d = (iso: string) => new Date(iso);

describe('windowsOverlap — duplicate-edge guard', () => {
  it('detects two open-ended windows as overlapping', () => {
    expect(windowsOverlap(d('2020-01-01'), null, d('2022-01-01'), null)).toBe(true);
  });

  it('treats adjacent (touching) windows as non-overlapping', () => {
    // [2020 → 2022) then [2022 → null) — the end is exclusive.
    expect(windowsOverlap(d('2020-01-01'), d('2022-01-01'), d('2022-01-01'), null)).toBe(false);
  });

  it('detects a partial overlap', () => {
    expect(windowsOverlap(d('2020-01-01'), d('2023-01-01'), d('2022-01-01'), d('2024-01-01'))).toBe(
      true,
    );
  });

  it('treats fully-separated windows as non-overlapping', () => {
    expect(windowsOverlap(d('2020-01-01'), d('2021-01-01'), d('2023-01-01'), d('2024-01-01'))).toBe(
      false,
    );
  });
});

describe('validateOwnershipStakes', () => {
  it('warns when tenants-in-common shares do not sum to 100', () => {
    const warnings = validateOwnershipStakes('TENANTS_IN_COMMON', [
      { entityId: 'a', sharePct: 60 },
      { entityId: 'b', sharePct: 30 },
    ]);
    expect(warnings.some((w) => w.includes('sum to 90'))).toBe(true);
  });

  it('is clean when tenants-in-common shares sum to 100', () => {
    const warnings = validateOwnershipStakes('TENANTS_IN_COMMON', [
      { entityId: 'a', sharePct: 50 },
      { entityId: 'b', sharePct: 50 },
    ]);
    expect(warnings).toHaveLength(0);
  });

  it('warns when a tenants-in-common stake has no percentage', () => {
    const warnings = validateOwnershipStakes('TENANTS_IN_COMMON', [
      { entityId: 'a', sharePct: 50 },
      { entityId: 'b' },
    ]);
    expect(warnings.some((w) => w.includes('no ownership percentage'))).toBe(true);
  });

  it('warns when a joint-tenancy stake is recorded without survivorship', () => {
    const warnings = validateOwnershipStakes('JOINT_TENANTS', [
      { entityId: 'a', survivorshipApplies: true },
      { entityId: 'b', survivorshipApplies: false },
    ]);
    expect(warnings.some((w) => w.includes('survivorship'))).toBe(true);
  });

  it('does not constrain percentages for joint tenancy', () => {
    const warnings = validateOwnershipStakes('JOINT_TENANTS', [
      { entityId: 'a', survivorshipApplies: true },
      { entityId: 'b', survivorshipApplies: true },
    ]);
    expect(warnings).toHaveLength(0);
  });
});
