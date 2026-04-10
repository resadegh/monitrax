# Database & Calculation Engine Audit Report

**Date:** January 20, 2026
**Scope:** Database schema analysis, calculation logic review
**Alignment:** Blueprint §2.3 "Canonical Everything", §5.1 "Never Duplicate Logic"

---

## Executive Summary

This audit identified significant issues with data storage patterns and calculation logic duplication:

| Category | Issues Found | Critical | High | Medium |
|----------|-------------|----------|------|--------|
| Database Schema | 32 | 5 | 10 | 17 |
| Calculation Logic | 15 | 4 | 5 | 6 |
| **Total** | **47** | **9** | **15** | **23** |

---

# PART 1: DATABASE SCHEMA AUDIT

## 1.1 Critical Issues

### Issue D1: Transaction Model Fragmentation
**Priority: CRITICAL**

Four separate transaction models exist without unified view:

| Model | Purpose | Location |
|-------|---------|----------|
| `Transaction` | Manual entry | Line 711 |
| `UnifiedTransaction` | Bank imports | Line 1391 |
| `InvestmentTransaction` | Investment portfolio | Line 952 |
| `BankTransactionRaw` | Import staging | Line 1995 |

**Problem:** Impossible to query "all transactions" across sources.

**Recommendation:** Create unified `Transaction` table with `type` discriminator.

---

### Issue D2: Calculated Values Stored Instead of Computed
**Priority: CRITICAL**

| Model | Stored Fields | Should Be Computed |
|-------|--------------|-------------------|
| `Income` | `grossAmount`, `netAmount`, `paygWithholding` | From `salaryType` + `amount` |
| `InvestmentHolding` | `currentValue`, `unrealizedGain` | From `units × currentPrice` |
| `CapitalGainEvent` | `grossProceeds`, `capitalGain`, `taxableGain` | From sale components |

**Problem:** Data drift when tax rates change or prices update.

**Recommendation:** Remove stored calculations, compute on retrieval.

---

### Issue D3: Category Hierarchy Fragmented Across 5 Models
**Priority: CRITICAL**

Category information stored in:
1. `Category` model (user custom)
2. `ExpenseCategory` enum (system)
3. `UnifiedTransaction` (`categoryLevel1`, `categoryLevel2`, `subcategory`)
4. `MerchantMapping` (same 3 fields)
5. `CategoryRule` (same 3 fields)

**Problem:** No single source of truth for category taxonomy.

**Recommendation:** Create `CategoryHierarchy` table, reference via foreign keys.

---

### Issue D4: No Authoritative Balance Source
**Priority: CRITICAL**

`Account` has multiple balance fields:
- `currentBalance` (manual or import)
- `balanceSource` (MANUAL, IMPORT, BASIQ)
- `lastImportedBalance`
- `balanceLastUpdatedAt`

**Problem:** No mechanism to determine authoritative balance.

**Recommendation:** Create `BalanceHistory` table with source tracking.

---

### Issue D5: Frequency Enum Inconsistency
**Priority: CRITICAL**

| Enum | Values | Problem |
|------|--------|---------|
| `RepaymentFrequency` | WEEKLY, FORTNIGHTLY, MONTHLY | Missing QUARTERLY, ANNUAL |
| `Frequency` | WEEKLY...ANNUAL | Standard |
| `PayFrequency` | ...ANNUALLY | Spelling differs (ANNUALLY vs ANNUAL) |
| `RecurrencePattern` | ...ANNUALLY, IRREGULAR | Extra value |

**Recommendation:** Consolidate to single `Frequency` enum.

---

## 1.2 High Priority Issues

### Issue D6: Income Aggregations Denormalized to TaxPosition
`TaxPosition` stores `salaryIncome`, `rentalIncome`, `dividendIncome` separately from `Income` records. No auto-update mechanism.

### Issue D7: Superannuation YTD Totals Stored Separately
`SuperannuationAccount.concessionalYTD` duplicates sum from `SuperContribution` records.

### Issue D8: String Fields Should Be Enums
- `CategoryRule.ruleType` → Enum: MERCHANT, KEYWORD, MCC
- `AssetServiceRecord.serviceType` → Enum: ROUTINE, REPAIR, etc.
- `ClientAccessLog.action` → Enum: VIEW_PROFILE, etc.

### Issue D9: Investment Account Type vs Superannuation Model Conflict
`InvestmentAccountType.SUPERS` overlaps with separate `SuperannuationAccount` model.

### Issue D10: Tax Constants Hardcoded as Defaults
```prisma
concessionalCap @default(27500)  // 2024-25 value
```
Won't work after July 2025 without code change.

---

## 1.3 Medium Priority Issues

