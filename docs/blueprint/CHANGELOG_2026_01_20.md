# Changelog - January 20, 2026

## Code Quality Audit: Deduplication & Centralization

This changelog documents the comprehensive code audit performed to align the codebase with Blueprint §5.1 "Never Duplicate Logic" and §2.3 "Canonical Everything".

---

## Stage 1: formatCurrency Deduplication

**Goal:** Replace all inline currency formatting with centralized `formatCurrency` utility.

### Files Updated (26 files)
- `app/dashboard/accounts/page.tsx`
- `app/dashboard/assets/page.tsx`
- `app/dashboard/cashflow/page.tsx`
- `app/dashboard/expenses/page.tsx`
- `app/dashboard/income/page.tsx`
- `app/dashboard/investments/page.tsx`
- `app/dashboard/loans/page.tsx`
- `app/dashboard/net-worth/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/properties/page.tsx`
- `app/dashboard/recurring/page.tsx`
- `app/dashboard/strategy/page.tsx`
- `app/dashboard/tax/page.tsx`
- `components/onboarding/steps/IncomeStep.tsx`
- `components/onboarding/steps/PropertyStep.tsx`
- `components/onboarding/steps/ReviewStep.tsx`
- And 10+ additional component files

### Pattern Replaced
```typescript
// Before
${value.toLocaleString()}
$${amount.toFixed(0)}

// After
import { formatCurrency } from '@/lib/utils/formatters';
formatCurrency(value)
```

---

## Stage 2: Frequency Multiplier Deduplication

**Goal:** Replace inline frequency conversion logic with centralized utilities.

### Centralized Utilities
Located in `lib/utils/frequencies.ts`:
- `toAnnual(amount, frequency)` - Convert any frequency to annual
- `toMonthly(amount, frequency)` - Convert any frequency to monthly
- `toFortnightly(amount, frequency)` - Convert to fortnightly
- `toWeekly(amount, frequency)` - Convert to weekly
- `periodsPerYear(frequency)` - Get periods per year for a frequency

### Files Updated (14 files)
- `lib/cfo/scoreCalculator.ts`
- `lib/cfo/riskRadar.ts`
- `lib/cfo/intelligenceEngine.ts`
- `lib/recurring/expenseMatcher.ts`
- `lib/bank/recurringMatcher.ts`
- `lib/tax-engine/income/salaryProcessor.ts`
- `lib/tax-engine/position/taxPositionCalculator.ts`
- `lib/cashflow/incomeNormalizer.ts`
- `app/api/assets/route.ts`
- `app/api/assets/[id]/route.ts`
- `components/onboarding/steps/PropertyStep.tsx`
- `components/onboarding/steps/IncomeStep.tsx`
- `components/onboarding/steps/ReviewStep.tsx`
- `components/onboarding/wizard/types.ts`

### Pattern Replaced
```typescript
// Before
const frequencyMultipliers = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
};
const annual = amount * frequencyMultipliers[frequency];

// After
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
const annual = toAnnual(amount, frequency as Frequency);
```

---

## Stage 3: Ownership Validation Utility

**Goal:** Create centralized ownership validation to replace repetitive authorization checks.

### New Utility
Located in `lib/utils/ownership.ts`:

```typescript
// Direct ownership check (returns 404)
verifyOwnership(resource, userId, 'Resource')

// Related entity check (returns 403)
verifyRelatedOwnership(resource, userId, 'Resource')

// Indirect ownership via parent
verifyIndirectOwnership(resource, parent, userId, 'Resource')

// Batch validation
verifyBatchOwnership(resources, requestedIds, userId, 'Resource')

// Boolean helper
checkOwnership(resource, userId)
```

### Files Updated (3 demonstration files)
- `app/api/expenses/[id]/route.ts`
- `app/api/accounts/[id]/route.ts`
- `app/api/income/[id]/route.ts`

### Pattern Replaced
```typescript
// Before
if (!expense || expense.userId !== authReq.user!.userId) {
  return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
}

// After
const result = verifyOwnership(expense, authReq.user!.userId, 'Expense');
if (!result.success) return result.response;
```

### Future Work
The utility is ready for adoption across 100+ API routes. Migration can be done incrementally.

