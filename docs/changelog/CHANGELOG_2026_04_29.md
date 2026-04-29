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

## Session: claude/balances-inline-create-forms-2hNSa — Phase 1b of accounts/loans-page retirement (inline create + edit forms)

### Symptom (user report, 2026-04-29)

After Phase 1 shipped (account detail dialog opens inline on
Balances), the user reported:

> "the same issue exists with adding accounts and loans, they also
> take me to the accounts and loans page instead of directly opening
> the dialogue to create a new loan or account."

### Root cause

The `+ Account` and `+ Loan` toolbar buttons on `/dashboard/balances`
were `router.push('/dashboard/accounts')` and
`router.push('/dashboard/loans')` respectively. Same problem class as
Phase 1's account-detail flow: the create/edit form lived only on
the legacy pages, so Balances had to navigate away to surface it.

The `Edit Account` button inside the new shared `AccountDetailDialog`
also routed to `/dashboard/accounts#<id>` instead of opening the form
inline (Phase 1 left it that way explicitly, marked as Phase 2 work).

### Solution

#### 1. `components/accounts/AccountFormDialog.tsx` — **new**

Shared create/edit form. Owns its own form state, validation, and
submit handler. Body shape matches the legacy `/dashboard/accounts`
page's POST/PUT contract to `/api/accounts` **exactly**:

- `interestRate` field is the percentage in the UI (e.g. 2.5) —
  divided by 100 before sending to the server (which stores
  decimal). Preserves the legacy contract precisely.
- `institution` empty string coerced to `null` in the body.
- `currentBalance` cast to `Number(...)` like before.

Edit-mode hydration converts the server-stored decimal back to %
so the user sees the same number they typed.

#### 2. `components/loans/LoanFormDialog.tsx` — **new**

Shared create/edit form for loans. Includes the Phase 19
`FormDocumentUpload` auto-fill integration and the post-save
document-link call to `/api/documents/{id}/link`. Body shape
matches `/api/loans` POST/PUT exactly:

- `principal`, `interestRateAnnual`, `termMonthsRemaining`,
  `minRepayment` cast to `Number(...)`.
- `fixedExpiry`, `extraRepaymentCap`, `propertyId`,
  `offsetAccountId`, `linkedAssetId`, `linkedAccountId` coerced
  to `null` when falsy.
- `interestRateAnnual` UI in % (form divides by 100 on every
  input change, mirrors legacy).
- `handleFieldsExtracted` (auto-fill from document analysis)
  preserved 1:1.

Lookup lists (`properties`, `offsetAccounts`, `allAccounts`,
`assets`) are passed in via props so the parent decides what to
populate.

#### 3. `/dashboard/balances` toolbar wired

