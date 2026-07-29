# assetsLiabilitiesBreakdown — Quantity Contract (MON-131 Phase A)

Census: 24 sites. Verdict: **MULTIPLE** — canonical engine + 3 duplicates + 2 wrong-input consumers + several different-quantities/false-positives (the `nearArith('totalAssets|totalLiabilities')` signature over-matches score/copy sites).

## classification
DERIVED (D1). The classed totals: `AssetSummary {properties, accounts, investments, superannuation, personalAssets, total}` and `LiabilitySummary {mortgages, personalLoans, creditCards, total}`.

## semantic
Identical to the net-worth contract's asset/liability class definitions (same engine, same PR — see `net-worth.md §semantic`). Key explicit calls:
- **Investments at MARKET** (`units × (currentPrice || averagePrice)`) + investment-account cash (MON-013). Cost-basis anywhere else is a semantic fork, not this quantity.
- **SMSF member balances excluded** from the super class (Phase 39.5 double-count guard).
- **Negative CREDIT_CARD account balances live inside `assets.accounts`**, NOT in `liabilities.creditCards` (loans-only). Any consumer that assumes card debt is fully in liabilities is wrong for the account-card topology (the live one — VR-007/VR-017).
- Loan classification vocabulary: `HOME`/`INVESTMENT`/`propertyId` → mortgages; `CREDIT_CARD` → creditCards; else personalLoans (incl. HECS, car).

## canonicalHome
`lib/calculations/netWorthCalculator.ts:calculateTotalAssets` (:119) / `calculateTotalLiabilities` (:201) · Decimal twins `calculateTotalAssetsDecimal` (:335) / `calculateTotalLiabilitiesDecimal` (:394). All verified at HEAD.

