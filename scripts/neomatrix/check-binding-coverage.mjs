/**
 * Neomatrix NI-2 — semantic↔structural binding + coverage readout. PURE NODE.
 *
 * Binds every L1 semantic node (the curated meaning layer) to the L0 structural
 * skeleton (the complete, gated, code-generated map) and reports the three-layer
 * coverage so "% of Monitrax modelled" is a build output, not a claim:
 *
 *   L0 structural (Graphify + prisma-layer0) ⊇ proven (calc-audit registry) ⊇ modelled (semantic)
 *
 * TWO GATES.
 *
 *   FILE BINDING (as before, now over the FULL scope). A semantic node whose
 *   `file` is inside the Layer-0 scan scope must appear in the committed Layer-0
 *   map. Until 2026-07-29 "scope" here meant a privately-declared `lib/`+`app/`
 *   and this file's own comment conceded the hole: "input-field nodes point at
 *   prisma/schema.prisma, verification nodes at tests/… (expanding L0 to cover
 *   prisma/+tests/ is a later root-addition)". That expansion has happened, so
 *   scope now comes from the shared `roots.mjs` and covers prisma/ and tests/
 *   too — those anchors are gated instead of excused.
 *
 *   SYMBOL ANCHOR (new). File-level binding cannot see a symbol that MOVED
 *   inside a file it still lives in — the exact drift that left three semantic
 *   anchors pointing ~90 lines off the model they describe (MON-116) while both
 *   gates stayed green. So every node that names a concrete symbol AND claims a
 *   line is now resolved against the Layer-0 symbol at that line:
 *
 *     · DRIFT   — the symbol exists in the file at a DIFFERENT line. Hard fail:
 *                 the code moved and the anchor did not follow.
 *     · MISSING — the symbol is not in the file at all (renamed or deleted).
 *                 Hard fail: the map names something that no longer exists.
 *
 *   Which nodes are symbol-checked: `engine`, `orchestrator`, and any node with
 *   an explicit `symbol` field. `number` nodes name a VALUE computed inline,
 *   `law` nodes cite an authority, `ui-surface` nodes cite a page, `verification`
 *   nodes cite a test block, and `input-field` nodes without a line are coarse
 *   schema anchors by design — all resolve by file, not by symbol.
 *
 *   A node may set `symbol` to name the extracted symbol explicitly when it
 *   differs from the id tail (e.g. the calc-audit registry drops the `Decimal`
 *   suffix from an engine's semantic identity, so the id is `…calculateMax‑
 *   Concentration` while the code is `calculateMaxConcentrationDecimal`). That
 *   makes the anchor a stated fact instead of a naming coincidence.
 *
 * Runs in `neomatrix:check` → `vercel-build` (no graphify dependency).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { ROOTS, PRISMA_SCHEMA } from './roots.mjs';

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

/** Graphify labels a function `name()` and a class member `.name()`; prisma labels a field `name: Type`. */
const symbolOf = (label) => String(label).replace(/^\./, '').replace(/\(\)$/, '').replace(/:.*$/, '').trim();

/** Kinds whose anchor names a concrete extracted symbol. */
const SYMBOL_KINDS = new Set(['engine', 'orchestrator', 'input-field']);

/**
 * The symbol a node claims. Explicit `symbol` always wins. Otherwise: a schema
 * anchor names a qualified Prisma entity (`input.InvestmentAccount.cashBalance`
 * → `InvestmentAccount.cashBalance`, matched against `prisma::field::…`), while
 * a code anchor names the last id segment (`engine.x.calculateNetWorth`
 * → `calculateNetWorth`).
 */
/** Lines a multi-line declaration may span before the claimed line counts as drift. */
const TEXT_WINDOW = 3;

const _src = new Map();
const sourceLines = (rel) => {
  if (!_src.has(rel)) {
    const p = resolve(ROOT, rel);
    _src.set(rel, existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null);
  }
  return _src.get(rel);
};

const claimedSymbol = (n) => {
  if (n.symbol) return n.symbol;
  if (n.file === PRISMA_SCHEMA) return n.id.replace(/^[a-z][a-zA-Z-]*\./, '');
  return n.id.split('.').pop();
};

