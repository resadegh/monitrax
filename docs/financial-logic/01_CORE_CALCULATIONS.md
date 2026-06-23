# Financial Logic Index — Spoke 01: Core Calculations

> Net worth, cashflow (declared + actual + canonical), and the aggregators that
> feed them. These are the numbers on nearly every screen. See
> [`00_INDEX.md`](00_INDEX.md) for the operating rules. Every entry below was
> written from a **complete read** of the source file (CLAUDE.md §10, §19.2);
> nothing is assumed.

---

## 1. Net Worth — `lib/calculations/netWorthCalculator.ts` ✅ DOCUMENTED

- **Produces:** `netWorth` plus an asset summary (properties / accounts /
  investments / superannuation / personalAssets / total), a liability summary
  (mortgages / personalLoans / creditCards / total), and a breakdown
  (propertyEquity / liquidAssets / investmentAssets).
- **Canonical accessor:** `calculateNetWorth(properties, accounts, investments, loans, superannuation?, personalAssets?)`. Decimal sibling: `calculateNetWorthDecimal(...)` (end-to-end `Decimal`, no mid-arithmetic rounding). Sub-functions `calculateTotalAssets(...)` and `calculateTotalLiabilities(...)` are also exported and take an optional `ownerEntityId` filter.
- **Inputs (unit · type · convention):**
  | Field | Unit/type | Convention (verified) |
  |---|---|---|
  | `property.currentValue` | AUD, number | Current market value. |
  | `account.currentBalance` | AUD, number | Current balance. `type === 'OFFSET'` accounts are still counted as assets, but excluded from the `liquidAssets` breakdown line (offset is held against a mortgage). |
  | `investment.units` × (`currentPrice` ?? `averagePrice` ?? 0) | units × AUD/unit | Market value; falls back to average price when no current price. |
  | `super.balance` | AUD, number | Counted **unless** `fundType === 'SMSF'` (Phase 39.5 — SMSF member balances are excluded because the fund's wealth flows through the SMSF `LegalEntity`'s owned assets; counting both double-counts). |
  | `asset.currentValue` | AUD, number | Personal assets (vehicles etc.). |
  | `loan.principal` | AUD, number | **Current outstanding balance** (not the original amount) — `prisma/schema.prisma` confirms `Loan.principal` is the live balance. |
  | `ownerEntityId` | string, optional | When provided, only rows whose `ownerEntityId` matches are summed (Phase 41e.0 audit C-3). Default = no filter (household-wide). |
- **Formula / rule:**
  - `assets.total = Σ property.currentValue + Σ account.currentBalance + Σ (units × price) + Σ super.balance[non-SMSF] + Σ asset.currentValue`
  - `liabilities.total = Σ loan.principal` (classified — see below)
  - **`netWorth = assets.total − liabilities.total`** (standard accounting identity: net worth = total assets − total liabilities).
  - `breakdown.propertyEquity = assets.properties − liabilities.mortgages`
  - `breakdown.liquidAssets = Σ account.currentBalance where type ≠ 'OFFSET'`
  - `breakdown.investmentAssets = assets.investments + assets.superannuation`
