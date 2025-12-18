# Changelog — 2025-12-18

## Summary
Major enhancements to the Transactions module including QIF import support, account filtering, Basiq integration priority, and UI improvements for transaction display.

---

## Features Added

### 1. QIF File Import Support
**Files:** `lib/bank/parsers/qif.ts`, `app/api/bank/preview/route.ts`, `app/api/bank/import/route.ts`

- Added QIF (Quicken Interchange Format) parser for MYOB/Quicken bank exports
- Supports Australian date format (DD/MM/YY)
- Auto-detects Australian banks from transaction patterns (NAB, CBA, ANZ, Westpac)
- Exports `parseQIF()`, `isValidQIF()`, `parseQIFDate()` functions

### 2. Account Filter on Transactions Page
**File:** `app/(dashboard)/transactions/page.tsx`

- Added prominent account selector at top of transactions page
- Users can filter transactions by specific bank account
- "All Accounts" option to view all transactions
- Clear filter button for quick reset
- Filter integrates with existing search, category, and date filters

### 3. Create New Account During Import
**File:** `components/bank/ImportWizard.tsx`

- Added "Create New Account" option in Import Wizard
- Auto-fills institution name from detected bank in QIF files
- Sets opening balance from file's closing balance
- New account automatically selected for import
- `onAccountCreated` callback prop for parent component

### 4. Asset Source Type in Transaction Link Dialog
**Files:** `components/transactions/TransactionLinkDialog.tsx`, `app/api/transactions/[id]/link/route.ts`

- Added "Asset" option to expense source type dropdown
- Matches options available in Add New Expense dialog
- Asset selector dropdown when Asset source is selected
- API support for `assetId` in expense creation

### 5. Basiq (Open Banking) Transaction Priority
**File:** `lib/bank/basiqSync.ts`

- When Basiq is activated, its transactions override manual imports
- Existing imported transactions tagged as `SUPERSEDED_BY_BASIQ`
- Balance source tracking (MANUAL, IMPORT, BASIQ)
- `canAcceptManualImport()` check before allowing imports

---

## Bug Fixes

### 1. TransactionSource Enum Missing QIF
**File:** `prisma/schema.prisma`

- Added `QIF` to `TransactionSource` enum
- Fixes Vercel build error for QIF imports

### 2. lastSyncedAt Field Name
**File:** `lib/bank/basiqSync.ts`

- Fixed incorrect field reference `lastSynced` → `lastSyncedAt`

### 3. merchantStandardised Type Mismatch
**File:** `lib/bank/basiqSync.ts`

- Fixed null/undefined type mismatch using nullish coalescing
- `merchantStandardised: merchantCleaned ?? undefined`

### 4. Transaction Amounts Showing Rounded Values
**File:** `app/dashboard/accounts/page.tsx`

- Transaction amounts in Account dialog were showing rounded values
- Added `formatCurrencyFull()` function with 2 decimal places
- Now shows -$15.70 instead of -$16

### 5. Limited Transactions in Account Dialog
**File:** `app/dashboard/accounts/page.tsx`

- Only showing first 15 transactions with no pagination
- Added pagination with 20 transactions per page
- Previous/Next controls when more than 20 transactions
- Page counter shows "Page X of Y (N transactions)"

---

## Schema Changes

### Prisma Schema Updates

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

**Account Model Additions:**
```prisma
model Account {
  // ... existing fields ...
  balanceSource        BalanceSource @default(MANUAL)
  balanceLastUpdatedAt DateTime?
  lastImportedBalance  Float?
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `lib/bank/parsers/qif.ts` | NEW: QIF parser implementation |
| `lib/bank/basiqSync.ts` | NEW: Basiq sync service with priority logic |
| `lib/bank/index.ts` | Export new parser and sync functions |
| `app/api/bank/preview/route.ts` | Added QIF format detection |
| `app/api/bank/import/route.ts` | Added QIF processing, balance source tracking |
| `app/api/transactions/[id]/link/route.ts` | Added ASSET source type, assetId field |
| `app/(dashboard)/transactions/page.tsx` | Added account filter state and UI |
| `app/dashboard/accounts/page.tsx` | Added formatCurrencyFull, pagination for transactions |
| `components/bank/ImportWizard.tsx` | Added account creation during import |
| `components/transactions/TransactionLinkDialog.tsx` | Added Asset source option |
| `prisma/schema.prisma` | Added BalanceSource enum, QIF to TransactionSource |

---

## Documentation Updated

- `PHASE_18_BANK_TRANSACTIONS.md` - QIF parser, account filter, account dialog fixes
- `PHASE_13_TRANSACTIONAL_INTELLIGENCE.md` - Basiq integration, Asset source type
- `PHASE_21_ASSET_MANAGEMENT.md` - Transaction link dialog integration

---

## Commits

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

---

## Migration Required

After deployment, run:
```bash
npx prisma migrate dev --name add_balance_source_and_qif
```

---

*Changelog Version: 1.0*
*Date: 2025-12-18*
