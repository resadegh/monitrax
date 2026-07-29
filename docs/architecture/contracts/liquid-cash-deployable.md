# liquidCashDeployable — Quantity Contract (MON-131 Phase A)

Census: 58 sites (the `nearArith('liquid')` signature over-matches heavily — most hits are liquidity SCORES, impact weights, or renders, not producers of the cash stock). Verdict on the stock itself: **MULTIPLE** — 1 canonical + 4 duplicate/wrong-basis gross variants + 1 settled DIFFERENT-QUANTITY (D5 → own contract: `accessible-funds-incl-shares.md`).

## classification
DERIVED (D1). D5 (SETTLED, design record §6): liquid = **cash equivalents ONLY** (AASB 107). Shares/ETFs are a separate LABELLED quantity; SMSF excluded from both.

## semantic
DEPLOYABLE cash (Reza 2026-07-18, MON-031/064 + VR-017 re-fix):
- `gross` = Σ `Account.currentBalance` where `type ∈ LIQUID_ACCOUNT_TYPES = {SAVINGS, TRANSACTIONAL, OFFSET, CASH}` (`lib/types/prisma-enums.ts:34`).
- `accountCardDebt` = Σ `max(0, −balance)` over `CREDIT_CARD`-typed accounts (the live topology).
- `revolvingCredit` = accountCardDebt + `max(0, creditCardLoanTotal)` (card debt as `Loan` rows — caller passes `liabilities.creditCards`).
- **`net` = gross − revolvingCredit` — THE canonical figure.** Both card representations netted; an overpaid card (positive balance) contributes zero and its credit balance is NOT gross (CREDIT_CARD ∉ liquid types).
- Exclusions, explicit: shares/ETFs/managed funds/crypto (D5), super (all fund types), term deposits and any non-liquid-typed account, property, personal assets.

## canonicalHome
`lib/calculations/liquidCash.ts:computeLiquidCash` (:63) · Decimal twin `computeLiquidCashDecimal` (:92). Verified at HEAD. Assembled once into `quickMetrics.liquidCash` at `lib/services/masterFinancialService.ts:1978`.

## callSites
**Producers / duplicates (the load-bearing rows):**
| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/calculations/liquidCash.ts:63/92` | CANONICAL | per §semantic |
| `lib/services/masterFinancialService.ts:1978` | CONSUMER (assembler) | calls canonical with accounts + loan-card total; publishes `.net` as quickMetrics.liquidCash |
| `lib/cfo/scoreCalculator.ts:199` / `:499` (emergency buffer) | CONSUMER | calls canonical directly with same inputs (Float + Decimal) |
| `lib/calculations/accessibilityBuckets.ts:91–101` | CONSUMER | reconstructs gross by adding back the LOAN card component only (account component already negative inside assets.accounts); `liquidToday == liquidCash` by construction (ring2.liquidCashParity tests) |
| `lib/cfo/riskRadar.ts:204` `detectCashflowShortfallRisks` | **DUPLICATE** | `totalLiquid` = Σ balances of {SAVINGS, TRANSACTIONAL, OFFSET} — omits CASH type, no card netting → gross, overstated depletion runway |
| `lib/reports/contextBuilder.ts:231` | **DUPLICATE (wrong basis)** | report `liquidAssets = ALL account balances + ALL investments at market` — includes cards (negative), term deposits, every investment; runway base in an adviser-facing report |
| `lib/calculations/netWorthCalculator.ts:264` (+ Decimal :454) `breakdown.liquidAssets` | **DUPLICATE, UNNAMED** | non-OFFSET accounts, gross — contradicts D5's producer (OFFSET *is* liquid there); includes negative card balances |
| `app/dashboard/balances/page.tsx:716` | **DUPLICATE (gross variant)** | "Cash" tile = Σ {OFFSET, SAVINGS, TRANSACTIONAL} balances — omits CASH type; credit shown separately, so netting is presentational, but the CASH-type omission is a wrong-input |
| `lib/intelligence/insightsEngine.ts:648` | WRONG-INPUT consumer | uses `snapshot.assets.accounts.totalValue` (ALL accounts, gross) as "cash" for a months-of-buffer derive |
| `lib/health/metricAggregation.ts:129` `calculateLiquidAssets` | **DIFFERENT-QUANTITY (D5-settled)** | positive non-card account balances + SHARE/ETF value → the shares-inclusive quantity. RENAME, don't delete → `accessible-funds-incl-shares.md` |
| `lib/strategy/analyzers/liquidityAnalyzer.ts:44–53` | DIFFERENT-QUANTITY (second shares-inclusive variant) | availableCash + `isLiquid !== false` investments at currentValue → liquidityRatio base. See accessible-funds contract |
| `lib/cfo/decisionSupport/loanDecisionSupport.ts:631–632` | **DIFFERENT-QUANTITY (census-missed — added by §7 review)** | `totalSavings` = Σ balances of {SAVINGS, TRANSACTIONAL} only — the offset-underutilisation comparator ("savings that could sit in offset"). Omits OFFSET (deliberately — it is the comparison target) and CASH; no card netting. Missed by the `nearArith('liquid')` census signature (no 'liquid' token in the code). Not the deployable stock; needs its own name if kept, or re-founding on canonical gross components in Phase B |

