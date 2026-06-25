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
- Status: Draft (to be opened)
