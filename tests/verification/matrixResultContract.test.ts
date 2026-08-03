/**
 * matrix-result/v1 contract — the RULE A account-first sha carve-out.
 *
 * Why this file exists: Rule A was shipped in #1573 verified only by three
 * payloads run by hand. A hand-run check does not survive the next edit — the
 * carve-out could be widened (or the guarded success line un-guarded) and
 * nothing would notice. These tests pin the three conditions so a future change
 * to the exemption has to be deliberate.
 *
 * The rule (Reza, 2026-08-03, resolving VR-046 F3): a Ring-3 run MUST be
 * account-first, yet only the admin relay exposes the deployed commit — so a
 * compliant run could not satisfy its own return contract. `sha: null` is
 * therefore permitted, but ONLY when all three hold:
 *   1. kind === 'ring3'   (relay/golden captures read the relay — no excuse)
 *   2. sha === null       (explicitly null; absent/undefined/'' is an oversight)
 *   3. shaNote >= 40 chars (a substantive, auditable stated reason)
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs script without type declarations; validated at runtime.
import { validateMatrixResult } from '../../scripts/verification/check-matrix-result.mjs';

const REASON =
  'NOT ASSERTED — no user-side rendered surface exposes the deployed commit; only the admin relay does, and the account-first law forbids opening it.';

/** A minimal payload that satisfies every rule EXCEPT whatever a test overrides. */
const base = (over: Record<string, unknown> = {}) => ({
  schema: 'matrix-result/v1',
  kind: 'ring3',
  runId: 'VR-TEST',
  handout: 'docs/verification/briefs/EXAMPLE.md',
  sha: null,
  shaNote: REASON,
  capturedAt: '2026-08-03T01:10:00Z',
  account: {
    userId: '91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c',
    identityAssertion: {
      expected: { loanCount: 5 },
      observed: { loanCount: 5 },
      pass: true,
    },
  },
  verdict: 'PASS',
  checks: [{ id: 'A1', expected: 1, observed: 1, pass: true }],
  coverage: {
    verified: 'Asserts the loan count and one check on the account under test.',
    notVerified: 'Establishes no rate, no calculation, and moves no number.',
  },
  ...over,
});

/** The validator returns { ok, errors, warnings }; `errors` empty means well-formed. */
const problems = (payload: unknown): string[] => validateMatrixResult(payload).errors ?? [];
const shaProblems = (payload: unknown) => problems(payload).filter((p) => p.toLowerCase().includes('sha'));

describe('matrix-result/v1 — Rule A account-first sha exemption', () => {
  it('ACCEPTS a ring3 run with null sha and a substantive shaNote', () => {
    expect(shaProblems(base())).toEqual([]);
  });

  it('still ACCEPTS a real 40-char sha (the exemption did not replace the normal path)', () => {
    const ok = base({ sha: '915704f0622d55de0c287ef341e82be475661a2b', shaNote: undefined });
    expect(shaProblems(ok)).toEqual([]);
  });

  // ── condition 1: kind must be ring3 ──────────────────────────────────────
  it('REJECTS null sha on a non-ring3 kind — capture runs read the relay, so they have no excuse', () => {
    expect(shaProblems(base({ kind: 'capture' })).length).toBeGreaterThan(0);
  });

  // ── condition 2: explicitly null, not merely absent ──────────────────────
  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['a short non-sha string', 'HEAD'],
  ])('REJECTS %s as a sha — an omitted field is an oversight, null is a claim', (_label, value) => {
    expect(shaProblems(base({ sha: value })).length).toBeGreaterThan(0);
  });

  it('REJECTS a sha that is hex but the wrong length', () => {
    expect(shaProblems(base({ sha: '915704f0' })).length).toBeGreaterThan(0);
  });

  // ── condition 3: the reason must be substantive ──────────────────────────
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short to be a reason', 'no relay'],
    ['whitespace padded to length', '                                                  '],
  ])('REJECTS null sha when shaNote is %s', (_label, note) => {
    expect(shaProblems(base({ shaNote: note })).length).toBeGreaterThan(0);
  });

  it('accepts a shaNote of exactly the 40-char minimum (boundary is inclusive)', () => {
    const exactly40 = 'x'.repeat(40);
    expect(exactly40).toHaveLength(40);
    expect(shaProblems(base({ shaNote: exactly40 }))).toEqual([]);
  });

  it('REJECTS a shaNote one character below the minimum', () => {
    expect(shaProblems(base({ shaNote: 'x'.repeat(39) })).length).toBeGreaterThan(0);
  });
});

describe('matrix-result/v1 — the exemption did not weaken the other gates', () => {
  it('still requires an identity assertion, even on an exempt run', () => {
    const noIdentity = base({ account: { userId: 'u1' } });
    expect(problems(noIdentity).some((p) => p.includes('identityAssertion'))).toBe(true);
  });

  it('still requires coverage.notVerified — §22.2.4 applies to exempt runs too', () => {
    const noCoverage = base({ coverage: { verified: 'something' } });
    expect(problems(noCoverage).some((p) => p.includes('notVerified'))).toBe(true);
  });

  it('still requires checks[] — a verification with nothing checked is not a verification', () => {
    expect(problems(base({ checks: [] })).length).toBeGreaterThan(0);
  });
});
