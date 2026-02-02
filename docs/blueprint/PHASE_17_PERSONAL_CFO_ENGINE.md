# PHASE 17 — PERSONAL CFO ENGINE
**Monitrax Blueprint — Phase 17**

## Purpose
Transform Monitrax from a financial tracker into a **proactive, AI-driven Personal CFO** that anticipates needs, prevents financial issues before they occur, and continuously optimises the user's financial world.

This phase fuses Insights Engine v2, Cashflow Optimization (Phase 14), Transactional Intelligence (Phase 13), Reporting Suite (Phase 16), and the Mobile Companion App (Phase 15).

The core idea:
### "Your finances should run themselves — with Monitrax acting as a full-time CFO."

---

# 17.1 Objectives

1. **Deliver autonomous financial monitoring**
   - Real-time risk detection
   - Cashflow alerts
   - Spending anomaly detection
   - "Action required" prioritisation engine

2. **Provide high-value financial guidance**
   - Strategic recommendations
   - Automated reminders
   - Compliance and tax hints
   - Simple language explanations

3. **Enable automated financial optimisation**
   - Debt strategy adjustments
   - Savings/investment allocation recommendations
   - Subscription cleanup
   - Category and vendor insights

4. **Create a Personal CFO Dashboard**
   - Unified risk score
   - Immediate actions
   - High-impact insights
   - Month-to-month progression

5. **Power mobile-first nudges & notifications**
   - Real-time event-driven alerts
   - Periodic check-ins
   - Behavioural finance guardrails

---

# 17.2 Core System Components

## 17.2.1 CFO Intelligence Engine
A high-level decision layer on top of:

- GRDCS (Phase 08)
- Insights Engine V2 (Phase 04)
- Cashflow Engine (Phase 14)
- Transactional Intelligence (Phase 13)
- Reporting Engine (Phase 16)

### Responsibilities:
- Consolidate all insights from all engines
- Prioritise them based on urgency & impact
- Recommend clear user actions
- Detect financial patterns
- Trigger alerts and personal finance workflows

---

## 17.2.2 Financial Risk Radar
A continuous monitoring service that tracks:

### **Short-term risks**
- Low balance predictions
- Shortfall risk
- Spiking expenses
- Overdue bills
- Loan repayment stress

### **Medium-term risks**
- Debt-to-income deterioration
- Poor savings trajectory
- Rental property underperformance

### **Long-term risks**
- Retirement gaps
- Investment risk misalignment
- Mortgage renewal risks

The Risk Radar outputs a **CFO Score** (0–100), generated daily.

---

## 17.2.3 Action Prioritisation Engine
Every day Monitrax assembles a personalised list:

- "Do this now"
- "Upcoming risks"
- "Consider this soon"
- "Background improvements"

Each action includes:
- Explanation (simple English)
- Severity
- Expected financial impact
- Time required
- Data supporting the recommendation

This becomes the core of the CFO dashboard.

---

# 17.3 Personal CFO Dashboard (Web + Mobile)

## 17.3.1 Dashboard Sections

### **1. CFO Score**
Daily score defined by:
- Cashflow strength
- Debt coverage
- Emergency buffer
- Investment diversification
- Spending control metrics

### **2. Daily Prioritised Actions**
A list of CFO-driven recommendations, such as:
- "Reduce your spending in Category X by 8% to avoid a cashflow shortfall."
- "You can save $185/month by refinancing Loan A."
- "Two subscriptions increased last month."

### **3. Monthly Progress Overview**
- Month-over-month changes
- Net worth delta
- Top 5 financial improvements
- Emerging risks

### **4. Deep-Dive Modules**
- Spending patterns
- Debt optimisation
- Investment efficiency
- Property performance

---

# 17.4 AI-Driven Personal Finance Features

## 17.4.1 Proactive Alerts
Triggered by transactional and cashflow intelligence, including:

- Payday forecast
- Overspending warnings
- Vendor price spikes
- Duplicate charges
- Loan interest rate changes

---

## 17.4.2 Financial Coach Mode
Conversational AI able to:

- Explain insights
- Provide budgeting advice
- Model future scenarios
- Justify decisions
- Compare "what if" strategies

The system always references real GRDCS-linked data.

---

## 17.4.3 Auto-Generated Plans
The engine generates:

- 30-day cashflow plan
- Annual savings plan
- Debt reduction roadmap
- Property portfolio plan
- Investment allocation plan

Each plan includes steps, milestones, and projections.

---

# 17.5 Event-Driven Notification System
Integrated with Mobile App (Phase 15)

