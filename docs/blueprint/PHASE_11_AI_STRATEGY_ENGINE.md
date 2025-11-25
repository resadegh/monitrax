# PHASE 11 — AI STRATEGY ENGINE  
### Advisor-Level Intelligence • Financial Recommendations • Multi-Year Forecasts • Cohesive Strategy Layer  
Version: 1.0

---

# 1. PURPOSE

Phase 11 introduces the **AI Strategy Engine**, transforming Monitrax from a financial data system into a proactive financial advisor.

The engine uses:
- Portfolio snapshot (Phase 5)
- Insights Engine v2 (Phase 4)
- GRDCS (Phase 8)
- Health, linkage, and consistency signals (Phase 9)

And produces:
- Buy/Hold/Sell recommendations  
- Cashflow strategy  
- Loan optimisation  
- Property/investment strategy  
- Portfolio restructuring advice  
- Multi-year forecasts  
- Wealth-building roadmaps  

This is the intelligence layer of Monitrax.

---

# 2. DESIGN PRINCIPLES

1. **100% deterministic + explainable**  
   AI suggestions must always show:  
   - input → reasoning → output

2. **Never modify user data**  
   Strategy engine only produces *recommendations*, never executes actions.

3. **Insights-driven intelligence**  
   The engine consumes insights, cross-module health, and snapshot data.

4. **Full traceability**  
   All recommendations come with metadata, scoring, conflicts, and evidence.

5. **Unified scoring system**  
   Every suggestion is ranked via the “Strategic Benefit Score” (0–100).

6. **Human-first design**  
   The user always sees:
   - alternatives  
   - impact analysis  
   - risks  
   - confidence levels  

---

# 3. INPUT SOURCES

The Strategy Engine consumes the following system-wide sources:

## 3.1 Portfolio Snapshot 2.0 (Phase 5)
- Cashflows  
- Property valuations  
- Loan amortisation schedules  
- Investment performance  
- Tax projections  
- Net worth history  
- Risk signals  

## 3.2 Insights Engine v2 (Phase 4)
- Critical issues  
- High/medium/low insights  
- Recommended fixes  
- relational issues  
- cashflow bottlenecks  

## 3.3 GRDCS (Phase 8)
- Canonical entity relationships  
- Cross-module linkages  
- Upstream/downstream dependencies  

## 3.4 Global Health (Phase 9)
- Orphans  
- Missing links  
- Data consistency score  
- Module health metrics  

## 3.5 User Preferences (Phase 10)
- Risk appetite  
- Goals  
- Time horizon  
- Debt comfort level  
- Investment style  
- Retirement targets  

---

# 4. OUTPUT TYPES

The engine outputs structured strategy recommendations across categories:

### 4.1 Portfolio-Level Strategy  
- Net worth optimisation  
- Risk balancing  
- Cashflow stabilisation  
- Tax-efficient structuring  
- Saving/investing ratio guidance  

### 4.2 Property Strategy  
- Hold vs Sell recommendation  
- Rent vs own analysis  
- Leverage optimisation  
- Refinance or fix/variable selection  

### 4.3 Loan Strategy  
- Refinance opportunities  
- Optimal repayment frequency  
- Offset optimisation  
- Early repayment modelling  

### 4.4 Investment Strategy  
- Asset allocation drift  
- Buy/Hold/Sell signals  
- Portfolio balancing  
- Cost-averaging opportunities  

### 4.5 Cashflow Strategy  
- Surplus allocation  
- Spending risk  
- Emergency buffer modelling  

### 4.6 Multi-Year Forecast Strategy  
- Year-by-year projections (5–30 years)  
- Retirement runway  
- Future net-worth scenarios  
- Downside & upside cases  

---

# 5. ENGINE ARCHITECTURE

The AI Strategy Engine is organised into four layers.

---

## 5.1 LAYER 1 — DATA COLLECTION LAYER
### Pulls + validates data from:

- Snapshot Engine  
- Insights Engine  
- Global Health Service  
- Relational Graph  
- User preferences  

### Data requirements
- Fully normalised schema  
- No missing entities  
- GRDCS integrity  
- Timestamps for forecasting  
- Per-module health signals  

If data is incomplete → engine falls back to **limited mode**.

---

## 5.2 LAYER 2 — ANALYSIS & SCORING LAYER

This layer performs the real analysis.

### 5.2.1 Core analyzers
- Cashflow Analyzer  
- Debt Optimisation Analyzer  
- Investment Performance Analyzer  
- Valuation Analyzer  
- Risk Analyzer  
- Liquidity Analyzer  
- Tax Exposure Analyzer  
- Time-Horizon Analyzer  

### 5.2.2 Strategic Benefit Score (SBS)
Each potential action is scored:

| Category | Weight |
|---------|--------|
| Financial Benefit | 40% |
| Risk Reduction | 25% |
| Cost Avoidance | 15% |
| Liquidity Impact | 10% |
| Tax Impact | 5% |
| Data Confidence | 5% |

Score output = 0–100.

---

## 5.3 LAYER 3 — STRATEGY SYNTHESIS LAYER

This generates the actual strategy recommendations.

### 5.3.1 Strategy Types
- Tactical (immediate)
- Operational (3–12 months)
- Strategic (1–5 years)
- Long-term (5–30 years)

### 5.3.2 Strategy Packet Format
Each recommendation includes:

