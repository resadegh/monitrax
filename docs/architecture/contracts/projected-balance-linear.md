# projectedBalanceLinear — short-horizon linear balance projection

> MON-131 Phase A Quantity Contract. Census key: `forecastFlows` (split 1 of 4 — the census key
> bundles at least four genuinely different projection quantities; see also
> `daily-cash-balance-forecast.md`, `multi-year-wealth-projection.md`, `next-month-spend-forecast.md`).
> READ-ONLY audit at HEAD `2f9f2e16`, 2026-07-29.

## classification

**DERIVED** (D1). Computed from the canonical monthly net + current account balances; never stored.

## semantic

- **Definition:** `projectedBalance(days) = currentBalance + (monthlyNet ÷ 30) × days` — a linear
  roll-forward, month normalised to 30 days.
- **Assumptions:** the canonical monthly net (`getCanonicalMonthlyCashflow(snapshot).net` —
  actuals-first per §19.1) holds constant across the horizon; no intra-month timing, no volatility,
  no events.
- **Horizon:** caller-supplied days — in production: 30 and 90 (`/api/cashflow/intelligence`) and
  days-remaining-to-month-end (My Guide quick stats). Surfaces may only differ by their LABELLED
  horizon, never by method (MON-021).
- **Balance base:** sum of all `Account.currentBalance` (bank accounts) — identical base on both
  consuming surfaces.
- **Units:** AUD.

## canonicalHome

`lib/calculations/canonicalCashflow.ts:189` — `projectBalanceForward(currentBalance, monthlyNet, days)`.

