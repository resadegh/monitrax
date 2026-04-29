# Phase 36: My Accounts — UX Simplification

> **TRAIL Stage:** Track
> **Status:** In Progress
> **Started:** 2026-04-18
> **Owner:** UX / Frontend

---

## 1. Problem

The current "My Accounts" section is fragmented across **six sub-pages** — Accounts, Loans, Income, Spending, Transactions, Recurring. This structure conflates two fundamentally different things:

1. **Financial reality** — what actually is (Accounts, Loans, Transactions, Recurring)
2. **Budget intentions** — what the user plans (Income, Spending)

The fragmentation causes:

- **Cognitive overload** — six equally-weighted tabs violate Hick's Law; every visit triggers a "which tab?" decision
- **Data distrust** — users see their Netflix charge in Spending *and* Recurring *and* Transactions and don't know which is authoritative
- **TRAIL dilution** — the TRACK stage contract is *"face your reality, no judgment"*. Budget intentions (Income/Spending manual entries) belong in REDUCE, not TRACK
- **Avoidance behaviour** — six tabs feel like six chores; the Barefoot "Date Night" framing only works when the app feels calm, not interrogative
- **Redundant forms** — once Basiq connects, direction-IN transactions *are* income and direction-OUT transactions *are* spending; separate manual-entry pages become duplicative

## 2. Solution

**Reduce six tabs to two.** Move budget intentions to the REDUCE stage where they belong.

### New structure

```
My Accounts (TRACK — "Here's your full picture")
├── Balances     — Accounts + Loans, unified (Assets / Credit / Debt sections)
└── Activity     — Transactions + Recurring, unified with filter chips

My Budget (REDUCE — "Fix the leaks")
├── Budget       — (existing)
├── Cashflow     — (existing)
├── Income       — (migrated from My Accounts)
├── Spending     — (migrated from My Accounts)
├── Debt Freedom — (existing)
└── Tax          — (existing)
```

### Design language

Apple-like, modern, minimal:

- Hero numbers with tabular-nums and generous whitespace
- Rounded cards (16px radius), subtle shadows, no heavy borders
- Gentle colour accents per category (green=assets, amber=credit, soft-red=debt)
- Subtle enter animations (200ms fade+slide, no bouncing)
- Live tiles where Basiq freshness matters (last-synced, next-expected)
- No form-heavy tiles as the default view — drill-into-dialog pattern
- Tabular nums on every balance so the decimals line up

## 3. Non-Negotiable Constraint: PRESERVE ALL RELATIONSHIPS

This is a **UI-only refactor**. The data graph in `prisma/schema.prisma` is **not touched**.

### Relationships that MUST remain intact

| Relationship | Field | Preserved behaviour |
|---|---|---|
| Loan ↔ Property | `Loan.propertyId` | LVR, equity, rental yield, negative gearing calcs still flow through `masterFinancialService` |
| Account ↔ Loan (offset) | `Loan.offsetAccountId` (unique) | Offset interest reduction still calculated; offset link surfaced in both Loan and Account rows |
| Loan ↔ Asset (car) | `Loan.linkedAssetId` | Vehicle depreciation + payoff tracking unchanged |
| Loan ↔ Account (LOC) | `Loan.linkedAccountId` | Line-of-credit revolving balance unchanged |
| UnifiedTransaction ↔ Property/Loan/Income/Expense/Investment | tag fields on `UnifiedTransaction` | All tags survive; Activity tab exposes them as filters |
| Income ↔ Property (rental) / Investment (dividends) | `Income.propertyId`, `Income.investmentAccountId` | Rental yield, franking calcs unchanged |
| Expense ↔ Property/Loan/Investment/Asset | `Expense.propertyId`, etc. | Deductibility, ownership-cost attribution unchanged |
| RecurringPayment ↔ Expense | `RecurringPayment.linkedExpenseId` | Phase 29 budget reconciliation unchanged |

### What does NOT change

- Every Prisma model, field, and `@relation`
- Every API route (`/api/accounts`, `/api/loans`, `/api/unified-transactions`, `/api/recurring-payments`, `/api/income`, `/api/expenses`)
- Every canonical service (`masterFinancialService`, `netWorthCalculator`, `cashflowOrchestrator`)
- Every entity dialog (Overview / Linked Data / Insights / Actions)
- Every GRDCS link and cross-module navigation path
- All existing edit/create forms — they are reachable as dialogs from the new unified pages