- id  
- title  
- category  
- description  
- financial impact  
- risks  
- SBS score  
- confidence level  
- required data  
- impacted entities  
- alternative scenario  

### 5.3.3 Conflict Resolution  
Recommendations that conflict are automatically grouped:

Example:
- “Pay down loan early”
- “Increase investment contributions”

Engine presents both → user selects direction.

---

## 5.4 LAYER 4 — PRESENTATION LAYER

All strategy results must be compatible with UI-driven presentation:

### 5.4.1 Strategy Dashboard Widgets
- Top 5 recommended actions  
- Highest SBS score  
- Long-term forecast graph  
- Cashflow runway  
- Risk meter  

### 5.4.2 Entity-Level Strategy Tabs
Each property, loan, and investment shows a “Strategy” tab.

### 5.4.3 Scenario Simulation
User can compare:

- Default case  
- Conservative case  
- Aggressive case  
- Custom parameters  

---

# 6. STRATEGY CATEGORIES

The engine supports six strategic categories:

1. **Growth Strategy**  
2. **Debt Strategy**  
3. **Cashflow Strategy**  
4. **Investment Strategy**  
5. **Property Strategy**  
6. **Risk & Resilience Strategy**

Each must output structured recommendations and alternatives.

---

# 7. MULTI-YEAR FORECASTING ENGINE

Forecasts for 5, 10, 20, 30 years.

### 7.1 Required Forecast Inputs
- Income growth rate  
- Expense inflation  
- Loan interest rates  
- Investment returns  
- Rental yields  
- Tax rates  
- CPI projections  

### 7.2 Output
- Yearly net worth projection  
- Debt trajectory  
- Cashflow surplus/deficit  
- Target achievement probability  
- Risk bands  
- Worst-case & best-case  

---

# 8. EXPLAINABILITY (MANDATORY)

Every recommendation must expose:

### 8.1 Evidence Graph
- Data points  
- Historical trend  
- Snapshot values  
- Insight flags  
- Health issues  

### 8.2 Reasoning Trace
- Step-by-step explanation  
- Why this strategy was chosen  
- Alternative rejected strategies  

### 8.3 Confidence
- High / Medium / Low  
- Data completeness impact  

---

# 9. STRATEGY DATA CONTRACTS (STRUCTURAL)

### 9.1 StrategyPacket
- id  
- category  
- summary  
- detail  
- SBS score  
- confidence  
- financial impact  
- risk impact  
- affected entities  
- why  
- alternatives[]  
- forecastProjection  

### 9.2 StrategySession
Used in Phase 12 (Financial Health Engine):
- strategy version  
- timestamp  
- user input parameters  
- scenario selection  
- overrides  
- accepted vs dismissed recommendations  

---

# 10. USER EXPERIENCE REQUIREMENTS

### 10.1 Strategy Dashboard
Must include:
- Current strategy state  
- Top opportunities  
- Long-term forecast  
- Risk overview  
- Cashflow projections  

### 10.2 Strategy Sidebar
On every entity:
- Entity-level recommendations  
- Action buttons  
- Predictive graphs  

### 10.3 Strategy Detail View
Dedicated view with:
- Evidence  
- Reasoning  
- Forecast  
- Scoring  
- Alternatives  

---

# 11. SYSTEM REQUIREMENTS

### 11.1 Performance
- Must compute fully in < 2 seconds  
- Incremental recomputation on data changes  
- Heavy forecasting cached  

### 11.2 Reliability
- Strategy generation never blocks UI  
- Graceful fallback when data incomplete  

### 11.3 Logging
- Strategy sessions logged  
- Rejections logged  
- Overrides logged  

---

# 12. ACCEPTANCE CRITERIA

Phase 11 completes when:

- Strategy Engine produces a **full portfolio strategy**
- Entity strategy tabs are enabled
- Multi-year forecasting operational
- SBS scoring implemented
- Explainability available for every recommendation
- Strategy UI integrated into dashboard
- Conflict detection functional
- User preferences correctly influence strategy
- All strategy packets validated and stable

---

---

# 13. IMPLEMENTATION PLAN

**Status:** NOT STARTED
**Approach:** Rule-based algorithmic financial analysis (100% deterministic TypeScript)
**NOT using:** LLM APIs, ChatGPT, Claude, or any generative AI models
**Architecture:** Pure TypeScript business logic with financial calculation algorithms

---

## 13.1 IMPLEMENTATION PHILOSOPHY

The "AI" in "AI Strategy Engine" refers to **intelligent automation** through financial algorithms, similar to:
- Betterment's portfolio advice engine
- Wealthfront's financial planning
- Quicken Advisor's recommendations
- Mint.com's insights system

**Core Principle:** Every recommendation is generated by deterministic business rules that can be explained step-by-step.

### Example Logic Flow:
```
Input: User has loan at 5.5%, market rate is 4.0%
Business Rule: If (currentRate - marketRate) > 0.5% AND breakEven < 24 months
Output: "Refinance recommended - save $X/month"
Explainability: Full calculation trace with all intermediate values
```

---

## 13.2 SAFEGUARDS & VALIDATION

### Financial Safety Limits
```typescript
const SAFEGUARDS = {
  maxDebtToIncome: 0.43,        // Never recommend if DTI > 43%
  minEmergencyFund: 3,          // Require 3 months expenses minimum
  maxSingleInvestment: 0.20,    // No investment > 20% of portfolio
  minLiquidityRatio: 0.10,      // Keep 10% in liquid assets
  minRefinanceGap: 0.005,       // 0.5% minimum rate difference
  maxRefinanceBreakeven: 24     // 24 months maximum break-even
};
```

