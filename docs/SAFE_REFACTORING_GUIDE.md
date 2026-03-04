# Safe Refactoring Guide

This guide outlines the process for safely implementing fixes from the application audit without breaking existing functionality.

## Testing Infrastructure

### Available Test Commands

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:calculations    # Financial calculation tests
npm run test:regression      # API regression tests (requires DB)
npm run test:sanity          # Cross-module sanity tests (requires DB)

# Run with coverage
npm run test:coverage

# Full validation
npm run validate             # Seeds DB + runs tests + generates report
```

### Test Coverage

| Test Suite | Tests | Focus Area |
|------------|-------|------------|
| `tests/calculations` | 40 | Financial math, tax calculations |
| `tests/utils/formatters` | 50 | Currency, percentage, date formatting |
| `tests/utils/frequencies` | 42 | Frequency conversions (weekly→annual, etc.) |
| `tests/regression` | 50+ | API endpoints, golden baselines (requires DB) |
| `tests/sanity` | 20+ | Cross-module integration (requires DB) |

## Verification Script

A verification script is provided to check for issues before and after refactoring:

```bash
# Run all checks (recommended)
./scripts/verify-refactor.sh

# Quick mode (skip build)
./scripts/verify-refactor.sh --quick

# CI mode (exit on first failure)
./scripts/verify-refactor.sh --ci
```

### What It Checks

1. **TypeScript Compilation** - No type errors
2. **ESLint** - No linting errors
3. **Unit Tests** - All tests pass
4. **Production Build** - Build completes successfully
5. **Code Quality** - Checks for duplicates, console.logs, TODOs

---

## Safe Refactoring Process

### Phase 1: Consolidate formatCurrency

**Files to update (replace local implementation with import):**

```typescript
// Add this import at the top of each file:
import { formatCurrency } from '@/lib/utils/formatters';

// Remove local formatCurrency function
```

**Order of changes (safest first):**

1. `components/form/CurrencyInput.tsx`
2. `components/recurring/MatchConfirmationDialog.tsx`
3. `components/onboarding/wizard/steps/ReviewStep.tsx`
4. `components/onboarding/wizard/steps/AccountsStep.tsx`
5. `components/onboarding/wizard/steps/IncomeExpensesStep.tsx`
6. `components/onboarding/wizard/steps/InvestmentsStep.tsx`
7. `components/onboarding/wizard/steps/AssetsStep.tsx`
8. `app/(dashboard)/recurring/page.tsx`
9. `app/(dashboard)/strategy/[id]/page.tsx`
10. `app/(dashboard)/transactions/page.tsx`
11. `app/(dashboard)/cashflow/components/intelligence/*` (multiple files)
12. `lib/reports/generators/index.ts`
13. `lib/reports/exporters/csv.ts`
14. `lib/reports/exporters/xlsx.ts`

**Process for each file:**

```bash
# 1. Make the change
# 2. Run quick verification
./scripts/verify-refactor.sh --quick

# 3. If passes, commit
git add <file>
git commit -m "refactor: Use centralized formatCurrency in <ComponentName>"

# 4. Repeat
```

### Phase 2: Consolidate Frequency Multipliers

**Files to update:**

```typescript
// Add this import:
import { toAnnual, toMonthly, periodsPerYear } from '@/lib/utils/frequencies';

// Replace inline multipliers:
// Before: amount * 52
// After:  toAnnual(amount, 'WEEKLY')

// Before: amount * 12
// After:  toAnnual(amount, 'MONTHLY')
```

**Files to update:**
1. `app/api/assets/route.ts`
2. `app/api/assets/[id]/route.ts`
3. `components/onboarding/steps/PropertyStep.tsx`
4. `components/onboarding/steps/ReviewStep.tsx`
5. `components/onboarding/steps/IncomeStep.tsx`
6. `lib/cfo/riskRadar.ts`
7. `lib/cfo/scoreCalculator.ts`
8. `lib/cfo/intelligenceEngine.ts`
9. `lib/recurring/expenseMatcher.ts`
10. `lib/bank/recurringMatcher.ts`
11. `lib/tax-engine/income/salaryProcessor.ts`
12. `lib/tax-engine/position/taxPositionCalculator.ts`
13. `lib/cashflow/incomeNormalizer.ts`

### Phase 3: Create Ownership Validation Middleware

**New utility to create:**

```typescript
// lib/api/ownership.ts
export async function validateOwnership<T>(
  prisma: PrismaClient,
  model: string,
  id: string,
  userId: string
): Promise<T | null> {
  const entity = await (prisma as any)[model].findUnique({
    where: { id },
  });

  if (!entity || entity.userId !== userId) {
    return null;
  }

  return entity;
}

// Usage in API routes:
const property = await validateOwnership(prisma, 'property', propertyId, userId);
if (!property) {
  return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 });
}
```

---

## Rollback Strategy

If issues are found after a refactoring commit:

```bash
# Revert the last commit
git revert HEAD

# Or reset to before the change
git reset --hard HEAD~1

# Run verification to confirm rollback worked
./scripts/verify-refactor.sh
```

---

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/verify.yml
name: Verify Refactoring

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: ./scripts/verify-refactor.sh --ci
```

---

## Checklist

Use this checklist for each refactoring change:

- [ ] Read the file you're about to change
- [ ] Understand how the local implementation differs (if at all) from centralized
- [ ] Make the change
- [ ] Run `./scripts/verify-refactor.sh --quick`
- [ ] Check that tests pass
- [ ] Commit with descriptive message
- [ ] Push to branch
- [ ] Run full verification before PR

---

## Test Results Baseline

**Established on:** January 20, 2026

| Suite | Tests | Status |
|-------|-------|--------|
| Calculations | 40 | Pass |
| Formatters (new) | 50 | Pass |
| Frequencies (new) | 42 | Pass |
| **Total Unit Tests** | **132** | **Pass** |

**Note:** Regression and sanity tests require database connection and will be run in CI/local dev environment.
