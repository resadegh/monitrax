/**
 * Phase 52 — KB write-back logic tests (pure vote-tally + graduation), plus the
 * default-OFF build gate. The DB upsert path is integration-covered; these pin
 * the maths that decides what graduates to the shared KB.
 */

import { describe, it, expect } from 'vitest';
import {
  applyVoteDelta,
  summariseVotes,
  recordContribution,
  KB_GRADUATION_K,
  KB_WRITE_ENABLED,
} from '@/lib/categorisation/kb/recordContribution';

describe('applyVoteDelta', () => {
  it('adds a new vote', () => {
    expect(applyVoteDelta({}, null, 'Groceries')).toEqual({ Groceries: 1 });
  });
  it('increments an existing category', () => {
    expect(applyVoteDelta({ Groceries: 4 }, null, 'Groceries')).toEqual({ Groceries: 5 });
  });
  it('moves a vote when a user changes their mind (no net count change)', () => {
    expect(applyVoteDelta({ Groceries: 3, Household: 1 }, 'Groceries', 'Household')).toEqual({
      Groceries: 2,
      Household: 2,
    });
  });
  it('drops a category that hits zero', () => {
    expect(applyVoteDelta({ Groceries: 1 }, 'Groceries', 'Household')).toEqual({ Household: 1 });
  });
  it('caps the distribution to the top-N', () => {
    const big = { a: 9, b: 8, c: 7, d: 6, e: 5, f: 4, g: 3 };
    const out = applyVoteDelta(big, null, 'a');
    expect(Object.keys(out).length).toBeLessThanOrEqual(6);
    expect(out.a).toBe(10);
    expect(out.g).toBeUndefined(); // smallest dropped
  });
});

describe('summariseVotes', () => {
  it('picks the dominant category + share as confidence', () => {
    const s = summariseVotes({ Groceries: 9, Household: 1 }, 3);
    expect(s.topCategory).toBe('Groceries');
    expect(s.confidence).toBeCloseTo(0.9);
  });
  it('does NOT graduate below k distinct users', () => {
    expect(summariseVotes({ Groceries: 4 }, KB_GRADUATION_K - 1).isGlobal).toBe(false);
  });
  it('graduates at exactly k distinct users', () => {
    expect(summariseVotes({ Groceries: 5 }, KB_GRADUATION_K).isGlobal).toBe(true);
  });
  it('empty tally → no category, zero confidence', () => {
    expect(summariseVotes({}, 0)).toEqual({ topCategory: null, confidence: 0, isGlobal: false });
  });
});

describe('recordContribution — build gate', () => {
  it('is OFF by default (no cross-user write without explicit enable)', async () => {
    expect(KB_WRITE_ENABLED).toBe(false);
    const r = await recordContribution({ userId: 'u1', rawDescription: 'WOOLWORTHS 1234', category: 'Groceries' });
    expect(r).toEqual({ ok: false, skipped: 'disabled' });
  });
});