---

## Stage 4: Onboarding Component Consolidation

**Goal:** Consolidate duplicate onboarding components and create shared utilities.

### New Shared Components
Located in `components/onboarding/shared/`:

| Component | Purpose |
|-----------|---------|
| `CurrencyInput.tsx` | Currency input with $ prefix |
| `FrequencySelect.tsx` | Frequency dropdown with standard options |
| `StatCard.tsx` | Statistics display card with variants |
| `SectionSummary.tsx` | Section summary card for reviews |
| `index.ts` | Exports all shared components |

### Deprecation Notice
Added `@deprecated` notice to `InitialSetupWizard.tsx`:
- Old wizard system is no longer used in the app
- `WizardContainer` (v2.0) is the active system
- Old `/steps/` directory kept for reference only

---

## Impact Summary

| Stage | Files Changed | Lines Reduced | New Utilities |
|-------|--------------|---------------|---------------|
| 1 | 26 | ~150 | - |
| 2 | 14 | ~200 | `frequencies.ts` |
| 3 | 4 | ~100 | `ownership.ts` |
| 4 | 6 | - | `shared/` components |
| **Total** | **50** | **~450** | **3 utilities** |

---

## Stage 5: Calculation Engine Centralization

**Goal:** Create centralized calculation engines to replace scattered calculations across API routes.

### Critical Bug Fixed
**`lib/income/netIncomeCalculator.ts`** had incorrect frequency multipliers:
```typescript
// BEFORE (wrong - ~8% error for weekly income)
WEEKLY: 4,        // Weekly × 4 = Monthly
FORTNIGHTLY: 2,   // Fortnightly × 2 = Monthly

// AFTER (correct)
// Now uses lib/utils/frequencies.ts:
// Weekly × 52 / 12 = 4.33 (accurate monthly equivalent)
```

### API Routes Updated (5 files)
Replaced local `normalizeToMonthly()` and `normalizeToAnnual()` functions with centralized imports:

| File | Functions Removed |
|------|------------------|
| `app/api/financial-health/route.ts` | `normalizeToMonthly()` |
| `app/api/cashflow/route.ts` | `normalizeToMonthly()` |
| `app/api/cashflow/summary/route.ts` | `normalizeToMonthly()` |
| `app/api/portfolio/snapshot/route.ts` | `normalizeToAnnual()`, `normalizeToMonthly()` |
| `lib/income/netIncomeCalculator.ts` | `MONTHLY_MULTIPLIERS` object |

### New Calculation Engines Created
Located in `lib/calculations/`:

| File | Purpose |
|------|---------|
| `index.ts` | Main exports for all engines |
| `netWorthCalculator.ts` | Single source for net worth: `calculateNetWorth()`, `calculateTotalAssets()`, `calculateTotalLiabilities()` |
| `cashflowOrchestrator.ts` | Single source for cashflow: `calculateCashflow()`, `calculateMonthlyCashflow()`, `calculateAnnualCashflow()` |
| `expenseAggregator.ts` | `aggregateExpenses()`, `aggregateExpensesByCategory()` |
| `incomeAggregator.ts` | `aggregateIncome()`, handles gross/net/PAYG |
| `loanAggregator.ts` | `aggregateLoanRepayments()`, `calculateDebtMetrics()`, `calculateLVR()` |

### Pattern Replaced
```typescript
// BEFORE - scattered across 4+ files
const monthlyExpenses = expenses.reduce(
  (sum, e) => sum + normalizeToMonthly(e.amount, e.frequency),
  0
);

// AFTER - single source of truth
import { aggregateExpenses } from '@/lib/calculations';
const { total: monthlyExpenses } = aggregateExpenses(expenses, 'monthly');
```

---

## Updated Impact Summary

| Stage | Files Changed | Lines Changed | New Code |
|-------|--------------|---------------|----------|
| 1 | 26 | -150 | - |
| 2 | 14 | -200 | `frequencies.ts` |
| 3 | 4 | +200 | `ownership.ts` |
| 4 | 6 | +343 | `shared/` components |
| 5 | 11 | +880 | `lib/calculations/` |
| **Total** | **61** | **+1073 net** | **5 modules** |

---

