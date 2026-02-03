# PHASE 13 — TRANSACTIONAL INTELLIGENCE  
**Monitrax Blueprint — Phase 13**

## Purpose  
Transform Monitrax from a static financial record keeper into a *dynamic behavioural engine* that understands spending patterns, categorises transactions intelligently, detects anomalies, and builds a deep longitudinal financial profile of users.

This phase introduces *true transactional intelligence* — preparing the platform for downstream phases like Cashflow Optimisation, Personal CFO, and AI-powered financial coaching.

---

# 13.1 Objectives  
1. **Centralise all transactional data ingestion**
   - Banking feeds  
   - Credit card feeds  
   - Manual imports (CSV, Excel, OFX)  
   - Manual entries through UI  

2. **Implement AI-assisted transaction categorisation**
   - Zero-shot classification (LLM)  
   - Category correction learning loop  
   - Merchant normalisation (Woolworths vs Woolworths Marketplace vs Woolies → “Woolworths”)  
   - Auto-detect recurring payments  

3. **Create the Transaction Intelligence Engine (TIE)**
   - Runs rules + ML (hybrid)  
   - Detects anomalies, duplicates, corrections  
   - Learns user preferences per category  
   - Builds expenditure behavioural profile  

4. **Power BI-style drill-downs**
   - Category → Subcategory → Merchant → Individual transaction → Linked relationships  
   - Filters by time, account, tags, patterns  

5. **Expose a unified API for downstream engines**
   - Cashflow Optimisation (Phase 14)  
   - Personal CFO Engine (Phase 17)  
   - Insights Engine v3 (later)  

---

# 13.2 Architecture Overview  
**Transactional Intelligence Engine (TIE)** will run as a backend micro-engine.

### Components:
1. **Transaction Ingestion Pipeline**
   - Normalisation
   - De-duplication
   - Pattern standardisation
   - Merchant mapping

2. **Categorisation Engine**
   - Rules-based layer (fast)
   - LLM classification layer (accurate)
   - Hybrid reconciliation layer

3. **Behavioural Engine**
   - Learns:
     - Category corrections
     - Recurring charges
     - Outlier behaviour
     - Spending clusters  
   - Detects:
     - Price increases  
     - Duplicate transactions  
     - Suspicious merchants  

4. **Analytics Layer**
   - Rolling spend averages  
   - Trend detection  
   - Category drift  
   - Predicted monthly outgoings  
   - Spending volatility  

5. **Unified Transaction Record (UTR) schema**
   - Standardised model across all banks
   - Fit for long-term behavioural analytics

---

# 13.3 Data Requirements  

### **13.3.1 Transaction Schema**
UTR fields must include:

- id  
- accountId  
- date  
- postDate  
- merchantRaw  
- merchantStandardised  
- merchantCategoryCode (MCC)  
- categoryLevel1  
- categoryLevel2  
- subcategory  
- tags[]  
- amount  
- currency  
- isCredit / isDebit  
- isRecurring  
- recurrencePattern  
- anomalyFlags[]  
- source (bank, csv, manual)  
- linkedEntities (loanId, propertyId, etc.)

---

# 13.4 TIE Processing Flow

```
Ingest → Normalise → Categorise → Detect Patterns → Behaviour Profile → Expose Insights
```

### Step Breakdown:
1. **Ingest**
   - Raw banking feed or CSV import  
   - Apply ingestion adapters per source  

2. **Normalise**
   - Merchant cleaning rules  
   - MCC lookup  
   - Character cleaning  
   - Timezone alignment  

3. **Categorise**
   - Rules-based check  
   - ML classification  
   - Human correction loop  

4. **Pattern Detection**
   - Recurring subscriptions  
   - Spending clusters  
   - Unexpected spikes  
   - Merchant behaviour changes  

5. **Behaviour Profile Generation**
   - Category averages  
   - Rolling cashflow prediction  
   - Seasonality detection  

6. **Expose**
   - API endpoints  
   - UI data streams  
   - Downstream engine inputs  

---

# 13.5 UI Requirements  
### **13.5.1 Transaction Explorer**
Features:
- Global search  
- Category pivoting  
- Merchant drill-down  
- Split transactions  
- Tagging  
- Anomaly flags displayed  
- Clean timeline view  

### **13.5.2 Category Corrections UI**
- Approve/override AI categorisation  
- Provide feedback that feeds learning loop  
- View categorisation confidence score  

### **13.5.3 Recurring Payments Center**
- All recurring payments  
- Next occurrence prediction  
- Monthly cost summaries  
- Price change alerts  

---

# 13.6 Integration with Other Phases  
### Feeds Into:
- Phase 14 Cashflow Optimisation  
- Phase 12 Financial Health Engine  
- Phase 17 Personal CFO Engine  
- Insights Engine v3  
- Budgeting UI enhancements  

### Requires From Existing:
- GRDCS entity links  
- Account & transaction APIs  
- Snapshot engine consumption  

---

# 13.7 Acceptance Criteria  
A feature is “Phase 13 Ready” when:

### **Data**
- All transactions normalised  
- Merchant mapping accuracy ≥ 92%  
- Category accuracy ≥ 85% before corrections  
- Duplicate detection accuracy ≥ 98%  

### **AI Learning Loop**
- Category override improves future matches  
- Recurring pattern detection ≥ 90% accuracy  
- Anomaly detection thresholds tunable  

### **UI**
- Users can fully explore transactions  
- Recurring payment centre functional  
- Category corrections functional  

### **System**
- TIE engine runs performant under load  
- All APIs documented  
- All data available to Snapshot v2  

---

# 13.8 Deliverables
- Transaction Intelligence Engine (TIE)
- Normalisation & cleaning pipeline
- Categorisation engine (rules + AI)
- Recurring detection subsystem
- Transaction Explorer UI
- Category correction UI
- Behavioural profile datasets
- APIs for Phase 14/17

---

# 13.9 Implementation Notes

> **Status: IMPLEMENTED** (November 2025)

## 13.9.1 Database Schema

**File:** `prisma/schema.prisma`

### New Enums:
```prisma
enum TransactionSource { BANK, CSV, OFX, MANUAL }
enum RecurrencePattern { WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUALLY, IRREGULAR }
enum AnomalyType { DUPLICATE, UNUSUAL_AMOUNT, NEW_MERCHANT, PRICE_INCREASE, UNEXPECTED_CATEGORY, TIMING_ANOMALY }
```

### New Models:
| Model | Purpose |
|-------|---------|
| `UnifiedTransaction` | UTR schema - standardised transaction record with all required fields |
| `MerchantMapping` | Learning loop - maps raw merchant names to standardised names + categories |
| `RecurringPayment` | Tracks detected recurring payments with pattern, amount, next expected date |
| `SpendingProfile` | User's behavioural profile with category averages, volatility, predictions |

### Relationships Added:
- `User.unifiedTransactions`, `User.merchantMappings`, `User.recurringPayments`, `User.spendingProfile`
- `Account.unifiedTransactions`, `Account.recurringPayments`
- Links to existing entities: `Property`, `Loan`, `Income`, `Expense`, `InvestmentAccount`

---

## 13.9.2 TIE Engine Library

**Location:** `lib/tie/`