### What DOES change

- Sidebar: "My Accounts" children go from 6 entries to 2 (Balances, Activity)
- Sidebar: "My Budget" children add Income and Spending
- Two new pages: `app/dashboard/balances/page.tsx`, `app/dashboard/activity/page.tsx`
- The old pages remain accessible via direct URL — they are not deleted, so any bookmarks, in-app links, or tests keep working during the transition
- Minor copy changes in the TRAIL framework doc

## 4. Rollout Plan

1. Add the two new pages and sidebar update in this PR (no old-page deletions)
2. Monitor usage — if the new pages absorb all traffic, in a follow-up PR the old pages can redirect to the new locations
3. Eventually deprecate the old pages when no internal link points to them

## 5. Psychology & Visual Principles

- **Loss aversion** — show Net Position as the hero number, so debt is contextual, not a separate tab screaming at the user
- **Hick's Law** — 2 tabs = instant decisions, 6 tabs = 2-second hesitation every visit
- **Single source of truth** — one view of transactions means users stop second-guessing which number is real
- **Progressive disclosure** — filters inside one page feel like exploring; separate pages feel like the app is fragmenting your life
- **Calm visual hierarchy** — one big number, medium subtotals, small row items; user eye flow is top→down, not scatter

## 6. Checklist

- [x] Phase 36 spec doc (this file)
- [ ] `TRAIL_FRAMEWORK.md` updated to reflect 2-tab My Accounts + Income/Spending under My Budget
- [x] `/dashboard/balances` page created
- [x] `/dashboard/activity` page created
- [x] `DashboardLayout.tsx` sidebar updated
- [ ] Subtle animation utilities added to `globals.css`
- [x] Build passes
- [x] Changelog entry at `docs/changelog/CHANGELOG_2026_04_18.md`

## 7. Phase 36b — Inline dialogs on Balances (2026-04-29)

> **Goal:** retire `/dashboard/accounts` and `/dashboard/loans` as
> primary navigation targets. They keep working via direct URL but
> the canonical entry point is `/dashboard/balances`.
>
> **Approach:** extract the detail / create / edit dialogs into
> shared components in `components/accounts/` and `components/loans/`
> so any page can render them. Then wire `/dashboard/balances` to
> open them inline instead of navigating away.

### Phase 1 — Account detail (PR #552, merged)

- New `components/accounts/AccountDetailDialog.tsx` (Overview /
  Transactions / Offset Details / Linked tabs).
- `/dashboard/balances` row click → opens dialog inline (was:
  navigated to `/dashboard/accounts#<id>` which didn't auto-open
  the dialog, forcing a second click).
- `/dashboard/accounts` migrated to use the same shared component
  (~307 lines of inline JSX deduplicated).
- SSOT (CLAUDE.md §12.2): replaced one local helper
  (`calculateEffectiveLoanBalance`) with the existing canonical
  `calculateEffectivePrincipal` from `lib/utils/calculations.ts`.
  Interest-savings formula preserved EXACTLY per user direction
  (existing calculations are correct, no new engines).

### Phase 1b — Account / Loan create + edit (this session)

- New `components/accounts/AccountFormDialog.tsx` — shared
  create/edit form. Owns its own form state, validation, and
  submit handler. Body shape matches the legacy POST/PUT contract
  to `/api/accounts` exactly (incl. `interestRate / 100` decimal
  conversion).
- New `components/loans/LoanFormDialog.tsx` — shared create/edit
  form for loans. Includes the Phase 19 `FormDocumentUpload`
  auto-fill integration and the post-save document-link call to
  `/api/documents/{id}/link`. Body shape matches `/api/loans`
  POST/PUT exactly.
- `/dashboard/balances` toolbar wired:
  - **+ Account** → opens `AccountFormDialog` in create mode
    (was: `router.push('/dashboard/accounts')`).
  - **+ Loan** → opens `LoanFormDialog` in create mode (was:
    `router.push('/dashboard/loans')`). Properties + Assets
    lookups are lazy-fetched on first open.
  - **Edit Account** (from detail dialog) → opens
    `AccountFormDialog` in edit mode inline (was: navigated to
    `/dashboard/accounts#<id>`).
