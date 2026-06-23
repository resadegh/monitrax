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

console.log(`Neomatrix: ${cov.nodes} nodes, ${cov.edges} edges (${Object.entries(cov.bySource).map(([k, v]) => `${k} ${v}`).join(', ')}).`);
for (const w of warnings) console.log(`   ⚠ ${w}`);

let bad = false;
if (structural.length) { fail('Schema validation failed', structural); bad = true; }
if (invariantErrors.length) { fail('Correctness invariants failed', invariantErrors); bad = true; }

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
