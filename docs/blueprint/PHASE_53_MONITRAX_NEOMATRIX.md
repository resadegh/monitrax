# Phase 53 — Neomatrix (Monitrax Financial Logic Knowledge Graph)

> **Status:** 🟢 **IN BUILD — foundation + tax domain modelled AND audited; self-enforcing on every build.** (Design spec §1–§14 below; as-built status in §0 immediately after this header.) Build began 2026-06-23.
> **Author:** Architect-mode session 2026-06-23 (Reza directive).
> **Build owner:** dedicated Claude Code build session(s), guided by Reza.
> **Parent workstream:** extends `0·FIN-LOGIC-INDEX` (the markdown Financial
> Logic Index, `docs/financial-logic/`). The Neomatrix is the *machine-readable
> + navigable + auditable* evolution of that index.

> **Name:** **Neomatrix** (Reza, 2026-06-23) — the Monitrax financial-logic
> knowledge graph. ("Money Tracks Neonatrix" was the spoken form; Reza confirmed
> the name is **Neomatrix**.)

---

## 0. As-built status (live — updated 2026-06-24)

> The §1–§14 below are the original design. This section is the **as-built
> truth** — what is shipped, where it lives, and what's next. Granular detail
> lives in the artefacts linked here; this is the index.

> **N2 EXPLORER SHIPPED — ADMIN-ONLY (2026-06-24).** ⚖️ Strategic decision
> (Reza): Neomatrix is a developer/architecture tool — a 3D vision of the app's
> engines + relations — **not a user feature**. It therefore lives in the
> **Admin portal** at `/admin/neomatrix` (admin-only, beside `/admin/calc-audit`),
> never in the user dashboard. The original N2 design said "2D explorer, 3D later
> (N5)"; with the value layer (102 verified nodes + audit) already done, N2/N5
> merged into one navigable **3D** explorer: `react-force-graph-3d` (three.js,
> dynamically-imported `ssr:false`, route-scoped — §12.7) renders the real graph
> with orbit/zoom/pan, domain-coloured nodes, click→inspector (formula · inputs ·
> file:line · lineage · authority · worked-example · ✓verified), left-rail
> domain/layer/search filters, and a 2D/3D toggle (`numDimensions`). Admin API
> `/api/admin/neomatrix/graph` (calc-audit guard posture; **metadata only — no CDR
> data**, §9). Per §18.2 the admin portal is a separate design system (not §18.8
> Stitch-gated); the Stitch design pass (9.2/10 language) is committed as the
> visual reference under `.stitch/designs/neomatrix/`. Files: `app/admin/neomatrix/`,
> `app/api/admin/neomatrix/graph/`, `components/admin/neomatrix/NeomatrixExplorer.tsx`,
> sidebar "Engineering" section.

### What's shipped (merged to `main`)

| Phase | Status | Artefact |
|---|---|---|
| **N0 — Graphify trial** | ✅ **GO, adopted** (code-only/offline, zero egress; reproduced 9/9 of the `00b` orchestration edges) | [`docs/financial-logic/graph/N0_GRAPHIFY_TRIAL.md`](../financial-logic/graph/N0_GRAPHIFY_TRIAL.md) |
| **N1 — schema + generator + core slice** | ✅ | schema [`graph/schema/financial-graph.schema.md`](../financial-logic/graph/schema/financial-graph.schema.md); model [`graph/financial-graph.json`](../financial-logic/graph/financial-graph.json); generator `scripts/neomatrix/*.mjs`; view [`graph/GENERATED_CORE.md`](../financial-logic/graph/GENERATED_CORE.md) |
| **N3 (seed) — CI audit + build gate** | ✅ **live** — `npm run neomatrix:check` in `vercel-build` (CLAUDE.md Part 21) + vitest `tests/neomatrix/financialGraph.test.ts` (schema · A3 orphan/convergence · file:line anchors · markdown freshness) | `tests/neomatrix/` |
| **N4 — domain backfill (tax-first)** | ✅ **tax domain modelled** — income tax · PAYG · CGT/reform (regime layer) · super (SG, caps, Div 293/296, SMSF Div 295) · land/stamp/GST — all `verified` with `file:line` | `financial-graph.json` (domain `tax`) |
| **A1 — executable law-referenced audit** | 🔄 **in progress** — the model *referees* the code: law-derived expected values, real engines run, mismatch → `suspected-issue` (raised, never auto-fixed). Core + income tax/Medicare + GST/Div 293/SG audited; no suspected-issue found. Locks the income-tax bracket-boundary P0 fix + the SG-cap P1 fix. | `tests/neomatrix/financialAudit.test.ts` |

