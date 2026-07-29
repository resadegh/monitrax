/**
 * Neomatrix Layer 0 — completeness + CURRENCY gate (NI-1). PURE NODE — no graphify dep.
 *
 * Runs in CI / `vercel-build` (graphify is a local-only CLI). Two checks:
 *
 *   1. COMPLETENESS (scope). Reconciles the COMMITTED structural graph's file
 *      manifest against the `.ts(x)` files actually on disk under every root in
 *      the SHARED `roots.mjs` scope. A source file that is neither in the graph
 *      nor on the reviewed allowlist → FAIL.
 *
 *   2. CURRENCY (content). Until 2026-07-29 this gate compared the SET OF PATHS
 *      only. The committed graph was built at commit 432ffce while main had moved
 *      579 commits; every function body, call site and signature change in those
 *      commits was invisible to the gate, which stayed green throughout. So the
 *      generator now also emits `content-manifest.json` (sha256:16 per file) and
 *      this gate rehashes the files on disk:
 *
 *        · ANCHORED drift → HARD FAIL. A file whose content changed AND which a
 *          Layer-1 semantic node points at. The meaning layer is making claims
 *          about code it has not seen. That is the exact failure mode §21.5
 *          clause 5 exists for.
 *        · BACKGROUND drift → reported, not failed. Failing every content change
 *          would demand a graphify run (local-only CLI) on every PR touching any
 *          source file. The number is printed so drift can never be silent.
 *
 * Exit 0 = complete and anchor-current. Exit 1 = a gap or anchored drift.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

import { ROOTS, SKIP_DIRS, isSourceFile } from './roots.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const DIR = resolve(ROOT, 'docs/financial-logic/graph/structural');
const GRAPH = resolve(DIR, 'structural-graph.json');
const ALLOWLIST = resolve(DIR, 'coverage-allowlist.json');
const MANIFEST = resolve(DIR, 'content-manifest.json');
const SEMANTIC = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

export function checkLayer0Coverage() {
  if (!existsSync(GRAPH)) {
    return {
      ok: false,
      reason: 'structural-graph.json missing — run `npm run neomatrix:graphify`',
      uncovered: [],
      stale: [],
      drifted: [],
      anchoredDrift: [],
    };
  }
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
  const covered = new Set(graph.files || []);
  const allow = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : { files: {} };
  const allowed = new Set(Object.keys(allow.files || {}));

  const listTs = (root) => {
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
  };

  const onDisk = ROOTS.flatMap(listTs);
  const uncovered = onDisk.filter((f) => !covered.has(f) && !allowed.has(f));
  const coveredSource = onDisk.filter((f) => covered.has(f)).length;
  // An allowlist entry is stale if the file is gone OR the extraction now covers it.
  const stale = [...allowed].filter((f) => covered.has(f) || !onDisk.includes(f));

  // ── currency ───────────────────────────────────────────────────────────────
  const manifestPresent = existsSync(MANIFEST);
  const drifted = [];
  if (manifestPresent) {
    const { hashes = {} } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    for (const [f, want] of Object.entries(hashes)) {
      const p = resolve(ROOT, f);
      if (!existsSync(p)) {
        drifted.push(f);
        continue;
      }
      if (sha(readFileSync(p)) !== want) drifted.push(f);
    }
  }

  // Files a Layer-1 semantic node claims to describe. Drift here is a hard fail.
  const anchorFiles = new Set();
  if (existsSync(SEMANTIC)) {
    const sem = JSON.parse(readFileSync(SEMANTIC, 'utf8'));
    for (const n of sem.nodes || []) if (n.file) anchorFiles.add(n.file);
  }
  const anchoredDrift = drifted.filter((f) => anchorFiles.has(f));

  return {
    ok: uncovered.length === 0 && anchoredDrift.length === 0,
    onDisk: onDisk.length,
    covered: covered.size,
    coveredSource,
    allowlisted: allowed.size,
    roots: ROOTS,
    uncovered,
    stale,
    manifestPresent,
    drifted,
    anchoredDrift,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkLayer0Coverage();
  if (r.reason) {
    console.error(`✗ Layer 0 coverage: ${r.reason}`);
    process.exit(1);
  }
  console.log(
    `Layer 0 coverage: ${r.onDisk} .ts(x) on disk · ${r.coveredSource} extracted · ${r.allowlisted} allowlisted · ${r.uncovered.length} uncovered` +
      `  [roots: ${r.roots.join(', ')}]`,
  );
  if (!r.manifestPresent) {
    console.log('  note: content-manifest.json absent — currency UNVERIFIED (regenerate with `npm run neomatrix:graphify`)');
  } else {
    console.log(
      `Layer 0 currency: ${r.drifted.length} file(s) changed since the graph was built · ${r.anchoredDrift.length} of them carry a Layer-1 anchor`,
    );
  }
  if (r.stale.length) {
    console.log(`  note: ${r.stale.length} allowlist entr(y/ies) no longer needed — prune: ${r.stale.join(', ')}`);
  }
  if (r.uncovered.length) {
    console.error('✗ UNCOVERED source files (regenerate `npm run neomatrix:graphify`, or allowlist with a reason):');
    for (const f of r.uncovered) console.error('   -', f);
  }
  if (r.anchoredDrift.length) {
    console.error('✗ ANCHORED DRIFT — Layer 1 describes code that has changed since Layer 0 was built:');
    for (const f of r.anchoredDrift) console.error('   -', f);
    console.error('  Regenerate Layer 0 and re-verify the semantic nodes anchored to these files (§21.5 clause 5).');
  }
  if (!r.ok) process.exit(1);
  console.log(`✓ Layer 0 complete and anchor-current — every source file under ${r.roots.join('/, ')}/ is represented or allowlisted.`);
}
