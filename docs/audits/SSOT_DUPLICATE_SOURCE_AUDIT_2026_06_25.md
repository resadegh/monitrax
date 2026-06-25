# Comprehensive SSOT / Duplicate-Source Audit — 2026-06-25

> **Commissioned by Reza (2026-06-25):** *"identify all sources of data, sources of calculations, sources of formulas … make sure they are not duplicated in other places of the app … never ever calculate the same formula in different places. Perform the most comprehensive audit that you can perform."*
>
> **Method:** four parallel verified sweeps (duplicate calculations · duplicate data sources · hardcoded constants + declared-vs-actual bypasses · frequency/formatter duplication). Every finding cites a `file:line` read in source (CLAUDE.md §19.2 — no guesses). Governing rule: **CLAUDE.md §12.2 / §12.2.1 / §12.3 / §19.1** — one datum / one calculation / one formula = exactly ONE source.

---

## 0. Executive summary

The audit found **systemic, pervasive duplication** of financial calculations, data aggregation, formatting, and constants — overwhelmingly in `lib/` and `app/api/`, **the two directories the existing surface linter does NOT scan**. Headline counts (CONFIRMED, verified to source):

| Class | Confirmed sites | Worst consequence |
|---|---|---|
| **Wrong-number bug** (stale hardcoded tax brackets) | 1 | Overstates tax for every user (P0 — `suspected-issue`) |
| **Duplicate calculations** (formula re-typed) | ~35 | Emergency-fund months ×9, savings rate ×7, LVR ×7, net worth ×6 — drift across surfaces |
| **Divergent frequency converters** | ~13 | Same income → different monthly total per engine (4.33 vs 52/12; missing QUARTERLY) |
| **Duplicate currency formatters** | ~30 | Each misses the canonical null/Decimal safety → the `$NaN` crash class |
| **Duplicate data sources** (re-aggregation) | ~15 routes | `buildHealthInput` copy-pasted; 3 cashflow routes re-derive the same primitives |
| **Hardcoded tax constants** | ~20 | Super 15% rate hardcoded ×15; thresholds already drifting for FY25-26 |
| **Declared-vs-actual bypasses** (§19.1) | insightsEngine + portal + dashboard | False-optimistic money/advice to users + advisers |

**The structural root cause:** the SSOT *exists* (canonical engines in `lib/calculations`, `lib/utils`, `lib/services`, `lib/tax-engine/config`) but is **not adopted** — and nothing enforces adoption outside `app/dashboard`/`app/portal`/`components`. The lever is (1) extend `lint-financial-surfaces.ts` to scan `lib/` + `app/api/`, and (2) model the surfaces into the Neomatrix so A3 convergence catches divergence.

---

## 1. P0 — wrong number (raise as `suspected-issue`, do NOT silently fix)

| # | Finding | File:line | Evidence |
|---|---|---|---|
| P0-1 | Income-tax bracket table **mislabelled "2024-25" but holds stale FY23-24 values** — first rate `0.19` (FY24-25 = **0.16**); base amounts `5092/29467/51667` (correct = **4288/31288/51638**). Overstates tax for every user at every bracket. Both a §19.2 wrong-number bug AND an SSOT duplication. | `app/api/cashflow/intelligence/route.ts:451-460` | Verified in source 2026-06-25; cross-checked against the Neomatrix A1 audit locks ($45,001→4,288.30, $135,001→31,288.37, $100k→20,788). |

**Action:** replace with `getTaxYearConfig(fy).brackets` (the canonical config — already correct + Neomatrix-audited). Because it changes a user-facing tax number, confirm with Reza before shipping (§19/§21 — suspected issues raised, not auto-fixed).

---

## 2. P1 — duplicate calculations (formula re-typed instead of imported)

Canonical homes: `netWorthCalculator.ts`, `lib/utils/calculations.ts` (LVR/yield/equity), `masterFinancialService.buildEmergencyFundMetrics()` + health-score `savingsRate`/`debtToIncome`.

