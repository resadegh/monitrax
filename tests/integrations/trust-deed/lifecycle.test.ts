/**
 * Phase 41f.4 — Lifecycle transition invariants.
 *
 * Locks the EXTRACTED → CONFIRMED | REJECTED state machine. CONFIRMED
 * and REJECTED are terminal — re-uploading the deed creates a new
 * row; existing rows are never re-activated.
 */

import { describe, it, expect } from 'vitest';
import { isAllowedTransition } from '@/lib/integrations/trust-deed';

describe('Phase 41f.4 — TrustDeedRuleStatus lifecycle', () => {
  describe('from EXTRACTED', () => {
    it('allows transition to CONFIRMED', () => {
      expect(isAllowedTransition('EXTRACTED', 'CONFIRMED')).toBe(true);
    });

    it('allows transition to REJECTED', () => {
      expect(isAllowedTransition('EXTRACTED', 'REJECTED')).toBe(true);
    });

    it('does NOT allow transition to itself (self-transitions forbidden)', () => {
      expect(isAllowedTransition('EXTRACTED', 'EXTRACTED')).toBe(false);
    });
  });

  describe('from CONFIRMED (terminal)', () => {
    it('does NOT allow transition to EXTRACTED (cannot un-confirm)', () => {
      expect(isAllowedTransition('CONFIRMED', 'EXTRACTED')).toBe(false);
    });

    it('does NOT allow transition to REJECTED (cannot reject after confirm)', () => {
      expect(isAllowedTransition('CONFIRMED', 'REJECTED')).toBe(false);
    });

    it('does NOT allow transition to itself', () => {
      expect(isAllowedTransition('CONFIRMED', 'CONFIRMED')).toBe(false);
    });
  });

  describe('from REJECTED (terminal)', () => {
    it('does NOT allow transition to EXTRACTED (cannot un-reject)', () => {
      expect(isAllowedTransition('REJECTED', 'EXTRACTED')).toBe(false);
    });

    it('does NOT allow transition to CONFIRMED (cannot confirm after reject)', () => {
      expect(isAllowedTransition('REJECTED', 'CONFIRMED')).toBe(false);
    });

    it('does NOT allow transition to itself', () => {
      expect(isAllowedTransition('REJECTED', 'REJECTED')).toBe(false);
    });
  });

  describe('coverage — exhaustive matrix', () => {
    const states: Array<'EXTRACTED' | 'CONFIRMED' | 'REJECTED'> = [
      'EXTRACTED',
      'CONFIRMED',
      'REJECTED',
    ];

    it('only EXTRACTED has any outgoing transitions', () => {
      for (const from of states) {
        for (const to of states) {
          const allowed = isAllowedTransition(from, to);
          if (from === 'EXTRACTED' && (to === 'CONFIRMED' || to === 'REJECTED')) {
            expect(allowed).toBe(true);
          } else {
            expect(allowed).toBe(false);
          }
        }
      }
    });
  });
});