### Confidence Scoring
```typescript
HIGH confidence:    Data completeness > 80%, recent data < 30 days
MEDIUM confidence:  Data completeness 60-80%, data < 90 days
LOW confidence:     Data completeness < 60%, data > 90 days

Only show HIGH confidence recommendations by default.
```

---

## 13.3 IMPLEMENTATION STAGES

### Stage Delivery Process
1. Complete stage implementation
2. Run tests and validation
3. Commit and push to branch
4. Provide PR URL for review
5. Wait for approval before next stage

**UI Stages:** Stages 7 will be flagged for visual inspection in deployed preview.

---

## STAGE 1: DATABASE SCHEMA & FOUNDATION
**Effort:** 6-8 hours
**Type:** Backend - Database
**Status:** ✅ COMPLETE

### Deliverables

#### 1.1 Prisma Models
**File:** `prisma/schema.prisma`

Add three new models:

**StrategyRecommendation Model:**
- Complete recommendation structure
- SBS scoring fields
- Evidence graph (JSON)
- Financial/risk impact analysis
- GRDCS entity references
- User interaction tracking (accept/dismiss)
- Status lifecycle management

**StrategySession Model:**
- User preference storage
- Risk appetite, time horizon, debt comfort
- Investment style, retirement goals
- Scenario selection (DEFAULT, CONSERVATIVE, AGGRESSIVE, CUSTOM)
- Tracking accepted/dismissed recommendations

**StrategyForecast Model:**
- Multi-year projection storage (5-30 years)
- Input assumptions (growth rates, inflation, etc.)
- Yearly projections array (JSON)
- Best/worst case scenarios
- Target achievement probability

#### 1.2 Enums
- `StrategyCategory`: GROWTH, DEBT, CASHFLOW, INVESTMENT, PROPERTY, RISK_RESILIENCE
- `StrategyType`: TACTICAL, OPERATIONAL, STRATEGIC, LONG_TERM
- `RecommendationStatus`: PENDING, ACCEPTED, DISMISSED, EXPIRED
- `ConfidenceLevel`: HIGH, MEDIUM, LOW
- `RiskAppetite`: CONSERVATIVE, MODERATE, AGGRESSIVE
- `DebtComfort`: DEBT_AVERSE, MODERATE, LEVERAGE_COMFORTABLE
- `InvestmentStyle`: PASSIVE, BALANCED, ACTIVE
- `ScenarioType`: DEFAULT, CONSERVATIVE, AGGRESSIVE, CUSTOM

#### 1.3 Library Structure
```
lib/strategy/
  ├── core/
  │   ├── dataCollector.ts       # Layer 1: Data collection
  │   ├── scoringEngine.ts       # SBS calculation engine
  │   ├── types.ts               # TypeScript interfaces
  │   └── safeguards.ts          # Financial safety rules
  ├── analyzers/
  │   ├── cashflowAnalyzer.ts    # Emergency fund, surplus analysis
  │   ├── debtAnalyzer.ts        # Refinance, consolidation logic
  │   ├── investmentAnalyzer.ts  # Rebalancing, allocation
  │   ├── propertyAnalyzer.ts    # Hold/sell, refinance
  │   ├── riskAnalyzer.ts        # Risk concentration
  │   ├── liquidityAnalyzer.ts   # Cash reserves
  │   ├── taxAnalyzer.ts         # Tax optimization
  │   └── timeHorizonAnalyzer.ts # Retirement runway
  ├── synthesizers/
  │   ├── strategySynthesizer.ts # Layer 3: Generate recommendations
  │   ├── conflictResolver.ts    # Detect conflicts
  │   └── alternativeGenerator.ts # Create alternatives
  ├── forecasting/
  │   ├── forecastEngine.ts      # Multi-year projections
  │   ├── scenarioBuilder.ts     # Build scenarios
  │   └── projectionCalculator.ts # Financial calculations
  └── index.ts
```

### Validation Criteria
- ✅ All Prisma models compile without errors
- ✅ Database migration runs successfully
- ✅ All enums defined with correct values
- ✅ Directory structure created
- ✅ TypeScript paths configured

---

## STAGE 2: LAYER 1 - DATA COLLECTION
**Effort:** 8-10 hours
**Type:** Backend - Data Layer
**Status:** ✅ COMPLETE

### Deliverables

#### 2.1 Data Collector Service
**File:** `lib/strategy/core/dataCollector.ts`

**Functions:**
```typescript
// Main collection function
export async function collectStrategyData(userId: string): Promise<StrategyDataPacket>

// Data quality assessment
export async function validateDataCompleteness(data: StrategyDataPacket): DataQualityReport

// Limited mode detection
export function isLimitedMode(quality: DataQualityReport): boolean

// Individual source fetchers
async function fetchSnapshotData(userId: string): Promise<SnapshotData>
async function fetchInsights(userId: string): Promise<Insight[]>
async function fetchGlobalHealth(userId: string): Promise<HealthMetrics>
async function fetchGRDCSData(userId: string): Promise<RelationalGraph>
async function fetchUserPreferences(userId: string): Promise<StrategySession | null>
```

**Data Sources:**
1. **Portfolio Snapshot** (from `lib/intelligence/portfolioEngine.ts`)
   - Net worth
   - Properties, loans, investments
   - Cashflow summary
   - Historical trends