### Files:
| File | Description |
|------|-------------|
| `types.ts` | TypeScript interfaces matching Prisma schema + ingestion types |
| `ingestion.ts` | Transaction normalisation, CSV import, merchant cleaning, deduplication |
| `categorisation.ts` | Rules-based categorisation (60+ Australian merchant rules) + OpenAI stub |
| `behavioural.ts` | Recurring payment detection, anomaly detection |
| `analytics.ts` | Spending summaries, trend analysis, forecasting, volatility calculation |
| `index.ts` | Barrel export for all modules |

### Key Features Implemented:

**Ingestion Pipeline (`ingestion.ts`):**
- `parseTransactionDate()` - Handles multiple date formats (DD/MM/YYYY, YYYY-MM-DD, ISO, etc.)
- `normaliseAmount()` - Normalises amounts and determines direction (IN/OUT)
- `cleanMerchantName()` - Standardises merchant names using MERCHANT_ALIASES
- `generateDeduplicationHash()` - SHA256-based deduplication
- `importFromCSV()` - Batch CSV import with auto-categorisation
- `findDuplicatesInBatch()` - Detects duplicates within import batches

**Categorisation Engine (`categorisation.ts`):**
- 60+ Australian merchant rules (Woolworths, Coles, Netflix, Spotify, etc.)
- Pattern matching with confidence scores
- Hybrid categorisation: Rules → User Mappings → AI (fallback)
- `createMerchantMappingFromCorrection()` - Learning loop for user corrections

**AI Integration (Stubbed):**
```typescript
// To enable OpenAI categorisation:
// 1. Set OPENAI_API_KEY environment variable
// 2. Update DEFAULT_AI_CONFIG.enabled = true in categorisation.ts
```

**Behavioural Engine (`behavioural.ts`):**
- Recurring pattern detection (weekly, fortnightly, monthly, quarterly, annually)
- Anomaly detection types: DUPLICATE, UNUSUAL_AMOUNT, NEW_MERCHANT, PRICE_INCREASE, TIMING_ANOMALY
- Price increase alerts (>10% increase threshold)
- Configurable thresholds via constants

**Analytics Layer (`analytics.ts`):**
- `calculateSpendingSummary()` - Totals, top categories/merchants
- `analyseTrend()` - Linear regression trend analysis
- `detectCategoryDrift()` - Spending pattern changes over time
- `forecastMonthlySpending()` - Weighted average prediction
- `calculateVolatility()` - Coefficient of variation calculation
- `generateSpendingProfile()` - Complete user profile generation

---

## 13.9.3 REST API Endpoints

**Base Path:** `/api/unified-transactions/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/unified-transactions` | GET | List transactions with filtering (account, category, merchant, date range, search, recurring, anomalies) |
| `/api/unified-transactions` | POST | Create single transaction or batch import |
| `/api/unified-transactions/[id]` | GET | Get single transaction |
| `/api/unified-transactions/[id]` | PATCH | Update transaction (category correction triggers learning loop) |
| `/api/unified-transactions/[id]` | DELETE | Delete transaction |
| `/api/unified-transactions/analytics` | GET | Get spending analytics, trends, forecasts |
| `/api/unified-transactions/recurring` | GET | List recurring payments with summary |
| `/api/unified-transactions/recurring` | POST | Trigger recurring payment detection |

### Authentication:
All endpoints use `withAuth` middleware requiring `Authorization: Bearer ${token}` header.

---

## 13.9.4 UI Components

### Transaction Explorer
**File:** `app/(dashboard)/transactions/page.tsx`

Features implemented:
- Global search with real-time filtering
- Category filter dropdown (11 categories)
- Date range filtering
- Recurring-only filter
- Anomalies-only filter
- Summary cards (total spend, income, net cashflow, transaction count)
- Paginated transaction list
- Click to edit/correct categories

### Category Correction Panel
Integrated into Transaction Explorer as slide-out panel:
- View AI confidence score
- Select category and subcategory
- Add/remove tags
- View anomaly flags
- Save triggers learning loop (creates MerchantMapping)

### Recurring Payments Center
**File:** `app/(dashboard)/recurring/page.tsx`

Features implemented:
- Summary cards (total, active, paused, monthly total, price alerts)
- Upcoming payments section (next 5 due)
- Price increase alerts section
- Filter by active/paused status
- Filter by frequency pattern
- Pause/resume tracking per payment
- "Detect Recurring" button to scan transactions

---

## 13.9.5 Category Hierarchy

```typescript
const CATEGORIES = [
  'HOUSING',      // Rent, Mortgage, Utilities, Insurance, Maintenance, Rates
  'TRANSPORT',    // Fuel, Public Transport, Rideshare, Parking, Tolls
  'FOOD',         // Groceries, Dining Out, Takeaway, Coffee, Alcohol
  'UTILITIES',    // Electricity, Gas, Water, Internet, Mobile, TV
  'HEALTH',       // Medical, Pharmacy, Dental, Insurance, Gym
  'ENTERTAINMENT',// Streaming, Events, Hobbies, Gaming, Sports
  'SHOPPING',     // Clothing, Electronics, Home, Online, General
  'FINANCIAL',    // Fees, Interest, Investments, Transfers
  'PERSONAL',     // Beauty, Education, Gifts, Pet, Charity
  'INCOME',       // Salary, Rental, Dividends, Refunds, Other
  'TRANSFER',     // Internal, External
  'UNCATEGORISED' // Default
];
```

---

## 13.9.6 Future Enhancements

1. **Enable OpenAI Categorisation:**
   - Set `OPENAI_API_KEY` in environment
   - Update `lib/tie/categorisation.ts`: `DEFAULT_AI_CONFIG.enabled = true`
   - Adjust confidence thresholds as needed

2. **Additional Data Sources:**
   - OFX file import adapter
   - Bank feed API integration (Phase 14+)

3. **Advanced Analytics:**
   - Seasonality detection improvements
   - Spending cluster analysis
   - Predictive alerts

4. **UI Enhancements:**
   - Split transaction support
   - Bulk category corrections
   - Export functionality

---

## 13.10 Basiq Integration & Data Source Priority

> **Status: IMPLEMENTED** (December 2025)

### 13.10.1 Data Source Hierarchy

Transaction data can come from multiple sources. The following priority order applies:

```
BASIQ (Open Banking) > IMPORT (CSV/QIF/OFX) > MANUAL
```

When Basiq is activated for an account, it becomes the **source of truth** for that account's transactions.

### 13.10.2 Basiq Sync Service

**File:** `lib/bank/basiqSync.ts`

The Basiq sync service handles:
1. **Transaction Import from Basiq API**
2. **Superseding existing imported transactions**
3. **Balance synchronization**
4. **Import eligibility checking**

#### Key Exports:
```typescript
// Sync transactions from Basiq
export async function syncBasiqTransactions(
  userId: string,
  accountId: string,
  options?: BasiqSyncOptions
): Promise<BasiqSyncResult>

// Check if manual import is allowed
export async function canAcceptManualImport(
  accountId: string
): Promise<{ canImport: boolean; reason?: string; basiqStatus?: string }>

// Get transaction counts by source
export async function getTransactionSourceCounts(
  userId: string,
  accountId: string
): Promise<Record<string, number>>
```

### 13.10.3 Transaction Supersession

When Basiq is activated for an account with existing imported transactions:

1. Existing CSV/QIF/OFX transactions are tagged with `SUPERSEDED_BY_BASIQ`
2. Superseded transactions are excluded from normal views but retained for audit
3. Basiq transactions replace them as the authoritative source

