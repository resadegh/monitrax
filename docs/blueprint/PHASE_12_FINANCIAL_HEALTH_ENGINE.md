# PHASE 12 — FINANCIAL HEALTH ENGINE  
### Holistic Financial Assessment • Behavioural Signals • Risk Modelling • Health Score Framework  
Version: 1.0

---

# 1. PURPOSE

Phase 12 introduces the **Financial Health Engine**, a comprehensive scoring + analysis system that evaluates a user’s overall financial wellbeing across multiple dimensions:

- Liquidity  
- Debt stability  
- Investment strength  
- Cashflow resilience  
- Risk exposure  
- Long-term sustainability  
- Behavioural and spending patterns  
- Portfolio consistency  

The goal:  
Provide a unified **Financial Health Score** (0–100) with detailed breakdowns, risk alerts, and actionable improvements.

This engine consumes all prior system layers:
- Snapshot Engine  
- Insights Engine v2  
- AI Strategy Engine  
- Cross-Module Data Health (GRDCS & Linkage Health)  
- Cashflow & Forecasting Models  

---

# 2. DESIGN PRINCIPLES

### 2.1 Holistic Assessment  
The engine evaluates financial wellbeing across *seven interdependent dimensions*.

### 2.2 Explainable & Transparent  
Each health score must include:
- contributing metrics  
- evidence  
- risk factors  
- recommendations  

### 2.3 Dynamic & Real-Time  
Health recalculates whenever:
- cashflow changes  
- spending changes  
- debt changes  
- valuations update  
- insights regenerate  
- strategy engine produces new advice  

### 2.4 Behaviour-Driven  
Evaluates both **current financial state** and **behavioural patterns**.

### 2.5 Scenario Compatible  
Health score must be forecastable across multiple future projections:
- default  
- conservative  
- aggressive  
- strategic path  

---

# 3. INPUT SOURCES

The Financial Health Engine consumes:

## 3.1 Portfolio Snapshot 2.0  
All entity-level data:
- income  
- expenses  
- loans  
- properties  
- accounts  
- investments  
- offsets  
- transactions  

## 3.2 Insights Engine v2  
- critical insights  
- risk insights  
- relational issues  
- recommended fixes  
- module-level flags  

## 3.3 AI Strategy Engine (Phase 11)  
- strategy packets  
- SBS scores  
- risk-based actions  
- long-term projections  

## 3.4 GRDCS & Linkage Health  
- missing relations  
- data completeness  
- entity consistency  
- module health  

## 3.5 User Goals  
- retirement target  
- savings goal  
- risk tolerance  
- investment style  

---

# 4. OUTPUTS

The engine produces:

### 4.1 Financial Health Score (0–100)  
Aggregate score representing:
- current stability  
- future sustainability  
- risk exposure  
- resilience  

### 4.2 Category Scores  
Each category scored individually (0–100):

1. Liquidity  
2. Cashflow Resilience  
3. Debt Stability  
4. Investment Strength  
5. Property Position  
6. Risk Exposure  
7. Long-Term Outlook  

### 4.3 Risk Signals  
System-level warnings:
- spending risk  
- borrowing risk  
- concentration risk  
- liquidity shock risk  
- retirement runway risk  

### 4.4 Actionable Improvement Path  
Top ways to improve the score:
- reduce debt  
- improve buffer  
- restructure investments  
- rebalance portfolios  
- adjust spending  
- change financial strategy  

### 4.5 Evidence Pack  
Every score includes:
- inputs used  
- confidence level  
- insights linked  
- historical trend  
- risk map  

---

# 5. ENGINE ARCHITECTURE

The Financial Health Engine is structured in three layers:

---

# 5.1 LAYER 1 — METRIC AGGREGATION LAYER

Collects all metrics system-wide.

### 5.1.1 Liquidity Metrics  
- emergency buffer  
- savings rate  
- liquid net worth percentage  
- short-term debt ratio  

### 5.1.2 Cashflow Metrics  
- surplus/deficit  
- volatility  
- fixed cost ratio  
- discretionary sensitivity  

### 5.1.3 Debt Metrics  
- LVR  
- DTI  
- repayment load  
- interest risk exposure  
- interest-only risk  