## callSites
| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/calculations/netWorthCalculator.ts:119/201/335/394` | CANONICAL | class reduces per §semantic |
| `lib/calculations/assetValuation.ts:51` `sumHoldingsMarketValue` (+`holdingMarketValue` :44) | CONSUMER (sanctioned mirror) | states the holdings-valuation formula a second time, documented as "mirrors calculateTotalAssets exactly". Drift risk: two statements of one formula — candidate to be imported BY the calculator rather than beside it |
| `lib/health/buildHealthInput.ts:50` (:69–74) | **DIFFERENT-QUANTITY** | health-input scope: properties + ALL accounts + holdings-at-COST; NO super/personal/investment-cash; liabilities = flat Σ Loan.principal (unclassified). See net-worth contract |
| `lib/intelligence/portfolioEngine.ts:313` `calculateNetWorth` | CONSUMER, **WRONG-INPUT** | delegates to canonical but omits the `investmentAccounts` arg → investment-account cash missing from AI/strategy totals (MON-013 gap). Maps super+personalAssets into `assetBreakdown.other` |
| `lib/intelligence/portfolioEngine.ts:440` `calculateGearing` (:444–445) | CONSUMER, **WRONG-INPUT (register-flagged bug)** | `totalDebt = liabilityBreakdown.mortgages + creditCards` — **omits personalLoans** → debtToAsset/debtToIncome understated. Verified at HEAD: function at :440, omission at :444 |
| `lib/intelligence/portfolioEngine.ts:508` `calculateRisk` | CONSUMER | concentration % = class ÷ canonical totalAssets |
| `lib/reports/contextBuilder.ts:178` (:199–222) | **DUPLICATE** | re-derives totals from raw rows; scope omits super + personalAssets + investment cash; liabilities via `sumLoanBalances` |
| `lib/reports/contextBuilder.ts:283` `calculateHealthScore` | CONSUMER | threshold banding on netWorth/liabilities; no derivation |
| `lib/reports/generators/index.ts:115` | CONSUMER | formats context.netWorth into copy |
| `lib/strategy/analyzers/riskAnalyzer.ts:46` (:56–59) | **DUPLICATE (wrong scope)** | `totalAssets = propertyValue + investmentValue` — omits accounts/cash/super/personal; `totalDebt` from `l.balance` alias. Concentration base built on a partial total |
| `lib/strategy/analyzers/liquidityAnalyzer.ts:41` (:55–60) | **DUPLICATE (wrong scope)** | `totalAssets = cash + investments + property` — omits super/personal; denominates liquidityRatio |
| `lib/intelligence/insightsEngine.ts:644` (:648–650) | CONSUMER + DIFFERENT-QUANTITY | reads SnapshotV2 accounts total; derives months-of-buffer (an emergencyMonths quantity) on GROSS accounts — wrong-input for that quantity (see liquid contract) |
| `components/balances/HiddenWealthLens.tsx:123` (:140–144) | CONSUMER | bucket percentages over netWorth/totalAssets; render-side only |
| `lib/ai/services/financialAdvisor.ts:106/434` | CONSUMER | packages snapshot totals into AI context (per-property equity inline — see property-equity contract) |
| `app/dashboard/page.tsx:483` `generateInsights` | FALSE-POSITIVE | savings-rate copy; no assets/liabilities derivation |
| `app/dashboard/entities/[id]/connect-bookkeeping/page.tsx:485` `SnapshotCard` | DIFFERENT-QUANTITY (accounting) | renders bookkeeping AccountingSnapshotSummary (P&L/BS domain), not household net worth |
| `app/api/portfolio/snapshot/route.ts:143` `calculateLinkageHealth` | DIFFERENT-QUANTITY | linkage/completeness scores; census matched score arithmetic |
| `lib/cfo/intelligenceEngine.ts:155` `calculateMonthlyProgress` | CONSUMER | net-worth Δ from stored `NetWorthSnapshot` history (canonical reader per header comment) |
| `lib/health/riskModelling.ts:323` `analyzeConcentrationRisk` | CONSUMER | thresholds over pre-aggregated metrics |
| `lib/strategy/forecasting/forecastEngine.ts:244` | DIFFERENT-QUANTITY | projected totals (forecastFlows) |
| `lib/testing/exporter.ts:76` · `lib/testing/index.ts:137` | CONSUMER (harness) | scenario export / output verification |

## invariants
1. `assets.total == Σ(five classes)`; `liabilities.total == Σ(three classes)` (exact, both Float and Decimal).
2. Float ≡ Decimal parity on identical inputs.
3. Accessibility partition: `liquidToday + accessible + lockedLongTerm == assets.total − liabilities.total` on the SAME scope (selfAuditInvariants I3) — the "liquid + non-liquid classes == total" identity holds only through the bucket construction, because liquid cash nets card debt that sits inside `assets.accounts`.
4. SMSF exclusion: adding an SMSF-fundType super row must not change `assets.superannuation`.
5. Live reference: components must sum to netWorth **$3,401,782** (RENDERED_PART_C).

## independentExpectation
Arithmetic identity per class from FACT rows (see net-worth contract). Class membership is checkable against the schema enum values — no legislation.

## surfaces
- `/dashboard/balances` → Hidden Wealth lens component amounts (cash/investments/property equity/super/personal/cards/long-term debt).
- `/dashboard` → totalAssets/totalLiabilities via quickMetrics.
- `/dashboard/reports` → summary totals (currently the contextBuilder DUPLICATE).
- `/portal/clients/[id]` → canonical dashboard tiles.
- CFO chat + strategy recommendations (via portfolioEngine WRONG-INPUT path).

## expectedMoves
- Master snapshot class paths (`…getMasterFinancialSnapshot.netWorth.assets.*` / `.liabilities.*`): **NO movement** in T5 — already canonical.
- Gearing fix (include personalLoans): `debtToAssetRatio`/`debtToIncomeRatio` **INCREASE** wherever rendered (strategy/AI). Not in the 7 golden captures — Ring-3 on CFO surfaces; `lib/cfo/riskRadar.ts:scanForRisks.*` capture may move indirectly if it consumes gearing (not verified — flag for the tranche build).
- riskAnalyzer/liquidityAnalyzer duplicates → canonical totals: concentration/liquidity ratios **DECREASE** (denominator grows by accounts/super/personal).
- contextBuilder → canonical: report totalAssets **INCREASES** (adds super + personal + investment cash).

## decisionsRequired
1. `assetValuation.ts` mirror: fold into the calculator (single statement) or keep as the shared helper the calculator itself imports. Mechanical, but changes which file is "the" formula.
2. riskAnalyzer's investable-only asset base: if concentration is *meant* to be over investable assets (property+investments), that is a legitimate DIFFERENT-QUANTITY needing a name (`investableAssetsTotal`); if not, it is a wrong-scope duplicate. The adviser-lens consequence: concentration warnings today over-fire (smaller denominator).

## coverageBoundary
Every table row above was opened at the cited lines EXCEPT: `lib/testing/*` bodies (role-tagged), `financialAdvisor.ts:106` (only :434-460 opened), `connect-bookkeeping` SnapshotCard internals beyond :505. Decimal-twin fixture coverage (calc-audit `core.netWorth`) noted from netWorthCalculator JSDoc, not re-run. Verifies topology, not live values.
