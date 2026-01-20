# Dashboard Alignment Audit Report
## Date: 2026-01-20
## Auditor: Claude (Automated Audit)

---

## Executive Summary

This audit evaluates the Monitrax dashboard against five critical user requirements for financial clarity. The application demonstrates **strong architectural foundations** with centralized calculations and a single source of truth (Master Financial Service), but has **specific gaps** in debt categorization visibility and entity-level cashflow reconciliation.

**Overall Alignment Score: 72/100**

| Requirement | Status | Score |
|-------------|--------|-------|
| True Net Worth Visibility | PASS | 90/100 |
| Money Flow Understanding | PASS | 85/100 |
| Good Debt vs Bad Debt | PARTIAL | 45/100 |
| Entity-Level Cashflow | PARTIAL | 65/100 |
| Source Data Reconciliation | PARTIAL | 75/100 |

---

## Requirement 1: User Can Instantly See True Net Worth

### Current Implementation

**Location:** `app/dashboard/page.tsx:522-531`

The dashboard displays Net Worth as the **primary metric** in a clickable StatCard:
- Shows total net worth prominently
- Description shows "Assets - Debt" breakdown
- Clicking opens detailed breakdown dialog

**Calculation Source:** `lib/calculations/netWorthCalculator.ts`

```
Net Worth = Total Assets - Total Liabilities
```

**Assets Include:**
- Properties (market value)
- Accounts (cash/savings)
- Investments (holdings at current price)
- Superannuation (retirement accounts)
- Personal Assets (vehicles, equipment) - Phase 21

**Liabilities Include:**
- Mortgages (HOME/INVESTMENT loans)
- Personal Loans
- Credit Cards

### Assessment: PASS (90/100)

**Strengths:**
1. Single source of truth via `calculateNetWorth()` function
2. Comprehensive asset types including superannuation and personal assets
3. Detailed breakdown dialog with asset/liability categories
4. Consistent calculation across all pages (Blueprint §5.1 compliant)

**Gaps:**
1. No historical net worth tracking/trending visible on dashboard
2. Missing "unrealized gains" breakout for investments
3. No projection of net worth growth based on savings rate

### Recommendations

| Priority | Enhancement | Rationale |
|----------|-------------|-----------|
| Medium | Add net worth trend chart (6/12 month) | Users need to see trajectory, not just snapshot |
| Low | Show unrealized investment gains separately | Distinguish paper gains from realized wealth |
| Low | Add net worth projection widget | Connect savings rate to future wealth |

---

## Requirement 2: User Understands Where Money Is Actually Going

### Current Implementation

**Location:** `app/dashboard/page.tsx:626-637` + `components/dashboard/InsightWidgets.tsx`

The dashboard provides multiple money flow views:

1. **Monthly Budget Summary** - Shows:
   - Monthly income (net)
   - Essential expenses
   - Discretionary expenses
   - Loan payments
   - Remaining cash
   - Daily budget

2. **Money Bleeding Card** - Top 10 expenses by amount with:
   - Monthly/annual amounts
   - Percentage of income
   - Suggestions for high expenses

3. **Spending by Category** - Expense breakdown showing:
   - Category totals
   - Percentage of total spending
   - Individual items within categories

4. **Cashflow Dialog** - Detailed breakdown:
   - Income sources with property links
   - Expense items with property links
   - Loan repayments with property links

**Calculation Source:** `lib/calculations/cashflowOrchestrator.ts`

### Assessment: PASS (85/100)

**Strengths:**
1. Clear essential vs discretionary expense separation
2. Individual expense items shown in dialogs
3. "Money bleeding" highlights problem areas
4. Category breakdown with drill-down capability
5. Links expenses to source entities (property, loan)

**Gaps:**
1. No committed vs uncommitted expense distinction on main dashboard
2. Missing expense trend over time (is spending increasing?)
3. No budget vs actual comparison on main dashboard
4. "Where money goes" waterfall chart not on main dashboard (only in /cashflow page)

### Recommendations

