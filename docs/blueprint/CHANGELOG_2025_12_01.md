# MONITRAX CHANGELOG — December 1, 2025

**Session ID:** claude/fix-prompt-length-error-01CjVUZZsrZPvUyS2PmMS6tY
**Date:** 2025-12-01
**Status:** Implemented & Pushed

---

## Summary of Changes

This session addressed multiple bug fixes, feature enhancements, and a significant UI redesign to improve the Monitrax user experience. All changes have been committed and pushed.

---

## 1. OAuth Redirect URI Fix

**Commit:** `086fbe0`
**Type:** Bug Fix
**Files Modified:**
- `app/api/settings/storage/connect/[provider]/route.ts`
- `app/api/oauth/callback/google-drive/route.ts`
- `app/api/oauth/callback/onedrive/route.ts`
- `app/api/oauth/callback/icloud/route.ts`

### Problem
When connecting cloud storage providers (Google Drive, OneDrive, iCloud), the OAuth flow failed with `redirect_uri=undefined/api/oauth/callback/google-drive` because `NEXT_PUBLIC_APP_URL` environment variable was not set in the deployment environment.

### Solution
Added a `getBaseUrl(request: Request)` helper function to all OAuth-related routes that dynamically derives the base URL from the incoming request when the environment variable is undefined:

```typescript
function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
```

### Impact
- OAuth flows now work correctly regardless of environment variable configuration
- No breaking changes to existing functionality

---

## 2. Settings Page Navigation

**Commit:** `73c9a11`
**Type:** Feature Enhancement
**Files Modified:**
- `app/dashboard/settings/layout.tsx`

### Problem
The settings page had no way to navigate back to the dashboard, leaving users trapped without using browser navigation.

### Solution
Added two navigation elements to the settings layout:
1. **Back Arrow Button** (left side) — Uses `ArrowLeft` icon with link to `/dashboard`
2. **Close Button** (right side) — Uses `X` icon with "Close" label

### UI Changes
```tsx
<Link href="/dashboard">
  <Button variant="ghost" size="icon" className="h-10 w-10">
    <ArrowLeft className="h-5 w-5" />
  </Button>
</Link>
// ... header content ...
<Link href="/dashboard">
  <Button variant="outline" size="sm" className="gap-2">
    <X className="h-4 w-4" />
    Close
  </Button>
</Link>
```

---

## 3. Receipt Upload for Expenses

**Commit:** `595f088`
**Type:** Feature (Phase 19.1 Completion)
**Files Modified:**
- `app/dashboard/expenses/page.tsx`

### Problem
Phase 19.1 (Document Management Expansion) specified that users should be able to upload receipts directly when entering or editing expenses, but this functionality was missing.

### Solution
Added comprehensive receipt upload functionality:

1. **New State Variables:**
   - `selectedFile` — File selected for upload
   - `attachedDocuments` — Documents attached to current expense
   - `uploadingFile` — Upload progress indicator

2. **File Upload Handler:**
   ```typescript
   const uploadReceiptFile = async (expenseId: string, file: File) => {
     const formData = new FormData();
     formData.append('file', file);
     formData.append('category', DocumentCategory.RECEIPT);
     formData.append('links', JSON.stringify([
       { entityType: LinkedEntityType.EXPENSE, entityId: expenseId }
     ]));
     // POST to /api/documents
   };
   ```

3. **UI Components Added:**
   - File input in add/edit expense dialog
   - "Documents" tab in expense detail view
   - Quick upload option while viewing expense details
   - File size display helper function

### Impact
- Users can now attach receipts directly when creating/editing expenses
- Receipts are automatically linked to the expense entity
- Supports images, PDFs, and Word documents

---

## 4. Loan Repayments in Cashflow Calculations

**Commit:** `044df22`
**Type:** Bug Fix (Critical)
**Files Modified:**
- `app/dashboard/properties/page.tsx`
- `app/api/portfolio/snapshot/route.ts`

### Problem
Loan repayments were not being included in cashflow calculations throughout the application. The system was only considering interest for some calculations but not the actual `minRepayment` amounts, causing incorrect Net Cashflow figures.

### Solution

#### Property Page Updates (`properties/page.tsx`)