### Decisions taken (Reza)
- **Graphify adopted** in code-only/offline mode (N0 go/no-go).
- **Schema locked** as built (Reza: "you know what I need — recommend").
- **Tax-first** backfill order.
- **Every build runs through CLAUDE.md + Neomatrix** — critical instruction → CLAUDE.md **Part 21** + the `vercel-build` gate.
- **Self-review gate** — CLAUDE.md **Part 20** (3×/10-10 before sign-off) + **§20.4** (any financial build = recorded 10/10).
- **Audit-as-we-go, model is the reference, never change a Monitrax rule without confirmation** — a discrepancy is a documented `suspected-issue`, raised with Reza.

### Still pending
- **A1 continues:** SMSF Div 295 + CGT, then health → CFO → intelligence → reports (each modelled + audited).
- **N2 — interactive 2D explorer** (Cytoscape, reads the JSON).
- **N5 (optional) — literal 3D view** (last; only after value is proven).
- **A2 drift sentinel (AST-hash binding) + A4 conversion-node enforcement** (currently informational warnings).

### Coverage (live)
The JSON's own dashboard is in `GENERATED_CORE.md` (§ Coverage & trust). Tracked as `financial-graph.json` `version`. Live workstream: `0·NEOMATRIX` in [`docs/implementation/01_ACTIVE_WORKSTREAMS.md`](../implementation/01_ACTIVE_WORKSTREAMS.md).

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

## 14. The "smartest model" enhancements (proposed — pending Reza sign-off)

> Added 2026-06-23 after Reza gave full authority to make the Neomatrix *"the
> smartest and complete model ever built for fast and accurate referencing,
> coding and improvement"* — so any mistake is found with full context, **without
> drift, getting lost, or guesswork.** Self-reviewed 3× per CLAUDE.md Part 20:
> v1 brain-dump = 12 ideas → merged the golden-number registry into executable
> worked-examples, **elevated the two checks that hit Monitrax's named pains** (the
> #1201 "two numbers on one page" contradiction and the §19 100×-unit bug class),
> demoted literal 3D to last with an honest "comprehension, not audit" caveat →
> **final 11 in three tiers.** These extend §4–§7; they do not change any
> financial logic.

### Tier A — the SPINE: machine-*proven* correctness (this is what kills drift & guesswork)

| # | Enhancement | Why it's load-bearing |
|---|---|---|
| **A1** | **Executable worked-examples (golden numbers).** Each engine node's `workedExample` becomes real fixture `inputs → expectedOutput`; the Layer-3 audit **runs the pure engine** and asserts the output every CI run. | Turns the graph from *documentation that asserts correctness* into *CI that proves it*. The 2026-06-23 tax-$0-at-bracket-boundary bug would have failed the build. Pure engines first (the 4 core are pure); DB-bound engines via injected fixtures. |
| **A2** | **Drift sentinel (AST-hash binding).** Each node stores its symbol's `ast_hash` (Graphify already emits it). CI recomputes; if a financial engine's **body changed** but its node metadata (`formula`/`verifiedDate`) did **not** update in the same PR → build fails. | The structural anti-drift mechanism Reza named. Generalises the #1201 enforcement gate from one surface to every engine. |
| **A3** | **Convergence / contradiction audit.** Every `number` node carries a `semanticKey` (e.g. `monthlyCashflow`). Two `ui-surface` nodes with the same key MUST trace to the **same canonical accessor** — else CI fails. | This is the *exact* #1201 failure: the `/cashflow` hero (+$10,505 declared) and its own waterfall (−$20,914 actual) rendered the same concept from different sources. The graph makes that impossible to ship. |
| **A4** | **Unit-typed edges.** Edges carry `fromUnit`/`toUnit`; an engine emitting `AUD/month` feeding one expecting `AUD/year` with **no conversion node** → CI fails. | Catches the 100× loan-interest decimal class (`interestRateAnnual` = `0.0625` decimal, not percent — §19.2). Unit confusion is the #1 source of financial error. |

