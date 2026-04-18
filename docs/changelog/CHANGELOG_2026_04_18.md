# Changelog — 2026-04-18

## Session: NWVJk — Phase 36: My Accounts simplification

### Changes Made

- **Type**: UX / Frontend (consolidation + visual refresh)
- **Scope**: My Accounts navigation, TRAIL framework documentation, global animations
- **Root cause** (of the UX friction being addressed):
  - Six sibling tabs (Accounts, Loans, Income, Spending, Transactions, Recurring) violated Hick's Law and conflated *reality* (bank-sourced) with *intention* (manually entered budget targets).
  - Users could not tell which of the four transactional-looking views was authoritative, which eroded trust in the data.
  - The TRAIL TRACK stage is defined as "face your reality, no judgment" — manually entered Income and Spending are budget intentions and belong to the REDUCE stage.
- **Solution**:
  - Consolidate My Accounts from six tabs to two (**Balances**, **Activity**).
  - Move Income and Spending under **My Budget** (REDUCE stage).
  - No data model, API, or business-logic changes. All Prisma relationships, GRDCS links, and canonical services remain untouched.
  - New Apple-like presentation layer: hero number, grouped sections, tabular-nums, subtle fade/rise animations, calm empty states.

### Relationships preserved (non-negotiable constraint)

All entity relationships are preserved exactly as they existed:

| Relationship | Field | How it is surfaced in the new UI |
|---|---|---|
| Loan ↔ Property | `Loan.propertyId` | "Secured by {property}" chip on every loan row |
| Account ↔ Loan (offset) | `Loan.offsetAccountId` | Offset chip on loan row + "Offsets {loan}" line on account row; "Net after offset" sub-value shown |
| Loan ↔ Asset (car) | `Loan.linkedAssetId` | "Vehicle: {asset}" chip on car loan rows |
| Loan ↔ Account (LOC) | `Loan.linkedAccountId` | "Card: {account}" chip on line-of-credit rows |
| UnifiedTransaction links | `propertyId / loanId / incomeId / expenseId / investmentAccountId` | Transaction row drill-through prefers the linked entity (property → property page, loan → loan page, otherwise account) |
| Income ↔ Property / Investment | `Income.propertyId`, `Income.investmentAccountId` | Preserved; existing /dashboard/income page unchanged — moved under My Budget nav only |
| Expense ↔ Property / Loan / Investment / Asset | `Expense.*` | Preserved; existing /dashboard/expenses page unchanged — moved under My Budget nav only |
| RecurringPayment ↔ Expense | `RecurringPayment.linkedExpenseId` | "Linked" / "Unlinked" badge on every recurring row |

### Files Modified

- `components/DashboardLayout.tsx` — My Accounts children collapsed from 6 → 2 (Balances, Activity); My Budget children expanded to include Income and Spending. `matchRoutes` retains legacy paths so deep-linked old URLs still highlight the correct nav item.
- `docs/blueprint/TRAIL_FRAMEWORK.md` — TRACK stage section references Balances/Activity; REDUCE section references Income/Spending; 19-page mapping table updated to reflect Phase 36 moves.
- `app/globals.css` — added Phase 36 animation utilities: `.anim-fade-in`, `.anim-rise`, `.anim-rise-stagger`, `.pulse-dot`, `.hover-lift`, `.tabular-nums`. All respect `prefers-reduced-motion`.

### Files Created

- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — spec doc with preserved-relationships contract, rollout plan, and psychology rationale.
- `app/dashboard/balances/page.tsx` — new unified Balances page. Hero net position, three grouped sections (Cash / Credit / Debt), per-row relationship chips. Uses existing `/api/accounts`, `/api/loans`, `/api/basiq/connections` — no API changes.
- `app/dashboard/activity/page.tsx` — new unified Activity page. Month-summary tiles, filter chips (All / Money in / Money out / Recurring / Anomalies), day-grouped transaction list, recurring view as a filter lens (not a separate page). Uses existing `/api/unified-transactions`, `/api/unified-transactions/recurring` — no API changes.
- `docs/changelog/CHANGELOG_2026_04_18.md` — this file.

### What did NOT change

- No Prisma schema changes. No migration files.
- No API route changes. No service-layer changes.
- No deletion of the old `/dashboard/accounts`, `/dashboard/loans`, `/transactions`, `/recurring`, `/dashboard/income`, `/dashboard/expenses` pages — they remain reachable by direct URL for detailed edits, and the new pages link out to them for CRUD. A follow-up PR can redirect or retire them once traffic migrates.
- No component library changes. Uses existing shadcn/ui primitives.

### Build Status

| Step | Status | Notes |
|---|---|---|
| `npx tsc --noEmit` | PASS | Clean, only pre-existing `baseUrl` deprecation note |
| `npm run build` | PASS | New routes compiled: `/dashboard/balances` 3.85 kB, `/dashboard/activity` 4.83 kB. Single pre-existing warning in `@google-cloud/error-reporting` (unrelated) |

### Design notes

- One hero number per page (Net position on Balances; Net this month on Activity).
- Subtle `anim-rise` stagger on list entry (≤260 ms, `prefers-reduced-motion` respected).
- Live-ish Basiq freshness tile with `pulse-dot` when banks are connected.
- Generous whitespace, 2xl rounded cards, 1px borders instead of shadows — Apple feel.
- Tabular-nums on every balance so decimals line up vertically.

### TRAIL alignment

- TRACK ("Here's your full picture") now contains only reality (Balances, Activity).
- REDUCE ("Fix the leaks") gains Income and Spending — the budget intentions they always were.
- Purity of the TRACK emotional contract restored: no judgment, just data.

### Rollout

- Old pages intentionally kept live — zero breakage of bookmarks, deep links, or in-app cross-module links.
- Follow-up PR can add redirects from `/dashboard/accounts` → `/dashboard/balances` etc. once we confirm the new pages absorb all real user flows.

### PR

- Branch: `claude/review-monitrax-docs-NWVJk`
- Status: pushed