2. **Insights Engine** (from `lib/intelligence/insightsEngine.ts`)
   - Critical/high/medium/low insights
   - Relational issues
   - Completeness gaps

3. **Global Health** (Phase 9)
   - Orphan entities
   - Missing links
   - Data consistency scores

4. **GRDCS** (from `lib/grdcs.ts`)
   - Entity relationships
   - Cross-module linkages

5. **User Preferences** (StrategySession model)
   - Risk appetite
   - Time horizon
   - Debt comfort

**Data Quality Metrics:**
```typescript
interface DataQualityReport {
  overallScore: number;           // 0-100
  completeness: {
    snapshot: number;              // 0-100
    insights: number;
    health: number;
    relationships: number;
    preferences: number;
  };
  dataAge: {
    oldestTransaction: Date | null;
    lastSync: Date | null;
  };
  missingCritical: string[];       // Critical missing data
  recommendations: string[];        // What to improve
}
```

**Limited Mode Behavior:**
- If overall score < 60%: LIMITED MODE
- Show warning to user
- Only generate high-confidence recommendations
- Suggest what data to add

#### 2.2 Type Definitions
**File:** `lib/strategy/core/types.ts`

Define all interfaces:
- `StrategyDataPacket`
- `DataQualityReport`
- `AnalysisResult`
- `Finding`
- `ImpactScore`
- `EvidenceGraph`
- `ReasoningTrace`

### Validation Criteria
- ✅ Data collector fetches from all 5 sources
- ✅ Data quality scoring works correctly
- ✅ Limited mode detection functional
- ✅ Handles missing data gracefully
- ✅ All TypeScript types defined

---

## STAGE 3: LAYER 2 - ANALYSIS ENGINES
**Effort:** 20-25 hours
**Type:** Backend - Business Logic
**Status:** ✅ COMPLETE

### Phase 3A: Core Analyzers (Week 1)

#### 3A.1 Debt Analyzer
**File:** `lib/strategy/analyzers/debtAnalyzer.ts`

**Business Rules:**
```typescript
Refinance Recommendation:
  IF currentRate - marketRate > 0.5%
  AND breakEvenMonths < 24
  AND totalSavings > refinanceCosts * 2
  THEN recommend refinance

Debt Consolidation:
  IF multipleHighInterestLoans
  AND consolidatedRate < averageCurrentRate - 0.3%
  THEN recommend consolidation

Early Repayment Analysis:
  Compare: paying extra on loan vs investing surplus
  IF loanRate > expectedInvestmentReturn + 2%
  THEN recommend early repayment
```

**Calculations:**
- Monthly payment: `P * [r(1+r)^n] / [(1+r)^n - 1]`
- Break-even point: `refinanceCosts / monthlySavings`
- Total interest saved over loan term
- Debt-to-income ratio

**Output:**
- Refinance opportunities with savings projections
- Optimal repayment frequency
- Offset account optimization
- Early repayment scenarios

#### 3A.2 Cashflow Analyzer
**File:** `lib/strategy/analyzers/cashflowAnalyzer.ts`

**Business Rules:**
```typescript
Emergency Fund:
  Recommended: 3-6 months of expenses
  IF currentBuffer < 3 months
  THEN criticality = HIGH

Spending Risk:
  IF expenses > 80% of income for 3+ months
  THEN flag spending risk

Surplus Allocation:
  IF monthly surplus > 0
  THEN analyze optimal allocation:
    - Emergency fund first
    - High-interest debt second
    - Investments third
```

**Calculations:**
- Average monthly expenses (last 6 months)
- Income stability (variance analysis)
- Surplus trend
- Buffer runway in months

**Output:**
- Emergency fund adequacy assessment
- Spending risk detection
- Surplus allocation recommendations
- Cashflow stability score

### Phase 3B: Additional Analyzers (Week 2)

#### 3B.1 Investment Analyzer
**File:** `lib/strategy/analyzers/investmentAnalyzer.ts`

**Business Rules:**
```typescript
Portfolio Rebalancing:
  IF abs(currentAllocation - targetAllocation) > 5%
  THEN recommend rebalancing

Asset Allocation Drift:
  Track deviation from target allocation
  IF drift > 10% for any asset class
  THEN criticality = HIGH

Diversification:
  IF singleInvestment > 20% of total portfolio
  THEN flag concentration risk
```

**Calculations:**
- Current vs target allocation
- Portfolio volatility
- Sharpe ratio (if benchmark available)
- Rebalancing costs vs benefits

#### 3B.2 Property Analyzer
**File:** `lib/strategy/analyzers/propertyAnalyzer.ts`

**Business Rules:**
```typescript
Hold vs Sell:
  Calculate: rental yield, capital growth, holding costs
  IF yield < 3% AND growth < inflation
  THEN consider sell recommendation

Refinance Analysis:
  Same logic as debt analyzer
  Account for: property value changes, equity position

Fix vs Variable:
  IF user risk appetite = CONSERVATIVE
  THEN prefer fixed rate
```

#### 3B.3 Risk Analyzer
**File:** `lib/strategy/analyzers/riskAnalyzer.ts`

Analyzes portfolio risk concentration and diversification.

#### 3B.4 Liquidity Analyzer
**File:** `lib/strategy/analyzers/liquidityAnalyzer.ts`

Assesses cash reserves and liquidity ratios.

