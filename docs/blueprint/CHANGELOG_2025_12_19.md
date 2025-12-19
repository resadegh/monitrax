# Changelog — 2025-12-19

## Summary
Enhanced expenses page with separation of recurring vs discretionary expenses, clickable summary tiles for filtering, and improved UI for expense management.

---

## Features Added

### 1. Recurring vs Discretionary Expense Separation
**Files:** `app/dashboard/expenses/page.tsx`, `prisma/schema.prisma`

- New `isRecurring` field on Expense model to distinguish between recurring and one-off expenses
- **Recurring Expenses**: Bills, subscriptions, regular payments (isRecurring: true)
- **Discretionary Spending**: One-off purchases, impulse buys, variable spending (isRecurring: false)
- Existing expenses default to recurring for backwards compatibility

### 2. Clickable Summary Tiles on Expenses Page
**File:** `app/dashboard/expenses/page.tsx`

Four summary tiles with click-to-filter functionality:
- **Recurring Expenses** (blue) - Shows all recurring/committed expenses
- **Discretionary Spending** (purple) - Shows one-off/flexible expenses
- **Loan Repayments** (orange) - Shows loan repayment section
- **Total Outgoings** (red gradient) - Shows all expenses and loans

Click behavior:
- Click a tile to filter the expense list to that category
- Click again to deselect (show all)
- Active tile shows ring highlight
- Filter indicator badge shows current filter with clear button

### 3. Recurring Checkbox in Add/Edit Expense Form
**File:** `app/dashboard/expenses/page.tsx`

- New "This is a recurring expense" checkbox
- Helpful description changes based on checkbox state:
  - Checked: "Recurring expenses (bills, subscriptions) appear in your committed outgoings"
  - Unchecked: "One-off expenses (discretionary purchases) appear in your flexible spending"

### 4. Recurring/Discretionary Badges on Expense Cards
**File:** `app/dashboard/expenses/page.tsx`

- Expense cards now show Recurring (blue) or One-off (purple) badge
- Badge displays in both Tiles view and Detail dialog
- Helps users quickly identify expense type

### 5. Frequency Selector Conditional Display
**File:** `components/transactions/TransactionLinkDialog.tsx`

- Fixed: Frequency selector now only appears when "Recurring expense" checkbox is checked
- Previously was always visible regardless of checkbox state

### 6. Transfer Option for Incoming Transactions
**File:** `components/transactions/TransactionLinkDialog.tsx`

- Transfer toggle now appears for BOTH income and expense transactions
- For incoming money: Shows "Transfer From Account" with appropriate labels
- For outgoing money: Shows "Transfer To Account" (existing behavior)
- Button labels: "Mark as Incoming Transfer" / "Mark as Outgoing Transfer"
- Account selection is optional (user may not know the source account)
- Allows categorizing incoming transfers (e.g., money from another account) without counting as income

### 7. Category-Based Transaction Suggestions
**Files:** `app/api/transactions/[id]/link/route.ts`, `components/transactions/TransactionLinkDialog.tsx`

- Transaction suggestions now use the predicted category (e.g., "Utilities" for Origin Energy)
- Expenses matching the predicted category are included in suggestions with boosted confidence
- Category dropdown is pre-filled when creating a new expense based on the prediction
- Maps display category names (Utilities, Groceries, etc.) to ExpenseCategory enum values
- Helps users quickly categorize transactions to existing expenses in the same category

### 8. Batch Vendor Categorization
**Files:** `app/api/transactions/[id]/link/route.ts`, `components/transactions/TransactionLinkDialog.tsx`

When categorizing a transaction, the system now:
- **Same-Vendor Detection**: Finds all other uncategorized transactions from the same merchant
- **Batch Selection**: Shows a purple "Same Vendor" panel with checkboxes for each matching transaction
- **Pre-selected by Default**: All same-vendor transactions are pre-selected for convenience
- **Batch Categorization**: Apply the same category to all selected transactions at once
- **Visual Indicators**: Button labels show count (e.g., "Link (3)" or "Create Expense (+2 more)")

Example: Categorizing "Soul Origin" will show other Soul Origin transactions and categorize them all together.

### 9. Merchant Learning (Auto-Suggestions)
**Files:** `app/api/transactions/[id]/link/route.ts`, `prisma/schema.prisma` (MerchantMapping model)

When categorizing transactions:
- **Learn Checkbox**: "Remember for future [merchant] transactions" option (enabled by default)
- **Store Mapping**: Creates/updates `MerchantMapping` record with user -> merchant -> category
- **Future Suggestions**: New transactions from the same merchant auto-suggest the learned category
- **Confidence Tracking**: Tracks usage count to improve confidence over time
- **User-Specific**: Mappings are per-user, not global