**Consumers of quickMetrics.liquidCash (verified reads, no derivation):** `app/api/safety-net/route.ts:42` (+ scenario months :103–115) · `app/api/dashboard/insights/route.ts:284` · `lib/cashflow/savingOpportunities.ts:72/118` · `lib/cfo/scenarios/{sellProperty:71,redirectToOffset:53,cutSpendCategory:48}` · `lib/services/masterFinancialService.ts:1380` buildEmergencyFundMetrics (months = liquid ÷ expenses — an emergencyMonths quantity) + `:2125` freeCashDays · `components/portal/clients/ClientCanonicalDashboard.tsx:55` · `components/dashboard/InsightWidgets.tsx:181` · `app/dashboard/cfo/what-if/[lever]/page.tsx:1712` (renders scenario delta) · `lib/verification/selfAuditInvariants.ts:94` (I3 harness).

**Score/copy/harness sites (census over-match, no stock derivation):** `healthScoreAggregator:248`, `categoryScoring:150`, `riskModelling:181/263`, `scoringEngine:49/160`, `strategySynthesizer:370/441`, `debtAnalyzer:197/382/444` (liquidity impact weights), `cashflowAnalyzer:89`, `safeguards:77` (TODO stub), `insightGenerator:75`, `cfo/intelligenceEngine:239/339` (month-end projection consumes canonical total per header), `canonicalCashflow:157` (comment), `MarginTrendLens:101` (copy), `HowItWorks:198` (marketing static), `cashflow/intelligence route:334` (score), `riskRadar:150` (per-account low-balance check, not an aggregate), calc-audit `decimal-cfo-*` engines (fixture twins).

## invariants
1. `net == gross − revolvingCredit`; `revolvingCredit == accountCardDebt + max(0, loanCardTotal)`.
2. Bucket identity: `buckets.liquidToday == quickMetrics.liquidCash` for every card topology (loan-card / account-card / mixed — `tests/golden/ring2.liquidCashParity*.test.ts`).
3. Float ≡ Decimal parity.
4. Live reference: **$301,808** = gross $304,304 − account-card $2,496 (worked example, liquidCash.ts header; RENDERED_PART_C.liquid).
5. Cross-contract: liquid (cash-equivalents) + labelled shares line + everything else must reconcile to totalAssets on the same scope — checkable only after the D5 relabel ships both named quantities.

## independentExpectation
Arithmetic identity over `Account` FACT rows: Σ balances of the four liquid types − card debt in both representations. AASB 107 (cash & cash equivalents) is the classification authority for WHAT counts — the arithmetic itself is hand-derivable from a DB dump.

## surfaces
- `/dashboard/safety-net` → "Liquid savings" (api/safety-net → quickMetrics.liquidCash).
- `/dashboard` → EmergencyFundTracker widget "Liquid savings".
- `/dashboard/balances` → Hidden Wealth "Liquid today"; ALSO the separate "Cash" totals tile (the :716 gross variant — different number on the same page, by design gross vs net; must be LABELLED once migrated).
- `/dashboard/cfo/what-if/[lever]` → "Liquid cash" before/after impact.
- `/portal/clients/[id]` → "Liquid cash" tile.
- `/dashboard/reports` → runway (currently the contextBuilder wrong-basis duplicate).

## expectedMoves
- **Canonical paths: NO movement from D5** — the canonical is already cash-equivalents-only. `…getMasterFinancialSnapshot.quickMetrics.liquidCash` stays $301,808. Strongest prediction.
- D5 relabel (metricAggregation rename): **NO numeric movement anywhere** — a rename plus a new labelled UI line. Any moved number falsifies the relabel PR.
- riskRadar :204 → canonical: `lib/cfo/riskRadar.ts:scanForRisks.*` capture paths for shortfall risks — depletion months **DECREASE** (net < gross) unless CASH-type accounts exist (would push up); state per-datum in the tranche PR.
- contextBuilder :231 → canonical: report runway **DECREASES sharply** (drops all investments + nets cards). No golden capture; Ring-3 on /dashboard/reports.
- balances :716 → canonical gross: "Cash" tile **INCREASES** by any CASH-typed account balances; unchanged when none exist.
- netWorthCalculator :264 rename/re-found: breakdown.liquidAssets consumers move by (OFFSET balances − negative card balances) if re-founded on canonical gross; pathPrefix `…getMasterFinancialSnapshot.netWorth.breakdown.liquidAssets`.

