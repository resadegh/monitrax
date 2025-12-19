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
