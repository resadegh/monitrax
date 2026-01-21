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

**Status:** 📋 PLANNED
**Effort:** Medium (2-3 days)
**Dependencies:** Phase 20A (Tax Engine) ✅ Complete

### Deliverables

1. **Tax Position Summary Tile in CFO Dashboard**
   - Estimated refund/owing
   - Confidence level
   - Days until EOFY
   - Action required indicator

2. **Tax-Related Risk Detection**
   - `cgt_exposure_high` - Unrealised gains > $50k
   - `super_cap_approaching` - Concessional cap utilization > 80%
   - `div293_threshold` - Income approaching $250k
   - `eofy_action_required` - Prepayment opportunities
   - `depreciation_unclaimed` - Properties without schedules
   - `franking_credits_unused` - Credits exceeding tax liability

3. **After-Tax Toggle**
   - Show gross vs net income
   - Property cashflow with tax benefit
   - Investment returns after CGT & franking

### Files to Create/Modify

```
lib/cfo/
├── decisionSupport/
│   └── taxIntegration.ts         # Tax insights for CFO
│
lib/cfo/riskRadar.ts              # Add tax-related risks
app/api/cfo/route.ts              # Extend response with taxInsights
app/dashboard/cfo/page.tsx        # Add Tax Position tile
```

---

## 17.13.3 Phase 17B: Loan Decision Tools (MEDIUM-HIGH PRIORITY)

**Status:** 📋 PLANNED
**Effort:** Medium (3-4 days)
**Dependencies:** Debt Planner Engine ✅ Complete

### Decision Questions Addressed

| Question | Solution |
|----------|----------|
| "Should I refinance?" | Refinance analysis with breakeven calculation |
| "Is offset better than extra repayments?" | Personalized comparison calculator |
| "How much interest will I save over time?" | Interest savings visualization |

### Deliverables

1. **Refinance Analysis Action Type**
   - Current rate vs estimated market rate
   - Monthly & total savings potential
   - Breakeven months (accounting for switching costs)
   - Clear recommendation

2. **Offset vs Extra Repayments Calculator**
   - Side-by-side comparison
   - Interest saved by each strategy
   - Time saved on loan term
   - Personalized recommendation

3. **Interest Savings Projection**
   - Amortization visualization
   - "What if I pay $X extra" scenarios
   - Total interest saved display

### Type Definitions

```typescript
interface LoanDecisionSupport {
  refinanceAnalysis: {
    currentRate: number;
    estimatedMarketRate: number;
    potentialSavingsMonthly: number;
    potentialSavingsTotal: number;
    breakEvenMonths: number;
    recommendation: 'REFINANCE_NOW' | 'WAIT' | 'NOT_WORTHWHILE';
    switchingCostEstimate: number;
  };

  offsetComparison: {
    offsetBalance: number;
    interestSavedByOffset: number;
    extraRepaymentAmount: number;
    interestSavedByExtraRepayment: number;
    timeSavedByExtraRepayment: number;
    recommendation: 'OFFSET' | 'EXTRA_REPAYMENTS' | 'COMBINATION';
    explanation: string;
  };
}
```

### Files to Create/Modify

```
lib/cfo/
├── decisionSupport/
│   └── loanDecisions.ts          # Refinance & offset analysis
│
lib/cfo/actionEngine.ts           # Add refinance, offset actions
app/dashboard/cfo/page.tsx        # Add loan decision UI
components/cfo/
├── RefinanceAnalysisCard.tsx
└── OffsetComparisonModal.tsx
```

---

## 17.13.4 Phase 17C: Property Decision Tools (HIGH PRIORITY)

**Status:** 📋 PLANNED
**Effort:** High (5-7 days)
**Dependencies:** Property Module ✅, Depreciation Engine ✅

### Decision Questions Addressed

| Question | Solution |
|----------|----------|
| "Is this property actually performing?" | Property Performance Scorecard |
| "What happens if interest rates rise?" | Interest Rate Stress Test |
| "Can I afford another property?" | Serviceability Calculator |
| "Should I sell, hold, or renovate?" | Sell/Hold/Renovate Framework |

### Deliverables

1. **Property Performance Scorecard**
   - Total return (capital growth + yield)
   - Cash-on-cash return
   - Comparison to local market median
   - Year-over-year appreciation

2. **Interest Rate Stress Test Tool**
   - Model +1%, +2%, +3% rate scenarios
   - Show cashflow impact per property
   - Identify properties at risk