### Event Categories:
- Cashflow events
- Deposit/withdrawal alerts
- Income irregularities
- Unexpected large bills
- Subscription renewals
- Category overspend detection

### Delivery Channels:
- Mobile push
- Email notifications
- In-app alerts
- Scheduled morning briefings

---

# 17.6 CFO Workflow Templates
Users can activate workflows such as:

- "Reduce monthly expenses 10%"
- "Prepare for tax-time"
- "Stabilise cashflow for the next 3 months"
- "Optimise property portfolio"
- "Debt restructuring plan"

Each workflow becomes a guided step-by-step program.

---

# 17.7 Technical Architecture

## 17.7.1 Data Inputs
- GRDCS entities
- Transactional intelligence
- Cashflow engine outputs
- Insights V2 metrics
- External vendor data
- Linked accounts (Open Banking future phase)

## 17.7.2 Processing Layers
1. **Aggregation Layer**
   - Collects signals from all modules

2. **Inference Layer**
   - Decision rules
   - Risk scoring
   - Impact predictions

3. **Recommendation Layer**
   - Generates actions and insights

4. **Delivery Layer**
   - Push to UI, mobile, or scheduled feed

---

# 17.8 Dependencies

### Must be completed before Phase 17:
- Phase 13 (Transactional Intelligence)
- Phase 14 (Cashflow Optimisation)
- Phase 15 (Mobile Companion App)
- Phase 16 (Reporting & Integrations Suite)
- Phase 08 (GRDCS)

---

# 17.9 Acceptance Criteria

### Intelligence
- CFO Score calculates successfully for full portfolio
- Alerts trigger correctly for all risk categories
- Recommendations have >90% relevance (user testing)

### Usability
- Dashboard loads < 500ms
- Mobile alerts delivered < 3 seconds
- Plans are readable and actionable

### Integration
- All engines contribute data to CFO Engine
- No conflicting recommendations
- All actions link into CMNF (Phase 9)

---

# 17.10 Deliverables

- Personal CFO Dashboard (Web + Mobile)
- CFO Intelligence Engine
- Action Prioritisation Engine
- Risk Radar
- Event Notification System
- Workflow Templates
- Long-term planning system
- AI financial coach

---

# 17.11 IMPLEMENTATION STATUS

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2025-11-30
**Branch:** `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk`

## 17.11.1 Files Created

| File | Purpose |
|------|---------|
| `lib/cfo/types.ts` | Core type definitions (40+ types) |
| `lib/cfo/scoreCalculator.ts` | CFO Score calculation engine |
| `lib/cfo/riskRadar.ts` | Risk detection service |
| `lib/cfo/actionEngine.ts` | Action prioritisation engine |
| `lib/cfo/intelligenceEngine.ts` | Main orchestrator |
| `lib/cfo/index.ts` | Public API exports |
| `app/api/cfo/route.ts` | REST API endpoint |
| `app/dashboard/cfo/page.tsx` | Dashboard UI |

## 17.11.2 CFO Score Components Implemented

| Component | Weight | Description |
|-----------|--------|-------------|
| Cashflow Strength | 25% | Net cashflow vs income ratio |
| Debt Coverage | 20% | Debt service ratio analysis |
| Emergency Buffer | 15% | Months of expenses covered by liquid assets |
| Investment Diversification | 15% | Asset class spread analysis |
| Spending Control | 15% | Discretionary spending vs income |
| Savings Rate | 10% | Percentage of income saved |

## 17.11.3 Risk Types Implemented

### Short-term Risks
- `low_balance` - Account balance below threshold
- `cashflow_shortfall` - Negative monthly cashflow
- `expense_spike` - Large single expense detection
- `loan_stress` - High loan payment ratio

### Medium-term Risks
- `debt_ratio_deterioration` - DSR above 40%
- `savings_trajectory` - Savings rate below 5%
- `property_underperformance` - Yield below 3%
- `subscription_creep` - Multiple small recurring expenses

### Long-term Risks
- `concentration_risk` - Portfolio over-concentrated
- `mortgage_renewal` - Loan term ending within 12 months

## 17.11.4 Action Priority Levels

| Priority | Criteria |
|----------|----------|
| `do_now` | Critical severity OR high severity with impact > $500 |
| `upcoming` | High severity OR medium with impact > $1000 |
| `consider_soon` | Medium severity |
| `background` | Low severity optimizations |

