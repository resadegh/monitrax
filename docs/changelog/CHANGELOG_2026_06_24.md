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
