# Changelog — 2026-04-29 (continued)

## Session: claude/balances-account-detail-dialog-2hNSa — Phase 1 of accounts-page retirement (inline detail dialog + SSOT calculations)

### Symptom (user report)

Clicking an account row on `/dashboard/balances` navigated to
`/dashboard/accounts#<id>` which didn't auto-open the detail dialog
(no `location.hash` reader was wired up). The user had to click the
account tile a second time to see the details. Two clicks + a page
transition for what should be a single click.

### Root cause + scope

The `/dashboard/accounts` page hosts the only copy of the
AccountDetailDialog (Overview / Transactions / Offset / Linked
tabs). The Balances page can't render the same UI without
duplicating ~300 lines of JSX, so it linked out instead — but the
target page didn't auto-open the dialog, leaving users stuck.

The user agreed to a phased approach:

- **Phase 1 (this PR)** — extract the dialog into a shared
  component, render it inline on `/dashboard/balances`. Single
  click → dialog. The `/dashboard/accounts` page keeps working
  unchanged via the same shared component (no duplicated JSX).
- **Phase 2 (later PR)** — retire `/dashboard/accounts` entirely.
  Migrate the toolbar (Connect Bank, Import) to balances. Inline
  the create / edit dialogs. Redirect `/dashboard/accounts` →
  `/dashboard/balances`.

### Solution

#### 1. Shared `AccountDetailDialog` component

New file: `components/accounts/AccountDetailDialog.tsx`. Pure
presentation — side-effects (edit, import, GRDCS navigation) are
caller-supplied via props:

```ts
interface AccountDetailDialogProps {
  account: AccountDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (account: AccountDetail) => void;
  onImportClick?: () => void;
  onLinkedEntityNavigate?: (entity: GRDCSLinkedEntity) => void;
}
```

When `onImportClick` is omitted (e.g. on the Balances page, which
doesn't yet host a `TransactionImportDialog`), the import button
is hidden — the dialog stays useful without forcing every caller
to wire up an import flow.

Pagination state (`txPage`) is internal to the component and
resets when the user opens the dialog for a different account
(otherwise switching from a 3-page transactions list to a 1-page
one would strand the user on a non-existent page 3).

#### 2. SSOT: use only existing canonical engines (CLAUDE.md §12.2)

The original dialog had two locally-defined helpers:

```ts
function calculateInterestSavings(account) { ... }
function calculateEffectiveLoanBalance(account) { ... }
```

Per user direction (2026-04-29):
> "the calculations and relationships on all the legacy and
> current pages are correct, so don't create new logics without
> confirmation … use the existing logics and engines for the new
> changes. for now the changes I am asking are mainly visual and
> flow related"

So this PR:

- **Replaces** `calculateEffectiveLoanBalance` — structurally
  identical to the canonical
  `calculateEffectivePrincipal(principal, offsetBalance)` already
  in `lib/utils/calculations.ts`. Same math
  (`Math.max(0, principal - offsetBalance)`), no behavioural
  change. SSOT-safe deduplication.
- **Preserves** the legacy interest-savings formula EXACTLY:
  `offsetBalance × loanAnnualRate`. No new primitive added to
  `lib/utils/calculations.ts`; no composition that would shift
  edge-case behaviour. The dialog and the legacy
  `/dashboard/accounts` page both use the literal formula until
  the user explicitly directs a calculation change.

Net result on `lib/utils/calculations.ts`: **unchanged**.
Net result on calculation behaviour anywhere in the app:
**unchanged**.

#### 3. Wiring on `/dashboard/balances`

- Added dialog state (`detailAccount`, `detailOpen`).
- Converted the `<Link href="/dashboard/accounts#...">` row into a
  `<button onClick={...}>` that opens the dialog inline.
- Added `useCrossModuleNavigation` for the GRDCS Linked tab —
  forced the page to be wrapped in `<Suspense>` (Next.js 15
  requires this around any `useSearchParams` consumer). Mirrors
  the pattern PR #550 introduced on `/dashboard/loans`.
- "Edit Account" still routes to `/dashboard/accounts#<id>` —
  Phase 2 will inline the edit form.

#### 4. Migration on `/dashboard/accounts`

The legacy `/dashboard/accounts` page now renders the same shared
dialog:

```tsx
<AccountDetailDialog
  account={selectedAccount}
  open={showDetailDialog}
  onOpenChange={setShowDetailDialog}
  onEdit={handleEdit}
  onImportClick={() => setShowImportDialog(true)}
  onLinkedEntityNavigate={handleLinkedEntityNavigate}
/>
```

Replaces ~307 lines of inline JSX with the shared component.

`Account.institution` and `Transaction.category` types were
loosened from `string | undefined` to `string | null | undefined`
to match the server response shape (Prisma returns `null` for
optional strings) and the shared dialog's prop types.

### Files Modified

- `components/accounts/AccountDetailDialog.tsx` — **new file**.
  Shared dialog component (Overview / Transactions / Offset /
  Linked tabs, pagination, GRDCS Linked-tab support).
- `lib/utils/calculations.ts` — **unchanged**. (Earlier drafts of
  this PR added a new helper, then composed existing primitives;
  both reverted per user direction — Phase 1 is purely visual /
  flow, no calculation changes.)
- `app/dashboard/balances/page.tsx` — render the shared dialog;
  convert account-row link to button; add Suspense wrapper for
  `useSearchParams`; type-extended `AccountRow` to include
  `transactions` + `_links` + `_meta` (already returned by the
  server, just newly consumed).
- `app/dashboard/accounts/page.tsx` — replace inline dialog with
  shared component; widen `Account.institution` and
  `Transaction.category` to `string | null | undefined`; replace
  local `calculateInterestSavings` / `calculateEffectiveLoanBalance`
  with imports from `lib/utils/calculations.ts`.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### CLAUDE.md compliance

- **§12.1 (No duplicate logic):** dialog JSX deduplicated; offset
  calculations deduplicated.
- **§12.2 (Single Source of Truth):** offset calculations live in
  `lib/utils/calculations.ts`. Doc comments at every import site
  forbid redefining locally.
- **§12.3 (Single Calculation Engine):** no new engine added.
  No existing engine modified. Calculation behaviour on every
  page is identical to before this PR.
- **§6.7 (Entity dialogs):** the dialog has Overview / Linked /
  (and the existing) Transactions / Offset Details tabs.
- **§12.11 (Destructive write checklist):** NOT required — no
  Prisma writes in this PR.

### Outstanding (Phase 2)

- **`+ Account` / `+ Loan` toolbar buttons** still navigate to
  `/dashboard/accounts` and `/dashboard/loans` instead of opening
  create dialogs inline. Same root issue as the detail dialog
  before this PR. Tracked for Phase 1b / Phase 2:
  - Extract the create/edit account form into a shared dialog
    component (parallel to `AccountDetailDialog`).
  - Same for the loan create/edit form.
  - Render both on `/dashboard/balances`.
- **Retire `/dashboard/accounts`:** migrate Connect Bank / Import
  toolbar actions to balances; redirect the route to
  `/dashboard/balances`.
- **Loan detail dialog inline:** PR #550 used a `?focus=<id>`
  redirect; same pattern as Phase 1 here would let it open
  inline on Balances.
- **Standalone loan detail page:** still tracked from PR #550.