- `/dashboard/accounts` migrated to use the shared
  `AccountFormDialog` — replaces ~85 lines of inline form JSX
  + the `formData`/`handleSubmit`/`resetForm`/`handleEdit`
  state/handlers.
- `/dashboard/loans` migrated to use the shared `LoanFormDialog`
  — replaces ~320 lines of inline form JSX + the form state +
  `handleFieldsExtracted` + `handleSubmit` + `resetForm`.

**Calculation/contract changes: zero.** Per user direction the
existing logic on legacy and current pages is correct — Phase 1b
is purely visual / flow, no behavioural change to forms,
validation, API contracts, or document-linking.

### Phase 1c — Source picker + Connect Bank on Balances (this session, 2026-04-29)

User direction:
> "when the BASIQ is enabled the bank connection will bring accounts
> and loans, also loans also have transactions so the import should
> be enabled for the loans as well. also I want the import file to
> be higher value than the manual create."

**Toolbar layout on `/dashboard/balances`:**

```
[🏦 Connect Bank]  [+ Account]  [+ Loan]
   (Basiq, accounts + loans — recommended)
```

- **Connect Bank** is now a top-level toolbar button. Wired to a
  new shared `useBasiqConnect()` hook (`hooks/useBasiqConnect.ts`)
  so the legacy `/dashboard/accounts` page and the new Balances
  page invoke the same code path. Behaviour, body shape, error
  handling, and copy preserved EXACTLY from the legacy
  `handleConnectBank()` implementation.
- **`+ Account`** opens a 2-tile picker (`AddSourcePicker`):
  - **Import bank statement** (recommended, emerald) → opens
    `TransactionImportDialog` (existing component, no changes).
    Auto-creates the account from the file's closing balance when
    no account is selected.
  - **Enter manually** (secondary, blue) → opens
    `AccountFormDialog` (Phase 1b component).
- **`+ Loan`** opens a 2-tile picker:
  - **Upload loan document** (recommended, emerald) → opens
    `LoanFormDialog`. The form already hosts `FormDocumentUpload`
    (Phase 19) at the top — drop a PDF statement / contract and
    Gemini AI auto-fills lender / principal / rate / term /
    repayment.
  - **Enter manually** (secondary, blue) → opens the same
    `LoanFormDialog` without the document-upload affordance
    emphasised. Same component, no duplication.

**Loans don't get a "Import transaction file" tile** because the
existing `TransactionImportDialog` only writes into `Account`
rows (`UnifiedTransaction.accountId` is a non-nullable FK). Loan
repayments still flow through Basiq syncing the linked payment
account, or through bank-statement imports that match repayment
debits to the loan via existing categorisation rules. Neither
needs a new entry point on Balances.

**Components reused (no recreation, per CLAUDE.md §12.1-§12.3):**

- `TransactionImportDialog` — used as-is.
- `AccountFormDialog`, `LoanFormDialog` — Phase 1b components,
  no changes.
- `useBasiqConnect()` — new hook lifting the legacy connect
  function. Sync and disconnect remain on the legacy page (Phase
  2 will migrate them alongside the management UI).
- `AddSourcePicker` — new generic 2-tile picker primitive in
  `components/ui/`. Pure presentation; the parent owns the tile
  callbacks.

**Calculation/contract changes: zero.** Same Basiq endpoints, same
import body shape, same form submit handlers as Phase 1b.

### Phase 2 — Retire `/dashboard/accounts` and `/dashboard/loans` (planned)

- Migrate `Connect Bank` (Basiq) toolbar action to
  `/dashboard/balances`.
- Migrate `Import Transactions` toolbar action to
  `/dashboard/balances`.
- Inline the `LoanDetailDialog` on `/dashboard/balances` (replaces
  PR #550's `?focus=` redirect to `/dashboard/loans`).
- Redirect `/dashboard/accounts` → `/dashboard/balances`.
- Redirect `/dashboard/loans` → `/dashboard/balances`.
- Sidebar: remove any legacy entries still pointing at the old
  pages.

### Out of scope for Phase 36b

- AI Strategy sub-page at `/dashboard/loans/[id]/strategy` — keeps
  its own dedicated route. Linked to from the LoanDetailDialog.
- `TransactionImportDialog` flow on the legacy `/dashboard/accounts`
  page — moved as a whole in Phase 2, not piecemeal.
- Any change to financial calculations — explicitly forbidden in
  Phase 36b per user direction.
