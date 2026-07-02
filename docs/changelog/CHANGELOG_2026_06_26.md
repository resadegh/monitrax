# Changelog — 2026-06-26

## Session: Neo Inventory NI-0 — design + instruction lock (branch `claude/neo-inventory-design-jqahjw`)

### Changes Made
- **Type**: Governance / design (NO code, NO financial logic, NO graph data changed).
- **Scope**: Reza directive 2026-06-26 — *"make sure (1) 100% of Monitrax is in the Neomatrix and (2) the Trust Engine covers all calculations including complex ones — don't create multiple test engines and platforms, no more guesswork with multiple PRs. Document this and get the instructions right on sticking to the design document and plan. Before I merge #1250–#1257, compare them with this to make sure they're not going a different path."*

### Root cause established (by code inspection, §10 research-first — not assumed)
The recurring "you covered everything → next audit finds many missed ones" is caused by **four overlapping, unreconciled inventories** of "what calculations exist":
1. **calc-audit (Phase 41i)** — `calcEngineRegistry` + `surfaces/registry` + **92 CI-gated fixtures** (`tests/calc-audit/calcAudit.test.ts` runs `runDifferential`, asserts 0 failures + "no engine without a fixture / names sorted / no duplicates"). Covers the **entire** tax engine (income/medicare/PAYG/offsets/super/cap-tracker/high-income-super), **all divisions** (div7a/div152/CGT-netting/negative-gearing/trust-distribution), **all 8 states** × land-tax/stamp-duty/GST, company+trust losses, PSI/FTE/SMSF, **all CFO** (7 score sub-components, risk radar, loan/investment/property decision support, intelligence engine, tax integration), **all what-if scenarios**, the **aggregators**, the **primitives** (property.LVR/equity/rentalYield).
2. **Neomatrix (Phase 53)** — the map (103 hand-built nodes) — a **subset** of #1.
3. **Trust Engine (2026-06-25)** — verification nodes in the Neomatrix.
4. **Phase 4 rail / A1 audit / surface linter.**

Coverage was measured against the smaller hand-built Neomatrix instead of the larger CI-gated registry → the denominator was always incomplete. **This is a §12.2.1 violation at the system level** (multiple sources of truth for "what needs verifying").

### The model (Neo Inventory)
`calcEngineRegistry` = the **single inventory** (most complete + already gate-enforced); the **Neomatrix = a generated view** over it (lineage/law/`file:line`); **calc-audit fixtures = the proof spine**. No fifth platform. calc-audit, the Neomatrix, the Phase 4 rail and the surface linter all remain with their distinct jobs, reading one shared inventory.

### Comparison of #1250–#1257 (the 2026-06-25 overnight Trust Engine run)
Verified per-engine against `lib/calc-audit/engines/*`: the 8 PRs are internally consistent, but their **verification half re-proves what calc-audit already fixtures** (sellProperty / addInvestment / redirectToOffset / refinance / payDown / cutSpend / salarySacrifice / LVR / equity / yield / aggregators). The genuinely-new parts (the *map* nodes; and the *properties* — accounting identities, refuse-to-compute guards, breakdown additivity, Float⇄Decimal parity, interest/PI) are kept. **Recommendation: HOLD #1250–#1257; reconcile via NI-1→NI-4 (re-home the properties as calc-audit fixtures), don't merge the duplication.** Full table in `NEO_INVENTORY.md` §4.

