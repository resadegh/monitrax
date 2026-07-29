/**
 * Neomatrix Layer 0 (Graphify) regenerator — NI-1.
 *
 * Layer 0 is the STRUCTURAL skeleton of the whole codebase, extracted FROM CODE
 * (tree-sitter AST, offline) — "the bones" — as a committed, regenerated,
 * drift-proof artifact. Layer 1 (`financial-graph.json`) is the hand-verified
 * MEANING layer that binds into it.
 *
 * What it does (run LOCALLY — `npm run neomatrix:graphify`):
 *   1. Runs `graphify update <root>` for every root in `roots.mjs`, in
 *      CODE-ONLY / OFFLINE mode (every LLM key unset — no source egress, §13.6).
 *   2. Extracts the Prisma data model with the deterministic pure-node pass in
 *      `prisma-layer0.mjs` (graphify has no `.prisma` grammar), merged under its
 *      own generator provenance in `_meta.generators`.
 *   3. Normalises everything into ONE lean, deterministic
 *      `structural/structural-graph.json` (id/label/file:line nodes; typed
 *      edges) — sorted so diffs are meaningful.
 *   4. Writes a CONTENT MANIFEST (`structural/content-manifest.json`): a sha256
 *      per covered file at build time. This is what makes staleness detectable —
 *      see below.
 *   5. Runs the completeness reconciliation (every `.ts(x)` on disk under the
 *      roots must be represented, or be on the reviewed allowlist).
 *
 * 2026-07-29 — TWO STRUCTURAL HOLES CLOSED (audit NEO_ALIGNMENT_SWEEP_2026_07_29):
 *
 *   SCOPE. `ROOTS` was `['lib','app']` and each gate declared the same pair
 *   privately, so the completeness gate measured the generator's own narrowed
 *   scope and reported "complete" while `components/` (351 files — the entire
 *   visual surface of Monitrax), `hooks/`, `contexts/`, `types/`, `tests/`,
 *   `scripts/`, `mobile-app/` and the Prisma data model were never scanned.
 *   ROOTS now lives once, in `roots.mjs`, and covers all of it.
 *
 *   CURRENCY. The gate reconciled the FILE MANIFEST only — the set of paths.
 *   Change the body of every function in the repo without adding or deleting a
 *   file and the gate stayed green. The committed graph was built at commit
 *   432ffce and `main` had moved 579 commits past it while CI reported Layer 0
 *   "complete". The content manifest fixes this: the gate rehashes each covered
 *   file and reports exactly which ones have changed since extraction.
 *
 * Graphify is a local CLI (not present in the Vercel build), so REGENERATION is
 * a dev step (like `prisma migrate dev`). The committed artifact is what ships;
 * the pure-node CI gate (`check-layer0-coverage.mjs`, wired into
 * `neomatrix:check`) re-runs the reconciliation on every build with no graphify
 * dependency — so the map can never silently lag the code.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';
import { ROOTS, SKIP_DIRS, PRISMA_SCHEMA, isSourceFile } from './roots.mjs';
import { extractPrisma } from './prisma-layer0.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const OUT_DIR = resolve(ROOT, 'docs/financial-logic/graph/structural');
const GRAPH_OUT = resolve(OUT_DIR, 'structural-graph.json');
const MANIFEST_OUT = resolve(OUT_DIR, 'content-manifest.json');
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
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(p);
      } else if (isSourceFile(ent.name)) {
        out.push(relative(ROOT, p));
      }
    }
  };
  walk(resolve(ROOT, root));
  return out;
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

// ---- run extraction ----
console.log(`Neomatrix Layer 0 — structural extraction over ${ROOTS.length} roots (code-only/offline):`);
let builtAtCommit = null;
const nodes = [];
const edges = [];
const coveredFiles = new Set();
// Graphify is run once PER ROOT and assigns file-scoped ids within that run, so
// the same short id (e.g. `admin_index`) can be minted independently by two
// roots. Merging naively drops one of them silently — real symbols vanishing
// from the map with no signal. Instead: collect per root, detect the collisions
// across roots, then DISAMBIGUATE the later root's copy to `<root>::<id>`,
// rewriting that root's own edge endpoints to match. Nothing is dropped, and
// because graphify emits no cross-root edges the rewrite is closed within a
// root and therefore lossless.
const perRoot = [];
const seenIn = new Map(); // id → first root that minted it

for (const root of ROOTS) {
  const { g } = runGraphify(root);
  builtAtCommit = g.built_at_commit ?? builtAtCommit;
  perRoot.push({ root, g });
}

const collisions = [];
for (const { root, g } of perRoot) {
  const rename = new Map();
  for (const n of g.nodes) {
    const first = seenIn.get(n.id);
    if (first === undefined) {
      seenIn.set(n.id, root);
    } else if (first !== root) {
      const qualified = `${root}::${n.id}`;
      rename.set(n.id, qualified);
      collisions.push({ id: n.id, first, second: root, renamedTo: qualified });
      seenIn.set(qualified, root);
    }
  }
  const rid = (id) => rename.get(id) ?? id;
  for (const n of g.nodes) {
    const file = n.source_file ? `${root}/${n.source_file}` : null;
    if (file) coveredFiles.add(file);
    nodes.push([rid(n.id), n.label ?? n.id, file, LINE(n.source_location)]);
  }
  for (const e of g.links || []) {
    const file = e.source_file ? `${root}/${e.source_file}` : null;
    edges.push([e.relation, rid(e.source), rid(e.target), file, LINE(e.source_location)]);
  }
}
const owner = seenIn;

// ---- Prisma data model (pure-node; graphify has no .prisma grammar) ----
process.stdout.write('  prisma-layer0 (schema.prisma, deterministic)… ');
const prisma = extractPrisma(resolve(ROOT, PRISMA_SCHEMA), PRISMA_SCHEMA);
console.log(`${prisma.counts.models} models / ${prisma.counts.enums} enums / ${prisma.counts.nodes} nodes / ${prisma.counts.edges} edges`);
for (const n of prisma.nodes) {
  if (owner.has(n[0])) {
    collisions.push({ id: n[0], first: owner.get(n[0]), second: 'prisma', file: n[2] });
    continue;
  }
  owner.set(n[0], 'prisma');
  nodes.push(n);
}
edges.push(...prisma.edges);
coveredFiles.add(PRISMA_SCHEMA);

// ---- deterministic sort (clean diffs) ----
nodes.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
edges.sort((a, b) => {
  const ka = `${a[1]}|${a[2]}|${a[0]}`;
  const kb = `${b[1]}|${b[2]}|${b[0]}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});
const files = [...coveredFiles].sort();

// ---- completeness reconciliation (disk vs graph) ----
const allow = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : { files: {} };
const allowed = new Set(Object.keys(allow.files || {}));
const onDisk = ROOTS.flatMap(listTsFiles).sort();
const uncovered = onDisk.filter((f) => !coveredFiles.has(f) && !allowed.has(f));
const staleAllow = [...allowed].filter((f) => coveredFiles.has(f));

// ---- content manifest (staleness detection — see header) ----
const manifest = {};
for (const f of files) {
  const p = resolve(ROOT, f);
  if (existsSync(p)) manifest[f] = sha(readFileSync(p));
}

writeFileSync(GRAPH_OUT, JSON.stringify({
  _meta: {
    generators: [
      'graphify 0.8.45 (code-only/offline, tree-sitter AST) — ' + ROOTS.join(', '),
      'prisma-layer0.mjs (pure node, deterministic) — ' + PRISMA_SCHEMA,
    ],
    builtAtCommit,
    roots: ROOTS,
    prismaSchema: PRISMA_SCHEMA,
    note: 'Layer 0 — structural skeleton. Generated; do not hand-edit. Regenerate with `npm run neomatrix:graphify`. Node = [id, label, file, line]; edge = [relation, from, to, file, line]. Scope lives in scripts/neomatrix/roots.mjs (shared by generator + gates). Staleness is detected by structural/content-manifest.json.',
    counts: {
      files: files.length,
      filesOnDisk: onDisk.length,
      nodes: nodes.length,
      edges: edges.length,
      allowlisted: allowed.size,
      collisions: collisions.length,
    },
  },
  files,
  nodes,
  edges,
}, null, 0) + '\n');

writeFileSync(MANIFEST_OUT, JSON.stringify({
  _meta: {
    note: 'sha256 (first 16 hex) of every Layer-0 covered file AT EXTRACTION TIME. `check-layer0-coverage.mjs` rehashes on every build; a mismatch means the code moved and Layer 0 did not. Generated — do not hand-edit.',
    builtAtCommit,
    algorithm: 'sha256:16',
    files: Object.keys(manifest).length,
  },
  hashes: manifest,
}, null, 0) + '\n');

console.log(`\nLayer 0 written: ${files.length} files · ${nodes.length} nodes · ${edges.length} edges → ${relative(ROOT, GRAPH_OUT)}`);
console.log(`Content manifest: ${Object.keys(manifest).length} file hashes → ${relative(ROOT, MANIFEST_OUT)}`);
// Like-for-like: the completeness contract is over .ts(x) source. `files`
// additionally holds non-source artefacts graphify indexes (markdown, config)
// plus the Prisma schema — counted separately so neither number flatters.
const coveredSource = onDisk.filter((f) => coveredFiles.has(f)).length;
console.log(
  `Completeness: ${onDisk.length} .ts(x) on disk · ${coveredSource} extracted · ${allowed.size} allowlisted · ${uncovered.length} UNCOVERED` +
  `  (+${files.length - coveredSource} non-source files indexed)`,
);

if (collisions.length) {
  console.log(`\nℹ ${collisions.length} cross-root node-id collision(s) — disambiguated, nothing dropped:`);
  for (const c of collisions.slice(0, 20)) console.log(`   - ${c.id}  (${c.first} vs ${c.second}) → ${c.renamedTo}`);
  if (collisions.length > 20) console.log(`   … and ${collisions.length - 20} more`);
}
if (staleAllow.length) {
  console.log(`\nℹ ${staleAllow.length} allowlist entr(y/ies) are now COVERED by the extraction — prune them from coverage-allowlist.json:`);
  for (const f of staleAllow) console.log('   -', f);
}
if (uncovered.length) {
  console.log('\n⚠ UNCOVERED files (add to the engine, or to coverage-allowlist.json with a reason):');
  for (const f of uncovered) console.log('   -', f);
  process.exitCode = 1;
} else {
  console.log(`✓ every source file under ${ROOTS.join('/, ')}/ is represented (or allowlisted).`);
}
