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

---

## Session: neomatrix-depth-taxoffsets (branch `claude/neomatrix-depth-taxoffsets-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, **tax domain** (the depth pass now shifts
  from core aggregators to tax divisions). Modelled + A1-audited `calculateLITO` +
  `applyOffsets` (`lib/tax-engine/core/taxOffsets.ts`).
- **Description**: First tax-division depth slice. LITO is the ATO FY24-25 Low Income Tax
  Offset (two-tier phase-out); applyOffsets enforces the refundable-vs-non-refundable rule
  (LITO/SAPTO floor net tax at $0; franking credits can refund below $0). Config thresholds
  verified against `taxYearConfig.ts` (§19.2 — never guessed). No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: `taxableIncome` AUD/year; `config.lito` = {maxOffset 700, fullThreshold 37,500,
  tier1{45,000, 0.05}, tier2{66,667, 0.015}, cutoff 66,667} — verified at `taxYearConfig.ts:85-97`.
  `applyOffsets` takes grossTax AUD + an offsets object. Verified at `taxOffsets.ts:36, :434, :443-450`.
- **Law / formula**: ATO FY24-25 LITO — full $700 ≤$37,500; 5c/$ over $37,500 to $45,000;
  1.5c/$ over $45,000 to $66,667; nil ≥$66,667. applyOffsets — non-refundable (LITO/SAPTO/foreign/other)
  `min(Σ, grossTax)` floors at $0; franking credits (Div 207) refundable → net can go negative.
- **Worked examples** (all ✅ verified by running the engine):
  - LITO: $30k → **$700**; $40k → **$575** (700−125); $45k → **$325** (700−375); $50k → **$250** (700−450); $66,667 → **$0**
  - applyOffsets: gross $1,000 − LITO $700 → net **$300**; gross $500 + LITO $700 → net **$0** (floor, NOT −$200); gross $0 + franking $1,000 → refund **$1,000**