| Priority | Enhancement | Rationale |
|----------|-------------|-----------|
| High | Add committed (recurring) vs variable expense breakout | Users need to see fixed obligations vs choices |
| Medium | Add expense trend indicator (vs last month/3mo avg) | Show if spending is trending up/down |
| Medium | Link to Budget Analysis from dashboard | Quick access to budget vs actual comparison |
| Low | Add mini waterfall chart on dashboard | Visual money flow is more intuitive |

---

## Requirement 3: User Can Distinguish Good Debt vs Bad Debt

### Current Implementation

**Location:** `lib/calculations/loanAggregator.ts`, `app/api/ai/debt-analysis/route.ts`

The system **has the data** for good/bad debt distinction but **does not surface it clearly on the dashboard**.

**Internal Classification:**
- Loan types: HOME, INVESTMENT, CAR, PERSONAL, STUDENT, BUSINESS, LINE_OF_CREDIT
- Tax deductibility: Investment loans are marked as tax-deductible in AI prompts
- Property linking: Loans can link to properties (investment vs home)

**AI Debt Analysis Prompt (line 483-486):**
```
Type: ${loan.type} ${isInvestment ? '(TAX DEDUCTIBLE - Investment)' : '(NON-DEDUCTIBLE - Home)'}
```

**Dashboard Visibility:**
- Shows "Portfolio LVR" but not debt breakdown by type
- Net Worth dialog shows "Mortgages" vs "Personal Loans" vs "Credit Cards"
- **No explicit "Good Debt / Bad Debt" categorization visible**

### Assessment: PARTIAL (45/100)

**Strengths:**
1. Data model supports debt categorization
2. AI Debt Analysis understands tax-deductible concept
3. Debt Planner has "Tax-Aware Strategy" option
4. Loans linked to properties for context

**Critical Gaps:**
1. **Dashboard does not show good debt vs bad debt breakdown**
2. No visualization of tax-deductible vs non-deductible debt
3. No "effective interest rate after tax" calculation shown
4. User must navigate to Debt Planner to see debt categorization
5. LVR dialog doesn't distinguish investment debt from personal debt

### Recommendations

| Priority | Enhancement | Rationale | Implementation |
|----------|-------------|-----------|----------------|
| **CRITICAL** | Add Debt Quality widget to dashboard | Core requirement not met | New component showing: Good Debt (investment, tax-deductible) vs Bad Debt (non-deductible consumer debt) |
| **HIGH** | Show effective interest rate after tax benefits | Investment debt appears "cheaper" after tax | Calculate: Effective Rate = Rate × (1 - Marginal Tax Rate) for deductible debt |
| **HIGH** | Color-code loans in LVR dialog | Visual distinction | Green = investment debt, Orange = home debt, Red = consumer debt |
| Medium | Add "Debt Health Score" to dashboard | Composite score reflecting debt quality | Based on: % deductible, DTI ratio, LVR, interest rates |
| Low | Show "Debt Payoff Priority" insight | Help users focus on bad debt | Auto-suggest which loans to pay first |

### Proposed Debt Quality Widget Structure

```typescript
interface DebtQualityBreakdown {
  goodDebt: {
    total: number;           // Investment loans, business loans
    effectiveRate: number;   // After tax deduction benefit
    purpose: string[];       // "Investment Property", "Business"
  };
  neutralDebt: {
    total: number;           // Home mortgage
    effectiveRate: number;
    purpose: string[];       // "Primary Residence"
  };
  badDebt: {
    total: number;           // Personal, car, credit card
    effectiveRate: number;
    purpose: string[];       // "Consumer Purchases"
  };
  debtQualityScore: number;  // 0-100 (higher = more "good" debt)
}
```

---

## Requirement 4: User Can See Cashflow by Entity

### Current Implementation

**Location:** `app/api/portfolio/snapshot/route.ts:662-728`

**Property-Level Cashflow (IMPLEMENTED):**
```typescript
cashflow: {
  annualIncome: annualRentalIncome,
  annualExpenses: annualPropertyExpenses,
  annualInterest,
  annualLoanRepayments,
  annualNet: propertyCashflow,
  monthlyNet: propertyCashflow / 12,
}
```

The dashboard shows property cashflow in the Properties tab (line 874-883):
- Monthly cashflow per property
- Color-coded positive/negative

