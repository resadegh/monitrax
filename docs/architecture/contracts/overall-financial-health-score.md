# overall-financial-health-score

**Proposed name:** `overall-financial-health-score` (D13 quantity 1 of 4 — the question it answers:
**"How healthy is my complete financial position, across all seven domains, on evidence-weighted data?"**)

Phase A Quantity Contract (MON-131, brief §3). READ-ONLY analysis at HEAD `2f9f2e16`.

## classification

**DERIVED** (D1). 0–100 integer + confidence + 7-category breakdown + snapshot-backed trend (D15/MON-134).
Never stored as a live value; stored ONLY as the write-once `HealthScoreSnapshot` audit row (§3.2 exception).

## semantic

- **Question:** overall financial health across LIQUIDITY, CASHFLOW, DEBT, INVESTMENTS, PROPERTY,
  RISK_EXPOSURE, LONG_TERM_OUTLOOK — penalised for data quality, insight severity, linkage issues,
  strategy conflicts.
- **Formula shape:** `score = clamp(0,100, Σ(categoryScore × categoryWeight) − totalPenalty)`, rounded
  (`aggregateEngine.ts:112–120`). Categories are weighted metric roll-ups (`categoryScoring.ts`,
  per-category weight tables); penalties per `calculateModifiers` (`aggregateEngine.ts:38–98`, caps
  10/15/5/10/5).
- **Inputs:** `FinancialHealthInput` built by `lib/health/buildHealthInput.ts` (raw Prisma tables →
  portfolio snapshot shape) + optional insights/linkage/strategy/`healthScoreHistory` + injectable
  `asOf` clock (MON-134 determinism).
- **Window/basis:** point-in-time on declared portfolio data; trend from stored monthly snapshots only
  (D15 — `INSUFFICIENT_HISTORY` when <2 snapshots, formula-version breaks surfaced, never smoothed).
- **Units:** dimensionless 0–100; grade via `riskBandToGrade`.

## canonicalHome

`lib/health/aggregateEngine.ts:373` `generateHealthReport` (score path `:107 calculateAggregateScore`
→ `:346 generateHealthScore`). Already declared the ONE health engine by CLAUDE.md §12.3.
**Decimal twin: NOT ESTABLISHED** — no Decimal sibling exists for this engine (the calc-audit Decimal
CFO siblings cover the *component signals*, not this score).
`quickHealthCheck` (`aggregateEngine.ts:405`) is the same formula minus report assembly — an internal
alias inside the canonical file, not a second producer (identity asserted in
`docs/changelog/CHANGELOG_2026_07_12.md:573`: CFO 72 == Home 72 == report 72).

## callSites

| Site | Tag |
|---|---|
| `app/api/financial-health/route.ts:40` (`buildHealthInput`) → `:57` (`generateHealthReport`) → `:62` (`recordHealthScoreSnapshot`) | CONSUMER (API + snapshot recorder; **no page fetches this route at HEAD** — see decisions) |
| `app/api/dashboard/insights/route.ts:217–218` (`quickHealthCheck`) → `:368` `healthResult.score` | CONSUMER (Home tile source — the "54") |
| `lib/cfo/intelligenceEngine.ts:98, :329` (`generateHealthReport`) → `:82` `assembleCanonicalCFOScore` | CONSUMER (MON-030 B1: CFO overall == this score) |
| `lib/services/healthScoreSnapshotRecorder.ts:29,40` | CONSUMER (write-once audit snapshot, D15) |
| `lib/matrix/goldenBaseline.ts:101–102` | CONSUMER (verification harness) |
| `lib/cfo/scoreCalculator.ts:44` `computeCFOComponents` (+ Decimal siblings, `calc-audit/engines/decimal-cfo-score-risk.ts`) | **DIFFERENT-QUANTITY** — six 0–100 advisor *action signals* (cashflowStrength, debtCoverage, emergencyBuffer, investmentDiversification, spendingControl, savingsRate), **no overall roll-up** since MON-030 stage 2b deleted `SCORE_WEIGHTS`/overall. NOT a fifth overall score at HEAD; the fifth-question risk is retired. Signals survive under their own names. |
| `lib/services/masterFinancialService.ts:1404` `buildHealthScore` | **DIFFERENT-QUANTITY** → own contract `snapshot-health-score.md` |
| `lib/cashflow-intelligence/healthScoreAggregator.ts:248` | **DIFFERENT-QUANTITY** → `cashflow-health-score.md` |
| `lib/calculations/safetyScore.ts:59` | **DIFFERENT-QUANTITY** → `safety-net-score.md` |
| `app/api/dashboard/insights/route.ts:362–365, 505–513` re-derives a 4-component "breakdown" (savingsRate×5, monthsCovered/6×100, 100−DTI, diversification=25 hardcoded) around the canonical score | **DUPLICATE** (breakdown only — mirrors `buildHealthScore` component math outside any engine; the score itself is canonical) |

