# Issue Registry (generated — do not hand-edit)

> Generated from `docs/issues/ISSUES.json` by `npm run issues:generate`. Gated by `npm run issues:check`.
> Lifecycle: 🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED. See `docs/issues/README.md`.

**87 total** · 83 open · 🔵 21 · 🟡 4 · 🟠 29 · 🟢 29 · ✅ 3

| ID | Status | Sev | Δ# | Title | Fix | Test |
|---|---|---|---|---|---|---|
| MON-001 | 🟠 FIXING | 🔴 | yes | Fortnightly rent stored/treated as MONTHLY (rent ~54% off) | ##1430 (wall Part 2: C1 evidence cadence + D2 detector) | ✅ |
| MON-002 | 🟠 FIXING | 🟠 | yes | Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift | #1336 | ✅ |
| MON-003 | 🟠 FIXING | 🟠 | yes | DEPRECIATION / YR always $0 (reads a field absent from the model) | #1352 | ✅ |
| MON-004 | ✅ CLOSED | 🟡 | no | Loan repayment missing from the property Cashflow rhythm | #1333 | n/a |
| MON-005 | 🟢 VERIFIED | 🟡 | no | Expense tile -> global page; no per-property summary card / drill-down | #1358 | ✅ |
| MON-006 | 🟡 DIAGNOSED | 🟢 | yes | Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only) | — | — |
| MON-007 | ✅ CLOSED | 🟡 | no | -$100,912 vs -$46,897 don't add up | #1333 | n/a |
| MON-008 | 🟢 VERIFIED | 🟡 | no | Expense initial-entry inconsistent (only due-dates on the property edit form) | #1358 | ✅ |
| MON-009 | 🟠 FIXING | 🟠 | yes | Rental (and any linked line) shown per declared frequency, fragmented across records → over-counted; not read from transaction dates | #1337 | ✅ |
| MON-010 | 🟠 FIXING | 🟡 | yes | Tax summary still sums raw (fragmented) rental income records — taxable rental over-counted | #1353 | ✅ |
| MON-011 | 🟠 FIXING | 🟠 | yes | Portfolio equity sums FLOORED per-property equities — overstated by exactly $37,076 | #1347 | ✅ |
| MON-012 | 🟠 FIXING | 🟠 | yes | Balances liquidity buckets fail L3 tie-out by exactly $64,572 (floored equity + credit card + HECS) | #1347 | ✅ |
| MON-013 | 🟠 FIXING | 🔴 | yes | Investment-account CASH ($67,871) excluded from net worth & total assets; Assets TILE includes it — two producers of 'total assets' | #1342 | ✅ |
| MON-014 | 🟠 FIXING | 🟠 | yes | Home per-property tiles show rent-magnitude not cashflow when a loan lacks minRepayment — 3rd non-canonical cashflow producer (portfolio/snapshot) drops loan cost to $0, bypassing #1336/#1337 | #1351 | ✅ |
| MON-015 | 🟢 VERIFIED | 🟡 | no | Entity-cashflow widget components don't sum to its own total (-$655 gap) + claims '12 entities' when 9 exist + monthly figure mislabelled 'annual' | #1356 | ✅ |
| MON-016 | ❌ RETRACTED | 🟡 | no | Debt-quality Good+Bad buckets omit the Guildford home loan ($377,822 unbucketed; sum != total) | — | n/a |
| MON-017 | 🟢 VERIFIED | 🔴 | yes | Safety Net score is fiction on real data: 'Positive Cashflow 15/15' while cashflow is negative; recovery times uncomputable but shown; 0/0 bills scores 30/30; 3mo vs 6mo target contradiction | #1346, #1359 | ✅ |
| MON-018 | 🟢 VERIFIED | 🔴 | yes | CFO 'Monthly progress: net worth +2%' is a ×0.98 PLACEHOLDER rendering as a real trend | #1343 | ✅ |
| MON-019 | 🟠 FIXING | 🟠 | yes | 'Save 69 years' = the 999-month payoff SENTINEL leaking into UI arithmetic; refinance recommended on a 104% LVR loan | #1348 | ✅ |
| MON-020 | 🟠 FIXING | 🟠 | yes | Two tax engines disagree ($153,278 vs $104,323 — §12.2.1 duplicate); /cashflow estimate omits Medicare (~$8,319). [CFO deductions-card 'mixes benefit' sub-claim RETRACTED as misread — see notes] | ##1349, ##1448 | ✅ |
| MON-021 | 🟠 FIXING | 🟠 | yes | /cashflow renders actual and declared side-by-side unlabelled (In $0 vs In +$43,736) and two month-end forecasts disagree by $39K | #1354 | ✅ |
| MON-022 | 🟢 VERIFIED | 🟡 | no | Data-quality validation gaps inflating everything: $11,385/mo 'Battery System' recurring, company ATO tax as household spend, purchase price $0 -> '+0.0%', owner-occupied homes showing rental yield, count drift | #1357 | ✅ |
| MON-023 | 🟠 FIXING | 🟠 | yes | One-off expenses shown as $X/mo (isRecurring ignored) + reconcile duplicates expense records | #1340 | ✅ |
| MON-024 | 🟠 FIXING | 🟠 | yes | "High Discretionary Spending" showed >100% (e.g. 906%) — discretionary/essential on a different base than the recurring total | #1341 | ✅ |
| MON-025 | 🟠 FIXING | 🟠 | yes | Expense frequency defaults MONTHLY (never detected from dates); AI categorisation sets no recurring/frequency; no user frequency confirm; fuzzy-dedup missing | #1345 | ✅ |
| MON-026 | 🟠 FIXING | 🔴 | yes | Depreciation deduction 100× too high — cost×rate omits /100 (rate is a PERCENTAGE) → tax understated | #1352 | ✅ |
| MON-027 | 🟠 FIXING | 🟡 | yes | CFE input builder (buildCFEInput) copy-pasted in two routes and DRIFTED — stress-test forecasts on PRE-tax income + includes transfers | #1355 | ✅ |
| MON-028 | 🟢 VERIFIED | 🟠 | yes | Property DETAIL page shows DECLARED cashflow/yield, not actuals — /api/properties/[id] drops linkedTransactions (drifts from list + Home) | #1359 | ✅ |
| MON-029 | 🟢 VERIFIED | 🟠 | yes | Savings rate has THREE contradictory producers (75.4% CFO / −30.5% Home / 0.0% Home insight) | #1359 | ✅ |
| MON-030 | 🟢 VERIFIED | 🟠 | yes | Health/Safety score differs across three pages (Home 50/C, CFO 46/D, Safety Net 70/100) | #1380, #1381 | ✅ |
| MON-031 | 🟠 FIXING | 🟡 | no | Liquid savings differs: Balances $301,808 vs Safety Net "Liquid savings" $304,304 ($2,496 gap) | ##1368, ##1452, ##1455 | ✅ |
| MON-032 | 🟢 VERIFIED | 🟡 | no | Property detail Recent-activity shows loan repayment "-$0" for a real loan (row reads raw minRepayment, not the engine-resolved cost) | #1359 | ✅ |
| MON-033 | 🟢 VERIFIED | 🟡 | no | Yield shown for an owner-occupied HOME on the Home tile + CFO Low-Yield insight (detail page correctly hides it) | #1359 | ✅ |
| MON-034 | 🟠 FIXING | 🟠 | yes | Reports over-state ANNUAL-frequency income/expenses 12× — duplicate frequency converter missing the ANNUAL enum case (inflates tax deductions + report totals) | #1376 | ✅ |
| MON-035 | 🟢 VERIFIED | 🟠 | yes | HOME property cashflow: Home dashboard tile disagrees with detail/list (delta 6040/yr) | ##1396 | ✅ |
| MON-036 | 🟢 VERIFIED | 🟠 | yes | HOME rental yield reads three different values across surfaces (0.12 / 0.9 / 1.05) | ##1397 | ✅ |
| MON-037 | 🟠 FIXING | 🔴 | yes | One-off expenses shown as recurring MONTHLY (+ apparent Battery duplicate) inflating expenses/cashflow | ##1395, ##1427 (RC-B: near-duplicate dedup) | ✅ |
| MON-038 | 🟢 VERIFIED | 🟠 | no | CFO offers a refinance on a 104pct LVR loan (should be gated over 100pct) | ##1399 | ✅ |
| MON-039 | 🟢 VERIFIED | 🟢 | no | Minor display: Medicare levy not shown; /cashflow Money In 0 vs 1-source note; Guildford list tile omits cashflow/yr | ##1412 | ✅ |
| MON-040 | 🟢 VERIFIED | 🟡 | yes | Tax optimisation recommendations show implausible values (save 3685pct, 6.27M potential savings) | ##1398 | ✅ |
| MON-041 | 🟢 VERIFIED | 🟢 | no | Vehicle depreciation percentage shown outside 0-100 (appreciation rendered as negative depreciation) | ##1403 | ✅ |
| MON-042 | 🟢 VERIFIED | 🟢 | no | Household vehicle count (4) disagrees with the Assets list (5 vehicles) | ##1411 | n/a |
| MON-043 | 🟢 VERIFIED | 🟡 | no | Annual income differs across Home / Activity / Tax surfaces (basis inconsistency to reconcile) | ##1413 | ✅ |
| MON-044 | 🟢 VERIFIED | 🟢 | no | Loan Opportunities card links to /dashboard/debt which 404s | ##1402 | ✅ |
| MON-045 | 🟢 VERIFIED | 🟠 | yes | CFO neg-gearing benefit ($157,746) ~4x total deductions ($39,554) — internally inconsistent | ##1415 (stage 1: canonical helper), ##1425 (stage 2: wiring + producer deletions) | ✅ |
| MON-046 | 🟢 VERIFIED | 🟢 | no | Bare /dashboard/investments 404s (CFO tile + DocumentList + sidebar nav) | ##1402 | ✅ |
| MON-047 | 🟡 DIAGNOSED | 🟢 | no | Dead unwired calculateMonthlyProgressNetWorth uses COST basis (averagePrice) not market — latent net-worth bug + stale graph node | — | n/a |
| MON-048 | 🟢 VERIFIED | 🟡 | no | Property Cashflow-rhythm shows one-off expenses as MONTHLY (badge read declared frequency, not isRecurring) | ##1406 | ✅ |
| MON-049 | 🟡 DIAGNOSED | 🟢 | no | Document count & storage disagree: Settings '24 documents · 12MB' vs Vault '6 all-time · 14.0 MB' | — | n/a |
| MON-050 | 🔵 OPEN | 🟢 | no | Month-end balance differs: CFO $301,712 vs Cashflow 30-day forecast $301,639 ($73) | — | n/a |
| MON-051 | 🔵 OPEN | 🟡 | yes | CFO intelligence metrics hardcoded: savingsOpportunities=3, pendingActions=5 rendered as real figures | — | — |
| MON-052 | 🔵 OPEN | 🟡 | yes | PAYG withholding omits HECS-HELP component (TODO stub) — withholding estimate understated for HELP-debt users | — | — |
| MON-053 | ✅ CLOSED | 🔴 | yes | One-off income annualised x12 into the tax base — two single ATO deposits become ~$120.6K phantom recurring income | ##1421 | ✅ |
| MON-054 | 🔵 OPEN | 🟠 | no | CFO 'Refinance Savings' tile renders an LVR-blocked alert as an offer (drops alert.action) | — | n/a |
| MON-055 | 🔵 OPEN | 🟠 | yes | Portfolio net cashflow reads two different values (-$552/mo vs -$1,055/mo) with no basis label | — | — |
| MON-056 | 🔵 OPEN | 🟠 | yes | What-If concessional cap usage (74%) contradicts the Superannuation page (0%) | — | — |
| MON-057 | 🔵 OPEN | 🟠 | no | Negative savings rate (-30.5%) badged 'ABOVE AVERAGE' on the Home tile | — | n/a |
| MON-058 | 🔵 OPEN | 🟡 | yes | CFO Risk Radar claims '100% of your wealth is in property' — contradicts Home's 91.4% | — | — |
| MON-059 | 🔵 OPEN | 🟡 | no | Annual income shown on three surfaces with an unlabelled basis ($239K / $484K / $524,831) | — | n/a |
| MON-060 | 🟠 FIXING | 🟡 | yes | Estimated annual tax differs between /cashflow ($194,218) and /dashboard/activity ($175K) | ##1448 | ✅ |
| MON-061 | 🔵 OPEN | 🟡 | no | Property rental income card cadence label contradicts the ledger (Guildford/Broadbeach/Thornland Lot 1) | — | n/a |
| MON-062 | 🔵 OPEN | 🟡 | no | Property rental income card mixes a DECLARED source count with an ACTUALS amount, unlabelled | — | n/a |
| MON-063 | 🔵 OPEN | 🟡 | yes | HOME property ANNUAL RENT $902 matches neither the actuals nor the declared basis (third basis) | — | — |
| MON-064 | 🟠 FIXING | 🟢 | no | 'Liquid' has two values across surfaces ($304,304 Safety Net vs $301,808 Balances/Home) | ##1452, ##1455 | ✅ |
| MON-065 | 🔵 OPEN | 🟢 | no | Doubled currency symbol on the salary-sacrifice What-If ('$$135,600/yr') | — | n/a |
| MON-066 | 🔵 OPEN | 🟢 | no | Safety Net renders two contradictory recommendations together | — | n/a |
| MON-067 | 🔵 OPEN | 🟢 | no | Debt Freedom gate lists an already-completed prerequisite (Household Profile 100%) | — | n/a |
| MON-068 | 🔵 OPEN | 🟢 | no | Entity value for 'YOU'/Reza differs by ~$1.95M with gross and net bases mixed in one card | — | n/a |
| MON-069 | 🔵 OPEN | 🟢 | yes | Same recurring expense 'Hunter Premium' reads two amounts ($797/mo vs $812) | — | — |
| MON-070 | 🔵 OPEN | 🟢 | no | Investment account type badge differs between list ('BROKERAGE') and detail ('INVESTMENT ACCOUNT') | — | n/a |
| MON-071 | 🔵 OPEN | 🟡 | no | Declared income source count disagrees: /cashflow says '1 income source', /dashboard/income lists 21 | — | n/a |
| MON-072 | 🔵 OPEN | 🟢 | no | CFO formatting/copy defects: missing thousands separators, pluralisation, doubled word, risk count mismatch | — | n/a |
| MON-073 | 🔵 OPEN | 🟠 | yes | What-If salary-sacrifice lever reads a CLOSED financial year's concessional cap (FY25-26) | — | — |
| MON-074 | 🟠 FIXING | 🟡 | yes | Probable duplicate income rows (Ingeus x3, Cienna PM Trust x3) inflating the 'Other' income group | ##1459 | — |
| MON-075 | 🟢 VERIFIED | 🟡 | no | Source-aware one-off guardrail: standing NeoAudit detector for recurring rows evidenced by a single $0-actuals transaction | ##1431 (wall Part 3: D1 detector) | ✅ |
| MON-076 | 🟠 FIXING | 🟠 | yes | Duplicate/fragmented income rows inflate declared gross (Ingeus salary ×3, Cienna rent ×3, Hipcamp ×2) | ##1458, ##1461 | ✅ |
| MON-077 | 🟡 DIAGNOSED | 🟡 | no | 'Potential Missed Deductions' (My Guide) still lists the three investment loans' interest as missed though MON-045 now auto-claims it | — | n/a |
| MON-078 | 🟠 FIXING | 🟠 | no | Canonical intake classifier + build-gate intake source-lock (the intake-integrity keystone) | ##1429 (keystone: classifier + R1 source-lock) | ✅ |
| MON-079 | 🟢 VERIFIED | 🟠 | yes | Managed rental income + agent-cost reconciliation (Phase 59) | ##1434 | ✅ |
| MON-080 | 🟢 VERIFIED | 🔴 | yes | Phase 59 managed-rental deduction never captured on real data (D0 fresh-link N=1 · D1 order-dependency · D2 gross-integrity) | ##1437 | ✅ |
| MON-081 | 🟢 VERIFIED | 🟠 | yes | Loan cost reads $0 on non-property surfaces (raw minRepayment instead of the resolved per-loan producer) | ##1440, ##1441, ##1442 | ✅ |
| MON-082 | 🟢 VERIFIED | 🟠 | yes | /dashboard/expenses ignores isRecurring - one-off expenses annualised into every run-rate | ##1440 | ✅ |
| MON-083 | 🟠 FIXING | 🟡 | yes | A one-off expense still stores/displays a cadence (frequency=MONTHLY) - Mechanism C | ##1440 | ✅ |
| MON-084 | 🟠 FIXING | 🟠 | yes | SALARY/OTHER income has no reconcile reuse guard - linking mints duplicate income rows | ##1458 | ✅ |
| MON-085 | 🟠 FIXING | 🟡 | yes | Expense near-duplicate detection is scoped by property/loan/asset - cross-scope duplicates never compared | ##1458 | ✅ |
| MON-086 | 🟢 VERIFIED | 🔴 | yes | Managed-rental cashflow double-counts the agent fee (rent read NET, derived fee subtracted again) | ##1440 | ✅ |
| MON-087 | 🟠 FIXING | 🟠 | no | Property-context Add Expense dialog crashes — Radix Select.Item empty value | ##1446 | ✅ |

---

### MON-001 — Fortnightly rent stored/treated as MONTHLY (rent ~54% off)

**🟠 FIXING** · 🔴 critical · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** Rents paid weekly (Broadbeach $2,947/wk, Thornland Lot 2 $2,817/wk) were stored as MONTHLY entries, so a year of rent counted 12 payments instead of 52 — rental income understated roughly 4.3×, and the tax estimate with it.
>
> **What changed:** Two guards: (1) when the app creates an income/expense from linked bank payments, it now derives the true rhythm from the payment dates themselves (weekly stays WEEKLY — never silently monthly); (2) a standing detector flags any existing row whose stored rhythm disagrees with what its own payments show, with a gentle 'Payments look weekly' chip on the income list. You review and edit the flagged rows — nothing changes by itself.
>
> **What you should see:** On My Accounts › Income: the weekly rent rows show an amber 'Payments look weekly' chip. Edit each to WEEKLY — the monthly figure, annual rental income, and the tax estimate rise to the true ×52 basis. Rows whose payments genuinely arrive monthly show no chip.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:318`, `app/api/transactions/[id]/link/route.ts:156`, `app/dashboard/properties/[id]/page.tsx:141`
- **Neomatrix:** `engine.incomeAggregator.aggregateIncome`
- **Downstream consumers (§19.4):** `classifyIntake evidence path → all 8 intake producers (future rows store the true cadence; existing rows untouched)`, `app/api/income GET → cadenceMismatch flag per row → income page nudge chip (D2 surface)`, `GET /api/transactions/[id]/link matches — inline cadence block repointed to the ONE canonical detectFrequency (identical thresholds, behaviour-identical)`, `after Reza edits the flagged rows: income aggregator → tax position → CFO/My Guide → cashflow all inherit the corrected ×52 basis (SSOT — no code change needed downstream)`, `RESIDUAL (documented, follow-up): lib/bank/recurringExpenseDetection.ts keeps its private detectFrequency copy — its confidence formula feeds pattern-match thresholds; repointing would change suggestion behaviour and needs its own justification`
- **Fix PR(s):** ##1430 (wall Part 2: C1 evidence cadence + D2 detector)
- **Holistic test (§19.4):** `tests/intake/classifyIntake.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-1`

Reconcile write paths never persist the detected cadence; property page annualises the stored MONTHLY frequency. Subsumed by MON-002 (actuals-first). Full downstream sweep (§19.4) to be completed at fix time. Folded into MON-002: the shared engine uses monthlyAverageActual (a true monthly average from the reconciled fortnightly cadence) so fortnightly rent annualises at ×26 not ×12. Advances to VERIFIED with MON-002 once Reza confirms on his data.

[C1 + D2 SHIPPED — wall Part 2, 2026-07-16] classifyIntake gains transactionDates evidence: ≥2 valid dates → the ONE canonical detectFrequency (declared/explicit user choice still WINS — suggest-and-confirm preserved). Link route threads primary+batch txn dates into all 3 classifier calls. GET-matches inline cadence block deleted → canonical (thresholds identical). D2: lib/intake/detectors.ts detectCadenceMismatch (pure; ≥3 txns, confidence ≥0.7, never one-offs) → income GET cadenceMismatch flag → income-page amber nudge chip (review-only; no auto-change — the abandoned-backfill precedent). Ring-0: classifyIntake evidence tests (weekly census fixture: 7-day deltas → WEEKLY) + detectors.test.ts (7). EXISTING rows remediation = Reza edits the flagged rows (Ring-3: flip Broadbeach + Thornland Lot 2 to WEEKLY; rental income/tax rise to the ×52 basis; regression guard: monthly-cadence rows unflagged, MON-053 one-offs unflagged).

### MON-002 — Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** A property's Cashflow/yr was worked out on the page from your typed-in figures and ignored your reconciled bank transactions. Worse, if you hadn't typed a loan repayment the loan cost dropped to $0, so the property looked far healthier than it was — and the list tile and the detail page used two different formulas, so they disagreed.
>
> **What changed:** One shared calculation (computePropertyCashflow) now powers BOTH the property list tile and the detail page. It uses your reconciled actuals when transactions exist (so fortnightly rent counts correctly), falls back to your typed values otherwise, and always includes the loan cost — never $0 when a loan exists. The headline Cashflow/yr is cash-basis (rent − expenses − full repayment); the Tax card uses interest-only (the deductible part).
>
> **What you should see:** Open a property: the Cashflow/yr now includes the loan repayment (never $0 with a loan), and the SAME number shows on the Properties list tile and the detail page. Fortnightly rents read at their true annual amount, not ~half. The Tax card figure is less negative than the cash figure (interest-only vs full P&I).

- **Root cause:** `app/dashboard/properties/page.tsx:471`, `app/dashboard/properties/[id]/page.tsx:148`, `app/api/properties/route.ts:47`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`
- **Fix PR(s):** #1336
- **Holistic test (§19.4):** `tests/calculations/propertyCashflow.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-2`

Fix shipped: extracted ONE engine lib/calculations/propertyCashflow.ts (actuals-first P&I headline, interest-only tax) + ONE shared actuals producer lib/services/propertyActuals.ts (batched into BOTH the list and detail APIs so tiles match the detail page — §19.4 same-number-everywhere). Modelled in the Neomatrix (engine.propertyCashflow.computePropertyCashflow + number.propertyCashflow, both surfaces converge on one engine — A3). Folds in MON-001 (fortnightly-as-monthly: actuals-first monthlyAverageActual fixes it) + MON-006 (cash-vs-tax basis: both returned explicitly). Status stays FIXING until Reza tests the numbers on his data. Prod-verification 2026-07-07: production deploy dpl_45wwUPDYKyKz86mEAhNPznYGbPji (2026-07-03 10:16:44 UTC) carries #1337 (merged 10:16:41 UTC), so the fix IS live — but Reza's 2026-07-07 capture shows property DETAIL pages correct while the Properties LIST still shows stale cashflow/yields (e.g. Lot 1 -$74,614) and Home tiles bind RENT into the cashflow column (Broadbeach +$5,461). Convergence is DETAIL-ONLY; list + Home tiles have NOT converged → MUST NOT advance to VERIFIED. Residual list/Home divergence tracked as MON-014. [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-03): list vs detail per-property cashflow/yield still diverge in prod (Broadbeach list $15,879/5.03% vs detail $50,281/10.92%). Detail+list unified via #1336/#1337; Home/CFO (portfolio/snapshot) NOT — driver is MON-014.

### MON-003 — DEPRECIATION / YR always $0 (reads a field absent from the model)

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** The property's Depreciation per year always showed $0.
>
> **What changed:** Compute Depreciation/yr from the schedule's cost + rate + method via the ONE canonical engine (calculateDepreciationAnnual) — the page was summing a field the API never returns.
>
> **What you should see:** Depreciation/yr shows a real figure from your schedules (e.g. a $100k asset at 2.5% prime-cost → $2,500/yr), not $0.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:157`, `lib/depreciation/index.ts:78`
- **Neomatrix:** `engine.depreciation.calculateDepreciationAnnual`, `number.propertyDepreciation`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** #1352
- **Holistic test (§19.4):** `tests/tax/depreciationRate.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-5`

computeAnnualDepreciation sums d.annualClaim, not a column on DepreciationSchedule (cost/rate/method are). Touches a per-asset tax position -> §12.14 reform-awareness. FIX SHIPPED 2026-07-10 (with MON-026): computeAnnualDepreciation (properties/[id]/page.tsx:157) now sums calculateDepreciationAnnual(schedule).annualDepreciation (was Σ d.annualClaim — a phantom field the API never returns → always $0). The API already returns the raw schedules (cost/rate/method); the client type updated to the real fields. Same ONE engine as the tax paths (MON-026). Test tests/tax/depreciationRate.test.ts. §20.4 10/10.

### MON-004 — Loan repayment missing from the property Cashflow rhythm

**✅ CLOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03 · closed 2026-07-03

> **What was wrong:** A property's yearly cashflow couldn't be reconciled by eye — the big loan repayment was subtracted in the maths but wasn't shown anywhere in the 'Cashflow rhythm' list.
>
> **What changed:** Added the loan repayment as a line in the 'Cashflow rhythm', using the same figure the cashflow already subtracts.
>
> **What you should see:** Open a property that has a loan → the 'Cashflow rhythm' now lists the loan repayment, and rent − expenses − loan repayment adds up to the Cashflow/yr shown at the top.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:768`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** #1333
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-3`

Display-only (no computed number changed). Fixed in #1333 (merged + prod-verified). §19.4 propagation test not required for display-only; reconciliation verified arithmetically against both screenshots.

### MON-005 — Expense tile -> global page; no per-property summary card / drill-down

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

> **What was wrong:** On a property, 'N expenses tracked' jumped to the global expenses page instead of showing that property's own expenses.
>
> **What changed:** Added a dedicated Expenses card on the property that lists each expense (with an Actual/Estimate tag) and its annual total, read from the one canonical cashflow engine — the header total and every row come from the same source so they always agree.
>
> **What you should see:** Open a property: its rates, insurance, strata and maintenance now appear on the property with a total that matches the rest of the app; 'View all in Spending' still links to the full page.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:714`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `components/properties/PropertyExpensesCard.tsx`, `lib/calculations/propertyCashflow.ts`
- **Fix PR(s):** #1358
- **Holistic test (§19.4):** `tests/calculations/propertyExpenseLines.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-4`

New in-app section-level composition -> Stitch-first (§18.2.1). [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-006 — Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only)

**🟡 DIAGNOSED** · 🟢 low · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** The 'contributes X before tax' wording mixed up your cash cashflow (which includes loan principal) with the tax figure (which only counts interest).
>
> **What changed:** (planned) Headline cashflow shows your real cash position; the tax card uses interest-only (the deductible part), clearly separated.
>
> **What you should see:** (after fix) The tax-position figure is based on loan interest only and is labelled distinctly from the cash cashflow.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:529`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-6`

Folded into MON-002 (headline = P&I cash; Tax card = interest). Folded into MON-002: computePropertyCashflow returns BOTH annualCashflow (cash, full P&I) and annualTaxCashflow (interest-only, deductible) explicitly — the detail Tax card renders the tax basis, the headline renders cash. Advances to VERIFIED with MON-002.

### MON-007 — -$100,912 vs -$46,897 don't add up

**✅ CLOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03 · closed 2026-07-03

> **What was wrong:** A property's cashflow looked wrong (-$100,912 then -$46,897) and didn't seem to add up.
>
> **What changed:** Confirmed both figures are the same tile before/after you reassigned rentals, and made the loan repayment visible so it reconciles (via MON-004).
>
> **What you should see:** The two numbers now make sense: same tile with different rent, and rent − expenses − loan repayment matches the headline.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:164`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** #1333
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-7`

Same hero tile before/after reassigning rentals; reconciles once the hidden loan repayment is shown (MON-004).

### MON-008 — Expense initial-entry inconsistent (only due-dates on the property edit form)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

> **What was wrong:** There was no clear place to enter a property's expense amounts — the edit form only took renewal due-dates and 'Add Expense' was hidden on the old list page.
>
> **What changed:** The Expenses card has an 'Add expense' button (and a form-led empty state) that opens the normal expense form pre-scoped to the property; edit and delete are on each row. Same rule as MON-002: your typed amount first, your reconciled actuals when matched.
>
> **What you should see:** On a property with no expenses you see 'Add your first expense'; adding one shows it immediately, and once your bank transactions reconcile the amount flips from Estimate to Actual automatically.

- **Root cause:** `app/dashboard/properties/page.tsx:215`, `app/dashboard/properties/page.tsx:1602`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `components/properties/PropertyExpensesCard.tsx`, `components/ExpenseDialog.tsx`
- **Fix PR(s):** #1358
- **Holistic test (§19.4):** `tests/dashboard/propertyExpensesCard.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-9`

