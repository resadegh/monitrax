# Property Detail — Cashflow & Rent Correctness Issue Tracker

> **Opened 2026-07-03** from Reza's review of a property (Thornland / Bankwest loan) whose
> numbers don't reconcile. Investigated per CLAUDE.md §19 (financial correctness — every claim
> verified in source, never guessed), §21.5 (Neomatrix-first), §12.2.1 (SSOT / one source).
>
> **Status: INVESTIGATION COMPLETE — fixes NOT yet applied.** P-1/P-2/P-5/P-6 change user-facing
> money numbers → per the standing rule they need Reza's go-ahead + scheduling before any fix ships
> (§19.3 / number-changing). P-3/P-4/P-7 are display/UX. Recommended sequence in §Sequencing.

## The surface

`app/dashboard/properties/[id]/page.tsx` (864 lines) fetches `GET /api/properties/[id]` once and
computes **every KPI client-side, inline, from the DECLARED Prisma records** (`Income.amount`,
`Expense.amount`, `Loan.minRepayment/principal`) × frequency. There is **no canonical engine call**
and **the reconciled-transaction actuals the API already computes are ignored**. The page's own JSDoc
admits this (`page.tsx:35-37`: *"no canonical engine call for per-property math today"*). That single
architectural fact is the root of most issues below.

Not in the Neomatrix: none of these inline per-property compute helpers are modelled as graph nodes,
which is exactly why the A3 convergence gate didn't catch the drift (§21.5 — an unmodelled surface is
a blind spot, same failure mode as the +$10,505 dashboard bug). Modelling them (with a `semanticKey`)
is part of the fix so future drift becomes a build failure.

---

## Issues