### 5.1.4 Investment Metrics  
- diversification index  
- asset-class concentration  
- performance vs benchmark  
- cost-efficiency  
- risk-adjusted return  

### 5.1.5 Property Metrics  
- valuation health  
- LVR stability  
- rental yield performance  
- vacancy risk analysis  

### 5.1.6 Risk Metrics  
- insurance gaps  
- buffering  
- emergency runway  
- volatility exposure  

### 5.1.7 Forecast Metrics  
- 5/10/20-year net worth  
- retirement runway  
- sustainable withdrawal rate  

Each metric gets:
- value  
- benchmark  
- risk band  
- confidence  

---

# 5.2 LAYER 2 — CATEGORY SCORING LAYER

Each dimension converts metrics → category score.

Category scores use weighted models:

## Liquidity (20%)
| Metric | Weight |
|--------|--------|
| Emergency buffer | 40% |
| Liquid net worth ratio | 40% |
| Savings rate | 20% |

## Cashflow (20%)
| Metric | Weight |
|--------|--------|
| Cashflow surplus | 35% |
| Cashflow volatility | 35% |
| Fixed cost load | 30% |

## Debt (15%)
| Metric | Weight |
|--------|--------|
| DTI | 40% |
| LVR | 40% |
| Repayment load | 20% |

## Investments (15%)
| Metric | Weight |
|--------|--------|
| Diversification | 30% |
| Return consistency | 40% |
| Cost efficiency | 30% |

## Property (10%)
| Metric | Weight |
|--------|--------|
| Equity strength | 40% |
| Yield | 30% |
| Market risk | 30% |

## Risk Exposure (10%)
| Metric | Weight |
|--------|--------|
| Buffering | 40% |
| Policy coverage gaps | 30% |
| Spending sensitivity | 30% |

## Long-Term Outlook (10%)
| Metric | Weight |
|--------|--------|
| Forecast runway | 50% |
| Retirement gap | 50% |

---

# 5.3 LAYER 3 — AGGREGATE HEALTH ENGINE

Aggregates category scores → final score:
```
HealthScore = Σ(categoryScore * categoryWeight)
```

Additional modifiers:
- data confidence  
- insight severity  
- long-term projection risk  
- linkage issues penalty  
- strategy conflicts penalty  

Outputs:
- score  
- breakdown  
- confidence  
- trend  
- next steps  

---

# 6. RISK MODELLING SYSTEM

The engine classifies user risk across:

### 6.1 Spending Risk  
- overspending  
- rising discretionary ratio  

### 6.2 Borrowing Risk  
- high LVR  
- high DTI  
- rising repayments  

### 6.3 Liquidity Risk  
- insufficient buffer  
- negative cashflow  

### 6.4 Concentration Risk  
- overweight asset classes  
- property concentration  

### 6.5 Market Risk  
- exposure to volatile assets  

### 6.6 Longevity Risk  
- retirement shortfall  

Each receives:
- risk tier  
- explanation  
- evidence  
- severity  

---

# 7. FORECAST-INTEGRATED HEALTH

Health can be evaluated across future time periods:

- Present  
- 1-year  
- 5-year  
- 10-year  
- 20-year  

Uses the forecasting engine from Phase 11.

### Outputs:
- “Future Health Trajectory” graph  
- Retirement runway  
- Probability of achieving goals  
- Worst-case vs best-case  

---

# 8. PRESENTATION LAYER (UI REQUIREMENTS)

### 8.1 Financial Health Dashboard  
Shows:
- overall score  
- category bars  
- major risks  
- trend line  
- improvement actions  

### 8.2 Entity-Level Health  
Properties, loans, accounts, investments each show:
- module health  
- risk flags  
- contribution to system health  

### 8.3 Improvement Plan  
Ordered list of recommended improvements:
- quick wins  
- high impact items  
- strategic improvements  

### 8.4 Explainability Panel  
Users can expand to see:
- metrics contributing  
- weighting  
- reasoning trace  
- linked insights  
- evidence  

---

# 9. DATA CONTRACTS

