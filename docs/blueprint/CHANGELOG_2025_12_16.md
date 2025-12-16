# Changelog — 2025-12-16

## Phase 30: Testing Framework & Calculation Bug Fixes

### Summary

Added a comprehensive testing framework for external AI verification and fixed multiple calculation inconsistencies discovered during testing.

---

## Part 1: Testing Framework

### Features Added

- **Comprehensive testing framework** for external AI tools to verify calculations
- **Flexible input format** supporting both ID-based (`propertyId`) and name-based (`propertyRef`) references
- **REST API endpoints** for loading test data, exporting calculations, and resetting test users
- **JSON Schema** for input validation
- **Pre-built test fixtures** for common scenarios

### Files Added

| File | Purpose |
|------|---------|
| `lib/testing/types.ts` | TypeScript interfaces for input/output |
| `lib/testing/normalizer.ts` | Converts flexible input to standard format |
| `lib/testing/loader.ts` | Loads test data into database |
| `lib/testing/exporter.ts` | Exports all calculated values |
| `lib/testing/reset.ts` | Resets test user data |
| `lib/testing/index.ts` | Main exports and convenience functions |
| `lib/testing/schemas/test-scenario.schema.json` | JSON Schema for validation |
| `lib/testing/fixtures/*.json` | Test scenario templates |
| `app/api/testing/route.ts` | Main testing API |
| `app/api/testing/load/route.ts` | Load endpoint |
| `app/api/testing/export/route.ts` | Export endpoint |
| `app/api/testing/reset/route.ts` | Reset endpoint |
| `docs/blueprint/PHASE_30_TESTING_FRAMEWORK.md` | Documentation |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/testing` | POST | Run complete test cycle (reset → load → export → verify) |
| `/api/testing/load` | POST | Load test scenario data |
| `/api/testing/export` | GET/POST | Export calculated values |
| `/api/testing/reset` | DELETE | Reset test user data |

---

## Part 2: Bug Fixes

### Bug #1: Portfolio LVR Calculation

**Location:** `app/api/portfolio/snapshot/route.ts:940-942`

**Issue:** Portfolio LVR was calculated using total assets instead of total property value.

**Before (Wrong):**
```typescript
portfolioLVR: totalAssets > 0
  ? Math.round((totalLiabilities / totalAssets) * 10000) / 100
  : 0,
```

**After (Correct):**
```typescript
portfolioLVR: totalPropertyValue > 0
  ? Math.round((totalLiabilities / totalPropertyValue) * 10000) / 100
  : 0,
```

**Impact:**
| Scenario | Before | After |
|----------|--------|-------|
| Test: Simple Investor | 63.1% | **70.0%** ✓ |

---

### Bug #2: CFO Savings Rate Missing Loan Repayments

**Location:** `lib/cfo/scoreCalculator.ts:352-385`

**Issue:** Savings rate calculation excluded loan repayments, showing inflated rate.

**Before (Wrong):**
```typescript
function calculateSavingsRate(incomes, expenses) {
  const savingsRate = (monthlyIncome - monthlyExpenses) / monthlyIncome;
}
```

**After (Correct):**
```typescript
function calculateSavingsRate(incomes, expenses, loans) {
  const monthlyLoanRepayments = loans.reduce(
    (sum, l) => sum + monthlyize(l.minRepayment, l.repaymentFrequency), 0
  );
  const savingsRate = (monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome;
}
```

**Impact:**
| Scenario | Before | After |
|----------|--------|-------|
| Test: Simple Investor | 93.9% | **76.7%** ✓ |

---

### Bug #3: Cashflow API Re-Taxing NET Income

**Location:** `app/api/calculate/cashflow/route.ts:89-173`

**Issue:** When salary income was entered as NET (after-tax), the API was re-calculating PAYG withholding, effectively double-taxing the income.

**Before (Wrong):**
```typescript
if (inc.type === 'SALARY') {
  // Always calculated PAYG, regardless of salaryType
  const takeHome = calculateTakeHomePay(inc.amount, inc.frequency);
  monthlyNet = toMonthly(takeHome.netAmount, inc.frequency);
}
```

**After (Correct):**
```typescript
if (inc.type === 'SALARY') {
  if (inc.salaryType === 'NET') {
    // User entered NET income - don't re-calculate PAYG
    monthlyNet = monthlyAmount; // Use as-is
  } else {
    // User entered GROSS income - calculate take-home pay
    const takeHome = calculateTakeHomePay(inc.amount, inc.frequency);
    monthlyNet = toMonthly(takeHome.netAmount, inc.frequency);
  }
}
```

**Also required:** Including `salaryType`, `netAmount`, `grossAmount` in database fetch (lines 242-251, 343-352).

**Impact:**
| Scenario | Before | After |
|----------|--------|-------|
| Test: Simple Investor Monthly Income | $10,346 | **$12,200** ✓ |
| Available for Extra Payments | $5,050 | **$6,903** ✓ |

---

## Test Scenario Validation

### Simple Investor Test Case

**Input Data:**
- Properties: 1 ($500k value, $350k loan)
- Accounts: Offset ($30k) + Savings ($15k)
- Investments: ETF Portfolio ($10k)
- Income: $6,000 + $4,000 + $2,200 = $12,200/month (all NET)
- Expenses: $746/month
- Loan Repayments: $2,100/month

**Expected Outputs:**

| Metric | Expected | Validated |
|--------|----------|-----------|
| Total Assets | $555,000 | ✓ |
| Total Liabilities | $350,000 | ✓ |
| Net Worth | $205,000 | ✓ |
| Portfolio LVR | 70.0% | ✓ |
| Monthly Income | $12,200 | ✓ |
| Monthly Expenses | $746 | ✓ |
| Monthly Net Cashflow | $9,354 | ✓ |
| Savings Rate | 76.7% | ✓ |

---

## Commits

```
d2cca0b fix: respect NET salary type in cashflow calculation
74757f0 fix: include loan repayments in CFO savings rate calculation
5867aa6 fix: correct Portfolio LVR calculation to use property value
e5f1a29 chore: trigger rebuild for env var change
1e74b02 feat: add simple-investor-001 test fixture
2e5f1bd feat: add flexible input format support for testing framework
5887e06 docs: add PHASE_30_TESTING_FRAMEWORK documentation
4080c78 feat: add comprehensive testing framework for external AI verification
```

---

## Security Notes

- Testing API is disabled in production by default
- Enable with `ENABLE_TESTING_API=true` environment variable
- Test user emails must contain "test" or use `@monitrax.test` domain
- Reset operations only allowed on test users