UI Indicators:
- **Learned Category Badge**: Shows "Previously: [category]" badge on transactions with learned mappings
- **Pre-filled Category**: Category dropdown auto-selects the learned category

### 10. Uncategorized Transactions Default View
**Files:** `app/(dashboard)/transactions/page.tsx`, `app/api/unified-transactions/route.ts`

The Transaction Explorer page now defaults to showing only uncategorized transactions:
- **Default Filter**: Shows only transactions not linked to income/expense/loan and not marked as transfer
- **Clickable Summary Tiles**: Click on "Total Spend", "Total Income", or "Transactions" tile to view all related
- **Toggle Behavior**: Click the same tile again to return to uncategorized view
- **Visual Indicators**:
  - Amber banner shows "Showing uncategorized transactions only" when in default view
  - Blue ring highlight shows which tile is active
  - "Showing all" label appears on active tiles
- **Auto-Disappear**: When a transaction is categorized, it automatically disappears from the uncategorized list

This allows users to focus on categorizing their backlog while still being able to view all transactions when needed.

### 11. Auto-Navigate to Next Transaction
**Files:** `components/transactions/TransactionLinkDialog.tsx`, `app/(dashboard)/transactions/page.tsx`

After successfully categorizing a transaction, the dialog now:
- **Auto-Navigate**: Automatically moves to the next uncategorized transaction after 800ms delay
- **Auto-Close**: Closes the dialog if there are no more uncategorized transactions
- **Visual Feedback**: Brief success message shown before navigation
- **Seamless Flow**: Users can categorize multiple transactions without manually reopening the dialog

New dialog props:
- `onNavigateNext?: () => void` - Callback to navigate to next transaction
- `hasMoreTransactions?: boolean` - Whether more uncategorized transactions exist

---

## API Changes

### Expenses API
**Files:** `app/api/expenses/route.ts`, `app/api/expenses/[id]/route.ts`

- POST: Added `isRecurring` field to expense creation
- PUT: Added `isRecurring` field to expense updates
- Default value: `true` (for backwards compatibility)

### Transaction Link API
**File:** `app/api/transactions/[id]/link/route.ts`

- Create expense action now passes `isRecurring` flag
- Defaults to `false` for new expenses created from transactions (since these are typically one-off)

#### POST Request - New Parameters:
```typescript
interface LinkRequest {
  // ... existing fields ...
  additionalTransactionIds?: string[]; // Batch categorize multiple transactions
  learnMerchant?: boolean;             // Store merchant -> category mapping
}
```

#### GET Response - New Fields:
```typescript
{
  // ... existing fields ...
  sameVendorTransactions: Array<{      // Other transactions from same merchant
    id: string;
    date: string;
    description: string;
    merchantStandardised: string | null;
    amount: number;
    direction: 'IN' | 'OUT';
  }>;
  learnedCategory: string | null;      // Previously learned category for this merchant
}
```

### Unified Transactions API
**File:** `app/api/unified-transactions/route.ts`

New query parameters added:
- `uncategorized=true` - Filter to only show uncategorized transactions (no income/expense/loan link and not a transfer)
- `direction=IN|OUT` - Filter by transaction direction

```typescript
// Uncategorized filter: no income/expense/loan link and not a transfer
if (uncategorized === 'true') {
  where.incomeId = null;
  where.expenseId = null;
  where.loanId = null;
  where.isTransfer = false;
}

if (direction) where.direction = direction;
```

---

## Schema Changes

### Expense Model Addition
```prisma
model Expense {
  // ... existing fields ...
  isRecurring           Boolean            @default(true)  // Is this a recurring expense or one-off/discretionary?
}
```

---

## UI/UX Improvements

### Expenses Page Layout
- Summary tiles changed from 3-column to 4-column grid on large screens
- Tiles are now clickable with hover shadow effect
- Active filter shows ring highlight around tile
- Filter indicator badge below tiles when filter active

### Expense Tile View
- Added Recurring/One-off badge to expense cards
- Improved badge color scheme for better visibility

### Expense Detail Dialog
- Added "Type" field showing Recurring (blue) or Discretionary (purple)
- Positioned between Frequency and Essential fields

---

## Bug Fixes

### 1. Transfer Account Dropdown Not Loading
**File:** `components/transactions/TransactionLinkDialog.tsx`

**Issue:** The "Transfer From Account" / "Transfer To Account" dropdown was not showing any accounts when marking a transaction as a transfer.

**Root Cause:** The `loadBankAccounts` function was looking for `data.accounts` but the `/api/accounts` endpoint returns `{ data: [...accounts], _meta: {...} }`.

**Fix:**
```typescript
// Before (broken)
setBankAccounts(data.accounts || []);

// After (fixed)
setBankAccounts(data.data || []);
```

