# PHASE 14 — CASHFLOW OPTIMISATION ENGINE  
**Monitrax Blueprint — Phase 14**

## Purpose  
Turn Monitrax into a *proactive cashflow architect* that forecasts future liquidity, prevents shortfalls, reallocates resources intelligently, and guides the user toward maximum financial efficiency.

Phase 14 consumes the Transaction Intelligence Engine (Phase 13) and transforms raw transactions into actionable cashflow strategy.

This phase unlocks the first *truly predictive* behaviour of Monitrax.

---

# 14.1 Objectives  
1. **Develop the Cashflow Forecasting Engine**
   - Predict daily/weekly/monthly cash positions  
   - Identify upcoming shortfalls  
   - Predict future bills & recurring expenses  
   - Integrate with all accounts (bank, credit, offset)  

2. **Create the Cashflow Optimisation Engine**
   - Recommend account-to-account fund movements  
   - Identify wasteful or leaking expenses  
   - Detect subscription inflation  
   - Suggest optimised payment schedules  
   - Suggest repayment optimisation for loans  

3. **Build the Cashflow Stress Testing Model**
   - What-if modelling  
   - Income variability scenarios  
   - Expense shocks  
   - Interest rate stress tests  

4. **Expose a Cashflow Strategy Dashboard**
   - Forecast graph  
   - Withdrawable cash calculation  
   - Three-month burn rate  
   - Category impact scores  

5. **Integrate fully with the Insights Engine v3**
   - Cashflow risk insights  
   - Subscription alerts  
   - Behavioural trend signals  

---

# 14.2 Architecture Overview  

Phase 14 introduces two tightly coupled components:

---

## **14.2.1 Cashflow Forecasting Engine (CFE)**  
Predicts *future cash balances* per account and globally.

### Inputs:
- Transaction Intelligence Engine (Phase 13)  
- Recurring payments dataset  
- Income patterns  
- Loan schedules  
- Account metadata  
- User modifications (planned future expenses)  

### Outputs:
- Daily projected balance curves  
- Confidence intervals  
- Cashflow volatility index  
- Estimated shortfall dates  
- Expected recurring charges timeline  

---

## **14.2.2 Cashflow Optimisation Engine (COE)**  
Recommends actions that increase surplus and reduce financial strain.

### Core Logic:
- Spending inefficiency detection  
- Categorisation of “wasteful recurring spend”  
- Payment schedule optimisation  
- Automated cash-pooling strategies (move money to avoid overdrafts)  
- Offset account maximisation  
- Loan repayment strategy recommendations  
- “Break-even day” optimiser  
- Subscription price rise detection  

---

# 14.3 Data Model Requirements  

### **14.3.1 CashflowForecast model**
- accountId  
- date  
- predictedBalance  
- predictedIncome  
- predictedExpenses  
- confidenceScore  
- volatilityFactor  
- metadata  

### **14.3.2 CashflowInsight model**
- id  
- severity  
- description  
- category (recurring, anomaly, inefficiency, liquidity risk)  
- recommendedAction  
- impactedAccounts[]  
- impactedCategories[]  
- valueEstimate  

### **14.3.3 CashflowStrategy model**
- strategyId  
- type (optimise, prevent shortfall, maximise offset, reduce waste, rebalance)  
- confidence  
- projectedBenefit  
- recommendedSteps[]  

---

# 14.4 Computational Flow

```
TIE (Phase 13) → CFE → COE → Insights Engine → UI Strategy Panel
```

### Step-by-step:
1. **Predict recurring payments** (Phase 13)
2. **Pull income pattern curves**
3. **Pull loan repayment schedules**
4. **Compute baseline forecast**
5. **Compute volatility bands**
6. **Run stress tests (optional)**
7. **Run optimisers**
8. **Generate insights**
9. **Render UI**

---

# 14.5 Machine Learning Requirements  

### **Models**
- Recurrence classifier  
- Category-level spend predictor  
- Income trend predictor  
- Cashflow volatility estimator  
- Subscription drift detector  
- Shortfall predictor  

### **Model Requirements**
- Must operate offline-friendly  
- Cacheable  
- Deterministic fallback behaviour  
- Human-correction learning loop  

---

# 14.6 UI Requirements  

## **14.6.1 Cashflow Dashboard**
- Animated 90-day forecast curve  
- Highlight shortfall days  
- Monthly cashflow histogram  
- Surplus/deficit gauges  
- Category impact panel  
- Recurring payments heatmap  

## **14.6.2 Cashflow Strategy Panel**
Displays:
- Recommended actions  
- Estimated savings  
- Implementation button (e.g., “adjust repayment schedule”)  
- Confidence indicators  

