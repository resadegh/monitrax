#!/usr/bin/env node
/**
 * Neomatrix generator + checker (Phase 53 N1 / Layer 2a + Layer 3 seed).
 *
 *   node scripts/neomatrix/generate-financial-logic.mjs            # generate
 *   node scripts/neomatrix/generate-financial-logic.mjs --check    # validate + freshness (CI)
 *
 * `--check` exits non-zero when:
 *   - the JSON fails structural validation (§5 schema), or
 *   - a correctness invariant fails (A3 orphan number / convergence), or
 *   - the generated markdown on disk is stale vs the JSON (derive-don't-hand-maintain).
 *
 * Documentation/model only — never touches the engines. No financial logic.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateGraph, auditInvariants, renderMarkdown, coverageSummary } from './graphlib.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const GRAPH = resolve(__dir, '../../docs/financial-logic/graph/financial-graph.json');
const OUT = resolve(__dir, '../../docs/financial-logic/graph/GENERATED_CORE.md');

const check = process.argv.includes('--check');

function fail(title, items) {
  console.error(`\n✗ ${title}`);
  for (const i of items) console.error(`   - ${i}`);
}

const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));

const structural = validateGraph(graph);
const { errors: invariantErrors, warnings } = auditInvariants(graph);
const cov = coverageSummary(graph);

// file:line resolution — every documented engine/orchestrator line in source
// must contain its symbol (the Layer-3 "file:line exists" audit; §19.2).
const anchorErrors = [];
for (const n of graph.nodes) {
  if ((n.kind !== 'engine' && n.kind !== 'orchestrator') || n.status !== 'documented') continue;
  if (!n.file || n.line == null) continue;
  const symbol = String(n.id).split('.').pop();
  let line = '';
  try {
    line = (readFileSync(resolve(__dir, '../../', n.file), 'utf8').split('\n')[n.line - 1] ?? '');
  } catch {
    anchorErrors.push(`${n.id}: cannot read ${n.file}`);
    continue;
  }
  if (!line.includes(symbol)) {
    anchorErrors.push(`${n.id}: ${n.file}:${n.line} does not contain "${symbol}" (drifted anchor; got: ${line.trim().slice(0, 70)})`);
  }
}

console.log(`Neomatrix: ${cov.nodes} nodes, ${cov.edges} edges (${Object.entries(cov.bySource).map(([k, v]) => `${k} ${v}`).join(', ')}).`);
for (const w of warnings) console.log(`   ⚠ ${w}`);

let bad = false;
if (structural.length) { fail('Schema validation failed', structural); bad = true; }
if (invariantErrors.length) { fail('Correctness invariants failed', invariantErrors); bad = true; }
if (anchorErrors.length) { fail('file:line anchors drifted', anchorErrors); bad = true; }

const rendered = renderMarkdown(graph);

if (check) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch { /* missing */ }
  if (current !== rendered) {
    fail('Generated markdown is stale', [`${OUT} differs from the JSON. Run \`npm run neomatrix:generate\` and commit.`]);
    bad = true;
  }
  if (bad) { console.error('\nNeomatrix check: FAILED\n'); process.exit(1); }
  console.log('Neomatrix check: OK (schema valid, invariants hold, markdown fresh).');
} else {
  if (bad) { console.error('\nRefusing to generate from an invalid graph.\n'); process.exit(1); }
  writeFileSync(OUT, rendered);
  console.log(`Wrote ${OUT}`);
}
