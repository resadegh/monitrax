# MONITRAX CHANGELOG — December 4, 2025

**Session ID:** claude/fix-prompt-length-error-01CjVUZZsrZPvUyS2PmMS6tY
**Date:** 2025-12-04
**Status:** Implemented & Pending Push

---

## Summary of Changes

This session addressed transaction linking improvements, UI enhancements, sidebar navigation redesign, and investment module expansion for capital gains tracking.

---

## 1. Transaction Link & Update Button Fix

**Type:** Bug Fix
**Files Modified:**
- `components/transactions/TransactionLinkDialog.tsx`

### Problem
Some transaction entries only showed "Link Only" button. The "Link & Update" button was conditionally hidden when amounts matched.

### Solution
Removed the conditional `{!amountMatch && ...}` wrapper so both buttons always appear for all transaction entries (suggested matches, income entries, expense entries, and loan entries).

### Impact
- All transactions now show both "Link Only" and "Link & Update" buttons
- Users can always choose to update the target value to match the transaction

---

## 2. List View Toggle for Asset Pages

**Type:** Feature Enhancement
**Files Modified:**
- `app/dashboard/properties/page.tsx`
- `app/dashboard/loans/page.tsx`
- `app/dashboard/accounts/page.tsx`
- `app/dashboard/investments/accounts/page.tsx`

### Problem
Asset pages only had tile/card view which could become crowded with many entries.

### Solution
Added list view toggle to all four asset pages:

```typescript
type ViewMode = 'tiles' | 'list';
const [viewMode, setViewMode] = useState<ViewMode>('tiles');
```

Each page now includes:
- Toggle buttons (LayoutGrid / List icons)
- Table view with sortable columns
- Clickable rows for navigation
- Action buttons in table
- Footer totals

#### Properties List Columns
| Property | Type | Current Value | Purchase Price | Equity | LVR | Gain | Actions |

#### Loans List Columns
| Loan | Type | Principal | Rate | Repayment | Annual Interest | Property | Actions |

#### Accounts List Columns
| Account | Type | Institution | Balance | Interest Rate | Linked Loan | Actions |

#### Investment Accounts List Columns
| Account | Type | Platform | Total Value | Holdings | Transactions | Currency | Actions |

---

## 3. Transaction Linking with Category

**Type:** Feature Enhancement
**Files Modified:**
- `app/api/transactions/[id]/link/route.ts`

### Problem
When linking a transaction to an income/expense/loan, the transaction's `categoryLevel1` was not being set.

### Solution
Updated the `link` and `update` actions to set `categoryLevel1` based on the linked entity:

```typescript
// For income
categoryLevel1: income.type  // SALARY, RENT, RENTAL, INVESTMENT, OTHER

// For expense
categoryLevel1: expense.category  // HOUSING, UTILITIES, FOOD, etc.

// For loan
categoryLevel1: 'Loan Repayment'
```

### Impact
- Linked transactions now show proper category
- Categories roll up correctly in reports
- Better transaction categorization for insights

---

## 4. Collapsible Sidebar Navigation

**Type:** Feature Enhancement (Major UI Redesign)
**Files Modified:**
- `components/DashboardLayout.tsx`

### Problem
The sidebar had 17 navigation items which made it too long and difficult to navigate.

### Solution
Reorganized sidebar into 6 collapsible groups:

#### Standalone Items (Always Visible)
- Dashboard
- Personal CFO

#### Collapsible Groups

**Portfolio**
- Properties
- Loans
- Accounts
- Investments

**Transactions**
- Income
- Expenses
- Transactions
- Recurring

**Planning**
- Cashflow
- Financial Health
- Strategy
- Debt Planner
- Tax Calculator

**Reporting**
- Reports
- Documents

### Implementation
```typescript
interface NavGroup {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
  // Auto-expand group containing current route
});
```

### Features
- Click group header to expand/collapse
- Auto-expands group containing current page
- Smooth expand/collapse animations
- Active group header is highlighted
- Group state persists during navigation

---

## 5. Investment & Capital Gains Tracking (Phase 23)

**Type:** New Feature (Schema & Blueprint)
**Files Modified:**
- `prisma/schema.prisma`
- `docs/blueprint/PHASE_23_INVESTMENT_CAPITAL_GAINS.md` (NEW)

### Problem
Investment module lacked:
- Opening date and balance tracking
- Deposit/withdrawal tracking
- Current market value tracking
- Capital gains calculation for tax
- Purchase lot (parcel) tracking for accurate CGT

### Schema Changes

#### New Enums
```prisma
enum InvestmentTransactionType {
  // Existing
  BUY, SELL, DIVIDEND, DISTRIBUTION, DRP
  // NEW
  DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, CORPORATE_ACTION
}

enum CostBasisMethod {
  FIFO, LIFO, HIFO, SPECIFIC, AVERAGE
}

enum CapitalGainType {
  SHORT_TERM, LONG_TERM
}
```

#### Enhanced InvestmentAccount
```prisma
model InvestmentAccount {
  // NEW fields
  openingDate         DateTime?
  openingBalance      Float          @default(0)
  cashBalance         Float          @default(0)
  totalDeposits       Float          @default(0)
  totalWithdrawals    Float          @default(0)
  costBasisMethod     CostBasisMethod @default(FIFO)
}
```

#### Enhanced InvestmentHolding
```prisma
model InvestmentHolding {
  // NEW fields
  name                String?
  firstPurchaseDate   DateTime?
  totalCostBasis      Float          @default(0)
  currentPrice        Float?
  currentValue        Float?
  priceUpdatedAt      DateTime?
  unrealizedGain      Float?
  unrealizedGainPct   Float?
}
```

#### New Models
- **PurchaseLot** — Tracks individual purchase parcels for CGT
- **CapitalGainEvent** — Records realized gains/losses when selling
- **CapitalGainLotAllocation** — Links sales to purchase lots

### Blueprint Document
Created comprehensive Phase 23 blueprint at:
`docs/blueprint/PHASE_23_INVESTMENT_CAPITAL_GAINS.md`

Includes:
- CGT calculation rules (Australian)
- Cost basis methods (FIFO, LIFO, etc.)
- API endpoint specifications
- UI component designs
- Tax integration plan

---

## Commit History

| Commit | Message | Files Changed |
|--------|---------|---------------|
| `4bfc285` | fix(transactions): always show Link & Update button for all entries | 1 |
| `d6ca8f3` | feat(ui): add list view toggle to Properties, Loans, Accounts, and Investments pages | 4 |
| `989f2e4` | feat(transactions): set categoryLevel1 when linking transactions | 1 |
| `0f6b24c` | feat(ui): add collapsible navigation groups to sidebar | 1 |
| TBD | feat(investments): add capital gains tracking schema (Phase 23) | 2 |

---

## Testing Notes

- All changes passed TypeScript compilation (`npx tsc --noEmit`)
- Prisma schema validation pending (network access issue to Prisma binaries)
- No breaking changes to existing functionality

---

## Related Blueprint Phases

- **Phase 3** — Financial Engines (Investment models)
- **Phase 20** — Australian Tax Intelligence Engine (CGT integration)
- **Phase 23** — Investment & Capital Gains Tracking (NEW)

---

## Next Steps

1. Run Prisma migration for schema changes
2. Implement CGT calculation engine
3. Build investment transaction APIs
4. Update investment UI with new fields
5. Integrate capital gains with tax dashboard

---

*Document Version: 1.0*
*Created: 2025-12-04*