1. **Extended Loan Interface:**
   ```typescript
   interface Loan {
     id: string;
     name: string;
     principal: number;
     interestRateAnnual: number;
     rateType: string;
     isInterestOnly: boolean;
     minRepayment: number;        // Added
     repaymentFrequency: string;  // Added
   }
   ```

2. **Updated Cashflow Calculation:**
   ```typescript
   const calculateCashflow = (property: Property) => {
     const annualIncome = property.income?.reduce(...) || 0;
     const annualExpenses = property.expenses?.reduce(...) || 0;
     const annualLoanRepayments = property.loans?.reduce((sum, loan) =>
       sum + convertToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY'), 0) || 0;
     return annualIncome - annualExpenses - annualLoanRepayments;
   };
   ```

3. **New Helper Functions:**
   - `calculateAnnualLoanRepayments(property)` — Total loan repayments per year
   - `calculateAnnualInterest(property)` — Interest-only portion (for tax reference)

4. **UI Updates:**
   - Added "Annual Loan Repayments" card in property cashflow tab
   - Added loan repayment details per loan
   - Added total annual repayments summary

#### Portfolio Snapshot API Updates (`portfolio/snapshot/route.ts`)

1. **Overall Cashflow:**
   ```typescript
   const totalAnnualLoanRepayments = loans.reduce((sum, l) =>
     sum + normalizeToAnnual(l.minRepayment || 0, l.repaymentFrequency || 'MONTHLY'), 0);

   const monthlyNetCashflow = (totalAnnualNetIncome - totalAnnualExpenses - totalAnnualLoanRepayments) / 12;
   ```

2. **Property-Level Cashflow:**
   ```typescript
   const annualLoanRepayments = propertyLoans.reduce((sum, l) =>
     sum + normalizeToAnnual(l.minRepayment || 0, l.repaymentFrequency || 'MONTHLY'), 0);

   const propertyCashflow = annualRentalIncome - annualPropertyExpenses - annualLoanRepayments;
   ```

3. **Response Structure Enhanced:**
   - Added `totalLoanRepayments` to cashflow object
   - Added `monthlyLoanRepayments` to cashflow object
   - Added `annualLoanRepayments` to each property snapshot
   - Included loans array with repayment details

### Cashflow Formula
```
Net Cashflow = Income - Expenses - Loan Repayments
```

### Impact
- Portfolio dashboard now shows accurate cashflow figures
- Property-level cashflow correctly deducts loan repayments
- Savings rate calculation now reflects true disposable income

---

## 5. Dashboard Metric Tile Detail Dialogs

**Commit:** `649db2c`
**Type:** Feature Enhancement
**Files Modified:**
- `app/dashboard/page.tsx`

### Problem
Dashboard tiles showed summary numbers but users had no way to see the breakdown or understand how figures were calculated.

### Solution
Added click-to-expand detail dialogs for all four primary metric tiles:

#### 1. Net Worth Dialog
- Total net worth summary
- Assets breakdown (Properties, Cash & Accounts, Investments)
- Liabilities breakdown (Loans)
- Color-coded sections (green for assets, red for liabilities)

#### 2. Cash Flow Dialog
- Monthly/Annual net cashflow summary
- Income breakdown with gross/net/PAYG details
- Expenses breakdown
- Loan repayments with per-loan details
- Net result calculation

#### 3. Savings Rate Dialog
- Savings rate percentage
- Calculation breakdown (Income - Expenses - Loan Repayments)
- Benchmark indicators:
  - 20%+ Excellent
  - 10-20% Good
  - 0-10% Needs Improvement
  - Below 0% Spending More Than Earning

#### 4. LVR (Loan-to-Value Ratio) Dialog
- Portfolio LVR percentage
- Debt vs Assets calculation
- Total equity display
- Per-property LVR breakdown
- Risk level indicators:
  - ≤60% Conservative (Low Risk)
  - 60-80% Moderate (Medium Risk)
  - >80% High Leverage (High Risk)

### Implementation
```typescript
type DetailTileType = 'netWorth' | 'cashflow' | 'savingsRate' | 'lvr' | null;
const [selectedDetail, setSelectedDetail] = useState<DetailTileType>(null);

// Each tile is clickable
<div onClick={() => setSelectedDetail('netWorth')} className="cursor-pointer">
  <StatCard ... />
</div>

// Dialog renders based on selectedDetail
<Dialog open={selectedDetail !== null} onOpenChange={() => setSelectedDetail(null)}>
  {selectedDetail === 'netWorth' && ( ... )}
  {selectedDetail === 'cashflow' && ( ... )}
  ...
</Dialog>
```