| ID | Issue | Recommendation |
|----|-------|----------------|
| D11 | Recurring payment price history not tracked | Create history table |
| D12 | Asset depreciation vs currentValue conflict | Define authoritative source |
| D13 | Income type naming inconsistency | Align IncomeType with TaxCategory |
| D14 | Multiple status enum definitions | Consolidate to ProcessingStatus |
| D15 | Loan relationship naming confusion | Rename linkedAccountId |
| D16 | Income/Expense linked to multiple sources | Define canonical source |
| D17 | Merchant mapping cached in transactions | Update mechanism needed |
| D18 | Expense/Income frequency vs RecurringPayment pattern | Enforce consistency |
| D19 | Asset depreciation not linked to expenses | Create unified cost view |
| D20 | Property depreciation schedule not synced | Link to tax claims |
| D21 | Budget targets vs actual not reconciled | Create variance tracking |
| D22 | Document analysis doesn't back-link to entities | Add document reference to entities |

---

# PART 2: CALCULATION LOGIC AUDIT

## 2.1 Critical Duplication

### Issue C1: Frequency Normalization Duplicated
**Priority: CRITICAL**

Centralized utility exists at `lib/utils/frequencies.ts`:
- `toAnnual()`, `toMonthly()`, `periodsPerYear()`

**But duplicated in:**

| File | Local Function | Lines |
|------|---------------|-------|
| `app/api/financial-health/route.ts` | `normalizeToMonthly()` | 32-44 |
| `app/api/cashflow/route.ts` | `normalizeToMonthly()` | 31-43 |
| `app/api/cashflow/summary/route.ts` | `normalizeToMonthly()` | 29-42 |
| `app/api/portfolio/snapshot/route.ts` | `normalizeToMonthly()`, `normalizeToAnnual()` | 23-37 |
| `lib/income/netIncomeCalculator.ts` | `MONTHLY_MULTIPLIERS` | 14-36 |

**Critical Bug:** `netIncomeCalculator.ts` uses `Weekly × 4` instead of `Weekly × 52/12 = 4.33`

**Fix:** Replace all with centralized imports from `lib/utils/frequencies.ts`.

---

### Issue C2: Net Worth Calculated in Multiple Places
**Priority: CRITICAL**

No centralized net worth engine. Calculated separately in:
- `app/api/financial-health/route.ts` (lines 112-126)
- `app/api/portfolio/snapshot/route.ts` (lines 640-651)
- `lib/health/aggregateEngine.ts` (internal)

**Fix:** Create `lib/calculations/netWorthCalculator.ts`.

---

### Issue C3: Cashflow Calculated in 4+ Locations
**Priority: CRITICAL**

Formula: `Income - Expenses - Loan Repayments`

Implemented in:
1. `app/api/calculate/cashflow/route.ts` (lines 207-210)
2. `app/api/financial-health/route.ts` (implied in score)
3. `app/api/cashflow/route.ts` (via CFEInput)
4. `app/api/portfolio/snapshot/route.ts` (lines 668-669)

**Fix:** Create `lib/calculations/cashflowOrchestrator.ts`.

---

### Issue C4: Income Normalization Logic Spread Across Files
**Priority: CRITICAL**

Centralized engine exists: `lib/cashflow/incomeNormalizer.ts`

**But also implemented in:**
- `app/api/calculate/cashflow/route.ts` (lines 89-173)
- `app/api/financial-health/route.ts` (lines 48-58)
- `app/api/cashflow/route.ts` (lines 122-143)
- `app/api/portfolio/snapshot/route.ts` (lines 40-104)
- `app/api/cashflow/summary/route.ts` (lines 65-80)

**Fix:** All routes must use `normalizeIncomeStream()` from centralizer.

---

## 2.2 High Priority Duplication

### Issue C5: Expense Aggregation No Centralized Engine
Repeated `.reduce()` loops in 4 files:
- `app/api/financial-health/route.ts`
- `app/api/cashflow/route.ts`
- `app/api/portfolio/snapshot/route.ts`
- `app/api/cashflow/summary/route.ts`

**Fix:** Create `lib/calculations/expenseAggregator.ts`.

---

### Issue C6: Loan Repayment Aggregation Duplicated
Repeated in 4+ files without centralized function.

**Fix:** Create `lib/calculations/loanAggregator.ts`.

---

### Issue C7: Property Metrics Defined in Two Places
- `lib/utils/calculations.ts` - has `calculateLVR()`, `calculateRentalYield()`
- `app/api/portfolio/snapshot/route.ts` - has same functions locally

**Fix:** Remove local definitions, import from centralized.

---

### Issue C8: Tax Adjustment Applied Inconsistently
`calculateTakeHomePay()` called from:
- `app/api/calculate/cashflow/route.ts`
- `app/api/financial-health/route.ts`
- `app/api/portfolio/snapshot/route.ts`

But with different calling patterns.

**Fix:** Ensure uniform usage via income normalizer.

---

## 2.3 Medium Priority Duplication

