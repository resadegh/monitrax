# Changelog — 2026-06-25

## Session: claudemd-neomatrix-first (branch `claude/claudemd-neomatrix-first-jqahjw`)

### Changes Made
- **Type**: Governance / process (CLAUDE.md standing instruction; NO code, NO financial logic, NO graph data changed)
- **Scope**: Reza directive 2026-06-25 — *"all sessions should use Neomatrix from now on to understand the Monitrax design and architecture instead of going through the whole code and documents … Claude Code should always be on top of the design and never assume or guess how Monitrax works."*
- **What was added**: a **Neomatrix-FIRST comprehension** standing rule so every future session reaches for the verified graph as the first reference for the financial architecture — instead of re-reading the whole codebase — while never assuming/guessing.

### Files Modified
- `CLAUDE.md`:
  - **+ §21.5 — Neomatrix-FIRST comprehension (read the map before the territory, NON-NEGOTIABLE)**: where it lives (`financial-graph.json` / `GENERATED_CORE.md` / `/admin/neomatrix`), the 5-point rule (start at the graph · trust it for what it models · **honest scope guard** — it maps the financial logic, NOT yet auth/CDR/infra/pure-UI, so Part 10 still governs there · **a gap is a signal to MODEL it (§21.2), never to guess** · never assume/guess, disagreements → `suspected-issue`), + reviewer enforcement.
  - **Part 1 Step 3 — new item 0**: Neomatrix first for any financial number/engine/flow (jump to the verified `file:line` rather than grep-and-read-everything).
  - **Part 10 §10.3 research checklist — new lead item**: "What does the Neomatrix say?" before the blueprint/code reads.
  - Version footer → **2.8**.

### Why this wording (honest scoping — §0 advisory lenses)
- **Architect lens**: the rule is scoped to what the graph actually covers today (the financial logic — 104 nodes, 6 domains, 1 connected component). It does **not** claim to map auth/CDR/IAM/infra/pure-UI/every route. Telling sessions "use Neomatrix instead of reading code" *without* that guard would cause under-research in unmapped areas — so the guard is explicit, and Part 10 still governs there.
- **Anti-guess (§10/§19)**: a Neomatrix gap is defined as a trigger to **model it** (grow the graph, verified `file:line`), never to assume. This keeps the "never guess" discipline intact while making the map the default comprehension path.
- The growth direction (model more of the architecture into the graph over time — N4 backfill) is named so the rule trends toward genuinely covering "the whole design."

### Build Status
- [x] Docs/governance only — no code, no graph data, no financial logic changed.
- [x] `npm run neomatrix:check` — OK (graph untouched; still 104 nodes / 139 edges / 1 component, v0.26.0).
- [x] Plan freshness OK.

### §20 self-review (3× → 10/10)
- **Pass 1 (draft)**: §21.5 + Step 3 + Part 10 edits.
- **Pass 2 (critique)**: the risk in "use the graph instead of the code" is over-reliance on a partial map → blind spots in unmapped areas. Added the explicit honest-scope guard (point 3) + the "gap → model, never guess" rule (point 4) so the instruction can't be read as "skip research where the graph is silent."
- **Pass 3 (refine)**: tied the new rule into the existing Part 1 / Part 10 / Part 21 fabric (cross-refs, not duplication); reviewer-enforcement clause distinguishes "re-derived a mapped lineage" (consult the map) from "real gap" (model it). **10/10.**

### Doc-sync (CLAUDE.md §16)
- No §16.2 product surface changed — this is a change to the governance document itself.

### PR
- Branch: `claude/claudemd-neomatrix-first-jqahjw`
- Status: Draft (to be opened)

---

## Session: ssot-transaction-table (branch `claude/ssot-transaction-table-jqahjw`)

