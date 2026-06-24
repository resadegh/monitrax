# Changelog — 2026-06-24

## Session: neomatrix-depth-income (branch `claude/neomatrix-depth-income-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, core domain. Modelled + A1-audited
  `aggregateIncome` (the §6.2 income SSOT) — gross/net/PAYG aggregation.
- **Description**: Continuing the depth pass after the loan/expense slice (PR #1217,
  merged + prod-verified READY). Added the income aggregator as a graph node and
  five law-referenced A1 audit cases that run the REAL engine against hand-derived
  expected values. Locks the salary GROSS-vs-NET asymmetry and the **already-annual**
  `grossAmount`/`netAmount`/`paygWithholding` contract (the asymmetry where these
  pre-stored figures are annual while `amount` uses `frequency`) — the exact class
  of unit-confusion §19.2 warns about. No suspected-issue found: the engine agrees
  with the §6.2 SSOT + the `frequencies.ts` converters.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: `IncomeInput.amount` is AUD/period (`frequency`-scaled);
  `grossAmount`/`netAmount`/`paygWithholding` are **already-annual** AUD/year
  (verified at `incomeAggregator.ts:72-127`, `:143`). `toMonthly(x, ANNUAL) = x/12`
  (`frequencies.ts:7-31`).
- **Law / formula**: §6.2 income SSOT — `grossTotal = Σ getGrossAmount`, `net = Σ getNetAmount`,
  `payg = Σ getPaygAmount`; SALARY+NET uses `grossAmount` directly (annual), SALARY+GROSS
  and non-salary use `amount × frequency`; PAYG already-annual (/12 monthly); taxable split
  on `isTaxable !== false` (§19.1 — uncategorised/non-taxable money never dropped).
- **Worked examples** (all ✅ verified by running the engine):
  - SALARY GROSS $120,000 ANNUAL ($10,000/mo) + rental $2,000 MONTHLY → `grossTotal` **$12,000/mo**
  - PAYG $30,000 (annual) → **$2,500/mo** (/12); rental contributes $0 (not SALARY)
  - SALARY NET, `grossAmount` $100,000, annual target → `grossTotal` **$100,000** (already-annual, not the $78,000 net)
  - taxable SALARY $100,000 + non-taxable gift $5,000 → `taxableIncome` **$100,000**
  - non-taxable gift $5,000 → `nonTaxableIncome` **$5,000** (never dropped, §19.1)
