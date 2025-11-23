# Monitrax Error Log

**Created:** 2025-11-23
**Last Updated:** 2025-11-23
**Branch:** `claude/health-feed-ui-sync-01Xx4ZXP52A3GcsBWGLS1r6r`

---

## Summary

This document tracks known errors and issues that need to be fixed in future sessions. These issues were identified during the Phase 9 Tasks 9.4 & 9.5 implementation but could not be resolved due to infrastructure constraints.

---

## Critical: Prisma Type Import Errors

### Root Cause
The Prisma client types are not being generated because `prisma generate` fails with a **403 Forbidden** error when trying to download engine binaries from `binaries.prisma.sh`. This is a network/infrastructure restriction.

### Error Details

| File | Line | Error Code | Missing Type |
|------|------|------------|--------------|
| `lib/depreciation/index.ts` | 12 | TS2305 | `DepreciationSchedule` |
| `lib/investments/index.ts` | 9 | TS2305 | `InvestmentHolding` |
| `lib/investments/index.ts` | 9 | TS2305 | `InvestmentTransaction` |
| `lib/planning/debtPlanner.ts` | 22 | TS2305 | `LoanType` |
| `lib/planning/debtPlanner.ts` | 22 | TS2305 | `RepaymentFrequency` |
| `lib/planning/debtPlanner.ts` | 22 | TS2305 | `RateType` |
| `lib/utils/frequencies.ts` | 1 | TS2305 | `Frequency` |
| `lib/utils/frequencies.ts` | 1 | TS2305 | `RepaymentFrequency` |

### Full Error Messages

```
lib/depreciation/index.ts(12,10): error TS2305: Module '"@prisma/client"' has no exported member 'DepreciationSchedule'.
lib/investments/index.ts(9,10): error TS2305: Module '"@prisma/client"' has no exported member 'InvestmentHolding'.
lib/investments/index.ts(9,29): error TS2305: Module '"@prisma/client"' has no exported member 'InvestmentTransaction'.
lib/planning/debtPlanner.ts(22,10): error TS2305: Module '"@prisma/client"' has no exported member 'LoanType'.
lib/planning/debtPlanner.ts(22,20): error TS2305: Module '"@prisma/client"' has no exported member 'RepaymentFrequency'.
lib/planning/debtPlanner.ts(22,40): error TS2305: Module '"@prisma/client"' has no exported member 'RateType'.
lib/utils/frequencies.ts(1,10): error TS2305: Module '"@prisma/client"' has no exported member 'Frequency'.
lib/utils/frequencies.ts(1,21): error TS2305: Module '"@prisma/client"' has no exported member 'RepaymentFrequency'.
```

### Solutions

#### Option 1: Run Prisma Generate (Preferred)
In an environment with network access to Prisma binaries:
```bash
npx prisma generate
```

#### Option 2: Offline Prisma Generate
If network is restricted, use cached engines:
```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
```

#### Option 3: Define Local Types (Workaround)
If Prisma generate continues to fail, create local type definitions that mirror the Prisma schema enums:

**Create `lib/types/prisma-enums.ts`:**
```typescript
// Local type definitions matching prisma/schema.prisma
// Use these if @prisma/client types are unavailable

export type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
export type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';
export type LoanType = 'PRINCIPAL_AND_INTEREST' | 'INTEREST_ONLY' | 'LINE_OF_CREDIT';
export type RateType = 'FIXED' | 'VARIABLE' | 'SPLIT';
export type DepreciationCategory = 'DIV40' | 'DIV43';
export type DepreciationMethod = 'PRIME_COST' | 'DIMINISHING_VALUE';

export interface DepreciationSchedule {
  id: string;
  assetName: string;
  category: DepreciationCategory;
  cost: number;
  startDate: Date;
  rate: number;
  method: DepreciationMethod;
  propertyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentHolding {
  id: string;
  investmentAccountId: string;
  ticker: string;
  units: number;
  averagePrice: number;
  frankingPercentage: number | null;
  type: 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentTransaction {
  id: string;
  investmentAccountId: string;
  holdingId: string | null;
  date: Date;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'DRP';
  price: number;
  units: number;
  fees: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Then update imports in affected files:
```typescript
// Instead of:
import { Frequency, RepaymentFrequency } from '@prisma/client';

// Use:
import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';
```

---

## Files Requiring Updates (by priority)

### Priority 1: lib/utils/frequencies.ts
- **Issue:** Imports `Frequency`, `RepaymentFrequency` from `@prisma/client`
- **Impact:** Used by multiple modules for frequency conversions
- **Fix:** Run `prisma generate` or use local types

### Priority 2: lib/planning/debtPlanner.ts
- **Issue:** Imports `LoanType`, `RepaymentFrequency`, `RateType` from `@prisma/client`
- **Impact:** Debt planning calculations
- **Fix:** Run `prisma generate` or use local types

### Priority 3: lib/depreciation/index.ts
- **Issue:** Imports `DepreciationSchedule` from `@prisma/client`
- **Impact:** Depreciation calculations for properties
- **Fix:** Run `prisma generate` or use local types

### Priority 4: lib/investments/index.ts
- **Issue:** Imports `InvestmentHolding`, `InvestmentTransaction` from `@prisma/client`
- **Impact:** Investment portfolio calculations
- **Fix:** Run `prisma generate` or use local types

---

## Infrastructure Issues

### Prisma Binary Download Blocked
- **Error:** `403 Forbidden` from `https://binaries.prisma.sh/`
- **Affected:** `prisma generate`, `prisma migrate`, `prisma db push`
- **Workaround:** Use pre-cached Prisma engines or run in unrestricted environment