**Investment Account Level (PARTIAL):**
- Shows total value and holdings
- Does NOT show income/expense cashflow per account

**Loan-Level (NOT IMPLEMENTED on dashboard):**
- Loans show principal and repayments
- No "cashflow impact" view per loan

### Assessment: PARTIAL (65/100)

**Strengths:**
1. Property-level cashflow is calculated and displayed
2. Properties tab shows monthly net cashflow
3. Rental yield calculated per property
4. Cashflow dialog links items to source entities

**Gaps:**
1. **Investment accounts don't show income (dividends, distributions)**
2. **Loans don't show individual cashflow impact**
3. No "entity cashflow comparison" view
4. Can't quickly see which entities are positive/negative contributors
5. Personal assets (vehicles) don't show running cost/cashflow

### Recommendations

| Priority | Enhancement | Rationale | Location |
|----------|-------------|-----------|----------|
| **HIGH** | Add dividend/distribution income to investment accounts | Complete cashflow picture | Investment Account cards in dashboard |
| **HIGH** | Add "Cashflow by Entity" summary section | Aggregate view of all entities | New dashboard section or tab |
| Medium | Show loan cashflow impact (repayment - tax benefit) | Loans affect cashflow | Loan detail dialog |
| Medium | Add vehicle running cost to Personal Assets tab | Assets have ongoing costs | Personal Assets section |
| Low | Entity cashflow comparison chart | Visual ranking | Bar chart of entity contributions |

### Proposed Entity Cashflow Component

```typescript
interface EntityCashflowSummary {
  properties: Array<{
    name: string;
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyLoanRepayments: number;
    netCashflow: number;
    isPositive: boolean;
  }>;
  investments: Array<{
    name: string;
    monthlyDividends: number;
    monthlyExpenses: number;  // Management fees, etc.
    netCashflow: number;
  }>;
  loans: Array<{
    name: string;
    monthlyRepayment: number;
    taxBenefit: number;       // If deductible
    netCashflowImpact: number;
  }>;
  assets: Array<{
    name: string;
    monthlyRunningCost: number;  // Rego, insurance, fuel
  }>;
  totalEntityCashflow: number;
}
```

---

## Requirement 5: User Can Reconcile Every Number Back to Source Data

### Current Implementation

**GRDCS System (Global Relational Data Consistency Schema):**
- Location: `lib/grdcs.ts`
- Every entity has linked entities and missing link warnings
- API responses include `_links` and `_meta` with linkage info

**Linkage Health Calculation:**
- Location: `app/api/portfolio/snapshot/route.ts:140-513`
- Tracks orphan entities, missing links, cross-module consistency
- Generates `relationalWarnings` for incomplete data

**Cashflow Dialog Reconciliation:**
- Shows individual income items with source
- Shows individual expenses with property/loan links
- Shows individual loan repayments with property names

### Assessment: PARTIAL (75/100)

**Strengths:**
1. GRDCS provides entity-level traceability
2. Linkage health score shows data completeness
3. Cashflow dialog breaks down totals into items
4. Property/loan names shown on expenses/income
5. API responses include relational metadata

**Gaps:**
1. **No "click to drill" from dashboard numbers to source records**
2. Linkage health warnings not visible on main dashboard
3. No "calculation breakdown" showing formula
4. Can't easily trace net worth components to individual records
5. No audit trail or "how was this calculated" tooltip

### Recommendations

| Priority | Enhancement | Rationale | Implementation |
|----------|-------------|-----------|----------------|
| **HIGH** | Add drill-down links from StatCards to filtered lists | Users need to verify numbers | Click Net Worth → opens filtered list of all assets/liabilities |
| **HIGH** | Show calculation formula in dialogs | Transparency in calculation | Tooltip: "Net Worth = $X (Properties) + $Y (Accounts) + $Z (Investments) - $W (Loans)" |
| Medium | Add linkage health indicator to dashboard | Alert users to incomplete data | Small badge showing completeness % |
| Medium | Add "Source Records" tab to detail dialogs | Full reconciliation | List all records that contribute to this number |
| Low | Add calculation audit log | Track changes over time | Show when values changed and why |