```typescript
// Transactions table structure
{
  source: 'CSV' | 'QIF' | 'OFX' | 'BANK' | 'MANUAL',
  tags: string[],  // includes 'SUPERSEDED_BY_BASIQ' when applicable
  externalId: string  // Basiq transaction ID for BANK source
}
```

### 13.10.4 Balance Source Tracking

**Schema Changes:**
```prisma
enum BalanceSource {
  MANUAL     // User manually entered
  IMPORT     // From CSV/QIF/OFX file
  BASIQ      // From Open Banking
}

model Account {
  balanceSource        BalanceSource @default(MANUAL)
  balanceLastUpdatedAt DateTime?
  lastImportedBalance  Float?
}
```

**Priority Rules:**
- Basiq balance always takes priority when connection is ACTIVE
- Import cannot override Basiq-connected account balance
- Manual entry can set balance when no Basiq connection

### 13.10.5 Import Flow with Basiq Check

When a user attempts to import transactions to an account:

```
1. User selects account in Import Wizard
2. System calls canAcceptManualImport(accountId)
3. If account has active Basiq connection:
   - Import is blocked
   - User sees: "This account is connected to Open Banking.
     Transactions are synced automatically from your bank."
4. If no Basiq or inactive:
   - Import proceeds normally
   - Balance updated with source: 'IMPORT'
```

### 13.10.6 API Updates

**New Exports from `lib/bank/`:**
```typescript
export {
  syncBasiqTransactions,
  canAcceptManualImport,
  getTransactionSourceCounts,
} from './basiqSync';
```

### 13.10.7 Future Enhancements

1. **Basiq Webhook Integration:**
   - Real-time transaction sync on bank updates
   - Push notifications for new transactions

2. **Reconciliation Report:**
   - Show differences between imported and Basiq data
   - Allow user to resolve conflicts before supersession

3. **Historical Data Merge:**
   - Option to preserve categorization from imports
   - Apply learned merchant mappings to Basiq transactions

---

## 13.11 Transaction Link Dialog Enhancements

> **Status: IMPLEMENTED** (December 2025)

### 13.11.1 Asset Source Type for Expenses

**Files:**
- `components/transactions/TransactionLinkDialog.tsx`
- `app/api/transactions/[id]/link/route.ts`

When linking a transaction to create a new expense entry, users can now select "Asset" as the expense source type, matching the Add New Expense dialog.

#### Available Source Types (Expenses):
| Source Type | Icon | Description |
|-------------|------|-------------|
| General | DollarSign | General expenses not linked to any entity |
| Property | Home | Property-related expenses |
| Loan | Landmark | Loan-related expenses (auto-sets LOAN_INTEREST category) |
| Investment | Briefcase | Investment account expenses |
| **Asset** | Package | **NEW:** Asset-related expenses (vehicles, equipment, etc.) |

#### Implementation:

**State Management:**
```typescript
const [sourceType, setSourceType] = useState<'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET'>('GENERAL');
const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
```

**API Request Body:**
```typescript
if (sourceType === 'ASSET' && selectedAssetId) {
  requestBody.assetId = selectedAssetId;
}
```

**API LinkRequest Interface:**
```typescript
interface LinkRequest {
  // ... existing fields ...
  sourceType?: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';
  assetId?: string;  // NEW
}
```

#### Asset Selector UI:
```tsx
{sourceType === 'ASSET' && !isIncome && (
  <div className="space-y-2">
    <Label>Linked Asset</Label>
    <Select
      value={selectedAssetId || ''}
      onValueChange={(value) => setSelectedAssetId(value || null)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select an asset" />
      </SelectTrigger>
      <SelectContent>
        {assets.map((asset) => (
          <SelectItem key={asset.id} value={asset.id}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {asset.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

### 13.11.2 API Updates for Asset Source

**GET `/api/transactions/[id]/link`:**
Now returns assets in `availableSources`:
```typescript
availableSources: {
  properties: Property[],
  loans: Loan[],
  investmentAccounts: InvestmentAccount[],
  assets: Asset[],  // NEW
}
```

**POST `/api/transactions/[id]/link` (action: create):**
When creating an expense with `sourceType: 'ASSET'`:
```typescript
if (body.sourceType === 'ASSET' && body.assetId) {
  expenseData.assetId = body.assetId;
}
```

---

## 13.12 Category-Based Transaction Suggestions

> **Status: IMPLEMENTED** (December 2025)

### 13.12.1 Overview

Transaction suggestions now leverage the predicted category from transaction analysis to provide more relevant matching options. When a transaction has a predicted category (e.g., "Utilities" for Origin Energy), expenses with matching categories are included in suggestions with boosted confidence.

### 13.12.2 Category Mapping

**File:** `app/api/transactions/[id]/link/route.ts`

The system maps common category names from transaction predictions to ExpenseCategory enum values:

```typescript
const categoryMapping: Record<string, string> = {
  'UTILITIES': 'UTILITIES',
  'UTILITY': 'UTILITIES',
  'GROCERIES': 'GROCERIES',
  'GROCERY': 'GROCERIES',
  'FOOD_DINING': 'FOOD',
  'FOOD___DINING': 'FOOD',
  'FOOD': 'FOOD',
  'DINING': 'FOOD',
  'TRANSPORT': 'TRANSPORT',
  'TRANSPORTATION': 'TRANSPORT',
  'SHOPPING': 'PERSONAL',
  'ENTERTAINMENT': 'ENTERTAINMENT',
  'SUBSCRIPTION': 'SUBSCRIPTION',
  'SUBSCRIPTIONS': 'SUBSCRIPTION',
  'INSURANCE': 'INSURANCE',
  'HOUSING': 'HOUSING',
  'HEALTH': 'PERSONAL',
  'MEDICAL': 'PERSONAL',
};
```

### 13.12.3 Matching Algorithm Updates

The expense matching algorithm now includes category matching:

```typescript
// Check if the expense category matches the predicted category
const categoryMatch = Boolean(mappedCategory && expense.category === mappedCategory);

// Include if name matches, amount matches, OR category matches
if (similarity > 0.3 || amountMatch || categoryMatch) {
  // Boost confidence for category matches
  let confidence = similarity * (amountMatch ? 1.5 : 1);
  if (categoryMatch) {
    confidence += 0.5; // Boost for matching predicted category
  }
  // Add to matches...
}
```

### 13.12.4 Category Pre-fill for New Expenses

When creating a new expense from a transaction, the category dropdown is pre-filled based on the transaction's predicted category:

**API Response:**
```typescript
{
  transaction: { ... },
  suggestedMatches: [ ... ],
  suggestedCategory: 'UTILITIES',  // Mapped category for pre-fill
  availableEntries: { ... }
}
```

**UI Implementation:**
```typescript
// Pre-fill category from transaction prediction if available
if (data.suggestedCategory && !isIncome) {
  setNewCategory(data.suggestedCategory);
}
```

### 13.12.5 Match Result Interface

The `MatchResult` interface now includes a `categoryMatch` flag:

```typescript
interface MatchResult {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'loan';
  category: string;
  amount: number;
  frequency: string;
  confidence: number;
  amountMatch: boolean;
  amountDiff: number;
  categoryMatch?: boolean;  // NEW: Indicates category-based match
}
```

---

## 13.13 Transfer Option for Incoming Transactions

> **Status: IMPLEMENTED** (December 2025)

### 13.13.1 Overview

Previously, only outgoing (expense) transactions could be marked as transfers. Now, incoming transactions can also be categorized as transfers to properly handle money moving between accounts without counting it as income.

### 13.13.2 Use Cases

- Money transferred from external savings account
- Refunds from credit card to bank account
- Inter-account transfers where source account is not tracked in Monitrax
- Loan disbursements to bank account

### 13.13.3 UI Changes

**File:** `components/transactions/TransactionLinkDialog.tsx`

The transfer toggle now appears for both income and expense transactions:

```tsx
{/* Transfer Toggle - for both income and expense transactions */}
<div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
  <Checkbox
    id="isTransfer"
    checked={isTransfer}
    onCheckedChange={(checked) => {
      setIsTransfer(checked as boolean);
      if (checked) {
        setIsRecurringExpense(false);
        setIsEssential(false);
      }
    }}
  />
  <Label>This is a transfer between accounts</Label>
  <p className="text-xs text-muted-foreground">
    Transfers are excluded from income/expense calculations
  </p>
