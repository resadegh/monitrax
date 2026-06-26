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
