/**
 * Neomatrix Layer-1/Layer-3 enforcement (Phase 53 N1).
 *
 * Runs in the existing vitest suite (already a required CI check), so the
 * financial-graph model is machine-enforced today — without touching
 * vercel-build. Documentation/model only; reads the JSON + engine files,
 * never executes financial logic.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — pure ESM helper, no types
import { validateGraph, auditInvariants, renderMarkdown } from '../../scripts/neomatrix/graphlib.mjs';

const ROOT = process.cwd();
const graph = JSON.parse(
  readFileSync(resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);

describe('Neomatrix — financial-graph.json', () => {
  it('passes structural schema validation (§5)', () => {
    expect(validateGraph(graph)).toEqual([]);
  });

  it('passes the correctness invariants (no orphan number, no contradiction)', () => {
    const { errors } = auditInvariants(graph);
    expect(errors).toEqual([]);
  });

  it('every documented engine/orchestrator node resolves to its file:line in source', () => {
    const failures: string[] = [];
    for (const n of graph.nodes) {
      if ((n.kind !== 'engine' && n.kind !== 'orchestrator') || n.status !== 'documented') continue;
      if (!n.file || n.line == null) continue;
      const symbol = String(n.id).split('.').pop()!;
      const lines = readFileSync(resolve(ROOT, n.file), 'utf8').split('\n');
      const line = lines[n.line - 1] ?? '';
      if (!line.includes(symbol)) {
        failures.push(`${n.id}: ${n.file}:${n.line} does not contain "${symbol}" (got: ${line.trim().slice(0, 80)})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('the committed generated markdown is fresh (derive-don\'t-hand-maintain)', () => {
    const committed = readFileSync(resolve(ROOT, 'docs/financial-logic/graph/GENERATED_CORE.md'), 'utf8');
    expect(committed).toBe(renderMarkdown(graph));
  });

  // Trust Engine ↔ Neomatrix (2026-06-25). A `verification` node PROVES an
  // engine/number — it is useless unwired. Lock the convention so every future
  // Trust Engine layer (L0/L1/L3) connects to what it verifies (§21.2.1).
  it('every verification node connects to an engine/number it proves (no orphan assurance)', () => {
    const proved = new Set(
      graph.edges.filter((e: any) => e.type === 'verified-by').map((e: any) => e.to),
    );
    const orphans = graph.nodes
      .filter((n: any) => n.kind === 'verification' && !proved.has(n.id))
      .map((n: any) => n.id);
    expect(orphans).toEqual([]);
  });

  it('every verified-by edge targets a verification node and sources an engine/number', () => {
    const byId = new Map(graph.nodes.map((n: any) => [n.id, n]));
    const bad: string[] = [];
    for (const e of graph.edges.filter((x: any) => x.type === 'verified-by')) {
      if ((byId.get(e.to) as any)?.kind !== 'verification') bad.push(`${e.from}→${e.to}: target not a verification node`);
      const fromKind = (byId.get(e.from) as any)?.kind;
      if (fromKind !== 'engine' && fromKind !== 'number' && fromKind !== 'orchestrator') {
        bad.push(`${e.from}→${e.to}: source is ${fromKind}, expected engine/number/orchestrator`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('Neomatrix — the audit catches real drift (negative tests)', () => {
  it('A3: flags an orphan number with no engine ancestor', () => {
    const bad = {
      nodes: [
        { id: 'number.orphan', kind: 'number', label: 'Orphan', layer: null, domain: 'core', status: 'documented', verifiedDate: '2026-06-23', semanticKey: 'orphan' },
      ],
      edges: [],
    };
    const { errors } = auditInvariants(bad);
    expect(errors.some((e: string) => e.includes('no inbound path to an engine'))).toBe(true);
  });

  it('A3-converge: flags two tiles of the same concept tracing to different engines (the #1201 class)', () => {
    const bad = {
      nodes: [
        { id: 'engine.a', kind: 'engine', label: 'A', file: 'x', line: 1, layer: 'engine', domain: 'core', status: 'documented', verifiedDate: '2026-06-23' },
        { id: 'engine.b', kind: 'engine', label: 'B', file: 'x', line: 1, layer: 'engine', domain: 'core', status: 'documented', verifiedDate: '2026-06-23' },
        { id: 'number.viaA', kind: 'number', label: 'via A', layer: null, domain: 'core', status: 'documented', verifiedDate: '2026-06-23', semanticKey: 'cashflow' },
        { id: 'number.viaB', kind: 'number', label: 'via B', layer: null, domain: 'core', status: 'documented', verifiedDate: '2026-06-23', semanticKey: 'cashflow' },
      ],
      edges: [
        { from: 'engine.a', to: 'number.viaA', type: 'feeds', source: 'verified', evidence: 'x' },
        { from: 'engine.b', to: 'number.viaB', type: 'feeds', source: 'verified', evidence: 'x' },
      ],
    };
    const { errors } = auditInvariants(bad);
    expect(errors.some((e: string) => e.includes('A3-converge'))).toBe(true);
  });
});