#### 3B.5 Tax Analyzer
**File:** `lib/strategy/analyzers/taxAnalyzer.ts`

Tax exposure and optimization opportunities.

#### 3B.6 Time Horizon Analyzer
**File:** `lib/strategy/analyzers/timeHorizonAnalyzer.ts`

Retirement runway and goal achievement probability.

### Phase 3C: Scoring Engine

#### 3C.1 Strategic Benefit Score (SBS) Engine
**File:** `lib/strategy/core/scoringEngine.ts`

**Formula:**
```typescript
SBS = (FinancialBenefit × 0.40) +
      (RiskReduction × 0.25) +
      (CostAvoidance × 0.15) +
      (LiquidityImpact × 0.10) +
      (TaxImpact × 0.05) +
      (DataConfidence × 0.05)

Each component scored 0-100
Final SBS: 0-100
```

**Functions:**
```typescript
export function calculateSBS(finding: Finding, data: StrategyDataPacket): number
export function explainScore(sbs: number, components: ScoreComponents): string
export function rankRecommendations(recs: Recommendation[]): Recommendation[]
```

### Validation Criteria
- ✅ All 8 analyzers implemented
- ✅ Business rules tested with sample data
- ✅ SBS scoring produces consistent results
- ✅ Each analyzer returns structured findings
- ✅ Edge cases handled (missing data, zero values)

---

## STAGE 4: LAYER 3 - STRATEGY SYNTHESIS
**Effort:** 15-20 hours
**Type:** Backend - Synthesis Logic
**Status:** NOT STARTED

### Deliverables

#### 4.1 Strategy Synthesizer
**File:** `lib/strategy/synthesizers/strategySynthesizer.ts`

**Main Function:**
```typescript
export async function generateStrategies(
  userId: string,
  sessionId?: string
): Promise<StrategyRecommendation[]>
```

**Process:**
1. Collect data (Layer 1)
2. Run all analyzers (Layer 2)
3. Aggregate findings
4. Apply safeguards
5. Generate evidence graphs
6. Create reasoning traces
7. Calculate SBS scores
8. Rank recommendations
9. Apply user preferences
10. Save to database

**Evidence Graph Structure:**
```typescript
interface EvidenceGraph {
  dataPoints: {
    source: string;
    value: any;
    timestamp: Date;
  }[];
  historicalTrend: {
    metric: string;
    values: { date: Date; value: number }[];
  }[];
  snapshotValues: Record<string, any>;
  insightFlags: string[];
  healthIssues: string[];
  calculations: Record<string, number>;
}
```

**Reasoning Trace:**
```typescript
interface ReasoningTrace {
  steps: {
    step: number;
    description: string;
    calculation?: string;
    result: any;
  }[];
  businessRule: string;
  thresholdsApplied: Record<string, number>;
  alternativesConsidered: string[];
}
```

#### 4.2 Conflict Resolver
**File:** `lib/strategy/synthesizers/conflictResolver.ts`

**Conflict Detection:**
```typescript
Mutually Exclusive Actions:
- "Pay down loan" vs "Increase investments"
- "Sell property" vs "Refinance property"
- "Increase spending" vs "Build emergency fund"

export function detectConflicts(
  recommendations: Recommendation[]
): ConflictGroup[]
```

**Conflict Group Structure:**
```typescript
interface ConflictGroup {
  id: string;
  type: 'mutually_exclusive' | 'competing_priority';
  recommendations: Recommendation[];
  tradeoffAnalysis: {
    option: Recommendation;
    pros: string[];
    cons: string[];
    financialImpact: number;
  }[];
  suggestedResolution: string;
}
```

#### 4.3 Alternative Generator
**File:** `lib/strategy/synthesizers/alternativeGenerator.ts`

For each recommendation, generate 2-3 alternatives with different risk/return profiles:
- Conservative alternative (lower risk, lower return)
- Moderate alternative (balanced)
- Aggressive alternative (higher risk, higher return)

### Validation Criteria
- ✅ Strategy generation produces structured recommendations
- ✅ Evidence graphs contain all source data
- ✅ Reasoning traces are step-by-step
- ✅ Conflicts detected correctly
- ✅ Alternatives generated with varying risk profiles

---

## STAGE 5: MULTI-YEAR FORECASTING
**Effort:** 12-15 hours
**Type:** Backend - Forecasting Engine
**Status:** NOT STARTED

### Deliverables

#### 5.1 Forecast Engine
**File:** `lib/strategy/forecasting/forecastEngine.ts`

**Main Function:**
```typescript
export async function generateForecast(
  userId: string,
  years: number,
  scenario: ScenarioType,
  customParams?: ForecastAssumptions
): Promise<StrategyForecast>
```

**Forecast Calculations:**
```typescript
For each year (1 to N):
  // Net Worth Projection
  netWorth[year] = netWorth[year-1] * (1 + investmentReturn)
                   + (income * (1 + incomeGrowth))
                   - (expenses * (1 + expenseInflation))
                   - loanPayments[year]

  // Debt Trajectory
  debt[year] = calculateLoanBalance(year, loanSchedules)

  // Cashflow Projection
  cashflow[year] = income[year] - expenses[year] - loanPayments[year]
```