## 17.11.5 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cfo` | Full dashboard data |
| GET | `/api/cfo?type=score` | CFO Score only |
| GET | `/api/cfo?type=risks` | Risk Radar output |
| GET | `/api/cfo?type=actions` | Prioritised actions |

## 17.11.6 Dashboard UI Features

- CFO Score circle with grade (A-F) and trend indicator
- Component breakdown with progress bars
- Quick stats cards (5 metrics)
- Risk radar with severity breakdown
- Tabbed action list (Do Now, Upcoming, Consider Soon, Background)
- Monthly progress with net worth and savings rate changes
- Alert notifications

## 17.11.7 Navigation

Added "Personal CFO" to sidebar navigation with Brain icon, positioned after Dashboard.

## 17.11.8 Technical Notes

- Uses `crypto.randomUUID()` instead of `uuid` package for ID generation
- All Prisma queries use correct schema field names
- Score calculations use weighted averages
- Risk detection runs on-demand (not scheduled)

---

# 17.12 Future Enhancements

The following features from the original blueprint are planned for future iterations:

1. **Workflow Templates** - Guided step-by-step programs
2. **Auto-Generated Plans** - 30-day cashflow, annual savings, debt reduction plans
3. **Push Notifications** - Mobile push, email, scheduled briefings
4. **Financial Coach Mode** - Conversational AI for advice
5. **Score History Persistence** - Store historical CFO scores for trend analysis
6. **Alert Management** - Mark as read, dismiss, snooze functionality

---

# 17.13 DECISION SUPPORT ENHANCEMENT ROADMAP (Added Jan 2026)

**Reference:** `docs/blueprint/AUDIT_CFO_VALUE_ASSESSMENT_2026_01.md`

Based on the CFO Value Assessment Audit (Jan 2026), the following enhancements are planned to transform the CFO page from **monitoring-only** to **decision-support focused**.

## 17.13.1 Core Principle

> "Users don't want data — they want answers."

Current state focuses on monitoring and alerting. Future state must answer user questions directly.

---

## 17.13.2 Phase 17A: Tax Integration (HIGH PRIORITY)

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2026-01-21
**Effort:** Medium (2-3 days)
**Dependencies:** Phase 20A (Tax Engine) ✅ Complete

### Implementation Details

1. **Tax Position Summary Tile in CFO Dashboard** ✅
   - Estimated refund/owing with confidence level
   - Days until EOFY with action required indicator
   - Effective tax rate and marginal rate display
   - Total deductions breakdown (property, depreciation, investment, work-related)
   - PAYG withholding tracking

2. **Tax-Related Risk Detection** ✅
   - `cgt_exposure_high` - Unrealised gains > $50k
   - `super_cap_approaching` - Concessional cap utilization > 80%
   - `div293_threshold` - Income approaching $250k
   - `eofy_action_required` - Prepayment opportunities
   - `depreciation_unclaimed` - Properties without schedules
   - `franking_credits_unused` - Credits exceeding tax liability
   - `tax_refund_opportunity` - Large refund detection

3. **Key Tax Metrics** ✅
   - Negative gearing benefit calculation
   - Franking credits available
   - Unrealised CGT exposure
   - Effective vs marginal tax rate

### Files Created/Modified

```
lib/cfo/
├── decisionSupport/
│   ├── index.ts                  # Module exports
│   └── taxIntegration.ts         # Tax insights calculator (520 lines)
│
lib/cfo/types.ts                  # Added CFOTaxInsights, TaxRisk types
lib/cfo/intelligenceEngine.ts     # Integrated tax insights
lib/cfo/index.ts                  # Export calculateCFOTaxInsights
app/dashboard/cfo/page.tsx        # Tax Position tile UI
```

### Technical Notes
- Uses centralized `calculateTaxPosition` from tax-engine (no duplicate logic)
- marginalRate stored as percentage (37 not 0.37) - divide by 100 when using as multiplier
- effectiveRate also stored as percentage for display

---

## 17.13.3 Phase 17B: Loan Decision Tools (MEDIUM-HIGH PRIORITY)

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2026-01-21
**Effort:** Medium (3-4 days)
**Dependencies:** Debt Planner Engine ✅ Complete

### Implementation Details

| Question | Solution |
|----------|----------|
| "Should I refinance?" | ✅ Refinance analysis with breakeven calculation |
| "Is my rate above market?" | ✅ Rate alerts with market comparison |
| "How much interest will I save with extra repayments?" | ✅ Extra repayment impact calculator |

### Features Implemented