### Changes Made
- **Type**: Fix (financial correctness + SSOT) — repoint dead-table readers to the canonical `UnifiedTransaction`.
- **Scope**: Reza directive 2026-06-25 — *"follow the critical SSOT rule … make sure every part of the app references the same data."* Follows the two-transaction-tables finding surfaced by the Neomatrix connectivity audit (#1231).
- **Root cause**: the legacy `Transaction` table (`prisma/schema.prisma` `model Transaction`, `@@map("transactions")`) is **dead — ZERO writers** in `app/`+`lib/`+`scripts/` (only a test-reset `deleteMany`). Meanwhile `UnifiedTransaction` is the SSOT (**32 writers**; rich schema — `isTransfer`, category hierarchy, source/Basiq, GRDCS linking — read by the master-snapshot actuals engine + ~56 sites). Three readers were stuck on the dead table → they returned **empty/stale** data:
  - `lib/calculations/moneyStoryTrend.ts:77` — the **Money Story hero** showed nothing/stale for every user.
  - `app/api/account/export/route.ts:60` — the user data export returned empty transactions.
  - `lib/utils/ownership.ts:277` — the ownership resolver for `transaction` objects.

### §19.1 / §19.2 evidence (financial correctness)
- **Input contract** (verified, `UnifiedTransaction` schema `prisma/schema.prisma:2715`): `date: DateTime`, `amount: Float` (AUD), `direction: IN|OUT`, `isTransfer: Boolean @default(false)` (non-null). Money Story buckets by month: `IN → earned`, `OUT → +|amount| spent`.
- **Law**: §12.2 SSOT (one canonical source = `UnifiedTransaction`) + §19.1 (numbers derive from ACTUAL transactions; **transfers excluded** — a transfer is neither earned nor spent). The repoint adds `isTransfer: false` to Money Story's query, matching `computeActualCashflow`'s `isTransfer !== true` exactly.
- **Worked example / verify**: the bucketing + margin/delta MATH is unchanged — only the source table changed. The A1 audit (`tests/neomatrix/moneyStoryTrendAudit.test.ts`, mock repointed to `unifiedTransaction`) still passes all cases (currentMargin 50, baseline 40, marginΔ +10, incomeΔ +20.0%, cashflowΔ +2,000, outgoingsΔvsAvg +5,000; <2 months → empty). **No formula changed; no suspected-issue.**

### Files Modified
- `lib/calculations/moneyStoryTrend.ts` — `prisma.transaction` → `prisma.unifiedTransaction`; `+ isTransfer: false` (§19.1); SSOT comment.
- `app/api/account/export/route.ts` — `prisma.transaction` → `prisma.unifiedTransaction`.
- `lib/utils/ownership.ts` — `prisma.transaction` → `prisma.unifiedTransaction` (the `account.ownerEntityId` select is identical on both).
- `docs/financial-logic/graph/financial-graph.json` — **§21.2 lineage update**: repointed `input.Transaction → getMoneyStoryTrend` to `input.UnifiedTransaction → getMoneyStoryTrend`; removed the now-orphaned `input.Transaction` node (dead table, no consumer); updated the engine's input note. v0.26.0 → **0.27.0**, 103 nodes / 139 edges, **still 1 connected component**.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated.
- `tests/neomatrix/moneyStoryTrendAudit.test.ts` — mock + node assertion repointed to `unifiedTransaction` / `input.UnifiedTransaction`.

### Build Status
- [x] `npm run neomatrix:check` — OK (schema, A3 invariants, file:line anchors, freshness)
- [x] `vitest run tests/neomatrix/` — 122/122
- [x] `tsc --noEmit` — no type errors in the 3 changed files
- [x] No remaining `prisma.transaction` reader in `app/`+`lib/` (only a test-reset `deleteMany`)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: repoint 3 readers + graph lineage + test mock.
- **Pass 2 (critique)**: verified the legacy table is truly dead (0 create/update/upsert across app+lib+scripts); confirmed the export is an additive JSON dump (richer rows don't break it); confirmed the ownership `account` relation exists on `UnifiedTransaction`; confirmed the bucketing math is untouched (math is audit-locked, 122/122); confirmed `isTransfer: false` ≡ the actuals engine's `!== true` (non-null default-false column).
- **Pass 3 (refine)**: kept the destructive table-DROP OUT of this PR (Reza decision: repoint now, drop separately) so the behaviour fix and the schema change stay atomic/independently reversible. **10/10.**

### 🗑️ Dead code / tech debt (follow-up PR — Reza approved "drop table separately")
- `prisma/schema.prisma` `model Transaction` (`@@map("transactions")`) — now read by NOTHING. Pending a dedicated DROP PR: §12.11 destructive-write checklist + §12.12 migration. Also retire the test-reset `lib/testing/reset.ts:72 prisma.transaction.deleteMany` and any back-relations (`User`/`Account`/`Income`/`Expense` → `Transaction`) at the same time.

### Doc-sync (CLAUDE.md §16)
- No §16.2 design/infra/config surface changed — financial-correctness code fix + the §21.2 Neomatrix lineage update.

### PR
- Branch: `claude/ssot-transaction-table-jqahjw`
- Status: Draft (to be opened)

---

## Session: cashflow-2c-activity-window (branch `claude/cashflow-2bc-convergence-shk180`)

### Changes Made
- **Type**: Fix (financial correctness / SSOT) — Phase 2c window reconciliation.
- **Scope**: the `/activity` "this month" tiles (Spending / Income / Net cashflow) showed a **rolling-30-day** window (`/api/unified-transactions/analytics?months=1`) while the `/cashflow` hero shows the **current calendar month** — so they disagreed (tiles Net −$11,445 vs hero Net −$20,914). Reza-reported. Decision **1a** (current calendar month everywhere).
- **Root cause**: two surfaces of the same number ("money in/out/net this month") used different windows AND different engines (tiles → `calculateSpendingSummary` over rolling 30d; hero → `getCanonicalMonthlyCashflow` over the calendar month).
- **Fix**: the activity money tiles now read the **canonical** current-calendar-month cashflow — `getCanonicalMonthlyCashflow(masterSnapshot)` (the SAME function the hero uses) — so In/Out/Net match the hero exactly (the Neomatrix A3 convergence gate *requires* one engine per `semanticKey`). Transaction count is the current-calendar-month count via a new `from` param on the analytics route. Added a "This month" eyebrow above the tiles.

### §19.1 / §19.2 evidence
- **Input contract** (verified this session): `getCanonicalMonthlyCashflow` reads `snapshot.quickMetrics.actualMonthly{Inflow,Outflow}/actualNetCashflow` (current calendar month, transfers excluded, uncategorised included) when `hasActualData`, declared fallback otherwise (CLAUDE.md §19.1). `calculateSpendingSummary` (analytics, now only powering the count) verified to exclude transfers (`analytics.ts:109`) and be direction-based — same basis.
- **Worked example**: actual current month In 25,827 / Out 46,741 → tiles now show Income 25,827 / Spending −46,741 / **Net −20,914**, identical to the hero. Previously (rolling 30d) the tiles showed Income 36,403 / Spending −47,848 / Net −11,445. No formula changed — only the window + the source engine (parallel aggregator → canonical SSOT).

### Files Modified
- `app/dashboard/activity/page.tsx` — `fetchSummary` reads `/api/master-snapshot` → `getCanonicalMonthlyCashflow` for In/Out/Net; current-month count via `analytics?from=<startOfMonth>`; "This month" eyebrow.
- `app/api/unified-transactions/analytics/route.ts` — added optional `from` (ISO) window-start param (backward-compatible; `months` default unchanged).
- `docs/financial-logic/graph/financial-graph.json` — **§21.2 Neomatrix update**: new `ui.activity.cashflowTiles` node (semanticKey `monthlyCashflow`) + `number.monthlyCashflow → ui.activity.cashflowTiles` rendered-at edge; v0.27.0 → **0.28.0** (104 nodes / 140 edges).
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated.
- `tests/calculations/cashflowSurfacesUseCanonical.test.ts` — guard: activity tiles use the canonical accessor; no `analytics?months=1` summary call.

### Build Status
- [x] `npm run neomatrix:check` — OK (schema, **A3 convergence** now covers the activity tiles, anchors, freshness)
- [x] `vitest run tests/neomatrix tests/calculations` — 241/241 (+ the new guard)
- [x] `tsc --noEmit` — no errors in the changed files (2 pre-existing errors in `components/admin/neomatrix/NeomatrixExplorer.tsx` — another session's `react-force-graph-3d` typings, unrelated)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: repoint tiles to a calendar-month analytics window.
- **Pass 2 (critique)**: a parallel `calculateSpendingSummary` call would *numerically* match but fail the Neomatrix A3 convergence gate (two engines, one `semanticKey`) and could drift again — the #1201 lesson. Repointed to the canonical `getCanonicalMonthlyCashflow` instead (one engine, guaranteed equal). Verified `getCanonicalMonthlyCashflow` is pure (type-only import) so it's client-safe.
- **Pass 3 (refine)**: kept the analytics call only for the current-month count (not a money SSOT concern); added the §21.2 graph node so A3 permanently guards the tiles↔hero convergence; added the structural guard test. **10/10.**

### Still pending (Phase 2 follow-ups — Stitch-gated, separate PR)
- **#4 `/activity` donut** ("Where your money goes — YTD"): declared annual + `max(0)` + omits actual uncategorised spend → fictional 20% surplus. Decision **2a** (real actual YTD + no floor). Needs a Stitch deficit-state pass (§18.2.1).
- **#3 Money Story ribbon** (`moneyStoryTrend.ts:118,156`): `kept = max(0, …)` floors deficits on the ribbon + `currentMargin`. Design-gated.

### Doc-sync (CLAUDE.md §16)
- No §16.2 design/infra surface changed beyond a copy eyebrow. Financial-correctness code fix + §21.2 Neomatrix lineage update.

### PR
- Branch: `claude/cashflow-2bc-convergence-shk180` (stacked on #1233 `ssot-transaction-table`)

---

## Session: dashboard-actuals-ssot (branch `claude/dashboard-actuals-ssot-jqahjw`)

### Changes Made
- **Type**: Fix (financial correctness + SSOT) — the dashboard money tiles read the ONE canonical cashflow source.
- **Scope**: Reza screenshot — dashboard "Monthly cash flow" tile showed **+$10,505** while the /cashflow page showed **−$20,914** (the exact discrepancy that motivated Phase 53). Root cause + fix below.
- **Root cause (two sources of truth)**: the dashboard fetched `/api/portfolio/snapshot` (the GRDCS relational SSOT), whose `cashflow` block is **declared-only** (no `quickMetrics`/`actual*`). So the 4 KPI tiles + cashflow detail modal + "you're saving X%" insight messages sourced money from the declared "plan" side — silently dropping uncategorised actual spend → false-optimistic (a +surplus and a 51.9% savings rate while the user ran a real deficit). The /cashflow page + Money Story correctly used the canonical actuals resolver. **Two sources for "monthly cashflow" → contradiction.**

### The fix — collapse to ONE source (CLAUDE.md §12.2 / §19.1)
- **`app/api/dashboard/insights/route.ts`**: call `getCanonicalMonthlyCashflow(snapshot)` (the SAME pure resolver the /cashflow page uses — reused, not duplicated) and expose its result precomputed in `kpiTiles.canonical {monthlyNet, annualNet, monthlyInflow, annualInflow, monthlyOutflow, annualOutflow, savingsRate, basis}`. The savings-rate insight messages now use the canonical (actuals-aware) rate.
- **`app/dashboard/page.tsx`**: one `cf` accessor reads `insights.kpiTiles.canonical` (declared fallback only until it loads — the sole declared read, annotated). All KPI tiles (desktop + mobile), the cashflow detail modal, and the insight messages read `cf.*`. The dashboard now matches /cashflow + Money Story exactly, transfers excluded (§19.1).
- **Bonus duplicate-calc fix**: collapsed an inline `snapshot.totalAssets − snapshot.totalLiabilities` (a duplicated net-worth formula) to the canonical `snapshot.netWorth`.

### Neomatrix (§21.2) — model the tiles so A3 enforces convergence
- +6 nodes (4 dashboard tile UI nodes + `number.canonicalCashflow.monthlyInflow/monthlyOutflow`), +6 edges. The dashboard cashflow tile now shares `semanticKey: monthlyCashflow` with `ui.cashflow.hero` and both render `number.monthlyCashflow` → **A3 convergence-contradiction now PROVES they share one engine** (and fails the build if anyone repoints a tile back to declared). v0.28.0 → **0.29.0**, 110 nodes / 146 edges, **1 connected component**.

### Guard (the structural rule, in code)
- `scripts/lint-financial-surfaces.ts` — new **Pattern 4: DECLARED_CASHFLOW_SOURCE** flags any surface reading `*.cashflow.{monthlyNetCashflow,annualNetCashflow,savingsRate,totalIncome,totalExpenses}` directly → must use the canonical insights payload. Verified: 0 offenders remain in `app/dashboard`/`app/portal`/`components`. Baseline shrank **22 → 11** (this fix resolved 11 pre-existing violations).

### Build Status
- [x] `npm run lint:financial-surfaces` — 0 new violations
- [x] `npm run neomatrix:check` — OK (110 nodes / 146 edges / 1 component)
- [x] `vitest run tests/neomatrix/` — 122/122
- [x] `tsc --noEmit` — no type errors in changed files

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: insights canonical block + dashboard reroute + model + guard.
- **Pass 2 (critique)**: confirmed the resolver is REUSED (`getCanonicalMonthlyCashflow`, not re-implemented) — one source, one formula; confirmed the `cf` accessor is the sole declared read (annotated); confirmed A3 now proves convergence; confirmed the guard catches the exact bug class + has 0 current offenders.
- **Pass 3 (refine)**: collapsed the net-worth inline duplicate too; shrank the lint baseline rather than growing it. **10/10.**

### PR
- Branch: `claude/dashboard-actuals-ssot-jqahjw`
- Status: Draft (to be opened)

---

## Session: claudemd-ssot-search-first (branch `claude/claudemd-ssot-search-first-jqahjw`)

### Changes Made
- **Type**: Governance (CLAUDE.md critical rule; no code).
- **Scope**: Reza directive 2026-06-25 — *"two sources of truth is never a single source of truth … never ever calculate the same formula in different places … always check for similar sources before ever attempting to build a new one. Non-negotiable critical rule, add to claude.md."*
- **Added**: **§12.2.1 SEARCH-FIRST — the duplicate-source rule (NON-NEGOTIABLE/CRITICAL)**: one datum / one calculation / one formula = exactly ONE source; the mandatory SEARCH-FIRST protocol (Neomatrix + `lib/` + SSOT table before building anything); the 2026-06-25 dashboard +$10,505-vs-−$20,914 case study (the bug was the duplication, not a wrong number); detection via Neomatrix A3 convergence + surface-linter Pattern 4; reviewer enforcement. + §12.13 checklist lead item. Footer → 2.9.
- **Also added (same branch/PR): §21.2.1 ZERO-DRIFT — update the Neomatrix AS YOU GO, every time (NON-NEGOTIABLE/CRITICAL).** Reza directive 2026-06-25: *"always update Neomatrix as you go and where needed … to avoid drift of Neomatrix."* Model engines/numbers/surfaces in the same PR/edit; fix drifted `file:line` anchors (`neomatrix:check` catches them); model new surfaces with their `semanticKey` so A3 catches divergence; the graph moves with every dedup/refactor; always end on a green `neomatrix:check`. Reviewer rejects any PR that drifts the graph.

### Build Status
- [x] Docs/governance only — no code, no graph data, no financial logic changed.

### PR
- Branch: `claude/claudemd-ssot-search-first-jqahjw`
- Status: Merged (#1236)

---

## Session: w0-stale-tax-brackets (branch `claude/w0-stale-tax-brackets-jqahjw`)

### Changes Made
- **Type**: Fix (financial correctness + SSOT) — **W0 of the audit roadmap** (#1237). Reza-authorised.
- **Scope**: the P0 the audit surfaced — `app/api/cashflow/intelligence/route.ts:451-460` shipped a hardcoded income-tax bracket table labelled "2024-25" but holding **stale FY23-24 values** (first rate `0.19` vs FY24-25 Stage-3 `0.16`; base amounts `5092/29467/51667` vs `4288/31288/51638`). It was BOTH a duplicate of the canonical engine AND wrong — **overstating tax for every user at every bracket** (a §19.2 wrong-number bug).

### The fix — use the ONE canonical engine (§12.2.1 SSOT)
- Replaced the inline bracket table with `calculateIncomeTax(taxableIncome).taxPayable` — the canonical, A1-audited engine (`lib/tax-engine/core/incomeTaxCalculator.ts:21`, Neomatrix `engine.incomeTaxCalculator.calculateIncomeTax`), which reads the canonical `taxYearConfig` FY24-25 brackets and guards `taxableIncome ≤ 0`. No bracket math re-typed.

### §19.2 worked-example evidence (old stale vs canonical)
| Taxable | OLD (stale FY23-24) | NEW (canonical FY24-25, A1-locked) | Overstated |
|---|---|---|---|
| $30,000 | $2,242 | ~$1,888 | +$354 |
| $50,000 | $6,592 | ~$5,788 | +$804 |
| $100,000 | $21,592 | **$20,788** | +$804 |
| $200,000 | $56,167 | **$56,138** | +$29 |

Canonical outputs are the values locked in `tests/neomatrix/financialAudit.test.ts` (A1, ATO-law-referenced: $100k→20,788, $200k→56,138).

### Neomatrix (§21.2.1 — graph moves with the dedup)
- +1 node `number.cashflowIntelligence.estimatedTax` + edge `calculateIncomeTax → it` — records the surface now sources tax from the canonical engine. v0.29.0 → **0.30.0**, 111 nodes / 147 edges, **1 component**.

### Build Status
- [x] `tsc --noEmit` — no type errors in the route
- [x] `npm run neomatrix:check` — OK
- [x] `vitest run tests/neomatrix/` — 122/122

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: swap inline table for `calculateIncomeTax`. **Pass 2 (critique)**: confirmed the canonical engine reads FY24-25 config + is A1-audited (no re-implementation, §12.2.1); confirmed the old values were FY23-24 (overstated, worked examples above); kept the route's own `effectiveTaxRate`-over-gross display metric (not a duplicate of the engine's over-taxable effectiveRate). **Pass 3 (refine)**: modelled the dedup in the graph so A3 covers it. **10/10.**

### PR
- Branch: `claude/w0-stale-tax-brackets-jqahjw`
- Status: Draft (to be opened)

---

## Session: adoring-davinci-e2wb4d — Neobrain (AI perception & learning layer): umbrella + Neomatrix + consolidation SSOT

### Changes Made
- **Type**: Feature (documentation/model only — no behaviour change)
- **Scope**: Neomatrix graph (`financial-graph.json`) + new consolidation SSOT doc + doc-sync
- **Description**: Brought every Monitrax AI engine (transaction categorisation, the per-user + k-anon shared-KB learning loop, transfer/loan-repayment detection, document/receipt intelligence) under one **"Neobrain"** umbrella, modelled it into the Neomatrix as a new `neobrain` domain, and consolidated nine source phase docs into a single design SSOT.

### Files Modified / Created
- `docs/financial-logic/graph/financial-graph.json` — +39 verified nodes (20 engines, 4 orchestrators, 8 data stores, 7 governing laws) + 47 verified edges; every node/edge anchored to a `file:line` read in source (§19.2/§21.2). Bridges to core via `UnifiedTransaction`/`Expense`/`Loan`. No `number` nodes (Neobrain classifies; A3 stays clean). Graph rebased onto main's Trust Engine additions: v0.31.0 → v0.32.0 (152 nodes / 196 edges total).
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `scripts/neomatrix/graphlib.mjs` — `neobrain` added to the `domain` enum (the validator).
- `docs/financial-logic/graph/schema/financial-graph.schema.md` — `neobrain` added to the domain enum row.
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — `neobrain` domain colour (`#EC4899`) + filter chip (without it, neobrain nodes would be filtered invisible).
- `docs/blueprint/PHASE_54_NEOBRAIN.md` — **NEW** consolidation SSOT: defines Neobrain, the three pillars, the cascade, the two-layer learning loop, transfer detection, document intelligence, the data model (~25 tables), the consolidated config/thresholds, current live status, the Neomatrix domain, the roadmap, and the six resolved cross-doc contradictions. Supersedes the design content of Phases 13/18/25/26/29/42/50/51/52.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 54 row added.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOBRAIN` workstream registered.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped.

### Build Status
- [x] `npm run neomatrix:check` — **green** (152 nodes / 196 edges after rebasing onto main, all `verified`; schema valid, A3 invariants hold, file:line anchors resolve, markdown fresh). This is the `vercel-build` gate (plain Node).
- [ ] `npm run build` / `npm run lint` / `vitest` — **not runnable in this env** (`node_modules` not installed in the fresh clone). The Vercel preview build runs the full suite; the TS edits are trivial (one enum string, one colour key + array element). Documented per §11.2.

### Doc-sync (CLAUDE.md §16)
Surfaces changed: architecture-level (new Neomatrix domain) + design-system-adjacent (explorer palette). Docs updated in this PR: `PHASE_54_NEOBRAIN.md` (new), `MASTER_BLUEPRINT.md`, `01_ACTIVE_WORKSTREAMS.md`, `IMPLEMENTATION_PLAN.md`, `financial-graph.schema.md`, this changelog. No CDR/infra/identity/destructive-write/schema-migration surface touched.

### §20 self-review (3× → presented)
- **Pass 1**: drafted the node/edge set from the two code deep-dives.
- **Pass 2 (critique)**: re-verified every engine anchor + every edge call-site in source myself (not trusting the prior audit, §19.2) — corrected the document-cluster bridge from a client-side guess to the verified server lineage (`analyzeDocument` writes `DocumentAnalysis` → `confirm` reads it → creates Expense/Loan). Dropped `number`/`ui-surface` nodes to keep A3 honest and avoid guessed UI paths.
- **Pass 3 (refine)**: ran `neomatrix:check` green; confirmed full connectivity to core (no islands); resolved the six cross-doc contradictions explicitly in the SSOT.

### PR
- Branch: `claude/adoring-davinci-e2wb4d`
- Status: Draft (to be opened)

---

## Session: W1 — extend the financial-surfaces linter to `lib/` + `app/api/` (layer-aware)

### Changes Made
- **Type**: Enhancement (build gate / SSOT enforcement — structural lever §7 of the SSOT audit)
- **Scope**: `scripts/lint-financial-surfaces.ts` + its unit tests + the grandfather baseline
- **Description**: Extended the financial-surfaces linter — which previously scanned only `app/dashboard`/`app/portal`/`components` — to also cover `app/api/` (route layer) and `lib/` (engine layer), where the SSOT audit found the overwhelming majority of duplication. Made the scan **layer-aware** so the gate stays signal-rich.

### Why layer-aware (the measurement that drove it)
- Blanket-extending all four patterns to `lib/` flagged **215 matches**, but a measured triage showed **~70% were legitimate engine domain math** (engines are *supposed* to compute `assets − liabilities` and annualise `× 12` per §12.3), plus test fixtures + sort comparators. Baselining 215 noisy entries would bury real signal.
- **Surface layer** (unchanged): all four patterns, loose FREQUENCY (a surface must never do `× 12`). Existing baseline preserved byte-for-byte (0 stale entries).
- **Route layer** (`app/api`): all four patterns, FREQUENCY enum-tightened (routes must be thin — §12.3).
- **Engine layer** (`lib`): only `DECLARED_CASHFLOW_SOURCE` (§19.1 bypass) + enum-tightened FREQUENCY (genuine `toMonthly`/`toAnnual` shadows). Inline-arithmetic + hardcoded-constant patterns NOT applied (engines legitimately compute + hold config). Canonical homes (`lib/utils/frequencies.ts`) + audit/test harnesses (`lib/calc-audit/`, `lib/testing/`) skipped.
- **Enum-tightening**: a FREQUENCY match in route/engine only counts when the line carries a frequency period as a **value** (quoted `'monthly'` / `case 'WEEKLY'` / ALL-CAPS `ANNUALLY`), not a lowercase identifier like `monthly.income`. Precision pass also skips `.length`/`.count`/`.size` counts + `.sort()` comparators in INLINE_ARITHMETIC.
- **Result**: 215 → **30 genuine route+engine known-debt entries** baselined (the W2–W7 worklist, 0 false positives); surface baseline unchanged (11). New duplication in `lib/` or `app/api/` now fails the build.

### Files Modified
- `scripts/lint-financial-surfaces.ts` — `Layer` type + `SCAN_TARGETS` (dir→layer) + `ENGINE_SCAN_SKIP` + `FREQUENCY_ENUM_LITERAL` + layer-aware `scanFile(file, content, layer)` + INLINE_ARITHMETIC precision (skip counts/sort) + `runLint` iterates targets w/ engine skip
- `tests/calc-audit/surfaces/lintFinancialSurfaces.test.ts` — +10 tests for layer-aware behaviour (23 → 33)
- `.audit/financial-math-baseline.json` — regenerated: 11 → 41 (11 surface unchanged + 30 genuine route/engine debt)
- `docs/audits/SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md` — W0/W1 ticked ✅; new §7.1 documenting the layer-aware extension + the suspected stale-constant find

### Suspected stale-constant find (raised, NOT silently fixed — §21.2)
- `app/api/cashflow/intelligence/route.ts:481` — `Math.min(27500, annualGrossIncome * 0.05) * 0.34`: `27500` is the FY23-24 concessional cap (now $30,000); `0.34` is a magic tax rate. Baselined as known-debt; flagged to Reza for a follow-up financial PR (§19.2 + §20.4). Lower severity than W0 (sizes a *suggestion's* "approx saving", not a core tax position).

### Build Status
- [x] `npm run lint:financial-surfaces` — Scanned 1266 files; 42 matches (1 annotated, 41 grandfathered, **0 new**) → build proceeds
- [x] `vitest run tests/calc-audit/surfaces/lintFinancialSurfaces.test.ts` — **33/33**
- [x] No financial logic changed — this PR only changes detection + baseline (cannot alter runtime numbers)

### §20.4 self-review (build gate touching financial surfaces → 10/10)
- **Pass 1**: extend SCAN_DIRS to `lib` + `app/api`, regenerate baseline. **Pass 2 (critique)**: measured the naive extension = 215 / ~70% noise → would bury signal + fail to be 10/10. Redesigned as layer-aware (engines compute per §12.3; surfaces/routes don't). Found + fixed 3 false positives (2 `.length` counts, 1 sort comparator) and the `monthly.income` identifier false-match. **Pass 3 (refine)**: verified each of the 30 baselined entries is a genuine dup/smell (not FP) by reading source; confirmed surface baseline preserved (0 stale); added 10 unit tests locking the layer rules; raised the stale-constant find rather than burying it. **10/10.**

### Doc-sync (CLAUDE.md §16)
- `docs/audits/SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md:§7.1` — layer-aware extension + outcome + suspected-constant find
- `scripts/lint-financial-surfaces.ts` (file-header JSDoc) — documents the layer-aware rules

### PR
- Branch: `claude/w1-linter-lib-coverage-jqahjw`
- Status: Merged (PR #1240)

---

## Session: Trust Engine L2 — invariant locks for the two triggering bugs

### Changes Made
- **Type**: Enhancement (financial-correctness verification — `0·TRUST-ENGINE` workstream, Layer 2)
- **Scope**: new test suite `tests/regression/invariants/trustEngine.invariants.test.ts` (no production code changed)
- **Description**: First slice of the Financial Trust Engine (Reza directive 2026-06-25: *"a system to check and be 100% sure the results are valid, correct and trustworthy"*). Adds the L2 invariant/property laws whose **absence** let two production bugs ship — extending the Phase 4 invariant suite, not rebuilding it (§12.2.1; research confirmed Phase 4 L2/L3 + the Neomatrix A1 audit + `lib/calc-audit` shadow harness already exist).

### The invariants (laws checked over fine deterministic sweeps)
- **L2.1 income tax** — monotone non-decreasing across a 137-step sweep + every bracket boundary ±1 (locks the **$0-at-every-bracket-boundary cliff**, P0 fixed 2026-06-23); positive above the tax-free threshold; tax ≤ income; effective rate ∈ [0, top marginal]; continuous (no step > top-rate × income-step); marginal rate progressive + equal to the bracket rate AT each boundary.
- **L2.2 actual cashflow** — `Σ outflowByCategory === currentMonthOutflow` (locks the **dropped-uncategorised-spend** bug); Uncategorised bucketed never dropped; transfers excluded; holds over a 40-trial random sweep; no NaN/Infinity.
- **L2.3 frequency converters** — `toAnnual(x,f) === x × periodsPerYear(f)` + `toMonthly === toAnnual/12` + round-trip (catches the divergent-converter class, e.g. a 4.33-weekly drift).

### Demonstrated catches (§19/§20 — an invariant that can't fail is worthless)
- Reintroduced the $0-cliff (strict `<` → `<=`) → **monotonicity lock FAILED**; reverted → passes (engine 0-diff).
- Reintroduced dropped-uncategorised → **category-sum lock FAILED** (both cases); reverted → passes (engine 0-diff).

### Files Modified
- `tests/regression/invariants/trustEngine.invariants.test.ts` — NEW (9 tests)

### Build Status
- [x] `vitest run tests/regression/invariants/trustEngine.invariants.test.ts` — 9/9
- [x] `vitest run tests/regression` — 279 passed / 43 skipped (no regression)
- [x] No production logic changed — verification only

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: write the two invariant locks + frequency consistency. **Pass 2 (critique)**: research-first confirmed I was extending (not duplicating) Phase 4 L2/L3 + the A1 audit; verified the engine's `incomeInBracket+1` convention so continuity bounds are correct not over-strict; verified `Σcategory===total` is by-construction so the lock is exact; fixed my own wrong meta-assertion (sweep tops at 399,903). **Pass 3 (refine)**: mutation-tested BOTH locks to prove they catch the real bugs, reverted the engines, ran the full regression suite. **10/10.**

### Doc-sync (CLAUDE.md §16)
- `docs/changelog/CHANGELOG_2026_06_25.md` — this entry
- `0·TRUST-ENGINE` workstream L2 item → ticks when #1241 (workstream registration) merges

### PR
- Branch: `claude/trust-engine-l2-invariants-jqahjw`
- Status: Draft (to be opened)

### Addendum — Trust Engine modelled INTO the Neomatrix (§21.2.1 ZERO-DRIFT)

Reza directive 2026-06-25: *"this trust engine should also be added to neomatrix."* The Trust Engine is now first-class in the graph — the Neomatrix maps not just *what produces* each number but *what proves it correct*.

- **Schema extension** (`scripts/neomatrix/graphlib.mjs`): new node kind **`verification`** (a Trust Engine assurance node — golden case L0 / independent recompute L1 / invariant L2 / reconciliation L3) + new edge type **`verified-by`** (engine/number IS PROVEN by a verification node; parallels `governed-by`). Additive — existing nodes/edges unaffected.
- **New rendered section** "Assurance — the Trust Engine (what proves each number correct)" in `GENERATED_CORE.md` — table of each verification node: layer, what it proves, the bug it catches, the engine it covers, the test evidence.
- **2 verification nodes + 2 `verified-by` edges** for the L2 slice: income-tax monotonicity/continuity → `engine.incomeTaxCalculator.calculateIncomeTax`; cashflow category-sum → `engine.actualCashflow.computeActualCashflow`. Each cites the test file:line + the mutation-proof. Graph v0.30.0 → **0.31.0** (113 nodes, 149 edges).
- **2 new CI convention locks** (`tests/neomatrix/financialGraph.test.ts`): every `verification` node must connect to what it proves (no orphan assurance); every `verified-by` edge targets a verification node from an engine/number. So future L0/L1/L3 layers stay wired (§21.2.1).
- `npm run neomatrix:check` OK (schema valid, invariants hold, markdown fresh); neomatrix suite 122→124-equiv (8/8 graph tests, full dir green).
- **Follow-up:** frequency-converter consistency (L2.3) has no engine node yet — add a `lib/utils/frequencies.ts` node + its verification edge in a later slice (noted so it isn't lost).

---

## Session: Neomatrix — Trust Engine assurance-coverage readout (keep-track view)

### Changes Made
- **Type**: Enhancement (Neomatrix tracking — follow-up to #1242)
- **Scope**: `scripts/neomatrix/graphlib.mjs` (coverage dashboard) + regenerated `GENERATED_CORE.md`
- **Description**: Reza directive 2026-06-25: *"the trust engine should also be added to neomatrix so we can keep track."* #1242 added the Trust Engine to the graph (verification nodes + verified-by edges + Assurance section). This adds the **at-a-glance progress readout** so coverage is trackable as layers land.
- The Neomatrix "Coverage & trust (C10)" dashboard now shows: **Trust Engine assurance: X/N engines+numbers proven (P%) · K verification node(s) · by layer L0/L1/L2/L3**. Today: 2/59 (3%), L2 ×2 — climbs as L0/L1/L3 ship.

### Files Modified
- `scripts/neomatrix/graphlib.mjs` — `coverageSummary()` computes `assurance` {coveredTargets, totalTargets, verifications, byLayer from verified-by edges}; `renderMarkdown()` dashboard line.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated (assurance readout line).

### Build Status
- [x] `npm run neomatrix:check` — OK (schema valid, invariants hold, markdown fresh)
- [x] `vitest run tests/neomatrix/` — 124/124
- [x] Documentation/model only — no financial logic, no graph data semantics changed (pure derived metric)

### §20 self-review (3× → 10/10)
- **P1**: add assurance metric + dashboard line. **P2 (critique)**: counted engines+orchestrators+numbers as the provable denominator (not laws/inputs/ui — those aren't "numbers to prove"); derived purely from `verified-by` edges so it can't drift from the actual graph. **P3 (refine)**: byLayer sorted deterministically (markdown-fresh stable); reads "X/N proven (P%)" so the GAP is as visible as the coverage. **10/10.**

### Doc-sync (CLAUDE.md §16)
- `docs/financial-logic/graph/GENERATED_CORE.md` — the readout is the tracking surface
- `0·TRUST-ENGINE` workstream — the keep-track mechanism is now live

### PR
- Branch: `claude/trust-engine-assurance-coverage-jqahjw`
- Status: Draft (to be opened)

---

## Session: Trust Engine L3 — reconciliation tie-outs (+ modelled into the Neomatrix)

### Changes Made
- **Type**: Enhancement (financial-correctness verification — `0·TRUST-ENGINE`, Layer 3)
- **Scope**: new `tests/regression/invariants/trustEngine.reconciliation.test.ts` + Neomatrix L3 nodes (no production logic changed)
- **Description**: L3 of the Trust Engine — the accounting discipline that aggregates equal the sum of their parts and flows reconcile to their components (the class of bug where money is silently created/lost in aggregation). Extends the Phase 4 invariant suite (which already locks net-worth=assets−liabilities + per-entity additivity) with the tie-outs NOT yet covered.

### The tie-outs (laws over 6 archetypes + 40 random portfolios)
- **L3.1 net-worth class additivity** — `assets.total === Σ(property/account/investment/super/personalAsset)`; `liabilities.total === Σ(mortgages/personalLoans/creditCards)`; `netWorth === assets.total − liabilities.total`.
- **L3.2 cashflow statement + net tie-out** — `Σ current-month non-transfer OUT === currentMonthOutflow` (statement sum); `currentMonthNet === currentMonthInflow − currentMonthOutflow`; transfers excluded (§19.1 roll-forward seed).

### Demonstrated catch (§19/§20)
- Dropped `personalAssets` from the net-worth total → **L3.1 additivity lock FAILED (28 tie-outs)**; reverted → passes (engine 0-diff).

### Neomatrix (§21.2.1 ZERO-DRIFT, same PR)
- +2 L3 verification nodes (`netWorthClassAdditivity` → `calculateNetWorth`; `cashflowStatementTieOut` → `computeActualCashflow`) + 2 `verified-by` edges. Graph v0.31.0 → **0.32.0** (115 nodes, 151 edges).
- **Assurance readout climbed 2/59 (3%) → 3/59 (5%)**, now `L2 2 · L3 2` — the keep-track view reflecting the new layer live.

### Build Status
- [x] `vitest run tests/regression/invariants/trustEngine.reconciliation.test.ts` — 140/140
- [x] `vitest run tests/neomatrix tests/regression/invariants` — 519/519
- [x] `npm run neomatrix:check` — OK
- [x] No production logic changed — verification only

### §20.4 self-review (financial build → 10/10)
- **P1** write the tie-outs. **P2 (critique)** confirmed not duplicating existing invariants (those lock net=assets−liabilities + per-entity; this adds class-additivity + statement/net tie-out — genuinely new); reused the shared archetypes + random sweep. **P3 (refine)** mutation-proved the additivity lock (28 fail), modelled L3 into the graph, confirmed the assurance readout climbs. **10/10.**

### PR
- Branch: `claude/trust-engine-l3-reconciliation-jqahjw` (stacked on #1244)
- Status: Merged (PR #1245, brought #1244)

---

## Session: Trust Engine L0 — authority-anchored golden-case metadata

### Changes Made
- **Type**: Enhancement (financial-correctness verification — `0·TRUST-ENGINE`, Layer 0)
- **Scope**: `tests/neomatrix/financialAudit.test.ts` (A1 audit metadata) + Neomatrix L0 node. No production logic changed.
- **Description**: L0 of the Trust Engine — make the existing A1 law-referenced golden cases **re-verifiable + re-anchorable** by tagging each with its external authority. The A1 audit already derives expected values from the law; L0 adds the citation metadata the research flagged as missing (FY + source URL + verified-date).

### What was added
- `AuditCase` gains optional `fy` / `sourceUrl` / `verifiedDate`.
- `AUTHORITY_SOURCES` registry — only REAL ATO URLs already cited in the repo tax config (income-tax rates, medicare, super); **no invented URLs (§19.2)**.
- 9 golden cases anchored: income-tax ×7 (every bracket boundary — the $0-cliff golden lock), medicare, super-guarantee.
- **L0 completeness lock**: any case with a `sourceUrl` must use a registry URL, be an official ATO/gov domain, and carry `fy` + `verifiedDate`. Plus a lock that the 7 income-tax bracket cases stay ATO-anchored.

### Neomatrix (§21.2.1)
- +1 L0 verification node `incomeTaxGoldenCases` → `engine.incomeTaxCalculator.calculateIncomeTax` + edge. Graph → v0.34.0. (income-tax engine now carries L0 golden + L2 invariant assurance.)

### Build Status
- [x] `vitest run tests/neomatrix/financialAudit.test.ts` — 102/102 (incl. L0 locks)
- [x] `vitest run tests/neomatrix/` — 126/126
- [x] `npm run neomatrix:check` — OK
- [x] No production logic changed — test metadata + graph only

### §20.4 self-review (financial build → 10/10)
- **P1** add metadata + registry + populate. **P2 (critique)** ensured ZERO invented URLs — every sourceUrl is grep-verified as already cited in `lib/tax-engine/` config; metadata is opt-in so un-annotated cases don't falsely claim anchoring. **P3 (refine)** added the domain-allowlist lock so a future invented URL fails; modelled L0 into the graph. **10/10.**

### Doc-sync (§16)
- `docs/audits/OVERNIGHT_PR_HANDOFF_2026_06_25.md` — created (the merge list)
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated

### PR
- Branch: `claude/trust-engine-l0-golden-metadata-jqahjw`
- Status: Draft
