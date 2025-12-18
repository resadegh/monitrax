# Phase 31: Cashflow Intelligence Center

## Overview

Phase 31 introduces the **Cashflow Intelligence Center** - a comprehensive redesign of the cashflow page that serves as the "heart and soul" of Monitrax. This feature aggregates data from all existing financial engines into a unified, actionable dashboard with AI-powered insights.

## Key Principles

1. **Zero Hallucination**: AI only receives real calculated numbers - never generates fictional data
2. **Transaction Drill-Down**: All spending leaks link to actual culprit transactions
3. **Simplified Actions**: Use "View Details" and "Learn How" instead of complex direct actions
4. **Persistent Summaries**: Gemini summary persists until user regenerates or significant data change
5. **Mobile-First**: Equal priority for mobile and desktop responsive design

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Engines                              │
├─────────────┬─────────────┬──────────────┬─────────┬────────────┤
│ CFE         │ COE         │ Health       │ Budget  │ Tax        │
│ (Phase 14)  │ (Phase 14)  │ (Phase 12)   │ (Ph 28) │ (Phase 20) │
└──────┬──────┴──────┬──────┴───────┬──────┴────┬────┴─────┬──────┘
       │             │              │           │          │
       └─────────────┴──────────────┴───────────┴──────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │  /api/cashflow/         │
                │  intelligence           │
                │  (Aggregator Endpoint)  │
                └───────────┬─────────────┘
                            │
                            ▼
                ┌─────────────────────────┐
                │  Cashflow Intelligence  │
                │  Center UI              │
                │  (page.tsx)             │
                └─────────────────────────┘
