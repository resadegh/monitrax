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

# END OF PHASE 11 — AI STRATEGY ENGINE  