## decisionsRequired
1. **`breakdown.liquidAssets` (netWorthCalculator:264)** — not settled by D5's text: (a) re-found on `computeLiquidCash().gross` (OFFSET back in, cards out) — consumers move; (b) rename to `nonOffsetAccountsTotal` and keep — zero movement, honest label. Consequence: (a) makes one gross basis app-wide; (b) preserves history but keeps a third cash basis alive under a better name.
2. **Balances "Cash" tile basis** — gross-spendable (canonical `.gross`) vs deployable (`.net`)? Page currently shows cash and credit as separate lines; recommend gross + CASH-type fix, but gross-vs-net on this tile is a product call.

## coverageBoundary
All producer/duplicate rows opened at cited lines. Of the 58 census sites, 11 tagged from grep-window sampling only (score/impact-weight group — arithmetic shape confirmed as score math, full function bodies not read): debtAnalyzer×3, cashflowAnalyzer, taxAnalyzer, strategySynthesizer×2, scoringEngine×2, categoryScoring, riskModelling:181. calc-audit decimal-cfo engines tagged as fixture twins from filename+role. Verifies topology, not live values.

## Adversarial review (§7) — 2026-07-29
- Claims checked: 34 (anchors 24 · arithmetic 7 · negative-claims 3)
- REFUTED / CORRECTED:
  - **Census completeness — CORRECTED.** Independent sweep for liquid-type balance sums (`LIQUID_ACCOUNT_TYPES` + `SAVINGS/TRANSACTIONAL` filter-reduce shapes) found one partial cash aggregation absent from the 58-site census: `lib/cfo/decisionSupport/loanDecisionSupport.ts:631–632` (`totalSavings` = Σ SAVINGS+TRANSACTIONAL, offset-underutilisation comparator). Added to the table as a census-missed DIFFERENT-QUANTITY candidate. The `nearArith('liquid')` signature cannot see it — a signature-coverage lesson for the A0 census re-run.
- Verified intact (no drift): canonical `liquidCash.ts:63/:92` — full semantic confirmed in source (LIQUID_ACCOUNT_TYPES = {SAVINGS, TRANSACTIONAL, OFFSET, CASH} at `prisma-enums.ts:34` EXACT; per-account `max(0, −balance)` card debt; `max(0, creditCardLoanTotal)`; overpaid-card exclusion per header); **worked example recomputed: $304,304 − $2,496 = $301,808 ✓** (header + `RENDERED_PART_C.liquid` at `goldenBaseline.ts:75` block); assembler `masterFinancialService.ts:1978` EXACT; `scoreCalculator.ts:199/:499` both call canonical EXACT; buckets `:91–101` loan-component-only add-back EXACT (+ header proof); riskRadar duplicate — function `detectCashflowShortfallRisks` at `:192`, the {SAVINGS, TRANSACTIONAL, OFFSET} filter at **:204 EXACT** (CASH omitted, no netting — claim confirmed); contextBuilder `:231` `accountBalances + investmentValue` EXACT (all accounts incl. negative cards + all investments at market — claim confirmed); netWorthCalculator `:264/:454` non-OFFSET gross EXACT (OFFSET excluded there vs OFFSET-in-D5 — contradiction claim confirmed); balances `page.tsx:716` {OFFSET, SAVINGS, TRANSACTIONAL} tile EXACT (CASH omission confirmed; credit a separate line); insightsEngine gross-accounts buffer at `:647–649` (contract's :648 within ±1); metricAggregation `:129` → accessible-funds ✓. Consumers spot-verified: safety-net `:42/:103–115`, insights `:284`, savingOpportunities `:72/:118`, scenarios (sellProperty `:71`, redirectToOffset `:53`, cutSpend `:48`), MFS `:1380/:2125`, ClientCanonicalDashboard `:55`, what-if `:1712`, selfAuditInvariants I3 `:94` — all reads, no derivation, as tagged.
- Could not verify: the 11 grep-window-sampled score/impact-weight sites (disclosed in coverageBoundary) — two spot-checks (`safeguards` → actual path `lib/strategy/core/safeguards.ts`, liquidity content ~:85; `insightGenerator` → `lib/cashflow/insightGenerator.ts`) show the shorthand anchors in that list are imprecise on path/line, but both files contain only score/threshold logic, no stock derivation — the negative claim holds; MarginTrendLens lives at `components/budget/` (copy-only, as tagged).
- Verdict impact: **none** — canonical verdict, D5 split, and the strongest no-move prediction ($301,808) all stand; census table grows by one missed site (above).