</div>
```

### 13.13.4 Direction-Aware Labels

Labels change based on transaction direction:

| Transaction Direction | Account Label | Button Label |
|----------------------|---------------|--------------|
| IN (Income) | Transfer From Account | Mark as Incoming Transfer |
| OUT (Expense) | Transfer To Account | Mark as Outgoing Transfer |

```tsx
<Label>{isIncome ? 'Transfer From Account' : 'Transfer To Account'}</Label>
<p className="text-xs text-muted-foreground">
  {isIncome
    ? 'Select the account this money was transferred from'
    : 'Select the account this money was transferred to'
  }
</p>
```

### 13.13.5 Optional Account Selection

For incoming transfers, the source account selection is optional since the user may not know or track the source account:

```tsx
<Select
  value={transferToAccountId || ''}
  onValueChange={(value) => setTransferToAccountId(value || null)}
>
  <SelectTrigger>
    <SelectValue placeholder={isIncome ? 'Select source account' : 'Select target account'} />
  </SelectTrigger>
  <SelectContent>
    {bankAccounts
      .filter(acc => acc.id !== transaction?.id)
      .map((account) => (
        <SelectItem key={account.id} value={account.id}>
          {account.name} ({account.type})
        </SelectItem>
      ))}
  </SelectContent>
</Select>
```

### 13.13.6 Transfer Exclusion from Calculations

Transfers (both incoming and outgoing) are excluded from:
- Cashflow calculations
- Budget comparisons
- Income/expense summaries
- Financial health metrics

This prevents double-counting when money moves between tracked accounts.

### 13.13.7 Bug Fix: Transfer Account Dropdown

> **Status: FIXED** (December 2025)

**Issue:** The "Transfer From Account" / "Transfer To Account" dropdown was not showing any accounts.

**Root Cause:** The `loadBankAccounts` function was looking for `data.accounts` but the `/api/accounts` endpoint returns `{ data: [...accounts], _meta: {...} }`.

**File:** `components/transactions/TransactionLinkDialog.tsx`

**Fix Applied:**
```typescript
// Before (broken)
setBankAccounts(data.accounts || []);

// After (fixed)
setBankAccounts(data.data || []);
```

The dropdown now correctly loads all user bank accounts for transfer selection.

### 13.13.8 Bug Fix: Transfers Not Excluded from Totals

> **Status: FIXED** (December 2025)

**Issue:** Transactions marked as transfers were still being included in Total Income and Total Spend calculations on the Transactions page.

**Root Cause:** The TIE analytics functions weren't checking `isTransfer` flag when calculating totals.

**Files Fixed:**
- `lib/tie/types.ts` - Added `isTransfer` and `transferToAccountId` to UnifiedTransaction interface
- `lib/tie/analytics.ts` - Updated `calculateSpendingSummary` and `calculateMonthlyTotals` to exclude transfers
- `app/api/unified-transactions/analytics/route.ts` - Pass `isTransfer` when mapping transactions

**Fix Applied:**
```typescript
// In calculateSpendingSummary and calculateMonthlyTotals:
// Exclude transfers from income/expense calculations
const nonTransfers = filtered.filter((tx) => !tx.isTransfer);
const outgoing = nonTransfers.filter((tx) => tx.direction === 'OUT');
const incoming = nonTransfers.filter((tx) => tx.direction === 'IN');
```

Now transfers are properly excluded from:
- Total Income calculation
- Total Spend calculation
- Net Cashflow calculation
- Monthly totals and trends

---

## 13.14 Batch Vendor Categorization

> **Status: IMPLEMENTED** (December 2025)

### 13.14.1 Overview

When categorizing a transaction, the system now finds and displays other uncategorized transactions from the same merchant, allowing users to categorize multiple transactions at once.

### 13.14.2 Same-Vendor Detection

**File:** `app/api/transactions/[id]/link/route.ts`

The API finds uncategorized transactions from the same merchant:

```typescript
const sameVendorTransactions = await prisma.unifiedTransaction.findMany({
  where: {
    userId,
    id: { not: transactionId }, // Exclude current transaction
    OR: [
      { merchantStandardised: merchantName },
      { description: { contains: merchantName, mode: 'insensitive' } },
    ],
    // Only uncategorized transactions
    incomeId: null,
    expenseId: null,
    loanId: null,
    isTransfer: false,
  },
  orderBy: { date: 'desc' },
  take: 20, // Limit to most recent 20
});
```

### 13.14.3 Batch Selection UI

**File:** `components/transactions/TransactionLinkDialog.tsx`

A purple "Same Vendor" panel displays matching transactions with checkboxes:

```tsx
{sameVendorTransactions.length > 0 && (
  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200">
    <div className="flex items-center justify-between mb-2">
      <span>Same Vendor ({sameVendorTransactions.length} more)</span>
      <Button onClick={toggleAllVendorTransactions}>
        {allSelected ? 'Deselect All' : 'Select All'}
      </Button>
    </div>
    {sameVendorTransactions.map((tx) => (
      <div onClick={() => toggleVendorTransaction(tx.id)}>
        <Checkbox checked={selectedVendorTransactions.has(tx.id)} />
        <span>{tx.merchantStandardised || tx.description}</span>
        <span>{formatCurrency(tx.amount)}</span>
      </div>
    ))}
  </div>
)}
```

### 13.14.4 Batch Categorization API

The POST endpoint accepts additional transaction IDs for batch processing:

```typescript
interface LinkRequest {
  // ... existing fields ...
  additionalTransactionIds?: string[]; // Batch categorize multiple transactions
}
```

Implementation:
```typescript
if (body.additionalTransactionIds?.length > 0) {
  const validIds = await prisma.unifiedTransaction.findMany({
    where: { id: { in: body.additionalTransactionIds }, userId },
    select: { id: true },
  });

  await prisma.unifiedTransaction.updateMany({
    where: { id: { in: validIds.map(t => t.id) } },
    data: {
      expenseId: expense.id,
      categoryLevel1: body.category,
    },
  });
}
```

### 13.14.5 Visual Indicators

Button labels show the batch count:
- **Suggested matches tab:** "Link (3)" when 2 additional transactions selected
- **Create new tab:** "Create Expense Entry (+2 more)" when 2 additional transactions selected

---

## 13.15 Merchant Learning (Auto-Suggestions)

> **Status: IMPLEMENTED** (December 2025)

### 13.15.1 Overview

When a user categorizes a transaction, the system learns the merchant-to-category mapping and uses it to suggest categories for future transactions from the same vendor.

### 13.15.2 MerchantMapping Model

**File:** `prisma/schema.prisma`

```prisma
model MerchantMapping {
  id                    String    @id @default(uuid())
  userId                String?   // Null = global mapping, set = user-specific
  merchantRaw           String    // Original merchant string pattern
  merchantStandardised  String    // Normalised name
  merchantCategoryCode  String?   // MCC if known
  categoryLevel1        String    // Mapped category
  categoryLevel2        String?
  subcategory           String?
  confidence            Float     @default(1.0)
  source                String    @default("RULE") // RULE, USER, AI
  usageCount            Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, merchantRaw])
  @@index([merchantRaw])
}
```

### 13.15.3 Learning on Categorization

**File:** `app/api/transactions/[id]/link/route.ts`

When categorizing a transaction with `learnMerchant: true`:

```typescript
if (body.learnMerchant && transaction.merchantStandardised && category) {
  await prisma.merchantMapping.upsert({
    where: {
      userId_merchantRaw: {
        userId,
        merchantRaw: transaction.merchantStandardised,
      },
    },
    update: {
      categoryLevel1: category,
      usageCount: { increment: 1 },
      updatedAt: new Date(),
    },
    create: {
      userId,
      merchantRaw: transaction.merchantStandardised,
      merchantStandardised: transaction.merchantStandardised,
      categoryLevel1: category,
      source: 'USER',
      confidence: 1.0,
      usageCount: 1,
    },
  });
}
```

### 13.15.4 Learned Category Lookup

When loading the transaction link dialog, check for existing mappings:

```typescript
let learnedCategory: string | null = null;
if (transaction.merchantStandardised) {
  const merchantMapping = await prisma.merchantMapping.findFirst({
    where: {
      merchantRaw: transaction.merchantStandardised,
      OR: [
        { userId }, // User-specific mapping takes priority
        { userId: null }, // Fall back to global mapping
      ],
    },
    orderBy: [
      { userId: 'desc' }, // User mappings first (non-null)
      { usageCount: 'desc' },
    ],
  });
  if (merchantMapping) {
    learnedCategory = merchantMapping.categoryLevel1;
  }
}
```

### 13.15.5 UI Components

**Learned Category Badge:**
```tsx
{learnedCategory && (
  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
    Previously: {learnedCategory}
  </Badge>
)}
```

**Learn Merchant Checkbox:**
```tsx
<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200">
  <Checkbox
    id="learnMerchant"
    checked={learnMerchant}
    onCheckedChange={(checked) => setLearnMerchant(checked as boolean)}
  />
  <Label>Remember for future {transaction.merchantStandardised} transactions</Label>
  <p className="text-xs text-muted-foreground">
    Future transactions from this vendor will be auto-suggested with this category
  </p>
