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

---

## Session: neomatrix-N3-gate (build gate + critical instruction) + schema locked

### Changes Made
- **Type:** Build pipeline + governance. **No financial logic changed.**
- **Reza decisions (2026-06-23):** (1) "you know what I need — make the recommendation" → **schema LOCKED** as built (the §5+§14 node/edge shape is the recommendation; no further field-by-field sign-off). (2) **N4 = tax-first.** (3) "all future builds should always run through claude.md and neoMatrix — this will be a critical instruction."

### What was done
- **`neomatrix:check` wired into `vercel-build`** (after `lint:financial-surfaces`, before `prisma migrate deploy` — fails fast, no DB mutation on a bad model).
- **CLI check strengthened** — now also verifies engine `file:line` anchors resolve to their symbol (drifted anchor → build fails), matching the vitest test.
- **CLAUDE.md Part 21 (CRITICAL)** — "Every build runs through CLAUDE.md + Neomatrix": the build gate (21.1), the same-PR modelling rule for any financial-engine/number change (21.2, mirrors §16+§19), reviewer enforcement (21.3). Protocol v2.5 → 2.6.
- **Infra doc** `09_INFRASTRUCTURE_AND_DEPLOYMENT.md` build-sequence updated.

### Verification
- `npm run neomatrix:check` (now incl. anchors) → **OK**.

### Files Modified
- `package.json` (vercel-build), `scripts/neomatrix/generate-financial-logic.mjs` (anchor check), `CLAUDE.md` (Part 21 + v2.6), `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`.

---

## Session: neomatrix-N4.1 (tax-domain backfill — income-tax spine)

### Changes Made
- **Type:** Documentation / model (Neomatrix N4.1 — tax domain). **No financial logic changed.**
- **Reza decision:** N4 = tax-first. This is the first domain backfill, research-verified per §19.2 (every node/edge cites a file:line read this session — never guessed).

### What was modelled (graph 23→36 nodes / 26→38 edges, all `verified`)
- **Chain:** orchestrator `buildMasterTaxPosition` (masterTaxPosition.ts:186) → `calculateEntityTaxPosition` (entityTaxRouter.ts:300, calls calculateTaxPosition at :332) → income-tax `calculateTaxPosition` (taxPositionCalculator.ts:92). Verified the full call path in source.
- **PAYG:** `processSalary` (salaryProcessor.ts:46) — GROSS↔net take-home.
- **Thresholds SSOT:** `getCurrentTaxYearConfig` (taxYearConfig.ts:370) ← bracket (:41) / Medicare (:61) / LITO (:85) config inputs. No rate VALUES copied into the graph (§9) — the graph cites where they live.
- **Law nodes (B6):** ITAA 1997 income tax + ATO rates · Medicare Levy Act 1986 · **2026-27 reform cut-over** (`REFORM_CUT_OVER_UTC` = 2026-05-12T09:30:00Z, reformConstants.ts:46) as the regime/B8 anchor for the N4.2 CGT/negative-gearing engines.
- **Lineage:** `number.taxPayable` (semanticKey) → `ui.dashboard.tax`. A3 invariant holds (taxPayable traces to calculateTaxPosition).

### Verification
- `npm run neomatrix:check` → **OK** (36 nodes / 38 edges, schema valid, invariants hold, **all 11 engine/orchestrator file:line anchors resolve**, markdown fresh).
- Build gate proven live: the prior preview deploy ran `neomatrix:check` inside `vercel-build` and went **Ready/green**.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` (+13 tax nodes, +12 tax edges; v0.1.0→0.2.0; reformatted pretty-print)
- `docs/financial-logic/graph/GENERATED_CORE.md` (regenerated)
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` (N4.1)

### Next
- N4.2: CGT discount/indexation + negative gearing (reform-gated — exercises the regime layer), then super → land tax/stamp duty/GST → health → CFO → intelligence → reports.

### PR
- Folded into PR #1204 (draft).

---

## Session: neomatrix-N4.2 (reform-gated CGT / negative gearing — regime layer)

### Changes Made
- **Type:** Documentation / model (Neomatrix N4.2). **No financial logic changed.** Every node/edge verified from source this session (§19.2).
- **Why:** prove the **regime / B8 layer** (Phase 41E §12.14) end-to-end — the reform cut-over law node was an anchor in N4.1; N4.2 attaches the reform-gated engines to it and populates the regime axis.

