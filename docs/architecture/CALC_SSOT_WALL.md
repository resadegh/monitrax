# The Calc-SSOT Wall — canonical producers + one-record-per-source (Matrix keystone)

> **Status:** DIAGNOSED (keystone) · **Severity:** critical (tax-facing) · **Pinned HEAD** `64391ca8`
> **Raised from:** Reza's live findings 2026-07-17 + a 3-agent codebase audit (VR-012). Sibling of the intake-integrity wall (MON-078).
> **Rule zero:** re-verify every anchor live before executing — line numbers drift.

## The one root cause
Monitrax **has** a canonical calc/SSOT layer (`lib/calculations/canonicalCashflow.ts`, `propertyCashflow.ts`, `incomeAggregator.ts`, `expenseAggregator.ts`, `lib/services/masterFinancialService.ts`, `lib/utils/frequencies.ts`). Bugs occur when a surface **bypasses it** — either by minting a duplicate record at intake, or by re-deriving a figure from raw records instead of calling the one producer. Reza's three findings and ~20 open MON issues are all the same defect in three mechanisms:

### Mechanism A — reconciliation MINTS a new row instead of updating one canonical record
No canonical "one record per real source" identity is enforced. Reuse guards were bolted on per-issue, not as one signature-based upsert:
- **SALARY/OTHER income has NO reconcile reuse guard.** `app/api/transactions/[id]/link/route.ts:453-474` only reuses for `RENT/RENTAL && propertyId`; everything else mints at `:474`, and `type` defaults to `OTHER` at `:413`. → **"Salary Ingeus Australia" ×3** (declared + $0/1-txn + $5,547/4-txn), all one job. (MON-074/076)
- **Expense near-dup is scoped by `propertyId/loanId/assetId`** (`link/route.ts:681-689`; `lib/…/reconcileSuggestedAction.ts:74-83`). A "Battery" on HOME and a "Battery" on General are in different candidate sets and never compared. → **battery ×3**. (MON-037 RC-B)
- **Doc-import income dedup is exact `amount+name+type`** (`reconcileSuggestedAction.ts:89-101`) — a declared row and its reconciled twin never match → mints. (declared-vs-reconciled duplicates)
- Manual `POST /api/income:302` and onboarding `complete:237` have no reuse convergence.

### Mechanism B — each surface RE-COMPUTES the same figure and they disagree (§12.2.1 violation)
- **Loan repayment = $0** on `/dashboard/expenses`: uses raw `minRepayment` (0 for interest-only) — `expenses/page.tsx:551-552, 564-566, 998` — instead of the canonical `computePropertyCashflow(...).loanLines[].monthly` (actuals → minRepayment → **interest floor**, `lib/calculations/propertyCashflow.ts:193-215`) that the property detail uses (the MON-032 fix). Same loan, two producers → $0 vs −$1,191. The page's `Loan` type (`:69-79`) doesn't even carry the actuals the API already computes (`/api/loans:143,147`).
- **Expenses page ignores `isRecurring`**: `convertToMonthly` (`expenses/page.tsx:547-548`) is pure `toMonthly(amount, frequency)` with **no isRecurring gate** anywhere in `totalMonthly/allTotalMonthly/discretionaryMonthly/group/list/tile` (`:554-564, 639, 679, 1070, 1094, 1134, 1146, 1246`). So a one-off battery (freq=Monthly) is counted ×12 → the inflated ~$84,275/mo. Canonical rule is `if (e.isRecurring === false) continue` (`propertyCashflow.ts:174`; `masterFinancialService.ts:916-917`; applied to insights in MON-023) — the expenses page was never migrated.
- **Reports** has a drifted local `convertToMonthly` missing `case 'ANNUAL'` (`lib/reports/contextBuilder.ts:263,279`) → ANNUAL counted as monthly (12×). (MON-034)
- **Properties list modal** recomputes annual cashflow inline (`properties/page.tsx:1194-1216`) while the tiles beside it call canonical `cashflowOf`. (MON-002/028 straggler)
- Balances net computed independently (`balances/page.tsx:715-724`, MON-012/013/064); two budget-vs-actual engines (`utils/reconciliation.ts:425` vs `bank/budgetComparison.ts:93`, MON-069); safety-net bills from a 3rd reducer (`api/safety-net/route.ts:72`); multiple tax entrypoints (MON-020/060); portfolio-snapshot loan-$0 sibling (`api/portfolio/snapshot/route.ts:727`, MON-014).