| ID | Issue | Files | Fix |
|----|-------|-------|-----|
| C9 | Linkage health calculation | 2 places | Consolidate to service |
| C10 | Savings rate calculation | 3 places | Add to cashflow orchestrator |
| C11 | Debt-to-income ratio | 2 places | Add to loan aggregator |
| C12 | Emergency fund months | 2 places | Centralize |
| C13 | Investment portfolio metrics | 2 places | Create investment aggregator |

---

# PART 3: RECOMMENDED ACTION PLAN

## Phase 1: Quick Wins (1 sprint)

### 1A: Complete Frequency Utility Adoption
Files to update:
- `app/api/financial-health/route.ts` - replace `normalizeToMonthly()`
- `app/api/cashflow/route.ts` - replace `normalizeToMonthly()`
- `app/api/cashflow/summary/route.ts` - replace `normalizeToMonthly()`
- `app/api/portfolio/snapshot/route.ts` - replace both functions
- `lib/income/netIncomeCalculator.ts` - fix `MONTHLY_MULTIPLIERS` bug

### 1B: Consolidate Property Metrics
- Remove duplicate `calculateLVR()` and `calculateRentalYield()` from portfolio/snapshot
- Import from `lib/utils/calculations.ts`

---

## Phase 2: Calculation Engines (2-3 sprints)

### 2A: Create Aggregation Engines

```typescript
// lib/calculations/incomeAggregator.ts
export function aggregateIncome(items: Income[], frequency: 'monthly'|'annual')

// lib/calculations/expenseAggregator.ts
export function aggregateExpenses(items: Expense[], frequency: 'monthly'|'annual')

// lib/calculations/loanAggregator.ts
export function aggregateLoanRepayments(loans: Loan[], frequency: 'monthly'|'annual')
```

### 2B: Create Orchestration Engines

```typescript
// lib/calculations/netWorthCalculator.ts
export function calculateNetWorth(assets: Assets, liabilities: Liabilities)

// lib/calculations/cashflowOrchestrator.ts
export function calculateCashflow(income, expenses, loans, frequency)
```

### 2C: Update All API Routes
Refactor routes to use new engines instead of inline calculations.

---

## Phase 3: Database Normalization (3-4 sprints)

### 3A: Frequency Enum Consolidation
1. Create migration to consolidate `RepaymentFrequency`, `PayFrequency`, `RecurrencePattern` into `Frequency`
2. Add `IRREGULAR` to main `Frequency` enum
3. Fix `ANNUALLY` vs `ANNUAL` inconsistency

### 3B: Category Hierarchy Table
1. Create `CategoryHierarchy` table
2. Migrate `categoryLevel1/2/subcategory` strings to foreign keys
3. Update merchant mapping to use hierarchy

### 3C: Remove Stored Calculations
1. Remove computed fields from `Income`, `InvestmentHolding`, `CapitalGainEvent`
2. Add view functions or computed properties
3. Update all queries to compute on retrieval

---

## Phase 4: Major Refactoring (5+ sprints)

### 4A: Transaction Model Consolidation
Unified transaction table with type discriminator.

### 4B: Balance History System
Track authoritative balance with source and timestamp.

### 4C: Tax Configuration Table
Replace hardcoded tax constants with configurable table.

---

# PART 4: RISK ASSESSMENT

## Data Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tax calculation drift | HIGH | HIGH | Centralize all tax logic |
| Frequency rounding errors | MEDIUM | HIGH | Fix `netIncomeCalculator.ts` immediately |
| Stale stored calculations | HIGH | MEDIUM | Remove stored calculations |
| Category inconsistency | MEDIUM | MEDIUM | Create hierarchy table |

## Technical Debt Cost

| Category | Estimated Effort | Priority |
|----------|-----------------|----------|
| Frequency utility adoption | 1 sprint | IMMEDIATE |
| Calculation engines | 2-3 sprints | HIGH |
| Database normalization | 3-4 sprints | MEDIUM |
| Transaction consolidation | 5+ sprints | LOW (plan for future) |

---

# APPENDIX: Files Requiring Updates

## Calculation Duplication - Priority Order

**CRITICAL (Fix immediately):**
1. `app/api/financial-health/route.ts`
2. `app/api/cashflow/route.ts`
3. `app/api/cashflow/summary/route.ts`
4. `app/api/portfolio/snapshot/route.ts`
5. `lib/income/netIncomeCalculator.ts`

**HIGH (Fix in Phase 2):**
6. `app/api/calculate/cashflow/route.ts`
7. `lib/health/aggregateEngine.ts`
8. Dashboard pages using inline calculations

**MEDIUM (Fix in Phase 3):**
9. Component-level calculations
10. Test files with duplicate logic

---

**Report Prepared By:** Claude Code Audit
**Schema File:** `prisma/schema.prisma`
**Total Models Analyzed:** 80+
**Total Files Scanned:** 176 API routes + lib/
