# Issue Registry (generated — do not hand-edit)

> Generated from `docs/issues/ISSUES.json` by `npm run issues:generate`. Gated by `npm run issues:check`.
> Lifecycle: 🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED. See `docs/issues/README.md`.

**46 total** · 43 open · 🔵 5 · 🟡 2 · 🟠 31 · 🟢 5 · ✅ 2

| ID | Status | Sev | Δ# | Title | Fix | Test |
|---|---|---|---|---|---|---|
| MON-001 | 🟡 DIAGNOSED | 🔴 | yes | Fortnightly rent stored/treated as MONTHLY (rent ~54% off) | — | — |
| MON-002 | 🟠 FIXING | 🟠 | yes | Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift | #1336 | ✅ |
| MON-003 | 🟠 FIXING | 🟠 | yes | DEPRECIATION / YR always $0 (reads a field absent from the model) | #1352 | ✅ |
| MON-004 | ✅ CLOSED | 🟡 | no | Loan repayment missing from the property Cashflow rhythm | #1333 | n/a |
| MON-005 | 🟠 FIXING | 🟡 | no | Expense tile -> global page; no per-property summary card / drill-down | #1358 | ✅ |
| MON-006 | 🟡 DIAGNOSED | 🟢 | yes | Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only) | — | — |
| MON-007 | ✅ CLOSED | 🟡 | no | -$100,912 vs -$46,897 don't add up | #1333 | n/a |
| MON-008 | 🟠 FIXING | 🟡 | no | Expense initial-entry inconsistent (only due-dates on the property edit form) | #1358 | ✅ |
| MON-009 | 🟠 FIXING | 🟠 | yes | Rental (and any linked line) shown per declared frequency, fragmented across records → over-counted; not read from transaction dates | #1337 | ✅ |
| MON-010 | 🟠 FIXING | 🟡 | yes | Tax summary still sums raw (fragmented) rental income records — taxable rental over-counted | #1353 | ✅ |
| MON-011 | 🟠 FIXING | 🟠 | yes | Portfolio equity sums FLOORED per-property equities — overstated by exactly $37,076 | #1347 | ✅ |
| MON-012 | 🟠 FIXING | 🟠 | yes | Balances liquidity buckets fail L3 tie-out by exactly $64,572 (floored equity + credit card + HECS) | #1347 | ✅ |
| MON-013 | 🟠 FIXING | 🔴 | yes | Investment-account CASH ($67,871) excluded from net worth & total assets; Assets TILE includes it — two producers of 'total assets' | #1342 | ✅ |
| MON-014 | 🟠 FIXING | 🟠 | yes | Home per-property tiles show rent-magnitude not cashflow when a loan lacks minRepayment — 3rd non-canonical cashflow producer (portfolio/snapshot) drops loan cost to $0, bypassing #1336/#1337 | #1351 | ✅ |
| MON-015 | 🟠 FIXING | 🟡 | no | Entity-cashflow widget components don't sum to its own total (-$655 gap) + claims '12 entities' when 9 exist + monthly figure mislabelled 'annual' | #1356 | ✅ |
| MON-016 | ❌ RETRACTED | 🟡 | no | Debt-quality Good+Bad buckets omit the Guildford home loan ($377,822 unbucketed; sum != total) | — | n/a |
| MON-017 | 🟢 VERIFIED | 🔴 | yes | Safety Net score is fiction on real data: 'Positive Cashflow 15/15' while cashflow is negative; recovery times uncomputable but shown; 0/0 bills scores 30/30; 3mo vs 6mo target contradiction | #1346, #1359 | ✅ |
| MON-018 | 🟠 FIXING | 🔴 | yes | CFO 'Monthly progress: net worth +2%' is a ×0.98 PLACEHOLDER rendering as a real trend | #1343 | ✅ |
| MON-019 | 🟠 FIXING | 🟠 | yes | 'Save 69 years' = the 999-month payoff SENTINEL leaking into UI arithmetic; refinance recommended on a 104% LVR loan | #1348 | ✅ |
| MON-020 | 🟠 FIXING | 🟠 | yes | Two tax engines disagree ($153,278 vs $104,323 — §12.2.1 duplicate); /cashflow estimate omits Medicare (~$8,319). [CFO deductions-card 'mixes benefit' sub-claim RETRACTED as misread — see notes] | #1349 | ✅ |
| MON-021 | 🟠 FIXING | 🟠 | yes | /cashflow renders actual and declared side-by-side unlabelled (In $0 vs In +$43,736) and two month-end forecasts disagree by $39K | #1354 | ✅ |
| MON-022 | 🟠 FIXING | 🟡 | no | Data-quality validation gaps inflating everything: $11,385/mo 'Battery System' recurring, company ATO tax as household spend, purchase price $0 -> '+0.0%', owner-occupied homes showing rental yield, count drift | #1357 | ✅ |
| MON-023 | 🟠 FIXING | 🟠 | yes | One-off expenses shown as $X/mo (isRecurring ignored) + reconcile duplicates expense records | #1340 | ✅ |
| MON-024 | 🟠 FIXING | 🟠 | yes | "High Discretionary Spending" showed >100% (e.g. 906%) — discretionary/essential on a different base than the recurring total | #1341 | ✅ |
| MON-025 | 🟠 FIXING | 🟠 | yes | Expense frequency defaults MONTHLY (never detected from dates); AI categorisation sets no recurring/frequency; no user frequency confirm; fuzzy-dedup missing | #1345 | ✅ |
| MON-026 | 🟠 FIXING | 🔴 | yes | Depreciation deduction 100× too high — cost×rate omits /100 (rate is a PERCENTAGE) → tax understated | #1352 | ✅ |
| MON-027 | 🟠 FIXING | 🟡 | yes | CFE input builder (buildCFEInput) copy-pasted in two routes and DRIFTED — stress-test forecasts on PRE-tax income + includes transfers | #1355 | ✅ |
| MON-028 | 🟢 VERIFIED | 🟠 | yes | Property DETAIL page shows DECLARED cashflow/yield, not actuals — /api/properties/[id] drops linkedTransactions (drifts from list + Home) | #1359 | ✅ |
| MON-029 | 🟢 VERIFIED | 🟠 | yes | Savings rate has THREE contradictory producers (75.4% CFO / −30.5% Home / 0.0% Home insight) | #1359 | ✅ |
| MON-030 | 🟢 VERIFIED | 🟠 | yes | Health/Safety score differs across three pages (Home 50/C, CFO 46/D, Safety Net 70/100) | #1380, #1381 | ✅ |
| MON-031 | 🟠 FIXING | 🟡 | no | Liquid savings differs: Balances $301,808 vs Safety Net "Liquid savings" $304,304 ($2,496 gap) | #1368 | ✅ |
| MON-032 | 🟠 FIXING | 🟡 | no | Property detail Recent-activity shows loan repayment "-$0" for a real loan (row reads raw minRepayment, not the engine-resolved cost) | #1359 | ✅ |
| MON-033 | 🟠 FIXING | 🟡 | no | Yield shown for an owner-occupied HOME on the Home tile + CFO Low-Yield insight (detail page correctly hides it) | #1359 | ✅ |
| MON-034 | 🟠 FIXING | 🟠 | yes | Reports over-state ANNUAL-frequency income/expenses 12× — duplicate frequency converter missing the ANNUAL enum case (inflates tax deductions + report totals) | #1376 | ✅ |
| MON-035 | 🟠 FIXING | 🟠 | yes | HOME property cashflow: Home dashboard tile disagrees with detail/list (delta 6040/yr) | ##1396 | ✅ |
| MON-036 | 🟠 FIXING | 🟠 | yes | HOME rental yield reads three different values across surfaces (0.12 / 0.9 / 1.05) | ##1397 | ✅ |
| MON-037 | 🟠 FIXING | 🔴 | yes | One-off expenses shown as recurring MONTHLY (+ apparent Battery duplicate) inflating expenses/cashflow | ##1395 | ✅ |
| MON-038 | 🟠 FIXING | 🟠 | no | CFO offers a refinance on a 104pct LVR loan (should be gated over 100pct) | ##1399 | ✅ |
| MON-039 | 🔵 OPEN | 🟢 | no | Minor display: Medicare levy not shown; /cashflow Money In 0 vs 1-source note; Guildford list tile omits cashflow/yr | — | n/a |
| MON-040 | 🟢 VERIFIED | 🟡 | yes | Tax optimisation recommendations show implausible values (save 3685pct, 6.27M potential savings) | ##1398 | ✅ |
| MON-041 | 🔵 OPEN | 🟢 | no | Vehicle depreciation percentage shown outside 0-100 (appreciation rendered as negative depreciation) | — | n/a |
| MON-042 | 🔵 OPEN | 🟢 | no | Household vehicle count (4) disagrees with the Assets list (5 vehicles) | — | n/a |
| MON-043 | 🔵 OPEN | 🟡 | yes | Annual income differs across Home / Activity / Tax surfaces (basis inconsistency to reconcile) | — | — |
| MON-044 | 🟠 FIXING | 🟢 | no | Loan Opportunities card links to /dashboard/debt which 404s | ##PENDING | ✅ |
| MON-045 | 🔵 OPEN | 🟡 | yes | CFO neg-gearing benefit ($157,746) ~4x total deductions ($39,554) — internally inconsistent | — | — |
| MON-046 | 🟠 FIXING | 🟢 | no | Bare /dashboard/investments 404s (CFO tile + DocumentList + sidebar nav) | ##PENDING | ✅ |