```

### Component Hierarchy

```
CashflowPage
├── GeminiSummary (AI-powered insights hero)
├── CashflowHealthScore (unified 0-100 score)
├── ForecastSummary (quick stats grid)
├── WaterfallChart (income → expenses flow)
├── MoneyLeakDetector (spending leaks with transaction links)
├── BudgetVsActual (budget tracking)
├── TaxOptimization (tax summary widget)
└── SmartActionsEnhanced (ranked recommendations)
```

## Health Score Calculation

### Weight Distribution

| Category | Weight | Source |
|----------|--------|--------|
| Liquidity | 25% | CFE/COE - Emergency buffer, accessible cash |
| Cashflow Stability | 25% | CFE - Income vs expenses, surplus |
| Forecast Risk | 20% | CFE - Shortfall risk, break-even timing |
| Budget Adherence | 15% | Budget Analysis - Budget vs actual |
| Debt Health | 15% | Health Engine - DTI ratio, repayment load |

### Score Tiers

| Score | Tier | Color |
|-------|------|-------|
| 80-100 | EXCELLENT | Green |
| 60-79 | GOOD | Lime |
| 40-59 | MODERATE | Yellow |
| 20-39 | CONCERNING | Orange |
| 0-19 | CRITICAL | Red |

## Money Leak Detection

### Leak Categories

1. **Subscriptions**: Unused or forgotten services, price increases
2. **Category Overspending**: Spending above Australian benchmarks (ABS data)
3. **Impulse Spending**: High-frequency small purchases at same merchant
4. **Takeaway/Delivery**: Food delivery over-reliance (>5% of income)

### Australian Spending Benchmarks (% of income)

| Category | Benchmark |
|----------|-----------|
| Food & Groceries | 15% |
| Transport | 12% |
| Entertainment | 6% |
| Dining Out | 5% |
| Shopping | 8% |
| Health & Medical | 5% |
| Subscriptions | 3% |

## API Endpoints

### GET /api/cashflow/intelligence

Aggregates all financial data into unified intelligence response.

**Response Structure:**
```typescript
{
  success: boolean;
  data: {
    healthScore: {
      overallScore: number;
      tier: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';
      breakdown: HealthBreakdown[];
      confidence: number;
      lastCalculated: Date;
    };
    forecast: {
      current: { balance, income, expenses, net };
      forecast30Day: { predictedBalance, confidence, risk };
      forecast90Day: { predictedBalance, confidence, risk };
      breakEvenDay: number;
      shortfallRisk: boolean;
    };
    leaks: {
      totalLeakage: number;
      leaks: MoneyLeak[];
      topCategories: TopCategory[];
      analyzedFrom: Date;
      analyzedTo: Date;
      transactionCount: number;
    };
    waterfall: {
      items: WaterfallItem[];
      netIncome: number;
      totalExpenses: number;
      surplus: number;
    };
    budgetComparison?: BudgetComparison;
    taxOptimization?: TaxOptimization;
    smartActions: SmartAction[];
    dataQuality: {
      transactionCoverage: number;
      incomeCoverage: number;
      expenseCoverage: number;
      confidence: number;
    };
  };
}
```

### GET/POST /api/cashflow/summary

Manages AI-generated natural language summaries.

**GET**: Retrieves cached summary or generates new one
**POST**: Forces regeneration

**Response:**
```typescript
{
  success: boolean;
  data: {
    content: string;
    keyInsights: string[];
    generatedAt: Date;
    isStale: boolean;
  };
}
```

## Database Schema

### CashflowSummary Model

```prisma
model CashflowSummary {
  id           String   @id @default(uuid())
  userId       String
  content      String   @db.Text
  keyInsights  Json     // string[]
  dataHash     String   // For change detection
  generatedAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([generatedAt])
  @@map("cashflow_summaries")
}
```

### Change Detection

Summary is considered stale when:
- Balance changes by >15%
- Income or expenses change by >10%
- 2+ new leaks detected
- Health score changes by >10 points

## UI Components

### Files Created

| File | Purpose |
|------|---------|
| `lib/cashflow-intelligence/types.ts` | Core type definitions |
| `lib/cashflow-intelligence/healthScoreAggregator.ts` | Health score calculation |
| `lib/cashflow-intelligence/leakDetector.ts` | Money leak detection |
| `lib/cashflow-intelligence/geminiSummary.ts` | AI summary generation |
| `lib/cashflow-intelligence/index.ts` | Module exports |
| `app/api/cashflow/intelligence/route.ts` | Intelligence API |
| `app/api/cashflow/summary/route.ts` | Summary API |
| `app/(dashboard)/cashflow/components/intelligence/CashflowHealthScore.tsx` | Health score gauge |
| `app/(dashboard)/cashflow/components/intelligence/WaterfallChart.tsx` | Money flow visualization |
| `app/(dashboard)/cashflow/components/intelligence/MoneyLeakDetector.tsx` | Leak cards with drill-down |
| `app/(dashboard)/cashflow/components/intelligence/BudgetVsActual.tsx` | Budget comparison |
| `app/(dashboard)/cashflow/components/intelligence/TaxOptimization.tsx` | Tax summary |
| `app/(dashboard)/cashflow/components/intelligence/GeminiSummary.tsx` | AI summary with regenerate |
| `app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` | Ranked actions |
| `app/(dashboard)/cashflow/components/intelligence/index.ts` | Component exports |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added CashflowSummary model |
| `app/(dashboard)/cashflow/page.tsx` | Complete redesign for Intelligence Center |

## Accuracy Verification

### Income Calculation

- Uses `normalizeIncomeStream()` to ensure NET income (after PAYG)
- Properly handles all salary types (NET, GROSS, legacy)
- Correctly normalizes frequencies (WEEKLY, FORTNIGHTLY, MONTHLY, ANNUAL)

### Tax Calculation

Uses 2024-25 Australian tax brackets:
- $0-$18,200: 0%
- $18,201-$45,000: 19%
- $45,001-$135,000: 30%
- $135,001-$190,000: 37%
- $190,001+: 45%

### Health Score Verification

- All weights sum to 1.0 (0.25 + 0.25 + 0.20 + 0.15 + 0.15)
- Each category score capped at 0-100
- Confidence calculation based on data availability

## Mobile Responsiveness

All components support:
- Responsive grids (`grid-cols-1 lg:grid-cols-X`)
- Adaptive padding (`p-4 sm:p-6`)
- Collapsible sections for mobile
- Touch-friendly action buttons
- Flexible charts with `ResponsiveContainer`

## Integration with Existing Engines

| Engine | Data Used |
|--------|-----------|
| CFE (Phase 14) | Forecast predictions, break-even day, shortfall risk |
| COE (Phase 14) | Optimization recommendations, available cash |
| Health Engine (Phase 12) | DTI ratio, emergency buffer, savings rate |
| Budget Analysis (Phase 28) | Budget vs actual comparison |
| Tax Engine (Phase 20) | PAYG withholding, effective tax rate, deductions |
| Transaction Intelligence (Phase 13) | Recurring payments, spending patterns |

## Security Considerations

- All APIs authenticated via `withAuth` middleware
- User data strictly scoped to authenticated user
- Gemini AI receives only calculated metrics, never raw transactions
- Data hash prevents unauthorized summary regeneration

## Performance Optimizations

- Parallel data fetching with `Promise.all`
- Cached Gemini summaries with 24-hour default retention
- Progressive loading with skeleton states
- Lightweight leak detection algorithm (O(n) transaction scan)

## Future Enhancements

1. Historical health score tracking
2. Weekly/monthly trend comparisons
3. Custom spending benchmarks by user profile
4. Goal-based smart action prioritization
5. Push notifications for significant changes

## Blueprint Reference

- Extends: PHASE_14_CASHFLOW_OPTIMISATION_ENGINE.md
- Related: PHASE_12_FINANCIAL_HEALTH_ENGINE.md
- Related: PHASE_28_REALISTIC_BUDGET.md
- Related: PHASE_27_GEMINI_AI_MIGRATION.md