**Scenario Assumptions:**
```typescript
DEFAULT:
  incomeGrowth: 3%
  expenseInflation: 2.5%
  investmentReturn: 7%
  rentalYield: 4%
  cpiProjection: 2.5%

CONSERVATIVE:
  incomeGrowth: 1%
  expenseInflation: 3.5%
  investmentReturn: 5%
  rentalYield: 3%
  cpiProjection: 3%

AGGRESSIVE:
  incomeGrowth: 5%
  expenseInflation: 2%
  investmentReturn: 10%
  rentalYield: 5%
  cpiProjection: 2%
```

**Best/Worst Case:**
```typescript
Best Case: Aggressive assumptions + 2% bonus
Worst Case: Conservative assumptions - 2% penalty
```

#### 5.2 Retirement Runway
```typescript
export function calculateRetirementRunway(
  currentAge: number,
  targetRetirementAge: number,
  currentNetWorth: number,
  assumptions: ForecastAssumptions
): RetirementAnalysis
```

**Calculations:**
- Years to retirement
- Required net worth at retirement
- Monthly savings required
- Probability of achieving target
- Shortfall/surplus projection

#### 5.3 Projection Calculator
**File:** `lib/strategy/forecasting/projectionCalculator.ts`

Helper functions:
```typescript
export function compoundGrowth(principal: number, rate: number, years: number): number
export function loanAmortization(principal: number, rate: number, term: number): AmortizationSchedule
export function inflationAdjust(amount: number, years: number, cpi: number): number
export function futureValue(pv: number, rate: number, periods: number): number
export function presentValue(fv: number, rate: number, periods: number): number
```

### Validation Criteria
- ✅ Forecast generates 5, 10, 20, 30 year projections
- ✅ All three scenarios (DEFAULT, CONSERVATIVE, AGGRESSIVE) work
- ✅ Calculations match Excel/calculator results
- ✅ Best/worst case bands calculated
- ✅ Retirement runway accurate

---

## STAGE 6: API ROUTES
**Effort:** 10-12 hours
**Type:** Backend - API Layer
**Status:** NOT STARTED

### Deliverables

#### 6.1 Strategy Generation API
**File:** `app/api/strategy/generate/route.ts`

```typescript
POST /api/strategy/generate
Body: {
  sessionId?: string,
  forceRefresh?: boolean
}

Response: {
  recommendations: StrategyRecommendation[],
  conflicts: ConflictGroup[],
  dataQuality: DataQualityReport,
  limitedMode: boolean,
  generatedAt: string
}
```

#### 6.2 Strategy List API
**File:** `app/api/strategy/route.ts`

```typescript
GET /api/strategy?status=PENDING&category=DEBT&limit=20&offset=0

Response: {
  recommendations: StrategyRecommendation[],
  total: number,
  filtered: number,
  pagination: { limit, offset, hasMore }
}
```

#### 6.3 Strategy Detail API
**File:** `app/api/strategy/[id]/route.ts`

```typescript
GET /api/strategy/:id
Response: StrategyRecommendation (full detail with evidence)

PATCH /api/strategy/:id
Body: {
  status: 'ACCEPTED' | 'DISMISSED',
  dismissReason?: string
}
Response: Updated StrategyRecommendation
```

#### 6.4 Forecast API
**File:** `app/api/strategy/forecast/route.ts`

```typescript
POST /api/strategy/forecast
Body: {
  years: 5 | 10 | 20 | 30,
  scenario: 'DEFAULT' | 'CONSERVATIVE' | 'AGGRESSIVE' | 'CUSTOM',
  customParams?: ForecastAssumptions
}

Response: StrategyForecast
```

#### 6.5 Session API
**File:** `app/api/strategy/session/route.ts`

```typescript
POST /api/strategy/session
Body: {
  riskAppetite?: RiskAppetite,
  timeHorizon?: number,
  debtComfort?: DebtComfort,
  investmentStyle?: InvestmentStyle,
  retirementAge?: number
}
Response: StrategySession

GET /api/strategy/session
Response: StrategySession (current user session)

PUT /api/strategy/session
Body: Partial<StrategySession>
Response: Updated StrategySession
```

#### 6.6 Analytics API
**File:** `app/api/strategy/analytics/route.ts`

```typescript
GET /api/strategy/analytics

Response: {
  totalRecommendations: number,
  acceptedCount: number,
  dismissedCount: number,
  pendingCount: number,
  categoryCounts: Record<StrategyCategory, number>,
  averageSBS: number,
  topRecommendation: StrategyRecommendation
}
```

### Validation Criteria
- ✅ All 6 API routes functional
- ✅ Proper authentication/authorization
- ✅ Error handling for all edge cases
- ✅ Response times < 2 seconds
- ✅ Pagination working correctly

---

## STAGE 7: LAYER 4 - UI COMPONENTS
**Effort:** 20-25 hours
**Type:** Frontend - UI
**Status:** NOT STARTED
**⚠️ UI STAGE - Visual inspection required**

### Deliverables

#### 7.1 Strategy Dashboard
**File:** `app/(dashboard)/strategy/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│ Strategy Dashboard                       │
├─────────────────────────────────────────┤
│ Data Quality Badge  │  Last Updated     │
├─────────────────────┬───────────────────┤
│ Top 5 Recommendations (SBS sorted)      │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Refinance home loan - SBS: 87   │ │
│ │ 2. Increase emergency fund - 75    │ │
│ │ 3. Rebalance portfolio - 68        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Filters: [Category ▾] [Status ▾]       │
├─────────────────────┬───────────────────┤
│ 30-Year Forecast    │  Risk Meter       │
│ [Interactive Chart] │  [Gauge Widget]   │
├─────────────────────┴───────────────────┤
│ All Recommendations (Paginated Table)   │
└─────────────────────────────────────────┘
```

