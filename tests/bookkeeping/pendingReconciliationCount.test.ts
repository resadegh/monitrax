/**
 * Phase 42 PR6.5e — Pending-reconciliation count formatter tests.
 *
 * The sidebar badge on "My Accounts" renders this directly. If
 * the cap silently changes (e.g. 100+ → 1000+), the badge blows
 * out of its 22px pill on edge-case users. These tests pin the
 * Slack/Mail-style "99+" contract.
 */

import { describe, it, expect } from 'vitest';
import { formatReconciliationCount } from '../../hooks/usePendingReconciliationCount';

describe('formatReconciliationCount', () => {
  it('returns empty string for zero (badge self-hides)', () => {
    expect(formatReconciliationCount(0)).toBe('');
  });

  it('returns empty string for negative (defensive)', () => {
    expect(formatReconciliationCount(-1)).toBe('');
    expect(formatReconciliationCount(-100)).toBe('');
  });

  it('returns the exact number for 1..99', () => {
    expect(formatReconciliationCount(1)).toBe('1');
    expect(formatReconciliationCount(7)).toBe('7');
    expect(formatReconciliationCount(50)).toBe('50');
    expect(formatReconciliationCount(99)).toBe('99');
  });

  it('caps at "99+" for 100 and above (Slack / Mail convention)', () => {
    expect(formatReconciliationCount(100)).toBe('99+');
    expect(formatReconciliationCount(500)).toBe('99+');
    expect(formatReconciliationCount(9999)).toBe('99+');
  });

  it('boundary: 99 is exact, 100 is capped', () => {
    expect(formatReconciliationCount(99)).toBe('99');
    expect(formatReconciliationCount(100)).toBe('99+');
  });
});
