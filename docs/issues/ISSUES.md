# Issue Registry (generated — do not hand-edit)

> Generated from `docs/issues/ISSUES.json` by `npm run issues:generate`. Gated by `npm run issues:check`.
> Lifecycle: 🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED. See `docs/issues/README.md`.

**8 total** · 6 open · 🔵 0 · 🟡 6 · 🟠 0 · 🟢 0 · ✅ 2

| ID | Status | Sev | Δ# | Title | Fix | Test |
|---|---|---|---|---|---|---|
| MON-001 | 🟡 DIAGNOSED | 🔴 | yes | Fortnightly rent stored/treated as MONTHLY (rent ~54% off) | — | — |
| MON-002 | 🟡 DIAGNOSED | 🟠 | yes | Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift | — | — |
| MON-003 | 🟡 DIAGNOSED | 🟠 | yes | DEPRECIATION / YR always $0 (reads a field absent from the model) | — | — |
| MON-004 | ✅ CLOSED | 🟡 | no | Loan repayment missing from the property Cashflow rhythm | #1333 | n/a |
| MON-005 | 🟡 DIAGNOSED | 🟡 | no | Expense tile -> global page; no per-property summary card / drill-down | — | n/a |
| MON-006 | 🟡 DIAGNOSED | 🟢 | yes | Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only) | — | — |
| MON-007 | ✅ CLOSED | 🟡 | no | -$100,912 vs -$46,897 don't add up | #1333 | n/a |
| MON-008 | 🟡 DIAGNOSED | 🟡 | no | Expense initial-entry inconsistent (only due-dates on the property edit form) | — | n/a |

---

### MON-001 — Fortnightly rent stored/treated as MONTHLY (rent ~54% off)

**🟡 DIAGNOSED** · 🔴 critical · changes numbers: **yes** · area: properties · opened 2026-07-03

- **Root cause:** `app/api/transactions/[id]/link/route.ts:318`, `app/api/transactions/[id]/link/route.ts:156`, `app/dashboard/properties/[id]/page.tsx:141`
- **Neomatrix:** `engine.incomeAggregator.aggregateIncome`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-1`

Reconcile write paths never persist the detected cadence; property page annualises the stored MONTHLY frequency. Subsumed by MON-002 (actuals-first) which makes the stored frequency non-load-bearing. Full downstream sweep (§19.4) to be completed at fix time.

### MON-002 — Per-property cashflow computed inline (declared, not canonical/actuals) -> loan cost silently $0 + SSOT drift

**🟡 DIAGNOSED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:164`, `app/dashboard/properties/[id]/page.tsx:152`, `app/api/properties/[id]/route.ts:193`
- **Neomatrix:** `engine.canonicalCashflow.resolveCanonicalCashflow`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`, `app/dashboard/properties/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-2`

Decision locked (Reza 2026-07-03): headline = actuals-first P&I (actual repayment when captured, else manual minRepayment); Tax card = interest-only. The API already returns budgetAmount + actualFromTransactions + hasTransactions per entity; the page ignores them. Per-property cashflow is NOT modelled in the Neomatrix (blind spot) -> must be modelled at fix time (§21.2.1) so semanticKeys resolve. Full §19.4 downstream sweep + cross-surface propagation test required before VERIFIED.

### MON-003 — DEPRECIATION / YR always $0 (reads a field absent from the model)

**🟡 DIAGNOSED** · 🟠 high · changes numbers: **yes** · area: properties · opened 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:170`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-5`

computeAnnualDepreciation sums d.annualClaim, which is not a column on DepreciationSchedule (cost/rate/method are). Must compute from cost x rate (prime-cost) / diminishing-value via a canonical helper. Touches a per-asset tax position -> §12.14 reform-awareness.

### MON-004 — Loan repayment missing from the property Cashflow rhythm

**✅ CLOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03 · closed 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:768`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** #1333
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-3`

Display-only (no computed number changed): the rhythm listed only income + expenses; the loan repayment computeCashflow subtracts was invisible. Fixed by rendering loan repayment rows (#1333, merged + prod-verified). changesNumbers=false, so no propagation test required (§19.4 applies to number-changing fixes); reconciliation verified arithmetically against both screenshots.

### MON-005 — Expense tile -> global page; no per-property summary card / drill-down

**🟡 DIAGNOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:714`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-4`

Reza wants a per-tile summary card + option to drill into the expenses page. New in-app section-level composition -> Stitch-first (§18.2.1).

### MON-006 — Cashflow cash-basis vs tax-basis conflation (full P&I vs interest-only)

**🟡 DIAGNOSED** · 🟢 low · changes numbers: **yes** · area: properties · opened 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:529`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Holistic test (§19.4):** ⚠ required before VERIFIED/CLOSED
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-6`

The Tax position card labels the full-P&I cashflow 'before tax'; tax/negative-gearing needs interest-only. Folded into MON-002 (headline = P&I cash; Tax card = interest).

### MON-007 — -$100,912 vs -$46,897 don't add up

**✅ CLOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03 · closed 2026-07-03

- **Root cause:** `app/dashboard/properties/[id]/page.tsx:164`
- **Downstream consumers (§19.4):** `app/dashboard/properties/[id]/page.tsx`
- **Fix PR(s):** #1333
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-7`

Resolved: both figures are the SAME hero tile (Thornlands Lot 1), before/after reassigning rentals. They reconcile once the hidden loan repayment is shown (MON-004): rent - expenses - repayment = hero. Not a second computation.

### MON-008 — Expense initial-entry inconsistent (only due-dates on the property edit form)

**🟡 DIAGNOSED** · 🟡 medium · changes numbers: **no** · area: properties · opened 2026-07-03

- **Root cause:** `app/dashboard/properties/page.tsx:215`, `app/dashboard/properties/page.tsx:1602`
- **Downstream consumers (§19.4):** `app/dashboard/properties/page.tsx`
- **Holistic test (§19.4):** n/a (display/UX)
- **Detail:** `docs/audits/PROPERTY_CASHFLOW_ISSUES_2026-07-03.md#p-9`

The property edit form captures only due dates; 'Add Expense' exists only on the older list page, not the detail page/edit form. Must follow the same manual-initial -> actuals-when-reconciled rule (MON-002). (Note: earlier 'P-8 manual repayment not capturable' was RETRACTED — the Minimum Repayment field does exist at LoanFormDialog:531; no issue.)

