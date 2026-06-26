/**
 * Neomatrix NI-3 — exact calc-audit registry ↔ semantic reconciliation. PURE NODE.
 *
 * The proven money-producer inventory is the calc-audit registries: the
 * differential `calcEngineRegistry.register({…})` engines AND the shadow
 * (Float/Decimal) registrations — each carries `name` + `sourcePath`. This
 * reconciles that inventory against the L1 semantic graph by SOURCE FILE: a
 * proven engine is "modelled" iff a semantic `engine` node exists in its
 * `sourcePath`. The unmatched set is the precise, named backfill worklist —
 * the honest gap between PROVEN and MODELLED.
 *
 * Read-only / advisory (prints + powers the worklist doc). Backfilling the gap
 * to 100% is the NI-3 domain sub-PRs; this is the denominator that makes that
 * finite and visible. Keyed on registrations carrying a `sourcePath` so fixture
 * CASE names (no sourcePath) are correctly excluded.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const SEM = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');
const REG_DIR = resolve(ROOT, 'lib/calc-audit/engines');

/** Parse every engine registration (name + sourcePath [+ category]) across both
 *  registries, deduped by base name (.shadow stripped). */
export function provenEngines() {
  const recs = new Map();
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        const re = /name:\s*'([a-z][a-zA-Z0-9_.]+)'/g;
        let m;
        while ((m = re.exec(src))) {
          const tail = src.slice(m.index, m.index + 700);
          const sp = /sourcePath:\s*'([^']+)'/.exec(tail);
          if (!sp) continue; // fixture case name (no sourcePath) → not an engine
          const cat = /category:\s*'([^']+)'/.exec(tail);
          const base = m[1].replace('.shadow', '');
          if (!recs.has(base)) recs.set(base, { name: base, sourcePath: sp[1], category: cat ? cat[1] : null });
        }
      }
    }
  };
  walk(REG_DIR);
  return [...recs.values()].sort((a, b) => a.name < b.name ? -1 : 1);
}

export function reconcile() {
  const sem = JSON.parse(readFileSync(SEM, 'utf8'));
  // A proven calc-audit engine is "modelled" if a semantic `engine` OR
  // `orchestrator` node lives at its sourcePath — an orchestrator (e.g.
  // masterTaxPosition, which composes the per-entity engines) is the correct
  // kind for a registered composing calc, and still counts as modelled.
  const semEngineFiles = new Set(sem.nodes.filter((n) => (n.kind === 'engine' || n.kind === 'orchestrator') && n.file).map((n) => n.file));
  const proven = provenEngines();
  const matched = proven.filter((r) => semEngineFiles.has(r.sourcePath));
  const unmatched = proven.filter((r) => !semEngineFiles.has(r.sourcePath));
  return { proven, matched, unmatched, pct: Math.round((matched.length / proven.length) * 100) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = reconcile();
  console.log('Neomatrix registry↔semantic reconciliation (NI-3):');
  console.log(`  proven (calc-audit registries): ${r.proven.length} engines`);
  console.log(`  modelled (semantic node at sourcePath): ${r.matched.length} (${r.pct}%)`);
  console.log(`  BACKFILL worklist (proven, not yet modelled): ${r.unmatched.length}`);
  const byCat = {};
  for (const u of r.unmatched) {
    const c = u.category || 'cfo/cashflow';
    (byCat[c] ??= []).push(u);
  }
  for (const [c, list] of Object.entries(byCat)) {
    console.log(`   ── ${c} (${list.length}):`);
    for (const u of list) console.log(`      ${u.name}  ←  ${u.sourcePath}`);
  }
}
