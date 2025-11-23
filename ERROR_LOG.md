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
