/**
 * Neomatrix Layer-1/Layer-3 helpers (Phase 53 N1).
 *
 * Pure, dependency-free helpers over `financial-graph.json`:
 *   - validateGraph(graph)   → structural validation (schema §5)
 *   - auditInvariants(graph) → the correctness invariants (the Layer-3 seed)
 *   - renderMarkdown(graph)  → the generated markdown view (Layer 2a)
 *   - coverageSummary(graph) → the coverage/trust dashboard (C10)
 *
 * Documentation/model only — reads the JSON, never the engines. No financial
 * logic here. See docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md §5, §14.
 */

export const ENUMS = {
  // `verification` (2026-06-25) — a Trust Engine assurance node: a golden case
  // (L0), independent recompute (L1), invariant/property law (L2), or
  // reconciliation tie-out (L3) that PROVES an engine/number is correct. It
  // does not produce a number; it audits one. Connected via `verified-by`.
  kind: ['engine', 'number', 'input-field', 'law', 'route', 'ui-surface', 'orchestrator', 'verification'],
  layer: ['db', 'engine', 'service', 'route', 'ui', null],
  domain: ['core', 'tax', 'health', 'cfo', 'intelligence', 'reports', 'neobrain'],
  trailStage: ['T', 'R', 'A', 'I', 'L', null],
  regime: ['pre-reform', 'post-reform', null],
  // `verified-by` (2026-06-25) — an engine/number IS PROVEN by a verification
  // node (parallels `governed-by` for laws). The Trust Engine ↔ Neomatrix link.
  edgeType: ['feeds', 'depends-on', 'governed-by', 'rendered-at', 'falls-back-to', 'verified-by'],
  source: ['verified', 'graphify', 'inferred'],
  status: ['documented', 'pending', 'suspected-issue', 'unverified'],
};

const NODE_REQUIRED = ['id', 'kind', 'label', 'layer', 'domain', 'status'];
const EDGE_REQUIRED = ['from', 'to', 'type', 'source'];

/** Structural validation against the §5 schema. Returns string[] of errors. */
export function validateGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object') return ['graph is not an object'];
  if (!Array.isArray(graph.nodes)) errors.push('graph.nodes must be an array');
  if (!Array.isArray(graph.edges)) errors.push('graph.edges must be an array');
  if (errors.length) return errors;

  const ids = new Set();
  for (const n of graph.nodes) {
    const where = `node ${n.id ?? '(no id)'}`;
    for (const f of NODE_REQUIRED) {
      if (n[f] === undefined) errors.push(`${where}: missing required field "${f}"`);
    }
    if (n.id && ids.has(n.id)) errors.push(`${where}: duplicate id`);
    if (n.id) ids.add(n.id);
    if (n.kind && !ENUMS.kind.includes(n.kind)) errors.push(`${where}: invalid kind "${n.kind}"`);
    if (!ENUMS.layer.includes(n.layer ?? null)) errors.push(`${where}: invalid layer "${n.layer}"`);
    if (n.domain && !ENUMS.domain.includes(n.domain)) errors.push(`${where}: invalid domain "${n.domain}"`);
    if (!ENUMS.trailStage.includes(n.trailStage ?? null)) errors.push(`${where}: invalid trailStage "${n.trailStage}"`);
    if (!ENUMS.regime.includes(n.regime ?? null)) errors.push(`${where}: invalid regime "${n.regime}"`);
    if (n.status && !ENUMS.status.includes(n.status)) errors.push(`${where}: invalid status "${n.status}"`);
    // A `verified` engine/orchestrator node should anchor to a real file:line.
    if ((n.kind === 'engine' || n.kind === 'orchestrator') && n.status === 'documented') {
      if (!n.file) errors.push(`${where}: documented ${n.kind} must cite a file`);
      if (n.line == null) errors.push(`${where}: documented ${n.kind} must cite a line (§19.2 file:line)`);
    }
    if (n.status === 'documented' && !n.verifiedDate) errors.push(`${where}: documented node must carry verifiedDate`);
  }

  for (const e of graph.edges) {
    const where = `edge ${e.from} -> ${e.to}`;
    for (const f of EDGE_REQUIRED) {
      if (e[f] === undefined) errors.push(`${where}: missing required field "${f}"`);
    }
    if (e.type && !ENUMS.edgeType.includes(e.type)) errors.push(`${where}: invalid type "${e.type}"`);
    if (e.source && !ENUMS.source.includes(e.source)) errors.push(`${where}: invalid source "${e.source}"`);
    if (e.from && !ids.has(e.from)) errors.push(`${where}: "from" node not found`);
    if (e.to && !ids.has(e.to)) errors.push(`${where}: "to" node not found`);
    // A `verified` edge must cite evidence (file:line read in source — §19.2).
    if (e.source === 'verified' && !e.evidence) errors.push(`${where}: verified edge must cite evidence`);
    // `inferred` edges are not allowed in the audited graph (§5 rule).
    if (e.source === 'inferred') errors.push(`${where}: inferred edges must be promoted to verified or flagged graphify before entering the audited graph`);
  }
  return errors;
}

