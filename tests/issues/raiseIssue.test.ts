/**
 * NEOAUDIT finding-bus lock (NEOAUDIT.md §3.1; §8 step-6) — proves `issues:raise`
 * scaffolds a GATE-VALID OPEN entry, de-dups by semanticKey+surface, and never
 * emits an unmodelled semanticKey. Validated against the REAL registry gate
 * (`checkIssues`) + the REAL Neomatrix graph, so a drift in either surfaces here.
 *
 * PURE helpers only (no file writes) — the CLI's write path is exercised
 * manually + self-validated by the gate it runs after each write.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEntry, splitKeys, findDuplicate, nextId } from '../../scripts/issues/raise-issue.mjs';
import { checkIssues } from '../../scripts/issues/check-issues.mjs';

const ROOT = resolve(__dirname, '../..');
const GRAPH = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');

// A real, resolving Neomatrix node id (so the semanticKey tie passes the gate).
const graphNodes: Set<string> = existsSync(GRAPH)
  ? new Set(JSON.parse(readFileSync(GRAPH, 'utf8')).nodes.map((n: { id: string }) => n.id))
  : new Set();
const REAL_KEY = [...graphNodes][0];
const TODAY = '2026-07-13';

const baseArgs = {
  title: 'TESTONLY finding',
  area: 'cashflow',
  surface: 'app/dashboard/testonly.tsx',
  node: 'R2-num parity matrix',
  run: 'job-abc',
  semanticKey: [] as string[],
  rootCause: [] as string[],
};

describe('issues:raise — buildEntry produces a GATE-VALID OPEN entry', () => {
  it('a scaffolded entry passes the real registry gate (no errors for its id)', () => {
    const { resolving, unmodelled } = splitKeys([REAL_KEY], graphNodes);
    const entry = buildEntry({ ...baseArgs, semanticKey: [REAL_KEY] }, resolving, unmodelled, 'MON-900', TODAY);
    const { errors } = checkIssues({ today: TODAY, registry: { schemaVersion: '1.1', issues: [entry] } });
    expect(errors.filter((e) => e.includes('[MON-900]'))).toEqual([]);
  });

  it('OPEN entry carries every REQUIRED field + a plain.issue', () => {
    const entry = buildEntry(baseArgs, [], [], 'MON-901', TODAY);
    for (const f of ['id', 'title', 'status', 'severity', 'changesNumbers', 'opened', 'area', 'rootCause', 'semanticKeys', 'downstreamConsumers', 'fixPRs', 'test', 'tracker']) {
      expect(entry).toHaveProperty(f);
    }
    expect(entry.status).toBe('OPEN');
    expect(entry.plain.issue).toBeTruthy();
  });

  it('an UNMODELLED key is NEVER emitted as a semanticKey (noted instead — §21.5)', () => {
    const { resolving, unmodelled } = splitKeys(['number.doesNotExistAnywhere'], graphNodes);
    expect(resolving).toEqual([]);
    expect(unmodelled).toEqual(['number.doesNotExistAnywhere']);
    const entry = buildEntry({ ...baseArgs, semanticKey: ['number.doesNotExistAnywhere'] }, resolving, unmodelled, 'MON-902', TODAY);
    expect(entry.semanticKeys).toEqual([]); // gate would reject a non-resolving key
    expect(entry.notes).toMatch(/Unmodelled semanticKey/);
    // and it still passes the gate (empty keys is valid at OPEN)
    const { errors } = checkIssues({ today: TODAY, registry: { schemaVersion: '1.1', issues: [entry] } });
    expect(errors.filter((e) => e.includes('[MON-902]'))).toEqual([]);
  });
});

describe('issues:raise — de-dup by semanticKey + surface', () => {
  const live = {
    id: 'MON-500', status: 'FIXING', semanticKeys: ['number.propertyCashflow'],
    downstreamConsumers: ['app/dashboard/properties/[id]/page.tsx'], title: 'x', notes: '',
  };

  it('matches a LIVE issue sharing a key AND the surface', () => {
    const dup = findDuplicate([live], ['number.propertyCashflow'], 'app/dashboard/properties/[id]/page.tsx');
    expect(dup?.id).toBe('MON-500');
  });

  it('does NOT match when the surface differs (same key, other page)', () => {
    expect(findDuplicate([live], ['number.propertyCashflow'], 'app/dashboard/other.tsx')).toBeUndefined();
  });

  it('does NOT match a terminal (CLOSED) issue — a fixed bug can recur', () => {
    const closed = { ...live, status: 'CLOSED' };
    expect(findDuplicate([closed], ['number.propertyCashflow'], 'app/dashboard/properties/[id]/page.tsx')).toBeUndefined();
  });
});

describe('issues:raise — nextId', () => {
  it('allocates max+1, zero-padded to 3', () => {
    expect(nextId([{ id: 'MON-001' }, { id: 'MON-034' }, { id: 'MON-009' }])).toBe('MON-035');
    expect(nextId([])).toBe('MON-001');
  });
});

describe('issues:raise — negative control (the gate we validate against is real)', () => {
  it('a bogus rootCause anchor DOES trip the gate', () => {
    const entry = buildEntry({ ...baseArgs, rootCause: ['no/such/file.ts:1'] }, [], [], 'MON-903', TODAY);
    const { errors } = checkIssues({ today: TODAY, registry: { schemaVersion: '1.1', issues: [entry] } });
    expect(errors.some((e) => e.includes('[MON-903]') && /file not found/.test(e))).toBe(true);
  });
});