- **Liability classification (load-bearing gotcha):** a loan is a **mortgage** when `loan.type` (upper-cased) is `'HOME'` or `'INVESTMENT'`, **or** `loan.propertyId` is set; a **credit card** when `type === 'CREDIT_CARD'`; **everything else → personal loans** — including the typo `'MORTGAGE'`. Loan-creation flows MUST use `'HOME'`/`'INVESTMENT'` for property loans or the loan misclassifies. (This is a real footgun — flagged for the tax/loan UI audit, not changed here.)
- **Consumers:** `lib/services/masterFinancialService.ts` (the master snapshot's net worth); historically also `app/api/financial-health`, `app/api/portfolio/snapshot`, `lib/health/aggregateEngine.ts` (the file header lists the scattered sites it replaced — those must call this engine, not re-derive).
- **Verified by:** `tests/calculations/netWorthCalculator.decimal.test.ts` (Float vs Decimal parity, 8 tests); Phase 41i calc-audit fixture `core.netWorth` (classification contract). Worked example: property 800,000 + account 20,000 + (100 units × 50) − loan 600,000 = 800,000+20,000+5,000−600,000 = **225,000**.
- **Last verified:** 2026-06-23 (full read).

---

## 2. Declared Cashflow — `lib/calculations/cashflowOrchestrator.ts` ✅ DOCUMENTED

- **Produces:** `CashflowResult` — monthly + annual gross/net income, PAYG withholding, expenses, loan repayments, cashflow (= surplus); ratios (savingsRate / expenseRatio / debtServiceRatio); essential vs discretionary split; income-by-type and expenses-by-category maps; taxableIncome and taxDeductibleExpenses. This is the **DECLARED / "plan"** side (Income/Expense/Loan records × frequency) — **not** what actually left the bank. For actuals, see §3/§4.
- **Canonical accessor:** `calculateCashflow(input, ownerEntityId?)`. Decimal sibling `calculateCashflowDecimal(...)`. Simpler variants `calculateMonthlyCashflow` / `calculateAnnualCashflow` / `calculateSimpleCashflow` exist for back-compat.
- **Inputs (unit · type · convention):**
  | Field | Unit/type | Convention (verified) |
  |---|---|---|
  | `income.amount` + `income.frequency` | AUD per period + Frequency enum string (`WEEKLY`/`FORTNIGHTLY`/`MONTHLY`/`ANNUAL`/…) | Converted to monthly via `toMonthly()` (`lib/utils/frequencies.ts`). |
  | `income.type`, `salaryType` (`'NET'`/`'GROSS'`), `grossAmount`, `netAmount` | — | For `type==='SALARY'`: `GROSS` → take-home computed via `calculateTakeHomePay()` (PAYG + Medicare); `NET` → entered amount IS net, gross read from stored `grossAmount`. Non-salary income: gross = net, PAYG = 0. |
  | `income.isTaxable` | boolean | When not `false`, the gross annual amount adds to `taxableIncome`. |
  | `expense.amount` + `frequency` | AUD/period + Frequency | `toMonthly()`. |
  | `expense.isEssential` | boolean | Splits essential vs discretionary. |
  | `expense.isTaxDeductible` | boolean | Adds `monthly × 12` to `taxDeductibleExpenses`. |
  | `loan.minRepayment` + `repaymentFrequency` | AUD/period + Frequency | `toMonthly()`. Note: this engine uses **minRepayment**, not interest — interest-rate math lives in `loanAggregator.ts` (see §5, pending). |
  | `ownerEntityId` | string, optional | Entity filter (Phase 41e.0); default household-wide. |
- **Formula / rule:**
  - `monthlyCashflow = monthlyNetIncome − monthlyExpenses − monthlyLoanRepayments` (file header: *"Cashflow = Net Income − Expenses − Loan Repayments"*). Uses **NET** income (after-tax) — what's actually available to spend.
  - `savingsRate = monthlyCashflow / monthlyNetIncome × 100` (0 when income ≤ 0).
  - `expenseRatio = monthlyExpenses / monthlyNetIncome × 100`; `debtServiceRatio = monthlyLoanRepayments / monthlyNetIncome × 100`.
  - Annual = monthly × 12. All output fields rounded to 2dp (`Math.round(n*100)/100`); the Decimal sibling does **not** pre-round (rounds only at the output boundary).
- **Key behaviour / gotcha:** this is the DECLARED basis. It **does not** see uncategorised/unlinked bank spend, so on its own it overstates surplus for users with real transactions. The §4 canonical accessor exists precisely to choose actual-over-declared when transactions exist (CLAUDE.md §19.1).
- **Consumers:** `lib/services/masterFinancialService.ts` (`snapshot.cashflow` + declared `quickMetrics`); the declared fallback inside `getCanonicalMonthlyCashflow` (§4).
- **Verified by:** `tests/calculations/aggregators.decimal.test.ts` (Float/Decimal parity). Worked example: net income 8,000/mo − expenses 5,000 − loans 1,000 = **2,000/mo**, savingsRate = 2,000/8,000 = **25%**.
- **Last verified:** 2026-06-23 (full read).

---

## 3. Actual Cashflow — `lib/calculations/actualCashflow.ts` ✅ DOCUMENTED

- **Produces:** `ActualCashflowResult` — current-calendar-month outflow / inflow / net, trailing-average monthly outflow + inflow, current-month outflow-by-category (incl. an `'Uncategorised'` bucket), and `hasActualData`. Computed from **actual** `UnifiedTransaction` rows, not declared records.
- **Canonical accessor:** `computeActualCashflow(transactions, { now? })`. PURE (no fetch, no global state; `now` injectable for tests). Surfaced on the master snapshot as `quickMetrics.actualMonthly*` / `actualAvgMonthlyOutflow` / `actualOutflowByCategory` / `hasActualData`.
- **Inputs (unit · type · convention):**
  | Field | Unit/type | Convention (verified) |
  |---|---|---|
  | `transaction.date` | Date | Bucketed by calendar month. |
  | `transaction.amount` | AUD, number | Summed via `Math.abs()` — magnitude only (some sources store OUT as negative). |
  | `transaction.direction` | `'IN'`/`'OUT'` string | IN vs OUT is decided by **direction**, NOT the sign of `amount`. |
  | `transaction.categoryLevel1` | string \| null | null/empty OUT → bucketed under literal `'Uncategorised'` and **counted** (dropping it was the bug this engine fixes). |
  | `transaction.isTransfer` | boolean \| null | `=== true` rows are **excluded** entirely (internal account-to-account move is neither spend nor income). |
- **Formula / rule:**
  - `currentMonthOutflow = Σ |amount|` over non-transfer OUT rows whose month == current calendar month; `currentMonthInflow` likewise for IN; `currentMonthNet = inflow − outflow` (can be negative — a real deficit).
  - Trailing window = the **3 full calendar months before** the current (in-progress) month. **Data-driven divisor (2026-06-23 fix):** `avgMonthlyOutflow = Σ trailing OUT / (count of those 3 months that have ≥1 non-transfer transaction)`. A month with **no** transactions is *missing data* → excluded from sum AND divisor; a populated low-spend month still counts. Divisor floored at 1 (sums are 0 anyway when no populated months). `avgMonthlyInflow` uses the same divisor.
  - Empty input (or all-transfers) → all-zero result with `hasActualData = false`.
- **Why the divisor matters:** the previous fixed `/3` understated the average for users who only recently connected their bank (2 of 3 prior months had no data) → produced a false ~$938 emergency-fund figure. (Changed in PR #1201; see §6 of `docs/audit/AUDIT_CASHFLOW_SSOT.md`.)
- **Consumers:** `lib/services/masterFinancialService.ts` (exposes the actual fields + uses `avgMonthlyOutflow` as the emergency-fund denominator); `getCanonicalMonthlyCashflow` (§4).
- **Verified by:** `tests/calculations/actualCashflow.test.ts` (11 tests — transfers excluded, Uncategorised counted, abs/direction handling, data-driven divisor). Worked example: only May populated (600), Mar+Apr no data → divisor 1 → avg **600**; Mar 10 + May 600 both populated → divisor 2 → avg **305**.
- **Last verified:** 2026-06-23 (authored/read this session).

---

## 4. Canonical Monthly Cashflow — `lib/calculations/canonicalCashflow.ts` ✅ DOCUMENTED

- **Produces:** `CanonicalMonthlyCashflow` — `{ inflow, outflow, net, savingsRate, avgMonthlyOutflow, basis }` where `basis` is `'actual'` or `'declared'`. This is **the single SSOT** every cashflow-emitting surface must call for "money in / out / net this month."
- **Canonical accessor:** `getCanonicalMonthlyCashflow(snapshot)` (takes a master snapshot slice) and the pure `resolveCanonicalCashflow(actual, declared)` (the rule itself, for routes that compute actuals locally).
- **Inputs (unit · type · convention):**
  - From `snapshot.quickMetrics`: `hasActualData`, `actualMonthlyInflow`, `actualMonthlyOutflow`, `actualNetCashflow`, `actualAvgMonthlyOutflow` (all AUD/month, from §3).
  - Declared fallback from `snapshot.cashflow`: `monthlyNetIncome`, `monthlyExpenses + monthlyLoanRepayments`, `monthlyCashflow` (from §2).
- **Formula / rule (the actuals-vs-declared SSOT — CLAUDE.md §19.1):**
  - **If `hasActualData`:** `inflow = actualMonthlyInflow`, `outflow = actualMonthlyOutflow`, `net = actualNetCashflow`, `basis = 'actual'`. `avgMonthlyOutflow = actualAvgMonthlyOutflow` (falls back to current-month `outflow` if the trailing avg is 0 — sparse history).
  - **Else (no transactions):** `inflow = monthlyNetIncome`, `outflow = monthlyExpenses + monthlyLoanRepayments` (loan repayments folded into outflow), `net = monthlyCashflow`, `basis = 'declared'`.
  - `savingsRate = net / inflow × 100` (0 when inflow ≤ 0).
- **Key behaviour:** **actuals win when present; declared is fallback only.** `outflow` always includes loan repayments (in the actual case they're inside the transaction OUT total; in the declared case they're added explicitly), so consumers must not add loans again.
- **Consumers (converged in PR #1201):** `/api/cashflow/intelligence` (forecast hero + cashflow health-score input); future surfaces per the §16 enforcement. Bound by the drift-guard test below. **Pending convergence (Phase 2b):** Home `portfolio/snapshot` cashflow tiles (deferred — needs a drill-down redesign so the declared Income−Expenses−Loans breakdown doesn't contradict an actual headline).
- **Verified by:** `tests/calculations/canonicalCashflow.test.ts` (4 tests) + `tests/calculations/cashflowSurfacesUseCanonical.test.ts` (enforcement gate). Worked example: In 25,827 / Out 46,741 → net **−20,914**, savingsRate ≈ **−80.98%**, basis `'actual'` (the real deficit that the old declared hero hid as +$10,505 / 51.9%).
- **Last verified:** 2026-06-23 (authored this session, PR #1201).

---

## Pending in this domain (🔶 not yet researched — do NOT trust without reading source)

| Engine | File | Why it's here |
|---|---|---|
| Expense aggregator | `lib/calculations/expenseAggregator.ts` | Declared expense SSOT; feeds master snapshot. |
| Income aggregator | `lib/calculations/incomeAggregator.ts` | Declared income SSOT (gross/net/PAYG). |
| Loan aggregator | `lib/calculations/loanAggregator.ts` | Debt SSOT — interest math (`interestRateAnnual` is a **decimal** 0.0625, not a percent; the source of a prior 100× bug). High audit priority. |
| Money-Story trend | `lib/calculations/moneyStoryTrend.ts` | 12-month earned-vs-spent ribbon (actual). |
| Asset valuation | `lib/calculations/assetValuation.ts` | Holding market value + loan balance helpers. |
| Net-worth history | `lib/calculations/netWorthHistory.ts` | Monthly net-worth snapshots via the SSOT reader. |
| Entity breakdown | `lib/calculations/entityBreakdown.ts` | Per-entity position partitioner (Phase 47). Note: per-entity `monthlyCashflow` does NOT subtract loans (flagged in prior audit). |
| Entity value breakdown | `lib/calculations/entityValueBreakdown.ts` | Per-entity net value for the Entity Value chart. |

> These will be documented next, each from a complete read + verification, before the index claims them ✅.

---

*Spoke created 2026-06-23. Part of `0·FIN-LOGIC-INDEX`.*