function nodeMap(graph) {
  const m = new Map();
  for (const n of graph.nodes) m.set(n.id, n);
  return m;
}

/** Reverse-reachable engine ancestors of a node id. */
function engineAncestors(graph, startId) {
  const m = nodeMap(graph);
  const inbound = new Map();
  for (const e of graph.edges) {
    if (!inbound.has(e.to)) inbound.set(e.to, []);
    inbound.get(e.to).push(e.from);
  }
  const seen = new Set();
  const engines = new Set();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    for (const from of inbound.get(id) ?? []) {
      if (seen.has(from)) continue;
      seen.add(from);
      const node = m.get(from);
      if (node && node.kind === 'engine') engines.add(from);
      stack.push(from);
    }
  }
  return engines;
}

/**
 * The correctness invariants — the Layer-3 audit seed (Phase 53 §5.2, §14).
 * Returns { errors: string[], warnings: string[] }.
 */
export function auditInvariants(graph) {
  const errors = [];
  const warnings = [];
  const m = nodeMap(graph);

  // A3a — every `number` (user-facing figure) must trace back to an `engine`.
  for (const n of graph.nodes) {
    if (n.kind !== 'number') continue;
    const engines = engineAncestors(graph, n.id);
    if (engines.size === 0) {
      errors.push(`A3: number "${n.id}" has no inbound path to an engine (orphan number — the core audit)`);
    }
  }

  // A3b — convergence: number nodes sharing a semanticKey must reduce to the
  // SAME engine-ancestor set (no two tiles of the same concept from different
  // sources — the #1201 class).
  const byKey = new Map();
  for (const n of graph.nodes) {
    if (n.kind === 'number' && n.semanticKey) {
      if (!byKey.has(n.semanticKey)) byKey.set(n.semanticKey, []);
      byKey.get(n.semanticKey).push(n);
    }
  }
  for (const [key, numbers] of byKey) {
    const sigs = numbers.map((n) => [...engineAncestors(graph, n.id)].sort().join('|'));
    const uniq = new Set(sigs);
    if (uniq.size > 1) {
      errors.push(`A3-converge: numbers with semanticKey "${key}" trace to different engines: ${[...uniq].join('  VS  ')}`);
    }
  }

  // A3c — every ui-surface with a semanticKey must render a number of that key.
  const numberKeys = new Set(graph.nodes.filter((n) => n.kind === 'number' && n.semanticKey).map((n) => n.semanticKey));
  for (const n of graph.nodes) {
    if (n.kind === 'ui-surface' && n.semanticKey && !numberKeys.has(n.semanticKey)) {
      warnings.push(`A3c: ui-surface "${n.id}" claims semanticKey "${n.semanticKey}" but no number node carries it`);
    }
  }

  // A2 — drift sentinel readiness: report nodes not yet bound to an AST hash.
  const unbound = graph.nodes.filter((n) => (n.kind === 'engine' || n.kind === 'orchestrator') && !n.astHash).length;
  if (unbound) warnings.push(`A2: ${unbound} engine/orchestrator node(s) not yet bound to an astHash (drift sentinel pending — N3)`);

  // A4 — unit transitions on edges (informational until conversion nodes land in N3).
  const transitions = graph.edges.filter((e) => e.fromUnit && e.toUnit && e.fromUnit !== e.toUnit).length;
  if (transitions) warnings.push(`A4: ${transitions} edge(s) carry a unit transition (e.g. AUD/period→AUD/month) — verify a conversion happens inside the target (full enforcement N3)`);

  // A5 — no orphan calc nodes. A `number`/`engine`/`orchestrator` node with ZERO
  // edges (neither inbound nor outbound) is disconnected from the graph and
  // defeats its purpose: a calc the map can't trace to or from is exactly the
  // blind spot the Neomatrix exists to kill (Reza 2026-06-26: "there are nodes
  // sitting there by itself with no relations or link to any other nodes, like
  // property equity"). Every calc node must participate in at least one edge.
  const connected = new Set();
  for (const e of graph.edges) { connected.add(e.from); connected.add(e.to); }
  for (const n of graph.nodes) {
    if (!['number', 'engine', 'orchestrator'].includes(n.kind)) continue;
    if (!connected.has(n.id)) {
      errors.push(`A5: ${n.kind} "${n.id}" is an orphan — it has no edges (model its lineage: inputs that --feeds--> it and/or what it --feeds--> next)`);
    }
  }

  // A6 — no ISLANDS. A5 only catches ZERO-edge orphans; a node coupled to a
  // tiny isolated cluster (e.g. an engine wired ONLY to its law node) passes A5
  // yet is cut off from the rest of the map — the "sitting by itself with a
  // single link" defect (Reza 2026-06-26). Every `number`/`engine`/`orchestrator`
  // node must live in the MAIN connected component. The fix for a flagged island
  // is to model its real data-flow lineage (inputs that feed it + the consumer/
  // orchestrator that uses its output), NEVER a faked edge (§19.2).
  //
  // Reviewed exception allowlist (§22.2 — visible, reasoned, shrinking; never a
  // silent drop). A node here is a KNOWN island because the underlying CODE is
  // genuinely disconnected in the app — connecting it in the graph would be a
  // lie. Each entry must cite WHY. Remove an entry the moment its engine is
  // wired into a production flow. (Reza 2026-06-26: "are they really connected
  // in the app or only the graph?" — these were honestly NOT, so the graph
  // shows them as islands rather than faking a data-flow.)
  // Audited 2026-06-26: all entries are a MISS, not dead code. masterTaxPosition.ts
  // designs them as step-3 "per-entity advanced overlays" (same list as
  // trust-loss + company-loss, which WERE wired). Fix = add
  // input.{div152,fteIee}ByEntity to buildMasterTaxPosition mirroring the
  // loss-rule overlay. Remove from this allowlist when wired.
  // 2026-07-24 (MON-097, Neo-G4 P1): classifyPsi REMOVED — wired via
  // input.psiByEntity in both twins (masterTaxPosition.ts:331 / :673).
  // 2026-07-24 (MON-098, Neo-G4 P2): classifyFteIeeDistributions REMOVED —
  // wired via input.fteIeeByEntity in both twins (masterTaxPosition.ts:346 / :685).
  // 2026-07-24 (MON-099, Neo-G4 P3): applyDiv152 REMOVED — wired via
  // input.div152ByEntity in both twins (masterTaxPosition.ts:361 / :696).
  // THE ALLOWLIST IS NOW EMPTY (Neo-G4 complete): every built tax engine is
  // wired into the live position. A future entry here needs the same
  // reviewed-exception rigor — cite WHY the code is honestly disconnected.
  const A6_ISLAND_ALLOWLIST = {};
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n.id, new Set());
  for (const e of graph.edges) {
    if (adj.has(e.from) && adj.has(e.to)) { adj.get(e.from).add(e.to); adj.get(e.to).add(e.from); }
  }
  const seen = new Set();
  const components = [];
  for (const n of graph.nodes) {
    if (seen.has(n.id)) continue;
    const stack = [n.id]; const comp = []; seen.add(n.id);
    while (stack.length) {
      const id = stack.pop(); comp.push(id);
      for (const m of adj.get(id)) if (!seen.has(m)) { seen.add(m); stack.push(m); }
    }
    components.push(comp);
  }
  if (components.length > 1) {
    components.sort((a, b) => b.length - a.length);
    const main = new Set(components[0]);
    const calcKinds = new Set(['number', 'engine', 'orchestrator']);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const comp of components.slice(1)) {
      const calcs = comp.filter((id) => calcKinds.has(byId.get(id)?.kind));
      // An island is allowed ONLY if every calc node in it is on the reviewed
      // production-unwired allowlist (then it's a known, explained exception —
      // surfaced, not hidden). Any un-allowlisted calc node fails the build.
      const unexplained = calcs.filter((id) => !A6_ISLAND_ALLOWLIST[id]);
      if (unexplained.length) {
        errors.push(`A6: island of ${comp.length} node(s) disconnected from the main graph — contains calc node(s) [${unexplained.join(', ')}]. Wire their real lineage into the main component (inputs + consumer/orchestrator), never a faked edge. If genuinely production-unwired, add to A6_ISLAND_ALLOWLIST with the verified reason.`);
      } else if (calcs.length) {
        warnings.push(`A6: allowed island [${calcs.join(', ')}] — production-unwired (reviewed allowlist). ${calcs.map((id) => A6_ISLAND_ALLOWLIST[id]).join(' ')}`);
      }
    }
  }

  return { errors, warnings };
}