- **Verify**: 106/106 Neomatrix tests pass (was 98; +8 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +2 nodes
  (`engine.taxOffsets.calculateLITO`, `engine.taxOffsets.applyOffsets`), +3 edges
  (`input.taxYearConfig.lito` feeds LITO; LITO governed-by `law.itaa1997.incomeTax`;
  LITO feeds applyOffsets). version 0.20.0 → **0.21.0**. 102 nodes / 112 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +8 A1 tax-offset cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (24 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 106/106 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: 2 nodes + 8 cases (initially set `applyOffsets` layer to `tax` — the schema gate
  CAUGHT it: `invalid layer "tax"`, so the build failed correctly; `tax` is the domain, `engine`
  is the layer — fixed). **Pass 2 (critique)**: confirmed every LITO value hand-derived from the
  verified config (not the engine); confirmed the non-refundable-floor case ($0 not −$200) and the
  franking-refundable case (−$1,000 → refund $1,000) lock the load-bearing distinction. **Pass 3
  (refine)**: kept the boundary case ($45k tier1/tier2 join) + both applyOffsets sign cases. No
  engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **24 engines A1-audited** across all 6 domains. Graph v0.21.0 — 102 nodes / 112 edges, all `verified`.
- **Next**: more tax divisions (land tax / stamp duty surfacing, PAYG withholding), then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-taxoffsets-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-stampduty (branch `claude/neomatrix-depth-stampduty-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, **tax domain**. A1-audited `calculateStampDuty`
  (`lib/tax-engine/stampDuty/stateStampDuty.ts`) — already modelled (N4.4); this slice promotes
  it from documented to **A1-audited** against the NSW Duties Act 1997 Sch 1 scale.
- **Description**: Second tax-division depth slice. Locks the progressive-bracket math (incl. the
  `inBracket = value − min + 1` convention), the FPAD foreign-purchaser surcharge, and the
  RESIDENTIAL-only gate on FPAD. Brackets verified against the Duties Act in source (§19.2 — never
  guessed). No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: `dutiableValue` AUD (higher of contract price / unencumbered market value);
  `isForeignPurchaser`/`isResidential` gate FPAD; `config.brackets` = NSW Sch 1 scale +
  `foreignPurchaserSurchargeRate` 0.08. Verified at `stateStampDuty.ts:100-118, :262-273, :285-320`.
- **Law / formula**: NSW Duties Act 1997 Sch 1 progressive scale —
  `duty = baseAmount + (value − bracketMin + 1) × rate`; FPAD (Ch 2 Pt 4 Div 4) = 8% of dutiable
  value for a foreign purchaser of **residential** land; total = general + FPAD.
- **Worked examples** (all ✅ verified by running the engine):
  - $600,000 → general **$22,090** (9,805 + 273,000 × 0.045)
  - $100,000 → general **$1,860** (1,405 + 13,000 × 0.035); $0 → **$0**
  - foreign + residential $600,000 → FPAD **$48,000** (×0.08); total **$70,090**
  - foreign + **non-residential** $600,000 → FPAD **$0** (residential-only gate)
- **Verify**: 112/112 Neomatrix tests pass (was 106; +6 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — enriched the existing
  `engine.stateStampDuty.calculateStampDuty` node (formula incl. the `+1` convention, inputs,
  worked example, audit-backed verifiedBy). version 0.21.0 → **0.22.0**. 102 nodes / 112 edges
  (no new nodes/edges — pure audit promotion).
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +6 A1 stamp-duty cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (25 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 112/112 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: enriched node + 6 cases. **Pass 2 (critique)**: confirmed every NSW value hand-derived
  from the Sch 1 brackets in source (not the engine); confirmed mid-bracket values are clean
  (the `+1` matters only at boundaries, documented in the formula); confirmed the FPAD
  residential-only gate + total = general+FPAD cases lock the two-component structure. **Pass 3
  (refine)**: kept the non-residential-FPAD-$0 case — it locks the load-bearing scope gate. No
  engine touched; no suspected-issue. **10/10.**

### Neomatrix status
- **25 engines A1-audited** across all 6 domains. Graph v0.22.0 — 102 nodes / 112 edges, all `verified`.
- **Next**: land tax (state thresholds + progressive scale), PAYG withholding, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-stampduty-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-landtax (branch `claude/neomatrix-depth-landtax-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, **tax domain**. A1-audited `calculateLandTax`
  (`lib/tax-engine/landTax/stateLandTax.ts`) — already modelled (N4.4); promoted to A1-audited
  against the NSW Land Tax Act 1956 CY2025 thresholds + surcharges.
- **Description**: Third tax-division depth slice (after offsets + stamp duty). Locks the
  below-threshold zero, the progressive scale, the NSW special trust surcharge, the foreign
  person surcharge, and the residential-only gate on the foreign surcharge. Thresholds verified
  against the config in source (§19.2 — never guessed). No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: `taxableLandValue` AUD (excl. PPOR); `ownershipType`/`isForeignOwner`/`isResidential`
  gate surcharges; `config` = NSW CY2025 (generalThreshold $1,075,000; brackets; foreignOwnerSurchargeRate
  0.04 residential-only; trustSurchargeRate). Verified at `stateLandTax.ts:138-149, :342-355, :374-462`.
- **Law / formula**: NSW Land Tax Act 1956 — s27 progressive scale `tax = baseAmount + (value − min + 1) × rate`,
  nil below $1,075,000; s5A special trust surcharge 1.5% × min(value, $1.075M); Sch 1A foreign surcharge 4% of
  residential taxable value; total = general + trust + foreign.
- **Worked examples** (all ✅ verified by running the engine):
  - $1,000,000 (< threshold) → general **$0**
  - $2,000,000 → general **$14,900** (100 + 925,000 × 0.016)
  - DISCRETIONARY_TRUST $2,000,000 → trust surcharge **$16,125** (1.5% × $1,075,000)
  - foreign + residential $2,000,000 → foreign surcharge **$80,000** (×0.04); total **$94,900**
  - foreign + **non-residential** $2,000,000 → foreign surcharge **$0** (residential-only gate)
- **Verify**: 118/118 Neomatrix tests pass (was 112; +6 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — enriched the existing
  `engine.stateLandTax.calculateLandTax` node (formula, inputs, worked example, audit-backed
  verifiedBy). version 0.22.0 → **0.23.0**. 102 nodes / 112 edges (pure audit promotion).
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +6 A1 land-tax cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (26 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 118/118 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: enriched node + 6 cases. **Pass 2 (critique)**: confirmed every NSW value hand-derived
  from the CY2025 config in source (not the engine); confirmed the residential-only gate and the
  three-component total (general + trust + foreign) lock the surcharge structure. **Pass 3 (refine)**:
  kept the below-threshold $0 + non-residential-$0 cases — they lock the two scope gates. No engine
  touched; no suspected-issue. **10/10.**

### Neomatrix status
- **26 engines A1-audited** across all 6 domains. Graph v0.23.0 — 102 nodes / 112 edges, all `verified`.
- **Next**: cross-state land-tax aggregator, PAYG withholding, then N2 (2D explorer).

### PR
- Branch: `claude/neomatrix-depth-landtax-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-n2-admin-explorer (branch `claude/neomatrix-n2-admin-explorer-jqahjw`)

### Changes Made
- **Type**: Feature (Neomatrix N2 — the interactive explorer; visual + new admin surface + new dependency)
- **Scope**: Phase 53 Neomatrix — **N2 explorer**, built in the **Admin portal** (`/admin/neomatrix`),
  admin-only, beside `/admin/calc-audit`. A navigable 3D knowledge-graph viewer of the
  financial-logic graph.
- **Strategic decision (Reza, 2026-06-24)**: Neomatrix is a developer/architecture tool (a 3D
  vision of Monitrax's engines/relations), **NOT a user feature** — so it lives in the Admin
  portal for Reza only, never in the user dashboard. Confirmed against the codebase (it slots
  beside the existing `/admin/calc-audit`).
- **Description**: `react-force-graph-3d` (three.js) renders the real 102-node graph as a
  force-directed constellation — orbit/zoom/pan, nodes coloured by domain, click → inspector
  (formula, inputs+units, file:line, lineage in/out, authority, worked example, ✓ verified).
  A left rail filters by domain + layer + search; a 2D/3D toggle drives `numDimensions` (no
  second dep). Dark-cosmos glass vocabulary per the approved Stitch design pass.

### Architecture / lens notes
- **Admin-only (architect + security):** the graph exposes internal architecture (engine names,
  file:line, formulas) — admin-gated like calc-audit. It is **metadata only — no CDR/user data**
  (Phase 53 §9), so no data-exposure risk; admin-gating is for internal-architecture hygiene.
- **Not Stitch-bound (§18.2):** the admin portal is a separate design system, so the Stitch design
  is a *visual reference* (committed under `.stitch/designs/neomatrix/`), not a §18.8-gated artefact.
- **Dependency justification (§12.7):** `react-force-graph-3d` (+three.js, ~600KB) — no existing
  3D engine to reuse; dynamically imported (`ssr:false`) + route-scoped to the admin tool, so it
  never loads on a user hot path.

### Files Added/Modified
- `app/api/admin/neomatrix/graph/route.ts` — NEW admin-guarded API (same posture as calc-audit:
  `isAdminPortalAccessible` → `verifyAdminGCPAuth` → `hasPermission('audit:read')`); returns the
  imported `financial-graph.json` (metadata only).
- `app/admin/neomatrix/page.tsx` — NEW admin page (`AdminFeatureGate` + the explorer).
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — NEW client component (dynamic ForceGraph3D,
  inspector, filter rail, 2D/3D toggle, domain palette).
- `components/admin/layout/AdminSidebar.tsx` — added an "Engineering" nav section (Neomatrix +
  surfaced the previously-unlinked Calc Audit) + two icons.
- `.stitch/designs/neomatrix/explorer-desktop-dark.{png,html}` — design reference (Stitch pass).
- `package.json` / `package-lock.json` — `react-force-graph-3d@^1.29.1`.

### Build Status
- [x] `npx tsc --noEmit` — clean (exit 0, 0 errors)
- [x] `npx eslint` on all new/changed files — clean
- [x] `npm run neomatrix:check` — OK (graph unchanged)
- No financial logic changed; no graph node/edge changed (this is the VIEWER, not the model).

### §18.8 Stitch gate
- The design language passed at 9.2/10 (chrome/inspector/6-domain system); the composite sat ~8.9
  only because a static mockup can't render dense 3D — a medium limitation the live canvas resolves
  (it renders all 102 real nodes navigably). Stitch artefacts committed as the visual reference.

### Neomatrix status
- **N2 explorer SHIPPED (admin-only).** Depth audit stands at 26 engines (PRs #1217–#1225 merged;
  #1226 cross-state in review). The graph is now both **modelled + audited** AND **navigable**.
- **Next (optional):** bloom/post-processing on the 3D scene, TRAIL/regime filters, node-focus
  camera animation, mobile reflow; resume depth on remaining niche engines if desired.

### PR
- Branch: `claude/neomatrix-n2-admin-explorer-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-edges-visible (branch `claude/neomatrix-edges-visible-jqahjw`)

### Changes Made
- **Type**: Fix (Neomatrix N2 explorer — UI visibility; admin surface)
- **Scope**: `components/admin/neomatrix/NeomatrixExplorer.tsx`. The 3D graph rendered nodes
  but the **edges were effectively invisible** (Reza, live on `/admin/neomatrix`).
- **Root cause**: link styling was far too faint — `linkColor` at 0.22 alpha + `linkWidth` 0.4
  on the dark ground, with the force layout spread wide → the 112 edges rendered but couldn't be
  seen. (The data was always correct — the filter rail showed "112 edges".)
- **Fix**:
  - Edges now **tinted by their source node's domain colour** (resolves source whether it's a
    string id pre-simulation or a node object post-simulation), at `linkOpacity` 0.45, `linkWidth` 0.6.
  - Added **flowing directional particles** (`linkDirectionalParticles={2}`, domain-coloured) so
    relationships read as "alive".
  - **Tighter layout** via `d3Force('link').distance(34)` + `charge.strength(-55)` (guarded by a
    try/catch + optional chaining in case the ref doesn't forward) so connected nodes cluster and
    edges become legible.

### Files Modified
- `components/admin/neomatrix/NeomatrixExplorer.tsx` — link styling + particles + force tuning +
  `colorById`/`linkSourceColor` helpers + graph ref.

### Build Status
- [x] `npx tsc --noEmit` — clean (exit 0, 0 errors)
- [x] `npx eslint` — clean
- No financial logic, no graph data, no API change — viewer styling only.

### PR
- Branch: `claude/neomatrix-edges-visible-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-connect-domains (branch `claude/neomatrix-connect-domains-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — model connectivity; documentation/model only, NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — **cross-domain wiring**. Reza (live on `/admin/neomatrix`)
  observed the **core nodes had no links to tax** — and more broadly the six domains rendered as
  **disconnected islands** (0 cross-domain edges). His principle: in the real app the numbers are
  never isolated, so a faithful graph should be (largely) connected.
- **Root cause (model gap, NOT a code bug)**: the depth audit wired each engine to its *immediate*
  inputs/outputs but never drew the **inter-domain seams**. In the real app the domains connect
  mostly **through shared canonical inputs** (§12.2 SSOT): the CFO score, health input, and tax
  position each independently read the same raw tables (`prisma.income/account/loan/expense/property/investment`),
  intelligence consumes the master snapshot, etc. — but the graph only drew each input → its *first*
  consumer.
- **Fix**: added **18 cross-domain / connecting edges, every one verified to source (file:line, §19.2 — no guessed edges)**:

### §19.2 evidence (each edge backed by a real read in source)
- **core → CFO** (6): `lib/cfo/scoreCalculator.ts:43-51` — `calculateCFOScore` reads `prisma.account/loan/income/expense/investmentAccount/property`.
- **core → health** (6): `app/api/financial-health/route.ts:61-91` — `buildHealthInput` reads the same raw tables → `:277 generateHealthReport`.
- **core → tax** (1): `app/api/tax/route.ts:149` — `taxableIncome = assessableIncome − deductions` (from income) → `:257 calculateIncomeTax` (resolves Reza's core↔tax question).
- **core → intelligence** (1): `app/api/cashflow/intelligence/route.ts:598` `getMasterFinancialSnapshot` → `:650 calculateCashflowHealthScore`.
- **core → reports** (1): `app/api/reports/route.ts:107` `buildReportContext` → `lib/reports/generators/index.ts:46 generatePropertyPortfolioReport(context)`.
- **core → CFO what-if** (1): `lib/cfo/scenarios/cutSpendCategory.ts:22` `const {snapshot}=ctx` + `types.ts:15` ScenarioContext wraps `MasterFinancialSnapshot`.
- **core → netWorthHistory** (1): `lib/services/netWorthSnapshotRecorder.ts:52` — computed net worth is recorded into `NetWorthSnapshot`.
- **core → CGT cluster** (1): `app/api/investments/capital-gains/route.ts:103` — CGT discount applied to investment disposal events.

### Result (the graph is now whole)
- **6 disconnected domain-islands → 1 main connected component of 96/102 nodes spanning all six domains** (core 34 · tax 45 · health 6 · cfo 7 · intelligence 2 · reports 2). **core↔tax connected.**
- **Two honest standalone findings** (NOT force-wired — no source evidence to bridge them yet, per §19):
  1. `moneyStoryTrend` (Transaction → ribbon → tile) — a self-contained read-model; the `Transaction`
     table is read by no other *modelled* engine. Legit standalone vertical.
  2. `linkageHealth` (+ its law) — consumes the `/api/portfolio/snapshot` orchestrator (`insightsEngine`),
     which isn't a graph node yet. **Follow-up:** model that second SSOT (`SnapshotV2`) to connect it.
- This is the visualization earning its keep: it surfaced both the cross-domain gap AND two genuinely
  un-wired read-models — exactly the kind of finding a node list never shows.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — +18 verified cross-domain edges. v0.23.0 → **0.24.0**. 102 nodes / 130 edges.
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated.

### Build Status
- [x] `npm run neomatrix:check` — OK (schema, A3 invariants, anchors, freshness)
- [x] `vitest run tests/neomatrix/` — 118/118
- No financial logic changed; no nodes changed — edges added (each source-verified).

### §20.4 self-review (10/10)
- Every edge traced to a real `prisma.x.findMany` / call site in source (no guessed edges) — the
  whole point of the Neomatrix. The 2 remaining clusters left honestly un-wired with a documented
  reason + follow-up, rather than fabricating bridges. Connectivity verified via union-find
  (6 components → 3; main = 96 nodes, all 6 domains). **10/10.**

### PR
- Branch: `claude/neomatrix-connect-domains-jqahjw`
- Status: Draft (to be opened)

---

## Session: neomatrix-depth-crossstate (branch `claude/neomatrix-depth-crossstate-jqahjw`)

### Changes Made
- **Type**: Enhancement (Neomatrix — documentation/model + audit only; NO financial logic changed)
- **Scope**: Phase 53 Neomatrix — DEPTH phase, **tax domain**. A1-audited
  `calculateCrossStateLandTax` (`lib/tax-engine/landTax/crossStateAggregator.ts`) — completes the
  land-tax trilogy (state scale → cross-state aggregation).
- **Description**: Locks the two grouping rules: (1) **within-state aggregation** — a single owner's
  parcels in one state are summed against that state's threshold (NSW Land Tax Mgmt Act 1956 Pt 4);
  (2) **across-state independence** — each state assesses separately (no federal aggregation). The
  headline lock is grouping MATERIALITY: two sub-threshold NSW parcels that, summed, exceed the
  threshold become taxable. No suspected-issue found.

### §19.2 audit evidence (input → law → expected → verify)
- **Input contract**: `properties[]` = {state, taxableLandValue AUD, isResidential}; `ownershipType`/
  `isForeignOwner` applied uniformly. Verified at `crossStateAggregator.ts:105-213`.
- **Law / formula**: within-state — group by state, sum `taxableLandValue`, call `calculateLandTax`
  on each state aggregate; across-state — independent; `grandTotalTax = Σ(general + trust + foreign)`;
  `statesAssessed` = distinct states.
- **Worked examples** (all ✅ verified by running the engine):
  - two NSW parcels $700,000 + $500,000 → NSW aggregated **$1,200,000**
  - NSW $1.2M → general **$2,100** (100 + 125,000 × 0.016) — **materially different** from $0+$0 if assessed per-parcel (both below the $1.075M threshold)
  - + VIC $400,000 (→ $2,050) → grand total **$4,150** (across-state independence)
  - **statesAssessed = 2**
- **Verify**: 122/122 Neomatrix tests pass (was 118; +4 cases). `npm run neomatrix:check` OK.

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — enriched the existing
  `engine.crossStateAggregator.calculateCrossStateLandTax` node (formula, inputs, worked example,
  audit-backed verifiedBy). version 0.24.0 → **0.25.0**. 102 nodes / 130 edges (pure audit promotion; #1229's cross-domain connectivity edges retained after rebase).
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated from the JSON.
- `tests/neomatrix/financialAudit.test.ts` — +1 import, +4 A1 cross-state cases.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Neomatrix "Last touched" appended (27 engines A1-audited).

### Build Status
- [x] `npm run neomatrix:check` passes
- [x] `vitest run tests/neomatrix/` — 122/122 pass
- [x] No financial logic changed — model + test + docs only (§10/§19/§21)

### §20.4 self-review (financial build → 10/10)
- **Pass 1**: enriched node + 4 cases. **Pass 2 (critique)**: confirmed the grouping-materiality case
  genuinely proves the within-state aggregation changes the answer ($2,100 vs $0); confirmed the
  cross-state grand total is the sum of two independently-derived per-state numbers. **Pass 3 (refine)**:
  kept the aggregatedValue + statesAssessed cases — they lock the grouping mechanics. No engine touched;
  no suspected-issue. **10/10.**

### Neomatrix status
- **27 engines A1-audited** across all 6 domains. Graph v0.25.0 — 102 nodes / 130 edges, all `verified`.
- **Next decision point**: depth is now comprehensive (all core aggregators + the major ATO/state-law
  tax engines). Surfacing to Reza: continue depth into the remaining niche/classifier engines, OR pivot
  to N2 (the 2D explorer) per "depth first, then N2".

### PR
- Branch: `claude/neomatrix-depth-crossstate-jqahjw`
- Status: Draft (to be opened)