1. **Refinance Opportunity Detection** ✅
   - Current rate vs estimated market rate (0.5% below current)
   - Monthly & annual savings calculation
   - Breakeven months (assuming $2k switching costs)
   - `worthRefinancing` flag (breakeven < 18 months)
   - Total lifetime savings projection

2. **Rate Alerts** ✅
   - `fixed_rate_expiring` - Fixed rate ending within 6 months
   - `interest_only_ending` - IO period ending within 6 months
   - `rate_above_market` - Rate > 0.5% above market
   - `lvr_high` - LVR > 80%

3. **Extra Repayment Impact Calculator** ✅
   - Targets highest-rate variable loan
   - Calculates interest saved with extra $500/month
   - Shows time reduced (months saved)
   - Current vs new payoff date projection

4. **Loan Portfolio Risks** ✅
   - High DTI ratio (> 6x income)
   - High debt service ratio (> 40%)
   - Rate shock risk (3% rate increase impact)
   - Offset underutilization detection

### Files Created/Modified

```
lib/cfo/
├── decisionSupport/
│   └── loanDecisionSupport.ts    # Loan insights calculator (400+ lines)
│
lib/cfo/types.ts                  # Added CFOLoanInsights, CFORefinanceOpportunity,
│                                 # CFORateAlert, CFOExtraRepaymentImpact, CFOLoanRisk
lib/cfo/intelligenceEngine.ts     # Integrated loan insights
lib/cfo/index.ts                  # Export calculateCFOLoanInsights
app/dashboard/cfo/page.tsx        # Loan Opportunities tile UI
```

### CFO Page - Loan Opportunities Tile
- Shows refinance savings (total annual)
- Lists rate alerts with urgency indicators
- Displays extra repayment benefit
- Links to full Loans page for details

---

## 17.13.4 Phase 17C: Property Decision Tools (HIGH PRIORITY)

**Status:** ✅ IMPLEMENTED (Lightweight Version)
**Implemented Date:** 2026-01-21
**Effort:** Medium (2 days)
**Dependencies:** Property Module ✅, masterFinancialService ✅

### Implementation Details

Implemented as a **lightweight property insights module** that leverages the existing `masterFinancialService.getPropertyMetrics()` to avoid duplicate calculations. Follows the "No Duplicate Numbers" design principle.

| Question | Solution |
|----------|----------|
| "Is this property actually performing?" | ✅ Top performer / Underperformer detection |
| "Which properties need attention?" | ✅ Property alerts (high LVR, low yield, negative cashflow) |
| "What's my portfolio health?" | ✅ Portfolio summary (equity, LVR, cashflow) |

### Features Implemented

1. **Portfolio Summary** ✅
   - Total properties count
   - Total value and equity
   - Average LVR across portfolio
   - Total monthly income and net cashflow

2. **Property Alerts** ✅
   - `high_lvr` - LVR > 80% (high severity if > 90%)
   - `low_yield` - Rental yield < 3% (high severity if < 2%)
   - `negative_cashflow` - Monthly cashflow < -$500 (high if < -$1000)
   - `low_growth` - Capital growth < 2%

3. **Performance Analysis** ✅
   - Top performer identification (highest yield or positive cashflow)
   - Underperformer identification (lowest yield or negative cashflow)
   - Sorted alerts by severity

### Files Created/Modified

```
lib/cfo/
├── decisionSupport/
│   └── propertyDecisionSupport.ts  # Property insights (225 lines)
│
lib/cfo/types.ts                    # Added CFOPropertyInsights, CFOPropertyAlert,
│                                   # CFOPropertyPerformance
lib/cfo/intelligenceEngine.ts       # Integrated property insights
lib/cfo/index.ts                    # Export calculateCFOPropertyInsights
app/dashboard/cfo/page.tsx          # Property Portfolio tile UI
```

### CFO Page - Property Portfolio Tile
- Shows portfolio summary (equity, value, LVR, cashflow)
- Highlights top performer and underperformer
- Lists property alerts sorted by severity
- Links to full Properties page for details

### Technical Notes
- Uses `getPropertyMetrics()` from masterFinancialService (no duplicate logic)
- Uses shared types from `lib/cfo/types.ts` (CFOPropertyAlert, CFOPropertyPerformance)
- PropertyMetrics provides: currentValue, equity, lvr, annualRentalIncome, monthlyCashflow, rentalYield, capitalGrowthPercent

### Future Enhancements (Not Yet Implemented)
- Interest rate stress test tool
- Affordability/serviceability calculator
- Sell/Hold/Renovate decision framework

---

## 17.13.5 Phase 17D: Investment Decision Tools (MEDIUM PRIORITY)