### 9.1 FinancialHealthScore
- score  
- confidence  
- breakdown  
- trend  
- timestamp  

### 9.2 HealthCategory
- name  
- score  
- contributing metrics  
- risk band  

### 9.3 RiskSignal
- id  
- category  
- severity  
- description  
- evidence  

### 9.4 ImprovementAction
- title  
- impact  
- category  
- difficulty  
- SBS link  
- alternative options  

---

# 10. ACCEPTANCE CRITERIA

Phase 12 completes when:

- Full Financial Health Engine implemented
- Category scoring implemented
- Aggregate score stable
- Risk system operational
- Forecast-integrated scoring functional
- UI shows health score + categories
- Explainability available for each category
- Improvement plan generated
- Links to insights + strategy validated
- Trends displayed across history

---

# 11. IMPLEMENTATION NOTES

> **Status: IMPLEMENTED** (November 2025)

## 11.1 Library Structure

**Location:** `lib/health/`

| File | Description |
|------|-------------|
| `types.ts` | Complete TypeScript interfaces for all health engine types |
| `metricAggregation.ts` | Layer 1 - Collects metrics from all sources |
| `categoryScoring.ts` | Layer 2 - Calculates category scores with weighted formulas |
| `aggregateEngine.ts` | Layer 3 - Computes final health score with modifiers |
| `riskModelling.ts` | Risk signal detection and classification |
| `index.ts` | Barrel export for all modules |

---

## 11.2 Type Definitions

**File:** `lib/health/types.ts` (~500 lines)

### Enums:
```typescript
type RiskBand = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';
type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type HealthCategoryName = 'LIQUIDITY' | 'CASHFLOW' | 'DEBT' | 'INVESTMENTS' | 'PROPERTY' | 'RISK_EXPOSURE' | 'LONG_TERM_OUTLOOK';
type RiskSignalCategory = 'SPENDING' | 'BORROWING' | 'LIQUIDITY' | 'CONCENTRATION' | 'MARKET' | 'LONGEVITY';
```

### Core Interfaces:
- `BaseMetric` - Standard metric structure (value, benchmark, riskBand, confidence)
- `LiquidityMetrics`, `CashflowMetrics`, `DebtMetrics`, `InvestmentMetrics`, `PropertyMetrics`, `RiskMetrics`, `ForecastMetrics`
- `AggregatedMetrics` - All metrics combined (Layer 1 output)
- `HealthCategory` - Category score with contributing metrics
- `RiskSignal` - Risk detection with evidence
- `ImprovementAction` - Actionable improvement with impact estimate
- `FinancialHealthScore` - Main output (score, confidence, breakdown, trend)
- `FinancialHealthReport` - Complete report with all data
- `ScoreModifiers` - Penalty calculations

### Utility Functions:
- `scoreToRiskBand(score)` - Converts 0-100 score to risk band
- `riskBandToSeverity(band)` - Maps risk band to severity level

---

## 11.3 Category Weights

As defined in blueprint Section 5.2:

```typescript
const CATEGORY_WEIGHTS = {
  LIQUIDITY: 0.20,        // 20%
  CASHFLOW: 0.20,         // 20%
  DEBT: 0.15,             // 15%
  INVESTMENTS: 0.15,      // 15%
  PROPERTY: 0.10,         // 10%
  RISK_EXPOSURE: 0.10,    // 10%
  LONG_TERM_OUTLOOK: 0.10 // 10%
};
```

---

## 11.4 Layer 1 - Metric Aggregation

**File:** `lib/health/metricAggregation.ts`

Collects metrics from portfolio snapshot:
- Emergency buffer calculation (months of expenses in liquid assets)
- Savings rate (income - expenses / income)
- Debt-to-income ratio
- Loan-to-value ratio
- Investment diversification index
- Property valuation health
- Forecast metrics from strategy engine

---

## 11.5 Layer 2 - Category Scoring

**File:** `lib/health/categoryScoring.ts`

Each category uses weighted sub-metrics:

**Liquidity (20%):**
- Emergency Buffer: 40%
- Liquid Net Worth Ratio: 40%
- Savings Rate: 20%