- **Net worth** (`assets − liabilities`) — re-typed: `app/api/financial-health/route.ts:111-113`, `app/api/dashboard/insights/route.ts:550-555`, `app/api/portfolio/snapshot/route.ts:625-636`, `lib/reports/contextBuilder.ts:215-220`, `lib/testing/exporter.ts:244`, `app/dashboard/page.tsx:1600,1604` *(this last one fixed in PR #1235)*.
- **Emergency-fund months** (`liquidCash / monthlyExpenses`) — **≥9 sites**: `lib/cfo/scoreCalculator.ts:232,547`, `lib/health/metricAggregation.ts:171,450`, `lib/intelligence/portfolioEngine.ts:556`, `lib/intelligence/insightsEngine.ts:650`, `lib/strategy/analyzers/cashflowAnalyzer.ts:382`, `app/api/safety-net/route.ts:53`, `app/(dashboard)/cashflow/components/LiquidityHealth.tsx:53,186`.
- **Savings rate** (`net / income × 100`) — **7 sites**, incl. 3 AI prompt builders (drift into CFO advice): `lib/ai/strategyEnhancer.ts:334`, `lib/ai/google/promptManager.ts:371`, `lib/ai/services/financialAdvisor.ts:256`, + `app/api/dashboard/margin-trend/route.ts:154`, `lib/reports/generators/incomeExpense.ts:41`, `lib/testing/exporter.ts:310`.
- **LVR** (`loan / value × 100`) — **7 sites** + two competing "canonical" functions (`lib/utils/calculations.ts calculateLVR` vs `lib/calculations/loanAggregator.ts:170-183`): `lib/health/metricAggregation.ts:281,403`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts:48`, `loanDecisionSupport.ts:394`, `lib/portal/alerts/alertEngine.ts:202`, `lib/reports/contextBuilder.ts:336`, `lib/testing/exporter.ts:337-345`.
- **Rental yield / equity / DTI** — re-typed across `lib/cfo/riskRadar.ts:397`, `lib/strategy/analyzers/propertyAnalyzer.ts:65`, `lib/reports/contextBuilder.ts:335`, `lib/testing/exporter.ts:346,405-406,338`, `lib/health/metricAggregation.ts:284`.
- **`buildHealthInput` duplicated wholesale** — `app/api/financial-health/route.ts:50-242` and `app/api/dashboard/insights/route.ts:524-662` are near-identical re-aggregations (the insights copy's own comment admits it "mirrors the logic in /api/financial-health"). §12.3 violation.
- **`lib/testing/exporter.ts`** — a parallel shadow re-implementing net worth, LVR, equity, yield, savings rate, DTI, AND the frequency converters. Single worst file.

**SSOT gaps (no canonical home → everyone re-invents):** net rental yield, debt-to-asset ratio. Create canonical homes before deduping these.

---

## 3. P1 — declared-vs-actual bypasses (§19.1 — false-optimistic to users)

Canonical: `getCanonicalMonthlyCashflow(snapshot)` (actuals when `hasActualData`, declared fallback).

- **`lib/intelligence/insightsEngine.ts:611-723`** — drives critical/medium financial-metric insights + emergency-buffer months entirely from declared `snapshot.cashflow.*` → false-optimistic narrative advice for users with real transactions. (Worst non-page surface.)
- **`components/portal/clients/ClientCanonicalDashboard.tsx:49-92`** — advisers see DECLARED monthly-cashflow + savings-rate KPIs for their clients (ironically named "Canonical").
- **`app/dashboard/page.tsx`** ~26 declared reads — **fixed in PR #1235** (insights route exposes canonical; page reads it). The audit confirms the *page itself* still reads declared on `main` until #1235 merges.

---

## 4. P2 — duplicate data sources (re-aggregation instead of reading the snapshot)

Canonical: `getMasterFinancialSnapshot()`.

- `app/api/portfolio/snapshot/route.ts:625-654` — hand-computes net worth + income + expense + cashflow totals master already owns. *(Keep the GRDCS enrichment local per §12.2; source the plain totals from master.)*
- Three cashflow routes re-derive the same 4 primitives (monthly income/expenses/loan-repayments/balance): `app/api/cashflow/intelligence/route.ts:105-139`, `app/api/cashflow/summary/route.ts:53-86`, `app/api/cashflow/route.ts:307-309`.
- `app/api/budget-analysis/generate/route.ts:98-134`, `app/api/ai/debt-analysis/route.ts:190-201`, `app/api/dashboard/spending-pareto/route.ts:68` (re-sums a total it already holds).

---

## 5. P2 — duplicate utilities (frequency + formatting)

- **~13 frequency-converter re-implementations** (should use `lib/utils/frequencies.ts`): `lib/reports/contextBuilder.ts:261,551`, `lib/intelligence/portfolioEngine.ts:254,274`, `lib/testing/exporter.ts:30,49`, `app/api/cashflow/intelligence/route.ts:40`, `app/api/cashflow/stress-test/route.ts:27`, `app/api/ai/debt-analysis/route.ts:157`, `app/api/calculate/loan/route.ts:118`, `app/api/safety-net/route.ts:69` *(divergent 4.33/2.17 convention)*.
- **~30 private `formatCurrency`/`formatMoney`/`formatAud`** (should use `lib/utils/formatters.ts`): 6 across `lib/cfo/scenarios/*` (copy-pasted verbatim), `lib/reports/*`, `lib/cashflow/*`, `lib/ai/google/geminiClient.ts:315`, ~15 in `app/(dashboard)`/`app/dashboard`/`components`/`app/api`. Each misses the canonical null/Decimal-safe handling (the `$NaN` crash class).

---

## 6. P1 — hardcoded tax constants (config exists, not adopted)

Canonical: `lib/tax-engine/config/taxYearConfig.ts`.

- **Super contributions tax `0.15` hardcoded ×~15**: `lib/tax-engine/position/taxPositionCalculator.ts:328,349,354`, `lib/tax-engine/super/contributionCalculator.ts:173,186,261,437,442,540,568,576`, `lib/tax-engine/super/capTracker.ts:332,359`. (`smsfIncomeTax.ts:155` does it right — `config.superContributionsTaxRate`.)
- **SG rate `0.115`**: `app/dashboard/income/page.tsx:299`, `lib/cashflow/savingOpportunities.ts:162`.
- **Concessional cap `30_000`**: `lib/cashflow/savingOpportunities.ts:56` (comment admits canonical home).
- **Thresholds already drifting for FY25-26**: `capTracker.ts:82-84` bring-forward TSB; `contributionCalculator.ts:282` co-contribution upper.

---

## 7. The structural lever (highest ROI — do FIRST)

1. **Extend `scripts/lint-financial-surfaces.ts` `SCAN_DIRS`** to include `lib/` and `app/api/`. Almost every finding above is invisible to the current scan. Add the new violations to the baseline, then burn it down. (Adds the frequency/formatter/declared-cashflow patterns app-wide as build-gated.)
2. **Model the un-modelled surfaces into the Neomatrix** (§21.2) with `semanticKey`s — so A3 convergence-contradiction flags any two surfaces of the same concept tracing to different engines as a build failure (the mechanism that would have caught the +$10,505 bug).

### 7.1 W1 outcome — how the linter was extended (PR #1240, 2026-06-25)

A blanket extension of all four patterns to `lib/` flagged **215 matches**, but a measured triage showed **~70% were legitimate engine domain math** (an engine is *supposed* to compute `assets − liabilities` and annualise `× 12` — §12.3), not duplication. Baselining 215 noisy entries would have buried the real signal. So the extension is **layer-aware**:

| Layer | Dirs | Patterns applied |
|---|---|---|
| **surface** | `app/dashboard`, `app/portal`, `components` | all four, **loose** FREQUENCY (a surface must never do `× 12` at all) — *unchanged; existing baseline preserved exactly* |
| **route** | `app/api` | all four, **enum-tightened** FREQUENCY (routes must be thin — §12.3 — but legitimately annualise a canonical value now and then; only a `case 'WEEKLY'`-style converter re-impl is a dup) |
| **engine** | `lib` | **only** `DECLARED_CASHFLOW_SOURCE` (a §19.1 declared-vs-actual bypass) **+ enum-tightened** FREQUENCY (a genuine `toMonthly`/`toAnnual` shadow). Inline-arithmetic + hardcoded-constant patterns are NOT applied — engines legitimately compute + hold config. Canonical homes (`lib/utils/frequencies.ts`) + audit/test harnesses (`lib/calc-audit/`, `lib/testing/`) are skipped. |

**Enum-tightening:** in route/engine layers a FREQUENCY match only counts when the line carries a frequency period as a **value** — a quoted `'monthly'` / `case 'WEEKLY'` or an ALL-CAPS `ANNUALLY` token — not a lowercase identifier like `monthly.income` (which is just a variable). Precision pass also skips `.length`/`.count`/`.size` counting and `.sort()` comparators in INLINE_ARITHMETIC.

**Result:** 215 → **30 genuine route+engine known-debt entries** baselined (the W2–W7 worklist; 0 false positives), surface baseline unchanged (11). New duplication in `lib/` or `app/api/` now fails the build.

> **⚠️ Suspected stale-constant find (raised with Reza per §21.2 — NOT silently fixed):** `app/api/cashflow/intelligence/route.ts:481` —
> `potentialSaving: Math.min(27500, annualGrossIncome * 0.05) * 0.34` — `27500` is the **FY23-24** concessional cap (FY24-25/25-26 is **$30,000**) and `0.34` is a magic approximate marginal+Medicare rate. Baselined as known-debt for a follow-up financial PR (§19.2 worked-example + §20.4 10/10); flagged here so it isn't lost. Lower severity than W0 (it sizes a *suggestion's* "approx saving", not a core tax position) but it is a genuine stale-constant smell.

---

## 8. Recommended remediation roadmap (sequenced, each its own PR — §20.4 10/10 + §19.2 per financial PR)

| Wave | Scope | Why first |
|---|---|---|
| **W0** ✅ | P0-1 stale tax brackets → `getTaxYearConfig` (after Reza confirms — wrong number) | Live wrong number — **DONE (PR #1238)** |
| **W1** ✅ | Structural lever §7 (extend linter + baseline) | Stops the bleeding; makes the rest enforceable — **DONE (PR #1240)** |
| **W2** | Declared-vs-actual §3 (insightsEngine + portal ClientCanonicalDashboard) | §19.1 false-optimistic to users + advisers |
| **W3** | Collapse `buildHealthInput` (the two route copies → one shared canonical builder) | Worst single duplication; §12.3 |
| **W4** | Emergency-fund-months + savings-rate + LVR → canonical (incl. delete `loanAggregator.calculateLVR`, create net-yield/debt-to-asset canonical homes) | Most-duplicated formulas |
| **W5** | Super 15% / SG / cap constants → `taxYearConfig` | Drift risk + FY25-26 already wrong |
| **W6** | Data-source re-aggregation (cashflow routes, portfolio totals, budget-analysis) → master snapshot | Thin-wrapper compliance §12.3 |
| **W7** | Frequency-converter + formatter dedup (~43 sites) → canonical utils; retire `lib/testing/exporter.ts` shadow | Util hygiene; mostly mechanical |

Each wave: model the touched surfaces into the Neomatrix in the same PR (§21.2) so the gate widens as we go.

---

*Generated 2026-06-25 from four verified parallel sweeps. Findings are source-verified (§19.2); the remediation itself is the next workstream and must follow the §12.2.1 SEARCH-FIRST rule + §20.4 10/10 + §19.2 worked-example discipline per PR.*
