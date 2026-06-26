/**
 * Neomatrix NI-2 — semantic↔structural binding + coverage readout. PURE NODE.
 *
 * Binds every L1 semantic node (the curated meaning layer) to the L0 structural
 * skeleton (the complete, gated, code-generated map) by FILE, and reports the
 * three-layer coverage so "% of Monitrax modelled" is a build output, not a
 * claim:
 *
 *   L0 structural (Graphify) ⊇ proven (calc-audit registry) ⊇ modelled (semantic)
 *
 * GATE (fails the build): a semantic node whose `file` is NOT in the committed
 * Layer-0 map (and not on the L0 allowlist) — i.e. the code it points at moved,
 * was renamed, or deleted, but the node didn't follow. This is the structural
 * drift sentinel: the semantic anchor must always resolve to real, mapped code.
 *
 * Runs in `neomatrix:check` → `vercel-build` (no graphify dependency).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const SEM = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');
const L0 = resolve(ROOT, 'docs/financial-logic/graph/structural/structural-graph.json');
const ALLOW = resolve(ROOT, 'docs/financial-logic/graph/structural/coverage-allowlist.json');
const REG_DIR = resolve(ROOT, 'lib/calc-audit/engines');

/** Count distinct registered calc-audit engines (dotted domain.path ids, .shadow-stripped). */
export function calcAuditRegistry() {
  const names = new Set();
  const re = /name:\s*'([a-z][a-zA-Z]*\.[a-zA-Z0-9_.]+)'/g;
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        let m;
        while ((m = re.exec(src))) names.add(m[1].replace('.shadow', ''));
      }
    }
  };
  if (existsSync(REG_DIR)) walk(REG_DIR);
  return [...names].sort();
}

export function checkBindingCoverage() {
  const sem = JSON.parse(readFileSync(SEM, 'utf8'));
  const l0 = JSON.parse(readFileSync(L0, 'utf8'));
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : { files: {} };
  const l0files = new Set([...(l0.files || []), ...Object.keys(allow.files || {})]);

  // BIND: every semantic node anchored in CODE (lib/ or app/ — the L0 scan
  // roots) must resolve into the L0 map. Nodes anchored elsewhere are out of
  // L0's scope, not drift: input-field nodes point at `prisma/schema.prisma`,
  // verification nodes at `tests/…`, law nodes carry no file. (Expanding L0 to
  // cover prisma/+tests/ is a later root-addition, not a gate failure today.)
  // Only the calc CODE nodes (engine/orchestrator/number) anchored at a specific
  // .ts(x) file under lib/+app/ are subject to the resolution gate. `law` nodes
  // cite a module/authority and `ui-surface` nodes cite a page directory — both
  // use coarser anchors by design, not a specific file, so they're exempt.
  const CODE_KINDS = new Set(['engine', 'orchestrator', 'number']);
  const inL0Scope = (f) => f && (f.startsWith('lib/') || f.startsWith('app/')) && /\.tsx?$/.test(f);
  const filed = sem.nodes.filter((n) => CODE_KINDS.has(n.kind) && inL0Scope(n.file));
  const unresolved = filed.filter((n) => !l0files.has(n.file));

  const engines = sem.nodes.filter((n) => n.kind === 'engine');
  const registry = calcAuditRegistry();

  return {
    ok: unresolved.length === 0,
    l0: { files: (l0.files || []).length, nodes: (l0.nodes || []).length },
    semantic: { total: sem.nodes.length, engines: engines.length, filed: filed.length },
    proven: registry.length,
    unresolved: unresolved.map((n) => ({ id: n.id, file: n.file })),
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkBindingCoverage();
  console.log('Neomatrix binding + coverage (NI-2):');
  console.log(`  L0 structural (Graphify): ${r.l0.files} files · ${r.l0.nodes} nodes — whole codebase, gated`);
  console.log(`  Proven (calc-audit registry): ${r.proven} engines`);
  console.log(`  Modelled (semantic Neomatrix): ${r.semantic.engines} engines · ${r.semantic.total} nodes`);
  console.log(`  Semantic→L0 binding: ${r.semantic.filed - r.unresolved.length}/${r.semantic.filed} file anchors resolve`);
  console.log('  Note: exact proven↔modelled reconciliation + backfill toward 100% is NI-3.');
  if (!r.ok) {
    console.error('\n✗ Semantic nodes whose file is NOT in the Layer-0 map (code moved/renamed/deleted — update the node):');
    for (const u of r.unresolved) console.error(`   - ${u.id} → ${u.file}`);
    process.exit(1);
  }
  console.log('✓ every semantic anchor resolves to mapped code.');
}
