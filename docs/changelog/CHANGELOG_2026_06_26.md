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