## **14.6.3 Stress Test Simulator**
User selects:
- Income drop %  
- Unexpected expenses  
- Interest rate change  
- Inflation scenario  

UI shows:
- Survival time  
- New forecast curve  
- Recommended mitigation  

---

# 14.7 Integration with Other Phases  

### Depends On:
- Phase 13 (Transactional Intelligence)  
- Phase 03 (Loan engine)  
- Phase 04 (Insights Engine v2)  
- Phase 08 (GRDCS + Cross-module consistency)  
- Phase 09 (Global Navigation + Health)  

### Powers:
- Phase 17 (Personal CFO Engine)  
- Phase 12 (Financial Health Engine)  
- Insights Engine v3 enhancements  

---

# 14.8 Acceptance Criteria  

### **Forecasting**
- 90-day forecast accuracy ≥ 85% (after learning)  
- Recurring detection integrated  
- Loan repayment schedules accounted for  
- Anomalies gracefully handled  

### **Optimisation**
- Identifies recurring waste  
- Detects subscription inflation  
- Suggests at least 5 actionable strategies  
- Can simulate 3+ what-if scenarios  

### **UI**
- Forecast renders < 100ms  
- Strategy panel fully interactive  
- Stress test UI works in real time  

### **System**
- No circular dependencies  
- All datasets available to Snapshot v3  
- All outputs available via API  

---

# 14.9 Deliverables
- Cashflow Forecasting Engine
- Cashflow Optimisation Engine
- Stress Testing Simulator
- Forecast Dashboard
- Strategy Panel
- API suite for cashflow datasets
- Integration into Insights Engine v3

---

# 14.10 Implementation Notes

> **Status: IMPLEMENTED** (November 2025)

## 14.10.1 Database Schema

**Location:** `prisma/schema.prisma`

### New Enums:
```typescript
enum CashflowInsightCategory {
  RECURRING, ANOMALY, INEFFICIENCY, LIQUIDITY_RISK, SUBSCRIPTION, SAVINGS_OPPORTUNITY
}

enum CashflowStrategyType {
  OPTIMISE, PREVENT_SHORTFALL, MAXIMISE_OFFSET, REDUCE_WASTE, REBALANCE,
  REPAYMENT_OPTIMISE, SCHEDULE_OPTIMISE
}

enum CashflowInsightSeverity {
  LOW, MEDIUM, HIGH, CRITICAL
}
```

### New Models:
| Model | Description |
|-------|-------------|
| `CashflowForecast` | Per-account/global daily balance predictions |
| `CashflowInsight` | Cashflow-specific insights (extends Insights Engine) |
| `CashflowStrategy` | Optimisation strategy recommendations |

---

## 14.10.2 Library Structure

**Location:** `lib/cashflow/`

| File | Description |
|------|-------------|
| `types.ts` | Complete TypeScript interfaces for CFE, COE, Stress Test |
| `forecasting.ts` | Cashflow Forecasting Engine (CFE) - predicts future balances |
| `optimisation.ts` | Cashflow Optimisation Engine (COE) - identifies savings |
| `stressTesting.ts` | Stress Test Model - what-if scenario simulator |
| `insightGenerator.ts` | Generates cashflow insights for Insights Engine v3 |
| `index.ts` | Barrel export for all modules |

---

## 14.10.3 Cashflow Forecasting Engine (CFE)

**File:** `lib/cashflow/forecasting.ts`

### Main Function:
```typescript
export async function generateForecast(input: CFEInput): Promise<CFEOutput>
```

### Process:
1. Calculate historical spending patterns from transactions
2. Generate recurring payment timeline from TIE data
3. Generate income timeline from income streams
4. Generate loan repayment timeline
5. Compute per-account forecasts with confidence bands
6. Aggregate into global forecast
7. Analyse shortfalls and calculate summary metrics

### Outputs:
- Daily balance predictions for 90 days
- Confidence scores with decay over time
- Upper/lower bounds for volatility
- Shortfall detection and dates
- Volatility index
- Withdrawable cash calculation

---

## 14.10.4 Cashflow Optimisation Engine (COE)

**File:** `lib/cashflow/optimisation.ts`

### Main Function:
```typescript
export async function generateOptimisations(input: COEInput): Promise<COEOutput>
```

### Features:
- **Inefficiency Detection**: Compares category spending to Australian benchmarks
- **Subscription Analysis**: Tracks subscriptions, detects price increases (>5%)
- **Fund Movement**: Recommends offset maximisation, shortfall prevention
- **Schedule Optimisation**: Aligns payments with income dates
- **Repayment Optimisation**: Suggests P&I conversion, extra repayments

