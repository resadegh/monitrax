/**
 * Neomatrix Layer 0 — completeness GATE (NI-1). PURE NODE — no graphify dep.
 *
 * Runs in CI / `vercel-build` (graphify is a local-only CLI). Reconciles the
 * COMMITTED structural graph's file manifest against the `.ts(x)` files actually
 * on disk under lib/+app/. If a source file exists but is neither in the graph
 * nor on the reviewed allowlist → FAIL. This is what makes Layer 0 completeness
 * a build fact, not a claim: add a file without regenerating Layer 0
 * (`npm run neomatrix:graphify`) and the build goes red.
 *
 * Mirrors the GENERATED_CORE.md staleness contract — the committed artifact must
 * stay in sync with the code, enforced mechanically.
 *
 * Exit 0 = complete (every disk file covered or allowlisted). Exit 1 = a gap.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const ROOTS = ['lib', 'app'];
const DIR = resolve(ROOT, 'docs/financial-logic/graph/structural');
const GRAPH = resolve(DIR, 'structural-graph.json');
const ALLOWLIST = resolve(DIR, 'coverage-allowlist.json');

export function checkLayer0Coverage() {
  if (!existsSync(GRAPH)) {
    return { ok: false, reason: 'structural-graph.json missing — run `npm run neomatrix:graphify`', uncovered: [], stale: [] };
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
          if (ent.name === 'node_modules' || ent.name === 'graphify-out' || ent.name === '__tests__') continue;
          walk(p);
        } else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
          out.push(relative(ROOT, p));
        }
      }
    };
    walk(resolve(ROOT, root));
    return out;
  };

  const onDisk = ROOTS.flatMap(listTs);
  const uncovered = onDisk.filter((f) => !covered.has(f) && !allowed.has(f));
  // allowlist entries that no longer exist on disk → stale, should be pruned (keep the list shrinking)
  const stale = [...allowed].filter((f) => !onDisk.includes(f));

  return {
    ok: uncovered.length === 0,
    onDisk: onDisk.length,
    covered: covered.size,
    allowlisted: allowed.size,
    uncovered,
    stale,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkLayer0Coverage();
  if (r.reason) {
    console.error(`✗ Layer 0 coverage: ${r.reason}`);
    process.exit(1);
  }
  console.log(`Layer 0 coverage: ${r.onDisk} .ts(x) on disk · ${r.covered} in graph · ${r.allowlisted} allowlisted · ${r.uncovered.length} uncovered`);
  if (r.stale.length) {
    console.log(`  note: ${r.stale.length} allowlist entr(y/ies) no longer on disk — prune: ${r.stale.join(', ')}`);
  }
  if (!r.ok) {
    console.error('✗ UNCOVERED source files (regenerate `npm run neomatrix:graphify`, or allowlist with a reason):');
    for (const f of r.uncovered) console.error('   -', f);
    process.exit(1);
  }
  console.log('✓ Layer 0 complete — every source file under lib/+app/ is represented or allowlisted.');
}
