# Issue Registry (generated — do not hand-edit)

> Generated from `docs/issues/ISSUES.json` by `npm run issues:generate`. Gated by `npm run issues:check`.
> Lifecycle: 🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED. See `docs/issues/README.md`.

**8 total** · 6 open · 🔵 0 · 🟡 5 · 🟠 1 · 🟢 0 · ✅ 2

| ID | Status | Sev | Δ# | Title | Fix | Test |
|---|---|---|---|---|---|---|
| MON-001 | 🟡 DIAGNOSED | 🔴 | yes | Fortnightly rent stored/treated as MONTHLY (rent ~54% off) | — | — |
| MON-002 | 🟠 FIXING | 🟠 | yes | Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift | #1336 | ✅ |
| MON-003 | 🟡 DIAGNOSED | 🟠 | yes | DEPRECIATION / YR always $0 (reads a field absent from the model) | — | — |
| MON-004 | ✅ CLOSED | 🟡 | no | Loan repayment missing from the property Cashflow rhythm | #1333 | n/a |
| MON-005 | 🟡 DIAGNOSED | 🟡 | no | Expense tile -> global page; no per-property summary card / drill-down | — | n/a |
| MON-006 | 🟡 DIAGNOSED | 🟢 | yes | Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only) | — | — |
| MON-007 | ✅ CLOSED | 🟡 | no | -$100,912 vs -$46,897 don't add up | #1333 | n/a |
| MON-008 | 🟡 DIAGNOSED | 🟡 | no | Expense initial-entry inconsistent (only due-dates on the property edit form) | — | n/a |

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

Fix shipped: extracted ONE engine lib/calculations/propertyCashflow.ts (actuals-first P&I headline, interest-only tax) + ONE shared actuals producer lib/services/propertyActuals.ts (batched into BOTH the list and detail APIs so tiles match the detail page — §19.4 same-number-everywhere). Modelled in the Neomatrix (engine.propertyCashflow.computePropertyCashflow + number.propertyCashflow, both surfaces converge on one engine — A3). Folds in MON-001 (fortnightly-as-monthly: actuals-first monthlyAverageActual fixes it) + MON-006 (cash-vs-tax basis: both returned explicitly). Status stays FIXING until Reza tests the numbers on his data.

### MON-003 — DEPRECIATION / YR always $0 (reads a field absent from the model)

**🟡 DIAGNOSED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

> **What was wrong:** The property's Depreciation per year always showed $0.
>
> **What changed:** (planned) Calculate the yearly depreciation from the schedule's cost and rate (prime-cost / diminishing-value).
>
> **What you should see:** (after fix) Depreciation/yr shows a real figure based on your depreciation schedule.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:170`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-5`

computeAnnualDepreciation sums d.annualClaim, not a column on DepreciationSchedule (cost/rate/method are). Touches a per-asset tax position -> §12.14 reform-awareness.

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

**🟡 DIAGNOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

> **What was wrong:** Clicking 'N expenses tracked' jumps to the full expenses page instead of showing this property's expenses.
>
> **What changed:** (planned) Show a small summary card of this property's expenses, with a link to drill into the full page if needed.
>
> **What you should see:** (after fix) Clicking the expenses tile opens a summary of that property's expenses; a link takes you to the full page.

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:714`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** n/a (display/UX)
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

**🟡 DIAGNOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

> **What was wrong:** There's no clear place to enter a property's initial expense amounts — the property edit form only takes renewal due-dates, and 'Add Expense' is hidden on the old list page.
>
> **What changed:** (planned) A consistent way to add initial expense amounts on the property, following the same rule: your typed value first, your reconciled actuals when available.
>
> **What you should see:** (after fix) You can add/see a property's expense amounts in the property view, and reconciled actuals override them automatically.

- **Root cause:** `app/dashboard/properties/page.tsx:215`, `app/dashboard/properties/page.tsx:1602`
- **Downstream consumers (§19.4):** `app/dashboard/properties/page.tsx`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-9`

Follows the same manual-initial -> actuals-when-reconciled rule (MON-002). (Earlier 'P-8 manual repayment not capturable' was RETRACTED — the Minimum Repayment field exists at LoanFormDialog:531.)

