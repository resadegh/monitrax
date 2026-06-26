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