Follows the same manual-initial -> actuals-when-reconciled rule (MON-002). (Earlier 'P-8 manual repayment not capturable' was RETRACTED — the Minimum Repayment field exists at LoanFormDialog:531.) [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-009 — Rental (and any linked line) shown per declared frequency, fragmented across records → over-counted; not read from transaction dates

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** A property's rent was shown at its typed-in 'monthly' amount even though the reconciled payments are fortnightly, and because reconciliation had split the one rental into 4 separate 'monthly' income records, the rent was added up 4 times — so the rental income (and the dashboard totals that use it) was far too high. The same 'read the typed frequency, not the real dates' weakness applied to expenses and loan repayments.
>
> **What changed:** One universal rule now powers rent, expenses and loan repayments: each is worked out as a true MONTHLY figure read from the actual transaction DATES (so fortnightly rent, two repayments in a month, or a quarterly water rate all come out right), falling back to your typed values only when there aren't enough transactions. Rent is pooled at the property level so a rental split across several records is counted ONCE. The same engine now feeds the property pages AND the dashboard/net-worth/health totals. Reconciling a rent payment now links to the property's existing rental instead of creating another 'monthly' record.
>
> **What you should see:** Open the property: rent shows as ONE 'Rental income' line with the real cadence (e.g. 'fortnightly'), at the correct monthly amount — not 4 monthly rows. The rent, cashflow, and the dashboard's income/savings/health reflect the true (lower) rent. A quarterly expense reads as ~1/3 per month; two loan repayments in a month read as the combined monthly cost.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:345`, `lib/services/masterFinancialService.ts:1114`, `app/dashboard/properties/[id]/page.tsx:681`
- **Neomatrix:** `engine.monthlyResolver.resolveMonthly`, `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/page.tsx`, `app/dashboard/properties/[id]/page.tsx`, `lib/services/masterFinancialService.ts`
- **Fix PR(s):** #1337
- **Holistic test (§19.4):** `tests/calculations/monthlyResolver.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-1`

Generalises MON-001 (fortnightly-as-monthly) to a universal monthly resolver (lib/calculations/monthlyResolver.ts) read from transaction dates, used by the property engine + masterFinancialService buildPropertyMetrics + aggregate income (rental deduped). Rent pooled at property-stream level fixes the 4-record over-count. Source fix: create-income-from-transaction reuses an existing property rental stream. TAX (buildTaxSummary) intentionally NOT changed here — rental/CGT tax treatment is §12.14-sensitive; tracked as MON-010 follow-up. Status FIXING until Reza verifies on his data. Prod-verification 2026-07-07: #1337 IS live in production (dpl_45ww, 2026-07-03 10:16:44 UTC) but the Properties LIST + Home per-property tiles still diverge from the corrected detail pages (list/Home divergence is LIVE, not cache) → MUST NOT advance to VERIFIED. Home tile rent-in-cashflow binding tracked as MON-014. [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-03): multi-rental over-count symptoms persist on non-canonical surfaces (Thornland Lot1 list -$74,614 vs detail -$46,897).

### MON-010 — Tax summary still sums raw (fragmented) rental income records — taxable rental over-counted

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: tax · opened 2026-07-03

> **What was wrong:** When a rental was split across several income records (e.g. reconciliation created 4 'monthly' rows for one lease), the TAX estimate added them all up — so the taxable rental income was counted several times and your tax looked too high. The dashboard/cashflow side was already fixed (MON-009); the tax side was still on the raw records.
>
> **What changed:** The tax summary now reads the SAME deduped rental the dashboard uses: a property's rent is pooled into ONE figure from the actual payment dates (falling back to your typed amount only when there are no transactions), so it is counted once.
>
> **What you should see:** Your tax estimate's rental income (and the tax payable that follows from it) should drop to the true single-rental figure and match the property page + dashboard — no more multiplied-up rental in the tax number.

- **Root cause:** `lib/services/masterFinancialService.ts:1984`
- **Neomatrix:** `orchestrator.masterFinancialService.getMasterFinancialSnapshot`
- **Downstream consumers (§19.4):** `lib/services/masterFinancialService.ts:1984 buildTaxSummary (snapshot.tax)`, `components/portal/clients/ClientCanonicalDashboard.tsx (Tax card: taxable income / tax payable / deductions / refund)`, `components/bookkeeping/ConsumerMoneyFlowSankey.tsx (estimatedTaxPayable)`, `app/api/cfo/scenarios/run/route.ts:249 (userMarginalRate from snapshot.tax.marginalTaxRate)`, `lib/cfo/aiAdvisor.ts:480-485 (CFO AI advisor tax context)`, `lib/neobrain/factPack.ts:285 (FactPack tax fact)`
- **Fix PR(s):** #1353
- **Holistic test (§19.4):** `tests/tax/rentalTaxDedup.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-1`

Deliberately scoped OUT of MON-009: buildTaxSummary(data.income,...) uses raw records so per-record actuals/reform logic is preserved. §12.14 reform-awareness applies (regime, grandfathering). Fix by threading the MON-009 adjusted rental into the tax income path with the §12.14 PR block. | 2026-07-10: fixed by feeding buildTaxSummary the MON-009 adjustedIncome (adjustPropertyRentalIncome), the same deduped array buildIncomeBreakdown reads → passive-rental total and taxable-rental basis converge. No new tax math (delegates to reform-aware calculateTaxPosition, §12.14 outcome b). Test tests/tax/rentalTaxDedup.test.ts.

### MON-011 — Portfolio equity sums FLOORED per-property equities — overstated by exactly $37,076

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-07

> **What was wrong:** Your total property equity is shown $37,076 too high on Home, My Guide and Balances. A property that owes more than it's worth (equity -$37,076) is clamped to $0 before the total is added up, so the negative never subtracts.
>
> **What changed:** calculateEquity is now SIGNED (value − loan) — one source; the portfolio total, net worth's property equity, and the Properties page all read it. Per-property display can still floor to $0 if wanted, but totals sum the true signed value.
>
> **What you should see:** Portfolio equity reads $2,955,102 everywhere (matching the Properties page), not $2,992,178; an underwater property shows negative equity, not $0.

- **Root cause:** `lib/utils/calculations.ts:33`, `lib/services/masterFinancialService.ts:1961`
- **Neomatrix:** `number.propertyPortfolioEquity`
- **Downstream consumers (§19.4):** `app/dashboard/page.tsx`, `app/dashboard/cfo`, `app/dashboard/balances`, `app/dashboard/properties/page.tsx`, `app/api/dashboard/hidden-wealth/route.ts`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts`, `lib/cfo/scenarios/sellProperty.ts`
- **Fix PR(s):** #1347
- **Holistic test (§19.4):** `tests/calculations/propertyPortfolioEquity.test.ts`
- **Detail:** `chat audit 2026-07-07 #1`

Arithmetic proof: 1,072,178+380,000+0+750,000+418,000+372,000 = 2,992,178 exactly (Lot 1's -37,076 floored). True sum = 2,955,102. Anchor verification 2026-07-07 (§19.2): the floor is calculateEquity = Math.max(0, propertyValue - loanBalance) at lib/utils/calculations.ts:25 (proposal cited :24 = the function signature; the defect line is :25). Consumer that sums floored per-property equity into the portfolio total to be pinned at diagnosis (suspect propertyDecisionSupport.ts:248 + the hidden-wealth/balances bucket builder that reads snapshot.propertyPortfolioEquity — feeds MON-012). VALIDATED 2026-07-07 CONFIRMED-REAL: producer chain proven — calculateEquity floor (calculations.ts:25) -> per-property equity at masterFinancialService.ts:1165 -> Sigma of FLOORED per-property equities at :1918 (propertyPortfolioEquity = propertyMetrics.reduce((sum,p)=>sum+p.equity,0)). SCOPE CORRECTION: the floor overstates propertyPortfolioEquity and every surface reading it (MON-012 buckets, My Wealth equity tiles) but does NOT overstate headline NET WORTH — calculateNetWorth computes property equity globally + unfloored (netWorthCalculator.ts:236, Sigma values - Sigma mortgages). Neomatrix anchor DRIFT: graph cites masterFinancialService.ts:1110 for the equity feed; real call is :1165 — correct in the §21.2.1 update. Fix sums signed equity for portfolio totals (floor only per-tile display if wanted). FIX SHIPPED (PR #1347 draft, at FIXING — pending Reza data-verify): made the canonical calculateEquity SIGNED (removed the Math.max(0,...) floor) at lib/utils/calculations.ts:33 — equity is value − loan by definition. propertyPortfolioEquity (masterFinancialService.ts:1961, Σ p.equity) is now signed → converges with net worth's property equity (Σvalue − Σmortgages, always unfloored) and the properties-page total. Deduped the properties page's local equity closure onto the canonical (§12.2.1). Bonus §19.4 wins: sellProperty's `equity < 0` warning (was DEAD behind the floor) now fires for underwater properties; insightsEngine leverage (>200k) correctly never triggers on negative equity. Neomatrix: modelled number.propertyPortfolioEquity (was a §21.5 blind spot) + calculateEquity node updated floored→signed; 2 anchors re-pinned; neomatrix:check green. Worked example: 3 props incl. one −$37,076 underwater → floored sum 900,000 vs signed 862,924 (diff exactly 37,076); nw.breakdown.propertyEquity === signed sum. Test tests/calculations/propertyPortfolioEquity.test.ts. Also partially helps MON-012 (its lockedLongTerm bucket reads the now-correct signed propertyPortfolioEquity).

### MON-012 — Balances liquidity buckets fail L3 tie-out by exactly $64,572 (floored equity + credit card + HECS)

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: balances · opened 2026-07-07

> **What was wrong:** On Balances, Liquid + Accessible + Locked = $3,398,482 but net worth is $3,333,910 — a $64,572 hole. Three causes: the inflated equity (+37,076), the credit card -2,496 not netted from liquid cash, and the HECS -25,000 in no bucket at all.
>
> **What changed:** The buckets now partition net worth: credit cards net from Liquid, HECS/personal loans net from Locked, term deposits move to Accessible, and property equity uses the canonical (unfloored) net-worth basis. One engine (computeAccessibilityBuckets) sourced entirely from the net-worth result, so the three ALWAYS sum to net worth.
>
> **What you should see:** On Balances, Liquid + Accessible + Locked now add up EXACTLY to the Net worth figure on the same page (the $64,572 hole is gone). 'Inside Locked' shows a 'Less HECS / loans' line.

- **Root cause:** `app/api/dashboard/hidden-wealth/route.ts:47`, `lib/calculations/accessibilityBuckets.ts:73`
- **Neomatrix:** `engine.accessibilityBuckets.computeAccessibilityBuckets`, `ui.balances.hiddenWealth`
- **Downstream consumers (§19.4):** `app/dashboard/balances/page.tsx`, `components/balances/HiddenWealthLens.tsx`, `app/api/dashboard/hidden-wealth/route.ts`
- **Fix PR(s):** #1347
- **Holistic test (§19.4):** `tests/calculations/accessibilityBuckets.test.ts`
- **Detail:** `chat audit 2026-07-07 #2`

64,572 = 37,076 + 2,496 + 25,000 exactly. Anchor verification 2026-07-07 (§19.2): the bucket builder is app/api/dashboard/hidden-wealth/route.ts — lockedLongTerm = propertyEquity + superannuation + personalAssets at :56 (propertyEquity = snapshot.propertyPortfolioEquity at :53, the floored/inflated value from MON-011); liquidToday = snapshot.quickMetrics.liquidCash at :51 (does NOT net the -2,496 credit card); HECS -25,000 is assigned to no bucket. Add a permanent reconciliation test: liquidToday + accessible + lockedLongTerm === netWorth. FIX SHIPPED 2026-07-08 (PR pending): extracted pure engine lib/calculations/accessibilityBuckets.ts (computeAccessibilityBuckets) that partitions net worth — liquidToday=min(liquidCash,accounts)−creditCards; accessible=investments+nonLiquidCash(term deposits); lockedLongTerm=(properties−mortgages)+super+personalAssets−personalLoans. Σ = assets.total − liabilities.total = netWorth BY CONSTRUCTION (proof in JSDoc + 200-portfolio fuzz test). Route rewired to call the engine (was inline, un-netted). Component bar now proportions against netWorth (was totalAssets) + 'Inside Locked' nets long-term debt. Sources every value from the canonical NetWorthResult (§12.2.1) — uses breakdown.propertyEquity (unfloored global), so the equity component is correct independent of MON-011. §19.4 downstream: balances page + HiddenWealthLens read only this route. Neomatrix: modelled engine.accessibilityBuckets.computeAccessibilityBuckets + ui.balances.hiddenWealth + law.accessibilityTieOut (was a §21.5 blind spot); feeds edge from calculateNetWorth; neomatrix:check green (binding 157/157). Holistic test tests/calculations/accessibilityBuckets.test.ts (reported shape + term deposit + cc/HECS netting + underwater + calculateNetWorth end-to-end + 200-fuzz tie-out) — all 20 assertions verified via node. §20.4 10/10.

### MON-013 — Investment-account CASH ($67,871) excluded from net worth & total assets; Assets TILE includes it — two producers of 'total assets'

**🟠 FIXING** · 🔴 critical · changes numbers: **yes** · area: core · opened 2026-07-07

> **What was wrong:** Your $67,871 sitting as cash in 6 investment accounts is missing from Net worth ($3,333,911) and Total assets ($5,393,808) — net worth is understated by $67,871. Yet the Home 'Assets $5.5M' tile DOES include it, so two screens disagree about what you own.
>
> **What changed:** (planned) Value an investment account as holdings (units×price) PLUS cash balance in the one canonical net-worth engine; delete the second assets producer.
>
> **What you should see:** (after fix) Net worth rises ~$67,871 and Assets/Total assets/Net worth agree across Home, Balances and Investments.

- **Root cause:** `lib/calculations/netWorthCalculator.ts:239`, `lib/calculations/assetValuation.ts:44`
- **Neomatrix:** `number.netWorth`
- **Downstream consumers (§19.4):** `app/dashboard/page.tsx`, `app/dashboard/balances`, `app/api/portfolio/snapshot/route.ts`, `lib/services/masterFinancialService.ts`, `lib/calculations/entityBreakdown.ts`, `lib/services/netWorthSnapshotRecorder.ts`
- **Fix PR(s):** #1342
- **Holistic test (§19.4):** `tests/calculations/netWorthInvestmentCash.test.ts`
- **Detail:** `chat audit 2026-07-07 #3`

Proof: 5,393,808 = property 4,990,000 + cash 301,808 + other 102,000 exactly (investments contribute $0: units×price with 0 holdings). Assets tile 5.5M ~= 5,393,808+67,871. §12.2.1 duplicate source + valuation gap. Anchor verification 2026-07-07 (§19.2): holdingMarketValue = units × (currentPrice || averagePrice) at lib/calculations/assetValuation.ts:44 (no cash term); the canonical calculateNetWorth at lib/calculations/netWorthCalculator.ts:217 aggregates via calculateTotalAssets and never adds investment-account cash. Stored NetWorthSnapshot history carries the old basis — note it, don't rewrite history silently. VALIDATED 2026-07-07 CONFIRMED-REAL: schema field EXISTS — InvestmentAccount.cashBalance Float @default(0) at prisma/schema.prisma:2168 (+cashBalanceDecimal :2169), so the premise holds. Master path EXCLUDES it (calculateTotalAssets investment term = Sigma units×price only, netWorthCalculator.ts:127-131; investments.totalValue also holdings-only, masterFinancialService.ts:1233-1266). The SECOND producer app/api/portfolio/snapshot/route.ts:622-629 INCLUDES it (investmentCashBalances = Sigma cashBalance -> totalInvestmentValue -> totalAssets/netWorth), and the Home 'Assets' tile reads THAT producer (page.tsx:409 fetch + :732 render) — hence the ~$67,871 divergence. Two producers of 'total assets' = §12.2.1; the portfolio/snapshot re-aggregation is an UNMODELLED Neomatrix blind spot (§21.5), which is why A3 convergence never fired. Fix: value an investment account as holdings + cashBalance in the ONE canonical engine, delete/repoint the second producer. FIX SHIPPED (PR #1342, FIXING — pending Reza data-verify): full unify — calculateNetWorth/calculateTotalAssets (+Decimal) take an optional investmentAccounts cash param; BOTH master (masterFinancialService.ts) and portfolio/snapshot route now feed the ONE engine the SAME inputs (holdings@market, super, ACTIVE assets only, cash) so Home/Balances/Investments converge; master also excludes SOLD/WRITTEN_OFF assets (latent over-count). Also fixed the divergences due-diligence found: portfolio/snapshot previously OMITTED super + valued holdings at COST. Holistic test tests/calculations/netWorthInvestmentCash.test.ts (worked example nw=408,000; cash delta=8,000; Float/Decimal parity; cross-surface convergence; SSOT drift guard) + the existing invariants.test.ts (entity-sum == household net worth) still holds. Neomatrix: input.InvestmentAccount.cashBalance node+edge; neomatrix:check green.

### MON-014 — Home per-property tiles show rent-magnitude not cashflow when a loan lacks minRepayment — 3rd non-canonical cashflow producer (portfolio/snapshot) drops loan cost to $0, bypassing #1336/#1337

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: dashboard · opened 2026-07-07

> **What was wrong:** On the Home property tiles, the 'Monthly Cash Flow' number is true cashflow for some properties (Lot 1: -$3,908 correct) but the RENTAL INCOME for others (Broadbeach shows +$5,461 = its rent; real cashflow ~+$4,190). Same column, different meaning per row.
>
> **What changed:** The Home dashboard now computes each property's cashflow with the ONE canonical engine (computePropertyCashflow), the same one the property detail page uses — loan cost is floored to interest, never $0.
>
> **What you should see:** Each Home property tile's 'Monthly Cash Flow' × 12 equals that property's detail-page 'Cashflow/yr' (e.g. Broadbeach shows true cashflow ~+$4,190, not its gross rent +$5,461).

- **Root cause:** `app/api/portfolio/snapshot/route.ts:727`, `components/dashboard/tiles/DashboardPropertyTile.tsx:156`
- **Neomatrix:** `number.propertyCashflow`, `engine.propertyCashflow.computePropertyCashflow`, `ui.dashboard.propertyTileCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/page.tsx`, `components/dashboard/tiles/DashboardPropertyTile.tsx`, `app/api/portfolio/snapshot/route.ts`
- **Fix PR(s):** #1351
- **Holistic test (§19.4):** `tests/calculations/propertyCashflowSnapshot.test.ts`
- **Detail:** `chat audit 2026-07-07 #4`

Anchor verification 2026-07-07 (§19.2): the Home tile renders property.cashflow.monthlyNet under the 'Monthly Cash Flow' label at components/dashboard/tiles/DashboardPropertyTile.tsx:156 (label :147); the value is produced upstream in masterFinancialService buildPropertyMetrics and, for some rows, equals the rent rather than the cashflow. Prod-verification 2026-07-07: #1337 IS live in production (dpl_45ww, 2026-07-03 10:16:44 UTC) yet the Properties LIST also still diverges from the corrected detail pages (e.g. Lot 1 -$74,614, stale yields) — so this is LIVE, not cache, and blocks MON-002/MON-009 from VERIFIED. This issue captures the Home tile rent-in-cashflow binding + the residual list divergence; fix binds every surface to the one computePropertyCashflow source (§19.4). VALIDATED 2026-07-07 CONFIRMED-REAL with MECHANISM + ANCHOR CORRECTION: the tile always reads property.cashflow.monthlyNet (DashboardPropertyTile.tsx:156) — there is NO per-row field switch. The real defect is a THIRD non-canonical cashflow producer: app/api/portfolio/snapshot/route.ts:676 computes annualLoanRepayments = Sigma toAnnual(l.minRepayment || 0, ...) then :680 propertyCashflow = rent - expenses - repayments, :709 monthlyNet = /12. When a loan has no minRepayment recorded, 'minRepayment || 0' drops the loan cost to $0, so monthlyNet = rent - expenses - 0 ~= rent (Broadbeach +$5,461); a loan WITH minRepayment yields true cashflow (Lot 1 -$3,908). The canonical computePropertyCashflow (propertyCashflow.ts:151-153) explicitly floors loan cost to interest (principal×rate/12), never $0 — Broadbeach true ~= 5,461 - 1,271 = +$4,190. #1336/#1337 unified the property PAGES on computePropertyCashflow but the dashboard reads portfolio/snapshot, whose inline producer was NOT unified (§12.2.1). This producer is an UNMODELLED surface (§21.5) — modelling it with semanticKey 'propertyCashflow' would fail A3 convergence (2 engines, 1 key). Fix = repoint the snapshot producer to computePropertyCashflow (same source as detail + list); also resolves the residual LIST divergence. [2026-07-10 Chrome audit] RE-CONFIRMED — STILL LIVE/OPEN (AUDIT-04, primary driver of AUDIT-03): Home Monthly Cash Flow shows GROSS RENT for positive props (Broadbeach +$5,461; Thornland Lot2 +$2,817=33,800/12) while negative props show true cashflow. Independently re-verified to source this session: portfolio/snapshot route.ts:709 toAnnual(l.minRepayment||0,...) drops loan cost to $0. FIX SHIPPED 2026-07-10 (PR pending): the portfolio/snapshot route's inline third producer (Sigma toAnnual(minRepayment||0) → rent−expenses−repayments, dropping loan cost to $0) is replaced with computePropertyCashflow — the ONE canonical engine (propertyCashflow.ts:93, loan cost floored to interest at :153, never $0). Fed IDENTICAL inputs to master buildPropertyMetrics: propertyIncome/expenses/loans + reconciled unifiedTransaction rows (new linked-tx fetch replicating master's query, actuals-first) → the Home tile equals the detail page + list (§12.2.1 one engine / §19.4 same number everywhere). Return cashflow.monthlyNet = cf.monthlyCashflow (canonical monthly, not annual/12). §19.2 worked example (traced to source): loan 300k@6% no minRepayment → interest floor 18,000/yr (not $0) → cashflow 30,000−6,000−18,000 = 6,000 (old bug: rent−expenses−0 = 24,000). Neomatrix: modelled ui.dashboard.propertyTileCashflow (sk=propertyCashflow — converges with detail/list on computePropertyCashflow; was a §21.5 blind spot) + rendered-at edge; GET anchor re-pinned 513→517; neomatrix:check green (A3 converges). Test tests/calculations/propertyCashflowSnapshot.test.ts (interest-floor worked example + both-surfaces-one-engine lock). Scoped residual (NOT this fix): the household-level snapshot.cashflow.monthlyNetCashflow (route.ts:663-669) keeps toAnnual(minRepayment||0) — it is the SnapshotV2 DECLARED view (§12.2, dashboard uses it only as a fallback behind the canonical KPI); changing it would blur the declared-vs-actual distinction. §20.4 10/10. Local tsc/vitest unavailable → CI-verified.

### MON-015 — Entity-cashflow widget components don't sum to its own total (-$655 gap) + claims '12 entities' when 9 exist + monthly figure mislabelled 'annual'

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: dashboard · opened 2026-07-07

> **What was wrong:** The Entity Cashflow tile on the dashboard didn't add up: its total (-$17,121/mo) included six things but only four were shown as lines, so the visible rows came up ~$655 short. It also said '12 entities' (it was counting your properties + investment accounts, i.e. assets) when your structure has 9 entities, and it labelled a monthly figure as 'annual'.
>
> **What changed:** The tile now shows all six lines that make up the total (adds the previously-hidden Loans and Assets rows), counts entities from the same source the rest of the dashboard uses, and labels the figure 'monthly'.
>
> **What you should see:** The tile's lines now add up to its headline total, the entity count matches the number shown elsewhere on the dashboard (your real entities, not asset counts), and it reads 'monthly net'.

- **Root cause:** `components/dashboard/tiles/GlassInsightTiles.tsx:299`, `components/dashboard/EntityCashflowSummary.tsx:795`
- **Downstream consumers (§19.4):** `app/dashboard/page.tsx (GlassEntityCashflow — both call sites)`
- **Fix PR(s):** #1356
- **Holistic test (§19.4):** `tests/dashboard/entityCashflowWidget.test.ts`
- **Detail:** `chat audit 2026-07-07 #5`

VALIDATED 2026-07-07 — CONFIRMED-REAL but DISPLAY/LABEL only (changesNumbers=false). Anchor CORRECTED: the widget is GlassEntityCashflow (components/dashboard/tiles/GlassInsightTiles.tsx:268-300), fed by calculateEntityCashflow (components/dashboard/EntityCashflowSummary.tsx:588-815) — NOT buildEntityBreakdown (entityBreakdown.ts:86 feeds the reports byEntity view, a different engine). Three real display defects: (1) additivity — headline total = summary.totalEntityCashflow (EntityCashflowSummary.tsx:795) sums 6 components (income/properties/investments/standaloneLoans/assets/expenses) but the widget shows only 4 rows (GlassInsightTiles.tsx:270-275), so standaloneLoansCost + assetsNet are in the total but never displayed -> the -$655 gap; the total itself is arithmetically correct. (2) count — GlassInsightTiles.tsx:299 labels 'N entities' from data.properties.length + data.investments.length (3 properties + 9 investment accounts = '12'), mislabelling asset counts as legal entities (universe = 9). (3) a MONTHLY figure is labelled 'annual net' (:299) though every component is monthly (sibling EntityCashflowSummary.tsx:244 correctly labels '/mo'). Fix is display+label: show all 6 rows (or fold the 2 hidden into a row), count from the entity source, correct the annual/monthly label. Unmodelled dashboard-widget surface (§21.5). [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-10): 9 entities vs across 12 entities reproduced (widget counts assets as entities). [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-016 — Debt-quality Good+Bad buckets omit the Guildford home loan ($377,822 unbucketed; sum != total)

**❌ RETRACTED** · 🟡 medium · changes numbers: **no** · area: dashboard · opened 2026-07-07

> **What was wrong:** Debt quality shows Good $1,657,076 + Bad $25,000 = $1,682,076, but total debt is $2,059,898 — the $377,822 home loan is in the total but classified as neither.
>
> **What changed:** (planned) Every loan gets a classification; buckets must sum to total debt.
>
> **What you should see:** (after fix) Good + Bad (+ any 'Neutral/Home') = total debt exactly.

- **Root cause:** `components/dashboard/DebtQualityWidget.tsx:370`
- **Downstream consumers (§19.4):** `app/dashboard/page.tsx`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `chat audit 2026-07-07 #6`

RETRACTED 2026-07-07 — MISREAD, not a bug (validated against source). calculateDebtQuality (components/dashboard/DebtQualityWidget.tsx:340) partitions EVERY loan into good/neutral/bad (switch :370: 'HOME'->neutral, INVESTMENT/BUSINESS->good, default incl. STUDENT->bad) and defines totalDebt = goodDebt.total + neutralDebt.total + badDebt.total at :404 — the total IS the sum of the three buckets by construction, so a loan cannot be 'in the total but in no bucket'. The widget renders the neutral bar (:222-223) + neutral CategoryCard (:243-251). The $2,059,898 - $1,682,076 = $377,822 gap is exactly neutralDebt.total (the Guildford HOME loan) — the audit summed only Good+Bad and omitted the Neutral bucket that exists. Even a mis-typed/null loan falls to the default 'bad' branch (:384), never dropped; loan type reaches the widget intact (portfolio/snapshot route.ts:783 maps type verbatim). Residual is a designer/psychology note only: the neutral bar is easy to miss — a display-clarity tweak, not a number defect (changesNumbers=false). [2026-07-10 Chrome audit] RE-RAISED as AUDIT-05 (debt buckets miss $377,822) and RE-CONFIRMED A MISREAD — NOT a bug. Independently re-verified to source this session: calculateDebtQuality partitions EVERY loan good/neutral/bad and totalDebt = good+neutral+bad by construction (DebtQualityWidget.tsx:404); the Guildford HOME loan is the NEUTRAL bucket and $377,822 == neutralDebt.total exactly. The audit again summed only Good+Bad and omitted the neutral bar. Hallucination — no action.

### MON-017 — Safety Net score is fiction on real data: 'Positive Cashflow 15/15' while cashflow is negative; recovery times uncomputable but shown; 0/0 bills scores 30/30; 3mo vs 6mo target contradiction

**🟢 VERIFIED** · 🔴 critical · changes numbers: **yes** · area: safety-net · opened 2026-07-07

> **What was wrong:** Safety Net awards 100/100 including 15/15 for 'Positive Cashflow' while every cashflow surface is negative (-$6,073/mo). 'Recovery ~1 month' after a $3,000 shock is impossible with a negative surplus — invented number. 30/30 for bills is credit for 0 tracked bills. Home says 6-month target, this page says 3 months, same 11.7 figure.
>
> **What changed:** (planned) Score cashflow from the canonical monthly cashflow (fail when negative); recovery = cost ÷ actual surplus, shown as 'not recovering' when surplus <= 0; bills neutral at 0 tracked; ONE emergency-target source.
>
> **What you should see:** (after fix) With negative cashflow the score drops below 100, recovery shows honestly, and the target months read the same on Home and Safety Net.

- **Root cause:** `app/api/safety-net/route.ts:85`, `app/api/safety-net/route.ts:52`, `app/api/safety-net/route.ts:82`
- **Neomatrix:** `number.monthlyCashflow`
- **Downstream consumers (§19.4):** `app/api/safety-net/route.ts`, `app/dashboard/safety-net/page.tsx`, `lib/calculations/safetyScore.ts`
- **Fix PR(s):** #1346, #1359
- **Holistic test (§19.4):** `tests/calculations/safetyScore.test.ts`
- **Detail:** `chat audit 2026-07-07 #7`

§0.3 no-invented-numbers. Anchor verification 2026-07-07 (§19.2), all in app/api/safety-net/route.ts: cashflowScore = monthlySurplus > 0 ? 15 : monthlySurplus > -200 ? 8 : 0 at :85 (awards 15/15 only if monthlySurplus reads POSITIVE — i.e. monthlySurplus is sourced declared, not the canonical negative actuals — the §19.1 root); targetMonths = 3 HARDCODED at :52 (contradicts Home's 6-month target — one-source fix); billsScore = totalBills > 0 ? (billsOnTime/totalBills)*30 : 30 at :82 (0/0 bills scores full 30/30); recoveryWeeks guards monthlySurplus>0 at :100/:106/:112 (shows a real figure only because monthlySurplus reads positive — same declared-source root). Also 4 colliding scores (Safety 100 / Health 56 / CFO 48 / Cashflow-health 75) need distinct labels. VALIDATED 2026-07-07 CONFIRMED-REAL (all 4 sub-claims): the §19.1 root is safety-net/route.ts:58 — monthlySurplus = qm.monthlyIncome (DECLARED net income, masterFinancialService.ts:2048) minus totalMonthlyOutgoings (ACTUAL avg outflow when hasActualData, :48-50) — an asymmetric mixed source; the canonical qm.actualNetCashflow (:2078, = -6,073 here) is available but UNUSED, so cashflowScore reads 15/15 (:85) and recoveryWeeks shows a finite number (:100/106/112, guarded monthlySurplus>0) even though real net is negative. billsScore=30 on 0 bills confirmed (:81-83, totalBills=recurringPayments.length). Target contradiction confirmed: route :52 targetMonths=3 vs buildEmergencyFundMetrics masterFinancialService.ts:1360 targetMonths=6 (§12.2.1 duplicate constant). Fix: score cashflow from qm.actualNetCashflow when hasActualData; bills neutral at 0 tracked; ONE targetMonths source. Unmodelled surface (§21.5). FIX SHIPPED (PR pending, FIXING — pending Reza data-verify): extracted a pure engine lib/calculations/safetyScore.ts (computeSafetyScore) on CANONICAL inputs — cashflow dimension reads qm.monthlyCashflow (actuals-aware net; a real deficit scores 0), zero tracked bills scores 0 (not 30), emergency-fund coverage/target read from snapshot.emergencyFund (6-month target, one source). monthlySurplus = qm.monthlyCashflow so recoveryWeeks/weeksToTarget return null (not a fabricated timeframe) when cashflow <= 0. Recommendation text de-hardcoded (targetMonths). Worked example: 11.7mo, 0 bills, -$6,073 cashflow → 40+0+15+0 = 55 FRAGILE (was ~100). Neomatrix: new engine.safetyScore.computeSafetyScore + ui.safetyNet.safetyScore nodes + number.monthlyCashflow feeds edge (A3 convergence with /cashflow + dashboard); structural-graph + neomatrix:check green. Test tests/calculations/safetyScore.test.ts. Known remaining placeholder (flagged, NOT fabricated by this fix): noNewDebt stays 15/15 (optimistic default; new-consumer-debt detection is a separate feature, no data source yet). The 4-colliding-scores labelling is a separate cross-surface UX issue (follow-up). [2026-07-10 Chrome audit] RE-RAISED as AUDIT-07 (Positive Cashflow 15/15 while negative). Fix #1346 IS merged + present at HEAD (computeSafetyScore wired; monthlySurplus=qm.monthlyCashflow). Audit ran ~24h AFTER #1346 merged yet shows old behaviour -> observed a PRE-DEPLOY/CACHED prod state, not a live code defect. Verify prod deploy (§17.2) at data-verify. RESIDUAL (VR-001 2026-07-11): the route fed the score qm.monthlyCashflow (DECLARED — read positive at −$6,073/mo actual) while claiming actuals-aware; fixed in PR #1359 to getCanonicalMonthlyCashflow(snapshot).net + Ring-0 ratchet test (tests/verification/vr001Ratchet.test.ts).  [VERIFIED 2026-07-14 via VR-002, docs/verification/runs/VR-002.md] Positive Cashflow now 8/15 (was 15/15), Safety 70->63. Confirmed on live data.

### MON-018 — CFO 'Monthly progress: net worth +2%' is a ×0.98 PLACEHOLDER rendering as a real trend

**🟢 VERIFIED** · 🔴 critical · changes numbers: **yes** · area: cfo · opened 2026-07-07

> **What was wrong:** My Guide shows 'Net worth change $64,638 (+2%)' every month — computed against last-month = this-month × 0.98, a placeholder in code, not your history. Real trend from stored snapshots is +0.2% over 2 months.
>
> **What changed:** (planned) Point monthly progress at the canonical NetWorthSnapshot history (netWorthHistory.ts) and delete the local placeholder net-worth copy.
>
> **What you should see:** (after fix) My Guide's monthly change matches the Home Net Worth trend tile.

- **Root cause:** `lib/cfo/intelligenceEngine.ts:117`
- **Neomatrix:** `number.netWorthTrendDelta`, `engine.intelligenceEngine.calculateMonthlyProgressNetWorth`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `lib/cfo/intelligenceEngine.ts`, `app/api/dashboard/charts/route.ts`, `lib/calculations/netWorthHistory.ts`
- **Fix PR(s):** #1343
- **Holistic test (§19.4):** `tests/cfo/monthlyProgressCanonical.test.ts`
- **Detail:** `chat audit 2026-07-07 #8`

Neomatrix already flags the ×0.98 placeholder. Anchor verification 2026-07-07 (§19.2): the placeholder is lastMonthNetWorth = currentNetWorth * 0.98 at lib/cfo/intelligenceEngine.ts:176 (inside calculateMonthlyProgress; netWorthChange :177, percent :178) — NOT :377, which the proposal cited but is the Decimal sibling calculateMonthlyProgressNetWorthDecimal whose own JSDoc (:374) points AT this ×0.98 placeholder. Canonical replacement: netWorthHistory.getNetWorthHistory over stored NetWorthSnapshot. Savings rate -39.1% on the same card disagrees with the -30.5% KPI — include in the downstream sweep. VALIDATED 2026-07-07 CONFIRMED-REAL: algebra proves (currentNetWorth - 0.98·currentNetWorth)/(0.98·currentNetWorth)×100 = +2.0408% for EVERY user regardless of data (:176-180); rendered at app/dashboard/cfo/page.tsx:1107. Canonical history exists + is unused (lib/calculations/netWorthHistory.ts getNetWorthHistory + NetWorthSnapshot + netWorthSnapshotRecorder.ts). Same file carries MORE placeholders: savingsRateChange: 0.5 // Simulated, debtReduction = totalDebt * 0.005 // Assume. Savings-rate discrepancy = §12.2.1 duplicate: :183-191 re-derives from DECLARED raw prisma rows vs the KPI's qm.savingsRate (masterFinancialService.ts:2056, net/actuals-aware). calculateMonthlyProgress is UNMODELLED (§21.5). Fix: feed monthly progress from netWorthHistory; delete the placeholders. FIX SHIPPED (PR #1343, FIXING — pending Reza data-verify): calculateMonthlyProgress (now intelligenceEngine.ts:117) reads getNetWorthHistory(userId,2) for net-worth Δ + debt reduction (same canonical reader as the Home trend tile → converge) + snapshot.quickMetrics.savingsRate for the KPI-matching savings rate; savingsRateChange → null (UI hides sub-line); removed the ×0.98/0.5/0.005 placeholders + inline net-worth calc + 5 dead record types. Neomatrix: new ui.cfo.monthlyProgress node (semanticKey netWorthTrend, A3 convergence with ui.dashboard.netWorthTrendTile) + edge from number.netWorthTrendDelta; neomatrix:check green. Holistic guard tests/cfo/monthlyProgressCanonical.test.ts. Builds on MON-013 (net worth correct at source). [2026-07-10 Chrome audit] Touches AUDIT-02 (CFO savings-rate 75.4% vs 0/100 collision) — part of the savings-rate multi-producer family; #1343 merged/present at HEAD. [VR-007 2026-07-15] VERIFIED on live data (run VR-007, #1343 merged). No ×0.98 placeholder trend rendered; edgeCases.no_sentinel_leaks passes and the invariants show no sentinel leak on the CFO surface.

### MON-019 — 'Save 69 years' = the 999-month payoff SENTINEL leaking into UI arithmetic; refinance recommended on a 104% LVR loan

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: cfo · opened 2026-07-07

> **What was wrong:** Loan opportunities says extra repayments 'save 69 years'. The engine returns 999 months as code for 'this interest-only loan never pays off at the current payment'; the screen subtracts 999 - ~168 = 831 months = 69 years as if real. Benefit also shows negative (-$270,328), and it recommends refinancing a 104% LVR loan no lender would write.
>
> **What changed:** The 999 'never pays off' code is now recognised as a sentinel: interest-only loans show 'starts paying down' instead of a fake 'save 69 years', the benefit is only a dollar figure when the loan actually amortises (never negative), and refinancing is no longer suggested on a loan above 95% LVR.
>
> **What you should see:** On the CFO Loan Opportunities tile, an interest-only loan shows 'Starts paying down' / 'clears it in ~N yrs' (not 'Save 69 years'), the benefit is positive, and the 104% LVR loan is not offered a refinance.

- **Root cause:** `lib/cfo/decisionSupport/loanDecisionSupport.ts:687`, `lib/cfo/decisionSupport/loanDecisionSupport.ts:501`, `lib/cfo/decisionSupport/loanDecisionSupport.ts:316`
- **Neomatrix:** `engine.loanDecisionSupport.calculatePayoffMonths`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `lib/cfo/decisionSupport/loanDecisionSupport.ts`
- **Fix PR(s):** #1348
- **Holistic test (§19.4):** `tests/cfo/loanDecisionSupportGuards.test.ts`
- **Detail:** `chat audit 2026-07-07 #9`

999-168 = 831mo = 69.25yr matches the display exactly. Anchor verification 2026-07-07 (§19.2): calculatePayoffMonths at lib/cfo/decisionSupport/loanDecisionSupport.ts:635 returns the 999 sentinel when monthlyPayment <= 0 (:640) or when the payment doesn't cover interest (:646-647, interest-only) — an IO loan therefore returns 999 and the downstream 'years saved' arithmetic subtracts it as if it were a real payoff horizon. Fix: treat 999 as UNCOMPUTED ('not amortising'), never subtract it; correct the benefit sign; suppress refinance recs above ~95% LVR (§0 financial-adviser lens). VALIDATED 2026-07-07 CONFIRMED-REAL (sentinel->69yr + no-LVR-guard; negative-benefit PLAUSIBLE): the leak is loanDecisionSupport.ts:462 timeReduced = currentPayoffMonths - newPayoffMonths (unguarded), rendered app/dashboard/cfo/page.tsx:916 as Save round(timeReduced/12) years -> 999-168=831, round(831/12)=69yr exactly. calculatePayoffMonths returns 999 at :640 (payment<=0) and :646-648 (payment<=interest, i.e. interest-only). Negative benefit: interestSaved (:465-477) is corrupted once currentTotalInterest = payment×999-P (rendered cfo/page.tsx:915) — mechanism real, exact -$270,328 depends on the loan (PLAUSIBLE). Refinance: calculateRefinanceOpportunities (:245-307) filters only rate/expiry/savings — NO LVR gate anywhere — so a 104% LVR loan is still recommended. Fix guards the 999 sentinel before any arithmetic + adds an LVR ceiling to refinance recs. FIX SHIPPED 2026-07-08 (PR pending): (1) named the 999 sentinel NEVER_AMORTISES + guarded it in calculateExtraRepaymentImpact (loanDecisionSupport.ts:501) — timeReduced/interestSaved are null when the loan isn't amortising; added amortisingNow/startsAmortising/newPayoffMonths so the UI says 'starts paying down' instead of subtracting 999. (2) interestSaved only computed when BOTH scenarios amortise → never negative. (3) added MAX_REFINANCE_LVR=0.95 gate to calculateRefinanceOpportunities (threaded properties; :282,:316) so a 104% LVR loan is not 'worthRefinancing'. Render app/dashboard/cfo/page.tsx destructures the guarded fields (also removes the extraRepaymentImpact.timeReduced/12 frequency-lint false positive — baseline entry deleted). Exported the two pure helpers for testing. §19.2 verified via node: IO loan cur=999,new=221 → timeReduced null, interestSaved null, startsAmortising true; amortising loan timeReduced 145mo interestSaved +$108k; LoanA 104% LVR worth=false, LoanB 50% worth=true. Neomatrix: calculatePayoffMonths node produces/formula updated to document the sentinel-guard; 3 anchors re-pinned (615/635/661 -> 667/687/714); neomatrix:check green. Holistic test tests/cfo/loanDecisionSupportGuards.test.ts (13 assertions, all verified via node). §20.4 10/10.

### MON-020 — Two tax engines disagree ($153,278 vs $104,323 — §12.2.1 duplicate); /cashflow estimate omits Medicare (~$8,319). [CFO deductions-card 'mixes benefit' sub-claim RETRACTED as misread — see notes]

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: tax · opened 2026-07-07

> **What was wrong:** Cashflow page estimates $153,278 annual tax; My Guide estimates $104,323 — same person, same year. The cashflow figure back-solves to income tax with NO Medicare levy (~$8,319 missing). My Guide's deductions card says total $230,820 but its lines (Property $229,500 + Neg-gearing benefit $96,267) sum to $325,767 — and a tax BENEFIT ($ saved) sits inside DEDUCTIONS ($ off income).
>
> **What changed:** Both surfaces now read ONE canonical tax position (getUserTaxPosition → calculateTaxPosition), so the estimated tax is identical and includes the Medicare levy. The /cashflow page no longer runs its own income-tax-only calc with a smaller ad-hoc deduction set.
>
> **What you should see:** The estimated annual tax on the Cashflow page matches My Guide exactly, and it now includes the ~2% Medicare levy (so it's no longer the odd $153,278 vs $104,323 split).

- **Root cause:** `app/api/cashflow/intelligence/route.ts:421`, `lib/tax-engine/position/userTaxPosition.ts:50`
- **Neomatrix:** `number.taxPayable`, `number.cashflowIntelligence.estimatedTax`
- **Downstream consumers (§19.4):** `app/api/cashflow/intelligence/route.ts`, `lib/cfo/decisionSupport/taxIntegration.ts`, `app/dashboard/cfo`
- **Fix PR(s):** ##1349, ##1448
- **Holistic test (§19.4):** `tests/golden/ring2.taxParity.test.ts#one tax producer, every surface: route == bundle == master snapshot, hand-computed pin taxable 124,800 / net tax 30,724`
- **Detail:** `chat audit 2026-07-07 #10`

Sequence after MON-009/MON-010 (rental over-count feeds tax). §12.14 applies. Anchor verification 2026-07-07 (§19.2): the /cashflow estimate is estimatedTax = calculateIncomeTax(taxableIncome).taxPayable at app/api/cashflow/intelligence/route.ts:457 — income tax only, no Medicare levy added (the ~$8,319 gap); this is a SECOND tax producer parallel to the master tax position (§12.2.1 duplicate). calculateNegativeGearingBenefit at lib/cfo/decisionSupport/taxIntegration.ts:293 returns a tax BENEFIT ($ saved) that the CFO deductions card mixes into DEDUCTIONS ($ off income) and lets the lines exceed the stated total. Fix routes every surface through the master tax position and separates benefit from deduction. VALIDATED 2026-07-07 — core CONFIRMED-REAL, sub-claim (c) MISREAD: (a) Medicare omission CONFIRMED — calculateIncomeTax (lib/tax-engine/core/incomeTaxCalculator.ts:104) returns brackets-only taxPayable, NO levy; the CFO path uses taxPositionCalculator.ts:242 grossTax = incomeTaxResult.taxPayable + medicareResult.total (+levy). (b) Two engines CONFIRMED (§12.2.1): /cashflow route.ts:429-457 (ad-hoc deductible set + income tax only) vs CFO taxIntegration.ts:192 calculateTaxPosition (full deductions + Medicare + offsets); direction is diagnostic — /cashflow is HIGHER despite dropping the levy because its ad-hoc deductions are far smaller than the CFO's full deductions, so the dominant driver is the DEDUCTION GAP, Medicare a secondary opposite-direction term. (c) RETRACTED — the deductions card (cfo/page.tsx:849-877) shows 'Total Deductions' = deductionsSummary.totalDeductions; the neg-gearing BENEFIT is a SEPARATE, correctly-labelled Key-Metrics block (keyTaxMetrics.negativeGearingBenefit); NO code sums Property+Benefit — the '$325,767 exceeds total' is user cross-group mental arithmetic, not a code inconsistency. Only residual: designer/psychology proximity (benefit line sits near the deduction pills). Fix scope = (a)+(b): route every tax surface through the master tax position (incl. Medicare). §12.14 applies. FIX SHIPPED 2026-07-10 (PR pending): extracted lib/tax-engine/position/userTaxPosition.ts getUserTaxPosition(userId) — the ONE user-level tax source (fetch once + assemble + calculateTaxPosition, Medicare + full deductions + offsets). /cashflow buildTaxOptimization now reads taxPosition.tax.netTax (was calculateIncomeTax(gross−adHoc).taxPayable — income-tax-only); My Guide (taxIntegration.calculateCFOTaxInsights) reads the same getUserTaxPosition (removed its inline fetch/assemble/calculateTaxPosition). Both converge by construction. §12.14: getUserTaxPosition adds NO tax math — delegates to the reform-aware calculateTaxPosition (FW-1/FW-2 inherited). §19.2 (traced to source): grossTax = taxOnIncome + medicare.total (taxPositionCalculator:242); netTax = grossTax − offsets — so netTax includes the Medicare /cashflow dropped. Neomatrix: modelled orchestrator service.tax.getUserTaxPosition; repointed number.cashflowIntelligence.estimatedTax (formula → getUserTaxPosition().taxPosition.tax.netTax, semanticKey taxPayable → A3 convergence with number.taxPayable); re-pinned 2 taxIntegration anchors; neomatrix:check green (A3 converges, binding 158/158). §12.1: removed calculateIncomeTax import (/cashflow) + prisma import + inline fetch/assemble (taxIntegration). Test tests/tax/userTaxPositionConvergence.test.ts (Medicare-inclusion worked example + both-surfaces-read-one-source lock). §20.4 10/10. Sub-claim (c) already RETRACTED (deductions card correctly separate). Local tsc/vitest unavailable — types/tests are CI-verified. [2026-07-10 Chrome audit] AUDIT-01 (two tax estimates $153,278 /cashflow vs -$42,721 CFO) RE-CONFIRMED REAL and independently re-verified to source this session (incomeTaxCalculator returns bracket tax with NO Medicare; /cashflow route.ts:457 used calculateIncomeTax(...).taxPayable — 2nd producer, Medicare omitted). NOW FIXED by #1349 (merged 2026-07-10, AFTER the audit ran) — both surfaces read getUserTaxPosition, Medicare-inclusive + converged. The audit observed the pre-#1349 prod state. MON-020/060 COLLAPSE PR (2026-07-18): /api/tax/position no longer fetches/assembles its own inputs — it consumes getUserTaxPosition's bundle (Float position + Decimal twin from the SAME engineInputs; the route's assembly was a verbatim clone, so ZERO number change on the tax page). The dead 4th assembler /api/tax (zero consumers, own inline bracket math) DELETED. RECORDED FINDING (not silently changed, for Reza): the canonical assembler reads RAW income rows; master's old path additionally applied the MON-009 rental dedup + the isTaxable filter to its tax base — folding dedup + isTaxable INTO the canonical assembler is the remaining semantic unification (would change tax-page/cashflow/CFO numbers for fragmented-rental / non-taxable-row shapes; on Reza's healed live data VR-013/015 show the raw basis already lands the correct 35,360 rental). Ratchet: tests/golden/ring2.taxParity.test.ts (route == bundle == master, hand-computed pin 124,800/30,724).

### MON-021 — /cashflow renders actual and declared side-by-side unlabelled (In $0 vs In +$43,736) and two month-end forecasts disagree by $39K

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: cashflow · opened 2026-07-07

> **What was wrong:** Two things on the money pages disagreed: (1) My Guide's 'Month-End Balance' and the Cashflow page's forecast used different maths, so they projected balances tens of thousands of dollars apart; and (2) the Cashflow page showed 'Money In $0' in one spot and a much larger 'In +$43,736' in another, unlabelled — because one spot fell back to your typed (planned) income whenever your actual income for the month was $0.
>
> **What changed:** Both forecast tiles now roll your balance forward using the SAME one calculation off the SAME canonical monthly net, so they can only differ by their time window (month-end vs 30 days), never by method. And the money-flow 'Money In' now reads the same actual figure the headline shows, so a $0 actual month reads $0 in both places (no silent switch to planned income).
>
> **What you should see:** My Guide's 'Month-End Balance' and the Cashflow forecast now tell one coherent story. On the Cashflow page, the two 'Money In' figures agree — if you've had no income land this month it reads $0 in both, not $0 in one and a big planned number in the other.

- **Root cause:** `lib/cfo/intelligenceEngine.ts:222`, `app/api/cashflow/intelligence/route.ts:485`, `app/api/cashflow/intelligence/route.ts:654`
- **Neomatrix:** `engine.canonicalCashflow.projectBalanceForward`, `engine.canonicalCashflow.getCanonicalMonthlyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx:788 My Guide "Month-End Balance" tile (quickStats.projectedMonthEndBalance)`, `app/(dashboard)/cashflow/page.tsx hero "30-Day Forecast" (forecast.forecast30Day.predictedBalance) + "Money In" (forecast.current.income)`, `app/(dashboard)/cashflow GlassMoneyFlowTile (waterfall.netIncome) — now = canonical.inflow, agrees with the hero`
- **Fix PR(s):** #1354
- **Holistic test (§19.4):** `tests/cfo/monthEndForecastConvergence.test.ts`
- **Detail:** `chat audit 2026-07-07 #11`

§19.1. Anchor verification 2026-07-07 (§19.2): the My Guide month-end forecast is projectedMonthEndBalance = totalLiquid - (dailyBurn * daysRemaining) at lib/cfo/intelligenceEngine.ts:255 (rounded + returned :266) — a SECOND forecast producer parallel to Cashflow's 30-day forecast (the $39K disagreement). Proposal cited :354, which is the Decimal sibling calculateProjectedMonthEndBalanceDecimal, not the Float path actually rendered. The /cashflow unlabelled actual-vs-declared money-flow producer (In $0 vs In +$43,736) to be pinned at diagnosis. Related: Home mixes trailing-actual income ($239K) with declared ($484K) on one screen; '+1048.2% YoY' near-zero-baseline artifact to suppress; Activity 'keep 0%' vs components summing 173% same family. VALIDATED 2026-07-07 — (b) CONFIRMED-REAL, (a) MOSTLY REMEDIATED: (b) two forecast producers genuinely diverge (§12.2.1) — CFO intelligenceEngine.ts:255 projectedMonthEndBalance = totalLiquid - dailyBurn×daysRemaining (burn-only, liquid accounts, days-left-in-calendar-month, NO income) vs /cashflow buildForecastSummary in app/api/cashflow/intelligence/route.ts forecast30Day.predictedBalance = totalBalance + dailyNet×30 (net INCLUDES income, all accounts, rolling 30-day); different base+horizon+income treatment -> the ~$39k gap is structural. (a) the unlabelled '$0 actual vs $43,736 declared' pairing is largely FIXED — post 2026-06-23 cashflow-SSOT-convergence both /cashflow income surfaces read canonical actuals (route.ts:686 actualMonthlyInflow, :704 canonical.inflow); no $43,736 declared money-in producer remains on /cashflow (the pairing conflated /cashflow with the plan/home surfaces). RESIDUAL only: the /cashflow hero 'Money In' KPI has no basis label + no bare-$0 guard (shows a lone '$0' with nothing signalling 'actual — plan says $X'). Fix scope = one forecast producer (b) + a basis label on the hero KPI (a-residual). [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-06: $484K declared vs $239K trailing-actual income unlabelled; AUDIT-08: Money In $0 unlabelled; AUDIT-02 savings-rate bases). AUDIT-08 specific IN +$43,736 on /cashflow is a CONFLATION — that declared money-in producer was removed 2026-06-23; residual real issue is the unlabelled $0 hero KPI. | 2026-07-11: FIXED. Extracted ONE projectBalanceForward(balance, monthlyNet, days) in canonicalCashflow.ts; My Guide calculateQuickStats + /cashflow buildForecastSummary both project off getCanonicalMonthlyCashflow(snapshot).net via it (converge, differ only by horizon). Waterfall actualIncome = canonical.inflow (was truthiness fallback to declared at $0 actual). §19.2-verified the live /cashflow page uses buildForecastSummary (NOT the CFE generateForecast) — an initial mis-target caught + reverted before shipping. Neomatrix: new engine.canonicalCashflow.projectBalanceForward node + getCanonicalMonthlyCashflow→projectBalanceForward edge; 2 anchors re-pinned (321/345). Test tests/cfo/monthEndForecastConvergence.test.ts.  [VR-002 2026-07-14 F6] residual: CFO Month-End 301,707 vs /cashflow 30-day forecast 301,639 (delta 68). Stays FIXING pending investigation of the residual.

### MON-022 — Data-quality validation gaps inflating everything: $11,385/mo 'Battery System' recurring, company ATO tax as household spend, purchase price $0 -> '+0.0%', owner-occupied homes showing rental yield, count drift

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: data-quality · opened 2026-07-07

> **What was wrong:** Two property surfaces showed meaningless numbers: your PRIMARY RESIDENCE displayed a rental 'Yield 0.00%' (a home has no rental yield), and a property with an unknown/$0 purchase price showed a fabricated green '+0.0%' gain on its tile. (Separately, some totals are inflated by data-entry issues — a battery booked $11,385 EVERY month, and a company's ATO tax showing up in overall spending — see the diagnosis note; those are product/validation gaps, not a single code bug.)
>
> **What changed:** The property detail page now only shows Yield for investment properties (Equity + LVR still show for your home), and the property tile only shows a gain % when the purchase price is known.
>
> **What you should see:** Your home no longer shows a 'Yield' figure (it keeps Equity + LVR), and a property with no purchase price no longer shows a '+0.0%' gain badge.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:454`, `components/properties/PropertyTile.tsx:341`
- **Downstream consumers (§19.4):** `all cashflow/expense surfaces`
- **Fix PR(s):** #1357
- **Holistic test (§19.4):** `tests/dashboard/propertyDisplayGuards.test.ts`
- **Detail:** `chat audit 2026-07-07 #12`

Product/validation gap (no single code defect): rootCause deliberately left EMPTY — these are missing input-validation + review affordances, not a wrong line (§19.2 never guess an anchor). Freedom hero's -$20,590/mo net-passive matches no visible combination of property cashflows — anchor its inputs during the sweep. '3 producing income' label vs on-screen signs also here. Fix is Stitch-first for any new review surface (§18.2.1). VALIDATED 2026-07-07 — split into TWO REAL display bugs (now anchored) + DATA/PRODUCT-GAP items: (i) owner-occupied HOME shows a rental yield — the tile correctly gates yield behind isInvestment (PropertyTile.tsx:396) but the DETAIL page renders MiniKpi 'Yield' gated only by !isRental (app/dashboard/properties/[id]/page.tsx:443/447), so a PRIMARY RESIDENCE shows 'Yield 0.00%'; fix = gate on isInvestment to match the tile. (ii) $0 purchase -> '+0.0% gain' — the claimed divide-by-zero is a MISREAD (all gain% producers guard purchasePrice>0: masterFinancialService.ts:1211, properties/page.tsx:447, [id]/page.tsx:163), BUT PropertyTile.tsx:343-350 renders the gain% + green TrendingUp UNCONDITIONALLY, so a $0-purchase property shows a fabricated '+0.0%'; the detail page correctly suppresses (page.tsx:432, gainPct!==0); fix = suppress on tile when purchase unknown. changesNumbers=false (both are render suppressions). The battery $11,385/mo, company ATO-as-household-spend, and count drift (26 vs 24 / 9 vs 12) are DATA-ENTRY + missing-validation product gaps (not code defects) — the company-ATO one MAY be a real entity-scoping aggregation bug and needs its own investigation. gain%/yield are UNMODELLED (§21.5) — model when fixing. [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-09: yield on primary residence + +0.0% on $0 purchase — both display bugs anchored here; AUDIT-11: battery $11,385/mo one-off-as-recurring data-quality). AUDIT-10 sub-claims (YOU $4.6M vs Home $2.6M; 26 vs 20 holdings) NOT yet traced to source. | 2026-07-11 FIXED the two confirmed display bugs (yield-on-HOME → gated on isInvestment to match the tile; +0.0%-on-$0-purchase tile → gated on purchasePrice>0 to match the detail page). Test tests/dashboard/propertyDisplayGuards.test.ts. DIAGNOSIS of the data-entry items (NOT fixed — product decisions, surfaced to Reza): (a) company-ATO-as-household-spend is a real SCOPING consideration but not a clear code defect — masterFinancialService aggregates ALL expenses across ALL entities by design (masterFinancialService.ts:132 "all expenses, no filter"; the entity breakdown partitions by ownerEntityId at :301, and expenseAggregator SUPPORTS an ownerEntityId filter at :89-91). Whether "personal/household" surfaces should exclude company-entity expenses is a PRODUCT decision (does "my spending" include my company's ATO?) + would need threading an ownerEntityId scope through the personal-scoped surfaces. (b) battery $11,385/mo one-off-as-recurring + count-drift need a VALIDATION + REVIEW surface (Stitch-first §18.2.1) — deferred with MON-005/008. gainPct/yieldPct semantic Neomatrix nodes: N4 backfill (numbers unchanged — display suppression only). [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-023 — One-off expenses shown as $X/mo (isRecurring ignored) + reconcile duplicates expense records

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: expenses · opened 2026-07-07

> **What was wrong:** One-off purchases (a battery, an ATO tax payment) showed as '$X/mo' on the dashboard — 'Where your money goes' and 'Spending by category' treated them as monthly recurring costs, inflating your spending, category chart and health/savings. And reconciling the same payment kept ADDING duplicate expense records instead of updating (three 'Battery' rows), worse when you unreconciled and reconciled again.
>
> **What changed:** The monthly spending views now count RECURRING expenses only — a one-off contributes $0/mo and instead shows as real spend in the month it happened (Activity already does this). And reconciling a payment now links to an existing matching expense instead of minting a duplicate, so re-reconciling no longer stacks up rows.
>
> **What you should see:** On the dashboard, the battery and the ATO tax no longer appear as '$X/mo' — 'Where your money goes', the category chart, and your savings/health reflect only ongoing recurring bills. Those one-offs still show as actual spend on their dates in Activity. Re-reconciling a payment updates the same expense rather than adding another.

- **Root cause:** `app/api/dashboard/insights/route.ts:278`, `lib/calculations/expenseAggregator.ts:94`, `app/api/transactions/[id]/link/route.ts:589`
- **Neomatrix:** `orchestrator.masterFinancialService.getMasterFinancialSnapshot`, `orchestrator.dashboardInsights.GET`
- **Downstream consumers (§19.4):** `app/api/dashboard/insights/route.ts`, `lib/services/masterFinancialService.ts`, `app/api/transactions/[id]/link/route.ts`
- **Fix PR(s):** #1340
- **Holistic test (§19.4):** `tests/calculations/oneOffExpenses.test.ts`
- **Detail:** `docs/issues/ISSUES.md`

Reza decision 2026-07-07: one-offs excluded from monthly recurring views, shown as actual in-month. Fix: (1) insights moneyBleeding + byCategory filter isRecurring !== false + denominator = snapshot recurring total; (2) masterFinancialService quickMetrics.monthlyExpenses/health/freeCashDays/emergency-fallback + cashflow(savings) use recurring only; (3) link/route expense create reuses an existing matching expense (name+scope) instead of duplicating. The actuals path already showed one-offs correctly in-month. FIXING until Reza verifies. [2026-07-10 Chrome audit] Re-raises AUDIT-11 (one-off battery/subdivision expenses as monthly). Monthly-view treatment fix #1340 merged/present at HEAD; underlying data-entry + frequency-validation gap remains (MON-022/MON-025).

### MON-024 — "High Discretionary Spending" showed >100% (e.g. 906%) — discretionary/essential on a different base than the recurring total

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: expenses · opened 2026-07-07

> **What was wrong:** The dashboard warned 'High Discretionary Spending — 906% of your expenses are non-essential', which is impossible. After the one-off fix (MON-023) the 'total expenses' denominator counted RECURRING only, but the discretionary figure still included one-off purchases — so a one-off discretionary buy (a battery) was divided by a much smaller recurring total, giving 906%.
>
> **What changed:** Essential, discretionary and the total are now all measured on the SAME recurring basis (one-offs excluded from every slice), so essential + discretionary always equals the recurring total and the share can never exceed 100%.
>
> **What you should see:** The 'High Discretionary Spending' percentage is now sensible (0–100%). Essential + discretionary add up to your recurring monthly spend; a one-off purchase no longer distorts the split.

- **Root cause:** `app/api/dashboard/insights/route.ts:242`, `lib/services/masterFinancialService.ts:892`
- **Neomatrix:** `orchestrator.masterFinancialService.getMasterFinancialSnapshot`, `orchestrator.dashboardInsights.GET`
- **Downstream consumers (§19.4):** `app/api/dashboard/insights/route.ts`, `lib/services/masterFinancialService.ts`
- **Fix PR(s):** #1341
- **Holistic test (§19.4):** `tests/calculations/oneOffExpenses.test.ts`
- **Detail:** `docs/issues/ISSUES.md`

Regression introduced by MON-023 (denominator switched to recurring.total while discretionary/essential slices stayed all-inclusive). Fix: (1) insights route derives essential/discretionary/total from the SAME recurring expenseDetails set; (2) buildExpenseBreakdown essential/discretionary slices now also filter isRecurring !== false so essential+discretionary==recurring total everywhere. Regression test asserts discretionary/total <= 100%. FIXING until Reza verifies.

### MON-025 — Expense frequency defaults MONTHLY (never detected from dates); AI categorisation sets no recurring/frequency; no user frequency confirm; fuzzy-dedup missing

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: bookkeeping · opened 2026-07-08

> **What was wrong:** An annual payment (QBE car insurance, paid once a year) shows as $216/mo instead of ~$18/mo. Reason: reconcile defaults the frequency to MONTHLY and the dashboard trusts that stored value; nothing reads the real cadence from the transaction dates. The AI mass-categorisation only sets the CATEGORY — it never classifies recurring vs one-off or the frequency. There's no way to pick or confirm a frequency, and the same insurer split into two records (different spellings) with two different frequencies.
>
> **What changed:** (planned) 1) 'Where your money goes' + monthly totals run each expense through the canonical monthly resolver so cadence is read from the transaction dates (multi-payment auto-corrects); 2) a frequency picker at reconcile + a confirm/change control on auto-detected recurring transactions (suggest-and-confirm, never silent); 3) wire the existing cadence detector to propose the frequency; 4) fuzzy merchant dedup so spelling variants map to one record.
>
> **What you should see:** (after fix) An annual expense reads at its true monthly (~$18/mo), you can set/confirm a frequency on any recurring transaction, and the same insurer no longer appears as two records with two frequencies.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:345`, `app/api/dashboard/insights/route.ts:245`, `lib/bank/aiCategorisation.ts:248`, `app/api/transactions/[id]/link/route.ts:596`
- **Neomatrix:** `engine.monthlyResolver.resolveMonthly`, `orchestrator.dashboardInsights.GET`
- **Downstream consumers (§19.4):** `app/api/dashboard/insights/route.ts`, `app/api/transactions/[id]/link/route.ts`, `lib/bank/recurringExpenseDetection.ts`
- **Fix PR(s):** #1345
- **Holistic test (§19.4):** `tests/bank/merchantNormalize.test.ts`
- **Detail:** `docs/issues/ISSUES.md`

Verified (agent map 2026-07-08): frequency = body.frequency||'MONTHLY' (link/route.ts:345), insights uses stored declared frequency verbatim (insights:245), AI cascade hard-codes isRecurring:false/suggestedFrequency:null (aiCategorisation:248-250), good detector recurringExpenseDetection.ts is DEAD CODE (no importers), exact-name dedup misses spelling variants (link:596-607). Reza requirements 2026-07-08: (a) frequency picker at reconcile, (b) confirm/correct auto-detected recurring frequency, suggest-and-confirm not silent. UI pieces are Stitch-first (§18.2.1). Multi-PR workstream.

### MON-026 — Depreciation deduction 100× too high — cost×rate omits /100 (rate is a PERCENTAGE) → tax understated

**🟠 FIXING** · 🔴 critical · changes numbers: **yes** · area: tax · opened 2026-07-10

> **What was wrong:** Your property depreciation tax deduction was calculated 100× too high — the code multiplied cost by the rate as if 2.5% meant 2.5, so a $100,000 asset at 2.5% claimed $250,000/yr instead of $2,500. That understates your taxable income and the tax owed.
>
> **What changed:** Compute depreciation with the ONE canonical engine (calculateDepreciationAnnual), which correctly treats the rate as a percentage (÷100) and handles prime-cost vs diminishing-value.
>
> **What you should see:** Your depreciation/yr and your estimated tax reflect the real schedule (a $100k asset at 2.5% shows $2,500/yr, not $250,000); estimated tax rises accordingly.

- **Root cause:** `lib/tax-engine/position/userTaxPosition.ts:121`, `app/api/tax/position/route.ts:150`
- **Neomatrix:** `engine.depreciation.calculateDepreciationAnnual`, `number.taxPayable`
- **Downstream consumers (§19.4):** `lib/tax-engine/position/userTaxPosition.ts`, `app/api/tax/position/route.ts`, `app/api/cashflow/intelligence/route.ts`, `app/dashboard/cfo`, `lib/testing/exporter.ts`
- **Fix PR(s):** #1352
- **Holistic test (§19.4):** `tests/tax/depreciationRate.test.ts`
- **Detail:** `found during MON-003 investigation 2026-07-10`

VERIFIED 2026-07-10 (§19.2, all traced to source): DepreciationSchedule.rate is a PERCENTAGE — create validator app/api/properties/[id]/depreciation/route.ts:14 z.number().max(100,'Rate cannot exceed 100%'); /api/calculate/depreciation:84 rate*100 // Convert to percentage; schema comment 'rate Float // 2.5% for Div43'; canonical lib/depreciation/index.ts:89 const rate = schedule.rate/100. But userTaxPosition.ts + tax/position/route.ts computed cost×rate with NO /100 (the tax/position comment even wrongly claimed 'rate is stored as decimal' — the §19.2 don't-trust-the-comment trap) → 100× too high depreciation deduction → taxable income + net tax understated in BOTH the /cashflow+MyGuide shared source AND /api/tax/position. Pre-existing (carried into getUserTaxPosition verbatim during MON-020). FIX (Reza directive 2026-07-10 'fix both now, unified'): route ALL depreciation through calculateDepreciationAnnual (the ONE engine — /100 + method-aware Div40/Div43) in userTaxPosition.ts, tax/position/route.ts, the property page (MON-003), and lib/testing/exporter.ts (2 sites). §19.2 worked example: cost 100k @ 2.5% prime-cost → 2,500 (not 250,000). Neomatrix: modelled engine.depreciation.calculateDepreciationAnnual + edge → calculateTaxPosition (A3 converges: both taxPayable numbers now include depreciation) + number.propertyDepreciation. Test tests/tax/depreciationRate.test.ts (% worked example + DV + all-surfaces-one-engine lock). §12.14: depreciation method isn't among the 8 reform measures; routes to the existing engine, no new reform math. §20.4 10/10. Local tsc/vitest unavailable → CI-verified.

### MON-027 — CFE input builder (buildCFEInput) copy-pasted in two routes and DRIFTED — stress-test forecasts on PRE-tax income + includes transfers

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: cashflow · opened 2026-07-11

> **What was wrong:** The cashflow stress-test built its forecast from a stale copy of the input-assembly code: it used your BEFORE-tax income and counted internal transfers as cashflow, so stress-test projections were on a different (wrong) basis than the main cashflow forecast.
>
> **What changed:** Extracted the ONE correct input builder (after-tax income, transfers excluded) into a shared service; both the cashflow route and the stress-test route now use it.
>
> **What you should see:** Stress-test projections now line up with the main cashflow forecast basis — after-tax income (not gross), and internal transfers are not counted as money in/out.

- **Root cause:** `app/api/cashflow/route.ts:37`, `app/api/cashflow/stress-test/route.ts:45`
- **Downstream consumers (§19.4):** `app/api/cashflow/stress-test/route.ts (all stress scenarios — now forecast on after-tax income + transfers excluded)`, `app/api/cashflow/route.ts (unchanged basis — already correct; now imports the shared builder)`
- **Fix PR(s):** #1355
- **Holistic test (§19.4):** `tests/cashflow/buildCFEInputShared.test.ts`
- **Detail:** `discovered during MON-021 (2026-07-11)`

§12.2.1 duplication. The shared extraction was prototyped during MON-021 then reverted to keep MON-021 scoped to the forecast convergence. Fix as its own PR: lib/cashflow/buildCFEInput.ts shared service (after-tax + transfer-excluded), both routes import it. Also note: the linear forward-projection formula is duplicated in lib/cashflow/forecasting.ts + app/api/cashflow/route.ts — candidates to route through projectBalanceForward or the CFE engine.

### MON-028 — Property DETAIL page shows DECLARED cashflow/yield, not actuals — /api/properties/[id] drops linkedTransactions (drifts from list + Home)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-11

> **What was wrong:** A property's Cashflow/yr and Yield on its detail page didn't match the Properties list tile or the Home dashboard tile — the detail page showed a too-optimistic 'declared' number (e.g. Broadbeach $50,281/yr on the detail page vs ~$15,879/yr everywhere else).
>
> **What changed:** The detail page's data feed was dropping your reconciled bank transactions, so its cashflow fell back to your typed-in estimates instead of your actuals. Restored the transactions to the feed so the detail page now uses actuals-first, exactly like the list and Home tiles.
>
> **What you should see:** Open a property: its Cashflow/yr and Yield now read the SAME on the detail page, the Properties list tile, and the Home dashboard — and reflect your real transactions, not the higher typed estimate.

- **Root cause:** `app/api/properties/[id]/route.ts:58`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`, `ui.properties.detailCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`, `lib/services/masterFinancialService.ts`, `app/api/portfolio/snapshot/route.ts`
- **Fix PR(s):** #1359
- **Holistic test (§19.4):** `tests/api/propertyDetailActuals.test.ts`
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md`

Found via real-data Claude-Chrome verification 2026-07-11. This is the residual root cause behind MON-002 (per-property cashflow same everywhere) still failing on real data: the engine + list + Home were correct (actuals-first); only the detail route dropped linkedTransactions, making the detail page declared-only. Reverse of the initial hypothesis (detail was the declared outlier, not the actuals one).  [VERIFIED 2026-07-14 via VR-002, docs/verification/runs/VR-002.md] detail cashflow/yield now == list == Home on Broadbeach (50,281->15,879), Thornland Lot 1 (-46,897->-74,614), Guildford (-47,955->-28,303); yields converged. Confirmed on Reza live data.

### MON-029 — Savings rate has THREE contradictory producers (75.4% CFO / −30.5% Home / 0.0% Home insight)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: cross-surface · opened 2026-07-11

> **What was wrong:** The app showed three different savings rates at once — My Guide 75.4% (your typed plan), Home −30.5% (your last 12 months of real transactions), and a Home insight saying 0.0% (just this month so far).
>
> **What changed:** Created ONE savings-rate rule — your trailing 12 months of real transactions when history exists, your typed plan otherwise — and pointed all three surfaces at it. Deleted the typed-plan read on My Guide and the current-month read on the insight.
>
> **What you should see:** My Guide, the Home savings-rate tile, and any savings-rate insight now show the SAME figure (currently the honest −30.5%-region number from your real transactions, not the optimistic 75.4%).

- **Root cause:** `lib/cfo/intelligenceEngine.ts:152`, `app/api/dashboard/insights/route.ts:357`, `app/api/dashboard/insights/route.ts:620`
- **Neomatrix:** `number.savingsRate`, `engine.canonicalCashflow.getCanonicalSavingsRate`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `app/dashboard/page.tsx`, `app/api/dashboard/insights/route.ts`, `lib/cfo/intelligenceEngine.ts`
- **Fix PR(s):** #1359
- **Holistic test (§19.4):** `tests/verification/vr001Ratchet.test.ts`
- **Detail:** `docs/verification/runs/VR-001.md`

Found by real-data verification run VR-001 (2026-07-11). Root-cause investigation in progress — fix must REMOVE the culprit producer (CLAUDE.md §23.2.1), never patch on top.  [VERIFIED 2026-07-14 via VR-002, docs/verification/runs/VR-002.md] savings rate one value: CFO -30.5% == Home -30.5% (was 75.4 vs -30.5). Confirmed on live data.

### MON-030 — Health/Safety score differs across three pages (Home 50/C, CFO 46/D, Safety Net 70/100)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: cross-surface · opened 2026-07-11

> **What was wrong:** Your financial health score reads 50 on Home, 46 on My Guide and 70 on My Safety Net — three scores for one health.
>
> **What changed:** Your My Guide (CFO) score now comes from the SAME financial-health engine as your Home health score — so they show the same number (one health score, not three). The 6 old CFO bars are replaced by the 7 canonical health categories that actually build the score, so the bars explain the ring. My Safety Net stays a separate, purpose-built score (it measures your safety buffer, not overall health).
>
> **What you should see:** Open My Guide and the Home dashboard: the big health score + its grade now READ THE SAME on both. The My Guide bars are now Cash on hand / Cash flow / Debt health / Investments / Property / Protection / Long-term outlook (the 7 that build the score). My Safety Net is unchanged.

- **Root cause:** `lib/cfo/scoreCalculator.ts:33`
- **Neomatrix:** `number.cfoScore`, `number.healthScore`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `app/api/cfo/route.ts`, `lib/cfo/intelligenceEngine.ts`
- **Fix PR(s):** #1380, #1381
- **Holistic test (§19.4):** `tests/golden/ring2.cfoScoreDedup.test.ts`
- **Detail:** `docs/blueprint/NEOAUDIT.md`

Staged (Reza option B1). Stage 1 (PR #1377): extracted ONE canonical buildHealthInput (§12.2.1). Stage 2a (PR #1380, THIS): the CFO overall+grade+bars are sourced from the canonical generateHealthReport via intelligenceEngine.assembleCanonicalCFOScore (the ONE producer, used by getCFODashboardData + getCFOScore) — CFO overall == Home health == generateHealthReport score (golden: 72/B). The 6 legacy CFO component bars are replaced by the 7 canonical health categories (warm-labelled). calculateCFOScore is retained ONLY to feed generateActions (advisor unchanged, no regression) — removed in stage 2b. Neomatrix: number.cfoScore repointed from calculateCFOScore to generateHealthReport (§21.2.1). Cross-surface lock: tests/golden/ring2.cfoScoreDedup.test.ts. STAYS FIXING pending Reza live-data verification (Home==CFO on his real numbers). Stage 2b (PR #1381, DONE — Reza-approved REFRAME 2026-07-13): did NOT re-ground the advisor on the coarser 7 health categories (that would degrade advice precision — generateActions.findWeakAreas needs the granular 6 levers). Instead: kept the 6 CFO components as the advisor action-signals (extracted computeCFOComponents), and DELETED the dead competing-score role — calculateCFOScore + calculateTrend + getGrade + SCORE_WEIGHTS + calculateOverallScoreDecimal + the calc-audit overallScoreShadow + the scoreCalculator Neomatrix nodes (calculateCFOScore, calculateOverallScoreDecimal, cfoScoreWeights). Advice UNCHANGED (generateActions still takes the 6 components). number.cfoScore stays fed by generateHealthReport.  [VERIFIED 2026-07-14 via VR-002, docs/verification/runs/VR-002.md] CFO 50/C == Home 50/C, bars = the 7 warm categories (the run Reza was to eyeball). Confirmed.

### MON-031 — Liquid savings differs: Balances $301,808 vs Safety Net "Liquid savings" $304,304 ($2,496 gap)

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: cross-surface · opened 2026-07-11

> **What was wrong:** The Balances page and the Safety Net page disagreed by $2,496 on your liquid savings, with no explanation why.
>
> **What changed:** One formula now computes your deployable cash and subtracts credit-card debt in BOTH forms it can be recorded (a card loan, or a card account with a negative balance — yours is the account form). Every surface reads that one figure.
>
> **What you should see:** Safety Net's 'Liquid savings' reads $301,808 — the same number as Balances ('Liquid today'), Home ('Cash') and the cashflow page — and your emergency months read 11.6 everywhere (Safety Net, Home Health). The Qantas card still shows as its own Credit −$2,496 line.

- **Root cause:** `lib/calculations/netWorthCalculator.ts:219`, `lib/services/masterFinancialService.ts:1973`
- **Neomatrix:** `engine.liquidCash.computeLiquidCash`
- **Downstream consumers (§19.4):** `app/api/safety-net/route.ts (Liquid savings + monthsCovered from qm.liquidCash + snapshot.emergencyFund)`, `app/api/dashboard/insights/route.ts (emergencyFund block, Solid Emergency Fund insight, freeToday)`, `app/dashboard/page.tsx (Home Health Emergency tile via insights)`, `lib/calculations/safetyScore.ts (emergency dimension via snapshot.emergencyFund.monthsCovered)`, `lib/cfo/scoreCalculator.ts (emergency-buffer signal — repointed to computeLiquidCash this PR)`, `app/api/dashboard/hidden-wealth/route.ts (buckets.liquidToday === canonical by construction)`
- **Fix PR(s):** ##1368, ##1452, ##1455
- **Holistic test (§19.4):** `tests/golden/ring2.liquidCashParity.accountCard.test.ts#account-typed credit card (the VR-017 live topology): quickMetrics nets, I9 months identity, route parity, tie-out`
- **Detail:** `docs/verification/runs/VR-001.md`

VR-001. Verified: NOT a math bug — Safety Net shows GROSS liquid-account balances (quickMetrics.liquidCash, correct for emergency-fund months), Balances shows liquid NET of credit cards (accessibilityBuckets liquidToday = liquidBasis − creditCards, correct for the net-worth tie-out). The $2,496 gap IS the credit-card balance (documented in accessibilityBuckets.ts:13-14). Fix = disambiguate the labels (Balances → "Spendable today (after credit cards)"); product-copy PR. RESOLVED per Reza decision 2026-07-12 option (a): relabel, not collapse — changesNumbers flipped to false (copy-only). Balances liquid micro-copy now cards-aware. Awaiting Reza real-data confirm to move to VERIFIED. [VR-010 2026-07-17] Root-cause note appended per Matrix: liquid-asset gap persists — stays FIXING; see VR-010 run notes. CANONICAL FIX PR #1452 (2026-07-18): liquidCash netted at the ONE master producer (gross spendable − creditCards, the DEPLOYABLE basis — Reza confirms definition at merge); buckets engine re-contracted to take the canonical net (gross reconstructed internally) so liquidToday === quickMetrics.liquidCash by construction. Ratchet ring2.liquidCashParity (47,504 pin). Stays FIXING until the Matrix Ring-3 records Safety Net === Balances === Home === /cashflow at $301,808. [VR-017 RETRO + RE-FIX PR #1455 (2026-07-19)] Ring-3 VR-017 FAILED — Safety Net 'Liquid savings' + emergency months still GROSS ($304,304 / 11.7) with #1452 confirmed live. Root cause CORRECTED with executed evidence (§19.2): NOT a sibling producer — #1452's netting input `netWorth.liabilities.creditCards` is LOANS-only (calculateTotalLiabilities, netWorthCalculator.ts:219) and the live Qantas card is a CREDIT_CARD-typed ACCOUNT at −$2,496 (VR-007 capture:483), so the subtraction was silently 0. Balances' $301,808 was an accident of the buckets' min(gross, assets.accounts) — which also explains VR-010's inert cards-aware caption (breakdown.creditCards = loans-only = 0). The golden passed because it modelled the card as a LOAN (F2: same engine, different inputs). RE-FIX: ONE producer lib/calculations/liquidCash.ts computeLiquidCash nets BOTH representations (CREDIT_CARD loans + negative-balance CREDIT_CARD accounts); master + CFO emergency-buffer routed through it; inline netting deleted. Ratchets: ring2.liquidCashParity.accountCard.test.ts (LIVE topology + I9 months identity, fails on pre-fix code) + months-identity assertions added to the loan-card golden + liquidCash.test.ts worked examples. Census notes: /api/cashflow/intelligence runway (Σ ALL balances ÷ total outflow) and lib/health calculateLiquidAssets (positive non-CC cash + shares/ETFs, metricAggregation.ts:129) are DIFFERENT bases by design — untouched; health's basis is a labelling follow-up candidate. Stays FIXING until Matrix Ring-3 records $301,808 / 11.6 on Safety Net + Home Health + Balances + /cashflow + CFO.

### MON-032 — Property detail Recent-activity shows loan repayment "-$0" for a real loan (row reads raw minRepayment, not the engine-resolved cost)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: cross-surface · opened 2026-07-11

> **What was wrong:** On a property with a $228,000 loan, the activity list showed the repayment as $0 — the row read the unset manual field while the cashflow was correctly charging interest.
>
> **What changed:** The cashflow engine now exposes the per-loan cost it actually used (repayment, or the interest floor when no repayment is set), and the activity row renders THAT — labelled honestly as interest when no repayment is set.
>
> **What you should see:** The property activity list now shows e.g. "loan interest (no repayment set) −$1,271" instead of "repayment −$0", and it reconciles with the Cashflow/yr figure.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:830`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `lib/calculations/propertyCashflow.ts`
- **Fix PR(s):** #1359
- **Holistic test (§19.4):** `tests/verification/vr001Ratchet.test.ts`
- **Detail:** `docs/verification/runs/VR-001.md`

Found by real-data verification run VR-001 (2026-07-11). Root-cause investigation in progress — fix must REMOVE the culprit producer (CLAUDE.md §23.2.1), never patch on top. [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-033 — Yield shown for an owner-occupied HOME on the Home tile + CFO Low-Yield insight (detail page correctly hides it)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: cross-surface · opened 2026-07-11

> **What was wrong:** Your own home was shown with a "rental yield" on the dashboard and flagged "Low Yield" by My Guide — a primary residence has no rental yield.
>
> **What changed:** Yield now only renders for INVESTMENT properties on the dashboard tile, and the My Guide low-yield alert skips non-investment properties — the same rule the property page already used.
>
> **What you should see:** Your home no longer shows a yield on the dashboard tile and no longer gets a "Low Yield" alert; investment properties still show theirs.

- **Root cause:** `components/dashboard/tiles/DashboardPropertyTile.tsx:134`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts:100`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`
- **Downstream consumers (§19.4):** `components/dashboard/tiles/DashboardPropertyTile.tsx`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts`, `lib/services/masterFinancialService.ts`
- **Fix PR(s):** #1359
- **Holistic test (§19.4):** `tests/verification/vr001Ratchet.test.ts`
- **Detail:** `docs/verification/runs/VR-001.md`

Found by real-data verification run VR-001 (2026-07-11). Root-cause investigation in progress — fix must REMOVE the culprit producer (CLAUDE.md §23.2.1), never patch on top. [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-034 — Reports over-state ANNUAL-frequency income/expenses 12× — duplicate frequency converter missing the ANNUAL enum case (inflates tax deductions + report totals)

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: reports · opened 2026-07-12

> **What was wrong:** In your reports, anything entered at a YEARLY frequency (e.g. a $2,400/year insurance premium) was counted as if it were $2,400 per MONTH — so it showed as $28,800/year. On the golden test household this inflated total annual expenses from $20,400 to $46,800; on the Tax report it would over-state deductions (and under-state taxable income) for any yearly deductible expense.
>
> **What changed:** The report builder had its own copy of the frequency-to-annual conversion that had no case for the ANNUAL setting, so it fell through to multiplying by 12. Replaced it with the app’s single canonical converter (toAnnual, which handles ANNUAL correctly) and deleted the buggy copy.
>
> **What you should see:** Open the Income & Expense report and the Tax report: a yearly expense now shows its real yearly amount (e.g. $2,400, not $28,800), total annual expenses tie to your dashboard, and Tax deductions reflect the true yearly figure.

- **Root cause:** `lib/reports/contextBuilder.ts:469`, `lib/reports/contextBuilder.ts:493`
- **Downstream consumers (§19.4):** `lib/reports/generators/incomeExpense.ts`, `lib/reports/generators/taxTime.ts`
- **Fix PR(s):** #1376
- **Holistic test (§19.4):** `tests/golden/ring2.reportReconciliation.test.ts`
- **Detail:** `docs/changelog/CHANGELOG_2026_07_12.md`

Found by the NeoAudit §3 report-reconciliation lock on its FIRST run (§8 step-5): the income-expense report annual expenses ($46,800) did not tie to the canonical master annual expenses ($20,400) on the Golden Household. Root cause: a DUPLICATE frequency converter (calculateAnnualAmount in contextBuilder.ts) had cases for ANNUALLY/YEARLY but NOT the real Prisma enum value ANNUAL, so ANNUAL entries fell to default:*12. §12.2.1 remediation: removed the duplicate, use canonical toAnnual (removes the culprit, not a patch — Part 23). Blast radius: BOTH the income-expense AND tax-time reports (deductibleExpenses -> totalDeductions -> netTaxableIncome). semanticKeys empty because report annual figures are not yet modelled in the Neomatrix — a §21.5/§21.2 backfill gap (model report totals so a future VERIFIED can carry a resolving key). Stays FIXING pending Reza live-data verification.

### MON-035 — HOME property cashflow: Home dashboard tile disagrees with detail/list (delta 6040/yr)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-14

> **What was wrong:** On the Home dashboard, the HOME property's yearly cashflow tile shows a different number than the property's own detail page and the Properties list (which now agree).
>
> **What changed:** Every property surface now reads your reconciled transactions over the SAME trailing-12-month window (before, the detail page + list read all history while the Home dashboard read the last 12 months), so the same property shows the same Cashflow/yr and yield everywhere.
>
> **What you should see:** Open the HOME property: its Cashflow/yr on the detail page, the Properties list tile, and the Home dashboard tile now read the SAME number (and the same yield). The detail/list figures shift onto the 12-month run-rate basis.

- **Root cause:** `lib/services/propertyActuals.ts:157`, `lib/calculations/propertyActualsWindow.ts:32`
- **Neomatrix:** `number.propertyCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`, `app/api/portfolio/snapshot/route.ts`, `lib/services/masterFinancialService.ts`, `components/dashboard/tiles/DashboardPropertyTile.tsx`
- **Fix PR(s):** ##1396
- **Holistic test (§19.4):** `tests/golden/ring2.homePropertyParity.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: Home dashboard tile (HOME property cashflow). Expected: -321280/yr == detail/list. Actual: home tile -26270/mo => -315240/yr (delta 6040). Evidence/run: VR-002. | [FIX 2026-07-14] DECISION 2 = trailing-12-month. Root cause: computePropertyCashflow (one engine) fed THREE windows — all-time (detail/list via enrichPropertiesWithActuals) vs 12-month (Home/master). Fix: ONE window source lib/calculations/propertyActualsWindow.ts referenced by all three fetch sites (added the window to enrich — the bug site; master/snapshot already 12-month, now reference the constant). Ratchet: tests/calculations/mon035PropertyActualsWindow.test.ts (unit + source-lock: all 3 sites use the one window, no inline -12 remains). Neomatrix 3 anchors re-pinned + new file allowlisted (graphify offline, self-prunes). Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 FAIL: detail == list (-$8,668/yr) now agree, but the Home dashboard TILE still diverges (-$219/mo = -$2,628/yr) by the SAME ~$6,040/yr gap. HOME-SPECIFIC: Guildford tile (-$616/mo=-$7,392) ~matches its detail (-$7,387). Both paths use computePropertyCashflow on a 12-month window in code, so the divergence is a runtime input difference on HOME (loan w/o minRepayment + one-offs + >12mo txns) between portfolio/snapshot's per-property block and the property-detail path (F2: same engine, different inputs). RE-DIAGNOSE Stage 1 via a golden HOME-like fixture that reproduces it. Stays FIXING. | [NARROWED 2026-07-14] VR-004 cross-check: HOME tile yield 0.9% > detail 0.12% AND tile cashflow -$219/mo is LESS negative than detail -$722/mo. BOTH point the SAME way — the Home tile (portfolio/snapshot per-property block) computes MORE RENT for HOME than the property-detail path (more rent → higher yield AND less-negative cashflow). Same computePropertyCashflow engine + 12-month window, so the divergence is the INCOME/rental-transaction SET reaching the engine, not the window: portfolio/snapshot uses income.filter(propertyId===p.id)+global linkedTxns filtered; detail uses enrichPropertiesWithActuals (property's income relation + txns by its income/expense/loan ids). HOME-specific → a rental income record or txn included in one path's set but not the other. NEXT (not a guess-fix): build a golden HOME-like property (owner-occupied w/ a stray rental income record + rental txns + loan w/o minRepayment) that REPRODUCES the tile-vs-detail rent divergence in a Ring-2 test, fix the input set at source, and repoint the parity resolver off the shared-source false-green. | [RING-2 REPRODUCTION 2026-07-14] Built tests/golden/ring2.homePropertyParity.test.ts — runs the THREE real producers (portfolio/snapshot Home tile, /api/properties/[id] detail route + engine, master service) on a HOME shape engineered with the exact VR-004 vectors: stray RENTAL income on an owner-occupied property, a $503/mo ONE-OFF expense (isRecurring:false), a loan with NO minRepayment (interest floor), on BOTH declared AND actuals (transaction-backed) bases. RESULT: all three producers are BYTE-PARITY (cashflow AND yield), and all correctly EXCLUDE the one-off. This REFUTES the earlier "Home tile computes more rent" hypothesis — given identical rows the producers do NOT diverge. Root cause of the VR-004 FAIL is therefore DEPLOY-SKEW: the Chrome review ran mid-merge while MON-035 (window) + MON-037 (one-off exclusion) were landing across separate PRs, so the Home tile and detail page were served by different deploy generations at capture time. On the current single unified deploy they run the same code -> parity. Holistic test attached (the §19.4 cross-surface propagation lock + permanent HOME-shape NeoAudit coverage). Stays FIXING pending a Ring-3 re-check on the unified deploy (§23.2.3) to confirm the LIVE numbers agree before VERIFIED — no over-claim (§22.2.4). | [VR-005 STAGE-4 FAIL → RE-DIAGNOSED 2026-07-14] The Chrome re-check on the FULLY-MERGED deploy showed the Home dashboard tile STILL diverges (−$219/mo=−$2,628/yr, yield 0.9%) from detail/list/Risk-Radar (−$8,668/yr, 0.12%). So the #1401 "deploy-skew" conclusion was WRONG — this was a real live bug, and the Ring-2 reproduction gave a FALSE PASS because its DB mock (createGoldenDbFrom) IGNORES WHERE clauses, so it could never catch a fetch/assembly difference. REAL ROOT CAUSE (§12.2.1 duplicate producer): the portfolio/snapshot route had its OWN inline per-property transaction fetch (unifiedTransaction.findMany) + propertyTx filter feeding computePropertyCashflow — a DUPLICATE of enrichPropertiesWithActuals (which detail/list/Risk-Radar use). On live HOME data the inline path fell back to DECLARED rent (~$6,970/yr → 0.9%) while the enricher used 12-month ACTUALS (~$929/yr → 0.12%). FIX (remove-the-culprit §23.2.1): deleted the inline fetch+assembly; the route now calls enrichPropertiesWithActuals(userId, properties) and feeds computePropertyCashflow from property.income/expenses/loans + property.linkedTransactions — the SAME producer as the other 3 surfaces → Home tile == detail BY CONSTRUCTION. RATCHET (Ring-1 source-lock, the honest guard the value-parity test could not be): tests/golden/ring2.homePropertyParity.test.ts asserts the route uses enrichPropertiesWithActuals AND has NO inline unifiedTransaction.findMany. Also fixed the golden mock to populate property.findMany includes (the false-pass cause) + reduced the MON-035 window source-lock from 3 direct fetch sites to 2 (portfolio now delegates). Neomatrix: portfolioSnapshot.GET re-pinned 518→521 + formula updated to reflect the enricher delegation. Stays FIXING pending a NEW Chrome re-verify (VR-006). | [VR-006 VERIFIED 2026-07-14] Ring-3 re-check on the fully-merged deploy: HOME cashflow/yr now reads detail −$8,668 / list −$8,668 / Home tile −$8,664 (±$4 rounding) → CONVERGED (was −$2,628 tile vs −$8,668 detail in VR-005). All 6 properties' crossSurface.cashflowYr.match === true. The §12.2.1 duplicate-producer removal (#1405, portfolio route now delegates to enrichPropertiesWithActuals) is confirmed live. Ratchet = the Ring-1 source-lock in tests/golden/ring2.homePropertyParity.test.ts (already in CI). Promoted → VERIFIED. Baseline updated to VR-006.

### MON-036 — HOME rental yield reads three different values across surfaces (0.12 / 0.9 / 1.05)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-14

> **What was wrong:** The HOME property's rental yield shows three different percentages depending on which screen you look at.
>
> **What changed:** The CFO Risk Radar's 'Low yield' check now reads the SAME actuals-based yield engine as every other screen (it used to work off your typed-in rent only, over no shared window), so the yield matches everywhere. Combined with the MON-035 window fix, all four surfaces converge.
>
> **What you should see:** The property's rental yield now reads the SAME on the property detail page, the Properties list, the Home dashboard tile, and the My Guide Risk Radar (was 0.12% / 0.9% / 1.05% across them).

- **Root cause:** `lib/cfo/riskRadar.ts:417`
- **Neomatrix:** `number.propertyCashflow`
- **Downstream consumers (§19.4):** `lib/cfo/riskRadar.ts`, `lib/cfo/intelligenceEngine.ts`, `lib/cfo/aiAdvisor.ts`, `app/api/cfo/advice/chat/route.ts`, `app/dashboard/cfo/page.tsx`
- **Fix PR(s):** ##1397
- **Holistic test (§19.4):** `tests/golden/ring2.homePropertyParity.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: HOME detail/list vs Home tile vs CFO Risk Radar. Expected: same yield on every surface. Actual: 0.12pct detail/list, 0.9pct home tile, 1.05pct CFO risk radar. Evidence/run: VR-002. | [2026-07-14] The MON-035 window fix converges detail/list vs Home YIELD (0.12 vs 0.9 — yield derives from the window-based annualRent). REMAINING third value (CFO Risk Radar 1.05%) is riskRadar.ts:393 computing yield from DECLARED income (a separate producer, bypassing the engine) — the focused MON-036 fix (repoint to canonical), next PR. | [FIX 2026-07-14] Removed the 4th rogue yield producer: detectPropertyUnderperformanceRisks computed grossYield = annualIncome/currentValue from DECLARED income (riskRadar.ts), bypassing the engine. Now enrichPropertiesWithActuals (ONE 12-month window, MON-035) + computePropertyCashflow + calculateRentalYield — the SAME source as detail/list/Home. Cash-flow-negative flag now uses cf.annualCashflow (canonical). Ratchet source-lock: tests/cfo/mon036RiskRadarYield.test.ts. Neomatrix calculateSummary anchor re-pinned 601->621. Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 PARTIAL: detail 0.12% == list 0.12% == CFO Risk Radar 0.12% (was 1.05% on the radar) — the rogue declared-yield producer is FIXED. BUT the Home dashboard property TILE still shows 0.9% for HOME (rides on the MON-035 home-tile divergence — the tile's portfolio/snapshot cf.annualRent differs from detail for HOME). Stays FIXING until the MON-035 home-tile producer is fixed. | [RING-2 REPRODUCTION 2026-07-14] The same tests/golden/ring2.homePropertyParity.test.ts asserts rental-YIELD parity across Home tile / detail / master for every property (yield derives from the same engine annualRent). All producers byte-parity. The VR-004 residual (Home tile 0.9% for HOME) rode on the MON-035 home-tile figure, which the reproduction proves is parity-correct in current code -> the divergence was deploy-skew, not a rogue producer. Stays FIXING pending the Ring-3 re-check on the unified deploy (shared with MON-035). | [VR-005 STAGE-4 FAIL → RE-DIAGNOSED 2026-07-14] The Chrome re-check on the FULLY-MERGED deploy showed the Home dashboard tile STILL diverges (−$219/mo=−$2,628/yr, yield 0.9%) from detail/list/Risk-Radar (−$8,668/yr, 0.12%). So the #1401 "deploy-skew" conclusion was WRONG — this was a real live bug, and the Ring-2 reproduction gave a FALSE PASS because its DB mock (createGoldenDbFrom) IGNORES WHERE clauses, so it could never catch a fetch/assembly difference. REAL ROOT CAUSE (§12.2.1 duplicate producer): the portfolio/snapshot route had its OWN inline per-property transaction fetch (unifiedTransaction.findMany) + propertyTx filter feeding computePropertyCashflow — a DUPLICATE of enrichPropertiesWithActuals (which detail/list/Risk-Radar use). On live HOME data the inline path fell back to DECLARED rent (~$6,970/yr → 0.9%) while the enricher used 12-month ACTUALS (~$929/yr → 0.12%). FIX (remove-the-culprit §23.2.1): deleted the inline fetch+assembly; the route now calls enrichPropertiesWithActuals(userId, properties) and feeds computePropertyCashflow from property.income/expenses/loans + property.linkedTransactions — the SAME producer as the other 3 surfaces → Home tile == detail BY CONSTRUCTION. RATCHET (Ring-1 source-lock, the honest guard the value-parity test could not be): tests/golden/ring2.homePropertyParity.test.ts asserts the route uses enrichPropertiesWithActuals AND has NO inline unifiedTransaction.findMany. Also fixed the golden mock to populate property.findMany includes (the false-pass cause) + reduced the MON-035 window source-lock from 3 direct fetch sites to 2 (portfolio now delegates). Neomatrix: portfolioSnapshot.GET re-pinned 518→521 + formula updated to reflect the enricher delegation. Stays FIXING pending a NEW Chrome re-verify (VR-006). | [VR-006 VERIFIED 2026-07-14] Ring-3 re-check: HOME rental yield now reads 0.12% on detail AND list AND (via crossSurface) the Home tile — the fourth surface (CFO Risk Radar) was already fixed to 0.12% in VR-004. The Home-tile 0.9% residual is gone (it rode on the MON-035 duplicate-producer, now removed). yield.match === true for all properties. Promoted → VERIFIED alongside MON-035 (shared source-lock test + baseline).

### MON-037 — One-off expenses shown as recurring MONTHLY (+ apparent Battery duplicate) inflating expenses/cashflow

**🟠 FIXING** · 🔴 critical · changes numbers: **yes** · area: expenses · opened 2026-07-14

> **What was wrong:** Several one-off costs (a battery, a subdivision fee, a paint job) are being treated as if you pay them every month, which massively overstates your monthly expenses; there also looks to be a duplicate battery entry.
>
> **What changed:** One-offs (marked not-recurring) are excluded from your property's yearly cashflow and expense totals — they show as a real cost in the month they happened, not every month. In tax, a one-off deductible cost is now counted ONCE at its real amount instead of ×12.
>
> **What you should see:** On a property with a one-off cost (e.g. the battery), the Cashflow/yr and the property Expenses card no longer treat it as a monthly cost; and your tax deductions drop to the real figure (an $11,385 one-off counts as $11,385, not $136,620).

- **Root cause:** `lib/calculations/propertyCashflow.ts:172`, `lib/tax-engine/position/taxPositionCalculator.ts:195`, `lib/tax-engine/position/taxPositionCalculator.ts:688`
- **Neomatrix:** `number.propertyCashflow`, `engine.taxPositionCalculator.calculateTaxPosition`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`, `app/api/portfolio/snapshot/route.ts`, `components/properties/PropertyExpensesCard.tsx`, `lib/services/masterFinancialService.ts`, `app/api/tax/position/route.ts`, `lib/tax-engine/position/userTaxPosition.ts`, `lib/services/entityTaxFactsAssembler.ts`, `app/api/tax/entity/[entityId]/route.ts`
- **Fix PR(s):** ##1395, ##1427 (RC-B: near-duplicate dedup)
- **Holistic test (§19.4):** `tests/calculations/mon037OneOffEngines.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: HOME / Thornland Lot 1 / Guildford expense lists. Expected: one-off items not recurring per-month; no duplicate battery. Actual: Battery/Battery System/Battery Replacement on HOME incl ESTIMATE+ACTUAL both 136620/yr; CJM and Bankwest subdivision fees on Thornland Lot 1; Painting Home on Guildford all tagged MONTHLY. Evidence/run: VR-002. | [FIX 2026-07-14] RC-A resolved: added an isRecurring gate to the two engines the general MON-023 fix never reached — propertyCashflow.ts:172 excludes one-offs from the run-rate; taxPositionCalculator.ts:195/688 count a one-off once (not ×frequency). Threaded isRecurring through ALL 9 producers/callers (§19.4) + entity Prisma selects. aggregateExpenses deliberately NOT gated (master relies on it for its separate all/recurring/nonRecurring computation — gating would zero nonRecurring). Ratchet Ring-0 + source-lock: tests/calculations/mon037OneOffEngines.test.ts. Neomatrix anchors re-pinned (masterFinancialService 1822→1823, taxPositionCalculator 92→101, propertyCashflow 130→137). RC-B (reconcile duplicate) + RC-C (frequency detection) scoped as follow-ups. Advances to FIXING with the PR number. | [VR-004 2026-07-14] Ring-3 PARTIAL: tax deductions dropped $367,440->$39,554 (the ×12 inflation is GONE from the tax number) AND the property Cashflow/yr totals recalculated. BUT a UI regression: the Expenses CARD still LISTS raw one-off rows (labelled MONTHLY) while the card TOTAL now excludes them -> '$0 total over non-zero rows' (Thornland/Guildford) and HOME total != sum of rows. The card renders raw property.expenses, not cf.expenseLines. FIX: render cf.expenseLines (recurring only) + surface one-offs distinctly (not a MONTHLY recurring row). Duplicate Battery persists = RC-B (reconcile dedup follow-up, scoped out of RC-A). Stays FIXING; add a Ring-2 card-reconciliation test. | [CARD FIX 2026-07-14] Addressed the VR-004 UI regression: PropertyExpensesCard now renders ONLY recurring rows (expenses.filter(isRecurring !== false).map) so Σ rows === the shown total (was rendering raw one-off rows under a total that excluded them → '$0 total over non-zero rows'). One-offs surfaced as a footnote ('+ N one-off costs, shown in Spending'). Ratchet: reconciliation invariant added to tests/dashboard/propertyExpensesCard.test.ts. STILL FIXING: (a) RC-B duplicate Battery (reconcile dedup, separate follow-up), (b) awaiting Chrome re-verify.

[RC-B SHIPPED, 2026-07-15 — awaiting Matrix Ring-3] Root cause verified: both intake dedup guards matched only on (normalised) name EQUALITY (link route sameMerchant) / exact-string+exact-amount (doc-import reconcileSuggestedAction findFirst) — so ONE battery cost minted three name-variant rows (Battery / Battery System / Battery Replacement). Fix: ONE canonical near-duplicate decision isNearDuplicateEntry (lib/utils/reconciliation.ts — sameMerchant OR relatedMerchant token-containment across name/vendorName pairs, AND amount within 10% of the larger), consumed by BOTH intake paths: transactions/[id]/link (fallback after exact match) + reconcileSuggestedAction EXPENSE branch (scope-fetch findMany + predicate; INCOME/LOAN branches unchanged). Plus doc-import expense create now passes isRecurring (MON-053 expense-side parity — a one-off invoice expressible as one-off). EXISTING duplicate rows = user-reviewed remediation (abandoned-backfill precedent) — Ring-3 directs Reza to merge/delete the battery siblings; intake can no longer re-create them. Ratchet: tests/utils/mon037RcbNearDuplicate.test.ts (Ring-0 battery fixtures + false-merge guards + Ring-1 source-lock both-paths-use-the-ONE-decision); reconcileSuggestedAction.test.ts updated (+2 RC-B cases). Neomatrix: detectFrequency anchor re-pinned 90→91; no money-number lineage changed. Ring-3 spec: (a) link a battery-like transaction / import a battery-like doc → reuses the existing row, no new sibling; (b) after Reza merges/deletes the existing duplicates, HOME expense totals count the battery ONCE; (c) regression guard: unrelated expenses (Painting Home, insurances) unaffected.

### MON-038 — CFO offers a refinance on a 104pct LVR loan (should be gated over 100pct)

**🟢 VERIFIED** · 🟠 high · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** My Guide suggests refinancing a loan whose balance is more than the property is worth (104pct), which no lender would do.
>
> **What changed:** My Guide's rate-alert used to say 'Consider refinancing' on a loan you can't refinance (104% LVR). It now shares the SAME LVR gate as the refinance-opportunity list, so above ~95% LVR it steers you to pay down the loan first instead of suggesting a refinance no lender would do.
>
> **What you should see:** On the Thornland Lot 1 loan (104% LVR), the My Guide loan alert no longer offers a refinance — it says to focus extra repayments to reduce LVR first. Loans below 95% LVR still get the refinance suggestion.

- **Root cause:** `lib/cfo/decisionSupport/loanDecisionSupport.ts:273`
- **Downstream consumers (§19.4):** `lib/cfo/decisionSupport/loanDecisionSupport.ts`, `app/dashboard/cfo/page.tsx`, `lib/cfo/intelligenceEngine.ts`
- **Fix PR(s):** ##1399
- **Holistic test (§19.4):** `tests/cfo/loanDecisionSupportGuards.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: CFO Loan Opportunities. Expected: no refinance offer on a loan over 100pct LVR. Actual: High LVR 104pct Bankwest 9471/yr refinance offered on Thornland Lot 1. Evidence/run: VR-002. | [FIX 2026-07-14] Root cause = a §12.2.1 duplicate-producer miss: MON-019 gated calculateRefinanceOpportunities but NOT generateRateAlerts' rate_above_market branch (loanDecisionSupport.ts), which still set action='Consider refinancing' with no LVR gate. Fix: extracted ONE isRefinanceableLvr(loan, properties) helper for the >MAX_REFINANCE_LVR rule, called by BOTH producers; over the ceiling the alert reframes to 'reduce your LVR first'. changesNumbers=false — the alert's impact $ is unchanged; only the advice text is gated (the opportunity was already suppressed by MON-019). Ratchet: cross-producer invariant in tests/cfo/loanDecisionSupportGuards.test.ts (no refinance advice >LVR ceiling from ANY producer + a healthy-LVR control). Neomatrix 3 loanDecisionSupport anchors re-pinned. Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 MOSTLY-PASS: the 104% Bankwest line shows 'High LVR: 104%' with NO 'Consider refinancing' text (the action gate works). BUT it sits under a 'Refinance Savings — $5,141/yr — 3 opportunities' card header, and the drill-down /dashboard/debt returns 404 so the per-loan action couldn't be fully confirmed. TODO: confirm the '3 opportunities' count EXCLUDES the 104% loan (worthRefinancing=false) + fix the /dashboard/debt 404 dead link. Stays FIXING. | [2026-07-14] VR-004 count concern RESOLVED in code: the tile’s "N opportunity found" count = refinanceOpportunities.filter(worthRefinancing).length, and the 104% loan is gated to worthRefinancing:false — so it is EXCLUDED from the count (locked by tests/cfo/loanDecisionSupportGuards.test.ts). The 404 that blocked the drill-down confirmation is fixed by MON-044. Remaining: a live Chrome click-through of the real loan action text (VR-005). [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-039 — Minor display: Medicare levy not shown; /cashflow Money In 0 vs 1-source note; Guildford list tile omits cashflow/yr

**🟢 VERIFIED** · 🟢 low · changes numbers: **no** · area: display · opened 2026-07-14

> **What was wrong:** Three small display issues: (a) the tax cards on My Guide and Cashflow didn't itemise the Medicare levy (only the Tax page did), (b) the Cashflow page said '1 income source fed this month' next to Money In $0 — implying income arrived when none did, and (c) the Guildford property tile in the list was missing its Cashflow/yr line even though its own detail page and the Home tile show it.
>
> **What changed:** (a) Both tax cards now show an 'incl. $X Medicare levy' line, read from the same canonical tax position — it's shown as included, not an extra charge. (b) The Cashflow copy now reads 'N income source(s) · none received this month' when Money In is $0, so it no longer claims money arrived. (c) The property list tile now shows Cashflow/yr for any income-producing property (rent present), matching the detail and Home surfaces — via one shared visibility rule. No number changed.
>
> **What you should see:** On My Guide → Tax Position and Cashflow → Tax card, you'll see the Medicare levy itemised. On Cashflow, a $0 Money In now reads 'none received this month'. On My Wealth → Properties, the Guildford tile now shows its Cashflow/yr like its detail page does.

- **Root cause:** `app/dashboard/cfo/page.tsx:887`, `app/(dashboard)/cashflow/components/intelligence/glass/GlassMoneyFlowTile.tsx:157`, `components/properties/PropertyTile.tsx:401`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `app/(dashboard)/cashflow/page.tsx`, `app/(dashboard)/cashflow/components/intelligence/glass/GlassTaxTile.tsx`, `app/(dashboard)/cashflow/components/intelligence/glass/GlassMoneyFlowTile.tsx`, `components/properties/PropertyTile.tsx`
- **Fix PR(s):** ##1412
- **Holistic test (§19.4):** `tests/properties/propertyCashflowVisibility.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes display. Surface: tax cards / cashflow page / Properties list tile. Expected: Medicare shown; consistent Money In labelling; list tile shows cashflow/yr. Actual: Medicare absent on both tax cards; Money In 0 but text says 1 income source fed; Guildford list tile has no cashflow/yr line. Evidence/run: VR-002. | [VR-006 CONFIRMED 2026-07-14] All three parts reproduced live: (039a) /cashflow 'TAX·FY ESTIMATE $194,218 / 40.0%' AND CFO 'Tax Position -$194,218' both show NO Medicare line; Medicare $9,706 is itemised only on /dashboard/tax — both cards read the canonical getUserTaxPosition where taxPosition.tax.medicareLevy exists, so adding a line is SSOT-clean. (039b) /cashflow 'MONEY IN $0' beside '1 income source fed this month' — the copy claims income 'fed this month' while actuals=$0; the label must not assert receipt when $0 landed (moneyIn=0, declaredSourceCount=1, page does not distinguish actuals-vs-declared). (039c) Guildford (PRIMARY RESIDENCE that collects $26,089 rent + has a loan) — detail -$7,387 & Home -$7,392 SHOW cashflow/yr but the LIST tile OMITS the line entirely: a cross-surface render inconsistency (the number exists; one surface drops it). All changesNumbers=false (labels/render only). To fix in the MON-039 PR (Stage-1 root-cause of each surface first). | [FIX 2026-07-14] (039a Medicare) threaded taxPosition.tax.medicareLevy — the CANONICAL source both cards already read (getUserTaxPosition, MON-020) — to the render sites: cashflow path = buildTaxOptimization (intelligence/route.ts) adds medicareLevy → TaxOptimization type (cashflow-intelligence/types.ts + the cashflow page's local type) → GlassTaxTile renders 'incl. $X Medicare levy' under the hero (shown as INCLUDED, not additive — adviser lens); CFO path = keyTaxMetrics.medicareLevy added in taxIntegration.ts (+ its local CFOTaxInsights type + cfo/types.ts + the cfo page's local type) → cfo/page.tsx renders a muted Medicare line (a cost, not the emerald benefit style). (039b) GlassMoneyFlowTile.tsx:157 now gates the copy on netIncome>0 — '$0 in' reads 'N income source(s) · none received this month' instead of 'fed this month'. (039c) extracted the ONE cashflow-visibility rule to lib/properties/propertyCashflowVisibility.ts (shouldShowPropertyCashflow: true for INVESTMENT or incomeCount>0) — PropertyTile now shows the Cashflow/yr cell for income-producing HOME/RENTAL too (yield stays investment-only, matching detail/Home). RATCHET: Ring-0 tests/properties/propertyCashflowVisibility.test.ts (the cross-surface-omission class — the most automatable); 039a/b (label presence) are covered by the standing Chrome-brief §3.3 'LABELS, not just numbers' + Part-A cross-surface checks. Neomatrix: 2 taxIntegration anchors re-pinned (calculateUnrealisedCGT 180→182, calculateNegativeGearingBenefit 197→199, shifted by the medicareLevy lines) + new visibility helper allowlisted. Gate: tsc + vitest + neomatrix:check + lint:financial-surfaces (27500 super-cap baseline re-lined 447→448) + issues:check all green. changesNumbers=false. Advances to FIXING with PR#; awaits Reza Ring-3. [VR-007 2026-07-15] VERIFIED on live data (run VR-007, #1412 merged). 039a Medicare now itemised on both tax cards; 039b $0 Money In reads "1 income source · none received this month" (honest copy confirmed live); 039c Guildford list tile now renders Cashflow/yr −$7,387 — this is the ONE partF delta vs the VR-006 baseline (Guildford.cashflowYrList null → −7387), i.e. the fix landing, not a regression.

### MON-040 — Tax optimisation recommendations show implausible values (save 3685pct, 6.27M potential savings)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **yes** · area: tax · opened 2026-07-14

> **What was wrong:** The Tax page's savings suggestions show impossible numbers (e.g. 'save 3685%' and millions in savings), which look broken.
>
> **What changed:** The savings calculator was reading your marginal tax rate as a fraction when it's stored as a percent (37, not 0.37) — so every rate-based figure was inflated ~100×. Fixed to use the rate correctly (kept the percent convention the rest of the tax page depends on).
>
> **What you should see:** On the Tax page, the salary-sacrifice suggestion now shows a sane figure — e.g. 'save 22%' and a few thousand dollars — instead of 'save 3685%' and $1.1M / $6.27M.

- **Root cause:** `lib/tax-engine/position/taxPositionCalculator.ts:360`
- **Neomatrix:** `engine.taxPositionCalculator.calculateTaxPosition`
- **Downstream consumers (§19.4):** `app/api/tax/position/route.ts`, `app/dashboard/tax/page.tsx`
- **Fix PR(s):** ##1398
- **Holistic test (§19.4):** `tests/tax/mon040TaxRecommendations.test.ts`
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: app/dashboard/tax (recommendations panel). Expected: realistic savings figures and percentages. Actual: 'save 3685%', potential savings 1,105,500 and 6,274,704 rendered as real recommendations. Evidence/run: VR-003. | [FIX 2026-07-14] Verified end-to-end: incomeTaxCalculator.ts:118 returns marginalRate*100 (a PERCENT) -> TaxCalculation.marginalRate=37 -> generateRecommendations misread it as a decimal at :356/361/366/376. Fix: local mr = marginalRate/100 for rate math; guard >=32 (percent); '% saved' = marginalRate-15. Did NOT touch incomeTaxCalculator or the marginalRate type (tax page depends on percent). Worked examples reproduce the reported numbers exactly (37-0.15)*100=3685, 30000*36.85=1,105,500. Ratchet Ring-0: tests/tax/mon040TaxRecommendations.test.ts (22% not 3685; savings<20k; class invariant savings<=netTax). Blast radius = tax recommendations panel only (does NOT feed netTax/CFO). Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 PASS on live data: tax recommendations show 'save 30%' (Reza's 45% bracket −15%) + $9,000 — the 3685%/$1.1M/$6.27M values are GONE. Guard: tax summary cards render sane. Advanced to VERIFIED.

### MON-041 — Vehicle depreciation percentage shown outside 0-100 (appreciation rendered as negative depreciation)

**🟢 VERIFIED** · 🟢 low · changes numbers: **no** · area: assets · opened 2026-07-14

> **What was wrong:** On an asset that has gone UP in value (e.g. a classic car), the Assets detail showed a negative depreciation like "-200.0%" — treating appreciation as negative depreciation.
>
> **What changed:** Asset value-change is now shown as a positive magnitude with a clear direction — an appreciating asset reads "Appreciation 200.0%" (green, up-arrow), a depreciating one reads "Depreciation" — using ONE shared presentation rule across the list tile and the detail dialog.
>
> **What you should see:** Open an asset that’s worth more than you paid (e.g. the 300Z / Landcruiser): the detail now says Appreciation with a positive % and a green up-arrow, not "-200.0% depreciation".

- **Root cause:** `app/dashboard/assets/page.tsx:636`, `app/dashboard/assets/page.tsx:1276`, `app/api/assets/route.ts:58`
- **Downstream consumers (§19.4):** `app/dashboard/assets/page.tsx`, `components/assets/AssetTile.tsx`
- **Fix PR(s):** ##1403
- **Holistic test (§19.4):** `tests/assets/valueChange.test.ts`
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: app/dashboard/assets (vehicle dialogs). Expected: a percentage in a sane range with the right label (appreciation vs depreciation). Actual: 300Z shows depreciation -200.0pct and Landcruiser -66.7pct — an appreciating asset is labelled as negative depreciation. Evidence/run: VR-003. | [FIX 2026-07-14] Root cause: depreciation = purchasePrice − currentValue (positive=lost, negative=gained) and depreciationPercent same sign (app/api/assets/route.ts:58). AssetTile abs’d it + labelled Appreciated/Depreciated, but the Assets PAGE dialogs (page.tsx:636 inline %, :1276 KpiTile) printed the RAW signed percent + a hardcoded "Depreciation" label → an appreciating asset read "-200.0%". Fix (§12.2.1): extracted lib/assets/valueChange.ts (assetValueDirection + assetValueChangeMagnitudePercent) as the ONE presentation rule; wired both page sites (label by direction, % as magnitude) + repointed AssetTile’s lostValue/percent to it. Ratchet: tests/assets/valueChange.test.ts. Neomatrix: pure presentation helper, allowlisted (no money formula; graphify offline, self-prunes). changesNumbers=false (the signed value is unchanged; only the display sign/label). | [VR-006 VERIFIED 2026-07-14] Ring-3 confirmed live: 300Z (+200.0%) & Landcruiser (+66.7%) both read APPRECIATED with a green up-arrow — NOT '-200.0% depreciation'; VW Golf reads DEPRECIATED (-4.3%). edgeCases + assets sweep clean. fixPR #1403. Promoted → VERIFIED.

### MON-042 — Household vehicle count (4) disagrees with the Assets list (5 vehicles)

**🟢 VERIFIED** · 🟢 low · changes numbers: **no** · area: household · opened 2026-07-14

> **What was wrong:** Your household summary said '4 vehicles' while the Assets page lists 5 — which read like an inconsistency, even though they measure different things.
>
> **What changed:** The household field is relabelled 'Household Vehicles' with copy that makes clear it's a declared expense-estimate input (how many vehicles you run day-to-day, for rego/fuel/insurance estimates) and is separate from the vehicles in My Wealth → Assets (which can include plant like an excavator). No number changed.
>
> **What you should see:** On Settings → Household, the Vehicles card now explains it's for running-cost estimates and is separate from your Assets list — so '4' here vs '5' in Assets reads as two different things, not a bug.

- **Root cause:** `app/dashboard/household-profile/page.tsx:622`
- **Downstream consumers (§19.4):** `app/dashboard/household-profile/page.tsx`
- **Fix PR(s):** ##1411
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: app/dashboard household profile vs assets list. Expected: same vehicle count on both. Actual: Household profile says 4 vehicles; Assets lists 5 (Excavator, 300Z, Ford Ranger, VW Golf, Landcruiser). Evidence/run: VR-003. | [VR-006 DISPOSITION 2026-07-14] Confirmed: vehicleCountHousehold=4, vehicleCountAssets=5. These are NOT the same metric — the Household 'Vehicles' value is a DECLARED onboarding dropdown (0–5, 'How many vehicles does your household have?', app/dashboard/household-profile/page.tsx:617, HouseholdProfile.carsCount) used for EXPENSE CALIBRATION; the Assets value is the actual ledger (5 VEHICLE-typed assets, the 5th being a Hitachi Excavator = plant, not a car). So '4 cars declared' vs '5 vehicle assets incl. an excavator' is a legitimate scope difference, not a count bug — NOT a §12.2.1 duplicate (different purposes). This is a PREFERENCE FORK for Reza: (A) relabel the household field so it doesn't read as competing with the asset ledger; (B) derive the count from actual vehicle assets (then decide whether the excavator counts as a household vehicle); or (C) leave (two independent numbers). Surfaced to Reza, not guessed (§20.5). changesNumbers=false. | [DECISION + FIX 2026-07-14] Reza chose Option A (relabel). Fix: household-profile/page.tsx Vehicles card retitled 'Household Vehicles' + description clarifies it's a declared expense-calibration input (running costs) SEPARATE from My Wealth → Assets. Pure copy change, no source/number change (carsCount stays a declared field; the Assets ledger stays the actual count). No Ratchet test (label-only; no automatable numeric class — the class 'a correct number can carry a confusing label' is already a standing Chrome-brief check per §3.3). Neomatrix: no financial node touched. Advances to FIXING with PR#. [VR-007 2026-07-15] VERIFIED on live data (run VR-007, #1411 merged). Household Vehicles relabelled as the declared expense-estimate input, distinct from the Assets ledger. partF still reads vehicleCountHousehold 4 / vehicleCountAssets 5 — correct and expected: the relabel explains the gap rather than changing either count (changesNumbers=false).

### MON-043 — Annual income differs across Home / Activity / Tax surfaces (basis inconsistency to reconcile)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: income · opened 2026-07-14

> **What was wrong:** Your annual income showed three different figures with nothing to explain why: Home ~$239K, and Tax $524,831. The gap is 'Other' income you declared but that has no matching bank transactions.
>
> **What changed:** Home/Cashflow keep showing your last-12-months ACTUALS (correct, §19.1) and the Tax page now labels its figure as 'Declared gross income'. The Income page adds an honest nudge: it tells you how much of your declared income ($ and source count) has no matching transactions yet, so you can link statements — that's exactly the gap between the actuals and the declared/tax total.
>
> **What you should see:** On the Tax page the Income Summary now says 'Declared gross income …'. On the Income page, if some declared income has no transactions, a sky info banner shows the unmatched amount (e.g. ~$192,698) and invites you to link statements. Home/Cashflow are unchanged.

- **Root cause:** `app/dashboard/tax/page.tsx:561`, `app/dashboard/income/page.tsx:614`
- **Downstream consumers (§19.4):** `app/dashboard/tax/page.tsx`, `app/dashboard/income/page.tsx`
- **Fix PR(s):** ##1413
- **Holistic test (§19.4):** `tests/income/unmatchedDeclaredIncome.test.ts`
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: Home tile vs Activity YTD vs Tax total income. Expected: either one consistent figure or clearly-labelled distinct bases. Actual: Home 239K/yr, Activity YTD 484K/yr, Tax total income 524,831 — three different income figures with no visible basis label. Evidence/run: VR-003. | [VR-006 DISPOSITION 2026-07-14] The brief's income-basis capture resolved this from ground truth: Home $239,000 labelled 'Last 12 months' (trailing-12-mo ACTUALS); Tax $524,831 'declared gross, 21 sources'. The gap is 'Other' income $192,698 (9 sources) + part of Rental — and the income list shows these rows as Actual $0 / -100% variance, i.e. DECLARED-ONLY with NO matching transactions (ATO $9,098, ATO $952, Ingeus salary lines, Service NSW). So the numbers are each CORRECT for their basis: Home (actuals, §19.1) rightly EXCLUDES declared income with no transactions; Tax (assessable/declared) rightly INCLUDES it. This is therefore NOT a calc bug — it is (a) a LABELLING refinement (surface the basis so a user understands why Home < Tax), and (b) a deeper DATA-COMPLETENESS signal worth surfacing to the user honestly ('$192,698 of declared income has no matching transactions — link statements or it will not count toward actuals'). changesNumbers should be re-set to false (no number is wrong). PREFERENCE FORK for Reza: how prominent to make the basis label + whether to add the data-completeness nudge. Surfaced, not guessed (§20.5). NB: 'Activity YTD 484K' from VR-003 was not re-confirmed in VR-006 (Activity showed this-month only); treat the Home-vs-Tax basis as the canonical reconciliation. | [FIX 2026-07-14] Reza chose 'Label + data nudge'. (labels) Home 'Annual income' tile already carries the 'Last 12 months' actuals basis (VR-006) — left as-is; the Tax Income-Summary CardDescription now reads 'Declared gross income — all sources (drives your tax estimate; may exceed the last-12-months actuals on Home/Cashflow)'. (nudge) app/dashboard/income/page.tsx renders a sky/info banner when declared income has no matching transactions, showing the unmatched $ + source count + a 'link statements' prompt. The unmatched figure is ONE aggregation (§12.2.1) lib/income/unmatchedDeclaredIncome.ts (sum GROSS annual via canonical toAnnual of rows with transactionCount 0) — a presentation aggregation feeding no downstream engine (allowlisted). §19.2 worked example: a $16,058/mo declared row with 0 tx → $192,696/yr ≈ VR-006's $192,698. RATCHET Ring-0: tests/income/unmatchedDeclaredIncome.test.ts (4 cases incl. the worked example + exclusion of matched rows). changesNumbers reset false — no EXISTING number altered; Home actuals + Tax declared are each CORRECT for their basis (§19.1), the fix is labelling + a new nudge figure. lint baseline re-lined (income/page frankingCredits 1985→2014, tax/page 793/796→798/801 shifted by the added lines). Gate: tsc + vitest + neomatrix:check + lint:financial-surfaces + issues:check green. Advances to FIXING with PR#; awaits Reza Ring-3. [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-044 — Loan Opportunities card links to /dashboard/debt which 404s

**🟢 VERIFIED** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** The 'Loan Opportunities' card on My Guide links to a page that shows a 404 error.
>
> **What changed:** The card now links to /dashboard/debt-planner (the real Debt Freedom route every other link uses) instead of the non-existent /dashboard/debt.
>
> **What you should see:** On My Guide, click through the Loan Opportunities card — it now opens the Debt Freedom page instead of a 404.

- **Root cause:** `app/dashboard/cfo/page.tsx:921`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`
- **Fix PR(s):** ##1402
- **Holistic test (§19.4):** `tests/dashboard/cfoTileLinks.test.ts`
- **Detail:** `neoaudit-run:VR-004`

Found VR-004 (Reza Claude-Chrome 2026-07-14). The CFO 'Loan Opportunities' card drill-down navigates to /dashboard/debt which returns 404 (dead link — route missing or renamed). Read-only, no data change. Blocks full confirmation of MON-038's per-loan action text. | [FIX 2026-07-14] Root cause: a single typo’d href — cfo/page.tsx:921 pointed at /dashboard/debt (non-existent); the canonical route is /dashboard/debt-planner (used by every other link). One-line repoint. Ratchet: tests/dashboard/cfoTileLinks.test.ts asserts every /dashboard/<seg> href in cfo/page.tsx resolves to a real route + the dead /dashboard/debt path is absent. The Ratchet ALSO surfaced a second dead-end — see MON-046. [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-045 — CFO neg-gearing benefit ($157,746) ~4x total deductions ($39,554) — internally inconsistent

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: tax · opened 2026-07-14

> **What was wrong:** On My Guide, the negative-gearing tax benefit ($157,746) was shown as roughly 4× your total deductions ($39,554) — which is impossible (a tax saving can’t exceed the deductions that create it). Four different parts of the app each invented their own negative-gearing number, while the real tax engine never counted your investment loan interest as a deduction at all.
>
> **What changed:** Your investment-property loan interest is now an automatic tax deduction computed in ONE place — from the actual interest your bank charged this financial year when statements are loaded, otherwise (loan balance − offset) × rate. Your home loan (primary residence) is correctly excluded. The four duplicate calculators were deleted; the CFO benefit is now (property deductions − rental income) × your marginal rate, taken from the one tax position.
>
> **What you should see:** On the Tax page: total deductions now INCLUDE your investment loan interest (deductions rise realistically; taxable income and estimated tax fall accordingly). On My Guide: the Neg. Gearing Benefit tile shows a small consistent figure that is ALWAYS less than your total deductions — and the same numbers appear on both pages.

- **Root cause:** `lib/cfo/decisionSupport/taxIntegration.ts:197`, `lib/cfo/decisionSupport/taxIntegration.ts:213`, `lib/tax-engine/position/taxPositionCalculator.ts:206`
- **Neomatrix:** `engine.tax.deductiblePropertyLoanInterest`, `engine.taxPositionCalculator.calculateTaxPosition`
- **Downstream consumers (§19.4):** `app/api/tax/position/route.ts → Tax page (deductions.property, taxable income, est. tax) — threads propertyLoans, verified`, `lib/tax-engine/position/userTaxPosition.ts → calculateCFOTaxInsights → My Guide keyTaxMetrics.negativeGearingBenefit + deductionsSummary (app/dashboard/cfo/page.tsx:888) — now derived from the position, verified`, `userTaxPosition → /api/cashflow/intelligence (/cashflow tax number, MON-020 shared source) — inherits automatically, verified`, `tax recommendations engine (MON-040) — reads the same canonical position, inherits`, `lib/intelligence/portfolioEngine.ts gearing/propertyAnalysis — field DELETED; only consumers were /api/debug/intelligence + strategy dataCollector rows that never read it (grep-verified)`, `app/api/calculate/property-roi — DELETED (orphaned, zero callers repo-wide)`, `calc-audit decimal-cfo-decision-support — deleted producer's shadow removed; canonical applyNegativeGearing shadow untouched`
- **Fix PR(s):** ##1415 (stage 1: canonical helper), ##1425 (stage 2: wiring + producer deletions)
- **Holistic test (§19.4):** `tests/tax/mon045PropertyLoanInterest.test.ts`
- **Detail:** `neoaudit-run:VR-004 · ring3:VR-009`

Found VR-004 (Reza Claude-Chrome 2026-07-14). CFO Total Deductions shows Property $39,444 with 'Neg. Gearing Benefit: $157,746' — the benefit is ~4x the total deductions, internally inconsistent. Needs §19.2 audit of the neg-gearing-benefit producer vs the canonical deductions. NOT one of the original 5; surfaced by the deduction recalculation. | [DIAGNOSED 2026-07-14 — §19.2] Root cause: calculateNegativeGearingBenefit (taxIntegration.ts:197) is a SECOND producer of per-property net rental income that AUTO-computes loan interest (Σ principal×interestRateAnnual, :213) and subtracts ALL expense rows ×frequency. The canonical tax position (taxPositionCalculator.ts) does NOT auto-compute loan interest — it deducts interest ONLY when the user logs a deductible LOAN_INTEREST/property expense row (:200/:206). So the two disagree: with a loan but no logged-interest expense, the tax position omits interest while the CFO benefit includes it → the benefit can exceed total deductions (the 4× incoherence). Proof it is a bug regardless: a negative-gearing tax BENEFIT = loss×marginalRate ≤ loss ≤ property deductions < total deductions, so 4× is mathematically impossible. FORK (Reza decision, §20.5 — NOT guessed): should property loan interest be AUTO-derived from the loan (principal×rate, the financially-correct AU model — interest is the primary neg-gearing deduction), or only counted when logged as an expense row? Monitrax has BOTH mechanisms today (loans carry a rate; expenses can be LOAN_INTEREST), which is the ambiguity. Option A (financially correct, bigger): make the canonical tax engine auto-deduct property loan interest via computePropertyCashflow.annualLoanInterest (reform-aware §12.14 Measure 1 gating) so deductions AND neg-gearing are correct AND consistent everywhere — own workstream. Option B (quick consistency patch): derive the CFO benefit from the canonical taxPosition (deductions.property − income.rental)×marginalRate, removing the rogue producer — stops the incoherent 4× number but UNDER-counts neg-gearing if interest is not logged. Recommendation: A (or B-now-then-A staged). BLOCKED pending Reza’s call — do not guess-fix. | [DECISION 2026-07-14 — Reza chose Option 1: AUTO-DERIVE INTEREST (the proper fix)]. Scope as its own reform-aware workstream: make the canonical tax engine deduct property loan interest derived from the loan (via computePropertyCashflow.annualLoanInterest — the ONE source), DE-DUPED against any user-logged LOAN_INTEREST/property expense row (so interest is never double-counted), reform-gated per §12.14 Measure 1 (negative gearing → new builds only for post-cutover acquisitions). Then derive the CFO negativeGearingBenefit from that same canonical figure and DELETE the rogue calculateNegativeGearingBenefit + its Decimal sibling (§12.2.1). This is changesNumbers=true across every tax surface (taxable income, refund, deductions, neg-gearing) → full §19.2 worked example + §19.4 downstream sweep + Neomatrix model of the new interest-deduction lineage + Ring-3 re-check before VERIFIED. Not started (design stage); tackled after the current dead-link PR + the fork-free display batch, or per Reza priority. | [VR-006 RE-CONFIRMED HIGH 2026-07-14] Reproduced live on the CFO Tax Position card: Total Deductions $39,554 (Property $39,444) but 'Neg. Gearing Benefit: $157,746' — the benefit is ~4× the total deductions on the same card, mathematically impossible (benefit = loss×marginalRate ≤ property deductions < total deductions). Chrome flagged this at severity HIGH (VR-006 finding). Elevating this issue's severity medium→HIGH accordingly. Option-1 build (Reza-approved) is ready to start on his go — it is a changesNumbers=true financial build requiring the full §19.2/§19.4/Neomatrix/Ring-3 pipeline + recorded 10/10 (§20.4). | [PRODUCER CENSUS 2026-07-14 — §24.2 Stage 1, scope materially larger than a single delete] Reza chose 'Go now' (Option 1). But the Producer Census found FOUR independent negative-gearing-benefit producers (a §12.2.1 multi-source defect, not one rogue function): (P1) lib/cfo/decisionSupport/taxIntegration.ts:197 calculateNegativeGearingBenefit — the CFO-card producer ($157,746; declared income/expenses + AUTO Σprincipal×rate interest); (P2) taxIntegration.ts:505 calculateNegativeGearingBenefitDecimal — its Decimal sibling (calc-audit shadow lib/calc-audit/engines/decimal-cfo-decision-support.ts); (P3) lib/intelligence/portfolioEngine.ts:494 + :805 negativeGearingBenefit=Math.max(0,-annualProfit) — a SECOND live producer on a different basis; (P4) app/api/calculate/property-roi/route.ts:99 — a THIRD, in the ROI calculator. INPUT-FEED CENSUS: the canonical taxPositionCalculator.ts (deductionBreakdown, :199-217) builds deductions.property ONLY from LOGGED deductible expense rows + depreciation — it NEVER auto-derives loan interest; the ONE canonical interest figure is computePropertyCashflow.annualLoanInterest (lib/calculations/propertyCashflow.ts:190, =Σ principal×interestRateAnnual). So the rogue producers deduct interest the canonical deductions omit → benefit ($157,746) > total deductions ($39,554). CONSUMER CENSUS (downstream, §19.4): CFO Tax Position tile (app/dashboard/cfo/page.tsx:887) + keyTaxMetrics; taxableIncome→tax→medicare→offsets→estimatedRefund on EVERY tax surface (/dashboard/tax, /cashflow tax card, CFO) once interest enters deductions; property-roi API; portfolioEngine insights. WORKED EXAMPLE (Reza's data, 45% marginal): investment loans Thornland Lot1 $947,076×6.49%=$61,465 + Broadbeach $228,000×6.69%=$15,253 + Thornland Lot2 $482,000×6.69%=$32,246 ≈ $108,964 auto interest; the rogue's ~$350k loss basis ×45% = $157,746 ✓ reproduces the bug. Under Option 1 the canonical deductions.property RISES by ~$108,964 (de-duped vs any logged LOAN_INTEREST rows), so taxableIncome + estimatedAnnualTax DROP materially from $194,218, and the derived neg-gearing benefit becomes ≤ property deductions ≤ total deductions (coherent). SCOPE/PLAN: (1) add auto-derived, de-duped, reform-gated (§12.14 Measure 1, default PRE_REFORM_GRANDFATHERED behind commencementVerified) property loan interest to the canonical taxPositionCalculator deductions from computePropertyCashflow.annualLoanInterest (ONE source); (2) derive the CFO benefit from the canonical position; (3) DELETE P1+P2 and repoint/retire P3+P4 to the canonical figure. This is a 4-producer SSOT consolidation across the core tax engine → it changes every tax number and CANNOT reach VERIFIED until Reza's NEXT Chrome run (Ring-3) regardless of how fast the code lands. HONEST §20.5 note: scope surfaced to Reza as materially larger than the single-function framing; building it carefully (not rushed) is the correct call for a core-tax-engine change — a wrong number here hits every surface. Stays DIAGNOSED with this Stage-1 banked; the FIXING PR implements the consolidation + §19.2 worked examples + §19.4 sweep + Ring-0/Ring-2 Ratchets + Neomatrix, then awaits Ring-3. | [COMPREHENSIVE END-TO-END ANALYSIS 2026-07-14 — Reza-requested pre-build; §20.6 10/10 review; CORRECTS the naive Option-1 framing] The deep read found the original 'use computePropertyCashflow.annualLoanInterest' plan would be WRONG (over-deduct). TWO correctness findings: (1) DEDUCTIBLE ≠ GROSS interest — the Loan model carries deductibleFraction (Phase 51, ATO TR 2000/2 mixed-purpose, default 1.0) AND offsetAccountId; tax-deductible interest = (principal − offsetBalance) × interestRateAnnual × deductibleFraction, NOT the gross principal×rate that computePropertyCashflow.annualLoanInterest (propertyCashflow.ts:194) and the rogue both use (gross is right for CASHFLOW, wrong for TAX). (2) An ACTUALS source already exists — app/api/loans/[id]/ledger/route.ts already treats INTEREST_CHARGED ledger rows as 'the deductible figure'; per §19.1 the canonical deductible interest must be ACTUALS-FIRST (Σ INTEREST_CHARGED this FY) → theoretical (principal−offset)×rate×deductibleFraction fallback. SSOT INJECTION POINT (verified): TWO assembly paths feed the ONE engine calculateTaxPosition — getUserTaxPosition (userTaxPosition.ts:135, CFO + /cashflow) AND app/api/tax/position/route.ts:181 (the Tax page assembles its OWN input). So the auto-interest MUST be injected INSIDE calculateTaxPosition (the engine), with BOTH callers passing property loans — injecting only in getUserTaxPosition would leave the Tax page diverged. REFORM STATE: taxYearConfig negativeGearingReformCommencementVerified=false → default grandfathered (interest deducts normally), but the code stays regime-aware via deriveNegativeGearingRegime (negativeGearingRegime.ts:147) for when it flips. DE-DUP (resolved, §12.2.1-correct — NOT a fork): loan-derived deductible interest is the ONE source; EXCLUDE logged expense rows tied to a loan (expenseItems carry loanId from the userTaxPosition fetch) so we never double-count; keep logged interest rows NOT tied to any loan (orphan). REFINED BUILD: new canonical deductiblePropertyLoanInterest(loan, fy) (actuals-first → (principal−offset)×rate×deductibleFraction, reform-gated) → calculateTaxPosition accepts property loans + adds their de-duped deductible interest to deductions.property → derive CFO benefit from canonical → DELETE P1+P2, repoint P3+P4. RATCHETS: Ring-0 fixtures on deductiblePropertyLoanInterest (offset/deductibleFraction/IO/actuals-vs-theoretical) + a 'benefit ≤ property deductions ≤ total deductions' invariant (fails the old $157,746 class); Ring-1 source-lock (one deductible-interest producer, no principal×rate neg-gearing in P1–P4); Ring-2 cross-surface parity (Tax page == /cashflow == CFO). §20.6 REVIEW: Document 10/10 (§12.14/§12.2.1/§19.1/MON-020 aligned; engine-level SSOT injection); Requirements 10/10 with the honest refinement that Reza's approved 'auto-derive' must be the DEDUCTIBLE (offset+deductibleFraction, actuals-first) figure not gross — a correctness refinement, not a scope change; Logic 10/10 (de-dup has a clean §12.2.1 answer → no blocking fork). Coverage boundary: analysis + Ring-0/1/2 prove the ENGINE math + parity; only Reza's Ring-3 confirms the LIVE number. HEADS-UP surfaced to Reza (informational, not a fork — de-dup handles both cases): this drops estimatedAnnualTax materially from $194,218 because his real deductible investment-loan interest was not being counted; the exact figure depends on his real offset balances + INTEREST_CHARGED ledger, computed from his data + Ring-3-verified. | [DESIGN REFINEMENT 2026-07-14 — reform-gating semantics, surfaced pre-build; a real §20.5 correctness question, NOT a rush] On re-examining the banked 'reform-gated deductiblePropertyLoanInterest helper' framing before building: the Phase-41E Measure-1 reform ('negative gearing → new builds only', 1 Jul 2027) does NOT change whether property loan interest is DEDUCTIBLE — interest is always a rental expense deductible against the property's OWN rental income. What the reform restricts is whether a resulting rental LOSS can be offset against OTHER (non-rental) income: for post-cutover acquisitions of non-new-builds the loss is QUARANTINED (carried forward), not deducted against salary etc. So the reform gate belongs in the LOSS-OFFSET step, NOT in the interest calc. Consequence for the build: (a) the deductiblePropertyLoanInterest helper is reform-INDEPENDENT — it computes actuals-first (Σ INTEREST_CHARGED) → (principal−offset)×rate×deductibleFraction, full stop; (b) the reform-aware loss quarantining is the job of the EXISTING but production-unwired engine.tax.negativeGearing.applyNegativeGearing (lib/tax-engine/divisions/negativeGearing.ts:152, regime via deriveNegativeGearingRegime) — the correct MON-045 build WIRES that engine for the loss-offset, rather than baking reform logic into the interest sum. This materially changes the deductions.property flow: interest reduces rental income → net property result → applyNegativeGearing decides offset-vs-quarantine → the amount that reduces OTHER taxable income. This is exactly the kind of subtle tax-law modelling that must be resolved with fresh focus (a wrong choice ships wrong tax numbers on every surface — §19/§20.4), which is why MON-045 is (correctly) held for a focused build rather than crammed. Open question for Reza if he wants to weigh in: confirm the build should wire applyNegativeGearing for loss-quarantining (recommended, financially-correct AU model) vs a simpler always-offset (grandfathered) treatment until the reform commences (commencementVerified=false today, so both behave identically NOW — but wiring applyNegativeGearing is future-correct). Either way the interest helper is reform-independent. | [STAGE 1 LANDED 2026-07-14] Built the canonical DEDUCTIBLE-interest calc lib/tax-engine/deductions/propertyLoanInterest.ts — actuals-first (Σ INTEREST_CHARGED) → (principal−offsetBalance)×interestRateAnnual×deductibleFraction, reform-INDEPENDENT (per the design refinement above). Ring-0 §19.2 proof tests/tax/propertyLoanInterest.test.ts (9 cases: theoretical, offset reduces the base, deductibleFraction scales both branches, actuals-win, offset≥principal→0, $0/0-rate→0, fraction clamp [0,1], negative-actual→theoretical). UNWIRED (no consumer yet) → cannot change any number; allowlisted for Layer-0 structural coverage with an honest 'financial calc, semantic model in stage 2' reason. Gate green: tsc + vitest(9) + neomatrix:check + lint:financial-surfaces + issues:check. STAYS DIAGNOSED — the user-visible bug ($157,746) is NOT fixed until STAGE 2 wires this into calculateTaxPosition.deductions.property (de-duped vs logged loanId expense rows; both getUserTaxPosition + /api/tax/position pass property loans incl. offset balances), wires applyNegativeGearing for the reform-aware loss quarantining, derives the CFO benefit from the canonical position, DELETES P1 calculateNegativeGearingBenefit + P2 Decimal sibling + repoints P3 portfolioEngine + P4 property-roi, runs the §19.4 sweep + Ring-1 source-lock + Ring-2 parity + the benefit≤propertyDeductions≤totalDeductions invariant, and models the semantic Neomatrix lineage. Stage 1 de-risks stage 2 by committing the verified interest formula. | [STAGE-2 BUILD SPEC FINALISED 2026-07-15 — last unknowns closed + the stage split, post-MON-053] The tax base stage 2 verifies against is now the HEALED one ($412,768 gross / $141,548 tax — not $524,831/$194,218). RESEARCH CLOSED (verified in source): (a) ACTUALS source = prisma.loanTransaction (schema:2853; kind enum INTEREST_CHARGED :82 'the tax-deductible figure') — sum via aggregate({where:{loanId, kind:'INTEREST_CHARGED', date in FY}, _sum:{amount}}), exactly as app/api/loans/[id]/ledger/route.ts:44 already does; (b) OFFSET BALANCE = Loan.offsetAccount → Account.currentBalance (schema Account model; loans must be fetched include:{offsetAccount:true}). STAGE SPLIT (recommendation, §20.5 — Reza may override): stage 2 = the STRUCTURE-PRESERVING injection — per-property-loan deductiblePropertyLoanInterest (stage-1 helper) added to deductionBreakdown.property on BOTH engine paths, de-duped (skip expense rows whose loanId is among the auto-derived property loans; keep loan-linked rows for NON-property loans), both callers pass loans+offset+actuals, CFO benefit derived from the canonical position as max(0, deductions.property − income.rental) × marginalRate/100 (coherent by construction: benefit ≤ loss ≤ deductions.property — the invariant that kills the $157,746 class), DELETE P1+P2 (incl. their calc-audit fixture/registry entries + shadow negativeGearingBenefitShadow in decimal-cfo-decision-support.ts — the census gate requires removing the registry row with the engine), repoint/retire P3 portfolioEngine + P4 property-roi per-site. STAGE 3 (separate, later) = wiring applyNegativeGearing for loss quarantining — DEFERRED because: the banked [DESIGN REFINEMENT] already established both behave IDENTICALLY today (negativeGearingReformCommencementVerified=false → grandfathered always-offset), FW-2 forbids post-reform math before commencement is verified anyway, and the full wiring restructures the calculator's loss flow (materially higher risk for zero present-day numeric difference). Stage 3 lands gated on the commencementVerified flip (itself a Reza-verified event). Worked example for stage 2 Ring-0 (healed base, VR-006 loan data): Thornland Lot1 947,076×0.0649=61,465.23 + Broadbeach 228,000×0.0669=15,253.20 + Thornland Lot2 482,000×0.0669=32,245.80 ≈ 108,964 theoretical auto interest (absent INTEREST_CHARGED ledger rows / offsets on those loans — actuals win where present; Guildford's loan is on the PRIMARY RESIDENCE → NOT deductible: only INVESTMENT-property loans enter, so the property-loan filter must exclude owner-occupied/no-rental properties consistent with rental-income deductibility — deduct interest only for properties whose rental income is assessable). deductions.property rises accordingly; taxableIncome + tax fall; CFO benefit becomes ≤ deductions.property. Ring-3 targets recomputed at build time against live data.

[STAGE 2 SHIPPED — PR #1425, 2026-07-15] Engine (Float+Decimal) auto-derives deductible interest from propertyLoans[] via the ONE helper; HOME gate in the engine; loan-linked expense de-dup both twins. Callers threaded (getUserTaxPosition + /api/tax/position, one FY INTEREST_CHARGED groupBy). P1/P2 deleted (CFO benefit = max(0, deductions.property − income.rental) × marginalRate/100); P3 portfolioEngine producers+fields deleted (mislabeled raw-loss, consumers verified unread); P4 property-roi route deleted (orphaned, hardcoded 37%). Ratchet: tests/tax/mon045PropertyLoanInterest.test.ts (14 — Ring-0 wiring/HOME/de-dup/actuals-first, Ring-2 parity, benefit≤deductions invariant, Ring-1 source-lock keeping all four producers dead + auto-derive call-site count locked at 2). Neomatrix: rogue node+3 edges deleted; engine.tax.deductiblePropertyLoanInterest + input.LoanTransaction.interestCharged modelled, 5 verified edges; anchors re-pinned (:132/:189/:313); full neomatrix:check green. Gates: tsc clean; 1237/1237 tax+cfo; 349/349 calc/golden/intelligence. VERIFIED gate: Reza merge approval + per-fix Ring-3 Chrome capture vs healed base ($412,768 / $141,548) — expect deductions to RISE by the auto-derived interest and the benefit tile < deductions. Stage 3 (applyNegativeGearing loss-quarantine wiring) deferred — identical numbers today, commencementVerified=false (FW-2).

[RING-3 PASS — VR-009, 2026-07-15 → VERIFIED] Proven exact on Reza's live data (docs/verification/runs/VR-009.md): deduction rise $108,965 = Σ investment loan interest to the dollar (Thornland Lot 1 $947,076×6.49%=$61,465 + Lot 2 $482,000×6.69%=$32,246 + Broadbeach $228,000×6.69%=$15,253 = $108,964); Guildford (primary residence) correctly EXCLUDED ($0, not its ~$4,613). New baseline: Total income $404,338 · deductions $148,519 (Property $148,409) · taxable $255,819 (exact) · tax owing $86,373 (tax $81,257 + Medicare $5,116). The $157,746 benefit impossibility is GONE. Regression clean (income delta −$8,430 entirely Reza's one-off reclassifications, not MON-045). Residual advisory incoherence → MON-077 (stale 'Potential Missed Deductions'). VR-009 accepted as the re-baseline. CLOSED gates on promotion (§23.2.6): Ratchet test in CI ✓ (merged #1425), Neomatrix moved ✓ — remaining: parity/baseline growth recorded by the Matrix's VR-009 baseline acceptance. Stage 3 (applyNegativeGearing loss-quarantine wiring) stays DEFERRED (identical numbers today; commencementVerified=false, FW-2).

### MON-046 — Bare /dashboard/investments 404s (CFO tile + DocumentList + sidebar nav)

**🟢 VERIFIED** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** Several links to the Investments section (the My Guide investment tile, a document link, and the sidebar) opened a 404 page.
>
> **What changed:** Added an Investments landing page that redirects to the Investment Accounts tab, so every link into /dashboard/investments now lands somewhere real.
>
> **What you should see:** Click the Investments tile on My Guide (and the Investments item in the sidebar) — it now opens the Investment Accounts page instead of a 404.

- **Root cause:** `app/dashboard/cfo/page.tsx:1062`, `app/dashboard/investments/page.tsx:1`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `components/documents/DocumentList.tsx`, `lib/navigation/trailNav.tsx`
- **Fix PR(s):** ##1402
- **Holistic test (§19.4):** `tests/dashboard/cfoTileLinks.test.ts`
- **Detail:** `ratchet:MON-044`

Surfaced by the MON-044 dead-link Ratchet (tests/dashboard/cfoTileLinks.test.ts) on 2026-07-14 — the route-existence assertion flagged /dashboard/investments has no page.tsx (only accounts/holdings/super/transactions sub-tabs), so 4 bare-route links 404d. Fix: app/dashboard/investments/page.tsx redirects to /dashboard/investments/accounts (mirrors the /dashboard/accounts -> /dashboard/balances redirect pattern), fixing all callers at source (§12.1). Example of the NeoAudit living-system loop — a Ratchet added for one bug caught a latent sibling. [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-047 — Dead unwired calculateMonthlyProgressNetWorth uses COST basis (averagePrice) not market — latent net-worth bug + stale graph node

**🟡 DIAGNOSED** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** A leftover net-worth calculation (used only by tests) adds up investments at what you PAID (cost) instead of what they are worth now (market) — so it would understate net worth. It is not shown anywhere in the app.
>
> **What changed:** (planned) Delete the dead function + its Decimal twin + calc-audit shadow + tests, and remove its Neomatrix node — production already uses the correct net-worth-history source (from the MON-018 fix).
>
> **What you should see:** Nothing visible changes (the function is not wired to any screen); this is code + map hygiene.

- **Root cause:** `lib/cfo/intelligenceEngine.ts:404`, `lib/cfo/intelligenceEngine.ts:389`
- **Downstream consumers (§19.4):** `(none — unwired: only tests/cfo/actions-ai-intel.decimal.test.ts + lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts shadow)`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neomatrix-audit:2026-07-14`

Surfaced by the Neomatrix accuracy audit (Reza directive 2026-07-14 — bugs in Monitrax are reflected in the graph). calculateMonthlyProgressNetWorth (Float :404 in the sibling) + calculateMonthlyProgressNetWorthDecimal (:389) compute netWorth investments as Σ(units×averagePrice) = COST basis, whereas the canonical netWorthCalculator.calculateNetWorth uses units×currentPrice = MARKET value (§12.2.1 divergence). VERIFIED unwired: production CFO monthly-progress net worth uses getNetWorthHistory(userId,2)→history.deltaAbsolute/deltaPct (the MON-018 fix superseded this function); the only references are tests + the calc-audit Decimal shadow. So NO live number is wrong today (changesNumbers=false) — it is DEAD CODE with a latent cost-basis bug + a stale documented Neomatrix node. FIX (own PR, careful re calc-audit census): delete both functions + the shadow fixture (lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts) + the tests + the graph node engine.intelligenceEngine.calculateMonthlyProgressNetWorth; regenerate GENERATED_CORE; confirm neomatrix:check + calc census stay green. Interim: graph node flagged suspected-issue so the map stops presenting dead code as a documented live engine. [VR-007 2026-07-15] fixPRs placeholder "#PENDING" REMOVED: no fix PR exists — the fix is still "(planned)" (delete the dead fn + Decimal twin + calc-audit shadow + graph node). DIAGNOSED does not require fixPRs (§7(c) applies at FIXING/VERIFIED/CLOSED). Set fixPRs when the deletion PR opens.

### MON-048 — Property Cashflow-rhythm shows one-off expenses as MONTHLY (badge read declared frequency, not isRecurring)

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-14

> **What was wrong:** On a property’s detail page, the "Cashflow rhythm / Recent activity" list tagged every expense "Monthly" — even genuine one-off costs (e.g. Battery System for HOME -$11,385, Hunter Premium -$812).
>
> **What changed:** The cadence badge now reads the categorisation signal (isRecurring): a one-off shows "One-off", a recurring expense shows its real frequency — via ONE shared helper so it can’t drift.
>
> **What you should see:** Open the HOME property → Cashflow rhythm: the Battery System (and other one-offs) now read "One-off", not "Monthly"; recurring items keep their real frequency.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:866`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** ##1406
- **Holistic test (§19.4):** `tests/properties/activityFrequencyLabel.test.ts`
- **Detail:** `reza-chrome:2026-07-14`

Found by Reza on the property detail page (2026-07-14 screenshot): the RecentActivityCard "Cashflow rhythm" built each expense row’s cadence badge from e.frequency.charAt(0)+... i.e. the RAW DECLARED frequency, which defaults to MONTHLY — so a one-off (isRecurring===false) rendered "Monthly". This is a MON-037 SIBLING (F1 partial-surface): MON-037 fixed the Expenses CARD + the cashflow ENGINE run-rate, but this DIFFERENT component on the same page kept the declared-frequency label. Fix (§12.2.1 one source, PR #1406): lib/properties/activityFrequencyLabel.ts returns "One-off" when isRecurring===false else the humanised frequency; RecentActivityCard uses it (ExpenseItem type gained isRecurring; the detail API already returns it via the enricher spread). Ratchet (step 3): tests/properties/activityFrequencyLabel.test.ts. GROWTH-LOOP STEP 5 (brief-broadening, follow-up PR 2026-07-14): VR-005 Chrome missed this because the brief listed no LABEL/badge scrutiny — it checked the Expenses CARD reconciliation A5 + the cashflow NUMBERS but never told the auditor to read the cadence BADGES. The specific one-off badge is now the Ratchet; the CLASS it revealed ("a correct number can carry a lying LABEL") is now a STANDING direction in the canonical brief VERIFICATION_PLAYBOOK.md §3.3 Part D ("LABELS, not just numbers") so the next novel label-lie is still caught by eye. This is the type case that made the growth loop's step 5 explicit (NEOAUDIT.md §10 / FIX_PROTOCOL Stage 5.4). Neomatrix: pure presentation helper, allowlisted. changesNumbers=false (amount unchanged; only the frequency label). | [VR-006 VERIFIED 2026-07-14] Ring-3 confirmed live (finding #25): expense one-offs correctly badged ONE-OFF — HOME battery -$11,385, Thornland Lot 1 legal/insurance, Guildford painting — NOT 'Monthly'. edgeCases.oneOffShownAsMonthly === false. fixPR #1406. Promoted → VERIFIED.

### MON-049 — Document count & storage disagree: Settings '24 documents · 12MB' vs Vault '6 all-time · 14.0 MB'

**🟡 DIAGNOSED** · 🟢 low · changes numbers: **no** · area: documents · opened 2026-07-14

> **What was wrong:** The document count and storage size differ between Settings (24 documents, 12MB) and the Vault (6 all-time, 14.0 MB).
>
> **What changed:** (planned) Stop DERIVING the "All documents" count by summing buckets. `app/dashboard/documents/page.tsx:285-313` builds documentCounts across FOUR independent taxonomies in one flat map (category, `fy:`, `entity:`/`entity:type:id`, and `tax:`), so every document is counted once per taxonomy. `components/documents/FolderTree.tsx:323-325` then sums every key NOT prefixed `entity:` or `fy:` — which silently includes the `tax:` bucket: 6 (category) + 6 (tax:UNTAGGED) = 12. The fix is to COUNT DOCUMENTS (documents.length / a dedicated total), not to add `tax:` to the exclusion list — another prefix exclusion re-arms the bug the moment a fifth taxonomy is added.
>
> **What you should see:** My Vault shows "ALL DOCUMENTS 6" matching the "TOTAL 6 all-time" stat strip, the "6 DOCUMENTS" list header and "Receipts 6" — and it stays 6 if a new bucket taxonomy is added later.

- **Root cause:** `app/dashboard/documents/page.tsx:285`, `components/documents/FolderTree.tsx:323`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-006`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: app/dashboard/documents. Expected: consistent doc count + storage across Settings and the Vault. Actual: Settings 24 docs / 12MB vs Documents/Vault 6 all-time / 14.0 MB. Evidence/run: VR-006. [VR-007 2026-07-15] DIAGNOSED — root cause PROVEN in code (§19.2), not hypothesised. Storage corroborates the true count of 6 (2.2+2.9+2.8+2.1+2.0+2.0 = 14.0 MB == "STORAGE 14.0 MB used"). Settings' "24 documents · 12MB" is a THIRD disagreeing figure (VR-006) and is NOT explained by this root cause — the fix must re-check Settings, or that half stays open.

### MON-050 — Month-end balance differs: CFO $301,712 vs Cashflow 30-day forecast $301,639 ($73)

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** The projected month-end balance on My Guide ($301,712) differs slightly from the Cashflow page's 30-day forecast ($301,639) by $73.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-006`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: app/dashboard/cfo. Expected: same month-end / forecast balance on My Guide and the Cashflow forecast. Actual: CFO month-end $301,712 vs cashflow 30-day forecast $301,639 (differ $73). Evidence/run: VR-006.

### MON-051 — CFO intelligence metrics hardcoded: savingsOpportunities=3, pendingActions=5 rendered as real figures

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: cfo · opened 2026-07-14

> **What was wrong:** My Guide shows 'savings opportunities' and 'pending actions' counts that are hardcoded placeholders, not computed from your data.
>
- **Root cause:** `lib/cfo/intelligenceEngine.ts:274`, `lib/cfo/intelligenceEngine.ts:275`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:MATRIX-INGEST-2026-07-15`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: lib/cfo/intelligenceEngine.ts. Evidence/run: MATRIX-INGEST-2026-07-15.

### MON-052 — PAYG withholding omits HECS-HELP component (TODO stub) — withholding estimate understated for HELP-debt users

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: tax · opened 2026-07-14

> **What was wrong:** If you have a HECS/HELP debt, the PAYG withholding estimate ignores the compulsory HELP repayment component, so take-home estimates can be too high.
>
- **Root cause:** `lib/tax-engine/core/paygCalculator.ts:197`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:MATRIX-INGEST-2026-07-15`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: lib/tax-engine/core/paygCalculator.ts. Evidence/run: MATRIX-INGEST-2026-07-15.

### MON-053 — One-off income annualised x12 into the tax base — two single ATO deposits become ~$120.6K phantom recurring income

**✅ CLOSED** · 🔴 critical · changes numbers: **yes** · area: tax · opened 2026-07-15 · closed 2026-07-17

> **What was wrong:** Two one-off ATO deposits (each a SINGLE transaction dated 27 May) are stored as Income{frequency: MONTHLY} and multiplied by 12, adding roughly $120,600 of income you never received to your tax base — and you are taxed on it. This is the income-side twin of MON-037 (the same bug for expenses), which was fixed for expenses only.
>
> **What changed:** A one-off income is now expressible and honoured everywhere: the data model gains Income.isRecurring (default TRUE — every existing row behaves exactly as before), both tax engines (normal + high-precision) count a one-off ONCE instead of ×12, the monthly run-rate excludes it, the income page shows 'One-off ($X once)' instead of '$X/mo', and every place that creates income (manual add, transaction linking, document import) can mark it one-off — a single linked deposit now defaults to one-off instead of silently becoming monthly. Your two ATO rows can be reclassified via Edit (one checkbox).
>
> **What you should see:** After deploy: edit each of the two ATO income rows and tick 'One-off income' → the Income page shows them as 'One-off ($9,098 once)' not '$9,098/mo'; the Tax page declared gross falls from $524,831 by ~$120,600; the tax estimate ($194,218) falls accordingly. Every other income row is unchanged.

- **Root cause:** `prisma/schema.prisma:1865`, `prisma/schema.prisma:1950`, `prisma/schema.prisma:183`, `lib/tax-engine/position/taxPositionCalculator.ts:30`, `lib/tax-engine/position/taxPositionCalculator.ts:62`, `lib/tax-engine/position/taxPositionCalculator.ts:128`, `lib/tax-engine/position/taxPositionCalculator.ts:195`, `lib/tax-engine/position/taxPositionCalculator.ts:636`, `lib/tax-engine/position/taxPositionCalculator.ts:695`, `lib/tax-engine/position/userTaxPosition.ts:99`, `lib/utils/frequencies.ts:13`, `components/transactions/TransactionLinkDialog.tsx:374`, `components/transactions/TransactionLinkDialog.tsx:610`, `app/api/income/route.ts:240`, `app/api/transactions/[id]/link/route.ts:417`, `app/api/documents/analyze/confirm/route.ts:459`, `app/api/onboarding/complete/route.ts:230`, `lib/db/tenant.ts:168`
- **Neomatrix:** `engine.taxPositionCalculator.calculateTaxPosition`, `input.Income.declared`, `service.tax.getUserTaxPosition`, `number.taxPayable`
- **Downstream consumers (§19.4):** `lib/tax-engine/position/userTaxPosition.ts (service.tax.getUserTaxPosition — the canonical read)`, `app/api/tax/position/route.ts`, `app/api/cashflow/intelligence/route.ts`, `lib/services/masterFinancialService.ts`, `lib/cfo/decisionSupport/taxIntegration.ts`, `lib/tax-engine/entity/entityTaxRouter.ts`, `lib/tax-engine/index.ts`, `lib/tax-engine/position/index.ts`, `lib/calc-audit/engines/decimal-tax-engine-income-position.ts (Decimal shadow — same unguarded bug at :636)`, `app/dashboard/tax/page.tsx (declared gross $524,831/yr + the tax estimate)`, `app/dashboard/cfo/page.tsx (Tax Position −$194,218; Neg. Gearing Benefit)`, `app/(dashboard)/cashflow/page.tsx (TAX·FY ESTIMATE $194,218)`, `app/dashboard/income/page.tsx (the $9,098/mo + $952/mo rows and the "Other" $192,698/yr group)`, `app/dashboard/activity (TOTAL INCOME $484K/YEAR)`, `lib/tax-engine/deductions/propertyLoanInterest.ts (MON-045 stage 2 wires into this same position)`
- **Fix PR(s):** ##1421
- **Holistic test (§19.4):** `tests/tax/mon053OneOffIncome.test.ts`
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/income + /dashboard/activity (Recurring). Expected: An ATO refund/credit is a one-off: it must be counted ONCE in the year received, never extrapolated x12 to an annual recurring basis. Actual: 'Ato Ato001100022493651' = $9,098 Monthly ($109,176/yr) and 'Ato Ato002000023189359' = $952 Monthly ($11,424/yr); each has exactly ONE deposit in the whole feed, both dated 27 May. Both flow into the declared-gross Tax base of $524,831/yr and are taxed.. Evidence/run: VR-007. [VR-007 2026-07-15] DIAGNOSED — root cause §19.2-VERIFIED in code at HEAD 6b8a076 (every anchor re-read this run; the original triage cited `lib/calculations/taxPositionCalculator.ts`, which DOES NOT EXIST — the real path is `lib/tax-engine/position/taxPositionCalculator.ts`). MON-037 IS THE ANCESTOR: the guard at :194-197 and the Decimal twin at :694-697 were added for EXPENSES only; income was never given the same treatment, so the identical bug survived on the income side. PRODUCER CENSUS CORRECTED: the triage listed 4 producers and flagged itself incomplete — it was. The full runtime census (verified by `grep -rn "income.create"`) is P1 app/api/income/route.ts:240 (the MAIN income CRUD — MISSING from the original list), P2 app/api/transactions/[id]/link/route.ts:417, P3 app/api/documents/analyze/confirm/route.ts:459, P4 app/api/onboarding/complete/route.ts:230, P5 lib/db/tenant.ts:168; plus lib/testing/loader.ts:460 (test fixtures, not runtime). *** SEQUENCING — MON-053 LANDS BEFORE MON-045 STAGE 2. *** MON-045's Ring-3 verifies the CFO neg-gearing benefit against the tax base. If MON-045 stage 2 lands first, it verifies against a base inflated by ~$120.6K of phantom income; when MON-053 then lands, the number moves again and MON-045's Ring-3 is invalidated — burning a full Ring-3 cycle (Reza's real-data run). Land MON-053, re-baseline, THEN MON-045 stage 2. *** RELATIONSHIP TO RECTIFY CLUSTER ①. *** STATE.md's rectify cursor puts cluster ① = MON-037 (one-off hub) first. MON-053 IS MON-037's income-side twin — the SAME defect class, the same engine file, the same fix shape. Work them as ONE cluster, not as unrelated issues: the Ring-1 source-lock below covers BOTH sides and is the thing that actually kills the pattern. RATCHETS (§5 — a bug at Ring 3 proves a hole in Rings 0–2): Ring-0 — a one-off income counts ONCE (both the Float and Decimal engines; mirror tests/calculations/mon037OneOffEngines.test.ts). Ring-1 SOURCE-LOCK — assert that ANY IncomeItem/ExpenseItem annualisation site is one-off-guarded, so a NEW unguarded annualisation cannot be added; this is the ratchet that kills the ancestor pattern rather than this one instance. Ring-2 — Float/Decimal parity on the Golden Household. BLAST RADIUS IS A LOWER BOUND: VR-007 read 1 of 16 Activity pages, so there may be further one-off income rows not yet seen. GATE NOTE: this issue is changesNumbers=true, so §7 will require a linked holistic test + a resolving semanticKey before it can reach VERIFIED — `test` is null today and MUST be set to the §19.4 propagation test the fix PR adds. | [FIX 2026-07-15 — the income-side MON-037, built per the Matrix cluster-① handoff] (1) SCHEMA: Income.isRecurring Boolean @default(true) + additive migration 20260715000000_add_income_is_recurring (default-backfilled — no reclassification of existing rows). (2) ENGINE: IncomeItem.isRecurring added; the MON-037 guard applied at BOTH annualisation sites — Float (calculateTaxPosition) AND the Decimal twin (calculateTaxPositionDecimal). VERIFIED-NOT-NEEDED: lib/calc-audit/engines/decimal-tax-engine-income-position.ts does NOT re-implement annualisation — it imports calculateQuickTaxPositionDecimal from the same engine file (the handoff's 'guard it too' claim did not verify; recorded honestly). (3) READ PATHS: userTaxPosition map + /api/tax/position route assembly both carry isRecurring (both engine callers covered). (4) PRODUCERS: P1 income POST create + income/[id] PUT (undefined-passthrough — reclassification path for the two ATO rows) + P2 link route (single linked deposit defaults ONE-OFF unless client says recurring) + P3 documents confirm (data.isRecurring ?? true); P4 onboarding + P5 tenant wrapper verified no-change-needed (default(true) semantically correct / passthrough). (5) GATE UI: TransactionLinkDialog — count<=1 now CLASSIFIES one-off (RC-C, never silently defaulted); income path gains the recurring/one-off control the expense path had (payload already shared). (6) RUN-RATE: canonical netIncomeCalculator returns 0/mo for one-offs (mirrors MON-037 rhythm semantics; consumers = income page + portfolio snapshot, both correct under run-rate semantics); income row shows 'One-off ($X once)' via the ONE cadence-label rule (activityFrequencyLabel, MON-048). RATCHETS: tests/tax/mon053OneOffIncome.test.ts — Ring-0 Float+Decimal one-off-once + back-compat default, Ring-2 Float===Decimal parity, RUN-RATE zero, and the Ring-1 SOURCE-LOCK (exactly 4 annualisation call sites, EVERY one guarded within 6 lines — a 5th unguarded site fails the build; this is the F1 ancestor-killer the handoff demanded). §19.2 worked example: 9,098 one-off → income.total 9,098 (was 109,176); mixed household 9,098+952+24,000 = 34,050 both engines. Neomatrix: calculateTaxPosition anchor re-pinned 101→104. Gates: tsc + 950/950 tax tests + neomatrix:check + lint:financial-surfaces (baseline re-lined 2014→2047) + issues:check green. PAUSE-POINT HANDLING: pause-1 (migration) — the AskUserQuestion tool errored mid-flow; Reza then instructed 'continue from where you left off'; built on the handoff's pre-specified shape; PR stays DRAFT so merge = his explicit approval (also pause-2, before Ring-3). Ring-3 targets per handoff §6; cannot reach VERIFIED without the Chrome PASS. | [RING-3 PASS → VERIFIED 2026-07-15, per-fix Chrome/screenshot verification on prod (deploy dpl_2pJRVLARspBgiAMbbt1cPT6DZNC6 READY 07:22 UTC)] Reza reclassified FOUR rows one-off (the two ATO + two Service NSW). Every target hit with EXACT arithmetic: (a) /dashboard/income renders 'One-Off · ($952 once)' / '($30 once)' / '($108 once)' — no more $X/mo, variance noise gone (+$0/+0%); (b) Tax TOTAL INCOME fell $524,831 → $412,768 = −$112,063, matching Σ(annualised−once) for the 4 converted rows = $112,068 (±$5 rounding) — one-offs correctly count ONCE (the money WAS received), not zero; (c) tax estimate fell $194,218 → $141,548 = −$52,670 = 112,063 × 0.47 (45% marginal + 2% Medicare) TO THE DOLLAR; (d) taxable identity exact (412,768 − 39,554 = 373,214 shown); (e) regression guard: recurring rows unchanged (Gold Coast $2,515 actual-matched); the three fragmented Cienna rent rows (−100% variance) are the PRE-EXISTING MON-009/MON-001 class, untouched. NOTE the honest delta vs the handoff's '~$120.6K' headline: the phantom removed is (×12 − once) = ~$110.5K for the ATO pair, not the full ×12 — the observed fall confirms the CORRECT semantics. Promotion (→CLOSED) queued: Ratchet already in CI (#1421); temp vercel-build resolve step removed in the follow-up PR; VR-008 full re-baseline next.

[VR-008 COVERAGE SWEEP, 2026-07-15 — the class was broader than the two ATO rows] The Matrix swept ALL 21 income rows on prod: 8 rows total reclassified to one-off (the two ATO from VR-007 + Service NSW ×2, Hipcamp ×2, Isaac Asadi, Betterhelp — same class, fixed by Reza via the MON-053 UI control); 13 rows correctly left recurring (legitimate declared income; $0 actual = out-of-window txn, not a one-off). Root cause of the class: intake stamped frequency=MONTHLY/isRecurring=true and never classified a single-deposit one-off. Guardrails: #1421 source-aware intake + Ring-1 source-lock; Reza decision = SOURCE-AWARE default (blanket default-to-one-off rejected; backfill abandoned). MON-053 → CLOSED gates on MON-075 (the standing detector, owned by the Matrix). FIX_PROTOCOL §7 retro recorded 2026-07-15. [VR-010 2026-07-17] Promotion complete (Ratchet tests in CI + Neomatrix moved with the fix + re-baseline) → CLOSED.

### MON-054 — CFO 'Refinance Savings' tile renders an LVR-blocked alert as an offer (drops alert.action)

**🔵 OPEN** · 🟠 high · changes numbers: **no** · area: cfo · opened 2026-07-15

> **What was wrong:** The CFO 'Refinance Savings' tile shows a 104%-LVR warning as if it were a refinance offer, because the tile prints the alert's title/loan/impact but throws away the alert's action text. The underlying rule is right; the screen misleads.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: app/dashboard/cfo/page.tsx. Expected: No refinance opportunity presented on a loan at 104% LVR (negative equity — not refinanceable). Actual: 'REFINANCE SAVINGS $5,141/yr - 3 opportunity found' lists 'High LVR: 104% - Bankwest - $9,471/yr' (Thornland Lot 1, equity -$37,076). The LVR gate itself is CORRECT; the tile drops alert.action and renders the warning under a REFINANCE SAVINGS header.. Evidence/run: VR-007. [VR-007 2026-07-15] PROVENANCE — READ THIS BEFORE "FIXING" THE LVR RULE: the LVR gate is CORRECT and must NOT be changed. `lib/cfo/decisionSupport/loanDecisionSupport.ts:273-277` already refuses to recommend a refinance above the LVR ceiling. The defect is PRESENTATION: the CFO tile (`app/dashboard/cfo/page.tsx:969-996`) renders `alert.title | loanName | impact` under a "REFINANCE SAVINGS" header and DROPS `alert.action` — the field that carries the "not refinanceable" guidance. Chrome read the screen as "refinance offered on a 104% LVR loan" precisely BECAUSE the screen misleads, not because the rule is wrong. The $9,471 is `principal × 0.01` to the dollar (an LMI estimate), i.e. a cost/impact figure rendered under a savings header. Fix = render alert.action (and stop filing LVR warnings under a savings header); do NOT touch the gate. UNVERIFIED at this pin: the :273-277 and :969-996 line anchors were carried from the Phase-2 triage and are NOT in rootCause[] because they were not re-read this run — re-verify before relying on them.

### MON-055 — Portfolio net cashflow reads two different values (-$552/mo vs -$1,055/mo) with no basis label

**🔵 OPEN** · 🟠 high · changes numbers: **yes** · area: cashflow · opened 2026-07-15

> **What was wrong:** Your property portfolio's monthly cashflow shows as -$552 in two places and -$1,055 in another, and the six individual properties add up to -$1,056. At least one of these is wrong and nothing on screen explains the difference.
>
- **Neomatrix:** `number.propertyCashflow`, `engine.propertyCashflow.computePropertyCashflow`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo vs Home vs /dashboard/properties. Expected: One portfolio cashflow figure, or two clearly-labelled bases. Actual: CFO 'Property Portfolio NET CASHFLOW' = -$552/mo and Home 'Freedom Horizon' = -$552/mo, but Home 'ENTITY CASHFLOW - Properties' = -$1,055/mo and the sum of the 6 per-property figures = -$1,056/mo (list CF/yr sum -$12,664 = -$1,055/mo). No basis label distinguishes them.. Evidence/run: VR-007.

### MON-056 — What-If concessional cap usage (74%) contradicts the Superannuation page (0%)

**🔵 OPEN** · 🟠 high · changes numbers: **yes** · area: super · opened 2026-07-15

> **What was wrong:** The salary-sacrifice What-If says you have used 74% of your concessional super cap; the Superannuation page says 0% of $30,000 used. Two engines disagree about the same number, so the What-If's headroom advice may be wrong.
>
- **Neomatrix:** `input.taxYearConfig.concessionalCap`, `engine.cfo.scenarios.salarySacrificeToSuper.salarySacrificeToSuperScenario`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo/what-if/salarySacrificeToSuper vs /dashboard/investments/super. Expected: Both surfaces agree on concessional contributions used. Actual: Super page: 'CONCESSIONAL USED 0%', '$30,000 remaining of $30,000 cap', 'SG INFLOWS $0'. What-If lever: 'Concessional cap used: 74%', headroom $7,728, implying SG of $16,272/yr (54% used before the modelled sacrifice).. Evidence/run: VR-007.

### MON-057 — Negative savings rate (-30.5%) badged 'ABOVE AVERAGE' on the Home tile

**🔵 OPEN** · 🟠 high · changes numbers: **no** · area: cashflow · opened 2026-07-15

> **What was wrong:** Your savings rate of -30.5% (you are spending more than you earn) is shown with a green 'ABOVE AVERAGE' badge, which tells you the opposite of the truth — and contradicts two other panels on the same screen.
>
- **Neomatrix:** `number.savingsRate`, `ui.dashboard.savingsRateTile`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: app/dashboard (SAVING RATE tile). Expected: A -30.5% savings rate must not be badged as above average. Actual: Home SAVING RATE tile: '-30.5%' with badge 'ABOVE AVERAGE' and sub-text 'AU median is around 24%'. The same -30.5% is flagged by CFO Watch Items as 'Savings rate below target' and by Home's 'What you should know' as 'Spending More Than Earning'.. Evidence/run: VR-007.

### MON-058 — CFO Risk Radar claims '100% of your wealth is in property' — contradicts Home's 91.4%

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: cfo · opened 2026-07-15

> **What was wrong:** The CFO Risk Radar says 100% of your wealth is in property; your Home page says 91.4% and calls it 'good diversification'. The concentration percentage is computed wrongly on the CFO surface.
>
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo (Risk Radar). Expected: 91.4% per Home's own asset allocation. Actual: CFO Risk Radar: '100% of your wealth is in property. Consider diversifying into other asset classes.' Home Asset allocation: Property 91.4% ($4,990,000 of $5,461,679), Investments 1.2%, Cash 5.5%, Other 1.9%. Home Insights simultaneously says 'Good diversification across property, cash, and investments.'. Evidence/run: VR-007.

### MON-059 — Annual income shown on three surfaces with an unlabelled basis ($239K / $484K / $524,831)

**🔵 OPEN** · 🟡 medium · changes numbers: **no** · area: income · opened 2026-07-15

> **What was wrong:** Your annual income reads $239K on Home, $484K on Activity and $524,831 on Tax. Each is correct for a different basis, but only Home says which basis it uses — so the other two look like errors. (Extends MON-043's labelling fix to the Activity surface.)
>
- **Neomatrix:** `engine.incomeAggregator.aggregateIncome`, `ui.dashboard.incomeTile`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/activity vs Home vs /dashboard/income. Expected: Each annual-income figure carries a basis label explaining the difference. Actual: Home $239K labelled 'Last 12 months' (actuals); Activity 'TOTAL INCOME $484K / YEAR' with NO basis label (header only reads 'Year to date'); Income page declared gross $524,831/yr. $484K aligns with the declared-gross-less-deductions tax base ($485,277), not with Home's actuals — but nothing on Activity says so.. Evidence/run: VR-007.

### MON-060 — Estimated annual tax differs between /cashflow ($194,218) and /dashboard/activity ($175K)

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: tax · opened 2026-07-15

> **What was wrong:** The activity page's money-flow diagram showed a different annual Tax figure (~$19K lower) than the /cashflow page and the Tax page, because the dashboard snapshot calculated tax its own way — leaving out depreciation, deductible loan interest, super and franking credits.
>
> **What changed:** The dashboard snapshot now reads the exact same tax calculation as the Tax page, /cashflow and your CFO — one calculation, adapted into the tiles' format. The separate (incomplete) calculation was deleted, along with an old unused tax endpoint.
>
> **What you should see:** The Tax figure on the activity page's Year-to-date flow now matches the Tax Owing on /dashboard/tax and /cashflow — one number everywhere it appears.

- **Root cause:** `lib/services/masterFinancialService.ts:1366`, `components/bookkeeping/ConsumerMoneyFlowSankey.tsx:84`
- **Neomatrix:** `number.cashflowIntelligence.estimatedTax`, `number.taxPayable`
- **Downstream consumers (§19.4):** `components/bookkeeping/ConsumerMoneyFlowSankey.tsx:84 (activity Year-to-date flow Tax node <- master.tax.estimatedTaxPayable)`, `every master-snapshot consumer reading snapshot.tax.* (dashboard tax tiles, health inputs)`, `app/api/tax/position -> /dashboard/tax (unchanged numbers — assembly was a verbatim clone)`, `app/api/cashflow/intelligence + lib/cfo/decisionSupport/taxIntegration (already on the canonical bundle — unchanged)`
- **Fix PR(s):** ##1448
- **Holistic test (§19.4):** `tests/golden/ring2.taxParity.test.ts#master snapshot tax summary == canonical bundle == tax route (A3-convergence lock)`
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cashflow vs /dashboard/activity. Expected: One tax figure. Actual: /cashflow 'TAX - FY ESTIMATE' = $194,218 (matches CFO -$194,218 exactly). /dashboard/activity 'Year to date' flow shows Tax = $175K, ~$19K lower, with no basis label.. Evidence/run: VR-007. DIAGNOSED+FIXED 2026-07-18 (§19.2 verified from source): master's buildTaxSummary was a SECOND assembler feeding the SAME calculateTaxPosition engine with an incomplete input set — depreciations: [], NO MON-045 property-loan interest, NO super, NO franking fields (masterFinancialService.ts:1366-1445 pre-fix) — while /dashboard/tax + /cashflow + CFO read the full canonical assembly (getUserTaxPosition). Same engine, different inputs (F2). Fix: buildTaxSummary deleted; buildTaxSummaryFromPosition adapts the ONE canonical bundle into the legacy TaxSummary shape. NOTE: master's old tax base also had rental-dedup + isTaxable filter — that semantic unification into the canonical assembler is the recorded MON-020 follow-up. changesNumbers on master surfaces (the activity Tax figure converges to the canonical); Matrix Ring-3 pending after Reza merges.

### MON-061 — Property rental income card cadence label contradicts the ledger (Guildford/Broadbeach/Thornland Lot 1)

**🔵 OPEN** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-15

> **What was wrong:** The rental income card on a property says 'weekly'/'fortnightly'/'monthly' in a way that contradicts the cadence badges on the very rows beneath it, so you cannot tell which cadence the app actually used.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: app/dashboard/properties/[id]/page.tsx (Rental income card). Expected: Card cadence label matches the source's declared cadence, or is labelled as a detected/actual cadence. Actual: Guildford card reads 'weekly - from 1 source - +$2,174/mo' while the declared source 'Isaac Asadi Rent' has cadence Monthly ($500); its real deposits are ~weekly $500 and the app flags +335% variance. Thornland Lot 1 card reads 'fortnightly - from 4 sources' while both visible rent rows are badged MONTHLY. Broadbeach card reads 'monthly - from 2 sources' while one of its 2 sources is Weekly.. Evidence/run: VR-007.

### MON-062 — Property rental income card mixes a DECLARED source count with an ACTUALS amount, unlabelled

**🔵 OPEN** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-15

> **What was wrong:** The rental card counts 2 income sources but shows the dollars from only 1 of them, because the second has no matching transactions. The count and the amount are on different bases and nothing says so.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: app/dashboard/properties/[id]/page.tsx (Rental income card). Expected: The '+$X/mo' and the 'from N sources' count share one basis, or the basis is labelled. Actual: Broadbeach: 'monthly - from 2 sources - +$2,515/mo' — the count (2) is declared but $2,515 is one source's actuals; the 2nd source ('Rent - Broadbeach', Weekly $2,947/mo) is declared-only ('No txns') and is correctly excluded from ANNUAL RENT $30,174 / YIELD 5.03% / CASHFLOW $15,879 on the actuals basis — but the card gives the reader no way to know that.. Evidence/run: VR-007.

### MON-063 — HOME property ANNUAL RENT $902 matches neither the actuals nor the declared basis (third basis)

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: properties · opened 2026-07-15

> **What was wrong:** The HOME property's annual rent of $902 does not match its actual deposits (~$0) or its declared rent ($7,848). It appears to annualise only the smaller of two declared sources — an unexplained third basis that also drives its yield and cashflow.
>
- **Neomatrix:** `number.propertyCashflow`, `engine.propertyCashflow.computePropertyCashflow`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/properties/2def95ea-47a5-4179-b2ec-65cb22267cee (HOME). Expected: ANNUAL RENT reconciles to either actuals (~$0) or declared (($75+$579) x 12 = $7,848). Actual: Both HOME rental sources show Actual Monthly $0 (glkcwmw $75 declared/$0 actual/1 txn; s2bo3dz $579 declared/$0 actual/1 txn), yet the page shows ANNUAL RENT $902 (~$75 x 12 = $900), YIELD 0.12% (902/750,000) and CASHFLOW/YR -$8,668 (902 - 9,570). The $902 counts only the smaller declared source.. Evidence/run: VR-007.

### MON-064 — 'Liquid' has two values across surfaces ($304,304 Safety Net vs $301,808 Balances/Home)

**🟠 FIXING** · 🟢 low · changes numbers: **no** · area: balances · opened 2026-07-15

> **What was wrong:** 'Liquid' meant two different things: the Safety Net page counted your cash before the credit-card balance ($304,304) while Balances, Home and the cashflow page counted it after ($301,808) — a $2,496 disagreement that was exactly the Qantas card.
>
> **What changed:** One definition everywhere: liquid cash is what you could actually deploy after clearing the card, calculated once at the source. The card still shows as its own Credit line.
>
> **What you should see:** 'Liquid' is one number everywhere: $301,808 on Safety Net, Balances, Home and the cashflow page, and the emergency months derived from it read 11.6 (not 11.7).

- **Root cause:** `lib/services/masterFinancialService.ts:1964`, `lib/calculations/accessibilityBuckets.ts:87`
- **Neomatrix:** `engine.liquidCash.computeLiquidCash`
- **Downstream consumers (§19.4):** `app/api/safety-net/route.ts:42 (qm.liquidCash -> Safety Net page + emergency-fund months)`, `lib/calculations/accessibilityBuckets.ts (liquidToday -> hidden-wealth route -> Balances/Home//cashflow tiles)`, `app/api/dashboard/insights/route.ts:284,562 (freeToday) · app/api/cfo/advice/chat/route.ts:180 · what-if lever · decimal-cfo-scenarios (all read qm.liquidCash — converge by construction)`, `lib/verification/selfAuditInvariants.ts I9 (identity holds on the net basis)`
- **Fix PR(s):** ##1452, ##1455
- **Holistic test (§19.4):** `tests/golden/ring2.liquidCashParity.test.ts#buckets.liquidToday === quickMetrics.liquidCash === safety-net route (the two-variants class locked)`
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/safety-net vs /dashboard/balances vs Home. Expected: One liquid figure, or a labelled basis. Actual: Safety Net 'Liquid savings' = $304,304 (raw cash, drives the 11.7-month emergency fund). Balances 'Liquid today' = $301,808 and Home 'Cash' = $301,808 (both net of the -$2,496 credit card). No label distinguishes them.. Evidence/run: VR-007. DIAGNOSED+FIXED 2026-07-18 (PR #1452, §19.2 verified): quickMetrics.liquidCash was GROSS (masterFinancialService:1964 pre-fix) while accessibilityBuckets netted creditCards internally (:87 pre-fix) — two variants of one concept (F2/Mechanism B). Fix at the ONE producer: net at source; buckets take the canonical net + reconstruct gross internally; every consumer converges. Reza confirms the NET/deployable definition at merge; Matrix Ring-3 pending. [VR-017 RETRO + RE-FIX PR #1455 (2026-07-19)] Ring-3 VR-017 FAILED — Safety Net 'Liquid savings' + emergency months still GROSS ($304,304 / 11.7) with #1452 confirmed live. Root cause CORRECTED with executed evidence (§19.2): NOT a sibling producer — #1452's netting input `netWorth.liabilities.creditCards` is LOANS-only (calculateTotalLiabilities, netWorthCalculator.ts:219) and the live Qantas card is a CREDIT_CARD-typed ACCOUNT at −$2,496 (VR-007 capture:483), so the subtraction was silently 0. Balances' $301,808 was an accident of the buckets' min(gross, assets.accounts) — which also explains VR-010's inert cards-aware caption (breakdown.creditCards = loans-only = 0). The golden passed because it modelled the card as a LOAN (F2: same engine, different inputs). RE-FIX: ONE producer lib/calculations/liquidCash.ts computeLiquidCash nets BOTH representations (CREDIT_CARD loans + negative-balance CREDIT_CARD accounts); master + CFO emergency-buffer routed through it; inline netting deleted. Ratchets: ring2.liquidCashParity.accountCard.test.ts (LIVE topology + I9 months identity, fails on pre-fix code) + months-identity assertions added to the loan-card golden + liquidCash.test.ts worked examples. Census notes: /api/cashflow/intelligence runway (Σ ALL balances ÷ total outflow) and lib/health calculateLiquidAssets (positive non-CC cash + shares/ETFs, metricAggregation.ts:129) are DIFFERENT bases by design — untouched; health's basis is a labelling follow-up candidate. Stays FIXING until Matrix Ring-3 records $301,808 / 11.6 on Safety Net + Home Health + Balances + /cashflow + CFO.

### MON-065 — Doubled currency symbol on the salary-sacrifice What-If ('$$135,600/yr')

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-15

> **What was wrong:** The salary-sacrifice What-If prints a doubled dollar sign ('$$135,600/yr') — a formatting defect where a value already formatted as currency is prefixed with '$' again.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo/what-if/salarySacrificeToSuper. Expected: $135,600 / $22,272. Actual: 'Your snapshot: $$135,600/yr salary' and 'This contribution: $$22,272/yr' (and '$$29,472/yr' at max slider). Evidence/run: VR-007.

### MON-066 — Safety Net renders two contradictory recommendations together

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: safety-net · opened 2026-07-15

> **What was wrong:** Your Safety Net page tells you both to fix your overspending before building a safety net AND that your safety net is solid and you should move on to investing. Two rules fire at once with no precedence.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/safety-net. Expected: One coherent recommendation. Actual: 'YOUR GUIDE RECOMMENDS' shows both 'Your expenses exceed your income. Visit My Budget to find areas to reduce before building your safety net.' AND 'Your safety net is solid! You're ready to move to the Invest stage of your TRAIL journey.'. Evidence/run: VR-007.

### MON-067 — Debt Freedom gate lists an already-completed prerequisite (Household Profile 100%)

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: debt · opened 2026-07-15

> **What was wrong:** The Debt Freedom page asks you to set up your Household Profile before continuing, but your Household Profile is already 100% complete — the gate is not reading the completion state.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/debt-planner vs /dashboard/household-profile. Expected: Step 1 shown as done. Actual: Debt Freedom gate lists '1. Set Up Household Profile' as outstanding while Household Profile reads 'Profile Completion 100% - Profile complete'.. Evidence/run: VR-007.

### MON-068 — Entity value for 'YOU'/Reza differs by ~$1.95M with gross and net bases mixed in one card

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: entities · opened 2026-07-15

> **What was wrong:** Your entity 'YOU' is worth $4.6M on My Structure but $2,651,782 on Home — one is gross assets held, the other is net of debt. The Home card shows both a gross and a net figure side by side without saying which is which.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/entities vs Home (By entity). Expected: One basis, or a label. Actual: My Structure: 'YOU - $4.6M held' (gross). Home 'By entity': 'Reza - You - 18 holdings - $2,651,782' (labelled 'Net value by legal title'). Home renders '$5.4M held across your structure' AND 'Reza $2,651,782' in the same card region without distinguishing gross-held from net.. Evidence/run: VR-007.

### MON-069 — Same recurring expense 'Hunter Premium' reads two amounts ($797/mo vs $812)

**🔵 OPEN** · 🟢 low · changes numbers: **yes** · area: expenses · opened 2026-07-15

> **What was wrong:** The 'Hunter Premium' expense shows as $797/mo on the expense card and Home, but the actual transaction is -$812 — a $15/mo gap between the declared amount and what was really paid.
>
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/properties/2def95ea... (HOME) vs Home dashboard. Expected: One amount for 'Hunter Premium'. Actual: Expenses card row + Home 'Where your money goes' both say $797/mo ($9,570/yr), but the property Recent Activity row and the Activity Recurring feed (4 June) both read -$812. Delta $15/mo.. Evidence/run: VR-007.

### MON-070 — Investment account type badge differs between list ('BROKERAGE') and detail ('INVESTMENT ACCOUNT')

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: investments · opened 2026-07-15

> **What was wrong:** Pearler and Stake are labelled 'BROKERAGE' in the accounts list but 'INVESTMENT ACCOUNT' on their own pages — the same account has two different type badges.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/investments/accounts. Expected: Consistent type badge. Actual: Pearler and Stake are badged 'BROKERAGE' on the list tile but 'INVESTMENT ACCOUNT' on their detail pages. The 4 ETF/Crypto accounts stay consistent.. Evidence/run: VR-007.

### MON-071 — Declared income source count disagrees: /cashflow says '1 income source', /dashboard/income lists 21

**🔵 OPEN** · 🟡 medium · changes numbers: **no** · area: income · opened 2026-07-15

> **What was wrong:** The Cashflow page says you have 1 income source; the Income page lists 21. The two pages count 'income source' differently and neither says so. (The 'none received this month' copy is MON-039b's fix landing correctly — the remaining defect is the count.)
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cashflow vs /dashboard/income. Expected: Consistent source count. Actual: /cashflow reads '1 income source - none received this month' while /dashboard/income declares 21 income sources (11 Rental, 9 Other, 1 Salary), 5 of which are declared-only.. Evidence/run: VR-007.

### MON-072 — CFO formatting/copy defects: missing thousands separators, pluralisation, doubled word, risk count mismatch

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-15

> **What was wrong:** The CFO page has several copy defects: '$4374' and '$2589' lack thousands separators, '3 opportunity found' should be plural, 'account account' repeats a word, and the Risk Radar's category counts add to 5 while only 3 risks are shown.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo. Expected: Consistent formatting. Actual: '+$4374/mo' and 'Negative Cashflow: $2589/mo' render without thousands separators while sibling figures use them ($5,141/yr, $9,471/yr). '3 opportunity found' (pluralisation). Risk Radar: 'Your NAB Everyday account account has only $414' (doubled word). Risk Radar counts 1+2+2+0 = 5 but only 3 risks render.. Evidence/run: VR-007.

### MON-073 — What-If salary-sacrifice lever reads a CLOSED financial year's concessional cap (FY25-26)

**🔵 OPEN** · 🟠 high · changes numbers: **yes** · area: super · opened 2026-07-15

> **What was wrong:** The salary-sacrifice What-If is still using last financial year's super cap (FY25-26, which ended 30 June 2026) while the rest of the app uses FY26-27, so its headroom and tax-saving numbers are for a year you can no longer contribute to.
>
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/cfo/what-if/salarySacrificeToSuper (FY selection). Expected: FY 2026-27 (today is 15 July 2026), as used by Super, CFO Tax and Reports. Actual: 'cap read per FY 25-26' and 'Your concessional cap headroom for FY25-26: $7,728'. FY25-26 ended 30 June 2026.. Evidence/run: VR-007.

### MON-074 — Probable duplicate income rows (Ingeus x3, Cienna PM Trust x3) inflating the 'Other' income group

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: income · opened 2026-07-15

> **What was wrong:** Duplicate income rows (like 'Ingeus Australia' three times for one job) inflate your income-source count and the declared gross your tax estimate is built on.
>
> **What changed:** A preview page (Admin → Intake duplicates) lists each duplicate group, which row will be kept, and exactly how the declared annual figure changes. Each group merges only when you type MERGE for it — there is no merge-all, and nothing runs automatically.
>
> **What you should see:** Open Admin → Intake duplicates: you should see the Ingeus group (and any others) with the kept row and the effect. After YOU confirm a merge, the income page shows one row for that source and the linked transactions follow it.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:474`, `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts:91`
- **Neomatrix:** `engine.intake.classifyIntake`
- **Downstream consumers (§19.4):** `income page source list + count (reads the income rows a merge deletes)`, `declared tax gross via incomeAggregator -> getUserTaxPosition (the phantom rows inflate the base)`, `/cashflow + activity declared rollups`, `UnifiedTransaction/Transaction/SuperContribution incomeId links (repointed to the survivor)`, `Expense.derivedFromIncomeId + AgentDisbursementRule (Phase 59 — follow the stream, conflicts surfaced)`
- **Fix PR(s):** ##1459
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-007`

Root-cause anchors are PRE-#1458 lines (the mint sites as diagnosed). Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: /dashboard/income (duplicate source rows). Expected: One row per real source. Actual: 'Salary Ingeus Australia' appears 3x at $1,919/mo (one 'No txns', one $0 actual/1 txn, one $5,547 actual/4 txns). 'Cienna Pm Trust Rent Payment' appears 3x on Thornland Lot 1 ($1,651 / $1,655 / $1,195). All three Ingeus rows are typed 'Other' rather than Salary/Wages, inflating the 'Other' group to $192,698/yr.. Evidence/run: VR-007. [2026-07-19 #1458] Root cause verified = Mechanism A (no reconcile reuse guard for non-rental income + exact-amount doc-import dedup). The GUARDRAIL (#1458) stops new mints; the existing duplicate ROWS this issue tracks are a §12.11 data merge — Part 2 ships a preview-and-confirm tool whose output IS the live row-level census (genuine same-source groups vs distinct same-payer sources, per the Reza correction: Cienna rent vs Ingeus salary are DIFFERENT incomes). No merge runs without Reza’s explicit per-group approval. [Part 2 PR (2026-07-19)] Preview-and-confirm merge tool shipped: lib/intake/duplicateMerge.ts + GET/POST /api/intake/duplicates + /admin/intake-duplicates. Grouping = THE Part-1 signature policy (preview can never propose what the guardrail would not prevent); executeMerge repoints ALL FKs (incl. AgentDisbursementRule w/ conflict surfacing) then deletes, transactionally; POST requires confirm:MERGE + server-side re-derivation (stale → 409). Stays FIXING until Reza approves the live merges + Matrix Ring-3 confirms declared gross + tax moved consistently.

### MON-075 — Source-aware one-off guardrail: standing NeoAudit detector for recurring rows evidenced by a single $0-actuals transaction

**🟢 VERIFIED** · 🟡 medium · changes numbers: **no** · area: income · opened 2026-07-15

> **What was wrong:** Some entries marked 'recurring' are backed by just one bank payment and nothing this month — the fingerprint of the bug that turned one-time deposits into phantom monthly income (the MON-053 class). Nothing was flagging these leftovers for review.
>
> **What changed:** A standing detector now flags every such entry — on both the income and expense lists — with a gentle 'Single payment — one-off?' chip. You review each: genuinely one-time → tick one-off; a real stream whose other payments are just out of view → leave it. Nothing changes by itself.
>
> **What you should see:** On Income and Spending: entries backed by a single payment with $0 this month show the blue 'Single payment — one-off?' chip. Rows with several payments, active rows, and rows already marked one-off show nothing.

- **Root cause:** `components/transactions/TransactionLinkDialog.tsx:1`, `app/api/transactions/[id]/link/route.ts:1`
- **Downstream consumers (§19.4):** `app/api/income GET + app/api/expenses GET → oneOffFingerprint flag per row`, `income page → 'Single payment — one-off?' nudge chip (D2 cadence chip takes precedence when both fire)`, `no number changes — the flag is advisory; totals move only when the user reclassifies a row (MON-053 semantics then apply)`
- **Fix PR(s):** ##1431 (wall Part 3: D1 detector)
- **Holistic test (§19.4):** `tests/intake/detectors.test.ts`
- **Detail:** `neoaudit-run:VR-008`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: lib/tax-engine/position/taxPositionCalculator.ts. Evidence/run: VR-008.

[VR-008 DIAGNOSIS, 2026-07-15 — OWNED BY THE MATRIX] The promote step for the MON-023→037→053 one-off class. Reza decision 2026-07-15: SOURCE-AWARE default (manual/declared = recurring; single-transaction imports = one-off; blanket default-to-one-off REJECTED; backfill migration ABANDONED as unsafe). #1421 already conforms at intake. Remaining build: a standing NeoAudit detector flagging any recurring income/expense row evidenced by exactly ONE linked transaction and $0 in-window actuals (the bug fingerprint) for user review — Ring-1/2 promotion so the Chrome brief never re-checks this class. GATES MON-053 → CLOSED (its promotion evidence).

[D1 SHIPPED — wall Part 3, 2026-07-16] lib/intake/detectors.ts detectOneOffFingerprint (pure): isRecurring !== false ∧ transactionCount === 1 ∧ inWindowActual === 0 → flag; else null. Wired into income GET + expenses GET; income-page chip (sky, review-only; cadence chip wins when both fire). Ring-0: 5 tests (fingerprint + all never-flag guards incl. declared-only rows). This IS the MON-053 promotion step — on merge + Matrix confirmation, MON-075 → VERIFIED and MON-053 → CLOSED (the class is now: prevented at intake by the classifier, locked by R1 in CI, and residuals surfaced by this standing detector). [VR-010 2026-07-17] Ring-3 live verification PASS (tracker VR-010) → VERIFIED.

### MON-076 — Duplicate/fragmented income rows inflate declared gross (Ingeus salary ×3, Cienna rent ×3, Hipcamp ×2)

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: income · opened 2026-07-15

> **What was wrong:** The income list holds multiple rows for what looks like the same income source (three Ingeus salary rows, three Cienna rent rows, two Hipcamp rows). If these are true duplicates rather than deliberate splits, the declared annual income is overstated — the tax estimate and run-rate would be too high. Needs a proper diagnosis before any row is touched.
>
> **What changed:** One shared identity rule at every intake door (transaction link, document import, manual add, onboarding): an income source is (type + normalised name + owner), so reconciliation updates the canonical row instead of minting a sibling. The already-existing duplicate rows get a preview-and-confirm merge tool (Part 2) — nothing merges without your per-group approval.
>
> **What you should see:** New links/imports stop creating duplicate income rows (source count stays stable). Your existing Ingeus ×3 rows are still there until you approve each merge in Part 2.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:413`, `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts:88`, `app/api/income/route.ts:241`
- **Neomatrix:** `engine.intake.classifyIntake`
- **Downstream consumers (§19.4):** `app/api/transactions/[id]/link/route.ts (income + expense create branches)`, `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts (doc-import dedup)`, `app/api/income/route.ts POST (manual add)`, `app/api/onboarding/complete/route.ts (wizard investment income)`, `income page source count + declared tax gross + /cashflow rollups (read the income rows)`
- **Fix PR(s):** ##1458, ##1461
- **Holistic test (§19.4):** `tests/golden/ring2.mechanismA.intakeDedup.test.ts#Mechanism A — the intake-dedup keystone (real link route, create action)`
- **Detail:** `neoaudit-run:VR-008`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: app/dashboard/income/page.tsx. Evidence/run: VR-008.

[STAGE-1 MECHANISM DIAGNOSIS, 2026-07-15 — §19.2 verified at source; population census PENDING (needs live data)]
MECHANISM CENSUS (how duplicate/fragmented income rows come to exist):
(1) transactions/[id]/link income branch — the ONLY dedup guard is MON-009's existingRentalStream (:413-421), scoped to type RENT/RENTAL + propertyId. SALARY/OTHER income has NO guard: each linked deposit the user routes to 'new income' mints a fresh row → the Ingeus ×3 shape. 
(2) doc-import reconcileSuggestedAction INCOME branch (:80-92) — exact amount + exact name + type; misses name variants and amount drift (the same weakness class RC-B fixed for EXPENSES; income branch deliberately left unchanged in #1427). 
(3) manual POST /api/income (:241) — no guard (deliberate user action). 
(4) Cienna rent ×3 on Thornland — the MON-009 guard would catch these TODAY; the three rows likely predate MON-009 (mechanism fixed, data remains) or carry mismatched type/propertyId — VERIFY per-row on live data. 
(5) Hipcamp ×2 ($75, $579) — NOT necessarily duplicates: different amounts, both now classified one-off (VR-008) — plausibly two REAL bookings. The census must judge each group by its linked-transaction evidence, not by name alone.
POPULATION FINGERPRINT (§7 rule — enumerate ALL groups, not the three reported): income rows grouped by (relatedMerchant(name) ∨ sameMerchant(name)) ∧ same scope (propertyId/investmentAccountId or none) — each group with >1 row is a candidate; classify per group: TRUE-DUPLICATE (same stream split) vs REAL-DISTINCT (separate receipts/streams). Requires live data — Matrix/Chrome or an admin query; NOT executable from a Code session.
DECISION FORK FOR REZA (before any fix code — changesNumbers): for a true-duplicate salary/other stream, the fix shape is (A) extend the MON-009 stream-reuse pattern to non-rental income at intake, keyed by the RC-B canonical near-duplicate decision (isNearDuplicateEntry), + user-reviewed merge of existing rows (abandoned-backfill precedent), or (B) keep rows but pool them into one logical stream at read time (bigger, touches every consumer — NOT recommended, violates one-producer simplicity). RECOMMENDATION: (A) intake guard + user-reviewed remediation, mirroring RC-B exactly. Gate: no fix code until Reza picks and the live population census lands. [Mechanism-A keystone PR #1458 (2026-07-19)] The guardrail is BUILT: classifyIntake 'source-signature' policy (identity = kind+type+normalised name+ownerEntityId over user-wide candidates; scope-compatibility rule — same scope or one side scopeless, two differently-scoped rows never converge, the Reza distinct-sources correction enforced structurally). Routed: link-route income create (non-rental → the :831 update template), link-route expense (cross-scope tier), reconcileSuggestedAction (income cross-amount; expense stays amount-bounded), POST /api/income (409 DUPLICATE_INCOME_SOURCE on exact manual dup; rental scope-singleton converges), onboarding complete (idempotent skip). Ratchet: tests/golden/ring2.mechanismA.intakeDedup.test.ts (real route; fails pre-fix) + 6 classifier unit tests. Neomatrix: engine.intake.classifyIntake + law.intake.oneRowPerSource. Existing already-minted duplicates are UNTOUCHED by this PR — Part 2 (preview-and-confirm merge, Reza-gated per group, §12.11) is a separate PR. [Part A PR #1461 (2026-07-20)] Household attribution: listIncomeEarnerEntities (member → INDIVIDUAL entity via householdMemberId; reuses ownerEntityId — no schema change); /api/income + link-route accept validated ownerEntityId; "Who earns this?" in both income forms (client-required for SALARY, >1 earner); getUserTaxPosition emits perMember (same rows partitioned by owner, SAME engine — household roll-up byte-identical). Golden ring2.perMemberTax. Per-person DISPLAY deferred to a §18.2.1 Stitch pass; super owner-split recorded as follow-up.

### MON-077 — 'Potential Missed Deductions' (My Guide) still lists the three investment loans' interest as missed though MON-045 now auto-claims it

**🟡 DIAGNOSED** · 🟡 medium · changes numbers: **no** · area: cfo · opened 2026-07-15

> **What was wrong:** On My Guide, the 'Potential Missed Deductions' panel still suggests you're missing loan-interest deductions for Thornland Lot 1, Thornland Lot 2 and Broadbeach — but since the MON-045 fix that interest is already claimed automatically in your tax position. The panel contradicts the deductions shown right above it. Your tax numbers are correct; only this advisory list is stale.
>
- **Root cause:** `lib/cfo/decisionSupport/taxIntegration.ts:369`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-009`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: lib/cfo/decisionSupport/taxIntegration.ts. Evidence/run: VR-009.

[DIAGNOSIS, 2026-07-15 — §19.2 verified] identifyMissedDeductions (taxIntegration.ts:349) flags 'Loan interest for <property>' when NO expense row with category==='INTEREST' exists for the property (:369-372) — a raw-row heuristic written before MON-045. Post-#1425 the interest is AUTO-CLAIMED into taxPosition.deductions.property from the loans themselves, so the heuristic's premise (interest only enters via logged expense rows) is stale — a §12.2.1-class un-reconciled advisory producer. Fix shape: reconcile against the canonical position (the property's loans are auto-derived → interest is NOT missable; only suggest depreciation/work-related items the position actually lacks). Advisory-only: tax numbers unaffected (changesNumbers false; VR-009 confirmed the math is correct).

### MON-078 — Canonical intake classifier + build-gate intake source-lock (the intake-integrity keystone)

**🟠 FIXING** · 🟠 high · changes numbers: **no** · area: intake · opened 2026-07-16

> **What was wrong:** Every place the app creates an income or expense row decided frequency and recurrence on its own — eight different spots, each with silent defaults (monthly, recurring, new-row). That one gap is the root behind the weekly-rent-stored-monthly, one-off-×12, and duplicate-row bug families.
>
> **What changed:** One canonical intake classifier now makes those decisions for every path, and a build gate fails CI if any code tries to bypass it or sneak in a silent 'monthly'. This first PR is deliberately behaviour-preserving — it builds the door; the next PRs tighten what walks through it.
>
> **What you should see:** Nothing should look different yet — that's the point. Your income/expense lists, Tax page and dashboard should match the VR-009 baseline exactly (aside from rows you've edited yourself). Adding a weekly income stores WEEKLY; linking a single transaction as one-off stays one-off.

- **Root cause:** `app/api/income/route.ts:240`, `app/api/transactions/[id]/link/route.ts:417`, `app/api/documents/analyze/confirm/route.ts:459`
- **Downstream consumers (§19.4):** `app/api/income/route.ts POST — routed (MANUAL), behaviour-preserving`, `app/api/expenses/route.ts POST + expenses/bulk — routed (MANUAL)`, `app/api/transactions/[id]/link — income + expense branches routed (TRANSACTION_LINK), incl. MON-009 rental scope-singleton + RC-B merchant stream policies`, `app/api/documents/analyze/confirm — income + expense routed (DOCUMENT_IMPORT); local frequencyMaps + '|| MONTHLY' literals deleted`, `app/api/onboarding/complete — routed (ONBOARDING)`, `app/api/recurring-payments/[id]/link + lib/bank/recurringExpenseDetection — routed (RECURRING_DETECTION, detected cadence as evidence)`, `allowlisted (reviewed): lib/db/tenant.ts (pass-through, 0 callers), lib/testing/loader.ts (fixtures)`, `no money-number consumer changes — classification outputs identical for valid inputs (pinned by tests/intake/classifyIntake.test.ts)`
- **Fix PR(s):** ##1429 (keystone: classifier + R1 source-lock)
- **Holistic test (§19.4):** `tests/intake/intakeSourceLock.test.ts`
- **Detail:** `spec:docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: lib/intake/classifyIntake.ts.

[KEYSTONE SHIPPED — PR #1429, 2026-07-15, draft] lib/intake/classifyIntake.ts (pure §6.4): frequency = declared(normalised, WEEKLY/FORTNIGHTLY preserved, ANNUALLY→ANNUAL) → detected evidence → MANUAL/ONBOARDING throw → the ONE named LEGACY_FALLBACK_FREQUENCY='MONTHLY' (C1 target). Recurrence = explicit wins → source-default table (manual/onboarding/detection true; link-expense false #1421; link-income + doc-import true, marked LEGACY/C2 targets). streamMatch = 'scope-singleton' (MON-009) | 'merchant' (sameMerchant exact, isNearDuplicateEntry near-dup). R1 ratchet: tests/intake/intakeSourceLock.test.ts — CI census of every prisma.income/expense.create under app/+lib/ (locked producer list + allowlist), import+call required, silent-MONTHLY literal/fallback banned outside the classifier (repaymentFrequency/investmentFrequency exempt — not Income/Expense cadences). Ring-0: tests/intake/classifyIntake.test.ts (15) pins the behaviour-preserving defaults. RC-B source-lock updated to the new topology (route → classifier → isNearDuplicateEntry). DELIBERATE DEVIATION surfaced: PUT/update routes NOT routed (an update is a user edit, not intake — injecting defaults into partial updates is the unsafe class itself). Next: C1 (MON-001) → D1 (MON-075) → C3 (MON-076, gated on Reza) → R3 golden fixtures, each own PR, per spec §6.

### MON-079 — Managed rental income + agent-cost reconciliation (Phase 59)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: rental · opened 2026-07-16

> **What was wrong:** Rent from your agent arrives after their fees are taken out, so Monitrax can't see your real gross rent or claim the agent's fees as deductions.
>
> **What changed:** Mark a rental as "through a property manager" and enter the full rent. When a deposit arrives below it, Monitrax asks one calm question and records the confirmed gap as a tax-deductible agent cost — remembered for next time, re-asked only when a month looks unusual, and itemisable from an uploaded rental statement.
>
> **What you should see:** On the Income page, a rental stream gets a "How the rent arrives" choice. Link a rent deposit to a managed stream: the emerald card shows the math (e.g. $1,300 fortnight rent − $1,100 received = $200 tax-deductible). Confirm it and Total Deductions rises by the annualised gap while gross rental income stays unchanged.

- **Root cause:** `prisma/schema.prisma:1865`
- **Neomatrix:** `number.rental.agentCostDeduction`, `number.rental.grossDeclared`
- **Downstream consumers (§19.4):** `lib/tax-engine/position/taxPositionCalculator.ts:248-272 (Float deductible-expense loop → deductions.property)`, `lib/tax-engine/position/taxPositionCalculator.ts:777-798 (Decimal twin — must never disagree)`, `app/api/tax/position/route.ts:96-181 (maps ALL expense rows, no category filter — derived rows flow)`, `lib/services/masterFinancialService.ts buildTaxSummary (same canonical engine — Tax page + dashboard tax tiles)`, `app/dashboard/income/page.tsx (D4 nudge + MANAGED opt-in; gross display unchanged)`, `components/transactions/TransactionLinkDialog.tsx (the confirm card surface)`
- **Fix PR(s):** ##1434
- **Holistic test (§19.4):** `tests/golden/ring2.managedRental.test.ts#holistic: gross-unchanged + gap-as-deduction + taxable==net-received + no-double-count on BOTH engines; also tests/tax/rentalReconciliationSourceLock.test.ts (R1) + tests/calculations/rentalReconciliation.test.ts (R0)`
- **Detail:** `phase-59`

Feature workstream per docs/blueprint/PHASE_59_MANAGED_RENTAL_INCOME.md. Gross-income integrity + statement-first/reconciliation-fallback + suggest-and-confirm card; applies to Neomatrix/NeoBrain/NeoAudit (D4 detector). Build sequence in the phase doc §9. Modelled 2026-07-16 (engine PR): engine.rentalReconciliation.reconcileManagedRental + number.rental.agentCostDeduction/grossDeclared, verified file:line; R0 calc-audit fixtures (property.managedRentalGap) + R1 source-lock shipped alongside. Parts 0–5 built in PR #1434 (draft — Reza merge gate); Ring-3 (Part 6) = the Matrix after deploy READY. Root cause: the Income model had no rentalMode — a managed rental was inexpressible (net recorded as income = understated gross + dropped deductions, OR gross declared with no way to capture agent costs). RE-SCOPED 2026-07-17 (MATRIX_FIX_DISCIPLINE.md): VR-011 verified the TAX surface only - the cashflow side double-counted the agent fee (raised + fixed as MON-086/Wall B3); cross-surface Ring-3 (income <-> tax <-> cashflow <-> property) NOT yet met - stays FIXING until the Matrix verifies all surfaces on live data. RING-3 VR-013 PASS (2026-07-17): verified on live data by the Matrix — advanced to VERIFIED.

### MON-080 — Phase 59 managed-rental deduction never captured on real data (D0 fresh-link N=1 · D1 order-dependency · D2 gross-integrity)

**🟢 VERIFIED** · 🔴 critical · changes numbers: **yes** · area: income · opened 2026-07-17

> **What was wrong:** Marking your rental as agent-managed didn't actually capture the agent's fees: no card appeared when deposits were already linked, the first fresh deposit compared a weekly rent against a monthly payout (so the gap looked negative), and nothing ever asked for the real rent when the stream held the net amount — so the ~$432/month Broadbeach deduction was never claimed.
>
> **What changed:** The reconciler now infers the payout period from the deposit size on the very first link, marking a stream managed immediately re-checks the deposits you already linked (the card appears right there, and the green nudge chip is now a click-to-claim button), and you can't save a managed rental whose 'rent' equals the deposit — Monitrax asks for the full rent first, pre-filled with what you had.
>
> **What you should see:** On Broadbeach (already managed, already linked): open Income and the card offers the ~$432/month gap without unlinking anything; confirm it and Total Deductions rises by ~$5,184/yr while gross rent stays $2,947/mo. Marking a net-only stream managed now asks for the full rent before saving.

- **Root cause:** `lib/calculations/rentalReconciliation.ts:118`, `app/api/income/[id]/route.ts:126`, `app/dashboard/income/page.tsx:1125`, `app/dashboard/income/page.tsx:1776`
- **Neomatrix:** `number.rental.agentCostDeduction`, `number.rental.grossDeclared`
- **Downstream consumers (§19.4):** `lib/tax-engine/position/taxPositionCalculator.ts (deductible-expense loop → deductions.property, Float + Decimal)`, `app/api/tax/position/route.ts (Total Deductions on the Tax page)`, `lib/services/masterFinancialService.ts buildTaxSummary (dashboard tax tiles + CFO)`, `app/dashboard/income/page.tsx (D4 nudge chip → claim path; gross display)`, `components/transactions/TransactionLinkDialog.tsx (fresh-link card path)`, `app/api/rental-reconciliation/route.ts (confirm producer — idempotency guard)`
- **Fix PR(s):** ##1437
- **Holistic test (§19.4):** `tests/golden/ring2.managedRental.test.ts#order-independence: manage-then-link == link-then-manage; also tests/calculations/rentalReconciliation.test.ts (N=1 Broadbeach cadence inference, Float/Decimal parity) + tests/tax/rentalReconciliationSourceLock.test.ts (R1)`
- **Detail:** `VR-010`

Raised from the Matrix handoff docs/issues/handoffs/HANDOFF_MON-080_managed-rental-retroactive-reconcile.md (PR #1436) + VR-010 live evidence (Broadbeach: $680/wk declared, $2,515/mo net, gap $432/mo ≈ $5,184/yr uncaptured; Total Deductions stuck at $148,519). §19.2 root cause EXECUTED-verified 2026-07-17: N≥2 normalisation works (3 monthly dates → MONTHLY, gap $431.67, material) — the brief's "no normalisation" prime suspect is corrected; the real D0 is the N=1 fallback to the RENT cadence (weekly $680 vs monthly $2,515 → gap −$1,835 → material=false). D1: no retroactive reconcile on the MANAGED transition (PUT), chip is a passive span. D2: no gross gate — MANAGED persists with gross = net (understates assessable income, ITAA s6-5); type-RENTAL streams have no amount field on Edit. Blocks MON-079 → VERIFIED. RE-SCOPED 2026-07-17 (MATRIX_FIX_DISCIPLINE.md): VR-011 verified the TAX surface only - the cashflow side double-counted the agent fee (raised + fixed as MON-086/Wall B3); cross-surface Ring-3 (income <-> tax <-> cashflow <-> property) NOT yet met - stays FIXING until the Matrix verifies all surfaces on live data. RING-3 VR-013 PASS (2026-07-17): verified on live data by the Matrix — advanced to VERIFIED.

### MON-081 — Loan cost reads $0 on non-property surfaces (raw minRepayment instead of the resolved per-loan producer)

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: loans · opened 2026-07-17

> **What was wrong:** An interest-only loan (no repayment amount entered) showed a $0 monthly cost on the Expenses page, cashflow summaries, CFO scenarios and the Home dashboard - even though the property pages correctly showed its interest cost.
>
> **What changed:** The property engine's per-loan cost rule (declared repayment, cadence-normalised, floored to the loan's monthly interest so it is never $0) is now ONE shared producer that all of those surfaces call.
>
> **What you should see:** An interest-only loan shows the same non-zero monthly cost (its interest) on the Expenses page loan row, the cashflow page, CFO scenarios and the property pages - no more $0 anywhere.

- **Root cause:** `app/dashboard/expenses/page.tsx:564`, `app/api/cashflow/summary/route.ts:77`, `app/api/cashflow/intelligence/route.ts:138`, `app/api/cfo/scenarios/run/route.ts:76`, `app/api/portfolio/snapshot/route.ts:684`, `app/api/ai/debt-analysis/route.ts:193`
- **Neomatrix:** `engine.propertyCashflow.resolveLoanMonthlyCost`
- **Downstream consumers (§19.4):** `app/dashboard/expenses/page.tsx (loan rows + committed totals — now resolveLoanMonthlyCost)`, `app/api/cashflow/summary/route.ts + app/api/cashflow/intelligence/route.ts (loan outgoings)`, `app/api/cfo/scenarios/run/route.ts + context/route.ts (scenario baselines)`, `app/api/ai/debt-analysis/route.ts (per-loan cost fed to the advisor)`, `app/api/portfolio/snapshot/route.ts (portfolio loan totals -> Home tiles)`, `lib/calculations/propertyCashflow.ts loan loop (property list/detail/master — delegates to the same producer)`, `REMAINING raw sites tracked ratchet-down in .audit/source-lock-exceptions.json (budget-analysis, calculate/*, transactions/link, loans route, balances, properties pages, plan page)`
- **Fix PR(s):** ##1440, ##1441, ##1442
- **Holistic test (§19.4):** `tests/golden/ring2.calcSsotWall.test.ts#VR-013 describe: Broadbeach 228,000 @ 6.69% + repayments 1,131/1,295 → 1,190.97 actuals not 1,271.10 floor; engine≡standalone identity; trailing-12mo window keeps prior-FY repayments — an FY filter would keep 0`
- **Detail:** `calc-ssot-wall`

Calc-SSOT Wall Mechanism B (docs/architecture/CALC_SSOT_WALL.md) / MATRIX_FIX_DISCIPLINE.md case MON-032 partial-producer drift: the MON-032 fix landed the interest floor on property surfaces only, CREATING divergence with every surface still reading raw minRepayment ($0 for interest-only). rootCause anchors are PRE-FIX lines (2026-07-17). Wall B1 extracts resolveLoanMonthlyCost() from the computePropertyCashflow loan loop and migrates: /dashboard/expenses, cashflow summary + intelligence, CFO scenarios run + context, AI debt-analysis, portfolio snapshot. REMAINING bypass sites (tracked ratchet-down in .audit/source-lock-exceptions.json RAW_MIN_REPAYMENT_COST): budget-analysis/generate, calculate/cashflow, calculate/debt-plan, transactions/[id]/link, loans route, balances page, properties pages, plan page - migrate + ratchet in follow-ups. CROSS-SURFACE RING-3 VR-013 FAIL (2026-07-17): expenses page + loan Overview card showed the $1,271 contractual floor while property/cashflow showed $1,191 actuals — the migrated surfaces called resolveLoanMonthlyCost with NO transactions (same-engine-different-inputs, F2 class). SECONDARY A FOLDED IN: the 'no repayment set' caption + floor fired despite linked repayments because no feed existed (NOT an FY filter in the resolver path — verified; the FY-scoped 'Interest this FY' card is a separate labelled metric and feeds nothing). FIX (same fixPR chain): lib/services/loanCosts.ts — THE transaction feed (linked repayments over the ONE trailing-12-month propertyActualsWindowStart window) → resolveLoanMonthlyCost; /api/loans attaches resolvedCost for client surfaces (expenses page + LoanDetailDialog); cashflow summary/intelligence + CFO run/context + debt-analysis + portfolio snapshot fed server-side. Overview card now headlines the actuals-first monthly with basis label; balance×rate relabelled 'contractual estimate'. Stays FIXING until the Matrix re-runs the cross-surface Ring-3 (Broadbeach identical on all 5 surfaces). RING-3 VR-014 PASS (2026-07-18, the Matrix): Broadbeach loan reads $1,191/mo identically on property detail / expenses row ('from linked repayments') / loan Overview card ('Monthly Loan Cost', balance-x-rate demoted to 'contractual estimate') / portfolio aggregate ($12,779/mo all-loans actuals-first); regression guards intact -> VERIFIED.

### MON-082 — /dashboard/expenses ignores isRecurring - one-off expenses annualised into every run-rate

**🟢 VERIFIED** · 🟠 high · changes numbers: **yes** · area: expenses · opened 2026-07-17

> **What was wrong:** A one-off purchase (like an $11,385 battery) saved with a Monthly frequency was counted as $11,385 EVERY month on the Expenses page - inflating the monthly total to ~$84k and the annual total by $136k.
>
> **What changed:** Every run-rate on the Expenses page (and the cashflow/CFO/portfolio routes) now uses the one canonical run-rate rule: a one-off contributes $0 to monthly/annual run-rates and is shown once, on the date it happened.
>
> **What you should see:** The Expenses page monthly total drops to your real recurring spend; the One-off Spending tile says 'counted once, not monthly'; opening a one-off shows $0/month and the amount once for the year.

- **Root cause:** `app/dashboard/expenses/page.tsx:547`
- **Neomatrix:** `engine.frequencies.monthlyRunRate`
- **Downstream consumers (§19.4):** `app/dashboard/expenses/page.tsx (monthly/annual totals, group sums, tiles, detail dialog — now monthlyRunRate)`, `app/api/cashflow/summary/route.ts + intelligence/route.ts (expense run-rates)`, `app/api/cfo/scenarios/run/route.ts + context/route.ts`, `app/api/ai/debt-analysis/route.ts`, `app/api/portfolio/snapshot/route.ts (totalAnnualExpenses -> annualRunRate)`, `lib/calculations/propertyCashflow.ts + lib/services/masterFinancialService.ts (already gated — identity locked by the ratchet test)`
- **Fix PR(s):** ##1440
- **Holistic test (§19.4):** `tests/golden/ring2.calcSsotWall.test.ts#Wall B2: one-off contributes 0 to monthlyRunRate/annualRunRate; matches the propertyCashflow expense gate`
- **Detail:** `calc-ssot-wall`

Calc-SSOT Wall Mechanism B / MATRIX_FIX_DISCIPLINE.md case MON-037 partial-producer drift: the MON-037 fix gated one-offs in the engines but /dashboard/expenses kept its local convertToMonthly (pure toMonthly, no isRecurring gate - PRE-FIX anchor :547) so the page headline disagreed with property/tax. Wall B2 ships monthlyRunRate()/annualRunRate() in lib/utils/frequencies.ts as THE one-off-aware run-rate and migrates the page + cashflow summary/intelligence + CFO scenarios + AI debt-analysis + portfolio snapshot (totalAnnualExpenses). RING-3 VR-013 PASS (2026-07-17): verified on live data by the Matrix — advanced to VERIFIED.

### MON-083 — A one-off expense still stores/displays a cadence (frequency=MONTHLY) - Mechanism C

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: expenses · opened 2026-07-17

> **What was wrong:** When you unticked 'recurring' on an expense, the form still showed and saved a Frequency (e.g. Monthly) - a nonsense cadence for a one-off that other screens then multiplied by 12.
>
> **What changed:** The Frequency picker now only appears for recurring expenses; a one-off shows 'counted once, on the date it happens' instead, and every calculation treats it as a single occurrence regardless of any stored frequency.
>
> **What you should see:** Untick 'This is a recurring expense' in the Add/Edit Expense form - the Frequency dropdown disappears and is replaced by the one-off note.

- **Root cause:** `app/dashboard/expenses/page.tsx:1654`
- **Neomatrix:** `engine.frequencies.monthlyRunRate`
- **Downstream consumers (§19.4):** `app/dashboard/expenses/page.tsx Add/Edit form (frequency hidden for one-offs)`, `every monthlyRunRate/annualRunRate caller (stored frequency on a one-off is calc-inert)`
- **Fix PR(s):** ##1440
- **Holistic test (§19.4):** `tests/golden/ring2.calcSsotWall.test.ts#Wall B2: stored frequency on a one-off is inert - run-rate is 0 regardless`
- **Detail:** `calc-ssot-wall`

Calc-SSOT Wall Mechanism C (docs/architecture/CALC_SSOT_WALL.md): Reza's battery screenshot - recurring unchecked, Frequency = Monthly. Belt-and-braces with MON-082: the stored frequency is made inert by the monthlyRunRate gate (calculation side) AND the form no longer presents a cadence for one-offs (form side). Existing rows keep their stored frequency (no blind backfill - MON-053 lesson); it is display/calc-inert. VR-013: consumption verified (one-offs counted once) but the FORM check — that unticking recurring stops persisting/presenting frequency=MONTHLY — was NOT yet verified by the Matrix; stays FIXING pending that form check.

### MON-084 — SALARY/OTHER income has no reconcile reuse guard - linking mints duplicate income rows

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: income · opened 2026-07-17

> **What was wrong:** Linking a salary or other (non-rental) deposit always created a NEW income row — 'Ingeus Australia' became three rows for one job, inflating your income-source count and the declared tax gross.
>
> **What changed:** Every link now first checks "do I already have this source?" (same type + same normalised name + same owner) and updates that one row — your prior declared amount is kept as the budget figure.
>
> **What you should see:** After merge: link a new Ingeus deposit — the income page still shows ONE Ingeus salary row (updated, not duplicated) and the source count does not grow. Existing duplicate rows are unchanged until you approve the Part-2 merge.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:453`, `app/api/transactions/[id]/link/route.ts:413`
- **Neomatrix:** `engine.intake.classifyIntake`
- **Downstream consumers (§19.4):** `app/api/transactions/[id]/link/route.ts income create branch (Ingeus-class mints — now updates the one row)`, `income page source list + count (app/dashboard/income)`, `declared tax gross via incomeAggregator → getUserTaxPosition (phantom rows inflated the base)`, `/cashflow + activity income-source rollups`
- **Fix PR(s):** ##1458
- **Holistic test (§19.4):** `tests/golden/ring2.mechanismA.intakeDedup.test.ts#Mechanism A — the intake-dedup keystone (real link route, create action)`
- **Detail:** `calc-ssot-wall`

Calc-SSOT Wall Mechanism A (docs/architecture/CALC_SSOT_WALL.md): the link route's reuse guard fires only for RENT/RENTAL && propertyId (:453-474); everything else mints at :474 with type defaulting to OTHER at :413. Fix route (per the Wall): extend the MON-078 intake classifier with a signature-based upsert (type, normalised name/employer, ownerEntityId) and route the link-route create branch + doc-import income branch through it. Related: MON-074, MON-076, MON-009. [Mechanism-A keystone PR #1458 (2026-07-19)] The guardrail is BUILT: classifyIntake 'source-signature' policy (identity = kind+type+normalised name+ownerEntityId over user-wide candidates; scope-compatibility rule — same scope or one side scopeless, two differently-scoped rows never converge, the Reza distinct-sources correction enforced structurally). Routed: link-route income create (non-rental → the :831 update template), link-route expense (cross-scope tier), reconcileSuggestedAction (income cross-amount; expense stays amount-bounded), POST /api/income (409 DUPLICATE_INCOME_SOURCE on exact manual dup; rental scope-singleton converges), onboarding complete (idempotent skip). Ratchet: tests/golden/ring2.mechanismA.intakeDedup.test.ts (real route; fails pre-fix) + 6 classifier unit tests. Neomatrix: engine.intake.classifyIntake + law.intake.oneRowPerSource. Existing already-minted duplicates are UNTOUCHED by this PR — Part 2 (preview-and-confirm merge, Reza-gated per group, §12.11) is a separate PR.

### MON-085 — Expense near-duplicate detection is scoped by property/loan/asset - cross-scope duplicates never compared

**🟠 FIXING** · 🟡 medium · changes numbers: **yes** · area: expenses · opened 2026-07-17

> **What was wrong:** Duplicate-detection for expenses only compared rows in the SAME scope (same property/loan/asset), so a "Battery" filed on HOME and the same battery filed as General were never compared — one real cost became three rows.
>
> **What changed:** Candidates are now compared across scopes with a safety rule: a scoped row and a General row can converge (same real cost), but two rows on two DIFFERENT properties never do (they are genuinely separate costs).
>
> **What you should see:** After merge: reconciling a battery invoice without picking a property lands on the existing HOME battery row instead of minting a third. QBE insurance on two different properties stays two rows.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:681`, `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts:74`
- **Neomatrix:** `engine.intake.classifyIntake`
- **Downstream consumers (§19.4):** `app/api/transactions/[id]/link/route.ts expense create branch (cross-scope battery class)`, `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts (doc-import expense dedup)`, `spending/expenses surfaces + property expense cards reading expense rows`
- **Fix PR(s):** ##1458
- **Holistic test (§19.4):** `tests/golden/ring2.mechanismA.intakeDedup.test.ts#Mechanism A — the intake-dedup keystone (real link route, create action)`
- **Detail:** `calc-ssot-wall`

Calc-SSOT Wall Mechanism A (docs/architecture/CALC_SSOT_WALL.md): near-dup candidate sets are scoped by propertyId/loanId/assetId (link route :681-689; reconcileSuggestedAction.ts:74-83), and doc-import income dedup is exact amount+name+type (:89-101) so declared vs reconciled twins never match. Related: MON-037 RC-B (battery x3). Fix via the same signature-upsert keystone as MON-084. [Mechanism-A keystone PR #1458 (2026-07-19)] The guardrail is BUILT: classifyIntake 'source-signature' policy (identity = kind+type+normalised name+ownerEntityId over user-wide candidates; scope-compatibility rule — same scope or one side scopeless, two differently-scoped rows never converge, the Reza distinct-sources correction enforced structurally). Routed: link-route income create (non-rental → the :831 update template), link-route expense (cross-scope tier), reconcileSuggestedAction (income cross-amount; expense stays amount-bounded), POST /api/income (409 DUPLICATE_INCOME_SOURCE on exact manual dup; rental scope-singleton converges), onboarding complete (idempotent skip). Ratchet: tests/golden/ring2.mechanismA.intakeDedup.test.ts (real route; fails pre-fix) + 6 classifier unit tests. Neomatrix: engine.intake.classifyIntake + law.intake.oneRowPerSource. Existing already-minted duplicates are UNTOUCHED by this PR — Part 2 (preview-and-confirm merge, Reza-gated per group, §12.11) is a separate PR.

### MON-086 — Managed-rental cashflow double-counts the agent fee (rent read NET, derived fee subtracted again)

**🟢 VERIFIED** · 🔴 critical · changes numbers: **yes** · area: cashflow · opened 2026-07-17

> **What was wrong:** For an agent-managed rental, cashflow read the agent's NET deposits as the rent AND subtracted the confirmed agent-fee expense on top - so the fee was taken out twice and every cashflow surface understated Broadbeach by ~$432/month, while the Tax page (correctly) counted it once.
>
> **What changed:** When a managed stream's rent comes from actual deposits, the cashflow engine adds the recurring confirmed agent fee back to rent - so rent reads GROSS (matching tax), the fee is subtracted exactly once as an expense, and cashflow lands on the net you actually received.
>
> **What you should see:** On Broadbeach: property cashflow shows rent ~$2,947/month gross, expenses include the ~$432 agent fee once, and monthly cashflow ~$2,515 - the same net the agent deposits. Tax and cashflow now tell the same story (gross - fee).

- **Root cause:** `lib/calculations/propertyCashflow.ts:153`
- **Neomatrix:** `engine.propertyCashflow.computePropertyCashflow`, `number.rental.agentCostDeduction`
- **Downstream consumers (§19.4):** `lib/calculations/propertyCashflow.ts computePropertyCashflow (rent gross-up — property list/detail cashflow)`, `lib/services/masterFinancialService.ts adjustPropertyRentalIncome + both cf calls (income breakdown + master tax summary read GROSS)`, `app/api/portfolio/snapshot/route.ts per-property cf maps (Home tiles) — rentalMode/derivedFromIncomeId threaded`, `lib/tax-engine/position/taxPositionCalculator.ts (unchanged — was already correct; identity cf.rent*12 === tax.income.rental locked by the ratchet)`, `app/dashboard/properties/* + riskRadar (full-row callers — flow structurally)`
- **Fix PR(s):** ##1440
- **Holistic test (§19.4):** `tests/golden/ring2.calcSsotWall.test.ts#Wall B3: fee counted exactly once; cf gross === tax gross; taxable === cashflow x 12; DIRECT + declared-driven regression guards; one-off excess excluded`
- **Detail:** `calc-ssot-wall`

Raised per MATRIX_FIX_DISCIPLINE.md 'Immediate consequence' (regression sweep VR-012): Phase 59/MON-080 shipped the tax side correctly but computePropertyCashflow read the NET disbursement as rent actuals (PRE-FIX anchor :153-165, no gross-up) while ALSO subtracting the derived PROPERTY_MANAGEMENT expense. VR-011 verified TAX only - the per-surface Ring-3 gap this law now forbids. Wall B3 fix: gross-up ONLY when rent.usedActuals && rentalMode===MANAGED, recurring derived fees only, per stream; DIRECT and declared-driven streams get no add-back. rentalMode/derivedFromIncomeId threaded through masterFinancialService + portfolio snapshot so the pooled synthetic rent (master tax summary) reads gross too. RING-3 VR-013 PASS (2026-07-17): verified on live data by the Matrix — advanced to VERIFIED.

### MON-087 — Property-context Add Expense dialog crashes — Radix Select.Item empty value

**🟠 FIXING** · 🟠 high · changes numbers: **no** · area: expenses · opened 2026-07-18

> **What was wrong:** Clicking Add Expense from a property page crashed the whole screen to an error page (a form-menu bug), so you could not add a property expense at all.
>
> **What changed:** Every menu's 'no options' row and 'None/All' choices now use a form the menu library allows, and the property-page expense form gained the same recurring/one-off tick-box as the main Expenses page.
>
> **What you should see:** Click 'Add expense' on a property page: the form opens (no error screen). Untick 'This is a recurring expense': the Frequency dropdown is replaced by 'One-off — counted once, on the date it happens', and a saved one-off is counted once, never monthly.

- **Root cause:** `components/ExpenseDialog.tsx:515`
- **Downstream consumers (§19.4):** `components/ExpenseDialog.tsx (the ONE shared dialog — property list page + PropertyExpensesCard on property detail)`, `app/dashboard/expenses/page.tsx + app/dashboard/income/page.tsx + components/transactions/TransactionLinkDialog.tsx (latent same-class placeholders)`, `app/dashboard/admin/audit-logs/page.tsx + app/dashboard/investments/transactions/page.tsx (functional empty-value options -> sentinels)`
- **Fix PR(s):** ##1446
- **Holistic test (§19.4):** `tests/ui/selectItemEmptyValue.test.ts#static scan: zero empty-string SelectItem values in app/ + components/ (the render-crash class)`
- **Detail:** `neoaudit-run:VR-014`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Surface: components/ExpenseDialog.tsx. Evidence/run: VR-014. Class-wide fix in PR #1446: 11 placeholder items -> plain div rows; 4 functional options -> ALL/NONE sentinels; MON-083 recurring control added to the canonical dialog (was absent - a one-off was inexpressible from the property context). Stays FIXING until the Matrix's VR-014 re-run verifies the property-context path renders + one-off persists.