/** Coverage + provenance/trust dashboard (C10). */
export function coverageSummary(graph) {
  const byKind = {};
  for (const n of graph.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
  const byStatus = {};
  for (const n of graph.nodes) byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
  const bySource = {};
  for (const e of graph.edges) bySource[e.source] = (bySource[e.source] ?? 0) + 1;

  // Trust Engine assurance coverage (2026-06-25) — so we can KEEP TRACK of how
  // much of the financial architecture is provably correct, and what's left.
  // An engine/number is "covered" if a `verified-by` edge points from it to a
  // verification node. Reported overall + per Trust Engine layer (L0/L1/L2/L3).
  const provenTargets = new Set(
    graph.edges.filter((e) => e.type === 'verified-by').map((e) => e.from),
  );
  const provable = graph.nodes.filter(
    (n) => n.kind === 'engine' || n.kind === 'orchestrator' || n.kind === 'number',
  );
  const byLayer = {};
  for (const v of graph.nodes.filter((n) => n.kind === 'verification')) {
    const L = v.trustLayer ?? '?';
    byLayer[L] = (byLayer[L] ?? 0) + 1;
  }
  const assurance = {
    verifications: graph.nodes.filter((n) => n.kind === 'verification').length,
    coveredTargets: provable.filter((n) => provenTargets.has(n.id)).length,
    totalTargets: provable.length,
    byLayer,
  };

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    byKind,
    byStatus,
    bySource,
    assurance,
  };
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Render the generated markdown view (Layer 2a) deterministically from JSON. */
export function renderMarkdown(graph) {
  const m = nodeMap(graph);
  const cov = coverageSummary(graph);
  const L = [];
  L.push('<!-- GENERATED FROM financial-graph.json — DO NOT EDIT BY HAND.');
  L.push('     Regenerate: `npm run neomatrix:generate`. The JSON is the SSOT (Phase 53 §8). -->');
  L.push('');
  L.push('# Neomatrix — Generated Core View');
  L.push('');
  L.push(`> Rendered from \`financial-graph.json\` (v${graph.version}, reviewed ${graph.lastReviewed}). `);
  L.push('> This file is derived — edit the JSON, not this. Markdown and JSON cannot diverge (CI-checked).');
  L.push('');

  // Dashboard
  L.push('## Coverage & trust (C10)');
  L.push('');
  L.push(`- **Nodes:** ${cov.nodes} · **Edges:** ${cov.edges}`);
  L.push(`- **By kind:** ${Object.entries(cov.byKind).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  L.push(`- **By status:** ${Object.entries(cov.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  L.push(`- **Edge provenance:** ${Object.entries(cov.bySource).map(([k, v]) => `${k} ${v}`).join(' · ')} *(verified > graphify > inferred)*`);
  {
    const a = cov.assurance;
    const pct = a.totalTargets ? Math.round((a.coveredTargets / a.totalTargets) * 100) : 0;
    const layers = Object.keys(a.byLayer).length
      ? Object.entries(a.byLayer).sort().map(([k, v]) => `${k} ${v}`).join(' · ')
      : '—';
    L.push(`- **Trust Engine assurance:** ${a.coveredTargets}/${a.totalTargets} engines+numbers proven (${pct}%) · ${a.verifications} verification node(s) · by layer ${layers} *(L0 golden · L1 recompute · L2 invariant · L3 reconciliation)*`);
  }
  L.push('');

  // Engine registry
  L.push('## Engine / orchestrator registry');
  L.push('');
  L.push('| Node | File:line | Layer | Domain | Produces | Authority | Verified | Status |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const n of graph.nodes) {
    if (n.kind !== 'engine' && n.kind !== 'orchestrator') continue;
    const fl = n.file ? `\`${n.file}${n.line != null ? ':' + n.line : ''}\`` : '—';
    L.push(`| **${esc(n.label)}** | ${fl} | ${n.layer ?? '—'} | ${n.domain} | ${esc(n.produces)} | ${esc(n.authority)} | ${esc(n.verifiedBy)} | ${n.status} |`);
  }
  L.push('');

  // Worked examples
  L.push('## Worked examples (the A1 fixtures — §14)');
  L.push('');
  L.push('| Engine | Worked example (input → expected output) |');
  L.push('|---|---|');
  for (const n of graph.nodes) {
    if ((n.kind === 'engine' || n.kind === 'orchestrator') && n.workedExample) {
      L.push(`| **${esc(n.label)}** | ${esc(n.workedExample)} |`);
    }
  }
  L.push('');

  // Number lineage
  L.push('## Number lineage — how each displayed number is born');
  L.push('');
  L.push('| Number (semanticKey) | Engine ancestor(s) | Rendered at | Formula | Authority |');
  L.push('|---|---|---|---|---|');
  for (const n of graph.nodes) {
    if (n.kind !== 'number') continue;
    const engines = [...engineAncestors(graph, n.id)].map((id) => m.get(id)?.label ?? id).join(', ');
    const ui = graph.edges.filter((e) => e.from === n.id && e.type === 'rendered-at').map((e) => m.get(e.to)?.label ?? e.to).join(', ');
    L.push(`| **${esc(n.label)}** (\`${n.semanticKey ?? '—'}\`) | ${esc(engines)} | ${esc(ui)} | ${esc(n.formula)} | ${esc(n.authority)} |`);
  }
  L.push('');

  // Governing laws
  const laws = graph.nodes.filter((n) => n.kind === 'law');
  if (laws.length) {
    L.push('## Governing laws / authorities (B6)');
    L.push('');
    L.push('| Law | Statement | Authority | Governs |');
    L.push('|---|---|---|---|');
    for (const law of laws) {
      const governs = graph.edges.filter((e) => e.to === law.id && e.type === 'governed-by').map((e) => m.get(e.from)?.label ?? e.from).join(', ');
      L.push(`| **${esc(law.label)}** | ${esc(law.formula)} | ${esc(law.authority)} | ${esc(governs)} |`);
    }
    L.push('');
  }

  // Assurance — the Trust Engine layer (what PROVES each number is correct)
  const verifications = graph.nodes.filter((n) => n.kind === 'verification');
  if (verifications.length) {
    L.push('## Assurance — the Trust Engine (what proves each number correct)');
    L.push('');
    L.push('| Verification | Layer | Domain | Proves | Catches (the bug it locks) | Covers | Evidence |');
    L.push('|---|---|---|---|---|---|---|');
    for (const v of verifications) {
      const covers = graph.edges
        .filter((e) => e.to === v.id && e.type === 'verified-by')
        .map((e) => m.get(e.from)?.label ?? e.from)
        .join(', ');
      const ev = v.file ? `\`${v.file}${v.line != null ? ':' + v.line : ''}\`` : '—';
      L.push(`| **${esc(v.label)}** | ${esc(v.trustLayer ?? '—')} | ${v.domain} | ${esc(v.produces)} | ${esc(v.catches)} | ${esc(covers)} | ${ev} |`);
    }
    L.push('');
  }

  // Edge list
  L.push('## Edges (verified, with evidence)');
  L.push('');
  L.push('| From | → | To | Type | Units | Source | Evidence |');
  L.push('|---|---|---|---|---|---|---|');
  for (const e of graph.edges) {
    const units = e.fromUnit || e.toUnit ? `${e.fromUnit ?? '—'}→${e.toUnit ?? '—'}` : '—';
    L.push(`| ${esc(m.get(e.from)?.label ?? e.from)} | → | ${esc(m.get(e.to)?.label ?? e.to)} | ${e.type} | ${units} | ${e.source} | ${esc(e.evidence)} |`);
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push('*Generated by `scripts/neomatrix/generate-financial-logic.mjs` from `financial-graph.json`. Part of `0·NEOMATRIX` (Phase 53). Documentation/model only — no financial logic.*');
  L.push('');
  return L.join('\n');
}
