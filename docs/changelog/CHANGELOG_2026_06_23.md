# Changelog — 2026-06-23

## Session: cashflow-ssot-convergence-shk180

### Changes Made
- **Type:** Fix (financial correctness) + Enhancement (SSOT enforcement)
- **Scope:** cashflow calculation engine + the surfaces that emit monthly in/out/net
- **Root cause:** SSOT was *documented* (CLAUDE.md §6.1/§12.2/§12.3) but never *enforced*. Multiple routes each chose their own cashflow basis — some DECLARED records (Income/Expense/Loan × frequency), some ACTUAL transactions, and one tile mixed both — so two cashflow tiles on the same page showed different (and, for declared surfaces, falsely optimistic) numbers. The `/cashflow` page showed a +$10,505 surplus / 51.9% saving-rate hero while its own money-flow waterfall showed the real actuals; the true current month was a deficit (In ≈ $25,827 / Out ≈ $46,741 / Net ≈ −$20,914).
- **Solution (Phase 2 — establish ONE correct number + source of truth, converge the others to it):**
  1. **Canonical accessor** `lib/calculations/canonicalCashflow.ts` — `getCanonicalMonthlyCashflow(snapshot)` + pure `resolveCanonicalCashflow(actual, declared)`. The ONE place the actuals-vs-declared rule lives: actuals win when `hasActualData`, declared fallback otherwise (CLAUDE.md §19.1). Returns `{ inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis }`.
  2. **`/cashflow` HERO converged** — `buildForecastSummary` + the cashflow health-score input in `/api/cashflow/intelligence/route.ts` now resolve through the canonical accessor instead of declared records. The hero now agrees with the (already-actual) waterfall on the same page.
  3. **Emergency-fund tile internal mismatch fixed** — `/api/dashboard/insights/route.ts` displayed declared `totalMonthlyExpenses` as the "/month" figure while `monthsCovered` used the actual trailing-avg outflow — a contradiction on one tile. Now displays `snapshot.emergencyFund.monthlyExpenses` (the exact denominator the engine used for `monthsCovered`).
  4. **Trailing-average divisor fix** — `lib/calculations/actualCashflow.ts` changed the trailing-3-full-month average from a fixed `/3` to a **data-driven divisor**: a month with NO transactions is missing data (excluded from sum AND divisor); a populated low-spend month still counts. Fixes the false ~$938 emergency figure for users who only recently connected their bank.
  5. **Enforcement gate** — `tests/calculations/cashflowSurfacesUseCanonical.test.ts` structural guard fails the build if a converged surface drops the canonical accessor (so SSOT can't silently drift again).

### Scoped out / deferred (with reason)
- **Home page tiles** (`/dashboard` Monthly Cash Flow / Annual Outgoings / Saving Rate, fed by `portfolio/snapshot.cashflow` + `insights.kpiTiles.outgoingsAnnual`) were investigated and intentionally NOT converged in this PR. Overwriting only the headline to actual breaks the Home drill-down tie-out — the drill-down recomposes net from a DECLARED Income−Expenses−Loans breakdown, while actuals only give Inflow−Outflow (loans folded into outflow). Converging correctly needs a section-level drill-down change (Stitch-first, CLAUDE.md §18.2.1). A backend-only overwrite would re-introduce exactly the contradiction this workstream is removing. Tracked as Phase 2b in `01_ACTIVE_WORKSTREAMS.md`.
- Rolling-30-day analytics window vs current-calendar-month reconciliation; `/activity` donut "20% kept" YTD source trace — tracked as Phase 2c.

### Files Modified
- `lib/calculations/canonicalCashflow.ts` — **new.** Canonical accessor + pure resolver (the single actuals-vs-declared rule).
- `lib/calculations/actualCashflow.ts` — trailing-average divisor changed from fixed `/3` to data-driven (populated-months only); doc comments updated.
- `app/api/cashflow/intelligence/route.ts` — `buildForecastSummary` re-signed to take canonical (income, outflow, net); hero + health-score input resolve via `getCanonicalMonthlyCashflow`.
- `app/api/dashboard/insights/route.ts` — emergency tile displays `snapshot.emergencyFund.monthlyExpenses` (engine denominator), not declared `totalMonthlyExpenses`.
- `tests/calculations/canonicalCashflow.test.ts` — **new** (4 tests).
- `tests/calculations/cashflowSurfacesUseCanonical.test.ts` — **new** (3 tests, enforcement gate).
- `tests/calculations/actualCashflow.test.ts` — updated 3 tests for the data-driven divisor.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·CASHFLOW-ACTUALS` Phase 2 progress.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped.
- `docs/audit/AUDIT_CASHFLOW_SSOT.md` — convergence status appended.

### §19.2 evidence (worked examples)
- **Canonical accessor (actual):** In 25,827 / Out 46,741 → Net −20,914; savingsRate = −20,914 / 25,827 × 100 ≈ −80.98% (NOT +51.9%). basis = 'actual'. ✅ verified by test.
- **Canonical accessor (declared fallback, no txns):** Income 8,000 − (Expenses 5,000 + Loans 1,000) → Net 2,000; savingsRate 25%. basis = 'declared'. ✅ verified.
- **Divisor:** only May populated (600), Mar+Apr no transactions → divisor 1 → avg 600 (old fixed /3 wrongly gave 200). Mar 10 + May 600 both populated → divisor 2 → avg 305. ✅ verified.

### Testing
- [x] Build passes (`npm run build` — full route table emitted, no type errors)
- [x] Lint passes (`npm run lint:financial-surfaces` — 0 new violations)
- [x] `tests/calculations` — 119 tests pass (incl. 18 new/updated cashflow tests)

### PR
- PR URL: (to be filled)
- Status: Open (draft)

---

## Session: financial-logic-index-shk180

### Changes Made
- **Type:** Documentation (new master reference — no logic change)
- **Scope:** new `docs/financial-logic/` hub + spokes — the Financial Logic Index
- **Why:** Reza directive — *"build the document for every phase [after] complete research on the document for that section, the code, understand the logic, then document. Never guess or assume … only to keep a live index and reference … so you can understand Monitrax without guess or assumption."* The 2026-06-23 doc-coverage audit found ~27% of ~112 financial-engine files have proper inline headers and NO canonical engine→file→formula→authority index. Calc drift (the #1201 cashflow contradiction) happens when a surface changes without tracing to the canonical source; this index is the anchor.
- **Constraints honoured:** documentation only (no logic/law/formula/threshold changed); research-first (each entry written only after a complete source read + phase-doc + input-unit + caller trace); never guess (`⚠️ UNVERIFIED`/`⚠️ SUSPECTED ISSUE` markers reserved for the unverifiable).

### Files Added
- `docs/financial-logic/00_INDEX.md` — hub: purpose, operating rules, status legend, spoke map, coverage tracker.
- `docs/financial-logic/01_CORE_CALCULATIONS.md` — first spoke, 4 engines fully documented from complete reads: net worth (`netWorthCalculator.ts`), declared cashflow (`cashflowOrchestrator.ts`), actual cashflow (`actualCashflow.ts`), canonical cashflow (`canonicalCashflow.ts`) — each with Produces · Canonical accessor · Inputs (unit/type/convention) · Formula+authority · Gotchas · Consumers · Verified-by · worked example.

### Files Modified
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·FIN-LOGIC-INDEX` workstream.

### Note on branch base
Stacked on the #1201 cashflow-SSOT branch so the index documents the **converged** state (data-driven divisor + `canonicalCashflow.ts` exist). PR base set to the #1201 branch for a clean diff; retarget to main once #1201 merges.

### Testing
- [x] No code changed — docs only. (No build/lint impact.)

### PR
- PR URL: (to be filled — pending GitHub MCP re-auth)
- Status: template slice for format sign-off

#### Addendum — relationships & lineage (third dimension)
Reza directive: the index must also capture how all numbers/engines relate, so the artefact explains how Monitrax works end-to-end and how any number is generated.
- `docs/financial-logic/00b_RELATIONSHIPS_AND_LINEAGE.md` — **new.** Layered data-flow diagram (DB → pure engines → masterFinancialService → API routes → UI, mermaid), verified engine dependency graph (file:line for each `masterFinancialService` composition call), per-number lineage table (raw field → engine → accessor → route → tile), and the two-snapshot-SSOT distinction. Verified-only edges (confirmed in source this session).
- `00_INDEX.md` — per-engine schema now requires **Fed by / Feeds into** edges; relationships spoke registered.
- `01_CORE_CALCULATIONS.md` — added **Fed by / Feeds into** to all 4 entries.

---

## Session: neomatrix-design-spec-shk180

### Changes Made
- **Type:** Documentation (design spec for a new build workstream)
- **Scope:** new `docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md` — full build spec for the **Neomatrix**
- **Why:** Reza named the financial-logic knowledge-graph artefact **Neomatrix** and asked for a complete, hand-off-ready design spec for a dedicated new session to build, while this session continues the audit/discrepancy work.
- **What the spec defines:** vision; honest conceptual model (typed directed knowledge graph, NOT a literal cube — the "cube" survives as sliceable projections: layer/domain/TRAIL/regime); 4-layer architecture (L0 Graphify structural skeleton · L1 `financial-graph.json` semantic graph · L2 views: generated markdown + 2D explorer + optional 3D · L3 CI audit checks); the node/edge JSON schema (§5); tech choices (Graphify, Cytoscape, optional 3d-force-graph, CI like check-plan-freshness); build phases N0–N5 with acceptance criteria; integration with the existing `docs/financial-logic/` index + masterFinancialService SSOT + the #1201 enforcement gate; §13.6 security (no CDR data in graph; verify Graphify local-only); guardrails (model-only, never-guess, derive-don't-hand-maintain, value-before-visuals); how the new session should start; open decisions.
- **Graphify research:** verified via web search that Graphify (`safishamsi/graphify`) is a real Claude Code knowledge-graph skill (tree-sitter AST/call-graph, NetworkX, Leiden communities, local). Conclusion in the spec: complementary (bones), not a replacement for the semantic correctness layer (meaning).

### Files Added
- `docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md`

### Files Modified
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·NEOMATRIX` workstream.

### Testing
- [x] No code — docs only.

### PR
- PR URL: (to be filled)
- Status: design spec for a new build session

---

## Session: neomatrix-N0 (Graphify trial — `0·NEOMATRIX`)

### Changes Made
- **Type:** Documentation / model (Neomatrix Phase 53 **N0** — Graphify Layer-0 trial). **No financial logic changed.**
- **Scope:** new `docs/financial-logic/graph/` (Neomatrix home) — N0 trial report + README; gitignore the regenerable Graphify output.
- **Why:** N0 gates the Layer-0 (Graphify) adoption decision. Two questions had to be answered from a real run, not memory (§19.2): (1) **§13.6 security** — does code leave the machine during extraction? (2) **accuracy** — does Graphify's auto AST graph reproduce the hand-verified `00b` edges?

### What was done (real trial, reproducible — see report §6)
- Installed **graphify 0.8.45** (`uv tool install graphifyy`; PyPI reachable in this env).
- Ran `graphify update lib` (code-only, **all LLM API keys unset**) over `lib/` (539 `.ts` files) → **6120 nodes / 12866 edges / 253 communities**, pinned to `built_at_commit 2a5e0f5`.
- **Security result (§13.6): provably code-only / zero egress.** 100% of nodes `_origin:"ast"`, `file_type:"code"`; 12855/12866 edges `EXTRACTED` (AST) + 11 `INFERRED`; no LLM nodes; no API host in cache. In code-only mode Graphify is a local static analyser (like `tsc`/`eslint`).
- **Accuracy result: 9/9** of the `00b §2` verified orchestration call-edges reproduced at **exact `file:line`** matching `00b`'s citations (L1767/L1819/L1831/L1857/L1910/L1916/L874/L1005 + the canonical→resolve delegation). No false edges on the core slice; name collisions (3× `calculateNetWorth`) kept as distinct file-scoped nodes.
- **Division of labour validated:** Graphify supplies structural `calls`/`imports` edges (bones); it cannot derive a single formula, law, unit, data-flow (`UnifiedTransaction`→`computeActualCashflow`), `falls-back-to` semantic, or domain/TRAIL/regime slice — that is Layer 1's job (meaning).

### Recommendation — **GO (conditional, code-only/offline)** under the report §5 guardrails (no API key ever; code-only inputs; Graphify output gitignored not committed; its edges imported into `financial-graph.json` flagged `source:"graphify"`; pin to commit for freshness). ⏸️ **Paused for Reza's go/no-go before N1.**

### Files Added
- `docs/financial-logic/graph/N0_GRAPHIFY_TRIAL.md`
- `docs/financial-logic/graph/README.md`

### Files Modified
- `.gitignore` — ignore `graphify-out/` (regenerable Layer-0 working artifact, §9).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOMATRIX` N0 ticked + Last touched.

### Testing
- [x] No app code — docs/model only. Build/lint unaffected.
- [x] Trial reproducible via report §6 commands.

### PR
- PR URL: (to be filled)
- Status: N0 report — awaiting Reza go/no-go

---

## Session: neomatrix-N0 (addendum — smartest-model design + self-review gate)

### Changes Made
- **Type:** Documentation / governance. **No code, no financial logic changed.**
- **Why:** Reza (2026-06-23) gave full authority to make the Neomatrix *"the smartest and complete model ever built for fast and accurate referencing, coding and improvement … without drift, getting lost or guesswork"*, and added a standing rule: *"always review your own suggestions and instructions at least 3 times and make sure the outcome is 10/10 before presenting for sign off."*

### What was added
- **CLAUDE.md Part 20 — Self-Review Gate (3× review, 10/10 before sign-off, MANDATORY).** Generalises the §18.8 Stitch ≥9/10 gate to ALL sign-off-bound output (architecture, financial-logic plans, Neomatrix design, PR recommendations, instructions, copy). Protocol version 2.4 → 2.5.
- **PHASE_53 §14 — "smartest model" enhancements (proposed, pending sign-off).** Self-reviewed 3× per Part 20 (12 raw ideas → final 11 in 3 tiers). Tier A (spine — machine-PROVEN correctness): A1 executable worked-examples (L3 runs engines, asserts outputs), A2 drift sentinel (AST-hash binding → engine body change without metadata bump fails CI), A3 convergence/contradiction audit (same `semanticKey` ⇒ same canonical accessor — the #1201 class), A4 unit-typed edges (unit mismatch fails CI — the 100× class). Tier B (reach): B5 bidirectional lineage + blast-radius, B6 law/authority nodes + `governed-by`, B7 provenance tiers + trust score, B8 regime/temporal layer (§12.14). Tier C (interface): C9 Neomatrix MCP query surface, C10 coverage/freshness/trust dashboard, C11 the 3D view done right (height=layer, glow on anomalies, fly the lineage — Layer 2c, after value).

### Files Modified
- `CLAUDE.md` — Part 20 + version bump to 2.5.
- `docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md` — new §14 enhancements + footer.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOMATRIX` note.
- `docs/changelog/CHANGELOG_2026_06_23.md` — this entry.

### Testing
- [x] Docs/governance only — build/lint unaffected.

### PR
- Folded into PR #1204 (draft, paused for go/no-go + enhancement sign-off).

---

## Session: neomatrix-N1 (schema + proof slice + generator)

### Changes Made
- **Type:** Documentation / model + a CI-enforced model test. **No financial logic changed.**
- **Why:** Reza (2026-06-23): *"review your own recommendation … continue with the best approach based on the requirements and scoring model. come to me where there is a critical direction needed."* Self-scored the N0 GO (evidence-backed, reversible → adopt autonomously) and proceeded to N1; the only foundational call is the schema shape, built to 10/10 and presented concretely rather than blocking.

### What was built (Phase 53 N1)
- **Schema** (`docs/financial-logic/graph/schema/financial-graph.schema.md`) — §5 node/edge contract + the cheap §14 additions (`semanticKey` for A3, `fromUnit`/`toUnit` for A4, `astHash` for A2, provenance tiers `verified>graphify>inferred`).
- **`financial-graph.json`** — the canonical semantic graph (Layer 1). **23 nodes / 26 edges, all `verified` with file:line evidence**: the 4 core engines (`calculateNetWorth` :217 · `calculateCashflow` :302 · `computeActualCashflow` :104 · `getCanonicalMonthlyCashflow` :114) + `resolveCanonicalCashflow` :78 + the `getMasterFinancialSnapshot` orchestrator :1704 + 10 raw input-field nodes + 2 law nodes (B6) + 3 number nodes (with `semanticKey`) + 2 ui-surfaces; lineage, units, worked examples, authorities all carried.
- **Generator** (`scripts/neomatrix/generate-financial-logic.mjs` + `graphlib.mjs`, pure Node, zero new deps) — renders `GENERATED_CORE.md` FROM the JSON (Layer 2a: coverage/trust dashboard + engine registry + worked-examples + number-lineage + laws + edges). `npm run neomatrix:generate` / `neomatrix:check`.
- **Layer-3 audit seed, enforced in CI today** (`tests/neomatrix/financialGraph.test.ts`): schema validation · **A3 orphan-number** (every displayed number traces to an engine) · **A3 convergence/contradiction** (two tiles of the same `semanticKey` must trace to the same engine — the exact #1201 "+$10,505 hero vs −$20,914 waterfall" class, with a passing negative test) · **file:line resolution** (each documented engine line in source contains its symbol) · **markdown freshness**. Lives in the existing vitest suite (already a required check) — no `vercel-build` change yet (full N3 gate is a separate Reza decision).

### Autonomous calls made (per Reza's "continue with the best approach")
- **Graphify Layer-0: adopted** (code-only/offline) — evidence-backed GO, reversible.
- **Generator/test in pure Node + vitest** (not ts-node into vercel-build) — zero new deps, enforced in CI now without build-gating.
- **Branch:** stayed on the designated `claude/eloquent-archimedes-jqahjw` (harness rule; PR #1204).

### Verification
- `node scripts/neomatrix/generate-financial-logic.mjs --check` → **OK** (schema valid, invariants hold, markdown fresh).
- Dependency-free harness replicating all 6 vitest assertions → **6 passed, 0 failed** (node_modules not installed in this env, so vitest itself wasn't run here; the test exercises only pure helpers + fs and will run in CI).

### Files Added
- `docs/financial-logic/graph/financial-graph.json`, `…/GENERATED_CORE.md`, `…/schema/financial-graph.schema.md`
- `scripts/neomatrix/graphlib.mjs`, `scripts/neomatrix/generate-financial-logic.mjs`
- `tests/neomatrix/financialGraph.test.ts`

### Files Modified
- `package.json` — `neomatrix:generate` / `neomatrix:check` scripts.
- `docs/financial-logic/graph/README.md` — N1 status + commands.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOMATRIX` N1 ticked.

### ⏸️ Critical direction needed from Reza
- **Schema sign-off** before the domain backfill (N4 — tax first). The §5+§14 shape above is the contract every future domain inherits; confirm or adjust now while only the core slice exists.

### PR
- Folded into PR #1204 (draft).