</div>
```

### 13.15.6 Category Pre-fill Priority

The suggested category follows this priority:
1. **Learned category** - From previous user categorizations
2. **Predicted category** - From transaction analysis (MCC, description parsing)
3. **None** - User selects manually

```typescript
suggestedCategory: learnedCategory || mappedCategory
```

### 13.15.7 API Response Updates

**GET `/api/transactions/[id]/link`:**
```typescript
{
  transaction: { ... },
  suggestedMatches: [ ... ],
  suggestedCategory: 'UTILITIES',     // Learned or predicted
  learnedCategory: 'UTILITIES',       // From MerchantMapping if exists
  sameVendorTransactions: [ ... ],    // For batch categorization
  availableEntries: { ... }
}
```

**POST `/api/transactions/[id]/link`:**
```typescript
// Request body
{
  action: 'create',
  type: 'expense',
  category: 'FOOD',
  additionalTransactionIds: ['tx-2', 'tx-3'],  // Batch categorize
  learnMerchant: true                           // Store mapping
}

// Response
{
  success: true,
  created: { type: 'expense', id: '...', name: 'Soul Origin' },
  batchCount: 2,  // Number of additional transactions categorized
  message: 'Categorized 3 transactions as Soul Origin'
}
```

---

## 13.16 Uncategorized Transactions Default View

> **Status: IMPLEMENTED** (December 2025)

### 13.16.1 Overview

The Transaction Explorer page now defaults to showing only uncategorized transactions, helping users focus on categorizing their backlog while still being able to view all transactions when needed.

### 13.16.2 API Filter Support

**File:** `app/api/unified-transactions/route.ts`

New query parameters:
- `uncategorized=true` - Filter to only show uncategorized transactions
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

### 13.16.3 Tile Filter State

**File:** `app/(dashboard)/transactions/page.tsx`

```typescript
// Tile filter: 'uncategorized' (default), 'spend', 'income', 'all'
const [tileFilter, setTileFilter] = useState<'uncategorized' | 'spend' | 'income' | 'all' | null>('uncategorized');
```

Filter behavior:
| Tile Filter | API Parameters |
|------------|----------------|
| `uncategorized` | `uncategorized=true` |
| `spend` | `direction=OUT&excludeTransfers=true` |
| `income` | `direction=IN&excludeTransfers=true` |
| `all` | No additional filters |

### 13.16.4 Clickable Summary Cards

The summary cards are now interactive:

```tsx
function SummaryCards({ summary, activeFilter, onFilterChange }) {
  const getTileClasses = (tileType) => {
    const isActive = activeFilter === tileType;
    return `bg-white rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-md ${
      isActive ? 'ring-2 ring-blue-500 ring-offset-1' : ''
    }`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div
        className={getTileClasses('spend')}
        onClick={() => onFilterChange(activeFilter === 'spend' ? 'uncategorized' : 'spend')}
      >
        {/* Total Spend content */}
        {activeFilter === 'spend' && <div className="text-xs text-blue-600 mt-1">Showing all</div>}
      </div>
      {/* Similar for Income, Net Cashflow, Transactions tiles */}
    </div>
  );
}
```

### 13.16.5 Visual Indicators

**Uncategorized Banner:**
```tsx
{tileFilter === 'uncategorized' && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between">
    <div className="flex items-center gap-2 text-amber-800">
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm font-medium">Showing uncategorized transactions only</span>
      <span className="text-xs text-amber-600">(click a tile above to view all)</span>
    </div>
  </div>
)}
```

**Active Tile Indicators:**
- Blue ring (`ring-2 ring-blue-500`) around active tile
- "Showing all" label when tile is selected

### 13.16.6 Auto-Refresh on Categorization

When a transaction is categorized via the link dialog:
```typescript
onLinked={() => {
  fetchTransactions();  // Refreshes list - categorized items disappear in uncategorized view
  fetchSummary();       // Updates totals
}}
```

### 13.16.7 User Experience Flow

1. **Default State**: User sees only uncategorized transactions
2. **Categorization**: User clicks a transaction and categorizes it
3. **Auto-Disappear**: Transaction disappears from the list (if in uncategorized view)
4. **View All**: User can click a tile to see all transactions of that type
5. **Return**: Click the same tile again to return to uncategorized view

---

## 13.17 Auto-Navigate to Next Transaction

> **Status: IMPLEMENTED** (December 2025)

### 13.17.1 Overview

After successfully categorizing a transaction, the dialog automatically navigates to the next uncategorized transaction, providing a seamless batch categorization experience.

### 13.17.2 Dialog Props

**File:** `components/transactions/TransactionLinkDialog.tsx`

```typescript
interface TransactionLinkDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
  onNavigateNext?: () => void;       // Navigate to next transaction
  hasMoreTransactions?: boolean;     // Whether more transactions exist
}
```

### 13.17.3 Auto-Navigation Logic

After successful categorization (link, create, or transfer):

```typescript
// Auto-navigate to next transaction after a brief delay to show success
setTimeout(() => {
  if (hasMoreTransactions && onNavigateNext) {
    onNavigateNext();
  } else {
    onOpenChange(false);
  }
}, 800);
```

### 13.17.4 Parent Component Implementation

**File:** `app/(dashboard)/transactions/page.tsx`

```typescript
<TransactionLinkDialog
  transaction={linkingTransaction}
  hasMoreTransactions={transactions.length > 1}
  onNavigateNext={() => {
    const currentIndex = transactions.findIndex(t => t.id === linkingTransaction?.id);
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

    if (nextIndex < transactions.length) {
      setLinkingTransaction(transactions[nextIndex]);
    } else {
      setShowLinkDialog(false);
    }
  }}
