# Changelog - 2026-06-27

## Session: adoring-davinci-e2wb4d

### Changes Made
- **Type**: Fix
- **Scope**: Transaction reconciliation — batch categorisation (`TransactionLinkDialog` + `/api/transactions/[id]/link`)
- **Root Cause**: The "categorize selected together" batch path (`additionalTransactionIds`) was wired
  only for the **expense**, **income**, and **link** actions. The **transfer** and **investment**
  actions ignored it on the server *and* the front end never sent it for those bodies. Result: when a
  user batch-selected same-vendor rows that resolved to a **transfer** (e.g. NAB credit-card
  repayments / loan repayments) or an **investment contribution**, only the primary row was
  categorised — every other selected row stayed untouched, so reconciliation "went one by one"
  exactly as reported.
- **Solution**: Made the batch path symmetric across all four actions (§12.2.1 — one behaviour, one
  path):
  - **Front end** (`TransactionLinkDialog.tsx`): added
    `additionalTransactionIds: Array.from(selectedVendorTransactions)` to the `investment` body, the
    `transfer` body in `handleCreate`, and the resolution-surfaced `handleMarkTransferTo` body.
  - **Server — transfer branch**: extracted the confirmed-transfer field set once
    (`...confirmedTransferFields()` — the tested SSOT helper from
    `lib/bookkeeping/transferCategorisation.ts`) and applied it to the primary row **and** to a
    user-scoped `updateMany` over the validated `additionalTransactionIds`.
  - **Server — investment branch**: looped the validated additional rows, creating a distinct
    investment `DEPOSIT` per row (amounts differ), incrementing the account `cashBalance` per row, and
    marking each bank row `isInvestmentContribution`. Response now reports `batchCount`.

### Files Modified
- `components/transactions/TransactionLinkDialog.tsx` — send `additionalTransactionIds` for transfer + investment + mark-transfer-to paths
- `app/api/transactions/[id]/link/route.ts` — apply the batch mark in the `transfer` + `investment` action branches
- `docs/financial-logic/graph/structural/structural-graph.json` — zero-drift (§21.2.1): refreshed shifted `file:line` anchors for `link_route_get` (1019→1111) and `link_route_calculatesimilarity` (1599→1691) after the route grew

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `app/api/transactions/[id]/link/route.ts` (transfer) `prisma.unifiedTransaction.updateMany(...)`
- `app/api/transactions/[id]/link/route.ts` (investment loop) `prisma.unifiedTransaction.update(...)` + `prisma.investmentAccount.update({ cashBalance: { increment } })`

For each operation:
1. **`where` clause matches:** only ids returned by a preceding `findMany({ where: { id: { in: additionalTransactionIds }, userId } })` — i.e. transactions the **authenticated user owns** and **explicitly selected** in the batch UI. No row outside the user's selection can match.
2. **Columns overwritten:** the same categorisation columns the single-row path already writes (`isTransfer`/category fields via `confirmedTransferFields()`, or `isInvestmentContribution` + investment link). These are reconciliation-state columns the user is deliberately setting by clicking "categorize together"; no user-entered balances/names/dates are clobbered. `cashBalance` is `increment`-only (additive, mirrors the existing single-row deposit).
3. **Guard ensuring this only mutates rows I intend:** the user-scoped `findMany` validation gate (identical to the existing expense/income batch pattern) + the rows are the user's own explicit multi-select.

User confirmation: NOT REQUIRED — non-destructive (sets reconciliation state the user explicitly requested via the batch-select UI; scoped to the authenticated user's own selected rows; mirrors the already-shipped, reviewed expense/income batch pattern).

### Financial correctness (CLAUDE.md §19)
- No money number's **formula** changes. Transfers are excluded from spend/income via `confirmedTransferFields()` (`isTransfer: true`) exactly as the single-row path already does (§19.1 — transfers excluded). Investment contributions increment `cashBalance` by the real transaction amount per row (actuals, not declared). The fix only widens *which selected rows* get the already-correct mark.

### Neomatrix (CLAUDE.md §21)
- No semantic `financial-graph.json` change — this route categorises/links transactions; it does not produce a modelled money number (§21.5). Structural Layer-0 anchors refreshed for zero-drift (§21.2.1).
- Gates run locally: `check-layer0-coverage` 0 uncovered · `check-binding-coverage` 140/140 · `check-census` 0 uncovered · `generate-financial-logic --check` OK.

### Self-review (CLAUDE.md §20.4)
- 3× review against the requirement ("batch categorisation must apply to ALL actions"): pass 1 fixed transfer + investment server branches; pass 2 caught the FE `handleMarkTransferTo` resolution path also omitted the ids (added); pass 3 verified §12.11 user-scoping on every new write + that the investment loop creates one DEPOSIT per row (amounts differ — `updateMany` would be wrong here). Outcome 10/10 against requirement.

### Testing
- [ ] Build passes (Vercel — verified post-push)
- [x] Structural + semantic Neomatrix gates pass locally
- [x] Type review: `additionalTransactionIds?: string[]` already on `LinkRequest`; `confirmedTransferFields` already imported

### PR
- PR URL: (to be filled after creation)
- Status: Draft