**Decimal twin: NOT ESTABLISHED — and worse, a STALE twin of the pre-MON-021 formula survives.**
`lib/cfo/intelligenceEngine.ts:365` `calculateProjectedMonthEndBalanceDecimal` still encodes the OLD
crude semantic (`liquidBalance − dailyBurn × daysRemaining` — expenses-only, income-blind), while the
Float path it claims to twin (`calculateQuickStats`, `:261`) migrated to `projectBalanceForward`.
This violates "Float and Decimal twins migrate together" (design record §7.4). The calc-audit shadow
`lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts:48` (`projectedMonthEndBalanceFloat`)
fixtures the STALE formula and cites `intelligenceEngine.ts:240-265` as source — an anchor whose code
no longer computes that formula. **Precondition-class finding for Phase B.**

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/calculations/canonicalCashflow.ts:189` | **CANONICAL** | `balance + net/30 × days` |
| `lib/cfo/intelligenceEngine.ts:261` (`calculateQuickStats`) | CONSUMER | month-end balance: canonical net + Σ account balances, days to month end |
| `app/api/cashflow/intelligence/route.ts:505-506` (`buildForecastSummary:495`) | CONSUMER | `balance30`/`balance90` off the same canonical net |
| `lib/cfo/intelligenceEngine.ts:365` (`calculateProjectedMonthEndBalanceDecimal`) | **DUPLICATE (stale twin)** | `liquid − dailyBurn × days` — the pre-MON-021 semantic. To be deleted or re-founded on the canonical formula (Decimal) in the same PR |
| `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts:48` | DUPLICATE (fixture of the stale twin) | shadows the stale formula; must move with it (Neo Inventory rule: the fixture follows the engine, never a second engine) |
| `app/api/cashflow/intelligence/route.ts:509-521` (break-even day, same function) | DIFFERENT-QUANTITY | `breakEvenDay`: first day where cumulative daily income ≥ cumulative daily expense — a separate small quantity (unnamed); also re-derived independently at `app/api/cashflow/route.ts:237` in lite mode (`ceil(monthlyExpenses / (monthlyIncome/30))` — a SECOND break-even producer with different arithmetic). Needs its own name if it survives |

## invariants

1. `projectBalanceForward(b, n, 0) == b`.
2. Linearity: `delta(2d) == 2 × delta(d)` (already locked — `tests/golden/coreEngines.test.ts:205`).
3. Both production consumers feed the SAME canonical net for the same user at the same instant —
   My Guide month-end and /cashflow 30-day may differ only by horizon
   (`tests/cfo/monthEndForecastConvergence.test.ts`).
4. Sign: `monthlyNet < 0 → projected balance strictly decreasing in days`.

## independentExpectation

**Arithmetic identity** — fully checkable: hand-compute `balance + net/30 × days` from the rendered
balance and the rendered monthly net. The 30-day month normalisation is a stated convention, not an
error.

## surfaces

| Route | Label |
|---|---|
| `/cashflow` (app/(dashboard)/cashflow — via `/api/cashflow/intelligence` `forecast.predictions`) | "30-Day Forecast" hero (30/90-day balances, risk levels) |
| `/dashboard/cfo` (My Guide — via CFO intelligence quick stats) | "Month-End Balance" / projectedMonthEndBalance quick stat |
| `/dashboard/plan` | hero summary numbers read the same `/api/cashflow/intelligence` `forecast.current` |

## expectedMoves

- **NO movement** for the rendered 30/90-day and month-end figures from consolidating the stale
  Decimal twin — the twin is not on any rendered path found (exported; imported only by the
  calc-audit shadow AND `tests/cfo/actions-ai-intel.decimal.test.ts:23` — the latter added by the
  adversarial review 2026-07-29; verified by grep). Deleting/re-founding it changes fixtures + that
  contract test, not screens.
- If the break-even duplicate (`/api/cashflow/route.ts:237` lite mode) is collapsed onto the
  intelligence-route loop semantics: break-even day may shift ±1 day on `/cashflow`-family surfaces
  IF anything renders the lite-mode value — no fetcher of `/api/cashflow` was found (see
  daily-cash-balance-forecast.md), so predicted rendered movement: NONE.

## decisionsRequired

- **D-F1 — the stale Decimal twin.** Options: (a) delete `calculateProjectedMonthEndBalanceDecimal`
  + its shadow fixture (no Decimal twin until the Decimal programme reaches this quantity); (b)
  rewrite it as `projectBalanceForwardDecimal` mirroring the canonical formula and re-point the
  fixture. Consequence: (a) shrinks Decimal coverage; (b) keeps twin parity honest. Either way the
  current state — a Decimal "sibling" of a formula the Float no longer uses — must not survive
  Phase B.
- **D-F2 — name the break-even quantity** (two producers with different arithmetic today) or delete
  the lite-mode copy.

## wrong-inputs

Inherits the trustworthiness of `getCanonicalMonthlyCashflow` (the cashflow quantity's contract, T6)
and `Account.currentBalance` freshness. No independent FACT reads of its own. MON-001 reaches this
number only through the canonical net's declared-fallback legs.

## coverageBoundary

READ: `canonicalCashflow.ts:140-196`, `intelligenceEngine.ts:230-380`,
`cashflow/intelligence/route.ts:480-540`, `decimal-cfo-actions-ai-intel.ts:30-70`, the two
convergence/golden tests (headers). NOT READ: `getCanonicalMonthlyCashflow` internals (owned by the
cashflow contract), the /cashflow page render code, plan-page hero mapping beyond `:440-470`.
Anchors verified at HEAD `2f9f2e16`. **Drift found:** the calc-audit shadow's `sourcePath` comment
(`intelligenceEngine.ts:240-265`) describes code that now uses `projectBalanceForward` — stale
documentation anchor inside the fixture.

## Adversarial review (§7) — 2026-07-29

Production code identical between cited audit HEAD `2f9f2e16` and review HEAD `696ec349`.

- Claims checked: 18 (anchors 10 · arithmetic 5 · negative-claims 3)
  - Anchors exact: `canonicalCashflow.ts:189-196` (`balance + net/30 × days` verbatim),
    `intelligenceEngine.ts:239` (`calculateQuickStats`) with the `projectBalanceForward` call at
    `:261` off `getCanonicalMonthlyCashflow(snapshot).net` + Σ `Account.currentBalance`,
    `intelligenceEngine.ts:365-374` (Decimal twin), `intelligence/route.ts:495` /
    `:505-506` (`balance30/90`) / `:508-521` (break-even loop — cumulative-income ≥
    cumulative-expense semantics confirmed), `cashflow/route.ts:237` (lite
    `ceil(monthlyExpenses/(monthlyIncome/30))` — different arithmetic confirmed),
    `decimal-cfo-actions-ai-intel.ts:45-54`, linearity test `coreEngines.test.ts:198-211`
    (cited :205 — inside), `monthEndForecastConvergence.test.ts` exists.
  - **The STALE-TWIN finding CONFIRMED by source diff** (the decision-critical check):
    Float path = `projectBalanceForward` (income-aware canonical net); Decimal twin
    `:371-373` = `lb.minus(db.times(daysRemaining))` — the pre-MON-021 expenses-only formula.
    Its own JSDoc (`:359-360` "Used by the dashboard quick-stats tile") is likewise stale. The
    calc-audit shadow's `sourcePath` comment `intelligenceEngine.ts:240-265` (`decimal…ts:45`)
    points at code that now calls `projectBalanceForward` — stale anchor confirmed.
  - Negative claims held under independent hunt: no other production consumer of
    `projectBalanceForward`; no other linear-projection producer outside the (dead) CFE
    (`forecasting.ts:741` is inside contract 2's unreachable stack); no `dailyBurn` producer
    outside the twin + its shadow.
- REFUTED / CORRECTED:
  1. Minor: "exported but only imported by the calc-audit shadow" — incomplete; also imported by
     `tests/cfo/actions-ai-intel.decimal.test.ts:23`. Fixed inline (verdict unchanged — still no
     rendered path; D-F1 option (a) must also delete that test).
- Could not verify: the /cashflow page's render mapping of `forecast.*` fields and the plan-page
  hero mapping (same NOT-READ boundary the contract states) — surface labels taken on trust.
- Verdict impact: **NO.** The contract survives; the precondition-class stale-twin finding is
  confirmed verbatim in source. PASS.