/>
```

### 13.17.5 User Experience

1. User opens transaction categorization dialog
2. User categorizes the transaction (link, create expense, or mark as transfer)
3. Success message displays for 800ms
4. Dialog automatically shows the next uncategorized transaction
5. If no more transactions, dialog closes automatically

### 13.17.6 Bug Fix: Stale Closure Issue

> **Status: FIXED** (December 2025)

**Issue:** The dialog stayed on the same transaction after categorization instead of navigating to the next one.

**Root Cause:** The `onNavigateNext` callback was using a stale `transactions` array from a JavaScript closure. When `fetchTransactions()` was called asynchronously, the navigation timer (800ms) fired before the React state update completed.

**Solution:**
1. Changed `onLinked` prop type to return `Promise<void>` so dialog can await it
2. Added a `transactionsRef` to track the latest transactions value
3. Updated `fetchTransactions` to synchronously update the ref when data arrives
4. `onNavigateNext` now reads from the ref to get fresh data

**Implementation:**
```typescript
// In transactions/page.tsx
const transactionsRef = useRef<Transaction[]>([]);
transactionsRef.current = transactions;

// In fetchTransactions
if (response.ok && json.success) {
  setTransactions(json.data);
  transactionsRef.current = json.data; // Update ref immediately
}

// In onNavigateNext
onNavigateNext={() => {
  const currentTransactions = transactionsRef.current;
  if (currentTransactions.length > 0) {
    setLinkingTransaction(currentTransactions[0]);
  } else {
    setShowLinkDialog(false);
  }
}}

// In TransactionLinkDialog
await onLinked?.(); // Wait for fetch to complete
setTimeout(() => {
  if (hasMoreTransactions && onNavigateNext) {
    onNavigateNext();
  }
}, 800);
```

---

## 13.18 Custom Category Support

> **Status: IMPLEMENTED** (December 2025)

### 13.18.1 Overview

Users can now create custom expense and income categories when the system-defined categories don't fit their needs. Custom categories are stored in a centralized `Category` table and are available across all areas of the application.

### 13.18.2 Category Model

**File:** `prisma/schema.prisma`

```prisma
enum CategoryType {
  EXPENSE
  INCOME
}

model Category {
  id          String       @id @default(uuid())
  userId      String
  name        String       // Display name (e.g., "Pet Care", "Side Business")
  code        String       // Unique code per user (auto-generated from name)
  type        CategoryType // EXPENSE or INCOME
  description String?
  color       String?      // Hex color for UI (e.g., "#FF5733")
  icon        String?      // Icon name for UI
  isSystem    Boolean      @default(false) // True for system defaults
  isActive    Boolean      @default(true)  // Soft delete flag
  sortOrder   Int          @default(0)     // Custom ordering
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  expenses    Expense[]    @relation("ExpenseCustomCategory")
  income      Income[]     @relation("IncomeCustomCategory")

  @@unique([userId, code])
  @@index([userId])
  @@index([userId, type])
  @@map("categories")
}
```

**Updates to Expense and Income models:**
```prisma
model Expense {
  // ... existing fields ...
  customCategoryId  String?   // Optional: overrides 'category' if set
  customCategory    Category? @relation("ExpenseCustomCategory", fields: [customCategoryId], references: [id])
}

model Income {
  // ... existing fields ...
  customCategoryId  String?   // Optional: overrides 'type' if set
  customCategory    Category? @relation("IncomeCustomCategory", fields: [customCategoryId], references: [id])
}
```

### 13.18.3 Categories API

**File:** `app/api/categories/route.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/categories` | GET | List all categories (system + custom) |
| `/api/categories` | POST | Create new custom category |
| `/api/categories/[id]` | GET | Get single category |
| `/api/categories/[id]` | PUT | Update category (name, description, color, icon) |
| `/api/categories/[id]` | DELETE | Soft delete (or force delete if unused) |

**Query Parameters (GET):**
- `type=EXPENSE|INCOME` - Filter by category type
- `includeSystem=true|false` - Include/exclude system categories (default: true)

**System Categories:**
System categories are generated from existing enums (`EXPENSE_CATEGORIES`, `INCOME_TYPES`) and returned with IDs in format `system:expense:HOUSING` or `system:income:SALARY`.

### 13.18.4 useCategories Hook

**File:** `hooks/useCategories.ts`

```typescript
interface Category {
  id: string;
  code: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  color: string | null;
  icon: string | null;
  description: string | null;
}