---

### MON-001 — Fortnightly rent stored/treated as MONTHLY (rent ~54% off)

**🟡 DIAGNOSED** · 🔴 critical · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** Rent you receive fortnightly was being recorded as if it were monthly, so the property's annual rent — and everything built on it — was wrong.
>
> **What changed:** (planned) Drive the property's rent from your actual reconciled rent transactions so the real fortnightly cadence is used, and let you set/correct the frequency where you reconcile.
>
> **What you should see:** (after fix) On the property, Annual rent should match your real rent (roughly your fortnightly amount × 26), not × 12.

- **Root cause:** `app/api/transactions/[id]/link/route.ts:318`, `app/api/transactions/[id]/link/route.ts:156`, `app/dashboard/properties/[id]/page.tsx:141`
- **Neomatrix:** `engine.incomeAggregator.aggregateIncome`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-1`

Reconcile write paths never persist the detected cadence; property page annualises the stored MONTHLY frequency. Subsumed by MON-002 (actuals-first). Full downstream sweep (§19.4) to be completed at fix time. Folded into MON-002: the shared engine uses monthlyAverageActual (a true monthly average from the reconciled fortnightly cadence) so fortnightly rent annualises at ×26 not ×12. Advances to VERIFIED with MON-002 once Reza confirms on his data.

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

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

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

New in-app section-level composition -> Stitch-first (§18.2.1).

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

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

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

Follows the same manual-initial -> actuals-when-reconciled rule (MON-002). (Earlier 'P-8 manual repayment not capturable' was RETRACTED — the Minimum Repayment field exists at LoanFormDialog:531.)

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

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: dashboard · opened 2026-07-07

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

VALIDATED 2026-07-07 — CONFIRMED-REAL but DISPLAY/LABEL only (changesNumbers=false). Anchor CORRECTED: the widget is GlassEntityCashflow (components/dashboard/tiles/GlassInsightTiles.tsx:268-300), fed by calculateEntityCashflow (components/dashboard/EntityCashflowSummary.tsx:588-815) — NOT buildEntityBreakdown (entityBreakdown.ts:86 feeds the reports byEntity view, a different engine). Three real display defects: (1) additivity — headline total = summary.totalEntityCashflow (EntityCashflowSummary.tsx:795) sums 6 components (income/properties/investments/standaloneLoans/assets/expenses) but the widget shows only 4 rows (GlassInsightTiles.tsx:270-275), so standaloneLoansCost + assetsNet are in the total but never displayed -> the -$655 gap; the total itself is arithmetically correct. (2) count — GlassInsightTiles.tsx:299 labels 'N entities' from data.properties.length + data.investments.length (3 properties + 9 investment accounts = '12'), mislabelling asset counts as legal entities (universe = 9). (3) a MONTHLY figure is labelled 'annual net' (:299) though every component is monthly (sibling EntityCashflowSummary.tsx:244 correctly labels '/mo'). Fix is display+label: show all 6 rows (or fold the 2 hidden into a row), count from the entity source, correct the annual/monthly label. Unmodelled dashboard-widget surface (§21.5). [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-10): 9 entities vs across 12 entities reproduced (widget counts assets as entities).

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

**🟠 FIXING** · 🔴 critical · changes numbers: **yes** · area: cfo · opened 2026-07-07

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

Neomatrix already flags the ×0.98 placeholder. Anchor verification 2026-07-07 (§19.2): the placeholder is lastMonthNetWorth = currentNetWorth * 0.98 at lib/cfo/intelligenceEngine.ts:176 (inside calculateMonthlyProgress; netWorthChange :177, percent :178) — NOT :377, which the proposal cited but is the Decimal sibling calculateMonthlyProgressNetWorthDecimal whose own JSDoc (:374) points AT this ×0.98 placeholder. Canonical replacement: netWorthHistory.getNetWorthHistory over stored NetWorthSnapshot. Savings rate -39.1% on the same card disagrees with the -30.5% KPI — include in the downstream sweep. VALIDATED 2026-07-07 CONFIRMED-REAL: algebra proves (currentNetWorth - 0.98·currentNetWorth)/(0.98·currentNetWorth)×100 = +2.0408% for EVERY user regardless of data (:176-180); rendered at app/dashboard/cfo/page.tsx:1107. Canonical history exists + is unused (lib/calculations/netWorthHistory.ts getNetWorthHistory + NetWorthSnapshot + netWorthSnapshotRecorder.ts). Same file carries MORE placeholders: savingsRateChange: 0.5 // Simulated, debtReduction = totalDebt * 0.005 // Assume. Savings-rate discrepancy = §12.2.1 duplicate: :183-191 re-derives from DECLARED raw prisma rows vs the KPI's qm.savingsRate (masterFinancialService.ts:2056, net/actuals-aware). calculateMonthlyProgress is UNMODELLED (§21.5). Fix: feed monthly progress from netWorthHistory; delete the placeholders. FIX SHIPPED (PR #1343, FIXING — pending Reza data-verify): calculateMonthlyProgress (now intelligenceEngine.ts:117) reads getNetWorthHistory(userId,2) for net-worth Δ + debt reduction (same canonical reader as the Home trend tile → converge) + snapshot.quickMetrics.savingsRate for the KPI-matching savings rate; savingsRateChange → null (UI hides sub-line); removed the ×0.98/0.5/0.005 placeholders + inline net-worth calc + 5 dead record types. Neomatrix: new ui.cfo.monthlyProgress node (semanticKey netWorthTrend, A3 convergence with ui.dashboard.netWorthTrendTile) + edge from number.netWorthTrendDelta; neomatrix:check green. Holistic guard tests/cfo/monthlyProgressCanonical.test.ts. Builds on MON-013 (net worth correct at source). [2026-07-10 Chrome audit] Touches AUDIT-02 (CFO savings-rate 75.4% vs 0/100 collision) — part of the savings-rate multi-producer family; #1343 merged/present at HEAD.

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
- **Fix PR(s):** #1349
- **Holistic test (§19.4):** `tests/tax/userTaxPositionConvergence.test.ts`
- **Detail:** `chat audit 2026-07-07 #10`