**Features:**
- Generate strategy button
- Filter by category, status
- Sort by SBS score, date
- Quick accept/dismiss buttons
- Link to detail view

#### 7.2 Strategy Detail View
**File:** `app/(dashboard)/strategy/[id]/page.tsx`

**Sections:**
1. **Summary Card**
   - Title, category, SBS score
   - Confidence badge
   - Accept/Dismiss buttons

2. **Financial Impact**
   - Monthly/yearly impact
   - Total savings
   - Break-even timeline
   - Cost analysis

3. **Evidence Graph**
   - Data sources visualization
   - Historical trends
   - Current snapshot values

4. **Reasoning Trace**
   - Step-by-step explanation
   - Business rules applied
   - Calculations shown

5. **Alternatives**
   - Conservative/Moderate/Aggressive options
   - Side-by-side comparison

6. **Forecast Projection** (if applicable)
   - Multi-year impact chart

#### 7.3 Entity Strategy Tabs
**Files:**
- `app/(dashboard)/properties/[id]/strategy/page.tsx`
- `app/(dashboard)/loans/[id]/strategy/page.tsx`
- `app/(dashboard)/investments/[id]/strategy/page.tsx`

Show entity-specific recommendations filtered by affected entities.

#### 7.4 Forecast Visualization
**Component:** `components/strategy/ForecastChart.tsx`

Interactive line chart with:
- Best case (green line)
- Default case (blue line)
- Worst case (red line)
- Current position marker
- Year markers for milestones
- Hover tooltips with details

#### 7.5 Strategy Preferences
**File:** `app/(dashboard)/strategy/preferences/page.tsx`

Form with:
- Risk appetite slider (Conservative → Aggressive)
- Time horizon input (years)
- Debt comfort selector
- Investment style selector
- Retirement age input
- Save preferences button

#### 7.6 Conflict Resolution UI
**Component:** `components/strategy/ConflictResolver.tsx`

Side-by-side comparison:
```
┌──────────────────┬──────────────────┐
│ Option A         │ Option B         │
├──────────────────┼──────────────────┤
│ Pay down loan    │ Invest surplus   │
│ SBS: 72          │ SBS: 68          │
│                  │                  │
│ Pros:            │ Pros:            │
│ • Reduce debt    │ • Build wealth   │
│ • Save interest  │ • Compound growth│
│                  │                  │
│ Cons:            │ Cons:            │
│ • Less liquidity │ • Keep debt      │
│ • Opportunity    │ • Market risk    │
│   cost           │                  │
└──────────────────┴──────────────────┘
       [Select A]        [Select B]
```

### Validation Criteria
- ✅ Dashboard loads and displays recommendations
- ✅ Detail view shows all sections
- ✅ Entity tabs filter correctly
- ✅ Forecast chart renders with all scenarios
- ✅ Preferences form saves correctly
- ✅ Conflict resolver shows trade-offs
- ✅ Responsive design works on mobile
- ✅ Loading states shown during API calls
- ✅ Error states handled gracefully

---

## STAGE 8: TESTING & VALIDATION
**Effort:** 8-10 hours
**Type:** Testing
**Status:** NOT STARTED

### Deliverables

#### 8.1 Unit Tests
**Files:** `__tests__/strategy/analyzers/*.test.ts`

Test each analyzer:
- Debt analyzer refinance logic
- Cashflow analyzer emergency fund calculation
- Investment analyzer rebalancing
- SBS scoring consistency

#### 8.2 Integration Tests
**Files:** `__tests__/strategy/integration/*.test.ts`

Test full flow:
- Data collection → Analysis → Synthesis
- API endpoints
- Database operations

#### 8.3 Test Data Scenarios
Create test fixtures for:
- Complete data (high quality)
- Incomplete data (limited mode)
- Edge cases (zero balances, negative cashflow)
- Multiple conflict scenarios

### Validation Criteria
- ✅ All unit tests passing
- ✅ Integration tests passing
- ✅ Edge cases handled
- ✅ Test coverage > 80%

---

## STAGE 9: DOCUMENTATION
**Effort:** 4-6 hours
**Type:** Documentation
**Status:** NOT STARTED

### Deliverables

#### 9.1 API Documentation
**File:** `docs/api/STRATEGY_API.md`

OpenAPI/Swagger specs for all endpoints

#### 9.2 Analyzer Logic Documentation
**File:** `docs/strategy/ANALYZER_LOGIC.md`

Document business rules for each analyzer

#### 9.3 User Guide
**File:** `docs/strategy/USER_GUIDE.md`

How to interpret and act on recommendations

### Validation Criteria
- ✅ All API endpoints documented
- ✅ Business rules explained
- ✅ User guide complete with examples

---

## 13.4 ACCEPTANCE CRITERIA

Phase 11 is complete when:

- ✅ All 3 Prisma models deployed
- ✅ Data collection layer functional
- ✅ All 8 analyzers implemented and tested
- ✅ SBS scoring producing consistent results
- ✅ Strategy synthesis generating recommendations
- ✅ Conflict detection working
- ✅ Multi-year forecasting operational (5-30 years)
- ✅ All 6 API routes functional
- ✅ Strategy Dashboard live and functional
- ✅ Entity strategy tabs working
- ✅ Forecast visualization rendering correctly
- ✅ User preferences influencing recommendations
- ✅ Performance < 2 seconds for strategy generation
- ✅ Tests passing (unit + integration)
- ✅ Documentation complete