- **+ Account** → `AccountFormDialog` in create mode.
- **+ Loan** → `LoanFormDialog` in create mode. Properties +
  Assets are lazy-fetched on first open (most users won't click
  `+ Loan`, so we don't bloat the initial page load).
- **Edit Account** (from `AccountDetailDialog`) → `AccountFormDialog`
  in edit mode (was: navigated to `/dashboard/accounts#<id>`).
- Page-level `reloadData()` exposed via `useCallback` so each
  form's `onSaved` callback can refresh the totals + section
  rows after a save.

#### 4. `/dashboard/accounts` migrated to shared form

- Replaced ~85 lines of inline `<Dialog>...form...</Dialog>` JSX
  with the shared `<AccountFormDialog>`.
- Removed: `formData`, `setFormData`, `editingId`, `setEditingId`,
  `handleSubmit`, `resetForm` page-level state and handlers.
- `handleEdit(account)` now just populates `editingAccount`
  and opens the dialog.

#### 5. `/dashboard/loans` migrated to shared form

- Replaced ~320 lines of inline `<Dialog>...form...</Dialog>` JSX
  with the shared `<LoanFormDialog>`.
- Removed: `formData`, `setFormData`, `editingId`, `setEditingId`,
  `attachedDocumentId`, `autoFilledFields`, `handleSubmit`,
  `resetForm`, `handleFieldsExtracted` page-level state and
  handlers — all moved into the shared component.
- `handleEdit(loan)` now just populates `editingLoan` and opens
  the dialog.
- `FormDocumentUpload` + `FieldMapping` imports removed (now used
  inside the shared component).

### CLAUDE.md compliance

- **§12.1 (No duplicate logic):** ~405 lines of inline dialog JSX
  + form state + submit handlers deduplicated across the two
  pages. Single source of truth for both forms.
- **§12.2 / §12.3 (SSOT, single calc engine):** **no calculations
  changed**. Form behaviour, validation, and API request bodies
  are byte-for-byte identical to what the legacy pages sent. No
  new calc engine added; no existing engine modified.
- **§6.7 (Entity dialogs):** the create/edit forms preserve the
  same field structure they always had, no UX regression.
- **§12.11 (Destructive write checklist):** NOT required — no
  Prisma writes added or modified. The only write paths
  (`POST/PUT /api/accounts` and `POST/PUT /api/loans`) are
  unchanged.

### Files Modified

- `components/accounts/AccountFormDialog.tsx` — **new file**
  (shared create/edit form for accounts).
- `components/loans/LoanFormDialog.tsx` — **new file** (shared
  create/edit form for loans, includes FormDocumentUpload).
- `app/dashboard/balances/page.tsx` — wire `+ Account` button to
  open `AccountFormDialog` create mode; wire `+ Loan` button
  with lazy-fetch of properties/assets; wire detail dialog's
  Edit button to inline form; expose `reloadData` callback.
- `app/dashboard/accounts/page.tsx` — replace inline form dialog
  with shared component; remove form-state code.
- `app/dashboard/loans/page.tsx` — replace inline form dialog
  with shared component; remove form-state + auto-fill code.
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` —
  added §7 documenting Phase 1, 1b, and the planned Phase 2.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 36 entry added
  to the phase status table.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).
- [ ] Manual testing pending — user will verify before Phase 2.

### Outstanding (Phase 2, awaiting user go-ahead after testing)

- Inline `LoanDetailDialog` on Balances (replace PR #550's
  `?focus=` redirect).
- Migrate `Connect Bank` (Basiq) toolbar action to Balances.
- Migrate `Import Transactions` toolbar action to Balances.
- Redirect `/dashboard/accounts` → `/dashboard/balances`.
- Redirect `/dashboard/loans` → `/dashboard/balances`.
- Sidebar cleanup if any legacy entries still point at the old
  pages.

## Session: claude/balances-add-source-picker-2hNSa — Phase 1c (Connect Bank toolbar + 2-tile source picker)

### User direction (2026-04-29)

> "when the BASIQ is enabled the bank connection will bring accounts
> and loans, also loans also have transactions so the import should
> be enabled for the loans as well. also I want the import file to
> be higher value than the manual create."

Plus an explicit ask to **mirror the wizard's `AccountsDataSourceTiles`
hierarchy**: Basiq > Import > Manual. After clarifying with the user
that "import for loans" maps to **Option A** (upload a PDF
document → AI auto-fill via the existing `FormDocumentUpload`),
this session ships:

### Changes

**Toolbar on `/dashboard/balances`:**

```
[🏦 Connect Bank]  [+ Account]  [+ Loan]
   ↑ promoted to top-level (Basiq covers accounts AND loans)
```

**`+ Account` click → 2-tile picker (`AddSourcePicker`):**

1. **Import bank statement** (Recommended, emerald) →
   `TransactionImportDialog`. Auto-creates account from file's
   closing balance when none is selected.
2. **Enter manually** (blue) → `AccountFormDialog` (Phase 1b).

**`+ Loan` click → 2-tile picker:**

1. **Upload loan document** (Recommended, emerald) →
   `LoanFormDialog` with the existing Phase 19 `FormDocumentUpload`
   at the top of the form. Drop a PDF, Gemini AI fills lender /
   principal / rate / term / repayment.
2. **Enter manually** (blue) → same `LoanFormDialog`.

**No "Import transaction file" tile for loans** — `UnifiedTransaction.accountId`
is non-nullable, so transactions can't exist standalone against a
loan. Loan repayment history flows through Basiq sync or through
bank-statement imports that match repayment debits to the loan via
existing categorisation rules. No new entry point needed.

### Files Modified

- `hooks/useBasiqConnect.ts` — **new file**. Lifts the legacy
  `handleConnectBank()` from `/dashboard/accounts/page.tsx` into a
  shared hook. Used by both the legacy page (replacing its inline
  function) and the new Balances toolbar button. Behaviour, body
  shape, MOBILE_REQUIRED redirect, error copy preserved EXACTLY.
- `components/ui/AddSourcePicker.tsx` — **new file**. Generic
  2-tile picker primitive. Pure presentation, caller-owned tile
  callbacks. Closes the picker before invoking the tile's handler
  so dialogs don't stack.
- `app/dashboard/balances/page.tsx` — Connect Bank top-level
  button (`useBasiqConnect`); `+ Account` and `+ Loan` open the
  source picker; `TransactionImportDialog` mounted on the page
  with `accounts` prop populated from the existing `accounts`
  state; reload-on-save / reload-on-account-created callbacks
  trigger `reloadData()`.
- `app/dashboard/accounts/page.tsx` — replaced the local
  `handleConnectBank` function with a call to the shared
  `useBasiqConnect()` hook. Sync / disconnect / connection-list
  management UI remain (Phase 2 will migrate them).
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` —
  added §7's "Phase 1c — Source picker + Connect Bank on
  Balances" subsection.

### CLAUDE.md compliance

- **§12.1 / §12.2 / §12.3:** `useBasiqConnect()` deduplicates the
  Basiq connect flow across the two pages. `AddSourcePicker` is a
  new presentational primitive (no calculation logic). **No calc
  engine added or modified.**
- **§6.7 (Entity dialogs):** picker is a 480px focused modal with
  the same calm visual hierarchy as the wizard's tiles.
- **§12.11 (Destructive write checklist):** NOT required — pure
  UI / hook extraction; no Prisma writes added or modified.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### Outstanding (Phase 2 — when user approves after testing)

- Migrate Basiq sync / disconnect UI to Balances (currently lives
  on legacy `/dashboard/accounts`).
- Inline `LoanDetailDialog` on Balances (replace PR #550's
  `?focus=` redirect).
- Redirect `/dashboard/accounts` → `/dashboard/balances`.
- Redirect `/dashboard/loans` → `/dashboard/balances`.
