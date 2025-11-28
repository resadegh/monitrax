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