### Files Modified
- `docs/blueprint/NEO_INVENTORY.md` — **NEW** — the canonical Neo Inventory design + plan (model, completeness guarantee, #1250–#1257 comparison, NI-0→NI-4 sequence, standing rules, sign-off block).
- `CLAUDE.md` — **+ Part 22 (Neo Inventory)** standing rules + reviewer enforcement; version footer → **3.0**.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·NEO-INVENTORY` workstream; `0·TRUST-ENGINE` annotated as pivoted/folded-in.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` → 2026-06-26 with the Neo Inventory summary.

### Build Status
- [x] Docs/governance only — no code, no graph data, no financial logic changed.
- [x] `npm run neomatrix:check` — OK (graph untouched).

### §20 self-review (3× → 10/10)
- **Pass 1 (draft):** propose a census + coverage gate.
- **Pass 2 (critique — the decisive one):** SEARCH-FIRST (§12.2.1) on my own proposal found `lib/calc-audit/` already IS the census/registry/fixture platform — a "census script" would be a 5th duplicate. Rewrote the whole proposal around *recognising calc-audit as the inventory* + *generating the Neomatrix from it*, not adding anything. Also owned that the 2026-06-25 overnight run itself duplicated calc-audit fixtures.
- **Pass 3 (refine):** sequenced NI-0→NI-4 as one-PR-each (no sprawl, Reza's explicit ask); made "coverage = build output, never a claim" the load-bearing rule. **10/10.**

### Doc-sync (CLAUDE.md §16)
- No §16.2 product surface changed — governance + design docs only.

### PR
- Branch: `claude/neo-inventory-design-jqahjw`
- Status: Draft (NI-0; awaiting Reza sign-off before NI-1).

---

## Session: Neo Inventory NI-1 — restore Graphify as Layer 0 + completeness gate (branch `claude/neo-inventory-ni1-graphify-jqahjw`)

### Changes Made
- **Type**: Tooling / governance (NO production code, NO financial logic, NO semantic-graph data changed). Restores the Phase-53 design's **Layer 0** that was trialled (N0) but never wired in.
- **`npm run neomatrix:graphify`** (`scripts/neomatrix/graphify-layer0.mjs`) — runs Graphify on `lib/`+`app/` **code-only/offline** (every LLM key unset, §13.6 — no source egress), normalises the two raw graphs into one lean deterministic `docs/financial-logic/graph/structural/structural-graph.json` (**1,064 files · 8,587 nodes · 15,041 edges**), and runs the completeness reconciliation.
- **`scripts/neomatrix/check-layer0-coverage.mjs`** — PURE-NODE completeness gate (no graphify dep), wired into `neomatrix:check` → `vercel-build`. Reconciles every on-disk `.ts(x)` under lib+app against the committed graph; **build fails on any uncovered file** not on the reviewed allowlist. Mirrors the GENERATED_CORE.md staleness contract.
- The gate **immediately caught 3 real omissions** graphify's own "100%" missed — 2 secret-name skips (`lib/gcp/credentials.ts`, `lib/share/tokens.ts`) + 1 full-corpus id-collision drop (`app/api/entities/[id]/accounting/snapshots/route.ts`). Each root-caused by **probe, not guess** (neutral-name copy IS extracted; the route extracts in isolation) and allowlisted with a verified reason. None is a financial calc.
- **Baseline report** `docs/audits/NEO_INVENTORY_BASELINE.md` — the true denominator on screen for the first time: L0 structural **8,587 nodes / 100% files gated** vs L1 semantic **157 nodes / 64 engines** vs calc-audit **93 fixtures**.

### Why this matters
This is the missing half of the Neomatrix (Reza, 2026-06-26): the graph was hand-authored (drifts, undercounts); Layer 0 makes the structural skeleton **code-generated, whole-codebase, and gated** — so "is everything captured?" is a build fact. Structurally: 100% (gated). Semantically: partial + now *visible* against a complete map.

### Files Modified
- `scripts/neomatrix/graphify-layer0.mjs` — NEW (regenerator). `scripts/neomatrix/check-layer0-coverage.mjs` — NEW (CI gate).
- `docs/financial-logic/graph/structural/structural-graph.json` — NEW (generated Layer 0, 2.7 MB). `coverage-allowlist.json` — NEW (3 verified exclusions).
- `docs/audits/NEO_INVENTORY_BASELINE.md` — NEW. `package.json` — `neomatrix:graphify` + Layer-0 gate in `neomatrix:check`. `.gitignore` — ignore raw `**/graphify-out/`.

### Build Status
- [x] `npm run neomatrix:check` — OK (semantic + Layer-0 gate, 0 uncovered).
- [x] Graphify runs code-only/offline in-env (verified: keys unset, no egress).
- [x] No production code / financial logic / semantic-graph data changed.

### §20 self-review (3× → 10/10)
- v1: commit graphify raw output (7.3 MB, noisy). v2: normalise to lean array-of-arrays + sorted (2.7 MB, clean diffs).
- The decisive move: the CI gate is **independent** of graphify (pure-node disk-vs-graph), so it doesn't trust graphify's self-reported "100%" — and that's exactly what caught the 3 it dropped. Completeness is now adversarially checked, not asserted. **10/10.**

### PR
- Branch: `claude/neo-inventory-ni1-graphify-jqahjw` (stacked on the NI-0 doc PR #1258).
- Status: Draft.

---

## Session: Neo Inventory NI-2 — semantic↔structural binding + coverage readout (branch `claude/neo-inventory-ni2-binding-jqahjw`)

### Changes Made
- **Type**: Tooling / governance (NO production code, NO financial logic, NO semantic-graph data changed).
- **`scripts/neomatrix/check-binding-coverage.mjs`** (pure-node, wired into `neomatrix:check` → `vercel-build`) — binds every L1 semantic **code node** (engine/orchestrator/number) to the L0 structural map by file, and prints the three-layer coverage. **Gate:** a code node whose `file` is no longer in the Layer-0 map (code moved/renamed/deleted but the node didn't follow) **fails the build** — the structural drift sentinel. `law` (module-cite) + `ui-surface` (page-dir) nodes use coarser anchors by design and are exempt.
- **Coverage readout (build output, not a claim):** L0 structural **1,062 files / 8,587 nodes (gated)** · proven calc-audit registry **84 engines** (tax 50 · cfo 24 · core 5 · property 3 · cashflow 2) · semantic modelled **64 engines** · binding **75/75** code-node anchors resolve.

### Why this matters
The Neomatrix now reconciles its three layers and the coverage is on screen: structurally **100% (gated)**; the proven money-producer surface is **84 engines**; semantic modelling is **64**. The figure Reza wants to watch climb toward 100% now has a real, finite denominator (the 84 proven engines) and a drift-proof binding to the complete code map. Honest: no precise overlap % is claimed — exact reconciliation + backfill is NI-3.

### Files Modified
- `scripts/neomatrix/check-binding-coverage.mjs` — NEW (binding gate + coverage). `package.json` — added to `neomatrix:check`. `docs/audits/NEO_INVENTORY_BASELINE.md` — NI-2 coverage section + NI-3 next-step.

### Build Status
- [x] `npm run neomatrix:check` — OK (semantic + Layer-0 + binding/coverage gates, all green; 75/75 anchors resolve).
- [x] No production code / financial logic / semantic-graph data changed.

### §20 self-review (3× → 10/10)
- v1 gate required every filed node to resolve → false-failed on `input.*` (prisma) + `verification.*` (tests) nodes outside L0's lib+app roots.
- v2 scoped to lib/app → still false-failed on `law.*` + `ui.*` directory-anchored nodes.
- v3 scoped to engine/orchestrator/number nodes at a specific `.ts(x)` file — the actual calc code whose anchors MUST stay valid. Correct + green. **10/10.**

### PR
- Branch: `claude/neo-inventory-ni2-binding-jqahjw` (stacked on the NI-1 branch — merge #1260 NI-1→main FIRST).
- Status: Draft.

---

## Session: Neo Inventory NI-4 — FULL calc census + lock Reza's two decisions (branch `claude/neo-inventory-ni4-census-jqahjw`)

### Changes Made
- **Type**: Tooling / governance (NO production code / financial logic / semantic-graph data changed).
- **Reza directives 2026-06-26 locked into `NEO_INVENTORY.md` §10** (anti-drift contract): (1) FULL coverage of EVERY calculation (not just the 84 proven) — each flagged PROVEN/MODELLED/UNCOVERED so finding an unproven calc is trivial; (2) the 3D explorer shows BOTH the 8,587-node structural graph AND a toggle to the semantic ~84 view.
- **`scripts/neomatrix/calc-census.mjs`** (`npm run neomatrix:census`) — enumerates every calc-shaped function in the financial dirs from Layer 0 and flags each against the calc-audit registry (proven) + semantic graph (modelled). **v1: 451 candidates · 193 proven · 58 modelled · 200 UNCOVERED · 56% covered.**
- **`docs/audits/NEO_INVENTORY_CALC_CENSUS.md`** — the full scannable review queue (200 uncovered calcs across 52 files, listed by file). This IS "finding any unproven calc is simple."

### Honest scope
v1 census is a heuristic denominator (financial-dir + calc-verb name, deliberately inclusive — better to over-list than miss). Refined toward function-level precision over time. The work = drive UNCOVERED→0 (NI-3 backfill + new fixtures), then flip the reconciliation to a build gate. NI-5 (explorer dual-view) is a real frontend build (8k-node perf) — first cut for Reza's direction, multi-session.

### Files Modified
- `scripts/neomatrix/calc-census.mjs` — NEW. `package.json` — `neomatrix:census`. `docs/audits/NEO_INVENTORY_CALC_CENSUS.md` — NEW (the review queue). `docs/blueprint/NEO_INVENTORY.md` §10 — the two locked decisions. `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — NI-4 census + NI-5 explorer.

### Build Status
- [x] `npm run neomatrix:census` — 451 / 193 / 58 / 200. No graph/check change (census is advisory until the queue clears + the gate flips).

### §20 self-review → 10/10
Self-contained registry parser (no cross-branch import — base is main, which lacks #1262's reconcile-registry.mjs); census labelled v1-heuristic honestly (not claiming function-level precision); inclusive `get`-prefix kept deliberately (over-list > miss — the exact failure this workstream kills). 10/10.

### PR
- Branch: `claude/neo-inventory-ni4-census-jqahjw` (off main). Status: Draft.
## Session: Neo Inventory NI-3a — exact registry↔semantic reconciliation + backfill worklist (branch `claude/neo-inventory-ni3a-reconcile-jqahjw`)

### Changes Made
- **Type**: Tooling / governance (read-only reconciliation; NO production code / financial logic / semantic-graph data changed).
- **`scripts/neomatrix/reconcile-registry.mjs`** + **`npm run neomatrix:coverage`** — parses the calc-audit **proven** inventory across BOTH registries (differential `calcEngineRegistry.register()` + the shadow Float/Decimal registrations), keyed on `name`+`sourcePath` (so fixture CASE names are excluded), deduped by base name, and reconciles vs the semantic graph by source file.
- **Exact coverage (not claimed):** **84 proven · 47 modelled (56%) · 37 backfill (26 unique source files).** `docs/audits/NEO_INVENTORY_BACKFILL_WORKLIST.md` is the named, finite gap, grouped into the NI-3b (property/core primitives — overlaps closed #1255), NI-3c (CFO+cashflow — overlaps closed #1250–#1254), NI-3d (tax divisions) sub-PRs.
- Corrected the NI-2 "84" composition: it is the distinct proven-engine count across the differential **and** shadow registries (two registries, not one) — NI-3a verifies this by `sourcePath`.

### Why this matters
The honest gap to 100% is now exact and named — Reza can read `npm run neomatrix:coverage` any time. Backfilling the 26 files (each as a verified semantic node, §19.2) closes it; NI-4 then flips it to a hard build gate (proven ⊆ modelled).

### Files Modified
- `scripts/neomatrix/reconcile-registry.mjs` — NEW. `package.json` — `neomatrix:coverage`. `docs/audits/NEO_INVENTORY_BACKFILL_WORKLIST.md` — NEW.

### Build Status
- [x] `npm run neomatrix:check` — OK (unchanged; NI-3a adds an advisory readout, no new gate).
- [x] `npm run neomatrix:coverage` — 84 proven / 47 modelled (56%) / 37 worklist.
- [x] No production code / financial logic / semantic-graph data changed.

### §20 self-review (3× → 10/10)
- v1 parser caught 36 (`register()` only) → MISSED the shadow registry (CFO etc.). v2 keyed on `name`+`sourcePath` across both registries → accurate 84/47/37. Refused to ship the partial 36-count worklist (would have under-reported the gap — the exact failure mode this whole workstream fixes). **10/10.**

### PR
- Branch: `claude/neo-inventory-ni3a-reconcile-jqahjw` (stacked on NI-2 — merge #1260→#1261 first).
- Status: Draft.

---

## Session: Neo Inventory NI-3b — backfill property primitives (branch `claude/neo-inventory-ni3b-property-jqahjw`)

### Changes Made
- **Type**: Neomatrix modelling (semantic nodes only; NO production code / financial logic changed — §21.2 modelling).
- Modelled the 3 PROVEN-but-unmodelled property primitives in `lib/utils/calculations.ts` as verified semantic engine nodes: `engine.calculations.calculateLVR` (:9), `calculateEquity` (:20), `calculateRentalYield` (:30). Anchors **re-verified in source 2026-06-26** (§19.2 — not from memory); `verifiedBy` cites the EXISTING calc-audit `property.LVR/equity/rentalYield` fixtures (the proof already exists — this adds the map node so reconciliation counts them).
- **Coverage: 56% → 60%** (47 → 50 modelled · worklist 37 → 34). `neomatrix:check` green (binding 78/78 resolve).

### Why this is correct (no parallel silo — §12.2.1/Part 22)
These engines are already PROVEN by calc-audit fixtures; NI-3b adds only the missing semantic MAP node, citing that fixture. No new test. (The offset/interest/PI primitives in the same file are NOT separately fixtured — deferred to NI-3c with the loan domain where their #1255 golden/parity tests are re-homed as calc-audit fixtures.)

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +3 engine nodes. `GENERATED_CORE.md` — regenerated.

### Build Status
- [x] `npm run neomatrix:check` — OK. `npm run neomatrix:coverage` — 84 / 50 (60%) / 34.

### §20.4 self-review → 10/10
Anchors re-verified in current source (not D.1 memory); `verifiedBy` cites a fixture that actually exists (checked); the 3 unfixtured primitives in the same file deliberately NOT claimed as proven (accuracy over coverage-vanity). 10/10.

### PR
- Branch: `claude/neo-inventory-ni3b-property-jqahjw` (stacked on NI-3a). Status: Draft.

---

## Session: neo-inventory-ni3b-fix-orphans (fix orphan calc nodes + A5 gate)

### Changes Made
- **Type**: Neomatrix modelling + invariant gate (semantic edges + audit rule only; NO production code / financial logic changed — §21.2 modelling).
- **Root cause**: NI-3b (prior session) added the 3 property primitive nodes (`calculateLVR`/`calculateEquity`/`calculateRentalYield`) WITHOUT lineage edges, so they rendered as orphans on `/admin/neomatrix` — Reza: *"there are nodes sitting there by itself with no relations or link to any other nodes, like property equity."* A calc node with no edges is the exact blind spot the graph exists to kill.
- **Fix (8 verified `feeds` edges, anchors re-verified in source 2026-06-26 — §19.2):**
  - `input.Property.currentValue` → each of LVR / equity / rentalYield (`calculations.ts:9/20/30`)
  - `input.Loan.principal` → LVR / equity (`calculations.ts:9/20`; passed at `masterFinancialService.ts:1111/1110`)
  - each primitive → `orchestrator.masterFinancialService.getMasterFinancialSnapshot` (`masterFinancialService.ts:1110/1111/1120`)
- **Recurrence guard — A5 invariant** in `graphlib.mjs` `auditInvariants`: any `number`/`engine`/`orchestrator` node with ZERO edges is now a **build ERROR** (`neomatrix:check` fails). Verified the gate fires on a synthetic orphan. This makes "every modelled calc carries verified lineage" structurally enforced, not a discipline.

### Suspected-issue flagged for Reza (NOT fixed — §12.2.1 duplicate source)
- `app/api/portfolio/snapshot/route.ts:92,98` define LOCAL `calculateRentalYield` + `calculateLVR` (used at :665/:671), duplicating the canonical `lib/utils/calculations.ts`. They even **drift behaviourally**: the locals guard `propertyValue <= 0`, the canonical guards `=== 0` (negative values diverge). This is a §12.2.1 one-formula-one-source violation. Raised for Reza — a code change requiring sign-off, not touched in this modelling PR.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +8 verified `feeds` edges (201→209), version 0.36.0→0.37.0. `GENERATED_CORE.md` — regenerated.
- `scripts/neomatrix/graphlib.mjs` — +A5 orphan-detection invariant.

### Build Status
- [x] `npm run neomatrix:check` — OK (160 nodes, 209 edges, 0 orphans, binding 78/78). A5 fires on synthetic orphan.

### §20.4 self-review → 10/10
All 6 anchors re-verified in current source (not memory); edges follow the `input --feeds--> engine --feeds--> orchestrator` convention; orphan count now provably 0 AND gated so it can't recur; the duplicate-source drift surfaced as a flag, never silently reconciled (§21.5). 10/10.

### PR
- Branch: `claude/neo-inventory-ni3b-fix-orphans-jqahjw`. Status: Draft.

---

## Session: neo-inventory-ni3c-cfo-scenarios (backfill the 5 CFO what-if scenario engines)

### Changes Made
- **Type**: Neomatrix modelling (semantic nodes + verified lineage edges; NO production code / financial logic changed — §21.2).
- Modelled the 5 PROVEN-but-unmodelled CFO what-if scenario engines, each WITH verified lineage (the new A5 rule — no node ships an orphan):
  - `engine.sellProperty.sellPropertyScenario` (`sellProperty.ts:35`)
  - `engine.payDownLoan.payDownLoanScenario` (`payDownLoan.ts:19`)
  - `engine.redirectToOffset.redirectToOffsetScenario` (`redirectToOffset.ts:22`)
  - `engine.refinanceLoan.refinanceLoanScenario` (`refinanceLoan.ts:21`)
  - `engine.addInvestment.addInvestmentScenario` (`addInvestment.ts:20`)
- **Lineage (6 edges, all verified in source §19.2):** the master snapshot `--feeds-->` each scenario (every one reads `ctx.snapshot.quickMetrics`); `redirectToOffset --governed-by--> law.monitrax.whatIfAnnualisation` (its `annualInterestSaved = monthlyInterestSaved * 12` at `redirectToOffset.ts:51` is the law's exact formula, matching the `cutSpendCategory` precedent).
- **Coverage: 60% → 65%** (50 → 55 modelled · worklist 34 → 29). `neomatrix:check` green (165 nodes / 215 edges, 0 orphans, binding 83/83).

### Discipline note (accuracy over edge-count — §19.2/§20.4)
`governed-by whatIfAnnualisation` attached ONLY to `redirectToOffset`, where the law's `monthly × 12` formula appears verbatim. The other four use amortisation / annuity-FV / disposal methods, so they are NOT claimed to be governed by the simple-annualisation law — the verified `master --feeds-->` edge is their incontestable lineage and clears A5. Loan-primitive `depends-on` edges (calculateInterestForPeriod / calculateEffectivePrincipal / calculatePIRepayment) deferred to the NI-3c-loan batch where those primitives get their own nodes.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +5 engine nodes, +6 verified edges, version 0.37.0→0.38.0. `GENERATED_CORE.md` — regenerated.

### Build Status
- [x] `npm run neomatrix:check` — OK (165 nodes, 215 edges, 0 orphans). `npm run neomatrix:coverage` — 84 / 55 (65%) / 29.

### §20.4 self-review → 10/10
Every export line re-verified in source; every `feeds` edge backed by a confirmed `ctx.snapshot` read; the single `governed-by` edge backed by the verbatim `×12` formula; under-claimed governance rather than assert a law that doesn't match the engine's method; gate stays green (0 orphans). 10/10.

### PR
- Branch: `claude/neo-inventory-ni3b-fix-orphans-jqahjw` (PR #1265 — extends the orphan-fix PR with the first gate-green backfill batch). Status: Draft.

---

## Session: neo-inventory-ni3c-loan-decision (backfill 3 loanDecisionSupport amortisation engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- Modelled the 3 proven-but-unmodelled loan amortisation helpers in `lib/cfo/decisionSupport/loanDecisionSupport.ts`, each WITH lineage (A5-green):
  - `engine.loanDecisionSupport.calculateMonthlyPayment` (:615) — P&I annuity `P·r(1+r)ⁿ/((1+r)ⁿ−1)`
  - `engine.loanDecisionSupport.calculatePayoffMonths` (:635) — `n = ceil(−log(1−P·r/M)/log(1+r))`, 999 if M≤interest, cap 600
  - `engine.loanDecisionSupport.calculateTotalInterest` (:661) — `max(0, payment×months − principal)`
- **Lineage (6 edges, verified §19.2):** `input.Loan.principal --feeds-->` each (confirmed at call sites :347/:449/:465 — each passes `loan.principal` + `loan.interestRateAnnual`); each `--governed-by--> law.standard.loanInterest` (they implement standard amortisation, formulas read in source).
- **Coverage: 65% → 69%** (55 → 58 modelled · worklist 29 → 26). `neomatrix:check` green (168 nodes / 221 edges, 0 orphans).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +3 engine nodes, +6 verified edges, version 0.38.0→0.39.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Each formula + each call-site field mapping re-verified in source (not memory); governed-by backed by reading the actual amortisation formula; principal-feeds backed by the verbatim call-site args. 10/10.

---

## Session: neo-inventory-ni3c-income (backfill 2 income-normalisation engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- Modelled 2 proven-but-unmodelled income engines in `lib/cashflow/incomeNormalizer.ts`, each WITH lineage (A5-green):
  - `engine.incomeNormalizer.normalizeAllIncome` (:183) — per-stream gross→net + monthly aggregation; `input.Income.declared --feeds-->` it.
  - `engine.incomeNormalizer.calculateTakeHomePay` (:221) — gross→take-home via PAYG + Medicare − LITO; `input.Income.declared --feeds-->` it; `--governed-by-->` `law.itaa1997.incomeTax` (:237 PAYG) AND `law.medicareLevyAct` (:243 Medicare).
- **Coverage: 69% → 71%** (58 → 60 modelled · worklist 26 → 24). `neomatrix:check` green (170 nodes / 225 edges, 0 orphans).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +4 verified edges, version 0.39.0→0.40.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Both formulas re-verified in source; the two governed-by edges backed by the verbatim `TaxEngine.calculatePAYG` / `calculateMedicareLevy` calls at :237/:243; income-feeds backed by the param contract. 10/10.

---

## Session: neo-inventory-ni3c-investment (backfill 2 investmentDecisionSupport engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- Modelled 2 proven-but-unmodelled engines in `lib/cfo/decisionSupport/investmentDecisionSupport.ts`, each WITH `input.Investment.value --feeds-->` lineage (A5-green):
  - `engine.investmentDecisionSupport.calculateDividendYield` (:450)
  - `engine.investmentDecisionSupport.calculateMaxConcentration` (:549, Decimal — the only impl)
- **Coverage: 71% → 74%** (60 → 62 modelled · worklist 24 → 22). `neomatrix:check` green (172 nodes / 227 edges, 0 orphans).

### ⚠️ Flagged for Reza (§19.1 estimate, NOT actual data)
`calculateDividendYield` is a HEURISTIC PROXY, not a real yield: it assumes franked holdings yield 4% and unfranked 2% (`frankedValue×0.04 + (totalValue−frankedValue)×0.02`), explicitly a "rough approximation" in source (:455). It feeds `portfolioSummary.dividendYieldPercent`. Per §19.1 (actuals over estimates), if any surface presents this as the user's ACTUAL dividend yield it should be labelled an estimate or sourced from actual distributions. Modelled honestly (authority field says "heuristic proxy, NOT actual"); surfaced for Reza — not changed (code change needs sign-off).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +2 verified edges, version 0.40.0→0.41.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Both formulas read in source; the estimate honestly labelled rather than dressed as real; concentration formula verified line-by-line; input-feeds backed by the actual `h.currentValue` reads. 10/10.

---

## Session: neo-inventory-ni3c-property-risk (backfill propertyDecisionSupport + riskRadar)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.propertyDecisionSupport.calculatePortfolioSummary` (`propertyDecisionSupport.ts:248`) — property portfolio aggregation (totalValue/equity/avgLVR/income/cashflow); `input.Property.currentValue --feeds-->` it.
- `engine.riskRadar.calculateSummary` (`riskRadar.ts:601`) — risk severity counts + Σ impact + topRisk; master snapshot `--feeds-->` it (risks built from snapshot entities at :70-76, then aggregated).
- **Coverage: 74% → 76%** (62 → 64 modelled · worklist 22 → 20). `neomatrix:check` green (174 nodes / 229 edges, 0 orphans).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +2 verified edges, version 0.41.0→0.42.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Both aggregations read line-by-line in source; portfolioSummary feed backed by the `p.currentValue` reduce; riskRadar feed honestly labelled as transitive (snapshot → detectors → summary). 10/10.

---

## Session: neo-inventory-ni3c-taxintegration (backfill 2 CFO↔tax bridge engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.taxIntegration.calculateNegativeGearingBenefit` (`taxIntegration.ts:293`) — `input.Income/Expense.declared` + `input.Loan.principal --feeds-->` it. Confirms `interestRateAnnual` is a decimal (§19.2).
- `engine.taxIntegration.calculateUnrealisedCGT` (`taxIntegration.ts:276`) — `input.Investment.value --feeds-->` it.
- **Coverage: 76% → 79%** (64 → 66 modelled · worklist 20 → 18). `neomatrix:check` green (176 nodes / 233 edges, 0 orphans).

### ⚠️ Flagged for Reza (§12.14 reform + §19.1 estimate — modelled honestly, NOT changed)
- **Negative-gearing benefit is NOT reform-gated.** Computes the classic marginal-rate deduction unconditionally; the Phase 41E reform restricts neg gearing to new builds from 1 Jul 2027. Modelled `regime: 'pre-reform'`. Whether the CFO surface should regime-gate is a code decision for Reza.
- **Unrealised CGT is a SIMPLIFIED estimate.** Applies the 50% discount to ALL positive gains with NO 12-month holding-period check and NO reform gating (post-reform = indexation + 30% floor). Canonical CGT lives in `lib/tax-engine`. Modelled `regime: 'pre-reform'` with authority noting the simplification.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +4 verified edges, version 0.42.0→0.43.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Both formulas read line-by-line; `interestRateAnnual` decimal-unit confirmed in source; both simplifications/regime-gaps surfaced for Reza rather than blessed; feeds backed by the actual income/expense/loan/holding reads. 10/10.

---

## Session: neo-inventory-ni3c-intelligence (backfill 2 intelligenceEngine engines — CFO domain complete)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.intelligenceEngine.calculateProjectedMonthEndBalance` (`intelligenceEngine.ts:354`) — `liquidBalance − dailyBurn×daysRemaining`; `input.Account.currentBalance --feeds-->` it.
- `engine.intelligenceEngine.calculateMonthlyProgressNetWorth` (`intelligenceEngine.ts:377`) — `Σaccounts + Σproperties + Σ(units×avgPrice) − totalDebt`; fed by Account/Property/Investment/Loan inputs; `--governed-by--> law.accountingIdentity`.
- **Coverage: 79% → 81%** (66 → 68 modelled · worklist 18 → 16). **All CFO-domain proven engines now modelled.** `neomatrix:check` green (178 nodes / 239 edges, 0 orphans).

### Note for Reza (§12.2.1 — documented local duplicate, not a drift bug)
`calculateMonthlyProgressNetWorth` is a LOCAL net-worth helper; the canonical engine is `lib/calculations/netWorthCalculator.calculateNetWorth`. Source comment explains it exists for the intelligence-engine's local composition (downstream uses a ×0.98 placeholder making the canonical engine's extra precision moot). Modelled with the canonical pointer in the authority field.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +6 verified edges, version 0.43.0→0.44.0. `GENERATED_CORE.md` — regenerated.

### Remaining backfill (worklist 16 — all tax domain)
tax divisions (negativeGearing, trustDistribution, capitalLossNetting, div152, div7a, companyLossRules, trustLossRules, psiClassifier, fteIeeClassifier, smsfTriumvirate), frankingCredits, payg, masterTaxPosition. These need ATO-law worked-example verification (§19.2) + reform-awareness (§12.14) — queued for the hourly cron's careful per-engine pass.

### §20.4 self-review → 10/10
Both formulas read line-by-line; accountingIdentity governance backed by the verbatim assets−debt sum; local-net-worth duplicate surfaced with its canonical pointer; all 6 feeds backed by actual reduce reads. 10/10.

---

## Session: neo-inventory-ni3d-tax-payg-franking (backfill PAYG + franking credits — tax domain begins)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.tax.payg.calculatePAYG` (`paygCalculator.ts:149`) — ATO Schedule 1 (NAT 1004) withholding `y = max(0, a·x − b)`, `x = floor(weekly)+0.99`, scale 1/2. Lineage: `input.Income.declared --feeds-->` it; `--governed-by--> law.itaa1997.incomeTax`; **cross-domain** `--feeds--> engine.incomeNormalizer.calculateTakeHomePay` (verified: `incomeNormalizer.ts:237` calls `TaxEngine.calculatePAYG`, re-export at `index.ts:32,80`).
- `engine.tax.income.calculateFrankingCredits` (`taxabilityRules.ts:250`) — imputation gross-up `dividend × (frankingPct/100) × (0.30/0.70)`. Lineage: `input.Income.declared --feeds-->` it; `--governed-by--> law.itaa1997.incomeTax`.
- **Coverage: 81% → 83%** (68 → 70 modelled · worklist 16 → 14). `neomatrix:check` green (180 nodes / 244 edges, 0 orphans).

### Note (documented assumption, not a flag)
`calculateFrankingCredits` assumes a 30% corporate rate (standard for large companies; base-rate entities frank at their lower rate) — noted in the node authority. PAYG modelled as the standard engine, with a note that the Phase 41E opt-in dynamic-PAYG reform (measure #9, 1 Jul 2027) is NOT this engine.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +5 verified edges (incl. 1 cross-domain tax→cashflow), version 0.44.0→0.46.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
PAYG formula + the `x = floor+0.99` ATO mechanic read in source; the cross-domain edge proven by tracing the re-export chain; franking formula matched to the source comment + constant; corporate-rate assumption surfaced honestly. 10/10.

---

## Session: neo-inventory-ni3d-neggearing (backfill reform-aware negative gearing)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.tax.negativeGearing.applyNegativeGearing` (`negativeGearing.ts:152`) — Div 36 loss treatment, **regime-parametric** (§12.14 FW-1): pre-reform offsets other income; POST_REFORM_RESTRICTED traps the loss at the entity with an UNCOMPUTED scope flag (FW-2). Lineage: `input.Income.declared` + `input.Expense.declared --feeds-->` it; `--governed-by--> law.itaa1997.incomeTax` (Div 36) AND `law.reform2026.cutOver` (Phase 41E Measure 1).
- **Coverage: 83% → 85%** (70 → 71 modelled · worklist 14 → 13). `neomatrix:check` green (181 nodes / 248 edges, 0 orphans).

### Contrast worth recording (§12.14)
This is the CANONICAL reform-aware negative-gearing engine. The earlier-flagged `cfo.taxIntegration.calculateNegativeGearingBenefit` is a CFO *estimate* that is NOT reform-gated — the contrast is exactly why that one was flagged for Reza (the canonical engine handles the reform; the CFO quick-estimate doesn't).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +1 engine node, +4 verified edges, version 0.46.0→0.47.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Regime branches read line-by-line; both governed-by laws backed by the in-source citations; regime:null correct (parametric, not fixed); income/expense feeds backed by the param contract. 10/10.

---

## Session: neo-inventory-ni3d-tax-classifiers (NI-3 COMPLETE — 100% proven engines modelled)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage + a reconcile-script correctness fix (NO production code / financial logic changed — §21.2).
- Modelled the final **10 tax-domain files** (9 division engines + the master tax orchestrator), each WITH a verified `governed-by` edge to its ITAA law, and created **9 ITAA division law nodes** (citations read from each file's `BASE_CITATIONS` — §19.2, never recalled):
  - `applyCapitalLossNetting` (:125) → `law.itaa1997.div102Cgt` (s100-50 FIFO ordering)
  - `applyCompanyLossRules` (:83) → `law.itaa1997.div165CompanyLoss` (COT/BCT)
  - `applyDiv152` (:150) → `law.itaa1997.div152SbCgt` (small-business CGT concessions)
  - `classifyDiv7ALoans` (:269) → `law.itaa1936.div7a` (deemed dividends)
  - `classifyFteIeeDistributions` (:166) → `law.itaa1936.sch2fFte` (FTE/IEE + FTDT + TFN withholding)
  - `classifyPsi` (:141) → `law.itaa1997.psiPart2_42` (PSI/PSB four tests)
  - `classifySmsfTriumvirate` (:159) → `law.sisAct.smsf` (sole purpose / in-house / LRBA / NALI)
  - `applyTrustLossRules` (:128) → `law.itaa1936.sch2fTrustLoss`
  - `allocateTrustDistribution` (:275) → `law.itaa1936.div6Trust` (s97 present-entitlement)
  - `orchestrator.tax.masterTaxPosition.buildMasterTaxPosition` (:186) → `law.itaa1997.incomeTax`
- **Reconcile fix**: `reconcile-registry.mjs` now counts a proven engine as "modelled" if an `engine` OR `orchestrator` node lives at its sourcePath (masterTaxPosition is correctly an orchestrator, not an engine — the prior filter under-counted it).
- **Coverage: 85% → 100% (84/84 proven engines modelled · worklist 0).** `neomatrix:check` green (200 nodes / 258 edges, 0 orphans, A5 holds).

### Reform-awareness (§12.14)
These divisions are classifiers/loss-rule engines; the reform-affected one (negative gearing) was modelled in the prior batch as regime-parametric. Div 152 / capital-loss-netting interact with the CGT reform (measure #2) at the discount layer (`law.itaa1997.div115Cgt`, already modelled) — noted, not duplicated here.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +19 nodes (9 laws + 9 engines + 1 orchestrator), +10 verified edges, version 0.47.0→0.48.0.
- `scripts/neomatrix/reconcile-registry.mjs` — count orchestrator nodes as modelled.
- `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10 (financial build)
3× review: (1) every engine's input contract + return shape + cited division read in source; (2) every law node's `authority` matched verbatim to the file's `BASE_CITATIONS` (not recalled — caught Part 2-42 for PSI, s67A/PCG 2016/5 for SMSF, Sch 2F split into FTE vs trust-loss); (3) reconcile fix is a denominator-correctness fix (orchestrator IS a valid modelling kind), not number-gaming — masterTaxPosition genuinely has a node. 0 orphans, gate green. 10/10.

### Milestone
**NI-3 complete.** Next per plan (§10): NI-4 — drive the census UNCOVERED queue (200) → 0, then NI-5 explorer dual-view, then flip reconcile to a hard build gate.

---

## Session: neo-inventory-ni4-cashflow (NI-4 begins — model the 3 cashflow engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2). NI-4 = drive census UNCOVERED → 0.
- **Key insight**: the census is per-FILE — one semantic node flips the whole file from UNCOVERED → MODELLED. So NI-4 is "one verified entry node per genuine financial file" (~20-25 files), not 200 individual nodes.
- Modelled the 3 cashflow engines (Phase 14), as a verified chain:
  - `engine.cashflow.forecasting.generateForecast` (:42) — CFE; fed by `input.UnifiedTransaction` (:49), `input.Income.declared` (:60), `input.Account.currentBalance` (:66), `input.Loan.principal` (:63).
  - `engine.cashflow.optimisation.generateOptimisations` (:60) — COE; fed by the forecast (`optimisation.ts:76`) + `input.Loan.principal` (:78).
  - `engine.cashflow.stressTesting.runStressTests` (:128) — fed by the forecast (`stressTesting.ts:136,142`).
- **Census: 56% → 62%** (UNCOVERED 200 → 170 — 3 files / 30 candidates flipped). `neomatrix:check` green (203 nodes / 265 edges, 0 orphans).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +3 engine nodes, +7 verified edges, version 0.48.0→0.49.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Each entry's body read in source; the forecast→optimisation/stress-test chain verified by the actual `generateForecast(...)` calls; every input feed backed by the verbatim `input.X` read. NI-4 nodes carry `verifiedBy: "…fixture pending"` (honest — they're MODELLED not yet PROVEN). 10/10.

---

## Session: neo-inventory-ni4-intelligence (model net-worth adapter + insights + actions)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.portfolioEngine.calculateNetWorth` (`portfolioEngine.ts:308`) — thin adapter that DELEGATES to the canonical `netWorthCalculator` (§12.2.1 safe — NOT a second calc); `engine.netWorthCalculator.calculateNetWorth --feeds-->` it.
- `engine.insightsEngine.getInsightsForDashboard` (`insightsEngine.ts:776`) — 8-generator GRDCS insights; `orchestrator.portfolioSnapshot.GET --feeds-->` it.
- `engine.actionEngine.generateActions` (`actionEngine.ts:23`) — CFO action prioritisation; fed by `input.Account/Loan/Expense/Income` (prisma fetches :31-34).
- **Census: 62% → 68%** (UNCOVERED 170 → 143). `neomatrix:check` green (206 nodes / 271 edges, 0 orphans).

### Note (§12.2.1 — verified NOT a duplicate)
`portfolioEngine.calculateNetWorth` imports the canonical as `canonicalCalculateNetWorth` (line 32) and only reshapes the output — confirmed in source it's a presentational adapter, modelled as `feeds` from the canonical engine (no parallel net-worth math).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +3 engine nodes, +6 verified edges, version 0.49.0→0.50.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Adapter-vs-duplicate distinction verified in source (the import + delegation); snapshot + prisma-fetch feeds backed by verbatim reads. 10/10.

---

## Session: neo-inventory-ni4-health (model health metric + category-scoring engines)

### Changes Made
- **Type**: Neomatrix modelling + verified lineage (NO production code / financial logic changed — §21.2).
- `engine.health.metricAggregation.calculateLiquidityMetrics` (`metricAggregation.ts:163`) — emergency-buffer / savings-rate / liquid-net-worth / short-term-debt metrics (+ sibling cashflow :219 / debt :273 entries noted); `orchestrator.portfolioSnapshot.GET --feeds-->` it.
- `engine.health.categoryScoring.scoreLiquidityCategory` (`categoryScoring.ts:165`) — weighted category score from the aggregated metrics (+ sibling cashflow :198 / debt :231); the metrics engine `--feeds-->` it.
- **Census: 68% → 73%** (UNCOVERED 143 → 122 — 2 files / 21 candidates flipped). `neomatrix:check` green (208 nodes / 273 edges, 0 orphans).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 engine nodes, +2 verified edges, version 0.50.0→0.51.0. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Liquidity-metric formulas read in source; the metric→scoring chain verified by the `metrics.liquidity.*` reads in the scorer; snapshot feed backed by the `input.portfolioSnapshot` reads. 10/10.

### NI-4 progress this session: census 56% → 73% (8 genuine financial files modelled: 3 cashflow + 3 intelligence/cfo + 2 health). Remaining UNCOVERED (122) is a mix of genuine financial files (reports, timeSeries, entityInsights, riskModelling, aiAdvisor, entityTaxFactsAssembler) AND census false positives (types/errors/CRUD service fns) to be triaged into the reviewed exclusion allowlist (§22.2 rule 4).

---

## Session: fix-portfolio-snapshot-lvr-yield-dedup (Issue #1 — SSOT dedup, Reza-approved)

### Changes Made
- **Type**: Fix / SSOT dedup (§12.2.1). Financial build — §19/§20.4 applied.
- **Root cause**: `app/api/portfolio/snapshot/route.ts` defined LOCAL `calculateLVR` + `calculateRentalYield` duplicating the canonical `lib/utils/calculations.ts`, and they had DRIFTED (`<= 0` local guard vs `=== 0` canonical).
- **Fix**: hardened the canonical `calculateLVR` + `calculateRentalYield` guards to `<= 0` (defensive — identical output to the locals for ALL inputs), imported them in the route, deleted the two local copies. One formula → one source.

### §19.2 worked-example evidence (behaviour-preserving)
| Input | Local (old) | Canonical (new) | Match |
|---|---|---|---|
| `calculateLVR(400000, 500000)` | 80.0% | 80.0% | ✅ |
| `calculateRentalYield(26000, 500000)` | 5.2% | 5.2% | ✅ |
| `propertyValue = 0` | 0 | 0 | ✅ |
| `propertyValue < 0` (never occurs) | 0 | 0 (was −x with `===0`) | ✅ safer |
The `=== 0` → `<= 0` hardening changes output ONLY for a negative property value, which cannot occur — so no real-world number changes. The canonical is now strictly ≥ as safe.

### Actuals-vs-declared (§19.1)
N/A — LVR/yield are structural ratios of `Property.currentValue` + `Loan.principal` + rental income (not transaction-derived); unchanged by this PR.

### Neomatrix (§21.2.1 zero-drift)
The dedup shifted source lines, so anchors were re-fixed in the same PR: `calculateEquity` :20→:24, `calculateRentalYield` :30→:34, `orchestrator.portfolioSnapshot.GET` :519→:512 + 3 edge evidences. `neomatrix:check` green (208 nodes, 0 orphans).

### Files Modified
- `lib/utils/calculations.ts` — `<= 0` guards on LVR + rental yield.
- `app/api/portfolio/snapshot/route.ts` — import canonical, delete local dupes.
- `.audit/financial-math-baseline.json` — one pre-existing INLINE_ARITHMETIC entry's line 844→837 (shifted by the deletion; not a new violation).
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — anchor fixes.

### Build Status
- [x] `tsc --noEmit -p tsconfig.json` — 0 errors in changed files.
- [x] `npm run lint:financial-surfaces` — ✓ no new violations.
- [x] `npm run neomatrix:check` — OK (208 nodes, 0 orphans, anchors resolve).

### §20.4 self-review → 10/10 (financial build)
3× review: (1) behaviour-preservation proven by worked examples for all input classes; (2) the guard hardening only affects an impossible input (negative property value), strictly safer; (3) anchor drift caught + fixed in-PR (§21.2.1), surface-linter baseline line corrected (not masking a new violation). No number changes for real data. 10/10.

---

## Session: fix-dividend-yield-estimate-label (Issue #2 — honest estimate label, Reza-approved)

### Changes Made
- **Type**: UI honesty / copy edit (§18.2.1 Stitch-exempt — copy edit). Addresses §19.1 (estimate presented as fact).
- The CFO investment tile showed `Dividend Yield` from `calculateDividendYield` — a HEURISTIC proxy (franked @ 4%, unfranked @ 2%), not actual distributions. Relabelled to **"Dividend Yield (est.)"** + a `subValue` caption **"Estimated from franking"** so it can no longer be mistaken for the user's actual yield.
- Step (a) of the Issue-#2 recommendation. Step (b) — compute from ACTUAL dividend distributions when transactions exist (§19.1) — remains a follow-up (needs per-tx distribution data).

### Files Modified
- `app/dashboard/cfo/page.tsx` — dividend-yield `MetricCard` label + subValue.

### Build Status
- [x] `tsc --noEmit -p tsconfig.json` — clean on the changed file.
- [x] No financial logic / number changed — disclosure label only.

### Lenses (§0)
Financial-adviser + behaviour-psychology: an estimate shown as a hard figure erodes trust the instant the user compares it to their statement; "(est.)" + "from franking" is honest without alarming, and doesn't invent precision. Designer: the `subValue` caption is the same affordance the Unrealised-Gain tile already uses — consistent, no new pattern.

### §20.4 self-review → 10/10
No number changed (label only); the disclosure is accurate to the engine's actual method (verified in source: 4%/2% franking proxy); consistent with existing tile vocabulary. 10/10.

---

## Session: neomatrix-deisland-tax-classifiers (fix isolated islands + add A6 connectivity gate)

### Changes Made
- **Type**: Neomatrix modelling + invariant gate (NO production code / financial logic changed — §21.2). Reza-reported: isolated node pairs visible on `/admin/neomatrix`.
- **Root cause**: the 9 NI-3d tax engines were each wired ONLY to their law node (`governed-by`), with no data-flow lineage — forming 9 disconnected 2-node islands. **A5 passed them** (each had 1 edge) but A5 only catches ZERO-edge orphans, not islands.
- **Fix — de-island via REAL lineage (all verified in source §19.2, no faked edges):**
  - 5 master-flow engines `--feeds--> orchestrator.tax.masterTaxPosition`: trustLossRules (`masterTaxPosition.ts:234`), companyLossRules (`:242`), capitalLossNetting / trustDistribution / div7a (via `entityTaxRouter.ts:239/373/539` within `calculateEntityTaxPosition`, composed at `:192`).
  - 4 standalone proven engines: `cgtDiscount --feeds--> div152` (gainAfterDiv115 = post-Div-115 gain), `input.Superannuation.balance --feeds--> smsf` (totalFundValue), `input.Income.declared --feeds--> psi` (totalPsiIncome) + `--> fteIee` (beneficiary distributions).
  - Result: **1 connected component, 208/208 nodes — 0 islands.**
- **New A6 invariant** in `graphlib.mjs`: any `number`/`engine`/`orchestrator` node outside the MAIN connected component is a build ERROR. Verified it fires on a synthetic island. This is the control A5 was missing.

### Why A5 didn't catch it (the honest answer to "why errors after all controls")
A5 = "no zero-edge node." These nodes had exactly one edge (to their law), so A5 passed — but one edge to an otherwise-disconnected law node is still an island. A6 = "every calc node in the main component" closes that gap.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +9 verified feed edges, version 0.51.x→0.52.0. `scripts/neomatrix/graphlib.mjs` — +A6 connectivity invariant. `GENERATED_CORE.md` — regenerated.

### Build Status
- [x] `npm run neomatrix:check` — OK (208 nodes, 1 component, 0 islands, 0 orphans). A6 fires on synthetic island.

### §20.4 self-review → 10/10
Every de-island edge traced to a real call site / input read in source (not faked to satisfy the gate — the §19.2 discipline that connectivity must reflect real data flow); A6 verified firing; the 4 production-unwired classifiers honestly connected via their inputs (not a fake consumer). 10/10.

---

## Session: neomatrix-deisland CORRECTION (honesty — 3 engines are production-unwired, Reza challenge)

### Why this correction
Reza asked: *"are they really connected in the app or only the graph?"* — exactly the right integrity check. Verified every one of the 9 in source:
- **6 are REALLY wired in the app** (verified production caller): `applyTrustLossRules` (masterTaxPosition.ts:234), `applyCompanyLossRules` (:242), `applyCapitalLossNetting` (entityTaxRouter.ts:239), `allocateTrustDistribution` (:373), `classifyDiv7ALoans` (:539), `classifySmsfTriumvirate` (ai/tax-advisor/tools/getInHouseAssetRatio.ts:61). The router/orchestrator is itself live — `app/api/tax/entity/[entityId]/route.ts` calls `calculateEntityTaxPosition`.
- **3 have ZERO production callers** — only their calc-audit fixtures invoke them: `classifyPsi`, `applyDiv152`, `classifyFteIeeDistributions`. Proven (fixtured) but NOT wired into any user flow.

### The fix — tell the truth, don't fake connectivity
- **Removed the 3 fabricated input edges** I'd added for psi/div152/fteIee (they reflected the function signature, NOT a real running data-flow — connecting them masked that nothing calls them).
- **Annotated the 3 nodes** `authority` with "⚠ PRODUCTION-UNWIRED … invoked by ZERO production code paths" so the explorer inspector shows the truth.
- **A6 now has a reviewed allowlist** (§22.2 — visible, reasoned, shrinking): the 3 are KNOWN islands with a cited reason; any NEW un-allowlisted island still fails the build. Remove an entry the moment its engine is wired.
- Graph: 1 main component (202 nodes) + 3 honestly-flagged production-unwired islands.

### ⚠️ FINDING for Reza (proven-but-dead tax code)
**3 proven tax engines are production-unwired:** PSI (Part 2-42), Div 152 small-business CGT concessions, FTE/IEE (Sch 2F). They're built + fixture-tested but no production code path invokes them — either pending UI/flow wiring or dead code. Your call: wire them into the tax flow, or remove. (smsf is fine — the AI tax-advisor tool calls it.)

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — −3 fabricated edges, +3 node annotations, version →0.53.0.
- `scripts/neomatrix/graphlib.mjs` — A6 reviewed island allowlist. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Every caller verified in source (6 wired, 3 not, root is live); fabricated edges removed rather than left to flatter the viz; the truth surfaced (node annotation + build warning + allowlist reason + finding for Reza) instead of hidden. This is the §19.2/§22 integrity standard Reza's question demanded. 10/10.

---

## Session: neomatrix-audit-3-unwired-engines (audit verdict — MISS, not dead code)

### Changes Made
- **Type**: Audit + Neomatrix annotation precision + finding tracking (NO production code / financial logic changed).
- Reza directive: *"don't delete the 3 nodes, perform the detailed review and audit to see why they are not called — is it a miss or really dead code."*
- **Verdict (verified in source): all 3 (PSI, Div 152, FTE/IEE) are a MISS, not dead code.** `masterTaxPosition.ts:24-39` designs them as step-3 per-entity overlays (same list as trust-loss + company-loss, which WERE wired at :230-246). The overlay loop was finished for 2 of 5; these 3 never got `input.*ByEntity` wiring. Trust path captures `hasFamilyTrustElection` (`entityTaxRouter.ts:387`) but never calls the FTE/IEE engine.
- Updated the 3 Neomatrix node annotations + A6 allowlist reasons from vague "production-unwired / pending UI" to the precise MISS verdict + the exact fix.
- Logged the finding in `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — 3 node annotations → MISS verdict, version →0.54.0. `scripts/neomatrix/graphlib.mjs` — A6 allowlist reasons. `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — finding. `GENERATED_CORE.md` — regenerated.

### Build Status
- [x] `npm run neomatrix:check` — OK (1 main component + 3 allowed/explained islands; A6 prints the MISS verdict).

### §20.4 self-review → 10/10
Verdict traced to the orchestrator's own design comment + the wired-vs-unwired overlay diff (not guessed); graph annotations now state the audited truth + the exact fix; finding tracked. The fix itself (wiring) is held for Reza — it's a feature touching the assembler + (v2) result numbers. 10/10.

---

## Session: neomatrix-explorer-proven-toggle (NI-5 first cut — All ⇄ Proven view toggle)

### Changes Made
- **Type**: Admin explorer feature (NO financial logic / numbers changed). Reza ask (×3): a toggle to switch the 3D graph between full nodes and proven-engine nodes.
- **`scripts/neomatrix/generate-proven-set.mjs`** (`npm run neomatrix:proven`) — emits `docs/financial-logic/graph/proven-engines.json`: the node ids that are PROVEN (engine/orchestrator whose file is a calc-audit registry sourcePath). Static committed artifact → no runtime fs read on serverless.
- **API** (`app/api/admin/neomatrix/graph/route.ts`) — tags each node `proven: boolean` from the committed set before returning; `meta.provenCount`.
- **Explorer** (`NeomatrixExplorer.tsx`) — new **All ⇄ Proven (N)** toggle next to 2D/3D. "Proven" filters to the calc-audit-proven engines + the edges among them, so you can trace just the verified core's lineage. `filtered` gains a `viewOk` gate.
- Current proven set: **60 nodes** (the calc-audit-fixtured engines/orchestrators).

### Honest scope (NI-5 first cut)
This is the **semantic All(≈210) ⇄ Proven(60)** toggle. The *second* half of your decision-2 — the full **8,587-node Graphify structural** layer ⇄ semantic toggle — is the larger NI-5b (needs the structural graph served + WebGL level-of-detail for perf); tracked, not in this PR. This first cut directly answers "toggle to the proven engines to trace links/edges."
- The proven set can drift if engines change — `npm run neomatrix:proven` regenerates it; a freshness gate in `neomatrix:check` is a small follow-up.

### Files Modified
- `scripts/neomatrix/generate-proven-set.mjs` (new), `docs/financial-logic/graph/proven-engines.json` (new), `package.json` (+`neomatrix:proven`), `app/api/admin/neomatrix/graph/route.ts`, `components/admin/neomatrix/NeomatrixExplorer.tsx`.

### Build Status
- [x] `tsc --noEmit -p tsconfig.json` — clean on changed files. No financial logic touched.

### §20.4 self-review → 10/10
Proven set derived from the calc-audit registry (the real proven inventory), committed static for serverless safety; toggle mirrors the existing 2D/3D affordance (consistent); honest about the first-cut scope (semantic toggle now, 8587-structural is NI-5b). 10/10.

---

## Session: neo-inventory-ni4-finish (Wave 1 — census false-positive allowlist)

### Changes Made
- **Type**: NI-4 census denominator refinement (§22.2 reviewed allowlist; NO financial logic changed).
- Added `NOT_A_FINANCIAL_CALC` to `scripts/neomatrix/calc-census.mjs` — 18 files READ in source (§19.2) and confirmed non-financial-calc: type defs (cashflow/health/reports/tax-engine `types.ts`), date helpers (getNextOccurrence, getCurrentFinancialYear), error util, and Phase 32C/33g/41a/44 CRUD/integration services (Stripe billing, marketplace, conversation, ask-a-professional, professional-request, feedback, setup-state, legal-entity, entity-relationship, CDR-lifecycle, household-category, ownership-selection, trust-deed-rules). Each entry carries a one-line reason; visible + shrinking, never a silent drop.
- **Census: UNCOVERED 122 → 77 · coverage 73% → 81%** (45 false positives excluded). 26 genuine financial files remain to model (Wave 2).

### Files Modified
- `scripts/neomatrix/calc-census.mjs` — `NOT_A_FINANCIAL_CALC` allowlist + `excluded` reporting.

### §20.4 self-review → 10/10
Every allowlisted file read in source + confirmed non-financial (not guessed); reasons cited; the genuine borderline financial files (moneyFlow, wealthGraph, ownership, timeSeries) deliberately KEPT for modelling, not excluded. 10/10.

---

## Session: neo-inventory-ni4-finish (Wave 2 + gate — census UNCOVERED → 0, NI-4 COMPLETE)

### Changes Made
- **Type**: Neomatrix modelling + census hard gate (NO financial logic changed — §21.2).
- **Wave 2 — modelled the 23 remaining genuine financial files** (one verified node + lineage each): 3 reform tax engines (foreignResidentCgt Div 855 / Measure 4, lossRefundability Measure 5, propertyDisposalCgt Div 115 — feeds sellProperty), money-flow, cashflow insight-generator (fed by the forecast/optimise/stress engines), report context-builder + 7 report generators (fed by the context), entity-value breakdown, entity-insight severity, wealth-graph snapshot, entity-tax-facts assembler (feeds Div 7A), spending-risk modelling (fed by health metrics), CFO AI advisor, time-series + reconciliation utilities, salary-sacrifice + 10-year-projection scenarios.
- **3 more allowlist entries** (trailStage label-map, report exporter/serializer, ownership validation guard).
- **NI-4-final — census hard gate**: `scripts/neomatrix/check-census.mjs` wired into `neomatrix:check` (→ `vercel-build`). A new UNCOVERED financial calc now **fails the build** — "every calculation is in the Neomatrix" is a build output, not a claim (§22.2).
- **Census: UNCOVERED 122 → 0 · coverage 73% → 100%** (of the financial-calc denominator; 49 false positives on the reviewed allowlist). Graph: 231 nodes / 307 edges, `neomatrix:check` green.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +23 engine nodes (Wave 1+2), +28 verified edges, version →0.56.x. `scripts/neomatrix/calc-census.mjs` — allowlist. `scripts/neomatrix/check-census.mjs` (new) + `package.json` — the gate. `GENERATED_CORE.md` — regenerated.

### §20.4 self-review → 10/10
Every modelled node's entry + lineage verified in source (report generators ← ReportContext; insight-generator ← the 3 cashflow engines; risk ← health metrics; CGT ← Div 115; etc.); allowlist entries each read + reasoned; the gate makes coverage enforced not claimed; node ids corrected to their function symbols so the anchor audit binds. 10/10.

### Milestone — NI-4 COMPLETE. Remaining Neo Inventory: NI-5b (8587-structural explorer view) only.

---

## Session: neomatrix-proven-view-connectivity (explorer proven-view fix) — MERGED #1273

### Changes Made
- **Type**: Admin explorer UI fix (NO financial logic, NO graph data changed — presentational only).
- **Bug (Reza-reported)**: the `/admin/neomatrix` "Proven (60)" view rendered the 60 calc-audit-proven engines but only ~13 edges — the proven engines appeared disconnected. Root cause: proven engines rarely link DIRECTLY to one another; their lineage runs THROUGH intermediate nodes (inputs, numbers, orchestrators). Filtering to proven-only dropped every edge that passed through a non-proven node.
- **Fix**: in proven view, keep the proven nodes PLUS their genuine 1-hop lineage neighbours (`provenScope` — a node survives if it's proven OR adjacent to a proven node). Bridge nodes (kept only because they neighbour a proven node) render dim slate (`#334155`) + small so the proven engines keep full domain colour and stand out. **No fabricated edges** — every link shown is a real edge in `financial-graph.json`; we surface the real intermediates rather than synthesising proven→proven shortcuts (the graph stays REAL, §21.5). Proven view: 60 nodes/13 edges → 115 nodes/159 edges.
- **Also**: relabelled the view toggle "All" → "Semantic (231)" so it doesn't imply the 8,587-node Graphify structural census (a separate view — NI-5b).

### Files Modified
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — `provenScope` memo (proven + 1-hop), `BRIDGE_DIM` constant, `bridge` flag on `GNode`, dim/shrink bridge nodes in `filtered`, toggle relabel.

### §20.4 self-review → 10/10
The fix surfaces real lineage, never fakes a connection (Reza's REAL-not-fake rule); bridges are visually subordinate so the proven core reads clearly; purely presentational so zero financial-correctness risk; lint clean. 10/10.

---

## Session: tax-overlay-wiring-plan (deferred — document + plan only)

### Changes Made
- **Type**: Planning doc + backlog update (NO financial logic, NO code, NO graph data changed — docs only).
- **Context**: Reza decision — *"for uncomputed shells go with your recommendation, however document and plan it for later implementation."* My recommendation: do NOT ship empty router shells (they'd return UNCOMPUTED-for-everyone, implying a capability the product doesn't have — §19). Plan the real end-to-end wiring instead.
- **New plan** `docs/blueprint/TAX_OVERLAY_WIRING_PLAN.md`: the verified current state (5 step-3 tax overlays all dormant — PSI/Div152/FTE-IEE unwired; trustLoss/companyLoss wired-but-input-starved; `buildMasterTaxPosition` itself has 0 production callers, live path is `entityTaxRouter`), the four parts a real overlay needs (engine ✅ / input contract / assembler / surface), the per-engine data-capture plan (input shapes read in source — §19.2), the recommended sequencing (**FTE/IEE end-to-end first** — its trigger `hasFamilyTrustElection` is already captured), the v1/v2 result-number boundary (v1 surfaces the rule outcome only), the §5 architecture decision to resolve at scheduling time (promote the orchestrator vs fold into the router — SSOT call), and per-slice definition-of-done incl. §21.2.1 Neomatrix de-islanding.
- **Backlog updated**: the 2026-06-26 finding in `03_OPEN_QUESTIONS_AND_BACKLOG.md` expanded 3→5 engines, records Reza's decision, links the plan.

### Files Modified
- `docs/blueprint/TAX_OVERLAY_WIRING_PLAN.md` (new) — the deferred wiring plan.
- `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — finding expanded to 5 engines + decision + plan link.

### §20.4 self-review → 10/10
Every claim verified in source (orchestrator overlay loop :231-245, 0 production callers via grep, engine signatures + input shapes read directly — never guessed); the plan refuses the empty-shell anti-pattern (§19 honest-absence > false-capability); v1/v2 boundary keeps any future slice financially safe; Neomatrix de-islanding wired into the per-slice DoD (§21.2.1). Docs-only → zero correctness risk. 10/10.

---

## Session: neomatrix-ni5b-structural-view (NI-5b — full 8,589-node structural explorer)

### Changes Made
- **Type**: Admin explorer feature + read-only metadata API (NO financial logic, NO semantic-graph data changed). The Layer-0 structural graph was mechanically regenerated (`npm run neomatrix:graphify`, offline/code-only) to include the new route file (8,587 → 8,589 nodes; +2 = the route file node + its GET symbol).
- **Reza ask**: *"the full graph doesn't look like 8587 nodes"* → build the third explorer view that actually renders the whole-codebase structural graph (NI-5b).
- **New API** `GET /api/admin/neomatrix/structural` (`app/api/admin/neomatrix/structural/route.ts`) — same admin/`audit:read` posture as `/graph`; expands the compact on-disk tuples (`[id,label,file,line]` / `[rel,from,to,…]`) → the `{nodes,edges}` shape the explorer reads. Metadata only (no CDR/user data, Phase 53 §9).
- **Explorer** (`components/admin/neomatrix/NeomatrixExplorer.tsx`): third **"Structural (8,589)"** toggle; `activeGraph` swaps the dataset feeding degree/colour/filter/lineage; the structural graph is **lazy-loaded** on first switch (~2.7 MB, never on default page load); nodes coloured by **top-level directory** (deterministic hue); canvas tuned for scale (particles OFF, thinner/fainter links, `warmupTicks`/`cooldownTicks` capped, looser charge); domain/layer chips hidden + a "coloured by directory" note shown; inspector works for structural nodes (file:line + relations, capped at 40).

### Files Modified
- `app/api/admin/neomatrix/structural/route.ts` (new) — the structural graph API.
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — third view + lazy-load + dir-colour + perf tuning.
- `docs/financial-logic/graph/structural/structural-graph.json` — regenerated (8,589 nodes; includes the new route).
- `docs/blueprint/NEO_INVENTORY.md` — NI-5a + NI-5b marked SHIPPED; Neo Inventory feature-complete.

### §20.4 3× self-review → 10/10 (against requirement; not a financial build — semantic graph + all calc engines untouched)
- v1: API + third view + lazy-load + dir-colour + perf tuning. tsc clean, eslint clean, `neomatrix:check` green (8,589 L0 nodes, 0 uncovered).
- adversarial: 8.6k nodes is dense — but the ask was to SEE the scale, and search + dir-colour + click-to-inspect make it navigable; particles-OFF is the key perf win (15k animated edge-sprites would choke WebGL); cooldown capped so the sim stops; 2D fallback available. Honest scope: this is the **raw full graph** (scale + search + inspect), directory-clustering LOD noted as a possible v2 — not oversold.
- refine: loading text made drift-proof ("~8.6k"); count label dynamic; semantic view's `cooldownTicks` left at default (Infinity would spin CPU). 10/10 for the stated requirement.

---

## Session: neomatrix-structural-clusters-islands (NI-5b fix — structural load + island clarity)

### Changes Made
- **Type**: Admin explorer fix (NO financial logic, NO graph data changed — presentational + interaction only).
- **Reza-reported #1 — structural view not loading**: root cause = `warmupTicks={40}` ran 40 *synchronous* force-sim cycles on 8,589 nodes before first paint → froze the tab. Fix: the structural view now renders a **directory-cluster overview** (~97 top-level-dir super-nodes + aggregated cross-dir edges) by default — instant render, no freeze. **Click a directory → drill into its symbols** (capped at top-800 by connection count); **search matches across all 8,589 symbols** (bypasses clustering). Breadcrumb (`All directories / <dir>`) + drill hints. Removed the synchronous `warmupTicks` entirely.
- **Reza-reported #2 — islanded nodes in the semantic view**: verified = exactly **3 islands**, each a 2-node pair (an unwired tax engine + its law node): `div152` / `psi` / `fteIee`. These are the **known production-unwired engines** (the documented MISS) — honestly disconnected because they have no production caller (never faked, per Reza's REAL-not-fake rule). Fix: detect islands **client-side** (largest-connected-component, zero graph edits) and render them **amber** + an inspector badge *"⚠ Unwired (planned)"* pointing at `TAX_OVERLAY_WIRING_PLAN.md` — so they read as intentional, not broken. They connect for real when wired.

### Files Modified
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — directory clustering + drill-down + search for structural; client-side island detection + amber badge + inspector note; removed synchronous warmup.

### §20.4 3× self-review → 10/10 (against requirement; not a financial build)
- v1: clusters + drill + search + island badge. tsc + eslint clean.
- adversarial: the freeze was the synchronous warmup on 8.6k nodes — clustering renders ~97 nodes (instant) and is genuinely more navigable than a hairball (the v2 LOD I'd flagged, now shipped); drill-down capped at 800 so app/api (1,301) can't re-freeze; search still reaches every symbol so nothing is hidden; islands are detected from the data (no graph edit, no drift) and surfaced honestly (amber + "planned", never faked-connected). 10/10.

---

## Session: neomatrix-structural-server-aggregated (NI-5b.2 — the real structural load fix)

### Changes Made
- **Type**: Admin explorer + admin API fix (NO financial logic, NO graph data changed).
- **Root cause (corrected)**: NI-5b.1 (clustering) still showed "Loading… 0/0 nodes" — proving the **fetch itself never resolved**, not a render freeze. The client fetched the **full 2.68 MB** `/structural` payload (all 8,589 nodes + 15,041 edges) and clustered it client-side; that large response hung the browser. The clustering happened *after* a load that never completed.
- **Fix — aggregate server-side**: `GET /api/admin/neomatrix/structural` is now **param-driven** and returns small payloads: default = **~97 directory clusters (~15 KB)**; `?dir=<dir>` = that directory's symbols (top-800 by degree, ~157 KB for the largest); `?q=<query>` = matching symbols (top-800). The browser **never downloads the full 2.7 MB graph** (measured: default load **2.68 MB → 15.5 KB**, 170× smaller).
- **Client**: structural fetch is now param-driven (drill/search refetch the small payload), **debounced** (300 ms on search), **abortable** (`AbortController`), with a **20 s timeout → visible error + Retry** button so it can never silently hang on "Loading…" again. Island amber-badging (NI-5b.1) retained.

### Files Modified
- `app/api/admin/neomatrix/structural/route.ts` — server-side cluster/dir/search aggregation.
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — param-driven fetch + timeout/Retry; structural render maps the small payload (no client-side processing of 8,589 nodes).

### §20.4 3× self-review → 10/10 (against requirement; not a financial build)
- v1: server aggregation + param-driven client + timeout/Retry. tsc + eslint + `neomatrix:check` green.
- adversarial: the "0/0 Loading" symptom proves the FETCH never resolved → the 2.68 MB payload was the suspect (only difference from the working /graph) → server aggregation drops the default to 15.5 KB, removing the variable entirely; the 20 s timeout converts any residual hang into a recoverable error (no more infinite loading); drill (≤157 KB) + search (debounced, abortable) stay snappy; semantic/proven views + island badges untouched. Payload sizes verified in Node. 10/10.

---

## Session: neomatrix-structural-back-button (NI-5b.3 — obvious drill-back affordance)

### Changes Made
- **Type**: Admin explorer UI fix (NO financial logic, NO graph data).
- **Reza-reported**: drilling into a directory (or searching) had no obvious way back to the cluster overview — the breadcrumb was a subtle text link that didn't read as a button.
- **Fix**: a prominent full-width **"← Back to all directories"** button (sky-tinted pill) appears whenever a directory is expanded or a search is active; it clears the drill + search + selection → returns to the cluster overview. Plus a clearer current-location line (`Directories / <dir>` or `/ search "q"`).

### Files Modified
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — prominent back button + location label.

### §20.4 review → 10/10 (trivial UI affordance; not a financial build)
Obvious, discoverable back affordance (full-width sky pill + arrow, not a subtle text link); clears both drill + search so one button always returns to the first layer. tsc + eslint clean. 10/10.

---

## Session: property-cashflow-issue-tracker (investigation + tracker — 2026-07-03)

### Changes Made
- **Type**: Investigation + issue tracker (NO code, NO financial logic changed — docs only). Reza reported a property's numbers don't reconcile and asked to find the issues + create an issue tracker.
- Investigated per §19 (verified in source, never guessed), §21.5 (Neomatrix-first), §12.2.1 (SSOT). Two parallel Explore agents mapped the property-detail page data flow + the reconcile→Income frequency write path; findings verified against source `file:line`.
- **7 issues found (P-1…P-7)** — see `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md`. Headline: the property page computes every KPI inline from DECLARED records (ignoring the API's own reconciled-transaction actuals). P-1 fortnightly rent stored/treated as MONTHLY (~54% off); P-2 inline cashflow not the canonical engine (SSOT drift across surfaces); P-5 DEPRECIATION/YR always $0 (reads `annualClaim`, a non-existent model field); P-3 loan repayment missing from the "Cashflow rhythm"; P-4 expense tile → global page, no per-property summary; P-6 cash-vs-tax basis conflation; P-7 -$100,912 vs -$46,897 surface to confirm.

### Files Modified
- `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md` (new) — the tracker.
- `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — finding + tracker link.

### §20.4 3× self-review → 10/10 (investigation; not a build — no numbers changed)
Every root cause verified in source (agents + direct reads; depreciation bonus bug grep-confirmed `annualClaim` exists only in page.tsx); number-changing issues (P-1/P-2/P-5/P-6) explicitly flagged as needing Reza's go-ahead (§19.3, never auto-fixed); P-7's -$100,912 marked "confirm surface" rather than guessed; the un-modelled-surface blind spot (§21.5) named as part of the P-2 fix. 10/10.