## Alignment with Blueprint

### §5.1 Never Duplicate Logic
- Eliminated 450+ lines of duplicate code
- Created 3 new centralized utilities
- Established patterns for future development

### §2.3 Canonical Everything
- Currency formatting: `lib/utils/formatters.ts`
- Frequency conversion: `lib/utils/frequencies.ts`
- Ownership validation: `lib/utils/ownership.ts`
- Onboarding components: `components/onboarding/shared/`
- **NEW** Net worth calculation: `lib/calculations/netWorthCalculator.ts`
- **NEW** Cashflow calculation: `lib/calculations/cashflowOrchestrator.ts`
- **NEW** Expense aggregation: `lib/calculations/expenseAggregator.ts`
- **NEW** Income aggregation: `lib/calculations/incomeAggregator.ts`
- **NEW** Loan aggregation: `lib/calculations/loanAggregator.ts`

### §7 Documentation Principles
- Single source of truth in `docs/blueprint/`
- Deleted duplicate `docs/MONITRAX_MASTER_BLUEPRINT.md`

---

## Stage 6: Complete Ownership Validation Migration

**Goal:** Migrate all remaining API routes to use centralized ownership validation utilities.

### Files Updated (14 files)

| File | Validation Functions Used |
|------|--------------------------|
| `app/api/assets/[id]/route.ts` | `verifyOwnership()` |
| `app/api/categories/[id]/route.ts` | `verifyOwnership()` |
| `app/api/loans/[id]/route.ts` | `verifyOwnership()`, `verifyRelatedOwnership()` |
| `app/api/properties/[id]/route.ts` | `verifyOwnership()` |
| `app/api/investments/accounts/[id]/route.ts` | `verifyOwnership()` |
| `app/api/investments/holdings/[id]/route.ts` | `verifyIndirectOwnership()` |
| `app/api/investments/transactions/[id]/route.ts` | `verifyIndirectOwnership()` |
| `app/api/expenses/route.ts` | `verifyRelatedOwnership()` |
| `app/api/income/route.ts` | `verifyRelatedOwnership()` |
| `app/api/loans/route.ts` | `verifyRelatedOwnership()` |
| `app/api/investments/holdings/route.ts` | `verifyOwnership()` |
| `app/api/investments/transactions/route.ts` | `verifyOwnership()` |
| `app/api/properties/[id]/depreciation/route.ts` | `verifyOwnership()` |
| `app/api/properties/[id]/depreciation/[depId]/route.ts` | `verifyOwnership()`, `notFound()` |

### Pattern Replaced
```typescript
// BEFORE - inline ownership checks
if (!resource || resource.userId !== authReq.user!.userId) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// AFTER - centralized utility
import { verifyOwnership } from '@/lib/utils/ownership';
const result = verifyOwnership(resource, authReq.user!.userId, 'Resource');
if (!result.success) return result.response;
```

### Indirect Ownership Pattern (for child entities)
```typescript
// For entities owned via parent (e.g., holdings via investmentAccount)
import { verifyIndirectOwnership } from '@/lib/utils/ownership';
const result = verifyIndirectOwnership(
  holding,
  holding?.investmentAccount,
  authReq.user!.userId,
  'Holding'
);
if (!result.success) return result.response;
```

### Related Entity Pattern (for POST/PUT with linked entities)
```typescript
// For validating related entities in create/update operations
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
if (propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
  if (!result.success) return result.response;
}
```

### Impact
- **0 inline ownership checks remaining** in `/app/api/` directory
- Consistent 404/403 error responses across all routes
- Type-safe validation with TypeScript generics
- Net code reduction: -5 lines (148 additions, 153 deletions)

---

## Final Impact Summary

| Stage | Files Changed | Description |
|-------|--------------|-------------|
| 1 | 26 | formatCurrency centralization |
| 2 | 14 | Frequency multiplier deduplication |
| 3 | 4 | Ownership utility creation |
| 4 | 6 | Onboarding component consolidation |
| 5 | 11 | Calculation engine centralization |
| 6 | 14 | Complete ownership validation migration |
| **Total** | **75** | **Full Blueprint §5.1 compliance** |

---

## Testing
All 132 utility tests pass after changes.
