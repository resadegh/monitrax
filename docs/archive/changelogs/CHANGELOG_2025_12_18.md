# Changelog — 2025-12-18

## Phase 31: Cashflow Intelligence Center

### Summary

Complete redesign of the cashflow page into a comprehensive "Cashflow Intelligence Center" - the heart and soul of Monitrax. Aggregates data from all existing financial engines into a unified, actionable dashboard with AI-powered insights.

### Key Features

1. **Unified Health Score**: 0-100 score combining 5 weighted categories (Liquidity, Cashflow Stability, Forecast Risk, Budget Adherence, Debt Health)
2. **Money Leak Detection**: Identifies spending leaks with transaction drill-down links
3. **Waterfall Chart**: Visual money flow from income through expenses to surplus/deficit
4. **AI Summary**: Gemini-powered natural language insights with persistent caching
5. **Budget vs Actual**: Real-time budget tracking with variance indicators
6. **Tax Optimization**: Tax summary with estimated savings recommendations
7. **Smart Actions**: Ranked recommendations with navigation links

### Architecture

- Zero hallucination policy: AI receives only real calculated numbers
- Transaction drill-down: All leaks link to actual transactions
- Simplified actions: "View Details" and "Learn How" instead of direct actions
- Mobile-first responsive design

### Files Added

