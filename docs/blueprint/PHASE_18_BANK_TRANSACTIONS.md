PHASE 18 — BANK TRANSACTION IMPORT, AUTO-CATEGORISATION & BUDGET RECONCILIATION ENGINE

(Fully deterministic – no AI dependency. Optional future AI support defined in Phase 19.)

18.1 Phase Overview

Phase 18 introduces a unified Bank Transactions Import & Financial Reconciliation Engine, allowing users to:

Import downloaded bank statements (.CSV, .OFX, .QIF)

Automatically categorise transactions into Monitrax expense/income types

Assign transactions to the correct financial entities (properties, investments, personal categories)

Detect duplicates

Reconcile spending against budgeted totals

Generate monthly financial health summaries

Provide real-time insights into financial performance

This phase connects the cashflow reality to the Monitrax model, making the app “complete”.

18.2 Features & Capabilities
18.2.1 Supported File Formats

CSV (all banks)

OFX (standard Open Financial Exchange)

QIF (legacy banks)

JSON (internal App → App export)

18.2.2 Transaction Normalisation Engine

All raw bank transactions are transformed into a standard schema:

interface NormalisedBankTransaction {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  bankAccountId?: string;
  sourceFileId: string;
  hash: string;      // for duplicate detection
}


Processing includes:

Date normalisation

Amount normalisation (absolute vs signed)

Cleaning descriptors (remove emojis, weird characters)

Merchant extraction heuristics

Hashing for duplicates

18.3 Auto-Categorisation Engine

Transaction categorisation uses deterministic rule-based logic, NOT AI.

18.3.1 Category Rules

Rules include:

Merchant matching (e.g., OPTUS → “Mobile Plan”, COLES → “Groceries”)

Keyword heuristics (e.g., “RENT” → Property)

Bank pattern mappings (e.g., BPAY Biller codes)

User overrides (manual corrections stored for future matching)

18.3.2 Category Types

Each transaction is mapped to:

enum CategoryType {
  PROPERTY_EXPENSE,
  PERSONAL_EXPENSE,
  INVESTMENT_EXPENSE,
  INCOME,
  TRANSFER,
  UNKNOWN
}

18.3.3 Subcategory Mapping

Examples:

“Mobile Plan” → Household / Utilities / Mobile

“Netflix” → Household / Entertainment

“Council Rates” → Property / Rates

“Insurance Renewal” → Insurance / General

18.4 Linking to Monitrax Financial Entities
Property Linking

Council rates

Water

Repairs

Agents fees

Insurance
→ Automatically assigned to the relevant property

Loan Linking

Loan repayments split into:

Principal

Interest

Fees
→ Matched using loan account BSB/Account no patterns or bank descriptors

Investment Linking

Brokerage deposits

Share purchases

Dividend payments
→ Mapped to investment accounts

Personal Expenses Linking

If no property/loan/investment match → Personal category

18.5 Duplicate Detection Engine

Avoid double-imports using:

hash = sha256(date + amount + rawDescription)

File source ID

1-minute tolerance for rapid-fire duplicates

“sibling detection” (banks sometimes produce two entries for the same transaction)

Configurable duplicate policy:

Reject

Mark as duplicate

Merge into existing

18.6 Budget Comparison Engine

For each category, compare Actuals vs Budget:

18.6.1 Data Inputs

Monthly budget (from Phase 5 Expense & Income definitions)

Actual imported and categorised transactions

Monthly recurring obligations (loans, rent, subscriptions)

18.6.2 Outputs
interface BudgetComparisonResult {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: 'UNDER' | 'OVER' | 'ON_TRACK';
}

Per-Month Financial Status

Generate:

Total income vs total expenses

Savings achieved vs savings target

Spending categories exceeding thresholds

Warning flags (e.g., “Groceries exceeded by $240 this month”)

18.7 Monthly Financial Health Report

Readable narrative:

“You spent $1,240 less than your budget in September.”

“Mobile plan increased by $15 compared to last month.”

“Property 2 cost blowout: $600 repairs exceeded maintenance plan.”

“Savings rate for October: 22.4% (Goal: 25%).”

Fully deterministic templates (no AI dependency).

18.8 UI/UX Requirements
18.8.1 Import Wizard

Flow:

Upload file