### What was modelled (graph 36→41 nodes / 38→43 edges, all `verified`)
- `calculateCgtDiscount` (cgtDiscount.ts:166) — Div 115 pre-reform 50% discount ↔ Measure 2 post-reform (indexation + 30% floor); default pre-reform until `commencementVerified` (FW-2: no silent post-reform numbers).
- `applyCgtIndexation` (cgtIndexation.ts:87) — post-reform; returns UNCOMPUTED + pre-reform fallback until Royal Assent.
- `applyCgtMinimumRate` (cgtMinimumRate.ts:80) — post-reform 30% floor.
- `deriveNegativeGearingRegime` (negativeGearingRegime.ts:147) — Measure 1 classifier (loss-offset → new builds only post-reform), the single canonical grandfathering decision (FW-1).
- Law node ITAA 1997 Div 115; all four engines `governed-by` the 2026-27 reform cut-over (`REFORM_CUT_OVER_UTC`). `regime: "post-reform"` on the indexation + 30%-floor nodes.

### Verification
- `npm run neomatrix:check` → **OK** (41 nodes / 43 edges; schema valid; invariants hold; all 15 engine/orchestrator file:line anchors resolve; markdown fresh).
- **Regime axis proven sliceable**: `regime=post-reform` → CGT indexation · 30% floor · reform cut-over.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` (+5 nodes, +5 edges; v0.2.0→0.3.0), `GENERATED_CORE.md` (regenerated), `01_ACTIVE_WORKSTREAMS.md`.

### Next
- N4.3: super (contributions/caps/Div 293) → land tax/stamp duty/GST → then health → CFO → intelligence → reports.

### PR — folded into PR #1204 (draft).

---

## Session: neomatrix-N4.3 (super domain) + CLAUDE.md §20.4

### Changes Made
- **Type:** Documentation / model + governance. **No financial logic changed.** Financial build → **self-review 10/10** recorded (§20.4).
- **Reza directives:** (a) "the 3 time review against requirement rule for all your builds … 10/10 for any financial builds" → **CLAUDE.md §20.4** added (3× review applies to every build; any financial build must score 10/10, recorded in the PR/changelog; v2.6→2.7). (b) "continue" → N4.3 super backfill.

### N4.3 — superannuation (graph 41→57 nodes / 43→62 edges, all `verified`, file:line read this session)
- SG: `calculateSuperGuarantee` (contributionCalculator.ts:61) + `calculateSuperContributions` (:115, 15% taxed-in-fund s295-485, tax-saved).
- Caps: `calculateCarryForward` (capTracker.ts:96, s291-20 carry-forward, TSB<500k) + `calculateBringForward` (:148, s292-85 bring-forward).
- High-income/balance: `calculateHighIncomeSuperTax` (highIncomeSuperTax.ts:77, **Div 293** extra 15% s293-15; **Div 296** proposed — gated behind `div296CommencementVerified`, UNCOMPUTED until commenced, FW-2).
- SMSF: `calculateSmsfIncomeTax` (smsfIncomeTax.ts:151, **Div 295** complying-fund 15%; **ECPI** s295-385/390; **NALI** s295-550 at top rate).
- 5 FY-config inputs (SG rate :104 / concessional cap :106 / non-concessional cap :107 / Div293 threshold :108 / 15% rate :109) → `getCurrentTaxYearConfig`; all 6 super engines fed by it (each config-usage verified in source). 5 ITAA law nodes; `governed-by` edges throughout.

### Self-review (§20.4 — 10/10)
- Pass 1 draft → Pass 2 critique (every config→engine edge verified by reading the engine's config usage — not guessed; every governed-by cites an ITAA section read in-source; no tax VALUES in the graph §9; Div 296 FW-2 captured; anchors resolve; no orphan/contradiction) → Pass 3 consistency (no invented UI/orchestrator edges). **Overall 10/10.**

### Verification
- `npm run neomatrix:check` → **OK** (57/62; schema valid; invariants hold; all 21 engine/orchestrator file:line anchors resolve; markdown fresh).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` (+16 nodes/+19 edges; v0.3.0→0.4.0), `GENERATED_CORE.md`, `CLAUDE.md` (§20.4, v2.7), `docs/implementation/01_ACTIVE_WORKSTREAMS.md`.

### Next
- N4.4: land tax / stamp duty / GST → then health → CFO → intelligence → reports.

---

## Session: neomatrix-N4.4 (indirect taxes — land/stamp/GST)

### Changes Made
- **Type:** Documentation / model. **No financial logic changed.** Financial build → **self-review 10/10** (§20.4).
- N4.4 completes the tax domain's indirect taxes (graph 57→64 nodes / 62→70 edges, all `verified`, file:line read this session):
  - `calculateLandTax` (stateLandTax.ts:374) → `calculateCrossStateLandTax` (crossStateAggregator.ts:105, calls calculateLandTax at :136) → orchestrator `buildMasterTaxPosition` (masterTaxPosition.ts:200).
  - `calculateStampDuty` (stateStampDuty.ts:285) → orchestrator (:213).
  - `calculateGst` (gstCalculator.ts:104, s9-70 10% / s23-15 $75k) → orchestrator (:226).
  - Law nodes: state Land Tax Acts, state Duties Acts (+ foreign surcharge), GST Act 1999; `governed-by` edges throughout.