**Status:** ✅ IMPLEMENTED
**Implemented Date:** 2026-01-21
**Effort:** Medium (3-4 days)
**Dependencies:** Phase 23 (Investment CGT) ⚠️ Partial, Investment Analytics Engine ✅

### Implementation Details

| Question | Solution |
|----------|----------|
| "Am I overexposed to one asset class?" | ✅ Concentration risk detection (>30% single holding) |
| "Is my portfolio drifting from target?" | ✅ Allocation drift detection (>10% triggers alert) |
| "What's my real after-tax return?" | ✅ Franking credits, unrealised CGT, dividend income |
| "Which holdings need attention?" | ✅ Top performer and underperformer identification |

### Features Implemented

1. **Portfolio Summary** ✅
   - Total value and cost base
   - Unrealised gain ($ and %)
   - Holdings count and dividend yield estimate

2. **Asset Allocation Analysis** ✅
   - Current allocation by asset type (SHARE, ETF, MANAGED_FUND, CRYPTO)
   - Default target allocation for "Moderate" risk profile
   - Drift from target percentage calculation
   - Rebalancing action recommendations

3. **Concentration Risk Detection** ✅
   - Alerts when any single holding exceeds 30% of portfolio
   - High severity if concentration > 50%

4. **Performance Analysis** ✅
   - Top performer identification (highest % gain)
   - Underperformer identification (worst % loss)
   - Annualised return (CAGR) if holdings > 1 year old

5. **Investment Alerts** ✅
   - `concentration_high` - Single holding > 30%
   - `rebalance_needed` - Portfolio drift > 10%
   - `underperforming` - Holding down > 20%
   - `cgt_opportunity` - Long-term gains > $20k (tax planning)

6. **Tax Metrics** ✅
   - Franking credits estimation
   - Unrealised CGT calculation (with 50% discount for >12 months)
   - Dividend income (trailing 12 months)

### Files Created/Modified

```
lib/cfo/
├── decisionSupport/
│   └── investmentDecisionSupport.ts  # Investment insights (450+ lines)
│
lib/cfo/types.ts                      # Added CFOInvestmentInsights, CFOAllocationAnalysis,
│                                     # CFOPerformanceMetrics, CFOInvestmentAlert, etc.
lib/cfo/intelligenceEngine.ts         # Integrated investment insights
lib/cfo/index.ts                      # Export calculateCFOInvestmentInsights
app/dashboard/cfo/page.tsx            # Investment Portfolio tile UI
```

### CFO Page - Investment Portfolio Tile
- Shows portfolio value, unrealised gain, dividend yield
- Asset allocation breakdown with drift indicator
- Top performer and underperformer highlights
- Concentration risk warning if applicable
- Key metrics row (annualised return, dividends, CGT)
- Links to full Investments page

---

## 17.13.6 Success Metrics

| Metric | Before (Jan 2026) | After (Jan 2026) |
|--------|-------------------|------------------|
| User can answer "Should I refinance?" | ❌ No | ✅ Yes - Refinance opportunities with savings |
| User can see tax position in CFO | ❌ No | ✅ Yes - Tax Position tile |
| User can see property performance | ❌ No | ✅ Yes - Top/underperformer detection |
| User can see loan rate alerts | ❌ No | ✅ Yes - Fixed rate expiry, rate above market |
| User can see property alerts | ❌ No | ✅ Yes - High LVR, low yield, neg cashflow |
| User can see investment concentration risk | ❌ No | ✅ Yes - Concentration alerts |
| User can see portfolio drift | ❌ No | ✅ Yes - Allocation drift detection |
| User can see investment returns with CGT | ❌ No | ✅ Yes - Unrealised CGT, franking credits |

---

## 17.13.7 Implementation Status

| Phase | Priority | Status | Implemented |
|-------|----------|--------|-------------|
| 17A: Tax Integration | HIGH | ✅ DONE | 2026-01-21 |
| 17B: Loan Decisions | MEDIUM-HIGH | ✅ DONE | 2026-01-21 |
| 17C: Property Decisions | HIGH | ✅ DONE (Lightweight) | 2026-01-21 |
| 17D: Investment Decisions | MEDIUM | ✅ DONE | 2026-01-21 |

**All Phase 17 Decision Support modules are now complete!**

**Future Enhancements (Optional):**
- Phase 17C Advanced: Interest rate stress testing, serviceability calculator, sell/hold framework
- Phase 17D Advanced: Per-holding after-tax return comparison, risk-adjusted returns (Sharpe ratio)