- **Verify**: 70/70 Neomatrix tests pass (was 65; +5 income cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +1 node
  (`engine.incomeAggregator.aggregateIncome`), +2 edges (`input.Income.declared` feeds it;
  it feeds the master snapshot orchestrator), version 0.15.0 → **0.16.0**, lastReviewed 2026-06-24.
  89 nodes / 96 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON (derived, not hand-edited).
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +5 A1 income audit cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix workstream "Last touched" appended (17 engines A1-audited).
- `docs/IMPLEMENTATION_PLAN.md` — hub "Last updated" → 2026-06-24.

### Build Status
- [x] `npm run neomatrix:check` passes (schema valid, A3 invariants hold, file:line anchors resolve, markdown fresh)
- [x] `vitest run tests/neomatrix/` — 70/70 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1 (draft)**: income node + 5 audit cases.
- **Pass 2 (critique)**: confirmed each expected value is hand-derived from the §6.2 contract +
  `frequencies.ts` (not read off the engine); confirmed the already-annual asymmetry is captured in
  the node `formula`/`inputs`; confirmed edge units (AUD/period→AUD/month, conversion at `:82`).
  No engine touched; no suspected-issue.
- **Pass 3 (refine)**: tightened node `formula` to spell out the SALARY GROSS/NET + PAYG asymmetry;
  worked examples cover gross, PAYG, salary-NET, and both taxable/non-taxable branches. **10/10.**

### Neomatrix status
- **17 engines A1-audited** across all 6 domains (core + tax + health + cfo + intelligence + reports).
- Graph v0.16.0 — 89 nodes / 96 edges, all `verified`.
- **Next**: remaining core (assetValuation, netWorthHistory), more tax divisions, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-income-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-assetval (branch `claude/neomatrix-depth-assetval-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, core domain. Modelled + A1-audited the
  canonical asset-valuation read-model helpers `holdingMarketValue` + `loanBalance`
  (`lib/calculations/assetValuation.ts`, the §12.2 read-model SSOT).
- **Description**: Continuing the depth pass after the income slice (PR #1218, merged +
  prod-verified). These two helpers are the single source every read-model (Wealth-Universe,
  report context, AI advisor) imports so it agrees with the dashboard/master snapshot. They
  deliberately mirror the already-A1-audited `netWorthCalculator` basis — so auditing them
  locks the read-model side to the same canonical formula. No suspected-issue found.
  (`netWorthHistory` deliberately deferred to its own slice — it is DB-bound/async and
  warrants a dedicated prisma-mock harness rather than a half-audit.)

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: holding `units` is a count, `currentPrice`/`averagePrice` are AUD/unit;
  `loan.principal` is AUD and (per prisma schema) **IS** the current outstanding balance, not
  the original face amount. Verified at `assetValuation.ts:44, :71`.
- **Law / formula**: mirrors `netWorthCalculator` (already A1-audited) —
  asset value = `units × (currentPrice || averagePrice)` (Float `||`: a 0 currentPrice is
  falsy → falls back to averagePrice, audit L1-5); loan balance = `principal ?? currentBalance ?? balance`.
- **Worked examples** (all ✅ verified by running the engine):
  - 100u × $50 → **$5,000**; 200u × avg $25 (no current) → **$5,000** (cost-basis fallback)
  - 100u, currentPrice 0 → averagePrice $25 → **$2,500** (Float `||` edge, L1-5)
  - sum [(100×$50),(200×avg$25)] → **$10,000**
  - principal $600,000 → **$600,000**; currentBalance $300,000 → **$300,000**
  - sum [$600k principal, $100k balance] → **$700,000**
- **Verify**: 77/77 Neomatrix tests pass (was 70; +7 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 nodes
  (`engine.assetValuation.holdingMarketValue`, `engine.assetValuation.loanBalance`),
  +4 edges (Investment/Loan inputs feed them; each `depends-on` netWorthCalculator as the
  mirrored basis). version 0.16.0 → **0.17.0**. 91 nodes / 100 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +4 imports, +7 A1 asset-valuation cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (19 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes (schema, A3 invariants, file:line anchors, markdown fresh)
- [x] `vitest run tests/neomatrix/` — 77/77 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: 2 nodes + 7 cases. **Pass 2 (critique)**: confirmed every expected is hand-derived
  from the canonical net-worth basis + prisma schema (not read off the engine); confirmed the
  `||` (holding) vs `??` (loan) distinction is captured per-node; confirmed the L1-5 zero-price
  edge is documented honestly. **Pass 3 (refine)**: tightened node formulas to spell out the
  falsy-vs-nullish semantics. No engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **19 engines A1-audited** across all 6 domains. Graph v0.17.0 — 91 nodes / 100 edges, all `verified`.
- **Next**: `netWorthHistory` (dedicated prisma-mock slice), remaining core (entityBreakdown,
  moneyStoryTrend), more tax divisions, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-assetval-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-nwhistory (branch `claude/neomatrix-depth-nwhistory-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, core domain. Modelled + A1-audited
  `getNetWorthHistory` (`lib/calculations/netWorthHistory.ts`, the §12.2 single
  canonical reader of `NetWorthSnapshot`).
- **Description**: First DB-bound engine audited via a **prisma-mock boundary** — the
  pattern future DB-reading engines will reuse. We mock ONLY `prisma.netWorthSnapshot.findMany`
  (the input source) and run the REAL engine over law-derived fixtures, so the delta math +
  honesty gate we assert is the engine's own code (an audit, not a re-implementation). Full
  lineage modelled: `NetWorthSnapshot` (stored) → `getNetWorthHistory` → trend-delta number →
  the editorial Net Worth Trend tile. No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: stored rows are literal `NetWorthSnapshot` rows (`snapshotDate` Date,
  `netWorth`/`totalAssets`/`totalLiabilities` Float AUD), oldest→newest. Verified at
  `netWorthHistory.ts:47, :56, :83-89`; schema `prisma/schema.prisma:3426`.
- **Law / formula**: CLAUDE.md §0 financial-adviser honesty contract (never invent data —
  <2 rows ⇒ empty trend) + `deltaAbsolute = last − first`;
  `deltaPct = first≠0 ? round((Δ/|first|)×1000)/10 : 0` (one-decimal %, **absolute** baseline, no divide-by-zero).
- **Worked examples** (all ✅ verified by running the engine with mocked DB rows):
  - [100k, 120k] → ΔAbs **+20,000**, Δ% **+20.0**
  - 1 row → honesty gate: `trend []`, ΔAbs **0**, Δ% **0** (never a fabricated curve)
  - first 0 → Δ% **0**, ΔAbs still real (**5,000**) — no divide-by-zero
  - [−10k, −5k] → ΔAbs **+5,000**, Δ% **+50.0** (uses `|first|` — a recovery reads positive)
  - 0 rows → honesty gate
- **Verify**: 84/84 Neomatrix tests pass (was 77; +7 in a new prisma-mocked file). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +4 nodes
  (`input.NetWorthSnapshot`, `engine.netWorthHistory.getNetWorthHistory`,
  `number.netWorthTrendDelta`, `ui.dashboard.netWorthTrendTile`), +3 edges (full lineage).
  version 0.17.0 → **0.18.0**. 95 nodes / 103 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/netWorthHistoryAudit.test.ts` — NEW file (prisma-mock A1 harness, 7 cases).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (20 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes (schema, A3 invariants, file:line anchors, markdown fresh)
- [x] `vitest run tests/neomatrix/` — 84/84 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: full lineage (4 nodes / 3 edges) + 7 prisma-mocked cases. **Pass 2 (critique)**:
  confirmed the mock touches only the DB boundary (the engine computes for real); confirmed each
  expected is hand-derived from the §0 honesty contract + the delta definition; confirmed the
  negative-baseline case actually exercises `Math.abs(first)`. **Pass 3 (refine)**: kept the
  negative-baseline + first-0 cases (they lock the two real correctness properties — abs baseline,
  no divide-by-zero). No engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **20 engines A1-audited** across all 6 domains. Graph v0.18.0 — 95 nodes / 103 edges, all `verified`.
- **Next**: remaining core (entityBreakdown, moneyStoryTrend), more tax divisions, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-nwhistory-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-entitybreak (branch `claude/neomatrix-depth-entitybreak-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, core domain. Modelled + A1-audited
  `buildEntityBreakdown` (`lib/calculations/entityBreakdown.ts`, Phase 47 Stage C1 —
  the per-entity additive ownership view).
- **Description**: Continuing the depth pass after the netWorthHistory slice (PR #1220,
  merged + prod-verified). This engine partitions the household's rows by `ownerEntityId`
  and computes each entity's position by **reusing** `calculateNetWorth` (already A1-audited,
  §12.2/§12.3 — never re-implemented). The audit locks the load-bearing **additivity
  invariant** (Σ per-entity == household) and the **unattributed-bucket reconciliation**
  guarantee (null-owner rows are never dropped; the bucket always sorts last). No
  suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: rows carry `ownerEntityId` (NOT NULL for core types since Phase 41a;
  null → `__unattributed__` bucket). Values AUD; income/expenses `frequency`-scaled. Verified
  at `entityBreakdown.ts:86, :118-127, :134, :149-156`.
- **Law / formula**: Phase 47 C1 additivity contract — `Σ per-entity netWorth == household netWorth`;
  per partition `calculateNetWorth` (identical SSOT math) + `monthlyCashflow = Σ toMonthly(income) − Σ toMonthly(expenses)`;
  null owner → unattributed (never dropped); sort largest-net first, unattributed last.
- **Worked examples** (all ✅ verified by running the engine):
  - e1 (property $800k − loan $600k) → net worth **$200,000**; income $10k/mo − exp $3k/mo → cashflow **$7,000/mo**
  - Σ per-entity (e1 200k + e2 20k + unattributed 50k) = **$270,000** (= household (800+50+20)k − 600k) — additivity holds
  - $50k property with `ownerEntityId=null` → Unattributed bucket net worth **$50,000** (never dropped)
  - Unattributed sorts **last** ($50,000) even though 50k > e2's 20k
- **Verify**: 89/89 Neomatrix tests pass (was 84; +5 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +1 node
  (`engine.entityBreakdown.buildEntityBreakdown`), +3 edges (depends-on `calculateNetWorth`
  as the reused SSOT; Property/Loan inputs feed the partition). version 0.18.0 → **0.19.0**.
  96 nodes / 106 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +5 A1 cases, +2 fixture helpers.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (21 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 89/89 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: node + 5 cases. **Pass 2 (critique)**: confirmed the additivity Σ is hand-derived
  to equal the household identity (not read off the engine); confirmed the unattributed-last case
  genuinely exercises the sort comparator's special-case (50k > 20k yet last). **Pass 3 (refine)**:
  kept the null-owner + unattributed-last cases — they lock the reconciliation guarantee that
  makes the additive view trustworthy. No engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **21 engines A1-audited** across all 6 domains. Graph v0.19.0 — 96 nodes / 106 edges, all `verified`.
- **Next**: `moneyStoryTrend` (remaining core), more tax divisions, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-entitybreak-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-moneystory (branch `claude/neomatrix-depth-moneystory-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, core domain. Modelled + A1-audited
  `getMoneyStoryTrend` (`lib/calculations/moneyStoryTrend.ts`) — the 12-month
  earned-vs-spent ribbon + KPI deltas behind the Money Story v2 hero.
- **Description**: Second DB-bound engine audited via the **prisma-mock boundary**, this
  time also pinning the clock (`vi.setSystemTime`) because the engine's month window is
  anchored to "now". We mock only `prisma.transaction.findMany` and run the REAL engine
  over law-derived fixtures. Locks the §0 honesty contract + §19.1 actuals bucketing and
  the margin/KPI-delta math. **Graph crosses 100 nodes.** No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: literal `Transaction` rows (`date` Date; `amount` Float AUD; `direction`
  IN/OUT). IN → earned, OUT → +|amount| spent. Verified at `moneyStoryTrend.ts:68, :77, :103-127, :152-175`;
  schema `prisma/schema.prisma:1986`.
- **Law / formula**: §0 honesty (zero months render zero, never interpolated; <2 active months → empty)
  + §19.1 actuals. `kept = max(0, round(earned−spent))`; `currentMargin = round(last.kept/lastEarned×100)`;
  `incomeDeltaPct = round((earnedLast−earnedFirst)/earnedFirst×1000)/10`;
  `cashflowDeltaMonthly = last−prev month net`; `outgoingsDeltaVsAvg = round(lastSpent − windowAvg)`.
- **Worked examples** (clock pinned to 2026-06-15; all ✅ verified by running the engine):
  - May earned 10k/spent 6k, June earned 12k/spent 6k → currentMargin **50**, baselineMargin **40**, marginΔ **+10pts**
  - incomeΔ **+20.0%**; cashflowΔ **+2,000** (June net 6k − May net 4k); outgoingsΔvsAvg **+5,000** (latest 6k − 12-month avg 1k)
  - month that spent > earned → `kept` **0** (clamped ≥0; spend still real)
  - <2 active months → empty trend, currentMargin **0** (never fabricated)
- **Verify**: 98/98 Neomatrix tests pass (was 89; +9 in a new prisma-mock + fake-timer file). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +4 nodes
  (`input.Transaction`, `engine.moneyStoryTrend.getMoneyStoryTrend`,
  `number.moneyStoryMargin`, `ui.dashboard.moneyStoryHero`), +3 edges (full lineage).
  version 0.19.0 → **0.20.0**. **100 nodes / 109 edges.**
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/moneyStoryTrendAudit.test.ts` — NEW file (prisma-mock + fake-timer A1 harness, 9 cases).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (22 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 98/98 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: lineage (4 nodes / 3 edges) + 9 cases. **Pass 2 (critique)**: confirmed the clock pin
  makes the month window deterministic and TZ-safe (mid-month midday + local Date constructors);
  confirmed each expected is hand-derived from the §0/§19.1 law; confirmed the outgoings-avg divisor
  includes the empty months (12, not 2). **Pass 3 (refine)**: kept the kept-clamp + honesty-gate +
  outgoings-vs-avg cases — they lock the three subtle behaviours. No engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **22 engines A1-audited** across all 6 domains. Graph v0.20.0 — **100 nodes** / 109 edges, all `verified`.
- **Next**: more tax divisions (e.g. land-tax / stamp-duty surfacing, FBT), then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-moneystory-jqahjw`
- Status: Draft (to be opened)
