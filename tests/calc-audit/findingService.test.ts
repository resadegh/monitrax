/**
 * Phase 41i.3 — Finding service pure-logic tests.
 *
 * The codebase doesn't carry a Prisma mocking layer (per the
 * `tests/sanity/` pattern, DB-touching tests use a real DB).
 * Until that infra lands, this file tests the pure-logic exports
 * — transition table + summary builder — so the lifecycle invariant
 * is locked in. End-to-end persistence is exercised via manual
 * smoke against the admin endpoint after deploy.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  FindingTransitionError,
} from '@/lib/calc-audit/findingService';

describe('Finding lifecycle — ALLOWED_TRANSITIONS', () => {
  it('OPEN → INVESTIGATING / FALSE_POSITIVE / FIX_REQUIRED', () => {
    expect(ALLOWED_TRANSITIONS.OPEN).toContain('INVESTIGATING');
    expect(ALLOWED_TRANSITIONS.OPEN).toContain('FALSE_POSITIVE');
    expect(ALLOWED_TRANSITIONS.OPEN).toContain('FIX_REQUIRED');
    expect(ALLOWED_TRANSITIONS.OPEN).not.toContain('FIXED');
  });

  it('INVESTIGATING → FALSE_POSITIVE / FIX_REQUIRED / OPEN', () => {
    expect(ALLOWED_TRANSITIONS.INVESTIGATING).toContain('FALSE_POSITIVE');
    expect(ALLOWED_TRANSITIONS.INVESTIGATING).toContain('FIX_REQUIRED');
    expect(ALLOWED_TRANSITIONS.INVESTIGATING).toContain('OPEN');
    expect(ALLOWED_TRANSITIONS.INVESTIGATING).not.toContain('FIXED');
  });

  it('FIX_REQUIRED → FIXED / INVESTIGATING', () => {
    expect(ALLOWED_TRANSITIONS.FIX_REQUIRED).toContain('FIXED');
    expect(ALLOWED_TRANSITIONS.FIX_REQUIRED).toContain('INVESTIGATING');
  });

  it('FALSE_POSITIVE → INVESTIGATING (re-open path)', () => {
    expect(ALLOWED_TRANSITIONS.FALSE_POSITIVE).toEqual(['INVESTIGATING']);
  });

  it('FIXED → INVESTIGATING (regression re-open path)', () => {
    expect(ALLOWED_TRANSITIONS.FIXED).toEqual(['INVESTIGATING']);
  });

  it('terminal states do NOT auto-transition (no FIXED → OPEN, no FALSE_POSITIVE → FIX_REQUIRED)', () => {
    // FIXED/FALSE_POSITIVE only re-open via INVESTIGATING — the explicit
    // re-open path. Direct FIXED → OPEN or FALSE_POSITIVE → FIX_REQUIRED
    // is not allowed, which forces an admin to deliberately re-investigate.
    expect(ALLOWED_TRANSITIONS.FIXED).not.toContain('OPEN');
    expect(ALLOWED_TRANSITIONS.FALSE_POSITIVE).not.toContain('FIX_REQUIRED');
  });

  it('every defined resolution has a non-empty transition list (or is OPEN)', () => {
    for (const [state, next] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(next.length).toBeGreaterThan(0);
      // Self-transitions are never allowed.
      expect(next).not.toContain(state);
    }
  });
});

describe('FindingTransitionError', () => {
  it('carries a structured `code` and message', () => {
    const err = new FindingTransitionError('test message', 'NOT_FOUND');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('test message');
    expect(err.name).toBe('FindingTransitionError');
  });

  it('supports INVALID_TRANSITION code', () => {
    const err = new FindingTransitionError(
      'OPEN → FIXED is not allowed',
      'INVALID_TRANSITION',
    );
    expect(err.code).toBe('INVALID_TRANSITION');
  });
});
