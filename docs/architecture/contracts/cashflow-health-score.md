# cashflow-health-score

**Proposed name:** `cashflow-health-score` (D13 quantity 3 of 4 — the question it answers:
**"How healthy are my cash OPERATIONS this cycle — liquidity, stability, forecast risk, budget
adherence, debt load — as a single operational gauge?"**)

Phase A Quantity Contract (MON-131, brief §3). READ-ONLY analysis at HEAD `2f9f2e16`.

## classification

**DERIVED** (D1). 0–100 integer + tier + 5-category breakdown + confidence. Computed per request,
never stored.

## semantic

- **Question:** operational cashflow health (Phase 29 Cashflow Intelligence Center) — a narrower,
  flow-centric question than the 7-domain `overall-financial-health-score`.
- **Formula shape** (`healthScoreAggregator.ts:248–326`):
  `overallScore = round(liquidity×0.25 + stability×0.25 + forecastRisk×0.20 + budget×0.15 + debt×0.15)`
  with each category its own step-function 0–100 (`:77–224`): liquidity from emergency-buffer months
  (≥6→100, ≥3→75, ≥1→50, else 25; fallback `availableCash/burnRate`) adjusted by withdrawable ratio;
  stability from surplus ratio (≥20% → 100 …) − volatility penalty + savings-rate bonus; forecast from
  shortfall + break-even day; budget from variance bands (no budget → neutral 50); debt from DTI or
  repayment-ratio bands.
- **Inputs:** `HealthScoreInput` (`:38–67`) assembled by `app/api/cashflow/intelligence/route.ts`
  from the master snapshot + forecast engine (route `:598 → :650` per Neomatrix edge).
- **Units:** dimensionless 0–100 + tier (EXCELLENT…CRITICAL).

## canonicalHome

`lib/cashflow-intelligence/healthScoreAggregator.ts:248` `calculateCashflowHealthScore`.
**Decimal twin: NOT ESTABLISHED.**
Under D13 this quantity keeps its own home — never reconciled with the other three scores.

## callSites

| Site | Tag |
|---|---|
| `app/api/cashflow/intelligence/route.ts` (input assembly `:613–629`, call `:631` — §7 corrected from "~:650"; the `emergencyBuffer` months input comes from the route's own helper `:162–169`, division `:168`, called at `:610` with `canonical.outflow`) | CONSUMER (sole runtime caller) — note its `:168` months division is registered as a producer in `survival-runway-months.md` |
| `tests/neomatrix/financialAudit.test.ts:34, :486–500, :1051` | CONSUMER (verification fixtures) |
| `healthScoreAggregator.ts:229–239` internal `calculateTrend` (previous-period compare, 'STABLE' default) | DIFFERENT-QUANTITY (a per-category trend verdict; note it defaults to 'STABLE' when no history — the exact pattern D15 banned for the health-score trend; see decisions) |

No other producer of this quantity found (single-sourced).

## invariants

- `overallScore ∈ [0,100]`: every category clamped `:105, :137, :167, :223` (budget returns fixed
  band values ≤100) and `Σ CATEGORY_WEIGHTS = 1.00` (`:26–32` — checkable identity).
- `confidence ∈ [50,100]` (`:312–323`).
- Liquidity fallback: `burnRate > 0` guard at `:88`; `burnRate ≤ 0` ⇒ monthsOfRunway 0 ⇒ score 0
  branch — divide-by-zero safe.
- Budget category returns exactly one of {100,90,80,70,50,30,10,50-neutral}.

## independentExpectation

**NONE FOUND.** All thresholds (6-month buffer, 20% surplus ideal, day-15 break-even, DTI 28/43
bands) are product policy; DTI bands echo US mortgage-underwriting convention (28/36/43) but no
cited authority exists in-repo. Externally **UNVERIFIABLE**; ledger verification = fixture identity
only (already partially held by `tests/neomatrix/financialAudit.test.ts`).

## surfaces

| Route | Label |
|---|---|
| `/cashflow` (Cashflow Intelligence) | half-arc gauge — `app/(dashboard)/cashflow/page.tsx:627` `intelligence.healthScore.overallScore` → `app/(dashboard)/cashflow/components/intelligence/CashflowHealthScore.tsx:191` (§7: full path corrected — the component lives under the route group, not `components/`) + 5-category breakdown |
| `/dashboard/plan` | fetches `/api/cashflow/intelligence` (`plan/page.tsx:458`) but consumes `forecast.current` hero numbers, **not** this score — listed to close the surface sweep honestly |

## expectedMoves

**The D3/D4 runway migration predicts NO movement — with the arithmetic:** the liquidity category's
`emergencyBuffer` input is the intelligence route's own `totalBalance/monthlyOutflow` months
(route `:168`), not `snapshot.emergencyFund.monthsCovered`; and at ≥6 months the branch is already
saturated (score 100). 11.6 → 72.6 months would be 100 → 100 even if repointed. No move.
If Phase B collapses the route's `:168` months producer onto the canonical runway (recommended in
`survival-runway-months.md`), the input VALUE may change (different numerator/denominator basis) —
that collapse must restate this prediction with the live figures before merging.

## decisionsRequired

1. **D15 consistency:** the internal per-category `calculateTrend` returns 'STABLE' when
   `previousPeriod` is absent (`:233`) — the exact "fallback verdict" pattern D15 outlawed for the
   health-score trend. Extend D15's `INSUFFICIENT_HISTORY` rule to this engine, or accept as a
   named exception?
2. Should the liquidity category read the canonical survival runway post-MON-132 (semantic change:
   essential-incl-loans-net-of-independent-income vs total-outflow burn)? Changes the question the
   category answers; Reza call.
3. UI naming: gauge is labelled "health score" on /cashflow — rename to "Cashflow health" explicitly
   to keep the four D13 questions visually distinct?

## coverageBoundary

Read at HEAD: `healthScoreAggregator.ts` (full), `cashflow/page.tsx` + `CashflowHealthScore.tsx`
(cited lines), `plan/page.tsx` (fetch usage), intelligence route `:168` region. NOT read: the full
`app/api/cashflow/intelligence/route.ts` input assembly (~600 lines) — the mapping of snapshot
fields onto `HealthScoreInput` (which basis feeds `monthlyIncome`/`monthlyExpenses`) is **not
verified** here; flag for the Phase B file-owner agent. Verifies formula + single-producer status;
does NOT verify input basis correctness.

*Drift:* `:248` anchor exact at HEAD; §7 review corrected two secondary anchors (route call `:631`, component path under the route group) — see below.

## Adversarial review (§7) — 2026-07-29
- Claims checked: 21 (anchors 12 · arithmetic 6 · negative-claims 3)
- REFUTED / CORRECTED:
  - **Anchor: sole runtime call is `route.ts:631`** (input assembly `:613–629`), not "~:650" — corrected inline. The Neomatrix-edge-derived ":598 → :650" is drifted; the `emergencyBuffer` input is confirmed to be the route's OWN helper (`calculateEmergencyBuffer` :162–169, division `:168` EXACT, called `:610` with `totalBalance` / `canonical.outflow`) — NOT `snapshot.emergencyFund.monthsCovered`, exactly as the expectedMoves prediction requires.
  - **Path: the gauge component is `app/(dashboard)/cashflow/components/intelligence/CashflowHealthScore.tsx`**, not `components/intelligence/…` — corrected inline; `:191` renders `{overallScore}` EXACT at the real path.
- Verified intact (no drift): `calculateCashflowHealthScore` :248 EXACT; `CATEGORY_WEIGHTS` :26–32 = 0.25+0.25+0.20+0.15+0.15 = **1.00 ✓**; `HealthScoreInput` :38–67 EXACT; every category step-function verified in source — liquidity ≥6→100/≥3→75/≥1→50/else 25 with `availableCash/burnRate` fallback :88–90 and burnRate≤0 ⇒ monthsOfRunway 0 ⇒ score-0 branch (divide-by-zero-safe claim confirmed), withdrawable-ratio ±30% adjust :100–102; clamps at **:105/:137/:167/:223 all EXACT**; stability surplus-ratio bands + volatility penalty + savings bonus :112–135; budget bands return exactly {100,90,80,70,50,30,10} + neutral-50 :174–193; debt DTI 28/43 bands :199–221; `calculateTrend` :229–239 with **'STABLE' default at :233 EXACT** (the D15-pattern finding is real); weighted sum :257–263; confidence :312–323 with floor `max(50, …)` — worst case 100−10−10−15−10−20 = 35 → 50, so [50,100] holds.
- Negative claims attacked and SURVIVED: (1) **single-producer** — independent grep for `calculateCashflowHealthScore` callers finds only the intelligence route + `tests/neomatrix/financialAudit.test.ts` (:34/:486–500/:1051 all EXACT); (2) **`/dashboard/plan` does not consume this score** — grep for `healthScore` in `plan/page.tsx` returns zero hits (it fetches the endpoint at :458 for forecast data only); (3) **"NONE FOUND" independentExpectation** — agreed; the 28/36/43 DTI echo has no in-repo citation.
- expectedMoves arithmetic recomputed: at 11.6 months the ≥6 branch already returns 100; 72.6 → 100. No move — sound, and doubly so since the input is the route's own :168 months, not the canonical EF producer.
- Could not verify: the route's full input assembly basis (~600 lines — which income/expense basis feeds `monthlyIncome`/`monthlyExpenses`), exactly as the contract's coverageBoundary discloses; partially narrowed by this review: `:598–629` shows `canonical.inflow`/`canonical.outflow` from `getCanonicalMonthlyCashflow(masterSnapshot)` with declared fallback — the deeper trace stays with the Phase B file-owner.
- Verdict impact: **none** — single-sourced verdict and the D13 four-questions separation stand. Two anchors corrected (above).