Detect format

Preview parsed data

Confirm mappings

Review categorisation

Save & Link

18.8.2 Bank Transactions Dashboard

Includes:

Table with search, filter, pagination

Category badges

Link entity dropdowns

Duplicate flags

Override category button

18.8.3 Budget vs Actual Dashboard

Charts:

Monthly bar charts

Category donut chart

Trend lines

Savings rate vs target

18.9 Database Changes

New tables:

BankTransactionFile
BankTransactionRaw
BankTransactionNormalised
BankTransactionCategory
BankTransactionLink


Indexes for:

hash

date

amount

categoryId

linkedEntityId

18.10 API Requirements
Upload + Parse

POST /api/bank/import

Categorisation

POST /api/bank/categorise

Budget Comparison

GET /api/budget/comparison?month=2025-10

Financial Health Report

GET /api/budget/health?month=2025-10

18.11 Completion Criteria

Import wizard implemented

Auto-categorisation engine functional

Duplicate detection working

Budget comparison fully integrated

Monthly financial health narrative generated

All data linkable to properties, loans, investments

UI pages built and tested

Blueprint updated

Unit tests written

---

## 18.12 Implementation Notes

> **Status: QIF PARSER & ACCOUNT CREATION IMPLEMENTED** (December 2025)

### 18.12.1 QIF Parser Implementation

**File:** `lib/bank/parsers/qif.ts`

The QIF parser supports the standard Quicken Interchange Format used by MYOB, Quicken, and Australian banks (NAB tested).

#### QIF Field Mapping:
| Field | Description | Example |
|-------|-------------|---------|
| `!Type:Bank` | Account type header | Bank, CCard, Cash |
| `D` | Date (DD/MM/YY Australian format) | D18/12/25 |
| `T` | Amount (negative = debit) | T-500.00 |
| `N` | Reference/Check number | N123456 |
| `P` | Payee/Description | PCOLES SUPERMARKETS |
| `M` | Memo | Additional notes |
| `L` | Category | L[Groceries] |
| `^` | Record separator | End of transaction |

#### Key Functions:
```typescript
parseQIF(content: string): ParsedFile
isValidQIF(content: string): boolean
parseQIFDate(dateStr: string): Date
detectBankFromTransactions(transactions: RawTransaction[]): string | undefined
```

#### Bank Detection:
Auto-detects Australian banks from transaction patterns:
- **NAB**: Patterns like "NABATM", "NAB ", "PV9037"
- **CBA**: Patterns like "COMMBANK", "NETBANK"
- **ANZ**: Patterns like "ANZ ", "ANZ-"
- **Westpac**: Patterns like "WESTPAC", "WBC "

---

### 18.12.2 Account Creation During Import

**File:** `components/bank/ImportWizard.tsx`

Users can now create a new account directly from the Import Wizard:

#### New Props:
```typescript
interface ImportWizardProps {
  accounts: Account[];
  onComplete?: () => void;
  onClose?: () => void;
  onAccountCreated?: (account: Account) => void;  // NEW
}
```

#### Features:
- "Create New Account" button in account selection dropdown
- Auto-fills institution name from detected bank (QIF metadata)
- Sets opening balance from file's closing balance
- Supports all account types: TRANSACTIONAL, SAVINGS, OFFSET, CREDIT_CARD
- Created account is automatically selected for import

---

### 18.12.3 Balance Source Tracking

**File:** `prisma/schema.prisma`

New enum and fields for tracking balance origin:

```prisma
enum BalanceSource {
  MANUAL     // User manually entered balance
  IMPORT     // Balance from CSV/QIF/OFX import
  BASIQ      // Balance from Open Banking (Basiq)
}

model Account {
  // ... existing fields ...

  // Balance Source Tracking
  balanceSource        BalanceSource @default(MANUAL)
  balanceLastUpdatedAt DateTime?
  lastImportedBalance  Float?
}
```

#### Import API Updates:
- Sets `balanceSource: 'IMPORT'` when updating from file
- Records `balanceLastUpdatedAt` timestamp
- Stores `lastImportedBalance` for reference
- **Prevents override** if account is Basiq-connected

---

### 18.12.4 Basiq Integration Priority

**File:** `lib/bank/basiqSync.ts`

