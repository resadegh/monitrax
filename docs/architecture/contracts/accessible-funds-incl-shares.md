# accessibleFundsInclShares — Quantity Contract (MON-131 Phase A)

**The D5 "other named quantity."** D5 (SETTLED): `metricAggregation.ts:129` "liquid incl. shares" is NOT a bug to delete — it is a legitimately different quantity that never had a name. Proposed name: **`accessibleFundsInclShares`** ("Accessible funds — cash + listed investments"). This contract names it; it does not decide it into existence beyond D5's mandate.

## classification
DERIVED (D1). Verdict: **UNNAMED + MULTIPLE** — two variants of the same concept with different bases, neither canonical.

## semantic (as implemented today — variant A, the health engine)
`lib/health/metricAggregation.ts:calculateLiquidAssets` (:129, header comment :130 "Liquid = Cash accounts + liquid investments (shares, ETFs)") — verified at HEAD:
- cash component: Σ `max(0, balance)` over accounts where `type !== 'CREDIT_CARD'` — per-account negative floor; cards excluded (NOT netted — differs from the deployable quantity's netting);
- investments component: Σ `value` over holdings where `type ∈ {SHARE, ETF}` — **valued at COST** (`units × averagePrice`) because `buildHealthInput.ts:123–128` builds `value` from averagePrice; MANAGED_FUND/CRYPTO excluded;
- SMSF: excluded by construction (buildHealthInput never loads super) — D5-consistent;
- units: AUD/month-independent stock.

## semantic fork — variant B (strategy engine)
`lib/strategy/analyzers/liquidityAnalyzer.ts:41` `assessLiquidity` (:44–53): `totalLiquidAssets = cashflowSummary.availableCash + Σ currentValue over investments with isLiquid !== false`. Same concept ("cash + sellable investments"), THREE forks vs variant A: (1) **market** value vs cost; (2) `isLiquid` flag vs type-list membership; (3) `availableCash` (a cashflow figure) vs account balances. **Investments at cost vs market is the named semantic fork** — two engineers implementing "accessible funds" from the label alone would land on different numbers.

## canonicalHome
**NOT ESTABLISHED.** Candidate: rename `calculateLiquidAssets` → `computeAccessibleFunds` in a canonical `lib/calculations/` home. **No Decimal twin exists for either variant — NOT ESTABLISHED.**

## callSites
| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/health/metricAggregation.ts:129` | PRODUCER (variant A — survives, renamed per D5) | per §semantic |
| `lib/health/metricAggregation.ts:166` `calculateLiquidityMetrics` (:163) | CONSUMER | cash-reserve months = accessibleFunds ÷ monthly expenses (an emergencyMonths-family derive on THIS basis, not the deployable basis) |
| `lib/health/metricAggregation.ts:443` `calculateRiskMetrics` (:441) | CONSUMER | liquidity-risk banding over the same figure |
| `lib/strategy/analyzers/liquidityAnalyzer.ts:41` | PRODUCER (variant B — to converge or be separately named) | per §semantic fork |
| `lib/health/categoryScoring.ts:165` `scoreLiquidityCategory` | CONSUMER | weights the liquidity metrics into the health category score |

## invariants
1. accessibleFundsInclShares ≥ the cash component (shares term is non-negative).
2. It is NOT comparable to `liquidCashDeployable` by subtraction alone: the two differ in card treatment (excluded-not-netted vs netted), account-type scope (all-non-card vs four liquid types), AND per-account flooring. Any UI placing both on one surface must label both (D5's "separate LABELLED line").
3. On a dataset with no SHARE/ETF holdings and no negative balances and no term deposits/cards: variant A == computeLiquidCash().gross — a useful fixture identity for the rename PR.

## independentExpectation
Arithmetic identity over Account + InvestmentHolding FACT rows per §semantic. No legislation; AASB 107 is what SEPARATES this quantity from liquid cash (shares are not cash equivalents), not what defines it.

## surfaces
No surface renders this stock as a labelled dollar figure today — it feeds the health Liquidity category (cash-reserve-months, liquidity-risk) shown on `/dashboard/guide` (Health) and the strategy engine's LIQUIDITY_LOW findings. D5's "separate labelled line" (Safety Net / balances) is NEW surface work for the tranche, not an existing render.

## expectedMoves
- **D5 relabel: NO numeric movement** — rename + JSDoc + (new) labelled UI line. `lib/health/buildHealthInput.ts:buildHealthInput.*` and `lib/health/aggregateEngine.ts:generateHealthReport.*` golden paths must be byte-identical. Strongest prediction; any move falsifies the relabel.
- IF variant B is converged onto variant A later: strategy liquidityRatio moves by (market−cost) delta on SHARE/ETF holdings + the availableCash→balances swap — direction indeterminate without live holdings data; must be predicted per-datum in that PR.

## decisionsRequired
1. **The name.** `accessibleFundsInclShares` proposed; Reza may prefer a warmer label for the UI line (e.g. "Within reach — cash + investments"). Rename is D5-mandated; the NAME itself is his.
2. **Valuation basis for the shares term: cost (variant A today) vs market.** Consequence: cost understates accessible funds in rising markets (conservative — adviser-lens defensible); market matches the net-worth engine's basis (consistency). This is the same cost-vs-market fork flagged in buildHealthInput's header — decide once for both.
3. **Variant B's fate:** converge onto the renamed canonical, or keep `isLiquid`-flag semantics as a third named quantity. Two "accessible funds" with different bases is the exact §12.2.1 violation this programme exists to end — recommend converge, but the `isLiquid` per-holding override is a product feature question.
4. Should MANAGED_FUND be included? ASX-listed funds are sellable in days (variant A excludes; variant B includes when flagged). Accounting consequence: inclusion widens the line beyond "listed shares/ETFs" labelling.

## coverageBoundary
metricAggregation.ts :100–170 and :380–445 read; liquidityAnalyzer :41–75 read; categoryScoring :150–170 grep-window. buildHealthInput read in full (cost-basis provenance verified at :123–128). NOT verified: whether any portal/report surface renders the health liquidity dollar figure directly (searched health consumers only). No Decimal twin exists to audit.

## Adversarial review (§7) — 2026-07-29
- Claims checked: 16 (anchors 9 · arithmetic 4 · negative-claims 3)
- REFUTED / CORRECTED: **none.**
- Verified intact (no drift): variant A `metricAggregation.ts:129–139` EXACT — every semantic detail confirmed in source: header comment at :130, cash = Σ `max(0, balance)` over `type !== 'CREDIT_CARD'` (per-account floor, cards excluded-not-netted), investments = SHARE/ETF only (MANAGED_FUND/CRYPTO out), and the COST-basis provenance at `buildHealthInput.ts:123–128` (`value: units × averagePrice`, "Simplified" comment) — the load-bearing cost-vs-market fork claim is real. Variant B `liquidityAnalyzer.ts:41/:44–53` EXACT — all three forks confirmed (`currentValue` market, `isLiquid !== false` flag, `cashflowSummary.availableCash`). Consumers: `:163/:166` cash-reserve months (division at :171), `:441/:443` risk metrics, `categoryScoring.ts:165 scoreLiquidityCategory` EXACT.
- Negative claims attacked and SURVIVED: (1) **"canonicalHome NOT ESTABLISHED"** — no `lib/calculations/` accessible-funds engine exists (grep). (2) **"No Decimal twin for either variant"** — no Decimal sibling of `calculateLiquidAssets`/`assessLiquidity` exists (grep). (3) **"No surface renders this stock as a labelled dollar figure"** — holds structurally: `LiquidityMetrics`/`RiskMetrics` expose only months/percent ratios (`emergencyBufferMonths`, `liquidNetWorthRatio`, `bufferMonths`), never the raw dollar stock, so no surface CAN render it without a new field; the contract's portal/report hedge in coverageBoundary remains honest.
- Invariant 3 spot-checked: on no-SHARE/ETF + no-negative-balance + no-cards + no-term-deposit data, variant A degenerates to Σ positive non-card balances; `computeLiquidCash().gross` is Σ {SAVINGS, TRANSACTIONAL, OFFSET, CASH} — equality additionally requires *no non-liquid-typed accounts*, which the stated precondition ("no term deposits/cards") covers only if term deposits are the sole non-liquid type in the data; acceptable as a fixture identity since fixtures control the type universe.
- Could not verify: whether any portal/report renders health-liquidity dollar figures (disclosed in coverageBoundary; structural argument above makes it unlikely). Design-record nuance: D5 is "✅ RECOMMENDED (Matrix)" in `REFERENCE_NUMBERS_DESIGN.md:153`, not Reza-DECIDED; brief §3.1(5) declares it settled — the contract follows the brief.
- Verdict impact: **none** — UNNAMED + MULTIPLE verdict and all four decisionsRequired stand. **PASS.**