interface UseCategoriesReturn {
  categories: Category[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCategory: (data: CreateCategoryData) => Promise<Category | null>;
  updateCategory: (id: string, data: UpdateCategoryData) => Promise<Category | null>;
  deleteCategory: (id: string, force?: boolean) => Promise<boolean>;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryByCode: (code: string, type: 'EXPENSE' | 'INCOME') => Category | undefined;
}

export function useCategories(options?: UseCategoriesOptions): UseCategoriesReturn;
```

### 13.18.5 CategorySelect Component

**File:** `components/categories/CategorySelect.tsx`

A dropdown component that displays both system and custom categories with inline add capability:

```tsx
<CategorySelect
  type="EXPENSE"
  value={selectedCategory}
  onChange={(value, isCustom) => {
    setCategory(value);
    setIsCustomCategory(isCustom);
  }}
  placeholder="Select category"
  allowCustom={true}
/>
```

**Features:**
- Groups categories: "Standard Categories" (system) and "My Categories" (custom)
- "Add new category..." option opens a dialog to create new category inline
- Returns whether selected category is custom or system
- Custom categories display color indicator if set

### 13.18.6 Integration with Transaction Link Dialog

**File:** `components/transactions/TransactionLinkDialog.tsx`

The dialog now uses `CategorySelect` instead of the static dropdown:

```typescript
// State to track if selected category is custom
const [isCustomCategory, setIsCustomCategory] = useState(false);

// CategorySelect usage
<CategorySelect
  type={isIncome ? 'INCOME' : 'EXPENSE'}
  value={newCategory}
  onChange={(value, isCustom) => {
    setNewCategory(value);
    setIsCustomCategory(isCustom);
  }}
/>

// API request with custom category support
const requestBody = {
  action: 'create',
  type,
  name: newName,
  ...(isCustomCategory
    ? { customCategoryId: newCategory, category: 'OTHER' }
    : { category: newCategory }),
  // ... other fields
};
```

### 13.18.7 API Updates

**Transaction Link API (`app/api/transactions/[id]/link/route.ts`):**

```typescript
interface LinkRequest {
  // ... existing fields ...
  category?: string;           // System category enum
  customCategoryId?: string;   // User-defined category ID
}

// When creating expense/income:
if (body.customCategoryId) {
  // Validate custom category ownership
  const customCategory = await prisma.category.findFirst({
    where: { id: body.customCategoryId, userId, type: 'EXPENSE' },
  });
  if (!customCategory) {
    return NextResponse.json({ error: 'Custom category not found' }, { status: 404 });
  }
  expenseData.customCategoryId = body.customCategoryId;
  expenseData.category = 'OTHER'; // Fallback for system field
}
```

**Expenses API (`app/api/expenses/route.ts`):**

- GET now includes `customCategory` relation in response
- POST accepts `customCategoryId` and validates ownership

### 13.18.8 Usage Flow

1. User categorizes a transaction
2. In category dropdown, user sees "Standard Categories" and "My Categories"
3. If needed category doesn't exist, user clicks "Add new category..."
4. Dialog appears to create new category with name and optional description
5. New category is created and immediately selected
6. Transaction is categorized with the new custom category
7. Custom category is available for future transactions

### 13.18.9 Migration Required

```bash
npx prisma migrate dev --name add_custom_categories
```

This migration:
1. Creates `CategoryType` enum
2. Creates `categories` table
3. Adds `customCategoryId` nullable field to `expenses` and `income` tables
4. Creates indexes for efficient querying


---

## 13.19 Investment Contribution Tracking

**Added:** 2025-12-25

### 13.19.1 Problem Statement

When money flows from a bank account to an investment account (shares, crypto, managed funds):
- It appears as an outgoing transaction in the bank account
- It is NOT an expense (no consumption occurred)
- It is NOT a simple transfer (the value will change over time)
- The original contribution amount (cost basis) needs to be tracked separately from current value

### 13.19.2 Solution

A new transaction type: **Investment Contribution**

When a user marks a bank transaction as an investment contribution:
1. The bank transaction is linked to the target investment account
2. A `DEPOSIT` type `InvestmentTransaction` is created in the investment account
3. The investment account cash balance is incremented
4. The transaction is excluded from expense/income calculations
5. The original contribution is tracked for cost basis calculations

### 13.19.3 Schema Changes

**UnifiedTransaction additions:**

```prisma
model UnifiedTransaction {
  // ... existing fields ...
  
  // Investment contribution tracking
  isInvestmentContribution Boolean  @default(false)
  investmentTransactionId  String?  @unique  // Links to InvestmentTransaction
}
```

### 13.19.4 API Changes

**New action in Transaction Link API:**

```typescript
// POST /api/transactions/[id]/link
{
  "action": "investment",
  "investmentContributionAccountId": "uuid-of-investment-account"
}
```

**Response:**
```json
{
  "success": true,
  "investmentTransaction": {
    "id": "uuid",
    "type": "DEPOSIT",
    "amount": 1000.00
  },
  "message": "Investment contribution of $1000.00 recorded to Shares Portfolio"
}
```

### 13.19.5 UI Changes

**TransactionLinkDialog Updates:**

1. New checkbox option: "This is an investment contribution" (purple themed)
2. Investment account selector dropdown
3. Purple-themed "Record Investment Contribution" button
4. Investment contributions displayed with purple badge when viewing linked transactions

### 13.19.6 Investment Transaction Integration

When an investment contribution is recorded:
1. Creates `InvestmentTransaction` of type `DEPOSIT`
2. Sets `totalAmount` to the transaction amount
3. Links the bank transaction via `investmentTransactionId`
4. Updates `cashBalance` on the investment account

### 13.19.7 Unlinking Behavior

When an investment contribution is unlinked:
1. The created `InvestmentTransaction` is deleted
2. The investment account `cashBalance` is decremented
3. The bank transaction fields are cleared

### 13.19.8 Financial Reporting Impact

Investment contributions:
- ✅ Excluded from expense totals
- ✅ Excluded from income totals  
- ✅ Tracked in Net Worth calculations (as part of investment account value)
- ✅ Visible in investment account transaction history
- ✅ Used for cost basis calculations when selling holdings

### 13.19.9 Migration Required

```bash
npx prisma migrate dev --name add_investment_contribution_tracking
```

This migration:
1. Adds `isInvestmentContribution` boolean field to `unified_transactions`
2. Adds `investmentTransactionId` nullable unique field to `unified_transactions`

---

## 13.20 Transaction Categorization Bug Fixes

> **Status: FIXED** (February 2026)

### 13.20.1 Batch Categorization Fix

**Issue:** When categorizing transactions with batch mode (same vendor transactions), only the main transaction was being categorized while additional selected transactions remained uncategorized.

**Root Cause:** The batch categorization query was finding transactions that already had categories set or were marked as investment contributions.

**Fix Applied (app/api/transactions/[id]/link/route.ts):**

```typescript
const sameVendorTransactions = await prisma.unifiedTransaction.findMany({
  where: {
    userId,
    id: { not: transactionId },
    OR: merchantName
      ? [
          { merchantStandardised: merchantName },
          { description: { contains: merchantName, mode: 'insensitive' as const } },
        ]
      : [{ merchantStandardised: merchantName }],
    // Only uncategorized transactions (no links, not transfer, not investment)
    incomeId: null,
    expenseId: null,
    loanId: null,
    isTransfer: false,
    isInvestmentContribution: false,  // Exclude investment contributions
    categoryLevel1: null,              // Exclude transactions with category already set
  },
  orderBy: { date: 'desc' },
  take: 20,
});
```

### 13.20.2 Merchant Learning Fix

**Issue:** The "Remember category for future transactions" checkbox was not working with custom categories.

**Root Cause:** The merchant mapping was storing the system category code (e.g., 'OTHER') instead of the actual custom category name.

**Schema Update (prisma/schema.prisma):**

```prisma
model MerchantMapping {
  // ... existing fields ...
  customCategoryId      String?   // Reference to user's custom Category if used
}
```

**Fix Applied (app/api/transactions/[id]/link/route.ts):**

```typescript
// Learn merchant mapping for future suggestions
// Use the actual category (or custom category name if custom)
const categoryToLearn = body.customCategoryId
  ? (await prisma.category.findUnique({
      where: { id: body.customCategoryId },
      select: { name: true }
    }))?.name || body.category
  : body.category;

if (body.learnMerchant && transaction.merchantStandardised && categoryToLearn) {
  await prisma.merchantMapping.upsert({
    where: {
      userId_merchantRaw: {
        userId,
        merchantRaw: transaction.merchantStandardised,
      },
    },
    update: {
      categoryLevel1: categoryToLearn,
      customCategoryId: body.customCategoryId || null,
      usageCount: { increment: 1 },
      updatedAt: new Date(),
    },
    create: {
      userId,
      merchantRaw: transaction.merchantStandardised,
      merchantStandardised: transaction.merchantStandardised,
      categoryLevel1: categoryToLearn,
      customCategoryId: body.customCategoryId || null,
      source: 'USER',
      confidence: 1.0,
      usageCount: 1,
    },
  });
}
```

### 13.20.3 Transfer Label Update

**Change:** Updated the transfer checkbox label to include credit card repayments.

**UI Update (components/transactions/TransactionLinkDialog.tsx):**

```tsx
<Label htmlFor="isTransfer">
  Transfer / Credit Card Repayment
</Label>
<p className="text-xs text-muted-foreground">
  Internal transfers and credit card payments are excluded from income/expense calculations
</p>
```

### 13.20.4 Skip Transaction Button

**Feature:** Added a "Skip for now" button that allows users to skip the current transaction and move to the next one without categorizing it.

**Implementation (components/transactions/TransactionLinkDialog.tsx):**

```tsx
{/* Skip button - allows skipping to next transaction */}
{hasMoreTransactions && onNavigateNext && (
  <div className="flex justify-end border-t pt-3">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onNavigateNext();
      }}
      className="text-muted-foreground"
    >
      Skip for now →
    </Button>
  </div>
)}
```

**Use Cases:**
- Transaction needs investigation before categorization
- User wants to batch similar transactions later
- Transaction details are unclear and need bank statement review

---

## 13.21 Transaction Reconciliation (Budget vs Actual)

> **Status: IMPLEMENTED** (February 2026)

### 13.21.1 Overview

Transaction reconciliation solves the problem of "duplicate" income/expense entries when both manually-entered recurring entries and bank transaction categorization exist for the same item.

**Problem Example:**
- User creates a "Water Rate" expense entry with $50/month budget
- User imports bank transactions and categorizes a $47.32 water bill
- System now has two water expenses, creating double-counting

**Solution:**
When categorizing a transaction to an existing entry, the system:
1. Detects matching entries based on category, name, or amount
2. Recommends whether to link only or update the amount
3. Preserves the original amount as "budgetedAmount" for variance tracking
4. Updates the entry's actual amount from the transaction

### 13.21.2 Schema Changes

**Expense and Income models (prisma/schema.prisma):**

```prisma
model Expense {
  // ... existing fields ...

  // Phase 30: Budget vs Actual Reconciliation
  budgetedAmount        Float?            // Original budgeted/estimated amount
  lastReconciled        DateTime?         // When amount was last updated from transactions
}

