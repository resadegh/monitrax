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
- [ ] `/dashboard/balances` page created
- [ ] `/dashboard/activity` page created
- [ ] `DashboardLayout.tsx` sidebar updated
- [ ] Subtle animation utilities added to `globals.css`
- [ ] Build passes
- [ ] Changelog entry at `docs/changelog/CHANGELOG_2026_04_18.md`
