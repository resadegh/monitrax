# Phase 53 — Neomatrix (Monitrax Financial Logic Knowledge Graph)

> **Status:** Design spec — APPROVED FOR BUILD (new session). Not yet implemented.
> **Author:** Architect-mode session 2026-06-23 (Reza directive).
> **Build owner:** a dedicated new Claude Code session, guided by Reza.
> **Parent workstream:** extends `0·FIN-LOGIC-INDEX` (the markdown Financial
> Logic Index, `docs/financial-logic/`). The Neomatrix is the *machine-readable
> + navigable + auditable* evolution of that index.

> **Name:** **Neomatrix** (Reza, 2026-06-23) — the Monitrax financial-logic
> knowledge graph. ("Money Tracks Neonatrix" was the spoken form; Reza confirmed
> the name is **Neomatrix**.)

---

## 1. One-line vision

> **A single, machine-verified knowledge graph of every number Monitrax
> produces — every calc engine, formula, law, input and output as a node;
> every dependency and data-flow as an edge — that you can navigate, slice,
> and audit so that no number can drift from its canonical source without the
> build failing.**

It is the "3D model / chemical structure" Reza described, expressed in its
correct computer-science form: a **typed directed knowledge graph** with
**sliceable projections** (the "cube" axes) and **CI validation** (the audit).

---

## 2. Problem & goal

