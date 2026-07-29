# trailing3MonthActualSpendAverage

> MON-131 Phase A Quantity Contract (READ-ONLY census artefact, 2026-07-29, HEAD `2f9f2e16`).
> **The FIFTH distinct spending semantic** — found by this pass, previously unnamed (it was
> travelling under the `trailing12MonthActualSpend` label; see that contract's traceback of the
> $25,973 census value to THIS producer). DIFFERENT-QUANTITY vs both the 12-month average and
> the current-month sum.

## classification

**DERIVED** — computed from `UnifiedTransaction` FACT rows. Never stored.

## semantic

- **Basis:** ACTUAL transactions. **Window:** the **3 full calendar months immediately before**
  the current in-progress month (actualCashflow.ts:127-137).
- **Divisor:** data-driven — only months in that window with ≥1 non-transfer transaction count
  toward sum AND divisor; a month with no transactions is missing data, not zero spend
  (:171-179, 2026-06-23 cashflow-SSOT audit). Divisor floored at 1.
- **Inclusions:** all non-transfer OUT magnitudes (loan repayments, one-offs, uncategorised —
  everything that actually left the accounts). **Exclusions:** transfers; the current month.
- **Units:** AUD/month (an average, i.e. a rate). Inflow sibling `avgMonthlyInflow` same rules.
- **Purpose:** the smoothed burn for rate/runway tiles — deliberately short-window so it tracks
  the user's CURRENT life, at the cost of volatility vs the 12-month average.

## canonicalHome

`lib/calculations/actualCashflow.ts:104` `computeActualCashflow()` → `avgMonthlyOutflow`
(:139-190). PURE. Verified at HEAD. Input: master's 4-month fetch
(`masterFinancialService.ts:800-804` — exactly current + the 3 trailing full months; the fetch
window and the engine window are coupled by construction — widen one without the other and the
average silently changes basis).
**Decimal twin: NOT ESTABLISHED.**

## callSites

| Site | Tag | Arithmetic in words |
|---|---|---|
| `lib/calculations/actualCashflow.ts:163-190` | **CANONICAL** | Σ trailing OUT ÷ populated-month count |
| `lib/services/masterFinancialService.ts:2035-2037` | CONSUMER (load-bearing) | emergency-fund burn = this quantity when `hasActualData`, else declared `monthlyExpenses.recurring.total` (MON-011 fallback) → `emergencyFund.monthsCovered`, transitively the health score |
| `lib/services/masterFinancialService.ts:2134` | CONSUMER | `quickMetrics.actualAvgMonthlyOutflow` passthrough |
| `lib/calculations/canonicalCashflow.ts:90,:125` | CONSUMER | `avgMonthlyOutflow` for rate/runway; falls back to current-month outflow when the average is 0 (sparse history) |
| `app/api/cashflow/summary/route.ts:108` | CONSUMER | actuals-first forecast basis |
| `lib/reports/contextBuilder.ts:234` | CONSUMER | report runway burn |
| `lib/calculations/moneyStoryTrend.ts:224-227` | **DIFFERENT-QUANTITY** | 12-month-window populated-complete-month average (own contract) |

NOT EXAMINED: `emergencyMonths` census family (14 sites) beyond the master path; `liquidCash`
family interactions; safety-net page components.

## invariants

1. A window month with no transactions is excluded from sum AND divisor; a populated low-spend
   month still counts (:171-179).
2. 0 populated months → average is 0 AND `hasActualData` gates every consumer to the declared
   fallback — a 0 average is never rendered as a real $0 burn.
3. The current in-progress month never enters this average.
4. **NOT an invariant:** this average === the 12-month average — coincides only under ≤3
   populated complete months (the census-data coincidence; see the trailing-12 contract).
5. **NOT an invariant:** declared recurring run-rate ≤ this average (different bases; neither
   bounds the other — see the run-rate contract).

## independentExpectation

Arithmetic identity over `UnifiedTransaction`: bucket the 3 prior calendar months' non-transfer
OUT magnitudes, divide by populated-month count. Hand-checkable; no legislation.