Sequence after MON-009/MON-010 (rental over-count feeds tax). §12.14 applies. Anchor verification 2026-07-07 (§19.2): the /cashflow estimate is estimatedTax = calculateIncomeTax(taxableIncome).taxPayable at app/api/cashflow/intelligence/route.ts:457 — income tax only, no Medicare levy added (the ~$8,319 gap); this is a SECOND tax producer parallel to the master tax position (§12.2.1 duplicate). calculateNegativeGearingBenefit at lib/cfo/decisionSupport/taxIntegration.ts:293 returns a tax BENEFIT ($ saved) that the CFO deductions card mixes into DEDUCTIONS ($ off income) and lets the lines exceed the stated total. Fix routes every surface through the master tax position and separates benefit from deduction. VALIDATED 2026-07-07 — core CONFIRMED-REAL, sub-claim (c) MISREAD: (a) Medicare omission CONFIRMED — calculateIncomeTax (lib/tax-engine/core/incomeTaxCalculator.ts:104) returns brackets-only taxPayable, NO levy; the CFO path uses taxPositionCalculator.ts:242 grossTax = incomeTaxResult.taxPayable + medicareResult.total (+levy). (b) Two engines CONFIRMED (§12.2.1): /cashflow route.ts:429-457 (ad-hoc deductible set + income tax only) vs CFO taxIntegration.ts:192 calculateTaxPosition (full deductions + Medicare + offsets); direction is diagnostic — /cashflow is HIGHER despite dropping the levy because its ad-hoc deductions are far smaller than the CFO's full deductions, so the dominant driver is the DEDUCTION GAP, Medicare a secondary opposite-direction term. (c) RETRACTED — the deductions card (cfo/page.tsx:849-877) shows 'Total Deductions' = deductionsSummary.totalDeductions; the neg-gearing BENEFIT is a SEPARATE, correctly-labelled Key-Metrics block (keyTaxMetrics.negativeGearingBenefit); NO code sums Property+Benefit — the '$325,767 exceeds total' is user cross-group mental arithmetic, not a code inconsistency. Only residual: designer/psychology proximity (benefit line sits near the deduction pills). Fix scope = (a)+(b): route every tax surface through the master tax position (incl. Medicare). §12.14 applies. FIX SHIPPED 2026-07-10 (PR pending): extracted lib/tax-engine/position/userTaxPosition.ts getUserTaxPosition(userId) — the ONE user-level tax source (fetch once + assemble + calculateTaxPosition, Medicare + full deductions + offsets). /cashflow buildTaxOptimization now reads taxPosition.tax.netTax (was calculateIncomeTax(gross−adHoc).taxPayable — income-tax-only); My Guide (taxIntegration.calculateCFOTaxInsights) reads the same getUserTaxPosition (removed its inline fetch/assemble/calculateTaxPosition). Both converge by construction. §12.14: getUserTaxPosition adds NO tax math — delegates to the reform-aware calculateTaxPosition (FW-1/FW-2 inherited). §19.2 (traced to source): grossTax = taxOnIncome + medicare.total (taxPositionCalculator:242); netTax = grossTax − offsets — so netTax includes the Medicare /cashflow dropped. Neomatrix: modelled orchestrator service.tax.getUserTaxPosition; repointed number.cashflowIntelligence.estimatedTax (formula → getUserTaxPosition().taxPosition.tax.netTax, semanticKey taxPayable → A3 convergence with number.taxPayable); re-pinned 2 taxIntegration anchors; neomatrix:check green (A3 converges, binding 158/158). §12.1: removed calculateIncomeTax import (/cashflow) + prisma import + inline fetch/assemble (taxIntegration). Test tests/tax/userTaxPositionConvergence.test.ts (Medicare-inclusion worked example + both-surfaces-read-one-source lock). §20.4 10/10. Sub-claim (c) already RETRACTED (deductions card correctly separate). Local tsc/vitest unavailable — types/tests are CI-verified. [2026-07-10 Chrome audit] AUDIT-01 (two tax estimates $153,278 /cashflow vs -$42,721 CFO) RE-CONFIRMED REAL and independently re-verified to source this session (incomeTaxCalculator returns bracket tax with NO Medicare; /cashflow route.ts:457 used calculateIncomeTax(...).taxPayable — 2nd producer, Medicare omitted). NOW FIXED by #1349 (merged 2026-07-10, AFTER the audit ran) — both surfaces read getUserTaxPosition, Medicare-inclusive + converged. The audit observed the pre-#1349 prod state.

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

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: data-quality · opened 2026-07-07

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

