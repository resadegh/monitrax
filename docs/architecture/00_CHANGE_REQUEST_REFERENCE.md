# 📋 **00 — CHANGE REQUEST REFERENCE**
### *Mandatory Reference for All Code Changes*

---

## **Purpose**

This document MUST be referenced before making ANY code changes to Monitrax. It ensures all changes follow established principles and use centralized utilities.

**Before writing ANY code, verify compliance with these principles.**

---

## **1. Core Principles Checklist**

Before implementing ANY change, verify:

| Principle | Question | Reference |
|-----------|----------|-----------|
| §2.3 Canonical Everything | Is there already a canonical source for this? | [02_DESIGN_PRINCIPLES.md](./02_DESIGN_PRINCIPLES.md) |
| §5.1 Never Duplicate Logic | Does this logic exist elsewhere? | See §2 below |
| §6.2 Snapshot Engine | Am I getting financial data from `/api/portfolio/snapshot`? | [02_DESIGN_PRINCIPLES.md](./02_DESIGN_PRINCIPLES.md) |
| §7.1 Single Source of Truth | Is documentation in `docs/blueprint/`? | [02_DESIGN_PRINCIPLES.md](./02_DESIGN_PRINCIPLES.md) |

---

## **2. Centralized Utilities — MUST USE**

### **2.1 Currency Formatting**
```typescript
// ✅ CORRECT
import { formatCurrency } from '@/lib/utils/formatters';
formatCurrency(1234.56) // "$1,234.56"

// ❌ WRONG - Never do this
`$${value.toLocaleString()}`
`$${amount.toFixed(0)}`
```

### **2.2 Frequency Conversion**
```typescript
// ✅ CORRECT
import { toAnnual, toMonthly, periodsPerYear } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

toMonthly(1000, 'WEEKLY' as Frequency)  // 4333.33 (1000 × 52 / 12)
toAnnual(1000, 'MONTHLY' as Frequency)  // 12000 (1000 × 12)

// ❌ WRONG - Never create local frequency multipliers
const MONTHLY_MULTIPLIERS = { WEEKLY: 4, ... }  // WRONG!
function normalizeToMonthly() { ... }           // WRONG!
```

### **2.3 Ownership Validation**
```typescript
// ✅ CORRECT
import { verifyOwnership, verifyRelatedOwnership } from '@/lib/utils/ownership';

const result = verifyOwnership(expense, authReq.user!.userId, 'Expense');
if (!result.success) return result.response;

// ❌ WRONG - Never inline ownership checks
if (!expense || expense.userId !== authReq.user!.userId) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

### **2.4 Financial Calculations**
```typescript
// ✅ CORRECT - Use centralized calculation engines
import {
  calculateNetWorth,
  calculateCashflow,
  aggregateExpenses,
  aggregateIncome,
  aggregateLoanRepayments
} from '@/lib/calculations';

// ❌ WRONG - Never calculate inline
const total = expenses.reduce((sum, e) => sum + e.amount * multiplier, 0);
```

---

## **3. Canonical Source Locations**

| Data/Logic | Canonical Source | Usage |
|------------|------------------|-------|
| Currency formatting | `lib/utils/formatters.ts` | All UI display |
| Frequency conversion | `lib/utils/frequencies.ts` | All amount normalization |
| Ownership checks | `lib/utils/ownership.ts` | All API routes |
| Net worth | `lib/calculations/netWorthCalculator.ts` | Portfolio, dashboard |
| Cashflow | `lib/calculations/cashflowOrchestrator.ts` | Cashflow pages, forecasts |
| Expense totals | `lib/calculations/expenseAggregator.ts` | All expense summaries |
| Income totals | `lib/calculations/incomeAggregator.ts` | All income summaries |
| Loan totals | `lib/calculations/loanAggregator.ts` | All loan calculations |
| Financial snapshot | `/api/portfolio/snapshot` | All financial data queries |
| Entity relationships | GRDCS (`lib/grdcs/`) | All entity linking |
| Insights/meaning | Insights Engine (`lib/insights/`) | All user-facing insights |

---

## **4. Before Creating New Code**

### **4.1 New Utility Functions**
Before creating a new utility:
1. Search existing `lib/utils/` and `lib/calculations/`
2. Check if similar logic exists in any API route
3. If it exists, use it; if not, add to appropriate centralized location

### **4.2 New API Routes**
Every API route MUST:
1. Use `withAuth()` from `lib/middleware.ts`
2. Use `verifyOwnership()` from `lib/utils/ownership.ts`
3. Use standardized responses from `lib/utils/api-response.ts`
4. Return GRDCS-compatible data shapes

### **4.3 New Calculations**
Before adding ANY calculation:
1. Check `lib/calculations/` for existing engine
2. If calculation is reusable, add to appropriate aggregator
3. Never inline financial math in API routes or components

### **4.4 New Components**
For onboarding components:
1. Check `components/onboarding/shared/` first
2. Use `CurrencyInput`, `FrequencySelect`, `StatCard`, `SectionSummary`

---

## **5. Prohibited Patterns**

| Pattern | Why Prohibited | Correct Approach |
|---------|---------------|------------------|
| Inline frequency multipliers | Creates calculation drift | Use `lib/utils/frequencies.ts` |
| Local `normalizeToMonthly()` | Duplicates logic | Import from centralized |
| Inline ownership checks | Inconsistent error handling | Use `lib/utils/ownership.ts` |
| `.reduce()` for financial totals | Duplicates aggregation logic | Use `lib/calculations/` engines |
| Storing calculated values in DB | Data drift on rate changes | Compute on retrieval |
| Creating new enums | Fragmentation | Use `lib/types/prisma-enums.ts` |

---

## **6. Change Validation Checklist**

Before submitting ANY PR:

- [ ] No duplicate logic introduced (check existing utilities)
- [ ] Using centralized frequency utilities (not local multipliers)
- [ ] Using centralized ownership validation (not inline checks)
- [ ] Financial calculations use `lib/calculations/` engines
- [ ] Currency formatting uses `formatCurrency()`
- [ ] Documentation updates in `docs/blueprint/` (not elsewhere)
- [ ] All tests passing
- [ ] TypeScript compiles without errors

---

## **7. Reference Documents**

| Document | Purpose |
|----------|---------|
| [02_DESIGN_PRINCIPLES.md](./02_DESIGN_PRINCIPLES.md) | Core principles and philosophy |
| [03_DATA_MODEL.md](./03_DATA_MODEL.md) | Database schema and relationships |
| [07_API_STANDARDS.md](./07_API_STANDARDS.md) | API design patterns |
| [AUDIT_DATABASE_CALCULATIONS_2026_01.md](./AUDIT_DATABASE_CALCULATIONS_2026_01.md) | Known issues and recommendations |
| [CHANGELOG_2026_01_20.md](./CHANGELOG_2026_01_20.md) | Recent centralization changes |

---

## **8. Quick Reference Commands**

```bash
# Find existing utilities
grep -r "export function" lib/utils/ lib/calculations/

# Check for duplicate patterns
grep -r "normalizeToMonthly\|normalizeToAnnual" app/api/

# Verify no inline frequency multipliers
grep -r "WEEKLY.*52\|FORTNIGHTLY.*26" app/ lib/ --include="*.ts"

# Run type check
npx tsc --noEmit

# Run tests
npm test
```

---

**Last Updated:** January 20, 2026
**Applies To:** All code changes in Monitrax codebase