model Income {
  // ... existing fields ...

  // Phase 30: Budget vs Actual Reconciliation
  budgetedAmount        Float?            // Original budgeted/estimated amount
  lastReconciled        DateTime?         // When amount was last updated from transactions
}
```

### 13.21.3 Reconciliation Utility Functions

**File:** `lib/utils/reconciliation.ts`

Pure utility functions for reconciliation logic (no database calls):

```typescript
// Detect frequency from transaction dates
export function detectFrequency(dates: Date[]): FrequencyResult;

// Analyze transaction pattern from same-vendor transactions
export function analyzeTransactionPattern(transactions: TransactionForPattern[]): TransactionPattern;

// Find best matching entry for a transaction
export function findBestMatch(
  transaction: TransactionForMatch,
  entries: EntryForMatch[],
  options?: MatchOptions
): MatchResult | null;

// Calculate budget variance for an entry
export function calculateBudgetVariance(
  actual: number,
  budgeted: number
): BudgetVarianceResult;

// Calculate total budget variance across entries
export function calculateTotalBudgetVariance(
  entries: BudgetEntry[]
): TotalBudgetVariance;
```

### 13.21.4 Master Financial Service Updates

**File:** `lib/services/masterFinancialService.ts`

Added budget variance calculations to the master snapshot:

```typescript
export interface BudgetVariance {
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'over' | 'on_track';
  entriesWithBudget: number;
  entriesReconciled: number;
}

// Added to MasterExpenseBreakdown
interface MasterExpenseBreakdown {
  // ... existing fields ...
  budgetVariance: BudgetVariance;
}

// Added to MasterIncomeBreakdown
interface MasterIncomeBreakdown {
  // ... existing fields ...
  budgetVariance: BudgetVariance;
}
```

### 13.21.5 API Enhancements

**GET `/api/transactions/[id]/link`:**

Returns additional fields for reconciliation:

```typescript
interface MatchResult {
  // ... existing fields ...
  propertyId?: string | null;
  budgetedAmount?: number | null;
  lastReconciled?: Date | null;
  reconciliationRecommendation?: 'update_amount' | 'link_only' | 'create_new';
  categoryMatch?: boolean;
}

// Response also includes transaction pattern analysis
{
  transaction: { ... },
  suggestedMatches: MatchResult[],
  transactionPattern: {
    count: number,
    detectedFrequency: string,    // WEEKLY, FORTNIGHTLY, MONTHLY, etc.
    averageAmount: number,
    averageIntervalDays: number,
    dateRange: { first: Date, last: Date }
  },
  // ... other fields
}
```

**POST `/api/transactions/[id]/link` (action: link or update):**

When `updateAmount: true`, the API now:
1. Saves the current amount as `budgetedAmount` (if not already set)
2. Updates the entry's amount to the transaction amount
3. Sets `lastReconciled` to current timestamp

```typescript
// Budget tracking on update
if (body.updateAmount) {
  const budgetedAmount = expense.budgetedAmount ?? expense.amount;
  await prisma.expense.update({
    where: { id: body.targetId },
    data: {
      amount: transaction.amount,
      budgetedAmount: budgetedAmount,
      lastReconciled: new Date(),
    },
  });
}
```

### 13.21.6 UI Changes

**TransactionLinkDialog Updates:**

1. **Pattern Detection Alert:**
   When transaction pattern is detected (3+ transactions from same vendor), displays:
   ```
   Pattern Detected
   5 transactions from this vendor over the last 12 months.
   Average: $47.50 / monthly
   ```

2. **Reconciliation Recommendation:**
   Match cards show recommendations based on amount variance:
   - **Link Only**: Amount matches within 5%
   - **Update Amount**: Amount differs by 5-50% (highlighted, recommended)
   - **Create New**: Amount differs by >50%

3. **Budget Display:**
   If an entry has a budgeted amount different from actual, it's shown:
   ```
   $47.32
   Diff: $2.68 (5%)
   Budget: $50.00
   ```

4. **Category Match Badge:**
   Entries matching the transaction's predicted category show a "Category match" badge.

### 13.21.7 Reconciliation Flow

1. User opens Transaction Link dialog for a bank transaction
2. System analyzes same-vendor transactions to detect pattern
3. System matches against existing income/expense entries
4. For matches with amount differences, system recommends "Link & Update"
5. User clicks "Link & Update":
   - Entry's current amount saved as budgetedAmount
   - Entry's amount updated to transaction amount
   - lastReconciled timestamp set
6. Budget variance is now trackable in Master Financial Service

### 13.21.8 Budget Variance Tracking

The system now tracks:
- **entriesWithBudget**: Count of entries with budgeted amounts set
- **entriesReconciled**: Count of entries reconciled from transactions
- **variance**: Difference between actual and budgeted
- **variancePercent**: Percentage over/under budget
- **status**: 'under', 'over', or 'on_track' (within 5%)

This data feeds into:
- Budget Analysis page comparisons
- Financial Health calculations
- CFO Dashboard insights

### 13.21.9 Design Principles Alignment

This feature follows Monitrax design principles:

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | Budget calculations in Master Financial Service |
| **Pure Engines** | Reconciliation utilities are pure functions (no DB calls) |
| **Canonical Utility Locations** | `lib/utils/reconciliation.ts` added to design docs |
| **No Duplicate Logic** | Variance calculations centralized |
| **Per-Property Scope** | Matching considers propertyId for property-related entries |