| File | Purpose |
|------|---------|
| `lib/cashflow-intelligence/types.ts` | Core type definitions |
| `lib/cashflow-intelligence/healthScoreAggregator.ts` | Health score calculation |
| `lib/cashflow-intelligence/leakDetector.ts` | Money leak detection |
| `lib/cashflow-intelligence/geminiSummary.ts` | AI summary generation |
| `lib/cashflow-intelligence/index.ts` | Module exports |
| `app/api/cashflow/intelligence/route.ts` | Intelligence aggregation API |
| `app/api/cashflow/summary/route.ts` | Gemini summary API (GET/POST) |
| `app/(dashboard)/cashflow/components/intelligence/CashflowHealthScore.tsx` | Health score gauge component |
| `app/(dashboard)/cashflow/components/intelligence/WaterfallChart.tsx` | Money flow visualization |
| `app/(dashboard)/cashflow/components/intelligence/MoneyLeakDetector.tsx` | Leak cards with drill-down |
| `app/(dashboard)/cashflow/components/intelligence/BudgetVsActual.tsx` | Budget comparison |
| `app/(dashboard)/cashflow/components/intelligence/TaxOptimization.tsx` | Tax summary widget |
| `app/(dashboard)/cashflow/components/intelligence/GeminiSummary.tsx` | AI summary with regenerate |
| `app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` | Ranked action cards |
| `app/(dashboard)/cashflow/components/intelligence/index.ts` | Component exports |
| `docs/blueprint/PHASE_31_CASHFLOW_INTELLIGENCE_CENTER.md` | Documentation |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added CashflowSummary model for AI summary persistence |
| `app/(dashboard)/cashflow/page.tsx` | Complete redesign for Intelligence Center |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cashflow/intelligence` | GET | Aggregated intelligence data |
| `/api/cashflow/summary` | GET | Cached or new AI summary |
| `/api/cashflow/summary` | POST | Force summary regeneration |

### Health Score Weights

| Category | Weight | Source |
|----------|--------|--------|
| Liquidity | 25% | Emergency buffer, accessible cash |
| Cashflow Stability | 25% | Income vs expenses, surplus |
| Forecast Risk | 20% | Shortfall risk, break-even timing |
| Budget Adherence | 15% | Budget vs actual spending |
| Debt Health | 15% | DTI ratio, repayment load |

### Leak Detection Categories

1. **Subscriptions**: Unused services, streaming stacking, price increases
2. **Category Overspending**: Above Australian benchmarks (ABS data)
3. **Impulse Spending**: High-frequency small purchases
4. **Takeaway/Delivery**: Food delivery over-reliance (>5% of income)

### Numbers Verification

- Income calculation uses NET amounts (after PAYG) via `normalizeIncomeStream()`
- Tax brackets verified against 2024-25 Australian rates
- Health score weights sum to 1.0
- Spending benchmarks based on ABS Household Expenditure Survey

---

## Transaction Module Enhancements

### Summary
Major enhancements to the Transactions module including QIF import support, account filtering, Basiq integration priority, and UI improvements for transaction display.

---

### Features Added

#### 1. QIF File Import Support
**Files:** `lib/bank/parsers/qif.ts`, `app/api/bank/preview/route.ts`, `app/api/bank/import/route.ts`

- Added QIF (Quicken Interchange Format) parser for MYOB/Quicken bank exports
- Supports Australian date format (DD/MM/YY)
- Auto-detects Australian banks from transaction patterns (NAB, CBA, ANZ, Westpac)
- Exports `parseQIF()`, `isValidQIF()`, `parseQIFDate()` functions

#### 2. Account Filter on Transactions Page
**File:** `app/(dashboard)/transactions/page.tsx`

- Added prominent account selector at top of transactions page
- Users can filter transactions by specific bank account
- "All Accounts" option to view all transactions
- Clear filter button for quick reset
- Filter integrates with existing search, category, and date filters

#### 3. Create New Account During Import
**File:** `components/bank/ImportWizard.tsx`

- Added "Create New Account" option in Import Wizard
- Auto-fills institution name from detected bank in QIF files
- **Mandatory Current Balance field** - Users must enter their actual bank balance
- New account automatically selected for import
- `onAccountCreated` callback prop for parent component

#### 4. Asset Source Type in Transaction Link Dialog
**Files:** `components/transactions/TransactionLinkDialog.tsx`, `app/api/transactions/[id]/link/route.ts`

- Added "Asset" option to expense source type dropdown
- Matches options available in Add New Expense dialog
- Asset selector dropdown when Asset source is selected
- API support for `assetId` in expense creation

#### 5. Basiq (Open Banking) Transaction Priority
**File:** `lib/bank/basiqSync.ts`

- When Basiq is activated, its transactions override manual imports
- Existing imported transactions tagged as `SUPERSEDED_BY_BASIQ`
- Balance source tracking (MANUAL, IMPORT, BASIQ)
- `canAcceptManualImport()` check before allowing imports

---

### Bug Fixes

#### 1. TransactionSource Enum Missing QIF
**File:** `prisma/schema.prisma`

- Added `QIF` to `TransactionSource` enum
- Fixes Vercel build error for QIF imports

#### 2. lastSyncedAt Field Name
**File:** `lib/bank/basiqSync.ts`

- Fixed incorrect field reference `lastSynced` → `lastSyncedAt`

#### 3. merchantStandardised Type Mismatch
**File:** `lib/bank/basiqSync.ts`

- Fixed null/undefined type mismatch using nullish coalescing
- `merchantStandardised: merchantCleaned ?? undefined`

#### 4. Transaction Amounts Showing Rounded Values
**File:** `app/dashboard/accounts/page.tsx`

- Transaction amounts in Account dialog were showing rounded values
- Added `formatCurrencyFull()` function with 2 decimal places
- Now shows -$15.70 instead of -$16

#### 5. Limited Transactions in Account Dialog
**File:** `app/dashboard/accounts/page.tsx`

- Only showing first 15 transactions with no pagination
- Added pagination with 20 transactions per page
- Previous/Next controls when more than 20 transactions
- Page counter shows "Page X of Y (N transactions)"

#### 6. QIF Closing Balance Not Calculated Without Opening Balance
**File:** `lib/bank/parsers/qif.ts`

- Account balance showing $0 after QIF import
- Australian bank QIF exports typically don't include opening balance (B field)
- Parser now calculates closing balance from transaction sum even without opening balance
- Allows account balance to be populated from QIF imports

---

## Schema Changes

### Prisma Schema Updates

**New Model (Phase 31):**
```prisma
model CashflowSummary {
  id           String   @id @default(uuid())
  userId       String
  content      String   @db.Text
  keyInsights  Json
  dataHash     String
  generatedAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(...)
}
```

**New Enum:**
```prisma
enum BalanceSource {
  MANUAL
  IMPORT
  BASIQ
}
```

**TransactionSource Enum:**
```prisma
enum TransactionSource {
  // ... existing values ...
  QIF  // NEW
}
```

---

## Database Migration Required

After deployment, run:
```bash
npx prisma db push
```

---

## Commits

### Phase 31: Cashflow Intelligence Center
```
feat: add Cashflow Intelligence Center (Phase 31)
fix: resolve syntax and TypeScript errors in cashflow intelligence
```

### Transaction Module
| Hash | Message |
|------|---------|
| `8e424ef` | feat: Add QIF import support and Basiq priority override |
| `600564f` | docs: Update blueprint documentation |
| `da7e775` | fix: Add QIF to TransactionSource enum |
| `723d2ca` | fix: Use correct field name lastSyncedAt |
| `d0d56ca` | fix: resolve merchantStandardised type mismatch |
| `d78dc83` | feat: Add account filter to transactions page |
| `81e1288` | feat: Add Asset source option to transaction link dialog |
| `67f8f8a` | fix: Display full decimal amounts and add pagination |
| `d72d77a` | fix: Calculate QIF closing balance from transaction sum without opening balance |
| `e785f1a` | feat: Add mandatory Current Balance field when creating account during import |
| `9beb8d5` | feat: Add transaction categorization with recurring/essential flags and transfer handling |

---

## New Features - Transaction Categorization

### 7. Transfer Transaction Handling
**Files:** `components/transactions/TransactionLinkDialog.tsx`, `app/api/transactions/[id]/link/route.ts`

- New "Transfer" option when categorizing transactions
- Select target account for inter-account transfers
- Transfers are **excluded** from income/expense calculations
- Prevents double-counting when money moves between accounts
- Category automatically set to "Transfer" when marked

### 8. Recurring vs One-off Transaction Categorization
**File:** `components/transactions/TransactionLinkDialog.tsx`

- New "Recurring expense" checkbox (no longer always true)
- One-off expenses just get categorized without creating recurring entry
- Recurring expenses ask for frequency and create recurring expense entries
- Essential checkbox works independently of recurring status

### 9. Essential Expense Tracking
**Files:** `prisma/schema.prisma`, `components/transactions/TransactionLinkDialog.tsx`

- New `isEssential` flag on UnifiedTransaction model
- Essential expenses included in minimum outgoings calculations
- Works independently of recurring status
- Examples: Insurance (recurring + essential), Coffee (one-off + non-essential)

### 10. New Expense Categories
**Files:** `prisma/schema.prisma`, `lib/categories/unified.ts`

New categories added:
- `GROCERIES` - Essential groceries (separate from Food & Dining)
- `HEALTH` - Health, medical, pharmacy expenses
- `EDUCATION` - Education, courses, training
- `SUBSCRIPTION` - Recurring subscriptions (Netflix, Spotify, etc.)
- `REGISTRATION` - Vehicle registration, license fees
- `MODIFICATIONS` - Vehicle modifications, upgrades

### 11. Transfer Exclusion from Calculations
**Files:** `app/api/cashflow/route.ts`, `app/api/budget/comparison/route.ts`, `app/api/unified-transactions/route.ts`

- Cashflow API excludes transfers from calculations
- Budget comparison excludes transfers
- New `isTransfer` and `excludeTransfers` filters on transactions API

---

## Additional Schema Changes

### UnifiedTransaction Model Additions
```prisma
model UnifiedTransaction {
  // ... existing fields ...
  isEssential           Boolean  @default(false)  // Is this an essential expense?
  isTransfer            Boolean  @default(false)  // Is this a transfer between accounts?
  transferToAccountId   String?                   // Target account for transfers
}
```

### ExpenseCategory Enum Additions
```prisma
enum ExpenseCategory {
  // ... existing values ...
  GROCERIES       // Essential groceries
  HEALTH          // Health, medical, pharmacy
  EDUCATION       // Education, courses, training
  SUBSCRIPTION    // (already existed but now in unified.ts)
  REGISTRATION    // (already existed)
  MODIFICATIONS   // (already existed)
}
```

---

*Changelog Version: 1.1*
*Date: 2025-12-18*