### 2. Transfers Not Excluded from Income/Expense Totals
**Files:** `lib/tie/types.ts`, `lib/tie/analytics.ts`, `app/api/unified-transactions/analytics/route.ts`

**Issue:** When a transaction was marked as a transfer, it was still being included in the Total Income and Total Spend calculations on the Transactions page.

**Root Cause:** The TIE analytics functions (`calculateSpendingSummary`, `calculateMonthlyTotals`) were not checking the `isTransfer` flag when calculating totals.

**Fix:**
1. Added `isTransfer` and `transferToAccountId` to `UnifiedTransaction` type in TIE
2. Updated analytics API to pass `isTransfer` when mapping transactions
3. Updated `calculateSpendingSummary` and `calculateMonthlyTotals` to exclude transfers:

```typescript
// Exclude transfers from income/expense calculations
const nonTransfers = filtered.filter((tx) => !tx.isTransfer);
const outgoing = nonTransfers.filter((tx) => tx.direction === 'OUT');
const incoming = nonTransfers.filter((tx) => tx.direction === 'IN');
```

### 3. Auto-Navigate Not Working After Categorization
**Files:** `components/transactions/TransactionLinkDialog.tsx`, `app/(dashboard)/transactions/page.tsx`

**Issue:** After categorizing a transaction, the dialog stayed on the same transaction instead of moving to the next uncategorized one.

**Root Cause:** The `onNavigateNext` callback was using a stale `transactions` array from a JavaScript closure. When `fetchTransactions()` was called asynchronously, the navigation timer (800ms) fired before the React state update completed, so it used outdated data that still included the just-categorized transaction.

**Fix:**
1. Changed `onLinked` prop type to return `Promise<void>` so the dialog can await it
2. Added a `transactionsRef` to track the latest transactions value
3. Updated `fetchTransactions` to synchronously update the ref when data arrives
4. `onNavigateNext` now reads from the ref to get fresh data

```typescript
// In transactions/page.tsx
const transactionsRef = useRef<Transaction[]>([]);
transactionsRef.current = transactions;

// In fetchTransactions
if (response.ok && json.success) {
  setTransactions(json.data);
  // Update ref immediately so navigation callback has fresh data
  transactionsRef.current = json.data;
}

// In onNavigateNext callback
onNavigateNext={() => {
  const currentTransactions = transactionsRef.current;
  if (currentTransactions.length > 0) {
    setLinkingTransaction(currentTransactions[0]);
  } else {
    setShowLinkDialog(false);
  }
}}

// In TransactionLinkDialog - await onLinked before navigating
await onLinked?.();
setTimeout(() => {
  if (hasMoreTransactions && onNavigateNext) {
    onNavigateNext();
  }
}, 800);
```

---

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `isRecurring` field to Expense model |
| `app/api/expenses/route.ts` | Added `isRecurring` to POST handler |
| `app/api/expenses/[id]/route.ts` | Added `isRecurring` to PUT handler |
| `app/api/transactions/[id]/link/route.ts` | Batch categorization, merchant learning, same-vendor detection |
| `app/api/unified-transactions/route.ts` | Added `uncategorized` and `direction` filter parameters |
| `app/(dashboard)/transactions/page.tsx` | Tile filter state, clickable summary cards, uncategorized default |
| `app/dashboard/expenses/page.tsx` | Major update: tiles, filtering, form checkbox, badges |
| `components/transactions/TransactionLinkDialog.tsx` | Transfer options, batch vendor UI, merchant learning toggle |
| `lib/tie/types.ts` | Added `isTransfer` and `transferToAccountId` to UnifiedTransaction |
| `lib/tie/analytics.ts` | Exclude transfers from spending summary and monthly totals |
| `app/api/unified-transactions/analytics/route.ts` | Pass `isTransfer` when mapping transactions to TIE |

---

## Migration Required

After deployment, run:
```bash
npx prisma migrate dev --name add_expense_is_recurring
```

---

## Commits

| Hash | Message |
|------|---------|
| `e94c8ec` | fix: Show frequency selector only when recurring expense checkbox is checked |
| `7d89f2c` | feat: Add recurring vs discretionary expense separation with clickable tiles |
| `c8d459e` | feat: Allow incoming transactions to be marked as transfers |
| `2485592` | feat: Use predicted category for transaction suggestions and pre-fill |
| `1e41704` | fix: Convert categoryMatch to explicit boolean for TypeScript compatibility |
| `d944772` | fix: Fix transfer account dropdown not loading accounts |
| `66681cd` | fix: Auto-navigate to next transaction after categorization |

---

*Changelog Version: 1.1*
*Date: 2025-12-19*