### Tier B — the REACH: full context & fast referencing

| # | Enhancement | Value |
|---|---|---|
| **B5** | **Bidirectional lineage + blast-radius queries.** Number → raw-field origin (reverse lineage) **and** engine → every affected tile (forward blast radius). | "Find out how any number is born, and what a change breaks, without getting lost." Layers the *semantic* version over Graphify's structural `path`/`explain`. |
| **B6** | **Law / authority nodes (`kind:"law"`) + `governed-by` edges.** ATO sections / standard formulas as real nodes. Slice "every number governed by ITAA 1997 s4-10." | A tax-law change → instant blast radius across the graph. Gold for AU correctness and the Phase 41E reform (§12.14). |
| **B7** | **Provenance tiers + per-number trust score.** `verified` > `graphify` > `inferred` > `unverified`; each displayed number gets a computed audit-confidence; low-trust chains are visibly flagged. | You see *where the risk is* at a glance — honest, anti-overconfidence. |
| **B8** | **Regime / temporal layer.** A node may hold multiple formula variants keyed by regime + commencement date; the post-reform branch is gated by `commencementVerified` (§12.14) and returns UNCOMPUTED until Royal Assent. | Makes Phase 41E grandfathering first-class — no silent post-reform numbers. |

### Tier C — the INTERFACE: so it's actually used (and the literal 3D)