**Problem.** Monitrax's recurring failure is **calculation drift** — a number on
a tile loses its link to the canonical engine and shows a wrong/contradictory
value (e.g. the 2026-06-23 `/cashflow` hero showing a declared +$10,505 surplus
while the same page's waterfall showed an actual −$20,914 deficit). SSOT is
*documented* in CLAUDE.md but, until now, not **modelled or machine-enforced**
across the ~109 financial-engine files. There is no artefact an engineer/AI can
reference to answer *"how is this exact number generated, and is it correct?"*

**Goal.** Build the Neomatrix so that:
1. **Any number is traceable** end-to-end: raw DB field → calc engine(s) →
   orchestrator → API route → UI tile, with the formula + authority at each hop.
2. **The graph is derived/verified from code**, not hand-maintained prose, so it
   cannot silently go stale.
3. **Correctness is machine-checked** in CI: every node resolves to a real
   `file:line`, every UI number traces to an engine, no engine is bypassed, no
   `verifiedDate` is stale.
4. **It is navigable** — a human or AI can explore it (2D interactive graph;
   optional 3D) and slice it by layer / domain / TRAIL stage / tax regime.

**Non-goal.** This artefact never changes financial logic. It *models and
validates* the logic that exists. Any suspected bug it surfaces is raised with
the owner, never silently fixed (CLAUDE.md §19).

---

## 3. Conceptual model (honest framing)

- The correct data structure is a **typed directed knowledge graph** (nodes +
  typed edges), **not** a literal 3-axis cube — relationships are arbitrary
  edges (this engine feeds three others), not a fixed lattice. Reza's
  "cube/matrix/chemical" intuition is right that it is *networked and
  multi-dimensional*; the literal geometry is the wrong container.
- The **"cube" survives as sliceable projections**: the same graph rendered
  along a chosen axis —
  - **Layer axis:** DB → pure engine → service/orchestrator → API route → UI.
  - **Domain axis:** core / tax / health / CFO / intelligence / reports.
  - **TRAIL axis:** Track / Reduce / Anchor / Invest / Live.
  - **Regime axis:** pre-reform-grandfathered / post-reform (Phase 41E).
  Each projection is an adjacency matrix / layered diagram — the "matrix" view.
- The **"chemistry" metaphor**: nodes = atoms (each is an engine/number/law),
  edges = bonds (typed: `feeds`, `depends-on`, `governed-by`, `rendered-at`),
  and a "reaction" = the lineage that turns raw inputs into a displayed number.

---

## 4. Architecture — four layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3 — AUDIT (CI checks over the graph) ........ the GUARANTEE │
│   validate: file:line exists · UI number → engine path exists ·  │
│   no engine bypassed · verifiedDate fresh · no orphan numbers     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2 — VIEWS (rendered FROM the data) ........... the WINDOW   │
│   a) generated markdown (the existing docs/financial-logic spokes)│
│   b) interactive 2D graph explorer (committed static HTML)        │
│   c) OPTIONAL literal 3D force-graph ("molecule") — later         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1 — SEMANTIC GRAPH (the canonical model) ..... the TRUTH    │
│   financial-graph.json — nodes + typed edges + metadata           │
│   (formula, authority/ATO ref, input units, verifiedDate)         │
│   ← THIS is the "Neomatrix". Everything else renders from it.     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0 — STRUCTURAL SKELETON (auto, from code) .... the BONES    │
│   Graphify: tree-sitter ASTs, call graph, imports, communities    │
│   (auto-extracted + auto-refreshed → no hand-traced edges drift)  │
└─────────────────────────────────────────────────────────────────┘
```

**Division of labour (the key design decision):**
- **Layer 0 (Graphify) supplies the structural edges** — which function calls
  which, which file imports which — derived automatically from the AST and kept
  fresh as code changes. This eliminates hand-tracing of `feeds`/`depends-on`
  edges and their drift risk.
- **Layer 1 (our semantic graph) supplies the meaning** no tool can derive —
  the formula, the law/ATO authority, the input units/conventions, the
  raw-field→tile lineage, the verified worked example. This is the audit
  substance and MUST be research-verified per CLAUDE.md §19.2 (never guessed).
- Graphify is **complementary, not a replacement.** Bones vs meaning.

---

## 5. Data model spec (Layer 1 — `financial-graph.json`)

Single canonical file (or sharded per domain, hub+spoke per §15.5 if it grows).
Schema:

### 5.1 Node

```jsonc
{
  "id": "engine.canonicalCashflow.getCanonicalMonthlyCashflow",  // stable unique id
  "kind": "engine",            // engine | number | input-field | law | route | ui-surface | orchestrator
  "label": "Canonical monthly cashflow",
  "file": "lib/calculations/canonicalCashflow.ts",
  "line": 60,                  // anchor line of the symbol
  "layer": "engine",           // db | engine | service | route | ui
  "domain": "core",            // core | tax | health | cfo | intelligence | reports
  "trailStage": null,          // T | R | A | I | L | null
  "regime": null,              // pre-reform | post-reform | null
  "produces": "Monthly in/out/net (actual-vs-declared resolved)",
  "formula": "if hasActualData: {inflow,outflow,net}=actual; else declared. savingsRate = net/inflow*100",
  "authority": "CLAUDE.md §19.1 (actuals-vs-declared SSOT)",  // or 'ATO ITAA 1997 s4-10', standard formula, etc.
  "inputs": [                  // unit + type + convention, per param
    { "name": "snapshot.quickMetrics", "unit": "AUD/month", "note": "actual* fields from computeActualCashflow" }
  ],
  "verifiedBy": "tests/calculations/canonicalCashflow.test.ts",
  "workedExample": "In 25,827 / Out 46,741 -> net -20,914; savingsRate -80.98%; basis 'actual'",
  "verifiedDate": "2026-06-23",
  "status": "documented"       // documented | pending | suspected-issue | unverified
}
```

### 5.2 Edge

```jsonc
{
  "from": "engine.actualCashflow.computeActualCashflow",
  "to":   "engine.canonicalCashflow.getCanonicalMonthlyCashflow",
  "type": "feeds",             // feeds | depends-on | governed-by | rendered-at | falls-back-to
  "source": "verified",        // verified (read in source) | graphify (auto AST) | inferred
  "evidence": "masterFinancialService.ts:1857 + canonicalCashflow.ts reads quickMetrics.actual*",
  "verifiedDate": "2026-06-23"
}
```

**Rules:**
- Every `verified` edge cites `evidence` (file:line). `graphify` edges are
  auto-imported from Layer 0 and flagged as such. `inferred` edges are NOT
  allowed in the audited graph without promotion to `verified`.
- No node with `kind: "number"` (a user-facing figure) may exist without at
  least one inbound path to a `kind: "engine"` node — that's the core audit.

---

## 6. Tech choices (recommended, the new session may refine)

| Layer | Recommended tech | Why |
|---|---|---|
| 0 — skeleton | **Graphify** (`safishamsi/graphify`) Claude Code skill | Auto AST call/import graph; local; refreshes on change. **Trial on `lib/` first** (acceptance gate below) before committing to it. |
| 1 — model | **JSON** (`docs/financial-logic/graph/financial-graph.json`), optionally generated partly from structured file-header JSDoc | Version-controlled with code; diff-able; no external store; SSOT in-repo. |
| 2a — md view | Node/TS generator → renders existing `docs/financial-logic/*.md` tables from the JSON | Markdown + JSON can't diverge. |
| 2b — 2D explorer | **Cytoscape.js** (or vis-network) in a self-contained committed HTML, reading the JSON | Best for layered/auditable graph; pan/zoom/click/filter/slice. |
| 2c — 3D (optional) | **3d-force-graph** (three.js) | The literal "molecule" — garnish, only after 2a/2b/Layer 3 land. Lower audit value (edge occlusion). |
| 3 — audit | Node/TS script wired like `scripts/check-plan-freshness.sh`, run in `vercel-build` / CI | Converts the artefact from diagram to correctness guarantee. |

---

## 7. Build phases (with acceptance criteria)

> Each phase is research-verified per CLAUDE.md §19.2. Documentation/model only —
> **no financial logic changed.** Suspected issues → flagged, not fixed.

| Phase | Deliverable | Acceptance criteria |
|---|---|---|
| **N0 — Graphify trial** | Install Graphify skill; index `lib/`; compare its auto-edges against the hand-verified edges in `docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md`. **Security pre-check (§13.6):** confirm what (if anything) leaves the machine during LLM concept-extraction. | Report: % of `00b` edges Graphify reproduces, false edges, security posture. Go/no-go on adopting Layer 0. |
| **N1 — schema + proof slice** | `financial-graph.json` schema (§5) + populate the 4 verified core engines + their edges (reuse `01_CORE_CALCULATIONS.md` + `00b`). Generator that renders the markdown tables FROM the JSON. | JSON validates against schema; `npm run` generator reproduces the existing core spoke table; 4 nodes + their edges present, all `verified` with evidence. |
| **N2 — 2D explorer** | Committed self-contained HTML reading the JSON; click node → formula/inputs/file:line/lineage; filter by layer + domain + TRAIL + regime. | Opens offline; renders the core slice; slicing works; node detail shows the §5.1 fields. |
| **N3 — CI audit** | Validation script + CI wiring. | Fails build when: a node `file:line` is missing; a `number` node has no path to an `engine`; a converged surface bypasses its canonical accessor; `verifiedDate` older than a set staleness window. Green on the current core slice. |
| **N4 — backfill domains** | Add tax → health → CFO → intelligence → reports nodes/edges, each research-verified, into the graph (highest-risk first = tax). | Coverage tracker in the hub rises; every new node carries §5.1 metadata + verification. |
| **N5 (optional) — 3D view** | 3d-force-graph "molecule" toggle. | Only after N1–N3 prove value; explicit Reza go-ahead. |

---

## 8. Integration with existing assets (do not duplicate — §12.1)

- **`docs/financial-logic/` (markdown index)** becomes a **rendered view** of
  the JSON (Layer 2a). The 4 documented core engines + `00b` edges are the seed
  data for N1. Do not maintain two copies — generate the markdown from the JSON.
- **`masterFinancialService` SSOT** is the orchestrator node; the graph must
  reflect that engines compose through it (the verified `:1767/:1819/:1857/
  :1910/:1916` edges).
- **The #1201 enforcement gate** (`cashflowSurfacesUseCanonical.test.ts`) is the
  prototype of a Layer-3 check; generalise it, don't replace it.
- **CLAUDE.md §16.4** structured file-header JSDoc is the natural source for
  generating node metadata — align the header schema with §5.1 so nodes can be
  partly auto-extracted.

---

## 9. Security & compliance (§13, §13.6)

- The graph models **code structure + formulas**, NOT user financial data — no
  CDR data, balances, or PII ever enter the graph. (Acceptance: a lint that
  rejects any value-looking literal in `financial-graph.json`.)
- **Graphify local-only must be verified** (N0) before adoption. If any code
  leaves the machine during extraction, treat as a data-egress decision and get
  explicit sign-off.
- The artefact is **version-controlled in-repo** — no external hosted graph DB
  as the source of truth (a correctness artefact must live with the code it
  describes). A hosted query layer (Neo4j/Graphiti MCP) may be added later as an
  *optional* read view, never the canonical store.

---

## 10. Guardrails for the build session (read before any code)

1. **Documentation/model only** — never change a formula, law, threshold, or
   engine. Suspected bug → `status: "suspected-issue"` + raise with Reza.
2. **Never guess an edge or a formula** — every `verified` node/edge cites
   `file:line` read in source (CLAUDE.md §10, §19.2). Unverifiable →
   `status: "unverified"` with reason. Graphify edges flagged `source:graphify`.
3. **Derive, don't hand-maintain** — the markdown renders from the JSON; node
   metadata aligns with file-header JSDoc; CI checks freshness. A hand-kept
   graph that drifts is worse than none.
4. **Value before visuals** — Layers 1 + 3 (model + audit) earn their place
   before Layer 2c (3D). Don't gold-plate.
5. **Hub + spokes / size budget** (§15.5) if the JSON grows — shard per domain.

---

## 11. How the new session should start

1. Read CLAUDE.md (esp. §6, §12.2/§12.3, §16, §19), this Phase 53 doc, and
   `docs/financial-logic/00_INDEX.md` + `00b_RELATIONSHIPS_AND_LINEAGE.md` +
   `01_CORE_CALCULATIONS.md`.
2. Register `0·NEOMATRIX` in `docs/implementation/01_ACTIVE_WORKSTREAMS.md`.
3. Execute **N0 (Graphify trial)** first — it gates the Layer-0 decision.
4. Then **N1 (schema + proof slice)**. Get Reza's sign-off on the JSON schema
   before backfilling domains.
5. Work in small PRs (one per phase), each with the §16 doc-sync block.

---

## 12. Open decisions for Reza

1. **Name** — **Neomatrix** ✅ DECIDED (Reza, 2026-06-23).
2. **Graphify adoption** — decided by the N0 trial result (security + accuracy).
3. **Literal 3D view** — on the roadmap (N5) or 2D-only? (Architect lean: 2D
   first; 3D only if it earns it.)
4. **Where the explorer lives** — committed static HTML opened locally (simplest)
   vs an internal `/dev/neomatrix` route in the app (needs auth gating). Lean:
   static HTML first.

---

## 13. Success criteria

- Pick any number in Monitrax → the Neomatrix shows its full lineage + formula +
  authority + verification, in one place.
- A code change that breaks a number↔engine link **fails CI**.
- The graph is **always current** because it's derived/checked, not hand-kept.
- An engineer (human or AI) can understand how Monitrax computes — and **prove a
  number is correct** — without guessing.

---

*Design spec created 2026-06-23. Build to be executed by a dedicated session.
Extends `0·FIN-LOGIC-INDEX`; does not change any financial logic.*