## surfaces

- Home + Safety Net → emergency-fund "months covered" tile (the 11.6-months figure of
  CHANGELOG_2026_07_19: `301,808 ÷ 25,973 = 11.62`)
- `/cashflow` summary → forecast/runway basis
- Reports → runway context

## expectedMoves

- **NO movement from Tranche 3** — transaction-based; the one-off gate cannot touch it.
- **WILL move under MON-132 (D3+D4, T6):** the survival-runway decision replaces this quantity
  as the runway denominator with `essential incl. loan repayments − salary-independent income`
  (a DECLARED-side composition) — census arithmetic pre-written in D4: burn ≈ $14,261 − $10,102
  ≈ $4,159/mo → ~72 months vs 11.6 shown. That is a T6 pre-declared move, not a T3 one, and it
  changes the QUANTITY the tile reads, not this producer's output.
- **MON-135 does NOT block this contract.**

## decisionsRequired

- **D-F (product, feeds D-C in the trailing-12 contract):** name this quantity in the register
  as its own row (`trailing3MonthActualSpendAverage` or similar) and re-anchor the
  `trailing12MonthActualSpend` row to `moneyStoryTrend.ts`. Two windows exist by design (short =
  responsive burn, long = stable trend); collapsing them to one would destroy a real figure —
  but each surface must state which it shows.
- **D-G (product, interacts with D3/D4):** post-MON-132, does this actuals burn retain any
  runway surface (e.g. as a labelled "recent actual burn" reference) or is it fully superseded
  as a runway denominator? Options: keep as labelled reference (behaviour-psych lens: shows plan
  vs reality) / retire from runway surfaces entirely. Not chosen here.

## coverageBoundary

Examined: the producer fully; the master emergency-fund path; canonicalCashflow; cashflow/summary
:108; reports contextBuilder :234; the D3/D4 register rows. NOT examined: the 14-site
`emergencyMonths` census family sweep; health-score transitive consumers; safety-net components.
Verifies the producer, window coupling, and named consumers; does NOT verify every runway
renderer.

## Adversarial review (§7) — 2026-07-29

- Claims checked: 17 (anchors 10 · arithmetic 4 · negative-claims 3)
  - Anchors re-verified at HEAD `72b15268`: actualCashflow.ts:127-137 (the 3 full months immediately before the current month), :163-190 (Σ trailing OUT ÷ populated count), :176-179 (divisor counts months with ANY non-transfer tx, floored at 1); masterFinancialService.ts:800-804 (4-month fetch — window coupling as claimed, `getMonth() − 3, 1`), :2035-2037 (emergency burn = `avgMonthlyOutflow` when `hasActualData`, else `monthlyExpenses.recurring.total` — MON-011 fallback, verbatim in code), :2134 (`actualAvgMonthlyOutflow` passthrough); canonicalCashflow.ts:90 (fallback to current-month outflow when average is 0) /:125; cashflow/summary :107-110 (`monthlyOutflow = hasActualData ? actualAvgMonthlyOutflow : declared`); reports contextBuilder :233-235 (same rule).
  - Arithmetic recomputed: 301,808 ÷ 25,973 = 11.62 ✓; D4: 14,261 − 10,102 = 4,159 ✓ and 301,808 ÷ 4,159 ≈ 72.6 → "~72 months" ✓ (corroborated at `REFERENCE_NUMBERS_DESIGN.md:152`).
  - Divisor nuance cross-checked against the sibling: this engine's populated-month test is in-OR-out (:176-178); the 12-month engine's is per-series (`spent > 0`). The contract's invariant 1 ("a populated low-spend month still counts") is correct for THIS engine.
- REFUTED / CORRECTED: **none**.
- Could not verify: the 14-site `emergencyMonths` family sweep, health-score transitive consumers (declared boundary); runtime values.
- Verdict impact: none. The FIFTH-semantic finding, the window-coupling hazard, and the MON-132 pre-declared move all stand. **PASS — contract survives unchanged.**