### Updated PortfolioSnapshot Interface
Added fields to support detail dialogs:
- `loans` array with name, principal, interestRate, minRepayment, repaymentFrequency, propertyName
- `cashflow.totalLoanRepayments`
- `cashflow.monthlyLoanRepayments`

---

## 6. Expenses Page Grouped View Redesign

**Commit:** `41e2dce`
**Type:** Feature Enhancement (Major UI Redesign)
**Files Modified:**
- `app/dashboard/expenses/page.tsx`

### Problem
The expenses page displayed each expense as an individual tile in a grid layout. With multiple expenses, the page became "unmanageable and very busy" (user feedback). Users wanted expenses rolled up into groups.

### Solution
Complete redesign of the expenses page with three view modes:

#### View Mode Selector
```typescript
type ViewMode = 'category' | 'property' | 'all';
const [viewMode, setViewMode] = useState<ViewMode>('category');
```

Toggle buttons allow switching between:
1. **Category** — Groups by expense category (Housing, Rates, Insurance, etc.)
2. **Property** — Groups by linked property (or "General Expenses")
3. **All** — Original individual tile view

#### Grouped View Features

1. **ExpenseGroup Interface:**
   ```typescript
   interface ExpenseGroup {
     id: string;
     name: string;
     icon: React.ReactNode;
     expenses: Expense[];
     totalMonthly: number;
     count: number;
   }
   ```

2. **Group Header Shows:**
   - Category/Property name with icon
   - Expense count
   - Tax-deductible expense count
   - Total monthly amount
   - Annual equivalent
   - Expand/collapse chevron

3. **Expanded View Table:**
   - Name column (with deductible/non-essential icons)
   - Amount column
   - Frequency column
   - Monthly equivalent column
   - Actions column (view, edit, delete)

4. **Category Info Mapping:**
   ```typescript
   const categoryInfo: Record<Expense['category'], { label: string; icon: ReactNode; color: string }> = {
     HOUSING: { label: 'Housing', icon: <Home />, color: 'text-blue-500' },
     RATES: { label: 'Rates', icon: <Building2 />, color: 'text-amber-500' },
     // ... all 13 categories
   };
   ```

5. **Grouping Logic:**
   - `groupByCategory()` — Groups expenses by category enum
   - `groupByProperty()` — Groups by propertyId or "General"
   - Groups sorted by total monthly amount (highest first)

6. **State Management:**
   ```typescript
   const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

   const toggleGroupExpanded = (groupId: string) => {
     setExpandedGroups(prev => {
       const next = new Set(prev);
       next.has(groupId) ? next.delete(groupId) : next.add(groupId);
       return next;
     });
   };
   ```

### Impact
- Cleaner, more organized expense view
- Easy to see total spending by category or property
- Quick access to individual expenses within groups
- Maintains all existing CRUD functionality

---

## Commit History

| Commit | Message | Files Changed |
|--------|---------|---------------|
| `086fbe0` | fix(oauth): derive redirect_uri from request when NEXT_PUBLIC_APP_URL is undefined | 4 |
| `73c9a11` | feat(settings): add back button and close option to settings layout | 1 |
| `595f088` | feat(expenses): add receipt upload functionality to expense form | 1 |
| `044df22` | fix(cashflow): include loan repayments in all cashflow calculations | 2 |
| `649db2c` | feat(dashboard): add click-to-expand detail dialogs for metric tiles | 1 |
| `41e2dce` | feat(expenses): redesign page with grouped view by category or property | 1 |

---

## Testing Notes

- All changes passed TypeScript compilation (`npx tsc --noEmit`)
- No breaking changes to existing functionality
- OAuth redirect_uri_mismatch error requires Google Cloud Console configuration (user action required)

---

## Related Blueprint Phases

- **Phase 19.1** — Document Management Expansion (Receipt upload)
- **Phase 7** — Dashboard Rebuild (Detail dialogs)
- **Phase 6** — UI Core Components (Expenses redesign)

---

## Next Steps

1. User to configure OAuth redirect URIs in Google Cloud Console
2. Test grouped expenses view with real data
3. Consider persisting view mode preference in user settings