### Mechanism C — estimate/actual coexist, and a one-off still carries a cadence
`budgetedAmount` (estimate) and `amount` (actual) both live on income/expense (`schema.prisma:1938-1940, 2037-2039`) with no single "which is truth" rule. And a record marked `isRecurring=false` **still stores `frequency=MONTHLY`** — Reza's battery screenshot: recurring unchecked, Frequency = Monthly. A one-off with a monthly cadence is nonsensical and is exactly what Mechanism-B surfaces multiply.

## The fix (three coordinated moves)
1. **Canonical upsert-by-signature at intake (kills Mechanism A).** Extend the intake classifier (`lib/intake/classifyIntake.ts`, the MON-078 keystone) with a **source-signature reuse policy** = `(type, normalised name/employer/merchant, ownerEntityId)` — NOT scoped to `propertyId`. Route the link-route income `create` branch, the doc-import income branch, and the expense cross-scope case through it so reconciliation **updates the canonical row** (the `update` action template at `link/route.ts:831-943`, preserving `budgetedAmount`+`lastReconciled`) instead of inserting. One row ⇒ editing it propagates everywhere by construction.
2. **Route every surface through the canonical producer (kills Mechanism B).** `/dashboard/expenses` reads loan cost from `computePropertyCashflow().loanLines[].monthly` and expense monthly run-rate from the master snapshot's recurring total (one-offs excluded); delete the inline `convertToMonthly`/`minRepayment` math. Fix the Reports `ANNUAL` case. Migrate the properties-list modal, balances net, safety-net bills, and the tax entrypoints to their canonical producers. **Add a build-gate lint** (mirror the existing `lint:financial-surfaces`) that FAILS on inline `frequency×amount` aggregation or raw `minRepayment`/`.reduce` over income/expense/loan arrays inside `app/**/page.tsx` — so no surface can bypass the layer again (the source-lock, cf. MON-078 Ring-1).
3. **One-off has no cadence; one basis per row (kills Mechanism C).** When `isRecurring=false`, the form hides/ignores Frequency and the value is treated as a single occurrence everywhere (never ×12). Define `amount` (reconciled) as truth once linked, `budgetedAmount` as the pre-reconcile estimate; surfaces show one basis, labelled.

## Ratchets
- Ring-0: a one-off expense (isRecurring=false) contributes 0 to every monthly run-rate on every surface; an interest-only loan shows its interest cost (never $0) on every surface.
- Ring-1 **source-lock lint**: no `app/**/page.tsx` computes `frequency×amount`, sums raw income/expense/loan arrays, or reads raw `minRepayment` — must call a canonical producer.
- Ring-2 golden: linking a 2nd deposit to an existing salary stream updates ONE row (no mint); editing that row changes income page + tax + cashflow identically.

## Symptom map (open issues that are THIS root cause — close via the wall, don't fix piecemeal)
- Mechanism A (mint/duplicate): MON-037(RC-B), MON-074, MON-076, MON-009.
- Mechanism B (recompute drift): MON-002, MON-011, MON-012, MON-013, MON-014, MON-020, MON-027, MON-034, MON-043, MON-055, MON-059, MON-060, MON-064, MON-068, MON-069, MON-071.
- New issues to raise: **loan-$0 on /dashboard/expenses**, **/dashboard/expenses ignores isRecurring**, **one-off keeps frequency=Monthly**, **SALARY/OTHER income has no reconcile reuse guard**, **expense cross-scope dedup gap**.

## Model routing
- **Fable 5:** the intake signature-upsert (Mechanism A) + the canonical-producer migrations touching tax/cashflow numbers (subtle, tax-facing).
- **Opus 4.8:** the build-gate lint, the one-off/frequency form UX, and the straightforward surface swaps + tests.

## Sequencing (like the intake wall)
Part 1 keystone: source-signature upsert + the source-lock lint (prevents new duplicates/bypasses). Part 2: migrate the highest-tax-impact surfaces (expenses loan-$0, expenses isRecurring, Reports ANNUAL). Part 3: the remaining recompute sites. Part 4: golden fixtures. Each merged behind CI + a Matrix Ring-3 on Reza's data.

---
*Prepared by The Matrix from a 3-agent audit at HEAD `64391ca8`. Sources cited inline (file:line). Sibling keystone to `docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md`.*
