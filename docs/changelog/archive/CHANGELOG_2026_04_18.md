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

---

## Session: NWVJk — Phase 36 follow-up: Activity = full legacy functionality + Apple visuals

### Why a follow-up

The first cut of `/dashboard/activity` was a view-only list — it omitted the
categorisation workflow (TransactionLinkDialog), the import wizard,
server-side pagination, and the full server-side filter set. That is the
entire reason the legacy `/transactions` page exists, and the
"uncategorise → link to Income/Expense/Loan" loop is the engine behind
Phase 29 (recurring matching) and Phase 30 (budget vs actual). Shipping a
nav rename without that workflow would have broken the app for every user
who relies on tagging their transactions.

### What changed

- **`app/dashboard/activity/page.tsx` rewritten** from view-only list →
  full Transaction Explorer functionality, with Apple visuals.
  - State, callbacks, ref, dialogs, filters, pagination copied verbatim
    from `app/(dashboard)/transactions/page.tsx`.
  - Same API surface (`/api/unified-transactions`, `/analytics`,
    `/api/accounts`).
  - Same `TransactionLinkDialog` + `ImportWizard` imports.
  - Visual layer fully redesigned (rounded 2xl, tabular-nums, soft accents,
    day-grouping, chip filters, calm "uncategorised first" pill).
  - Confidence badge now only renders when score < 0.9 (reduce noise).
- **`app/(dashboard)/transactions/page.tsx` reduced to a 1-line redirect**
  to `/dashboard/activity`. All bookmarks + any internal link still works.
- **Phase 36 spec doc** — section 7 added describing the rebuild.
- **Sidebar unchanged** — nav still points to `/dashboard/balances` and
  `/dashboard/activity`. The `matchRoutes` array already included
  `/transactions`, so the redirect path also keeps the My Accounts nav
  item highlighted while the redirect takes effect.

### Functionality preserved (1:1, no behaviour changes)

| Legacy feature | Preserved in new Activity? |
|---|---|
| Server-side pagination (25/page) | ✅ |
| Search (server-side) | ✅ |
| Account filter | ✅ (in advanced panel) |
| Category filter | ✅ (in advanced panel) |
| Date range filter | ✅ (in advanced panel) |
| Recurring-only toggle | ✅ (chip) |
| Anomalies-only toggle | ✅ (chip) |
| 4 click-to-filter summary tiles | ✅ (Apple-restyled) |
| "Uncategorised first" default | ✅ (calmer pill banner) |
| TransactionLinkDialog (categorise/link) | ✅ |
| Navigate-to-next-uncategorised flow | ✅ (uses `transactionsRef` to avoid stale closure) |
| ImportWizard (CSV/QIF/OFX) | ✅ |
| Linked / Transfer / Recurring / Anomaly indicators | ✅ |
| AI confidence badges | ✅ (now only shown when < 0.9) |

### Visual changes

- Hero: "What's moving" + warm subtitle
- 2xl rounded cards, soft category pill colours (50/700 instead of 100/800)
- Filter chip strip with Recurring / Anomalies / Advanced toggles
- Slide-down advanced filter panel with active-filter count badge
- Day-grouped transaction list with day-net subtotals
- Pagination as pill buttons (chevron-left / chevron-right)
- Subtle animations: `anim-rise-stagger` on tiles, `anim-rise` on list,
  `anim-fade-in` on import wizard backdrop
- "Uncategorised first" pill replaces the legacy amber alert banner

### Build status

| Step | Status | Notes |
|---|---|---|
| `npm run build` | PASS | `/dashboard/activity` 15.5 kB, `/transactions` 642 B (redirect) |

### Out of scope for this iteration

- `/recurring` page — left alone. Its matching workflow is non-trivial and
  warrants its own visual pass.
- Other pages still using legacy "tile + form" patterns (Income, Spending,
  Properties, Investments, etc.) — separate follow-ups.

### Files modified

- `app/dashboard/activity/page.tsx` — full rewrite
- `app/(dashboard)/transactions/page.tsx` — replaced body with redirect
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — section 7 added
- `docs/changelog/CHANGELOG_2026_04_18.md` — this entry