---

## Completed Fixes (for reference)

### API Route Type Errors - FIXED ✅
All API routes now have explicit type annotations:
- `app/api/accounts/route.ts`
- `app/api/calculate/debt-plan/route.ts`
- `app/api/calculate/tax/route.ts`
- `app/api/debug/intelligence/route.ts`
- `app/api/expenses/route.ts`
- `app/api/income/route.ts`
- `app/api/investments/accounts/route.ts`
- `app/api/investments/holdings/route.ts`
- `app/api/loans/route.ts`
- `app/api/portfolio/snapshot/route.ts`
- `app/api/properties/route.ts`

**Pattern used:** `typeof array[number]` for Prisma query results

---

## Verification Commands

Check current TypeScript errors:
```bash
npx tsc --noEmit 2>&1 | grep "error TS"
```

Check only API route errors (should be 0):
```bash
npx tsc --noEmit 2>&1 | grep "app/api" | wc -l
```

Check Prisma status:
```bash
npx prisma generate --dry-run
```

---

## Notes

- The lib file errors do NOT block API functionality at runtime if using JavaScript
- Production builds require these to be resolved
- All new Phase 9 components (Task 9.4 & 9.5) compile successfully
- These errors are pre-existing infrastructure issues, not introduced by recent changes

---

## System Audit Findings (2025-11-23)

Added from comprehensive system-wide audit.

### CRITICAL: Phase 9.5 UI Components Not Integrated

**Issue ID:** AUD-001
**Severity:** CRITICAL
**Status:** OPEN

The following Phase 9.5 components are fully implemented but NOT mounted in any page:

#### Health Components (0% Integration)
| Component | File | Impact |
|-----------|------|--------|
| HealthSummaryWidget | `components/health/HealthSummaryWidget.tsx` | Health status not visible |
| ModuleHealthBlock | `components/health/ModuleHealthBlock.tsx` | Module health not visible |
| ModuleHealthGrid | `components/health/ModuleHealthBlock.tsx` | Grid view not visible |

#### Warning Components (0% Integration)
| Component | File | Impact |
|-----------|------|--------|
| GlobalWarningRibbon | `components/warnings/GlobalWarningRibbon.tsx` | Global warnings not shown |
| DialogWarningBanner | `components/warnings/DialogWarningBanner.tsx` | Dialog warnings not shown |
| EntityWarningBanner | `components/warnings/EntityWarningBanner.tsx` | Entity warnings not shown |
| WarningBanner | `components/warnings/WarningBanner.tsx` | Warning banners not shown |
| HealthAwareWarning | `components/warnings/HealthAwareWarning.tsx` | Health warnings not shown |

#### Insight Components (0% Integration)
| Component | File | Impact |
|-----------|------|--------|
| InsightCard | `components/insights/InsightCard.tsx` | Insights not using new cards |
| InsightList | `components/insights/InsightList.tsx` | Insights list not integrated |
| InsightSeverityMeter | `components/insights/InsightSeverityMeter.tsx` | Severity meter not shown |

**Fix Required:**
1. Add `useUISyncEngine` hook to DashboardLayout or main dashboard
2. Mount `GlobalWarningRibbon` at top of DashboardLayout
3. Add `HealthSummaryWidget` to dashboard
4. Integrate `InsightCard` and `InsightList` in insights panel
5. Add `DialogWarningBanner` to entity detail dialogs

---

### HIGH: useUISyncEngine Hook Not Used

**Issue ID:** AUD-002
**Severity:** HIGH
**Status:** OPEN

The `useUISyncEngine` hook (Task 9.4) is implemented but not used in any page.

**Location:** `hooks/useUISyncEngine.ts`
**Impact:** No real-time health/insight updates in UI

**Fix Required:**
```typescript
// In DashboardLayout.tsx or dashboard/page.tsx
import { useUISyncEngine } from '@/hooks/useUISyncEngine';

const { health, insights, isLoading, refresh } = useUISyncEngine({
  autoRefresh: true,
  refreshInterval: 30000,
});
```

---

### MEDIUM: InsightBadges Invalid Default Export

**Issue ID:** AUD-004
**Severity:** MEDIUM
**Status:** OPEN

**File:** `components/insights/InsightBadges.tsx` (Line 273)

**Issue:** Exports an object as default instead of a React component:
```typescript
export default {
  SeverityBadge,
  CategoryBadge,
  // ...
};
```

**Impact:** `import InsightBadges from '...'` returns an object, not a component.
**Workaround:** Use named imports (which the codebase already does).

---

### LOW: TODOs in Codebase

**Issue ID:** AUD-006
**Severity:** LOW
**Status:** ACKNOWLEDGED

| Location | Description |
|----------|-------------|
| `lib/planning/debtPlanner.ts:125` | Phase 3 calculation enhancement |
| `app/api/portfolio/snapshot/route.ts:767` | Tax engine calculation |
| `app/api/portfolio/snapshot/route.ts:768` | CGT calculation |

---

## Audit Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Source Code | ⚠️ | 8 Prisma errors (pre-existing) |
| UI Integration | ❌ | 15+ components not mounted |
| API Endpoints | ✅ | All 27 routes functional |
| CMNF Navigation | ✅ | Working in all 8 module pages |
| Blueprint Compliance | ⚠️ | Phase 9.5 incomplete |

**Full Report:** `docs/SYSTEM_AUDIT_REPORT.md`