export function checkBindingCoverage() {
  const sem = JSON.parse(readFileSync(SEM, 'utf8'));
  const l0 = JSON.parse(readFileSync(L0, 'utf8'));
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : { files: {} };
  const l0files = new Set([...(l0.files || []), ...Object.keys(allow.files || {})]);

  // file → [{ id, label, line }] from the Layer-0 tuples.
  const byFile = new Map();
  for (const [id, label, file, line] of l0.nodes || []) {
    if (!file) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ id, label, line });
  }

  // ── gate 1: file binding, over the FULL Layer-0 scope ──────────────────────
  const inL0Scope = (f) =>
    !!f && (f === PRISMA_SCHEMA || (ROOTS.some((r) => f.startsWith(`${r}/`)) && /\.tsx?$/.test(f)));
  const filed = sem.nodes.filter((n) => inL0Scope(n.file));
  const unresolved = filed.filter((n) => !l0files.has(n.file));

  // ── gate 2: symbol anchor ──────────────────────────────────────────────────
  const anchored = sem.nodes.filter(
    (n) => n.line && inL0Scope(n.file) && (SYMBOL_KINDS.has(n.kind) || n.symbol),
  );
  const drifted = [];
  const missing = [];
  let onLine = 0;
  for (const n of anchored) {
    const want = claimedSymbol(n);
    const inFile = byFile.get(n.file) || [];
    // prisma ids are fully qualified; ts symbols match on the label.
    const cands = inFile.filter(
      (a) => symbolOf(a.label) === want || a.id === want || a.id.endsWith(`::${want}`),
    );
    if (!cands.length) {
      // TIER 3 — line-text anchor. Graphify emits top-level symbols and class
      // members, not properties of an object literal, so a node anchored at a
      // config key (`input.taxYearConfig.superGuaranteeRate`) has nothing to
      // resolve against. Fall back to the source line itself: the key must
      // appear at the claimed line (±TEXT_WINDOW for a multi-line declaration).
      // Found elsewhere in the file = drift; found nowhere = missing.
      const txt = sourceLines(n.file);
      if (txt) {
        const re = new RegExp(`\\b${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const hits = [];
        for (let i = 0; i < txt.length; i++) if (re.test(txt[i])) hits.push(i + 1);
        if (hits.some((h) => Math.abs(h - n.line) <= TEXT_WINDOW)) {
          onLine++;
          continue;
        }
        if (hits.length) {
          drifted.push({ id: n.id, file: n.file, line: n.line, symbol: want, actual: hits.slice(0, 4) });
          continue;
        }
      }
      missing.push({
        id: n.id,
        file: n.file,
        line: n.line,
        symbol: want,
        atLine: inFile.filter((a) => a.line === n.line).map((a) => symbolOf(a.label)),
      });
    } else if (cands.some((c) => c.line === n.line)) {
      onLine++;
    } else {
      drifted.push({ id: n.id, file: n.file, line: n.line, symbol: want, actual: cands.map((c) => c.line) });
    }
  }

  const engines = sem.nodes.filter((n) => n.kind === 'engine');
  const registry = calcAuditRegistry();

  return {
    ok: unresolved.length === 0 && drifted.length === 0 && missing.length === 0,
    l0: { files: (l0.files || []).length, nodes: (l0.nodes || []).length, roots: ROOTS },
    semantic: { total: sem.nodes.length, engines: engines.length, filed: filed.length },
    proven: registry.length,
    unresolved: unresolved.map((n) => ({ id: n.id, file: n.file })),
    anchors: { checked: anchored.length, onLine },
    drifted,
    missing,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkBindingCoverage();
  console.log('Neomatrix binding + coverage (NI-2):');
  console.log(`  L0 structural: ${r.l0.files} files · ${r.l0.nodes} nodes — ${r.l0.roots.join(', ')} + ${PRISMA_SCHEMA}`);
  console.log(`  Proven (calc-audit registry): ${r.proven} engines`);
  console.log(`  Modelled (semantic Neomatrix): ${r.semantic.engines} engines · ${r.semantic.total} nodes`);
  console.log(`  Semantic→L0 file binding: ${r.semantic.filed - r.unresolved.length}/${r.semantic.filed} anchors resolve`);
  console.log(`  Semantic→L0 symbol anchors: ${r.anchors.onLine}/${r.anchors.checked} land on the named symbol`);
  console.log('  Note: exact proven↔modelled reconciliation + backfill toward 100% is NI-3.');
  if (r.unresolved.length) {
    console.error('\n✗ Semantic nodes whose file is NOT in the Layer-0 map (code moved/renamed/deleted — update the node):');
    for (const u of r.unresolved) console.error(`   - ${u.id} → ${u.file}`);
  }
  if (r.drifted.length) {
    console.error('\n✗ ANCHOR DRIFT — the symbol moved inside the file and the semantic node did not follow:');
    for (const d of r.drifted) console.error(`   - ${d.id} → ${d.file}:${d.line} but "${d.symbol}" is at ${d.actual.join('/')}`);
  }
  if (r.missing.length) {
    console.error('\n✗ MISSING SYMBOL — the semantic node names code that is not in that file:');
    for (const m of r.missing) {
      console.error(`   - ${m.id} → ${m.file}:${m.line} names "${m.symbol}"; at that line Layer 0 has: ${m.atLine.join(', ') || '(nothing)'}`);
      console.error('     Fix the node (or set an explicit `symbol`) — never rename the code to match the map.');
    }
  }
  if (!r.ok) process.exit(1);
  console.log('✓ every semantic anchor resolves to mapped code, at the line it claims.');
}