### Category Benchmarks (Australian household averages):
```typescript
const CATEGORY_BENCHMARKS = {
  'Food & Dining': 800,
  'Groceries': 600,
  'Subscriptions': 100,
  'Utilities': 350,
  'Transport': 400,
  // ... etc
};
```

---

## 14.10.5 Stress Testing Model

**File:** `lib/cashflow/stressTesting.ts`

### Main Function:
```typescript
export async function runStressTests(input: CFEInput, scenarios?: StressScenario[]): Promise<StressTestOutput>
```

### Predefined Scenarios (9 total):
1. Income Drop 50% (3 months)
2. Complete Income Loss (6 months)
3. Unexpected $5,000 Expense
4. Major Expense $15,000
5. Interest Rate +1%
6. Interest Rate +2%
7. High Inflation (8%)
8. Mild Combined Stress
9. Severe Combined Stress

### Outputs:
- Survival time (months until shortfall)
- Balance impact vs baseline
- Resilience score (0-100)
- Mitigation strategies
- Required emergency fund recommendation

---

## 14.10.6 REST API Endpoints

**Location:** `app/api/cashflow/`

### Main Endpoint
```typescript
GET /api/cashflow
Query params:
  - type: 'forecast' | 'optimisation' | 'full' (default: 'full')
  - days: number (default: 90)

Response: {
  success: boolean,
  data: {
    forecast: { globalForecast, summary, shortfallAnalysis, volatilityIndex, recurringTimeline },
    optimisations: { inefficiencies, strategies, breakEvenDay, summary },
    insights: CashflowInsight[]
  }
}
```

### Stress Test Endpoint
```typescript
GET /api/cashflow/stress-test
Query params:
  - scenarios: comma-separated scenario IDs

POST /api/cashflow/stress-test
Body: { name?, description?, parameters: StressParameters }
```

### Insights Endpoint
```typescript
GET /api/cashflow/insights
Query params: severity?, category?, unread?, limit?

PATCH /api/cashflow/insights
Body: { insightId, action: 'read' | 'dismiss' | 'action' }
```

### Strategies Endpoint
```typescript
GET /api/cashflow/strategies
Query params: type?, status?, limit?

PATCH /api/cashflow/strategies
Body: { strategyId, action: 'accept' | 'dismiss', dismissReason? }
```

---

## 14.10.7 UI Components

### Cashflow Dashboard
**File:** `app/(dashboard)/cashflow/page.tsx`

Features:
- 90-day forecast chart (bar chart with shortfall highlighting)
- Key metrics: Net Cashflow, Burn Rate, Withdrawable Cash, Potential Savings
- Shortfall alert banner
- Upcoming payments list from recurring timeline
- Strategy cards with accept/dismiss actions
- Insight cards with severity badges
- Break-even day indicator
- Volatility index warning

---

## 14.10.8 Integration Points

### Consumes:
- **Phase 13 TIE**: UnifiedTransaction, RecurringPayment, SpendingProfile
- **Phase 03 Loan Engine**: Loan schedules, offset accounts
- **Phase 12 Health Engine**: Insight severity affects health score

### Powers:
- **Insights Engine v3**: Generates cashflow-specific insights
- **Phase 17 Personal CFO**: Future integration point

---

## 14.10.9 ML Configuration

Following Phase 11 pattern, ML models are stubbed for future implementation:
- Recurrence classifier (uses rule-based detection from Phase 13)
- Category-level spend predictor (uses historical averages)
- Cashflow volatility estimator (coefficient of variation)
- Shortfall predictor (linear projection with confidence decay)

**Future AI Integration**: Same OpenAI configuration pattern as Phase 13 for:
- Enhanced anomaly detection
- Predictive spend forecasting
- Personalised strategy recommendations

---

## 14.10.10 Confidence Calculation

```typescript
const CONFIDENCE_BASE = 0.95;
const CONFIDENCE_DECAY_RATE = 0.002; // per day
const VOLATILITY_WEIGHT = 0.3;

confidence = CONFIDENCE_BASE * exp(-DECAY_RATE * days) * (1 - volatility * WEIGHT)
```

Confidence bands (upper/lower bounds):
```typescript
volatilityAdjustment = dailyAverage * volatility * sqrt(day + 1)
upperBound = predictedBalance + volatilityAdjustment
lowerBound = predictedBalance - volatilityAdjustment
```

---

## 14.10.11 Authentication

All endpoints use `Authorization: Bearer ${token}` header pattern.
Implemented via `withAuth()` middleware from `lib/middleware`.  