3. **Affordability/Serviceability Calculator**
   - Max borrowing capacity estimate
   - Current serviceability position
   - Headroom for additional debt
   - Recommended deposit for next property

4. **Sell/Hold/Renovate Decision Framework**
   - 5-year hold projection
   - Net proceeds if sold now
   - Renovation ROI estimate
   - AI-powered recommendation with reasoning

### Type Definitions

```typescript
interface PropertyDecisionSupport {
  performanceMetrics: {
    totalReturn: number;
    cashOnCashReturn: number;
    marketComparison: number;
    appreciationRate: number;
  };

  stressTest: {
    rateIncrease1pct: CashflowImpact;
    rateIncrease2pct: CashflowImpact;
    vacancyPeriod3mo: CashflowImpact;
    rentReduction10pct: CashflowImpact;
  };

  affordabilityCheck: {
    maxBorrowingCapacity: number;
    currentServiceability: number;
    headroom: number;
    canAffordAnother: boolean;
    recommendedDepositRequired: number;
  };

  sellHoldAnalysis: {
    holdProjection5yr: ProjectedReturn;
    sellNowNetProceeds: number;
    renovateROI: number | null;
    recommendation: 'SELL' | 'HOLD' | 'RENOVATE' | 'NEEDS_MORE_DATA';
    reasoning: string[];
  };
}
```

### Files to Create/Modify

```
lib/cfo/
├── decisionSupport/
│   └── propertyDecisions.ts      # Property analysis
│
lib/cfo/riskRadar.ts              # Add property stress test risks
app/dashboard/cfo/page.tsx        # Add property decision UI
components/cfo/
├── PropertyPerformanceCard.tsx
├── StressTestModal.tsx
├── AffordabilityCalculator.tsx
└── SellHoldAnalysis.tsx
```

---

## 17.13.5 Phase 17D: Investment Decision Tools (MEDIUM PRIORITY)

**Status:** 📋 PLANNED
**Effort:** Medium (3-4 days)
**Dependencies:** Phase 23 (Investment CGT) ⚠️ Partial, Investment Analytics Engine ✅

### Decision Questions Addressed

| Question | Solution |
|----------|----------|
| "Am I overexposed to one asset class?" | Allocation vs Target comparison |
| "What's my real after-tax return?" | After-tax return display |
| "Is this investment improving my portfolio?" | Portfolio contribution analysis |

### Deliverables

1. **Allocation vs Target Comparison**
   - Current allocation by asset class
   - User-defined or suggested target
   - Drift from target percentage
   - Rebalancing action suggestions

2. **After-Tax Return Display**
   - Per-holding after-tax return
   - Include franking credit benefit
   - Include CGT if sold
   - Compare to alternatives (term deposit, index)

3. **Portfolio Contribution Analysis**
   - Contribution to portfolio return
   - Contribution to portfolio risk
   - Risk-adjusted return (Sharpe ratio)
   - Increase/Hold/Reduce recommendation

### Type Definitions

```typescript
interface InvestmentDecisionSupport {
  allocationAnalysis: {
    currentAllocation: AssetAllocation;
    targetAllocation: AssetAllocation | null;
    driftFromTarget: number;
    rebalanceActions: RebalanceAction[];
  };

  afterTaxReturns: {
    holdingId: string;
    grossReturn: number;
    frankingCredits: number;
    cgtIfSoldNow: number;
    effectiveAfterTaxReturn: number;
  };

  portfolioContribution: {
    holdingId: string;
    contributionToReturn: number;
    contributionToRisk: number;
    sharpeRatio: number;
    recommendation: 'INCREASE' | 'HOLD' | 'REDUCE' | 'SELL';
  };
}
```

---

## 17.13.6 Success Metrics

| Metric | Before (Jan 2026) | Target |
|--------|-------------------|--------|
| User can answer "Should I refinance?" | ❌ No | ✅ Yes |
| User can see after-tax returns | ❌ No | ✅ Yes |
| User can stress-test rate increases | ❌ No | ✅ Yes |
| Tax position visible in CFO | ❌ No | ✅ Yes |
| Property performance vs market | ❌ No | ✅ Yes |

---

## 17.13.7 Implementation Priority

| Phase | Priority | Value | Effort |
|-------|----------|-------|--------|
| 17A: Tax Integration | HIGH | High | Medium |
| 17B: Loan Decisions | MEDIUM-HIGH | High | Medium |
| 17C: Property Decisions | HIGH | Very High | High |
| 17D: Investment Decisions | MEDIUM | Medium-High | Medium |

**Recommended Sequence:** 17A → 17C → 17B → 17D