Product/validation gap (no single code defect): rootCause deliberately left EMPTY — these are missing input-validation + review affordances, not a wrong line (§19.2 never guess an anchor). Freedom hero's -$20,590/mo net-passive matches no visible combination of property cashflows — anchor its inputs during the sweep. '3 producing income' label vs on-screen signs also here. Fix is Stitch-first for any new review surface (§18.2.1). VALIDATED 2026-07-07 — split into TWO REAL display bugs (now anchored) + DATA/PRODUCT-GAP items: (i) owner-occupied HOME shows a rental yield — the tile correctly gates yield behind isInvestment (PropertyTile.tsx:396) but the DETAIL page renders MiniKpi 'Yield' gated only by !isRental (app/dashboard/properties/[id]/page.tsx:443/447), so a PRIMARY RESIDENCE shows 'Yield 0.00%'; fix = gate on isInvestment to match the tile. (ii) $0 purchase -> '+0.0% gain' — the claimed divide-by-zero is a MISREAD (all gain% producers guard purchasePrice>0: masterFinancialService.ts:1211, properties/page.tsx:447, [id]/page.tsx:163), BUT PropertyTile.tsx:343-350 renders the gain% + green TrendingUp UNCONDITIONALLY, so a $0-purchase property shows a fabricated '+0.0%'; the detail page correctly suppresses (page.tsx:432, gainPct!==0); fix = suppress on tile when purchase unknown. changesNumbers=false (both are render suppressions). The battery $11,385/mo, company ATO-as-household-spend, and count drift (26 vs 24 / 9 vs 12) are DATA-ENTRY + missing-validation product gaps (not code defects) — the company-ATO one MAY be a real entity-scoping aggregation bug and needs its own investigation. gain%/yield are UNMODELLED (§21.5) — model when fixing. [2026-07-10 Chrome audit] RE-CONFIRMED (AUDIT-09: yield on primary residence + +0.0% on $0 purchase — both display bugs anchored here; AUDIT-11: battery $11,385/mo one-off-as-recurring data-quality). AUDIT-10 sub-claims (YOU $4.6M vs Home $2.6M; 26 vs 20 holdings) NOT yet traced to source. | 2026-07-11 FIXED the two confirmed display bugs (yield-on-HOME → gated on isInvestment to match the tile; +0.0%-on-$0-purchase tile → gated on purchasePrice>0 to match the detail page). Test tests/dashboard/propertyDisplayGuards.test.ts. DIAGNOSIS of the data-entry items (NOT fixed — product decisions, surfaced to Reza): (a) company-ATO-as-household-spend is a real SCOPING consideration but not a clear code defect — masterFinancialService aggregates ALL expenses across ALL entities by design (masterFinancialService.ts:132 "all expenses, no filter"; the entity breakdown partitions by ownerEntityId at :301, and expenseAggregator SUPPORTS an ownerEntityId filter at :89-91). Whether "personal/household" surfaces should exclude company-entity expenses is a PRODUCT decision (does "my spending" include my company's ATO?) + would need threading an ownerEntityId scope through the personal-scoped surfaces. (b) battery $11,385/mo one-off-as-recurring + count-drift need a VALIDATION + REVIEW surface (Stitch-first §18.2.1) — deferred with MON-005/008. gainPct/yieldPct semantic Neomatrix nodes: N4 backfill (numbers unchanged — display suppression only).

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
> **What changed:** Kept both figures (they measure different things) and made Balances say its number is your cash after credit cards.
>
> **What you should see:** On the Balances "Where your wealth is" tile, the line under "Liquid today" now reads "Reachable today, after your credit cards." — so the $2,496 difference from My Safety Net is self-explanatory. No number changed.