## invariants

- `score ∈ [0,100]` and integer (clamped `aggregateEngine.ts:118`, rounded `:120`).
- `Σ categoryWeights = 1.0` (`CATEGORY_WEIGHTS` in `lib/health/types` — checkable identity).
- Deterministic: identical input ⇒ byte-identical report (MON-134; locked by
  `tests/health/mon134TrendFromSnapshots.test.ts:125–129`).
- Trend: <2 snapshots ⇒ `INSUFFICIENT_HISTORY`, no `changePercent`; formula-version change ⇒
  `formulaBreaks` entry (D15).
- `quickHealthCheck(input).score === generateHealthReport(input).healthScore.score` (alias identity —
  should become a permanent Ring-0 test).

## independentExpectation

**NONE FOUND.** The weights, benchmarks and penalty caps are Monitrax product policy
(`docs/blueprint/PHASE_12_FINANCIAL_HEALTH_ENGINE.md`), not legislation or an external formula.
No `law.monitrax.healthMethodology` node exists in the Neomatrix beyond the engine's own doc.
Externally **UNVERIFIABLE** — record in the Number Ledger as policy-verified-by-identity only
(hand-reproducible weighted sum on a fixture; nothing more can honestly be claimed).

## surfaces

| Route | Label / evidence |
|---|---|
| `/dashboard` (Home) | health tile — `app/dashboard/page.tsx:960–961` reads `insights.healthScore.score/.grade` ← `quickHealthCheck`. **This is the "54".** |
| `/dashboard/cfo` (My Guide) | overall score — `app/dashboard/cfo/page.tsx` ← `/api/cfo?section=score` → `getCFOScore` → this score (MON-030 B1: My Guide == Home) |
| `/api/financial-health` | full report JSON — **no client page fetches it at HEAD** (grep-verified); it exists as API + the snapshot-recorder trigger path |
| `HealthScoreSnapshot` (DB) | stored monthly audit rows feeding the trend on any surface that renders it |

## expectedMoves

**The D3/D4 survival-runway migration predicts NO movement in this score — explicitly.**
The LIQUIDITY category's `emergencyBuffer` input comes from `metricAggregation.ts:171`
(liquid-incl-shares ÷ ALL declared monthly expenses), **not** from `snapshot.emergencyFund.monthsCovered`,
so changing the emergency-fund page's runway semantic does not touch this engine's inputs.
Arithmetic check even if it were repointed: current benchmark logic saturates at ≥6 months
(`createMetric` value/benchmark cap 100) — 11.6 → 72.6 months is 100 → 100. No move.
Any deliberate repointing of the health engine's liquidity inputs onto the canonical runway is a
**decision** (below), not part of the D3/D4 migration, and would change this score — do not conflate.

## decisionsRequired

1. **Name in the UI:** D13 names the four quantities internally; should surfaces label them distinctly
   (e.g. Home "Financial Health", Safety Net "Safety Score") so 54-vs-63 stops reading as a bug?
   Copy decision for Reza.
2. `/api/financial-health` has **no page consumer** — keep as API-only + snapshot trigger, or wire the
   snapshot recorder elsewhere and retire the route? (Dead-surface question; §12.1.)
3. Should the health engine's LIQUIDITY inputs eventually read the canonical survival runway
   (post-MON-132)? Changes the score; needs its own expectedMoves if chosen.
4. The insights-route 4-component "breakdown" duplicate (`:362–365`): delete in Phase B by serving the
   real 7-category breakdown, or keep as a labelled simplified view? (It visually implies it IS the
   score's composition — it is not.)

## coverageBoundary

Read at HEAD: `aggregateEngine.ts` (full), `metricAggregation.ts:1–200,440–460`, `categoryScoring.ts`
(weights structure), `insights/route.ts:217–540`, `financial-health/route.ts` (anchors),
`intelligenceEngine.ts` (score-relevant lines), `scoreCalculator.ts:1–120,190–220,487–698`.
NOT read: `riskModelling.ts`, `buildHealthInput.ts` internals (input-quality claims — MON-001 class —
are **not** verified here; a correct formula over bad facts is still wrong), the remaining ~19
`healthScore` census regex hits inside admin/labs/tests not enumerated above. Verifies the producer
map and formula shape; does NOT verify the numeric correctness of category inputs.

*Drifted anchors found:* Neomatrix evidence strings cite `aggregateEngine.ts:343/:347` for
`generateHealthReport`/`generateHealthScore`; at HEAD they are `:373/:346` (MON-134 insertions).
D13's `masterFinancialService:1434` is now `:1404` (function) / `:1431–1436` (weighted sum).
