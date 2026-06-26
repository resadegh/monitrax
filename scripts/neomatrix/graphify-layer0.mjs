/**
 * Neomatrix Layer 0 (Graphify) regenerator — NI-1.
 *
 * Restores the Phase-53 design's Layer 0: the STRUCTURAL skeleton of the whole
 * codebase, extracted from code (tree-sitter AST) — "the bones" — as a
 * committed, regenerated, drift-proof artifact.
 *
 * What it does (run LOCALLY — `npm run neomatrix:graphify`):
 *   1. Runs `graphify update lib` + `graphify update app` in CODE-ONLY / OFFLINE
 *      mode (every LLM key unset — no source egress, §13.6).
 *   2. Normalises the two raw graphs into ONE lean, deterministic
 *      `structural/structural-graph.json` (id/label/file:line nodes; typed
 *      edges) — sorted so diffs are meaningful.
 *   3. Writes the file-coverage manifest + runs the completeness reconciliation
 *      (every `.ts(x)` on disk under the roots must be represented, or be on the
 *      reviewed allowlist) and prints the result.
 *
 * Graphify is a local CLI (not present in the Vercel build), so REGENERATION is
 * a dev step (like `prisma migrate dev`). The committed artifact is what ships;
 * the pure-node CI gate (`check-layer0-coverage.mjs`, wired into
 * `neomatrix:check`) re-runs the disk-vs-graph reconciliation on every build
 * with no graphify dependency — so the map can never silently lag the code.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const ROOTS = ['lib', 'app'];
const OUT_DIR = resolve(ROOT, 'docs/financial-logic/graph/structural');
const GRAPH_OUT = resolve(OUT_DIR, 'structural-graph.json');
const ALLOWLIST = resolve(OUT_DIR, 'coverage-allowlist.json');

// LLM keys unset → graphify parses code locally via tree-sitter, no egress.
const OFFLINE_ENV = { ...process.env };
for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY']) {
  delete OFFLINE_ENV[k];
}

function runGraphify(root) {
  process.stdout.write(`  graphify update ${root} (code-only/offline)… `);
  execFileSync('graphify', ['update', root], { cwd: ROOT, env: OFFLINE_ENV, stdio: ['ignore', 'ignore', 'ignore'] });
  const out = resolve(ROOT, root, 'graphify-out/graph.json');
  if (!existsSync(out)) throw new Error(`graphify produced no output for ${root}`);
  const g = JSON.parse(readFileSync(out, 'utf8'));
  console.log(`${g.nodes.length} nodes / ${(g.links || []).length} edges`);
  return { root, g };
}

const LINE = (loc) => {
  const m = /^L(\d+)/.exec(loc || '');
  return m ? Number(m[1]) : null;
};

function listTsFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'graphify-out' || ent.name === '__tests__') continue;
        walk(p);
      } else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
        out.push(relative(ROOT, p));
      }
    }
  };
  walk(resolve(ROOT, root));
  return out;
}

// ---- run extraction ----
console.log('Neomatrix Layer 0 — Graphify structural extraction (code-only/offline):');
let builtAtCommit = null;
const nodes = [];
const edges = [];
const coveredFiles = new Set();
for (const root of ROOTS) {
  const { g } = runGraphify(root);
  builtAtCommit = g.built_at_commit ?? builtAtCommit;
  for (const n of g.nodes) {
    const file = n.source_file ? `${root}/${n.source_file}` : null;
    if (file) coveredFiles.add(file);
    nodes.push([n.id, n.label ?? n.id, file, LINE(n.source_location)]);
  }
  for (const e of g.links || []) {
    const file = e.source_file ? `${root}/${e.source_file}` : null;
    edges.push([e.relation, e.source, e.target, file, LINE(e.source_location)]);
  }
}

// ---- deterministic sort (clean diffs) ----
nodes.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
edges.sort((a, b) => {
  const ka = `${a[1]}|${a[2]}|${a[0]}`, kb = `${b[1]}|${b[2]}|${b[0]}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});
const files = [...coveredFiles].sort();

// ---- completeness reconciliation (disk vs graph) ----
const allow = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : { files: {} };
const allowed = new Set(Object.keys(allow.files || {}));
const onDisk = ROOTS.flatMap(listTsFiles).sort();
const uncovered = onDisk.filter((f) => !coveredFiles.has(f) && !allowed.has(f));

writeFileSync(GRAPH_OUT, JSON.stringify({
  _meta: {
    generator: 'graphify 0.8.45 (code-only/offline, tree-sitter AST)',
    builtAtCommit,
    roots: ROOTS,
    note: 'Layer 0 — structural skeleton. Generated; do not hand-edit. Regenerate with `npm run neomatrix:graphify`. Node = [id, label, file, line]; edge = [relation, from, to, file, line].',
    counts: { files: files.length, filesOnDisk: onDisk.length, nodes: nodes.length, edges: edges.length, allowlisted: allowed.size },
  },
  files,
  nodes,
  edges,
}, null, 0) + '\n');

console.log(`\nLayer 0 written: ${files.length} files · ${nodes.length} nodes · ${edges.length} edges → ${relative(ROOT, GRAPH_OUT)}`);
console.log(`Completeness: ${onDisk.length} .ts(x) on disk · ${coveredFiles.size} in graph · ${allowed.size} allowlisted · ${uncovered.length} UNCOVERED`);
if (uncovered.length) {
  console.log('\n⚠ UNCOVERED files (add to the engine, or to coverage-allowlist.json with a reason):');
  for (const f of uncovered) console.log('   -', f);
  process.exitCode = 1;
} else {
  console.log('✓ every source file under lib/+app/ is represented (or allowlisted).');
}