When Basiq (Open Banking) is active for an account:

1. **Manual imports are blocked** for that account
2. **Existing imported transactions are tagged** as `SUPERSEDED_BY_BASIQ`
3. **Balance always comes from Basiq** (cannot be overridden by import)

#### Key Functions:
```typescript
// Check if account can accept manual import
canAcceptManualImport(accountId: string): Promise<{
  canImport: boolean;
  reason?: string;
  basiqStatus?: string;
}>

// Sync transactions from Basiq
syncBasiqTransactions(
  userId: string,
  accountId: string,
  options?: BasiqSyncOptions
): Promise<BasiqSyncResult>

// Get transaction counts by source
getTransactionSourceCounts(
  userId: string,
  accountId: string
): Promise<Record<string, number>>
```

---

### 18.12.5 API Endpoint Updates

#### Preview API (`POST /api/bank/preview`)
- Now accepts QIF files
- Returns `metadata.detectedBank` for QIF files
- Returns `format: 'QIF' | 'CSV' | 'OFX'`

#### Import API (`POST /api/bank/import`)
- Processes QIF files using new parser
- Sets `source: format` (CSV, QIF, OFX) on transactions
- Checks Basiq connection before updating balance
- Updates balance with source tracking fields

---

### 18.12.6 Migration Required

After deployment, run:
```bash
npx prisma migrate dev --name add_balance_source_tracking
```

This adds:
- `BalanceSource` enum
- `balanceSource` field on Account
- `balanceLastUpdatedAt` field on Account
- `lastImportedBalance` field on Account

---

### 18.12.7 Transactions Page Account Filter

> **Status: IMPLEMENTED** (December 2025)

**File:** `app/(dashboard)/transactions/page.tsx`

The transactions page now includes a prominent account filter to allow users to view transactions per bank account instead of all transactions mixed together.

#### Features:
- **Account Selector** - Dropdown at top of page showing all accounts
- **Clear Filter Button** - Quick reset to view all accounts
- **Filter Integration** - Works with existing search, category, date range filters
- **Automatic Reset** - Pagination resets to page 1 when filter changes

#### UI Implementation:
```tsx
// Account filter - prominent selector
<div className="bg-white rounded-lg shadow mb-4 p-4">
  <div className="flex items-center gap-4">
    <label>View Account:</label>
    <select
      value={accountFilter}
      onChange={(e) => {
        setAccountFilter(e.target.value);
        setPage(1);
      }}
    >
      <option value="">All Accounts</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name} ({account.type})
        </option>
      ))}
    </select>
  </div>
</div>
```

#### API Integration:
The filter passes `accountId` parameter to the unified-transactions API:
```typescript
if (accountFilter) params.append('accountId', accountFilter);
```

---

### 18.12.8 Account Dialog Transactions Tab Improvements

> **Status: IMPLEMENTED** (December 2025)

**File:** `app/dashboard/accounts/page.tsx`

Fixed two issues with the transactions tab in the Account detail dialog:

#### Issue 1: Incorrect Amount Formatting
**Problem:** Transaction amounts were rounded (showing -$16 instead of -$15.70)

**Root Cause:** The `formatCurrency` function used `maximumFractionDigits: 0`

**Solution:** Added `formatCurrencyFull` function for transaction amounts:
```typescript
const formatCurrencyFull = (amount: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
```

#### Issue 2: Limited Transactions Display
**Problem:** Only showing first 15 transactions with no way to see more

**Solution:** Added pagination with 20 transactions per page:
```typescript
const [txPage, setTxPage] = useState(1);
const TX_PER_PAGE = 20;

// Pagination controls
{totalPages > 1 && (
  <div className="flex items-center justify-between">
    <Button onClick={() => setTxPage((p) => Math.max(1, p - 1))} disabled={txPage === 1}>
      Previous
    </Button>
    <span>Page {txPage} of {totalPages} ({totalTx} transactions)</span>
    <Button onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))} disabled={txPage === totalPages}>
      Next
    </Button>
  </div>
)}
```

#### Pagination Reset:
Page resets to 1 when viewing a different account:
```typescript
const handleViewDetails = (account: Account) => {
  setSelectedAccount(account);
  setTxPage(1); // Reset pagination
  setShowDetailDialog(true);
};
```
