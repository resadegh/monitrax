# Changelog — 2025-12-18

## Phase 31: Cashflow Intelligence Center

### Summary

Complete redesign of the cashflow page into a comprehensive "Cashflow Intelligence Center" - the heart and soul of Monitrax. Aggregates data from all existing financial engines into a unified, actionable dashboard with AI-powered insights.

### Key Features

1. **Unified Health Score**: 0-100 score combining 5 weighted categories (Liquidity, Cashflow Stability, Forecast Risk, Budget Adherence, Debt Health)
2. **Money Leak Detection**: Identifies spending leaks with transaction drill-down links
3. **Waterfall Chart**: Visual money flow from income through expenses to surplus/deficit
4. **AI Summary**: Gemini-powered natural language insights with persistent caching
5. **Budget vs Actual**: Real-time budget tracking with variance indicators
6. **Tax Optimization**: Tax summary with estimated savings recommendations
7. **Smart Actions**: Ranked recommendations with navigation links

### Architecture

- Zero hallucination policy: AI receives only real calculated numbers
- Transaction drill-down: All leaks link to actual transactions
- Simplified actions: "View Details" and "Learn How" instead of direct actions
- Mobile-first responsive design

### Files Added

| File | Purpose |
|------|---------|
| `lib/cashflow-intelligence/types.ts` | Core type definitions |
| `lib/cashflow-intelligence/healthScoreAggregator.ts` | Health score calculation |
| `lib/cashflow-intelligence/leakDetector.ts` | Money leak detection |
| `lib/cashflow-intelligence/geminiSummary.ts` | AI summary generation |
| `lib/cashflow-intelligence/index.ts` | Module exports |
| `app/api/cashflow/intelligence/route.ts` | Intelligence aggregation API |
| `app/api/cashflow/summary/route.ts` | Gemini summary API (GET/POST) |
| `app/(dashboard)/cashflow/components/intelligence/CashflowHealthScore.tsx` | Health score gauge component |
| `app/(dashboard)/cashflow/components/intelligence/WaterfallChart.tsx` | Money flow visualization |
| `app/(dashboard)/cashflow/components/intelligence/MoneyLeakDetector.tsx` | Leak cards with drill-down |
| `app/(dashboard)/cashflow/components/intelligence/BudgetVsActual.tsx` | Budget comparison |
| `app/(dashboard)/cashflow/components/intelligence/TaxOptimization.tsx` | Tax summary widget |
| `app/(dashboard)/cashflow/components/intelligence/GeminiSummary.tsx` | AI summary with regenerate |
| `app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` | Ranked action cards |
| `app/(dashboard)/cashflow/components/intelligence/index.ts` | Component exports |
| `docs/blueprint/PHASE_31_CASHFLOW_INTELLIGENCE_CENTER.md` | Documentation |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added CashflowSummary model for AI summary persistence |
| `app/(dashboard)/cashflow/page.tsx` | Complete redesign for Intelligence Center |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cashflow/intelligence` | GET | Aggregated intelligence data |
| `/api/cashflow/summary` | GET | Cached or new AI summary |
| `/api/cashflow/summary` | POST | Force summary regeneration |

### Health Score Weights

| Category | Weight | Source |
|----------|--------|--------|
| Liquidity | 25% | Emergency buffer, accessible cash |
| Cashflow Stability | 25% | Income vs expenses, surplus |
| Forecast Risk | 20% | Shortfall risk, break-even timing |
| Budget Adherence | 15% | Budget vs actual spending |
| Debt Health | 15% | DTI ratio, repayment load |

### Leak Detection Categories

1. **Subscriptions**: Unused services, streaming stacking, price increases
2. **Category Overspending**: Above Australian benchmarks (ABS data)
3. **Impulse Spending**: High-frequency small purchases
4. **Takeaway/Delivery**: Food delivery over-reliance (>5% of income)

### Numbers Verification

- Income calculation uses NET amounts (after PAYG) via `normalizeIncomeStream()`
- Tax brackets verified against 2024-25 Australian rates
- Health score weights sum to 1.0
- Spending benchmarks based on ABS Household Expenditure Survey

### Database Migration Required

After deployment, run:
```bash
npx prisma db push
```

---

## Commits

```
feat: add cashflow intelligence center with unified health score
feat: add money leak detection with transaction drill-down
feat: add AI summary with Gemini and persistent caching
feat: add budget vs actual and tax optimization widgets
feat: add smart actions ranked list
docs: add PHASE_31_CASHFLOW_INTELLIGENCE_CENTER blueprint
docs: add CHANGELOG_2025_12_18
```
