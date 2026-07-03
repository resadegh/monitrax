/**
 * Issue Registry gate — CI enforcement (CLAUDE.md §19.4).
 *
 * Two jobs:
 *   1. The committed ISSUES.json is always valid (schema + lifecycle).
 *   2. PROVE the gate actually blocks the whack-a-mole: a number-changing
 *      issue cannot reach VERIFIED/CLOSED without a linked, existing holistic
 *      test. If this enforcement ever regresses, this suite fails.
 */

import { describe, it, expect } from 'vitest';
// The gate is pure Node (no deps); import it directly.
// @ts-expect-error — .mjs has no types; the shape is validated below.
import { checkIssues } from '../../scripts/issues/check-issues.mjs';

const base = {
  id: 'MON-999',
  title: 'synthetic',
  status: 'CLOSED',
  severity: 'high',
  changesNumbers: true,
  opened: '2026-07-03',
  closed: '2026-07-03',
  area: 'test',
  rootCause: [],
  semanticKeys: ['engine.canonicalCashflow.resolveCanonicalCashflow'], // a real Neomatrix node
  downstreamConsumers: ['x'],
  fixPRs: [1],
  test: 'tests/issues/registry.test.ts', // an existing file
  tracker: 'docs/issues/README.md',
};
const wrap = (issue: Record<string, unknown>) => ({ schemaVersion: '1.0', issues: [issue] });

describe('issue registry gate', () => {
  it('the committed ISSUES.json passes the gate', () => {
    const { errors } = checkIssues({ today: '2026-07-03' });
    expect(errors).toEqual([]);
  });

  it('a fully-formed CLOSED number-changing issue passes', () => {
    const { errors } = checkIssues({ registry: wrap(base) });
    expect(errors).toEqual([]);
  });

  it('BLOCKS: number-changing issue CLOSED with no holistic test', () => {
    const { errors } = checkIssues({ registry: wrap({ ...base, test: null }) });
    expect(errors.some((e: string) => /without a holistic test/.test(e))).toBe(true);
  });

  it('BLOCKS: linked test file does not exist', () => {
    const { errors } = checkIssues({ registry: wrap({ ...base, test: 'tests/issues/does-not-exist.ts' }) });
    expect(errors.some((e: string) => /linked test not found/.test(e))).toBe(true);
  });

  it('BLOCKS: FIXING without the §19.4 downstream sweep', () => {
    const { errors } = checkIssues({ registry: wrap({ ...base, status: 'FIXING', closed: undefined, downstreamConsumers: [] }) });
    expect(errors.some((e: string) => /downstream-consumer sweep/.test(e))).toBe(true);
  });

  it('BLOCKS: semanticKey that is not a Neomatrix node', () => {
    const { errors } = checkIssues({ registry: wrap({ ...base, semanticKeys: ['engine.not.a.real.node'] }) });
    expect(errors.some((e: string) => /not a Neomatrix node/.test(e))).toBe(true);
  });

  it('ALLOWS: display-only issue can close without a test', () => {
    const { errors } = checkIssues({ registry: wrap({ ...base, changesNumbers: false, test: null, semanticKeys: [] }) });
    expect(errors).toEqual([]);
  });
});