| # | Issue | Severity | Changes numbers? | Root cause (verified) |
|---|---|---|---|---|
| **P-1** | Fortnightly rent stored/treated as **MONTHLY** → rent under-annualised ~54% | 🔴 Critical | **Yes** | reconcile write paths never persist the detected cadence |
| **P-2** | Per-property cashflow/rent computed **inline from declared records, not the canonical engine / not actuals** → figures disagree across surfaces | 🟠 High | **Yes** | `computeCashflow`/`computeAnnualRent` inline; API actuals ignored |
| **P-5** | **DEPRECIATION / YR always $0** (reads a field that doesn't exist) | 🟠 High | **Yes** | `d.annualClaim` not on the `DepreciationSchedule` model |
| **P-3** | **Loan repayment missing** from the "Cashflow rhythm" list → cashflow can't be reconciled visually | 🟡 Medium | No (display) | `RecentActivityCard` renders only income + expenses |
| **P-4** | Clicking **"N expenses tracked"** goes to the global `/dashboard/expenses`; no per-property summary / drill-down | 🟡 Medium | No (UX) | `href:'/dashboard/expenses'`; no per-property summary component |
| **P-6** | Cashflow subtracts full **P&I `minRepayment`** but the "Tax position" card calls it "before tax" → conflates **cash** basis with **tax** (which needs *interest only*) | 🟢 Low | Yes (labelling) | `computeAnnualLoanRepayments` uses `minRepayment`, not interest |
| **P-7** | Cashflow figure Reza saw (**-$100,912**) ≠ the property-hero figure (**-$46,897**) — confirm which surface shows -$100,912 | 🟡 Medium | — | likely a second inline computation (P-2 drift); **surface to confirm** |

---

### P-1 — Fortnightly rent stored/treated as MONTHLY (🔴 Critical, number-changing)

**Symptom.** Reza reconciled *fortnightly* rental transactions on `/dashboard/activity`, but the
property "financial structure" shows each as **"monthly · rental"** and annualises at ×12.

**Root cause (verified).** The reconcile write paths never persist the detected cadence:
- `app/api/transactions/[id]/link/route.ts:318` — `create` action: `const frequency = body.frequency || 'MONTHLY'` (hardcoded default; the income create at `:343`/`:374` uses it).
- `app/api/transactions/[id]/link/route.ts:156-166` — `link` action updates `amount`/`budgetedAmount`/`lastReconciled` only; **`frequency` untouched** (keeps the record's existing MONTHLY).
- `app/api/transactions/[id]/link/route.ts:656-663` — `update` action: same, no `frequency`.
- `components/transactions/TransactionLinkDialog.tsx:577` — for income there is **no frequency picker**, so the client sends `'MONTHLY'`.
- The cadence **is** detected but discarded: `lib/utils/reconciliation.ts:90` `detectFrequency` (12–20 days → FORTNIGHTLY) is never called on a write path; `link/route.ts:1280-1285` computes `detectedFrequency` inline but only for the **GET** UI response — never fed into an `Income` write.
- The property card faithfully renders the wrong stored value: `page.tsx:697` label = `Income.frequency.toLowerCase()`; `page.tsx:141`/`:165` annualise with `toAnnual(i.amount, i.frequency)`.

**Verified impact (§19.2 worked example).** `toAnnual` (`lib/utils/frequencies.ts:11`) is FORTNIGHTLY ×26, MONTHLY ×12 (both correct). A $1,195 fortnightly rent:
- correct: 1195 × 26 = **$31,070/yr**; stored MONTHLY: 1195 × 12 = **$14,340/yr** → **understated $16,730/yr (~54%)** per stream.
- (Conversely, if several actual fortnightly payments were each created as *separate* monthly income rows — 4 rows visible on Reza's screen — the sum ×12 can *overstate* instead. Both are the same defect: the stored frequency/record-shape doesn't reflect the actual cadence.)

**UX gap (Reza, 2026-07-03) — no frequency control at the point of use.** Verified:
- **At reconcile:** `TransactionLinkDialog` has **no frequency picker for income** (the recurring-frequency selector is expense-only — `TransactionLinkDialog.tsx:577` sends `'MONTHLY'` for income). So the user can't tell Monitrax the rent is fortnightly; it "looks automatic" but is really just the MONTHLY default.
- **Edit later:** frequency **is** editable — but only on the global `/dashboard/income` edit dialog (`app/dashboard/income/page.tsx:1484-1500`, a Select incl. **Fortnightly**). It is **not surfaced at the point of use**: the property page's income row links to the income *list* (`page.tsx:700` → `/dashboard/income`), not an in-context edit of that record's frequency, and nothing on the property page or the reconcile flow exposes it. So from where the user actually is (property view / reconciliation) there is effectively no way to set or correct it — matching Reza's report.
- **Multi-record trap:** if reconciliation created *several* income rows for one rental (the 4 rows Reza sees), fixing frequency per-row is both poor UX and still wrong (double-count). The real answer is actuals-driven (P-2), not hand-editing declared rows.

**Proposed fix.**
1. **Add an income frequency control in `TransactionLinkDialog`** (default via the already-computed detection — `reconciliation.ts:90` / inline `link/route.ts:1280` — so fortnightly is pre-selected, user-overridable), and **persist it** on the `create`/`update` writes (`transactions/[id]/link/route.ts:318` / `:156-166` / `:656-663`, which today never set `frequency`).
2. **Surface an in-context frequency edit** on the property page's income row (quick-edit / deep-link straight to that record's edit), so it's fixable from where the user is.
3. **Deeper fix (preferred, §19.1):** per-property rent/cashflow should read **actual reconciled transactions** (the API already computes `actualFromTransactions`/`monthlyAverageActual`, `route.ts:194-237`) rather than a declared record's frequency at all — see P-2. This makes the stored frequency non-load-bearing for the displayed number, so a wrong default can't silently corrupt the rent.

---

### P-2 — Per-property numbers computed inline from declared records, not the canonical engine/actuals (🟠 High, number-changing)

**Root cause (verified).** All KPIs are inline in `page.tsx`:
- `computeCashflow` (`:164`) = `Σ toAnnual(income) − Σ toAnnual(expenses) − Σ toAnnual(loan.minRepayment)`.
- `computeAnnualRent` (`:138`), `computeAnnualExpenses` (`:158`), `computeAnnualLoanRepayments` (`:152`).
- None call the canonical cashflow engine (`lib/calculations/cashflowOrchestrator.ts` / `canonicalCashflow.ts`) — §12.2.1 violation.
- The API computes actuals (`app/api/properties/[id]/route.ts:194-237`, `actualFromTransactions`/`monthlyAverageActual`) but **the page ignores them** and uses declared amounts — §19.1 violation (actuals must win when transactions exist).

**Why it matters.** Because each surface re-derives property cashflow its own way, the figures **disagree across surfaces** (this is the mechanism behind P-7's -$100,912 vs -$46,897). One number, one source.

**Proposed fix.** Route per-property cashflow/rent/expenses through a single canonical helper that (a) uses **actuals when transactions exist**, declared as fallback (§19.1), and (b) is **modelled in the Neomatrix with a `semanticKey`** so A3 convergence catches any future second source (§21.2.1). This subsumes much of P-1.

---

### P-5 — DEPRECIATION / YR always $0 (🟠 High, number-changing bug)

**Root cause (verified).** `computeAnnualDepreciation` (`page.tsx:169-171`) sums `d.annualClaim`, but the
`DepreciationSchedule` Prisma model (`prisma/schema.prisma:2374-2392`) has **no `annualClaim` field**
(its columns are `category, assetName, cost, rate, method`). `annualClaim` appears **only** in the
page's local interface (`page.tsx:102`) + the reduce (`:170`) — grep-confirmed nowhere else. So the
value is always `undefined ?? 0` → the tile, the linked-entities depreciation row, and the
"Depreciation schedule" insight all render **$0** (matches Reza's screenshot).

**Proposed fix.** Compute the annual claim from the real fields — `cost × rate` for prime-cost, or the
diminishing-value formula for `method === 'DIMINISHING_VALUE'` — in a canonical depreciation helper
(check `lib/tax-engine/*` for an existing one first, §12.2.1), and surface it. Number-changing +
touches a per-asset tax position → §12.14 reform-awareness applies.

---

### P-3 — Loan repayment missing from "Cashflow rhythm" (🟡 Medium, display)

**Root cause (verified).** `RecentActivityCard` (`page.tsx:768-795`) builds rows from `property.income`
(slice 0,2) + `property.expenses` (slice 0,3) only — **loans are never rendered**. But `computeCashflow`
(`:166`) *subtracts* the annual loan repayment. So the hero cashflow includes a large repayment term the
user can't see in the rhythm → it can't be reconciled by eye.

**Proposed fix.** Add the loan repayment(s) as rows in the rhythm list (with their frequency), so the
displayed components sum to the hero figure. Display-only; low risk. (Pairs naturally with P-6 — show
whether the row is interest vs P&I.)

**✅ SHIPPING (2026-07-03):** loan repayment rows added to the "Cashflow rhythm" (`RecentActivityCard`,
`page.tsx`), rendered as the same P&I `minRepayment` that `computeCashflow` subtracts — so the rhythm now
reconciles to the hero (this is what made -$100,912 / -$46,897 look "wrong"). Display-only, **no number
changed** (§20.5 autonomy — safe). A full reconciliation-summary card (rent − expenses − loan = cashflow)
remains a follow-up under P-4 (Stitch-first, §18.2.1).

---

### P-4 — Expense tile → global page; no per-property summary/drill-down (🟡 Medium, UX feature)

**Root cause (verified).** The "N expenses tracked" row (`page.tsx:704-716`) has `href:'/dashboard/expenses'`
→ the global expenses list, unfiltered. There is no per-property expense summary component
(`components/properties/` has only ChangePhotoDialog/PropertiesHero/PropertyTile) and no `expenses`
sub-route under `properties/[id]/`.

**Reza's ask.** Clicking a tile should open a **summary card** for that tile's items (here: the 5 expenses
with amounts/frequencies), with an **option to drill deeper** to the expenses page if needed. Applies to
the expense tile now; the same pattern should extend to the other linked-entity tiles.

**Proposed fix.** A per-property summary popover/card (the expenses, income, loan, depreciation behind
each tile) + a "View all in Expenses" link. **§18.2.1 STRICT: this is a new in-app section-level
composition → Stitch-first** (generate the card, ≥9/10 §18.8 gate, then React).

---

### P-6 — Cash basis vs tax basis conflation (🟢 Low, labelling)

`computeAnnualLoanRepayments` (`:152`) uses `minRepayment` (principal + interest) — a legitimate **cash**
outflow. But the "Tax position" insight (`page.tsx:529`) says the property *"contributes X to annual
cashflow before tax"*, implying a tax figure — yet negative gearing / tax deductibility uses the
**interest portion only**, not full P&I. **Fix:** label the hero explicitly as *cash* cashflow, and keep
the tax position on interest-only (via the canonical negative-gearing engine
`lib/tax-engine/divisions/negativeGearing.ts`). Bundle with P-2.

---

### P-7 — -$100,912 vs -$46,897 — ✅ RESOLVED (2026-07-03): same tile, different rent term

Reza confirmed both figures are the **same property-hero "CASHFLOW / YR" tile** on Thornlands Lot 1 —
`-$100,912` before he reassigned rentals, `-$46,897` after. Not two surfaces; the number moved because
the **rent term** changed (1 rental → 4). **The figures DO reconcile** once the (invisible) loan repayment
is included — which is exactly the P-3 defect:

```
cashflow = annualRent − annualExpenses − annualLoanRepayment(P&I)
Screen 1 (1 rental):   14,340 − 43,546 − ~71,706 = −100,912   ✓
Screen 2 (4 rentals):  68,352 − 43,546 − ~71,706 =  −46,897   ✓
   annualLoanRepayment = minRepayment × 12  (Bankwest ~$5,975/mo P&I on $947,076 @ 6.49%)
```

So "the numbers don't add up" is **P-3** (the ~$71,700 loan repayment is subtracted but never shown in
the Cashflow rhythm) — NOT a second computation. The remaining wrongness is **P-1** (the rent itself:
4 "monthly" records for one fortnightly stream). P-7 needs no separate fix — closed into P-3 (visibility)
+ P-1 (rent correctness).

---

## Sequencing (recommended — awaiting Reza's go-ahead on the number-changing ones)

1. **P-7 confirm** (30 s, Reza) — identify the -$100,912 surface so P-2's scope is exact.
2. **P-2 canonical per-property cashflow** (actuals-win, modelled in Neomatrix) — the keystone; subsumes P-1's annualisation and P-6's basis split. Number-changing → **10/10 financial build (§20.4) + §19.2 worked examples + Neomatrix update (§21.2)**.
3. **P-1 persist detected frequency** on reconcile + income frequency picker — so declared records are also correct (belt-and-braces with P-2).
4. **P-5 real depreciation claim** (cost×rate / diminishing value) via a canonical helper. Number-changing + §12.14.
5. **P-3 loan rows in the rhythm** (display; can ship early, low risk).
6. **P-4 per-tile summary card + drill-down** — Stitch-first (§18.2.1), ≥9/10 gate.

Each fix PR: §19.2 evidence + §20.4 recorded 10/10 (financial) + §21.2 Neomatrix update + §16 doc-sync.

---

*Tracker owner: this session opened it; fixes deferred to Reza's prioritisation. Cross-referenced from
`docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`.*