### Proposed Reconciliation Enhancement

```typescript
interface ReconcilableMetric {
  value: number;
  formula: string;          // "Properties + Accounts + Investments - Loans"
  components: Array<{
    label: string;          // "Properties"
    value: number;          // 1200000
    count: number;          // 2 properties
    drillDownUrl: string;   // "/dashboard/properties"
    sourceRecords: Array<{  // Shown on demand
      id: string;
      name: string;
      amount: number;
      href: string;
    }>;
  }>;
  calculatedAt: string;
  dataCompleteness: number; // 95%
}
```

---

## Architectural Alignment Assessment

### Design Principle Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| §2.3 Canonical Everything | COMPLIANT | Single source of truth via Master Financial Service |
| §5.1 Never Duplicate Logic | COMPLIANT | Centralized calculation utilities |
| §6.2 Master Financial Service | COMPLIANT | Financial snapshot service in use |
| §3.2 Everything is a Drill-Down | PARTIAL | Dialogs exist but not all numbers clickable |
| §3.1 Zero Dead-Ends | COMPLIANT | Actions and paths available |

### Centralization Audit

The following calculations are properly centralized:
- Net Worth: `lib/calculations/netWorthCalculator.ts`
- Cashflow: `lib/calculations/cashflowOrchestrator.ts`
- Expenses: `lib/calculations/expenseAggregator.ts`
- Income: `lib/calculations/incomeAggregator.ts`
- Loans: `lib/calculations/loanAggregator.ts`
- Frequencies: `lib/utils/frequencies.ts`
- Currency: `lib/utils/formatters.ts`

**No duplication violations found in dashboard code.**

---

## Priority Implementation Roadmap

### Phase 1: Critical Gaps (Immediate)

1. **Debt Quality Widget** - Surface good vs bad debt on dashboard
2. **Entity Cashflow Summary** - Show per-entity cashflow contributions
3. **Drill-down Links** - Make all dashboard numbers clickable to source

### Phase 2: High Priority (Short-term)

4. **Investment Account Income** - Show dividends/distributions
5. **Expense Trend Indicators** - Show spending direction
6. **Calculation Formulas** - Add transparency tooltips

### Phase 3: Medium Priority (Medium-term)

7. **Net Worth Trending** - Historical chart
8. **Linkage Health Indicator** - Data completeness badge
9. **Loan Cashflow Impact** - Show after-tax cost

### Phase 4: Enhancements (Long-term)

10. **Entity Comparison Chart** - Visual cashflow ranking
11. **Budget vs Actual Link** - Quick navigation
12. **Calculation Audit Log** - Change tracking

---

## Conclusion

The Monitrax dashboard has a **solid architectural foundation** with centralized calculations and a well-defined single source of truth. The primary gaps are in **user-facing visibility** of existing data, particularly:

1. **Debt categorization (good vs bad)** - Data exists but not surfaced
2. **Entity-level cashflow** - Partial implementation, needs investment/loan views
3. **Number reconciliation** - Needs better drill-down and transparency

The recommended enhancements maintain the existing design principles and build upon the centralized calculation infrastructure rather than introducing new complexity.

---

## Appendix: Files Reviewed

| File | Purpose |
|------|---------|
| `app/dashboard/page.tsx` | Main dashboard implementation |
| `lib/calculations/netWorthCalculator.ts` | Net worth calculation |
| `lib/calculations/cashflowOrchestrator.ts` | Cashflow calculation |
| `lib/calculations/loanAggregator.ts` | Loan/debt aggregation |
| `app/api/portfolio/snapshot/route.ts` | Portfolio snapshot API |
| `app/api/dashboard/insights/route.ts` | Dashboard insights API |
| `app/api/ai/debt-analysis/route.ts` | AI debt analysis |
| `app/dashboard/debt-planner/page.tsx` | Debt planner page |
| `docs/blueprint/02_DESIGN_PRINCIPLES.md` | Design principles |
| `docs/blueprint/MASTER_BLUEPRINT.md` | Master blueprint |
| Various blueprint phase documents | Feature specifications |

---

*Audit completed: 2026-01-20*
*Next review recommended: After Phase 1 implementation*