- This wires the orchestrator's cross-cutting modules (land tax / stamp duty / GST) — the tax orchestration picture is now complete.

### Self-review (§20.4) — **10/10**
Every edge verified by source read (crossStateAggregator:136; masterTaxPosition:200/213/226); Acts cited from file headers; GST rate/threshold cite s9-70/s23-15. Anchors resolve; no orphan/contradiction.

### Verification
- `npm run neomatrix:check` → **OK** (64/70; schema valid; invariants hold; all 23 engine/orchestrator file:line anchors resolve; markdown fresh).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` (v0.4.0→0.5.0), `GENERATED_CORE.md`, `01_ACTIVE_WORKSTREAMS.md`.

### Next — N4.5: health engine → CFO → intelligence → reports.

---

## Session: neomatrix-A1 (executable law-referenced audit — first slice)

### Changes Made
- **Type:** Test / model (Phase 53 §14 **A1**). **No financial logic changed.** Financial build → **self-review 10/10** (§20.4).
- **Reza directives (2026-06-23):** "audit as we go so we can make sure the model works, and check Monitrax against it"; "many rules/conditions already built into Monitrax — don't change unless confirmed with me"; "the audit should always follow the 3 reviews and scoresheet rule."

### What was built — A1 makes the model REFEREE the code (not mirror it)
- `tests/neomatrix/financialAudit.test.ts`: for each engine, state the governing **law/formula** (the authority — external to the code), **hand-derive the expected output from that law** (§19.2 step 3), then **run the REAL engine** and assert it equals the law-derived value. Each audited node id must exist in `financial-graph.json` (audit tied to the model).
- **First slice (core engines), 7 cases, 7/7 pass:**
  - `calculateNetWorth` — assets−liabilities (225,000); investment units×avgPrice fallback (5,000); **Phase 39.5 SMSF-exclusion rule** (INDUSTRY counted, SMSF excluded → 100,000).
  - `resolveCanonicalCashflow` — actuals-win + savingsRate=net/inflow×100 (40); declared fallback (37.5); zero-inflow → 0.
- **Result: no `suspected-issue` in this batch** — the core engines agree with the law; the cases are now **law-anchored locks** (CI fails if an engine ever drifts from the law).
- **The contract (per Reza):** a genuine mismatch is NOT committed as a failing assertion — it is raised with Reza (law citation + wrong-vs-right numbers) and the engine is left unchanged (§10/§19). Audited nodes' `verifiedBy` now references the A1 test.

### Self-review (§20.4) — **10/10**
Expected values are law/formula-derived independent of the code; real engines executed (7/7); audit tied to the model; no logic changed; honest scope (core only, tax A1 next).

### Verification
- `./node_modules/.bin/vitest run tests/neomatrix/` → **13/13 pass** (A1 audit 7 + graph audit 6).
- `npm run neomatrix:check` → OK (graph fresh; v0.5.0→0.6.0 marking A1-audited nodes).

### Files
- Added `tests/neomatrix/financialAudit.test.ts`. Modified `financial-graph.json` (verifiedBy + v0.6.0), `GENERATED_CORE.md`, `01_ACTIVE_WORKSTREAMS.md`.

### Next — A1 tax slice (ATO-law-derived expected: income tax brackets, Medicare, Div 293, GST), then health/CFO backfill (each with its A1 audit, audit-as-we-go).

---

## Session: neomatrix-A1-tax (executable ATO-law audit — income tax + Medicare)

### Changes Made
- **Type:** Test + model (Phase 53 §14 A1, tax). **No financial logic changed.** Financial build → **self-review 10/10** (§20.4).
- Models + audits the two core tax engines against the **ATO law** (not the code).

### What was built
- **Graph (v0.6.0→0.7.0, +2 nodes / +6 edges):** `engine.incomeTaxCalculator.calculateIncomeTax` (core/incomeTaxCalculator.ts:21) + `engine.medicareLevyCalculator.calculateMedicareLevy` (core/medicareLevyCalculator.ts:38), fed by the FY-config SSOT, feeding `calculateTaxPosition` (:220/:223), `governed-by` ITAA income-tax / Medicare Levy Act law nodes.
- **A1 tax audit (9 cases, all pass), ATO FY24-25 Stage 3 brackets hand-derived:**
  - Tax-free threshold $18,200 → $0.
  - 16% band: $45,000 → $4,288.
  - **Bracket-boundary regression locks** (the historical $0-at-boundary P0 bug, fixed 2026-06-23): $45,001 → **$4,288.30**, $135,001 → **$31,288.37** (must NOT be $0).
  - 30% band: $100,000 → $20,788. 37% top: $190,000 → $51,638. 45% band: $200,000 → $56,138.
  - Medicare 2% above shade-out: $100,000 → $2,000.
- **Result: no `suspected-issue`** — the income-tax + Medicare engines agree with the ATO law; cases are now law-anchored locks. The P0 bracket-boundary fix is provably protected against regression.

### Self-review (§20.4) — **10/10**
Expected values hand-derived from ATO published rates independent of the code; real engines executed (vitest 15 audit cases); deterministic (explicit FY24-25 config); tied to the model (new nodes asserted present); no logic changed.

### Verification
- `vitest run tests/neomatrix/` → **21/21 pass** (audit 15 + graph 6).
- `npm run neomatrix:check` → OK (66 nodes / 76 edges; fresh).

### Files
- `tests/neomatrix/financialAudit.test.ts` (+9 tax cases), `financial-graph.json` (v0.7.0), `GENERATED_CORE.md`, `01_ACTIVE_WORKSTREAMS.md`.

### Next — A1: Div 293 / super + GST (ATO-law-derived), then health/CFO backfill with their A1 audits.

---

## Session: neomatrix-A1-tax2 (executable ATO-law audit — GST, Div 293, SG)

### Changes Made
- **Type:** Test + model (Phase 53 §14 A1, tax). **No financial logic changed.** Financial build → **self-review 10/10** (§20.4).
- Audits three already-modelled tax engines against the **ATO law** (real engines run).

### A1 cases (7 new, all pass)
- **GST** (`calculateGst`, GST Act s9-70 10%): $1,000 taxable sale → net GST **$100**; sale $1,000 − purchase $500 ITC → net **$50**; GST-free sale → GST collected **$0** (s38).
- **Div 293** (`calculateHighIncomeSuperTax`, ITAA 1997 s293-15 — 15% × lesser of excess-over-$250k and concessional): income $300k / conc $30k → **$4,500**; income $260k / conc $25k → **$1,500**; income $200k (below threshold) → **$0**.
- **Super guarantee** (`calculateSuperGuarantee`, SGAA 1992 11.5% FY24-25 on OTE capped at max base): $100,000 OTE → **$11,500** (locks the 2026-06-23 P1 SG-cap fix against regression).
- **Result: no `suspected-issue`** — all three agree with the law; now law-anchored locks.

### Self-review (§20.4) — **10/10**
Expected values hand-derived from the ATO law (s9-70 / s293-15 / SGAA) independent of the code; real engines executed (vitest 22 audit cases); deterministic (explicit FY24-25 config); tied to the model (`verifiedBy` updated on the 3 nodes); no logic changed.

### Verification
- `vitest run tests/neomatrix/` → **28/28 pass** (audit 22 + graph 6).
- `npm run neomatrix:check` → OK (graph v0.7.0→0.8.0; fresh).

### Files
- `tests/neomatrix/financialAudit.test.ts` (+7 cases), `financial-graph.json` (v0.8.0 verifiedBy), `GENERATED_CORE.md`, `01_ACTIVE_WORKSTREAMS.md`.

### Next — A1: SMSF Div 295 + CGT discount, then the health/CFO backfill (each with its A1 audit).

---

## Session: claudemd — Neomatrix consult-first rule wired into startup + checklists

### Changes Made
- **Type:** Governance (CLAUDE.md). **No code, no financial logic.**
- **Reza directive:** "have you updated claude.md and the instructions to always use NeoMatrix for all future changes and builds?" — Part 21 already mandated the build gate + same-PR graph update + reviewer enforcement; this closes the missing **"consult it FIRST"** half (the referencing side).

### What was added (reinforces Part 21)
- **Part 1 Step 3 (Session Startup):** new item 5 — consult the Neomatrix for the number's lineage/formula/authority BEFORE changing it (model is the reference; the code is audited against it).
- **§12.13 Before-Every-Session checklist:** Neomatrix consult + same-PR update + `neomatrix:check` line; discrepancy → `suspected-issue` raised, never silently fixed.
- **Part 9 Pre-Change checklist:** consult-the-Neomatrix-first line.
- **Part 9 Post-Change checklist:** `neomatrix:check` passes + graph updated/regenerated if a financial engine/number/lineage changed.
- Protocol version note updated (2.7.1 follow-up).

### Files
- `CLAUDE.md` (Part 1 Step 3, §12.13, Part 9 ×2, version footer).