- **Root cause:** `lib/calculations/accessibilityBuckets.ts:87`, `lib/services/masterFinancialService.ts:1993`
- **Downstream consumers (§19.4):** `components/balances/HiddenWealthLens.tsx (the only surface that renders liquidToday with this label)`
- **Fix PR(s):** #1368
- **Holistic test (§19.4):** `tests/balances/hiddenWealthLensCopy.test.ts`
- **Detail:** `docs/verification/runs/VR-001.md`

VR-001. Verified: NOT a math bug — Safety Net shows GROSS liquid-account balances (quickMetrics.liquidCash, correct for emergency-fund months), Balances shows liquid NET of credit cards (accessibilityBuckets liquidToday = liquidBasis − creditCards, correct for the net-worth tie-out). The $2,496 gap IS the credit-card balance (documented in accessibilityBuckets.ts:13-14). Fix = disambiguate the labels (Balances → "Spendable today (after credit cards)"); product-copy PR. RESOLVED per Reza decision 2026-07-12 option (a): relabel, not collapse — changesNumbers flipped to false (copy-only). Balances liquid micro-copy now cards-aware. Awaiting Reza real-data confirm to move to VERIFIED.

### MON-032 — Property detail Recent-activity shows loan repayment "-$0" for a real loan (row reads raw minRepayment, not the engine-resolved cost)

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: cross-surface · opened 2026-07-11

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

Found by real-data verification run VR-001 (2026-07-11). Root-cause investigation in progress — fix must REMOVE the culprit producer (CLAUDE.md §23.2.1), never patch on top.

### MON-033 — Yield shown for an owner-occupied HOME on the Home tile + CFO Low-Yield insight (detail page correctly hides it)

**🟠 FIXING** · 🟡 medium · changes numbers: **no** · area: cross-surface · opened 2026-07-11

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