**Cashflow (20%):**
- Cashflow Surplus: 35%
- Cashflow Volatility: 35%
- Fixed Cost Load: 30%

**Debt (15%):**
- DTI: 40%
- LVR: 40%
- Repayment Load: 20%

**Investments (15%):**
- Diversification: 30%
- Return Consistency: 40%
- Cost Efficiency: 30%

**Property (10%):**
- Equity Strength: 40%
- Yield: 30%
- Market Risk: 30%

**Risk Exposure (10%):**
- Buffering: 40%
- Policy Coverage Gaps: 30%
- Spending Sensitivity: 30%

**Long-Term Outlook (10%):**
- Forecast Runway: 50%
- Retirement Gap: 50%

---

## 11.6 Layer 3 - Aggregate Engine

**File:** `lib/health/aggregateEngine.ts`

**Main Function:**
```typescript
export async function generateHealthReport(userId: string): Promise<FinancialHealthReport>
```

**Process:**
1. Fetch portfolio snapshot
2. Aggregate all metrics (Layer 1)
3. Calculate category scores (Layer 2)
4. Apply modifiers (data confidence, insight severity, linkage issues)
5. Generate risk signals
6. Create improvement actions
7. Build evidence pack
8. Return complete report

**Score Modifiers:**
- Data confidence penalty (if < 80%)
- Insight severity penalty (critical insights reduce score)
- Linkage issues penalty (orphans, missing links)
- Strategy conflicts penalty (unresolved recommendations)

---

## 11.7 Risk Modelling

**File:** `lib/health/riskModelling.ts`

Detects and classifies risks across 6 categories:

| Risk Category | Detection Logic |
|---------------|-----------------|
| SPENDING | Expenses > 80% of income |
| BORROWING | DTI > 43% or LVR > 80% |
| LIQUIDITY | Emergency buffer < 3 months |
| CONCENTRATION | Single investment > 20% of portfolio |
| MARKET | High volatility exposure |
| LONGEVITY | Retirement shortfall detected |

Each risk includes:
- Severity tier (1-5)
- Evidence (current value vs threshold)
- Trend direction (IMPROVING, STABLE, WORSENING)

---

## 11.8 REST API Endpoint

**File:** `app/api/financial-health/route.ts`

```typescript
GET /api/financial-health

Response: {
  success: boolean,
  data: {
    healthScore: {
      score: number,           // 0-100
      riskBand: string,        // EXCELLENT, GOOD, etc.
      confidence: number,
      trend: {
        direction: string,     // IMPROVING, STABLE, DECLINING
        changePercent: number
      },
      breakdown: HealthCategory[]
    },
    riskSignals: RiskSignal[],
    improvementActions: ImprovementAction[],
    generatedAt: string
  }
}
```

**Authentication:** Uses `Authorization: Bearer ${token}` header.

---

## 11.9 UI Components

### Financial Health Dashboard
**File:** `app/(dashboard)/health/page.tsx`

Features:
- Large score display with risk band color
- Trend indicator (improving/stable/declining)
- Category breakdown bars (7 categories)
- Risk signals section
- Improvement actions list
- Evidence/explainability panel

### Financial Health Mini Widget
**File:** `components/health/FinancialHealthMiniWidget.tsx`

Compact sidebar widget showing:
- Health score (0-100)
- Risk band with color coding
- Progress bar
- Trend indicator
- Click to navigate to full dashboard
- Auto-refresh every 60 seconds

---

## 11.10 Risk Band Thresholds

```typescript
EXCELLENT: score >= 80
GOOD:      score >= 60 && score < 80
MODERATE:  score >= 40 && score < 60
CONCERNING: score >= 20 && score < 40
CRITICAL:  score < 20
```

---

## 11.11 Integration Points

- **Portfolio Snapshot Engine**: Primary data source
- **Insights Engine v2**: Insight severity affects score
- **AI Strategy Engine (Phase 11)**: Strategy conflicts penalty
- **GRDCS/Linkage Health**: Data quality affects confidence
- **Phase 13 TIE**: Spending patterns feed into cashflow metrics

---

# END OF PHASE 12 — FINANCIAL HEALTH ENGINE