| # | Enhancement | Notes |
|---|---|---|
| **C9** | **Neomatrix MCP query surface.** Expose the graph as an MCP tool so a future Claude session **queries the Neomatrix** ("what feeds the emergency-fund tile? is it verified?") instead of re-reading ~109 files. | The meta-leverage Reza named — *"so you always know how everything works."* The graph becomes the agent's index. Graphify ships `graphify-mcp` for the structural layer; we add the thin semantic layer. |
| **C10** | **Coverage + freshness + trust dashboard** in the hub — % engines modelled · % verified vs graphify vs inferred · # stale nodes · # `suspected-issue`. Generated from the JSON. | Always-honest gaps; never claims more coverage than is verified. |
| **C11** | **The 3D view, done right (Layer 2c — after value).** Height = the layer axis (DB floor → UI ceiling, so a number's lineage is a **visible vertical column**); colour = domain; node size = blast-radius; **`suspected-issue`/stale nodes glow red**; click a node → camera **flies the lineage path**. | Honest caveat (designer + architect lens): **2D is the audit workhorse; 3D is comprehension + the "molecule" Reza pictured.** It earns its place *only* with the anomaly-glow + lineage-fly — otherwise it's decoration. Build after Tiers A/B prove value. |

### Recommended default priority (if Reza signs off)

1. **Lock Tier A into N1+N3** — it *is* the audit, and it directly closes the drift/guesswork gaps. A1+A3+A4 are the highest-ROI checks Monitrax has ever had.
2. **Tier B with the domain backfill (N4)** — B6/B8 land with the tax domain (highest risk); B5/B7 are cheap and continuous.
3. **C9 + C10 early** — they make the artefact *usable by me and every future session*, multiplying the value of everything above.
4. **C11 (3D) last / optional** — only once A/B earn it, with the anomaly-glow + lineage-fly that make it an audit aid, not a toy.

> None of Tier A–C changes a formula, law, or threshold — they *model and verify*
> the logic that exists (§10). A check that surfaces a wrong number raises a
> `status:"suspected-issue"` with Reza; it never edits the engine.

---

*Design spec created 2026-06-23 (§1–§13). §14 "smartest model" enhancements
added 2026-06-23 (Reza full-authority directive; self-reviewed 3× per Part 20),
status: proposed/pending sign-off. Build to be executed by a dedicated session.
Extends `0·FIN-LOGIC-INDEX`; does not change any financial logic.*

---

## 15. N2 — The Explorer (AS-BUILT, 2026-06-24)

> The interactive Layer-2 view. Shipped, prod-verified. **Admin-only.**

### 15.1 What it is + where it lives
A navigable **3D** view of the financial-logic knowledge graph at **`/admin/neomatrix`**
(Admin portal, beside `/admin/calc-audit`). It renders the real `financial-graph.json`
(102 nodes / 130 edges) as a force-directed constellation: orbit / zoom / pan, nodes
coloured by domain, **click → inspector** (kind · formula · inputs+units · `file:line`
source · lineage in/out · authority · worked example · ✓ verified badge + date), a
left-rail with search + domain + layer filters, and a **2D / 3D toggle**.

### 15.2 Why admin-only (⚖️ strategic decision, Reza 2026-06-24)
Neomatrix is a **developer / architecture tool** — a 3D vision of the app's engines +
relations — **not a user feature**. It exposes internal architecture (engine names,
`file:line`, formulas), maps to no TRAIL stage (Part 14), and would only clutter the
user IA. So it lives behind admin auth, for Reza. The graph is **metadata only — no
CDR/user data** (§9), so there's no data-exposure risk; admin-gating is internal-
architecture hygiene.

### 15.3 Architecture
| Piece | File | Notes |
|---|---|---|
| Route (page) | `app/admin/neomatrix/page.tsx` | `'use client'` wrapped in `<AdminFeatureGate feature="adminPortalEnabled">` (same posture as calc-audit) |
| API | `app/api/admin/neomatrix/graph/route.ts` | `isAdminPortalAccessible` → `verifyAdminGCPAuth` → `hasPermission('audit:read')`; returns the imported `financial-graph.json` (metadata only). Bundled at build → resolves on Vercel serverless without FS tracing |
| Component | `components/admin/neomatrix/NeomatrixExplorer.tsx` | `react-force-graph-3d` (three.js) dynamically imported `ssr:false`; domain palette; inspector; filters; 2D/3D toggle drives `numDimensions`; tuned d3 forces (`link.distance(34)`, `charge.strength(-55)`) |
| Nav | `components/admin/layout/AdminSidebar.tsx` | new "Engineering" section (Neomatrix + the previously-unlinked Calc Audit) |
| Dependency | `react-force-graph-3d@^1.29.1` (+three.js, ~600KB) | §12.7-justified: no existing 3D engine to reuse; dynamically imported + route-scoped to admin → never on a user hot path |
| Design reference | `.stitch/designs/neomatrix/explorer-desktop-dark.{png,html}` | Stitch pass scored 9.2/10 on the §18.8 7-lens rubric. **Admin portal is a separate design system → NOT §18.8-Stitch-gated (§18.2)**; the Stitch artefact is a visual reference, the surface uses the dark-cosmos glass vocabulary as a deliberate immersive data-viz choice |

### 15.4 Design vocabulary (admin dark-cosmos)
Deep warm-navy ground (`#050913`) + sky→indigo ambient glow; floating glass panels
(`#0E1424/70` + `backdrop-blur-xl`, hairline borders, `rounded-[22px]`); domain palette —
**core** sky→indigo `#0EA5E9`, **tax** violet `#8B5CF6`, **health** emerald `#22C55E`,
**cfo** amber `#F59E0B`, **intelligence** cyan `#06B6D4`, **reports** rose `#E11D48`;
edges tinted by their source node's domain colour + flowing directional particles; Inter,
`tabular-nums`, tracked-uppercase eyebrows.

### 15.5 PRs
- `#1227` — N2 explorer (admin 3D) · `#1228` — edge-visibility fix (edges were rendering
  at 0.22 alpha → now domain-coloured + particles + tighter layout) · `#1229` — cross-domain
  connectivity (see §16).

### 15.6 Backlog (optional polish)
Bloom / post-processing on the 3D scene · TRAIL + regime filters · camera-focus-on-click ·
mobile reflow.

---

## 16. Cross-domain connectivity model (AS-BUILT, 2026-06-24)

> Why the domains connect the way they do — and the principle that governs new edges.

### 16.1 The principle
In the running app **no number is isolated** — every value is derived by an engine from
canonical inputs and rendered on a surface, and the domains feed each other. So a faithful
graph is **largely connected**. A disconnected cluster therefore means one of two things:
(a) the **model is incomplete** (a real relationship wasn't drawn), or (b) a genuinely
**standalone read-model / dead code** — itself a finding. Both are valuable; the graph
surfaces them.

### 16.2 How the domains actually connect — *through shared canonical inputs* (§12.2 SSOT)
The depth audit initially drew each input → its **first** consumer only, leaving the six
domains as islands. In reality the connective tissue is the **shared raw inputs**: the
CFO score (`scoreCalculator.ts`), the health input (`financial-health/route.ts buildHealthInput`)
and the tax position (`tax/route.ts`) each **independently** read the same tables
(`prisma.income/account/loan/expense/property/investment`); intelligence consumes the master
snapshot; reports consume the report context. Wiring those verified fan-out edges connects
the graph.

### 16.3 The non-negotiable rule for edges (§19.2)
**Every edge is verified to source (file:line) — never guessed.** An edge is added only when
a real `prisma.x.findMany` / call-site proves the data flows that way. If no evidence exists,
the cluster is left **honestly disconnected** with a documented reason, rather than fabricating
a bridge. (PR #1229 added 18 such verified edges — 6 islands → 1 main component of 96/102 nodes;
PR #1231 then closed the **last two islands** — see §16.4 below — giving **1 connected component
of 104/104 nodes, all six domains, nothing isolated**.)

### 16.4 The last two islands — closed (PR #1231)
After #1229 two clusters remained standalone. A complete union-find audit (Reza directive,
2026-06-24) traced both in source and connected them via the **real** path — and, importantly,
*rejected* a tempting false bridge:

| Cluster | The false bridge avoided | The verified bridge used |
|---|---|---|
| `moneyStoryTrend` (Transaction → ribbon → tile) | `input.Transaction → computeActualCashflow` — **rejected**: Money Story reads the `Transaction` table (`moneyStoryTrend.ts:77`) but the actuals engine reads `UnifiedTransaction`, a **different** table | the **shared consumer** `orchestrator.dashboardInsights.GET` (`app/api/dashboard/insights/route.ts:156`) composes both the master snapshot (`:161`) and Money Story (`:173`) |
| `linkageHealth` (+ its law) | wiring raw inputs straight to it — **rejected**: it consumes a `SnapshotV2`, not raw tables | modelled `orchestrator.portfolioSnapshot.GET` (the §12.2 second SSOT, `app/api/portfolio/snapshot/route.ts:519`), which reads the same Property/Loan/Account/Income/Expense/Investment tables (`:525-596`); wired the 6 shared inputs → it → `calculateLinkageHealth` |

**Architectural finding surfaced (not auto-fixed, §19/§21):** the app has **two transaction
tables** — `Transaction` (read only by Money Story + a data-export route) and `UnifiedTransaction`
(the master-snapshot actuals engine + ~56 other call sites). A potential consolidation; flagged
for Reza, no code touched.

### 16.5 How to verify connectivity (union-find)
Run a connected-components pass over `financial-graph.json` (`parent[from]=find(to)` per edge).
As of PR #1231 the graph is **one connected component of 104/104 nodes** (0 standalone). Re-run
this check whenever nodes/edges are added — a new island is a signal to find its real bridge (or
document why it's honestly standalone), never to fabricate one.