Found by real-data verification run VR-001 (2026-07-11). Root-cause investigation in progress — fix must REMOVE the culprit producer (CLAUDE.md §23.2.1), never patch on top.

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

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-14

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

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: Home dashboard tile (HOME property cashflow). Expected: -321280/yr == detail/list. Actual: home tile -26270/mo => -315240/yr (delta 6040). Evidence/run: VR-002. | [FIX 2026-07-14] DECISION 2 = trailing-12-month. Root cause: computePropertyCashflow (one engine) fed THREE windows — all-time (detail/list via enrichPropertiesWithActuals) vs 12-month (Home/master). Fix: ONE window source lib/calculations/propertyActualsWindow.ts referenced by all three fetch sites (added the window to enrich — the bug site; master/snapshot already 12-month, now reference the constant). Ratchet: tests/calculations/mon035PropertyActualsWindow.test.ts (unit + source-lock: all 3 sites use the one window, no inline -12 remains). Neomatrix 3 anchors re-pinned + new file allowlisted (graphify offline, self-prunes). Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 FAIL: detail == list (-$8,668/yr) now agree, but the Home dashboard TILE still diverges (-$219/mo = -$2,628/yr) by the SAME ~$6,040/yr gap. HOME-SPECIFIC: Guildford tile (-$616/mo=-$7,392) ~matches its detail (-$7,387). Both paths use computePropertyCashflow on a 12-month window in code, so the divergence is a runtime input difference on HOME (loan w/o minRepayment + one-offs + >12mo txns) between portfolio/snapshot's per-property block and the property-detail path (F2: same engine, different inputs). RE-DIAGNOSE Stage 1 via a golden HOME-like fixture that reproduces it. Stays FIXING. | [NARROWED 2026-07-14] VR-004 cross-check: HOME tile yield 0.9% > detail 0.12% AND tile cashflow -$219/mo is LESS negative than detail -$722/mo. BOTH point the SAME way — the Home tile (portfolio/snapshot per-property block) computes MORE RENT for HOME than the property-detail path (more rent → higher yield AND less-negative cashflow). Same computePropertyCashflow engine + 12-month window, so the divergence is the INCOME/rental-transaction SET reaching the engine, not the window: portfolio/snapshot uses income.filter(propertyId===p.id)+global linkedTxns filtered; detail uses enrichPropertiesWithActuals (property's income relation + txns by its income/expense/loan ids). HOME-specific → a rental income record or txn included in one path's set but not the other. NEXT (not a guess-fix): build a golden HOME-like property (owner-occupied w/ a stray rental income record + rental txns + loan w/o minRepayment) that REPRODUCES the tile-vs-detail rent divergence in a Ring-2 test, fix the input set at source, and repoint the parity resolver off the shared-source false-green. | [RING-2 REPRODUCTION 2026-07-14] Built tests/golden/ring2.homePropertyParity.test.ts — runs the THREE real producers (portfolio/snapshot Home tile, /api/properties/[id] detail route + engine, master service) on a HOME shape engineered with the exact VR-004 vectors: stray RENTAL income on an owner-occupied property, a $503/mo ONE-OFF expense (isRecurring:false), a loan with NO minRepayment (interest floor), on BOTH declared AND actuals (transaction-backed) bases. RESULT: all three producers are BYTE-PARITY (cashflow AND yield), and all correctly EXCLUDE the one-off. This REFUTES the earlier "Home tile computes more rent" hypothesis — given identical rows the producers do NOT diverge. Root cause of the VR-004 FAIL is therefore DEPLOY-SKEW: the Chrome review ran mid-merge while MON-035 (window) + MON-037 (one-off exclusion) were landing across separate PRs, so the Home tile and detail page were served by different deploy generations at capture time. On the current single unified deploy they run the same code -> parity. Holistic test attached (the §19.4 cross-surface propagation lock + permanent HOME-shape NeoAudit coverage). Stays FIXING pending a Ring-3 re-check on the unified deploy (§23.2.3) to confirm the LIVE numbers agree before VERIFIED — no over-claim (§22.2.4).

### MON-036 — HOME rental yield reads three different values across surfaces (0.12 / 0.9 / 1.05)