---

## 13.5 PROGRESS TRACKING

**Status:** 45% Complete (Stage 3/9)

| Stage | Status | Completion |
|-------|--------|------------|
| 1. Database Schema | ✅ COMPLETE | 100% |
| 2. Data Collection | ✅ COMPLETE | 100% |
| 3. Analysis Engines | ✅ COMPLETE | 100% |
| 4. Strategy Synthesis | NOT STARTED | 0% |
| 5. Forecasting | NOT STARTED | 0% |
| 6. API Routes | NOT STARTED | 0% |
| 7. UI Components | NOT STARTED | 0% |
| 8. Testing | NOT STARTED | 0% |
| 9. Documentation | NOT STARTED | 0% |

**Last Updated:** 2025-11-25

### Stage 2 Implementation Details (COMPLETE)

**Commit:** `af7a2d7` - feat(phase-11): implement Stage 2 - Data Collection Layer

**Files Implemented:**
- ✅ `lib/strategy/core/dataCollector.ts` (520 lines)
  - `collectStrategyData()` - Main data collection from 5 sources
  - `validateDataCompleteness()` - Data quality scoring (0-100)
  - `isLimitedMode()` - Limited mode detection (<60% quality)
  - `getQualityStatus()` - Human-readable quality labels
  - Individual fetchers for each data source
  - Completeness calculators with weighted scoring
  - Missing data detection and recommendations

- ✅ `lib/strategy/index.ts` - Updated to export data collection functions

**Technical Implementation:**
- Parallel data fetching using `Promise.all()` for performance
- Dynamic imports to avoid circular dependencies
- Weighted quality scoring: Snapshot (35%), Insights (20%), Health/GRDCS/Prefs (15% each)
- Graceful error handling with fallback to null/empty arrays
- Type-safe integration with existing Prisma models

**Validation Results:**
- ✅ Data collector fetches from all 5 sources
- ✅ Data quality scoring works correctly
- ✅ Limited mode detection functional
- ✅ Handles missing data gracefully
- ✅ All TypeScript types defined

### Stage 3 Implementation Details (COMPLETE)

**Commit:** `93938ec` - feat(phase-11): implement Stage 3 - Analysis Engines & SBS Scoring

**Files Implemented:**
- ✅ `lib/strategy/analyzers/debtAnalyzer.ts` (400+ lines)
  - Refinancing opportunity analysis with break-even calculations
  - Debt consolidation recommendations
  - Early repayment vs investment comparison
  - Offset account optimization
  - Debt-to-income (DTI) ratio monitoring

- ✅ `lib/strategy/analyzers/cashflowAnalyzer.ts` (320+ lines)
  - Emergency fund adequacy assessment (3-6 months)
  - Spending risk detection (max 80% expense-to-income)
  - Surplus allocation prioritization
  - Income stability assessment

- ✅ `lib/strategy/analyzers/investmentAnalyzer.ts` (150+ lines)
  - Concentration risk (max 20% per investment)
  - Diversification monitoring (min 5 holdings)
  - Portfolio rebalancing based on risk appetite

- ✅ `lib/strategy/analyzers/propertyAnalyzer.ts` (120+ lines)
  - Rental yield analysis (<3% warning threshold)
  - Hold vs sell recommendations
  - Capital growth assessment

- ✅ `lib/strategy/analyzers/riskAnalyzer.ts` (110+ lines)
  - Leverage ratio monitoring (max 80% LVR)
  - Geographic concentration risk detection

- ✅ `lib/strategy/analyzers/liquidityAnalyzer.ts` (110+ lines)
  - Liquidity ratio assessment (min 10% liquid assets)
  - Cash reserve monitoring (min $10k)

- ✅ `lib/strategy/analyzers/taxAnalyzer.ts` (120+ lines)
  - Tax loss harvesting opportunities
  - Capital gains tax discount planning (12-month rule)

- ✅ `lib/strategy/analyzers/timeHorizonAnalyzer.ts` (140+ lines)
  - Retirement runway analysis
  - Required monthly savings calculations
  - Goal achievement probability

- ✅ `lib/strategy/core/scoringEngine.ts` (227 lines)
  - SBS calculation engine with weighted formula
  - Components: Financial (40%), Risk (25%), Cost Avoidance (15%), Liquidity (10%), Tax (5%), Confidence (5%)
  - Ranking and sorting functions
  - Score explainability with detailed breakdown
  - Batch processing for multiple findings

- ✅ `lib/strategy/index.ts` - Updated to export all analyzers and scoring functions

**Technical Implementation:**
- Pure TypeScript business rule algorithms (NO AI/LLM)
- Financial calculation formulas (amortization, compound growth, future value)
- Safeguard validation integrated into all analyzers
- Standard AnalysisResult format across all analyzers
- Each finding includes ImpactScore for SBS calculation
- Evidence graphs for full traceability
- Graceful error handling with informative error messages

**Validation Results:**
- ✅ All 8 analyzers implemented with complete business rules
- ✅ SBS scoring produces consistent 0-100 scores
- ✅ Findings include severity, impact scores, and evidence
- ✅ Each analyzer returns standardized AnalysisResult
- ✅ Type-safe with existing data models

---

# END OF PHASE 11 — AI STRATEGY ENGINE
