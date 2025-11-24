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

# END OF PHASE 12 — FINANCIAL HEALTH ENGINE