**🟠 FIXING** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-14

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

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: HOME detail/list vs Home tile vs CFO Risk Radar. Expected: same yield on every surface. Actual: 0.12pct detail/list, 0.9pct home tile, 1.05pct CFO risk radar. Evidence/run: VR-002. | [2026-07-14] The MON-035 window fix converges detail/list vs Home YIELD (0.12 vs 0.9 — yield derives from the window-based annualRent). REMAINING third value (CFO Risk Radar 1.05%) is riskRadar.ts:393 computing yield from DECLARED income (a separate producer, bypassing the engine) — the focused MON-036 fix (repoint to canonical), next PR. | [FIX 2026-07-14] Removed the 4th rogue yield producer: detectPropertyUnderperformanceRisks computed grossYield = annualIncome/currentValue from DECLARED income (riskRadar.ts), bypassing the engine. Now enrichPropertiesWithActuals (ONE 12-month window, MON-035) + computePropertyCashflow + calculateRentalYield — the SAME source as detail/list/Home. Cash-flow-negative flag now uses cf.annualCashflow (canonical). Ratchet source-lock: tests/cfo/mon036RiskRadarYield.test.ts. Neomatrix calculateSummary anchor re-pinned 601->621. Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 PARTIAL: detail 0.12% == list 0.12% == CFO Risk Radar 0.12% (was 1.05% on the radar) — the rogue declared-yield producer is FIXED. BUT the Home dashboard property TILE still shows 0.9% for HOME (rides on the MON-035 home-tile divergence — the tile's portfolio/snapshot cf.annualRent differs from detail for HOME). Stays FIXING until the MON-035 home-tile producer is fixed. | [RING-2 REPRODUCTION 2026-07-14] The same tests/golden/ring2.homePropertyParity.test.ts asserts rental-YIELD parity across Home tile / detail / master for every property (yield derives from the same engine annualRent). All producers byte-parity. The VR-004 residual (Home tile 0.9% for HOME) rode on the MON-035 home-tile figure, which the reproduction proves is parity-correct in current code -> the divergence was deploy-skew, not a rogue producer. Stays FIXING pending the Ring-3 re-check on the unified deploy (shared with MON-035).

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
- **Fix PR(s):** ##1395
- **Holistic test (§19.4):** `tests/calculations/mon037OneOffEngines.test.ts`
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: HOME / Thornland Lot 1 / Guildford expense lists. Expected: one-off items not recurring per-month; no duplicate battery. Actual: Battery/Battery System/Battery Replacement on HOME incl ESTIMATE+ACTUAL both 136620/yr; CJM and Bankwest subdivision fees on Thornland Lot 1; Painting Home on Guildford all tagged MONTHLY. Evidence/run: VR-002. | [FIX 2026-07-14] RC-A resolved: added an isRecurring gate to the two engines the general MON-023 fix never reached — propertyCashflow.ts:172 excludes one-offs from the run-rate; taxPositionCalculator.ts:195/688 count a one-off once (not ×frequency). Threaded isRecurring through ALL 9 producers/callers (§19.4) + entity Prisma selects. aggregateExpenses deliberately NOT gated (master relies on it for its separate all/recurring/nonRecurring computation — gating would zero nonRecurring). Ratchet Ring-0 + source-lock: tests/calculations/mon037OneOffEngines.test.ts. Neomatrix anchors re-pinned (masterFinancialService 1822→1823, taxPositionCalculator 92→101, propertyCashflow 130→137). RC-B (reconcile duplicate) + RC-C (frequency detection) scoped as follow-ups. Advances to FIXING with the PR number. | [VR-004 2026-07-14] Ring-3 PARTIAL: tax deductions dropped $367,440->$39,554 (the ×12 inflation is GONE from the tax number) AND the property Cashflow/yr totals recalculated. BUT a UI regression: the Expenses CARD still LISTS raw one-off rows (labelled MONTHLY) while the card TOTAL now excludes them -> '$0 total over non-zero rows' (Thornland/Guildford) and HOME total != sum of rows. The card renders raw property.expenses, not cf.expenseLines. FIX: render cf.expenseLines (recurring only) + surface one-offs distinctly (not a MONTHLY recurring row). Duplicate Battery persists = RC-B (reconcile dedup follow-up, scoped out of RC-A). Stays FIXING; add a Ring-2 card-reconciliation test. | [CARD FIX 2026-07-14] Addressed the VR-004 UI regression: PropertyExpensesCard now renders ONLY recurring rows (expenses.filter(isRecurring !== false).map) so Σ rows === the shown total (was rendering raw one-off rows under a total that excluded them → '$0 total over non-zero rows'). One-offs surfaced as a footnote ('+ N one-off costs, shown in Spending'). Ratchet: reconciliation invariant added to tests/dashboard/propertyExpensesCard.test.ts. STILL FIXING: (a) RC-B duplicate Battery (reconcile dedup, separate follow-up), (b) awaiting Chrome re-verify.

### MON-038 — CFO offers a refinance on a 104pct LVR loan (should be gated over 100pct)

**🟠 FIXING** · 🟠 high · changes numbers: **no** · area: cfo · opened 2026-07-14

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

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: CFO Loan Opportunities. Expected: no refinance offer on a loan over 100pct LVR. Actual: High LVR 104pct Bankwest 9471/yr refinance offered on Thornland Lot 1. Evidence/run: VR-002. | [FIX 2026-07-14] Root cause = a §12.2.1 duplicate-producer miss: MON-019 gated calculateRefinanceOpportunities but NOT generateRateAlerts' rate_above_market branch (loanDecisionSupport.ts), which still set action='Consider refinancing' with no LVR gate. Fix: extracted ONE isRefinanceableLvr(loan, properties) helper for the >MAX_REFINANCE_LVR rule, called by BOTH producers; over the ceiling the alert reframes to 'reduce your LVR first'. changesNumbers=false — the alert's impact $ is unchanged; only the advice text is gated (the opportunity was already suppressed by MON-019). Ratchet: cross-producer invariant in tests/cfo/loanDecisionSupportGuards.test.ts (no refinance advice >LVR ceiling from ANY producer + a healthy-LVR control). Neomatrix 3 loanDecisionSupport anchors re-pinned. Advances to FIXING with PR#. | [VR-004 2026-07-14] Ring-3 MOSTLY-PASS: the 104% Bankwest line shows 'High LVR: 104%' with NO 'Consider refinancing' text (the action gate works). BUT it sits under a 'Refinance Savings — $5,141/yr — 3 opportunities' card header, and the drill-down /dashboard/debt returns 404 so the per-loan action couldn't be fully confirmed. TODO: confirm the '3 opportunities' count EXCLUDES the 104% loan (worthRefinancing=false) + fix the /dashboard/debt 404 dead link. Stays FIXING. | [2026-07-14] VR-004 count concern RESOLVED in code: the tile’s "N opportunity found" count = refinanceOpportunities.filter(worthRefinancing).length, and the 104% loan is gated to worthRefinancing:false — so it is EXCLUDED from the count (locked by tests/cfo/loanDecisionSupportGuards.test.ts). The 404 that blocked the drill-down confirmation is fixed by MON-044. Remaining: a live Chrome click-through of the real loan action text (VR-005).

### MON-039 — Minor display: Medicare levy not shown; /cashflow Money In 0 vs 1-source note; Guildford list tile omits cashflow/yr

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: display · opened 2026-07-14

> **What was wrong:** A few small display inconsistencies: the tax estimate does not show the Medicare levy line, the cashflow page says 0 in but 1 source fed, and one property tile is missing its cashflow line.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-002`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes display. Surface: tax cards / cashflow page / Properties list tile. Expected: Medicare shown; consistent Money In labelling; list tile shows cashflow/yr. Actual: Medicare absent on both tax cards; Money In 0 but text says 1 income source fed; Guildford list tile has no cashflow/yr line. Evidence/run: VR-002.

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

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: assets · opened 2026-07-14

> **What was wrong:** Cars that went UP in value show a weird 'depreciation -200%' instead of an appreciation figure.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes edge-case. Surface: app/dashboard/assets (vehicle dialogs). Expected: a percentage in a sane range with the right label (appreciation vs depreciation). Actual: 300Z shows depreciation -200.0pct and Landcruiser -66.7pct — an appreciating asset is labelled as negative depreciation. Evidence/run: VR-003.

### MON-042 — Household vehicle count (4) disagrees with the Assets list (5 vehicles)

**🔵 OPEN** · 🟢 low · changes numbers: **no** · area: household · opened 2026-07-14

> **What was wrong:** Your household summary says 4 vehicles but the Assets page lists 5.
>
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: app/dashboard household profile vs assets list. Expected: same vehicle count on both. Actual: Household profile says 4 vehicles; Assets lists 5 (Excavator, 300Z, Ford Ranger, VW Golf, Landcruiser). Evidence/run: VR-003.

### MON-043 — Annual income differs across Home / Activity / Tax surfaces (basis inconsistency to reconcile)

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: income · opened 2026-07-14

> **What was wrong:** Your annual income shows as three different numbers depending on the page (Home vs Activity vs Tax) with nothing explaining why.
>
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-003`

Auto-raised by issues:raise (NeoAudit finding bus, §3.1). Node: R3-eyes cross-surface. Surface: Home tile vs Activity YTD vs Tax total income. Expected: either one consistent figure or clearly-labelled distinct bases. Actual: Home 239K/yr, Activity YTD 484K/yr, Tax total income 524,831 — three different income figures with no visible basis label. Evidence/run: VR-003.

### MON-044 — Loan Opportunities card links to /dashboard/debt which 404s

**🟠 FIXING** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** The 'Loan Opportunities' card on My Guide links to a page that shows a 404 error.
>
> **What changed:** The card now links to /dashboard/debt-planner (the real Debt Freedom route every other link uses) instead of the non-existent /dashboard/debt.
>
> **What you should see:** On My Guide, click through the Loan Opportunities card — it now opens the Debt Freedom page instead of a 404.

- **Root cause:** `app/dashboard/cfo/page.tsx:921`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`
- **Fix PR(s):** ##PENDING
- **Holistic test (§19.4):** `tests/dashboard/cfoTileLinks.test.ts`
- **Detail:** `neoaudit-run:VR-004`

Found VR-004 (Reza Claude-Chrome 2026-07-14). The CFO 'Loan Opportunities' card drill-down navigates to /dashboard/debt which returns 404 (dead link — route missing or renamed). Read-only, no data change. Blocks full confirmation of MON-038's per-loan action text. | [FIX 2026-07-14] Root cause: a single typo’d href — cfo/page.tsx:921 pointed at /dashboard/debt (non-existent); the canonical route is /dashboard/debt-planner (used by every other link). One-line repoint. Ratchet: tests/dashboard/cfoTileLinks.test.ts asserts every /dashboard/<seg> href in cfo/page.tsx resolves to a real route + the dead /dashboard/debt path is absent. The Ratchet ALSO surfaced a second dead-end — see MON-046.

### MON-045 — CFO neg-gearing benefit ($157,746) ~4x total deductions ($39,554) — internally inconsistent

**🔵 OPEN** · 🟡 medium · changes numbers: **yes** · area: tax · opened 2026-07-14

> **What was wrong:** On My Guide the 'Negative Gearing Benefit' ($157,746) is about 4x the total tax deductions ($39,554), which doesn't add up.
>
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `neoaudit-run:VR-004`

Found VR-004 (Reza Claude-Chrome 2026-07-14). CFO Total Deductions shows Property $39,444 with 'Neg. Gearing Benefit: $157,746' — the benefit is ~4x the total deductions, internally inconsistent. Needs §19.2 audit of the neg-gearing-benefit producer vs the canonical deductions. NOT one of the original 5; surfaced by the deduction recalculation.

### MON-046 — Bare /dashboard/investments 404s (CFO tile + DocumentList + sidebar nav)

**🟠 FIXING** · 🟢 low · changes numbers: **no** · area: cfo · opened 2026-07-14

> **What was wrong:** Several links to the Investments section (the My Guide investment tile, a document link, and the sidebar) opened a 404 page.
>
> **What changed:** Added an Investments landing page that redirects to the Investment Accounts tab, so every link into /dashboard/investments now lands somewhere real.
>
> **What you should see:** Click the Investments tile on My Guide (and the Investments item in the sidebar) — it now opens the Investment Accounts page instead of a 404.

- **Root cause:** `app/dashboard/cfo/page.tsx:1062`, `app/dashboard/investments/page.tsx:1`
- **Downstream consumers (§19.4):** `app/dashboard/cfo/page.tsx`, `components/documents/DocumentList.tsx`, `lib/navigation/trailNav.tsx`
- **Fix PR(s):** ##PENDING
- **Holistic test (§19.4):** `tests/dashboard/cfoTileLinks.test.ts`
- **Detail:** `ratchet:MON-044`

Surfaced by the MON-044 dead-link Ratchet (tests/dashboard/cfoTileLinks.test.ts) on 2026-07-14 — the route-existence assertion flagged /dashboard/investments has no page.tsx (only accounts/holdings/super/transactions sub-tabs), so 4 bare-route links 404d. Fix: app/dashboard/investments/page.tsx redirects to /dashboard/investments/accounts (mirrors the /dashboard/accounts -> /dashboard/balances redirect pattern), fixing all callers at source (§12.1). Example of the NeoAudit living-system loop — a Ratchet added for one bug caught a latent sibling.

